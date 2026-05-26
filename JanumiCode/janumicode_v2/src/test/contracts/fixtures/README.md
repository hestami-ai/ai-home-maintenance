# Synthetic Fixtures

Hand-written artifact contents that satisfy their boundary's contract. Express *what good looks like*, not what the LLM happens to produce.

Naming: `<boundary-id>.ideal.json` (canonical happy path), `<boundary-id>.<scenario>.json` (edge cases). Example: `phase4-component-model.ideal.json`.

Forward tests in `../<boundary>.forward.test.ts` consume these fixtures.
