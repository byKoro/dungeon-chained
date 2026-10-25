# Tasks (local issue tracker)

Every non-trivial change gets a folder here. This is the "issue tracker" for skills like `to-spec`, `to-tickets`, `implement`, `code-review`.

```
.agents/tasks/<YYYY-MM-DD>-<slug>/
  plan.md           goal, context read, steps (each with files + how to verify)
  review.md         code-review findings and verdict
  verification.md   commands run + results; what could NOT be verified
  tickets/NN-*.md   optional, from to-tickets
```

Create with `npm run new-task -- <slug>` (writes the three files from templates).

Rules
- One folder per feature/fix. Keep it after merge: it is the history of why the code looks the way it does.
- When the work ships, set `Status: done` at the top of `plan.md` and move any durable knowledge into `.agents/context/` (and an ADR if structural). Tasks are history; context docs are the truth.
- Abandoned or deferred ideas go to `.agents/backlog/`.
