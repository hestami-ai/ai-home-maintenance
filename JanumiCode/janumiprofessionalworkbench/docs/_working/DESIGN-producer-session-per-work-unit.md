# DESIGN — the producer's session lives as long as the work unit

**Status:** design, pre-roadmap.

**SPONSOR (2026-09-06):** *"In JanumiCode v2, the way [we] addressed that gap is that the CLI session wasn't
closed or released until the phase or sub-phase completed. Here the phase or sub-phase would or could be
nearest thought of as a PWU. This approach allowed the assurance policies feedback to be fed back to the
implementing agent before that phase or sub-phase was determined complete."*

---

## 1. The gap this closes

`JAN-EXECLOOP` shipped with the loop's state on the producer's side — as the sponsor's model and the paper's
pipeline both require — but delivered it as a **prompt splice**: each try opens a fresh ephemeral session
(`SessionManager.inMemory()`), and the findings are appended to a re-rendered template.

⚠ I named that gap and did not fix it: *"the producer can't reason about how it has responded across several
policies over several tries."* The sponsor's answer is the mechanism v2 already uses — **one session, held open
for the whole unit of work**.

## 2. ⭑ It is a small change, because the session already accumulates

Pi's `AgentSession` (`dist/core/agent-session.d.ts`) exposes:

- `prompt(text, options): Promise<void>` — callable repeatedly
- `get messages(): AgentMessage[]` — *"All messages including custom types"*
- *"Session persistence is handled internally (saves messages on message_end)"*
- `dispose(): void`

⭑ So holding one session and prompting twice **is** the feature. What changes is who owns the session's
lifetime: today `piExecute` creates and disposes one per call; it must instead be created when the work unit
starts executing and disposed when the unit is done being worked on.

⚠ **The v2 mechanism was verified in shape, not in full.** `mimoClient` is explicitly built around
`POST /session` once and many `POST /session/{id}/message` — the same create-once-send-many model the sponsor
describes. I could **not** locate the component that bounds that session to a phase, and I am not asserting one
exists in a particular place; the sponsor's account of the intent is the authority here, and the mechanism it
needs is present.

## 3. What the findings become

⛔ **A follow-up TURN, not an appended prompt.** Today try 2 receives a re-rendered template with a findings
block spliced onto it — so the model is asked to produce the work again, as though for the first time, by
something that reads like a new instruction.

⭑ With a held session it receives what it actually is: *the reviewer said this about what you just produced;
address it.* The model's own history carries what it produced and why, which is precisely the *"chat history,
context window, context engineering"* the sponsor named as the responsible component.

## 4. ⚠⚠ The consequence that must not be missed: E-1 changes meaning

`PER-9` E-1 is *"the exact bytes presented to the model."* With a fresh session per try, the rendered prompt was
very nearly that. **With a held session it is not**: try 2's real input is system prompt + try 1's exchange +
the findings turn.

⭑ The codebase already solved this once and says why, at `pi-agent.ts:157`:

> *"THIS IS THE ONLY POINT WHERE THE COMPOSITE EXISTS. Everything JPWB hands Pi … is an INPUT TO the
> composition; Pi assembles resources, tool schemas **and history** on top. Capturing earlier would record a
> template, and `PER-9` is explicit that a template identifies the record and 'never substitutes for it'."*

So `createMaterializedInputRecorder()` — already exported and general — must be installed on the execution
session too. ⛔ **Without it, this change silently degrades the record**: E-1 would name a turn while the model
saw a conversation, and nothing would report the difference.

## 5. What stays exactly as it is

- ⛔ **The reviewer stays COLD.** `JPWB_REVIEW_SEES_PRIOR` remains off by default. This change puts *more* state
  on the producer, which is the side the sponsor's model and the paper's pipeline both put it on — it does not
  weaken the argument for a stateless judge, it strengthens it.
- ⛔ **`thinkingLevel: 'off'` stays.** History is not chain-of-thought: it is the producer's own record of its
  turns, which is exactly what §9.7 says an account should rest on.
- ⭑ **The bound stays 3**, and the trend classifier is unchanged — a held session changes what a retry *is*, not
  when to stop.
- **One exchange record per try**, still. `PER-9` wants each try recorded; a shared session does not merge them.

## 6. ⚠ What this does NOT give us

The sponsor described the agent *"tracking or remembering how it responded to the various feedback from the
various assurance policies … in whatever holistic way it might do so."*

⭑ A held session gives that **within one work unit**. It gives nothing **across** work units, and nothing across
a restart — `SessionManager.inMemory()` is process-local, and the record plane is durable while that is not
(the disclosure `REG-F-342` already makes about the content plane). Whether a producer should carry memory
across PWUs is a larger question and is **not** taken here.
