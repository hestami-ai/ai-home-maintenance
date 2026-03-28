March 16, 2026

[Product](https://openai.com/news/product-releases/)[Security](https://openai.com/news/security/)

# Why Codex Security Doesn’t Include a SAST Report

Share  
For decades, static application security testing (SAST) has been one of the most effective ways security teams scale code review. 

But when we built Codex Security, we made a deliberate design choice: we didn’t start by importing a static analysis report and asking the agent to triage it. We designed the system to start with the repository itself—its architecture, trust boundaries, and intended behavior—and to validate what it finds before it asks a human to spend time on it. 

The reason is simple: the hardest vulnerabilities usually aren’t dataflow problems. They happen when code appears to enforce a security check, but that check doesn’t actually guarantee the property the system relies on. In other words, the challenge isn’t just tracking how data moves through a program—it’s determining whether the defenses in the code really work.

## The problem: SAST is optimized for dataflow

SAST is often framed as a clean pipeline: identify a source of untrusted input, track data through the program, and flag cases where that data reaches a sensitive sink without sanitization. It’s an elegant model, and it covers a lot of real bugs.

In practice, SAST has to make approximations to stay tractable at scale—especially in real codebases with indirection, dynamic dispatch, callbacks, reflection, and framework-heavy control flow. Those approximations aren’t a knock on SAST; they’re the reality of trying to reason about code without executing it.

That, by itself, is not why Codex Security doesn’t start with a SAST report.

The deeper issue is what happens after you successfully trace a source to a sink.

#### Where static analysis struggles: constraints and semantics

Even when static analysis correctly traces input across multiple functions and layers, it still has to answer the question that actually determines whether a vulnerability exists:

#### Did the defense really work?

Take a common pattern: code calls something like sanitize\_html() before rendering untrusted content. A static analyzer can see that the sanitizer ran. What it usually can’t determine is whether that sanitizer is actually sufficient for the specific rendering context, template engine, encoding behavior, and downstream transformations involved.

That’s where things get tricky. The problem isn’t just whether data reaches a sink. It’s whether the checks in the code actually constrain the value in the way the system assumes they do.

Put differently: there’s a big difference between “the code calls a sanitizer” and “the system is safe.”

## Example: validation before decoding

Here’s a pattern that shows up in real systems all the time.

A web application receives a JSON payload, extracts a redirect\_url, validates it against an allowlist regex, URL-decodes it, and passes the result to a redirect handler.

A classic source-to-sink report can describe the flow:

untrusted input → regex check → URL decode → redirect

But the real question isn’t whether the check exists. It’s whether that check still constrains the value after the transformations that follow.

If the regex runs before decoding, does it actually constrain the decoded URL the way the redirect handler interprets it?

Answering that means reasoning about the entire transformation chain: what the regex allows, how decoding and normalization behave, how URL parsing treats edge cases, and how the redirect logic resolves schemes and authorities.

Many of the vulnerabilities that matter in practice look like this: order-of-operations mistakes, partial normalization, parsing ambiguities, and mismatches between validation and interpretation. The dataflow is visible. The weakness is in how constraints propagate—or fail to propagate—through the transformation chain.

This isn’t just a theoretical pattern. In [CVE-2024-29041⁠](https://nvd.nist.gov/vuln/detail/CVE-2024-29041)

[(opens in a new window)](https://nvd.nist.gov/vuln/detail/CVE-2024-29041)

, Express was affected by an open redirect issue where malformed URLs could bypass common allowlist implementations because of how redirect targets were encoded and then interpreted. The dataflow was straightforward. The harder question—and the one that determined whether the bug existed—was whether the validation still held after the transformation chain.

## Our approach: start from behavior, then validate

Codex Security is built around a simple goal: reduce triage by surfacing issues with stronger evidence. In the product, that means using repo-specific context (including a threat model) and validating high-signal issues in an isolated environment before surfacing them. 

When Codex Security encounters a boundary that looks like “validation” or “sanitization,” it doesn’t treat that as a checkbox. It tries to understand what the code is attempting to guarantee—and then it tries to falsify that guarantee.

In practice, that tends to look like a mix of:

* Reading the relevant code path with full repository context, the way a security researcher would, and looking for mismatches between intent and implementation. This includes comments, but the model does not necessarily believe comments so adding *//Halvar says: this is not a bug* above your code does not confuse it, if there really is a bug.  
* Reducing the problem to the smallest testable slice (for example, the transformation pipeline around a single input), so you can reason about it without the rest of the system in the way. In this sense, Codex Security pulls out tiny code slices and then writes micro-fuzzers for them.  
* Reasoning about constraints across transformations, rather than treating each check independently. Where appropriate, this can include formalization as a satisfiability question. In other words, we give the model access to a Python environment with z3-solver and it is good at using it when needed, just as a human would have to when answering a particularly complicated input constraint problem. This is especially useful for looking at integer overflows or similar bugs on non-standard architectures.  
* Executing hypotheses in a sandboxed validation environment when possible, to distinguish “this could be a problem” from “this is a problem”. There's no better proof than a full end-to-end PoC with the code compiled in debug mode. 

This is the key shift: instead of stopping at “a check exists,” the system pushes toward “the invariant holds (or it doesn’t), and here’s the evidence”. And the model chooses the best tool for that job.

## Why we don’t seed Codex Security with a SAST report

A reasonable reaction is: why not do both? Start with a SAST report, then use the agent to reason deeper.

There are cases where precomputed findings are helpful—especially for narrow, known bug classes. But for an agent designed to discover and validate vulnerabilities in context, starting from a SAST report creates three predictable failure modes.

First, it can encourage premature narrowing. A findings list is a map of where a tool already looked. If you treat it as the starting point, you can bias the system toward spending disproportionate effort in the same regions, using the same abstractions, and missing classes of issues that don’t fit the tool’s worldview.

Second, it can introduce implicit judgments that are hard to unwind. Many SAST findings encode assumptions about sanitization, validation, or trust boundaries. If those assumptions are wrong—or just incomplete—feeding them into the reasoning loop can shift the agent from “investigate” to “confirm or dismiss,” which is not what we want the agent to do.

Third, it can make it harder to evaluate the reasoning system. If the pipeline starts with SAST output, it becomes difficult to separate what the agent discovered through its own analysis from what it inherited from another tool. That separation is important if you want to measure the system’s capabilities accurately, which is needed for the system to improve over time.

So we built Codex Security to begin where security research begins: from the code and the system’s intent, with validation used to raise the confidence bar before we interrupt a human.

## SAST tools are still very important

SAST tools can be excellent at what they’re designed for: enforcing secure coding standards, catching straightforward source-to-sink issues, and detecting known patterns at scale with predictable tradeoffs. They can be a strong part of defense-in-depth.

This post is narrower: it’s about why an agent designed to reason about behavior and validate findings should not start its work anchored to a static findings list.

It’s also worth calling out a related limitation of pure source-to-sink thinking: not every vulnerability is a dataflow problem. Many real failures are state and invariant problems—workflow bypasses, authorization gaps, and “the system is in the wrong state” bugs. For these types of bugs, a tainted value does not reach a single “dangerous sink.” The risk is in what the program assumes will always be true. 

## Looking ahead

We expect the security tooling ecosystem to keep improving: static analysis, fuzzing, runtime guards, and agentic workflows will all have roles.

What we want Codex Security to be good at is the part that costs the most for security teams: turning “this looks suspicious” into “this is real, here’s how it fails, and here’s a fix that matches system intent.” 

If you want to learn more about how Codex Security scans repositories, validates findings, and proposes fixes, see [our documentation⁠](https://developers.openai.com/codex/security/)

[(opens in a new window)](https://developers.openai.com/codex/security/)

.  
