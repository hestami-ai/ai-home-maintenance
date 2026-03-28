# Introducing lemmafit: A Verifier in the AI Loop

Fernanda Graciolli & Nada Amin

March 07, 2026  
TL;DR:

We’ve released [lemmafit](https://github.com/midspiral/lemmafit), an open source tool that forces AI to prove its code is correct before it compiles.

This version works with Claude Code. Install lemmafit, prompt as you normally do, and watch as Claude writes your logic *and* the mathematical proof.

The actual verifier is external to the AI and deterministic.

npm install \-g lemmafit

AI can write large volumes of pretty good code now. With proper setup, the code just works right out of the gate without much, or any, iteration.

But the conflation of “it works” with “it’s correct” is what leads to subtle and often costly bugs that show up in production.

Spec-driven development, scaffolding constraints, and disciplined testing help increase assurance, but the output remains a non-deterministic implementation of a natural language prompt — more similar to the output of a human than a machine.

With a verifier in the loop, the LLM’s role is no longer to generate *and* judge a final output. Instead, its role is to propose implementation candidates that are externally checked by a deterministic process.

## How It Works in Practice

From your perspective as a developer, a lemmafit session looks like this:

1\. Install and initialize. You run npm install \-g lemmafit, then lemmafit init in a new project. This scaffolds everything — a Dafny directory, a React app, Claude Code hooks and skills, and a SPEC.yaml file where your requirements will live.

2\. Start the daemon. npm run daemon launches the lemmafit daemon (which watches your Dafny files). From here on, verification is automatic — you never run a verify command manually.

3\. Describe what you want. Open Claude Code and prompt normally. “Build me a task manager where tasks can only move forward in the workflow — draft to active to done — and can never go backward.” Claude reads your prompt and begins working.

4\. Claude writes the spec. Claude creates entries in SPEC.yaml — structured requirements like “a task in ‘done’ status cannot transition to any other status” tagged as invariants, postconditions, or preconditions. Each entry is marked verifiable: true if it describes effect-free logic (vs. false for purely presentational requirements).

5\. Claude writes the implementation \+ proof. Claude writes Dafny code in Domain.dfy — a formal model of your state, your actions, and lemmas that prove your spec holds. Every time Claude saves the file, the daemon automatically runs dafny verify. If verification fails, Claude sees the errors instantly and fixes them. This loop — write, verify, fix — continues until the proof goes through.

6\. Claude hooks your logic into React with a generated API. Once verified, lemmafit compiles the Dafny to a TypeScript API: Init(), Dispatch(), Present(), Undo(), Redo(). Claude wires this into your React components. The verified logic is never manually reimplemented in JavaScript — your app calls the compiled Dafny directly.

7\. Review the guarantees. Run /guarantees in Claude Code to generate a human-readable report mapping each spec requirement to its corresponding proof. You can see exactly what’s been mathematically verified, what relies on assumptions, and what’s still unproven.

The whole thing feels like a normal Claude Code session with some extra steps that run automatically while your app is created. You prompt, Claude builds. The difference is that underneath, there’s a mathematical proof that the logic is correct against your spec for *all* possible inputs.

## Considerations: This Is a First Step

* Greenfield React \+ TypeScript only for now. Can’t yet retrofit into existing codebases (coming soon).  
* Optimized for Claude Code. The hook and skills system is Claude Code-specific; other agents need adaptation (coming soon).  
* The AI doesn’t always get the proofs right on the first try. The verification loop helps, but complex proofs still take iteration, and though it’s surprisingly persistent, sometimes Claude will punt on proofs it finds too difficult.  
* Not a replacement for testing. Verification covers *effect-free logic*. You still need integration tests, UI tests, QA, etc.  
* The proofs are only as good as the specs. You still need to review and iterate on your natural language spec. If your spec is ambiguous or conveys incorrect information, the verified code may be internally consistent while still not matching what you actually meant.

## The Bigger Picture

### Bundling a Methodology into a Dev Tool

This is our first attempt at bundling the verification methodology (currently spread across several repos) into a streamlined, easy-to-use dev tool. And packaging a complex engine into a simple workflow is not trivial.

The limitations are deliberate. We wanted to prove that the workflow works end-to-end in one constrained setting before expanding out further. The methodology itself already expands far beyond what is packaged. [Dafny-replay](https://github.com/metareflection/dafny-replay) alone includes capabilities around multi-user collaboration, reconciliation logic (including handling offline states), and database integration.

We have also explored:

* modeling existing codebases to find structural and intent bugs  
* agent-agnostic verification  
* gradual verification which mixes Dafny with existing code to progressively verify parts of large codebases

These will be gradually bundled and released with the same level of deliberation.

### High-Level Direction

Existing codebases. The most common reaction we get is “this is great, but I already have an app.” We’re building a mode where you point lemmafit at existing business logic, it models it in Dafny, and verifies properties against the code you already have. The Dafny model becomes a verified shadow of your production code.

Gradual verification. In addition to modeling an existing codebase, you can use lemmafit to integrate verified modular logic into existing code. This is useful for progressively increasing reliability in larger codebases that are not as easy to fully model or refactor.

Beyond effect-free logic. Right now, lemmafit verifies effect-free logic only with the Model, Action, Apply pattern. But there’s no reason to stop there. API contract verification, data pipeline invariants, access control policies. All logic should be verified.

More agents, more editors. The Claude Code hook and skill system is the tightest integration today, but the core — daemon, Dafny verification, compilation — is agent-agnostic. We’re working on integrations for other AI coding tools and CI/CD pipelines, so verification can happen at build time, not just dev time.

We think mainstream verified programming is inevitable. lemmafit is our first step toward making it practical.

## Try It

npm install \-g lemmafit  
lemmafit init my-app  
cd my-app  
npm run daemon

Then open Claude Code and start prompting.

Resources:

* [GitHub repo](https://github.com/midspiral/lemmafit) — open source version of lemmafit  
* [Dafny-replay](https://github.com/metareflection/dafny-replay) — the verification methodology lemmafit is built on  
* [claimcheck](https://github.com/metareflection/claimcheck) — a tool that helps verify the code against intent  
* [Dafny](https://dafny.org/) — the verification-aware language used in lemmafit  
* [Previous posts](https://midspiral.com/blog) — deeper dives into verified state, reconciliation, and claimcheck

If you build something with lemmafit, find a bug, or have ideas, we’d love to hear from you. Open an issue, submit a PR, or reach out directly.

