# ExecutionOS — Agent Instructions

## Purpose

ExecutionOS is both a real product and deliberate Product Engineering training.

Core product loop:

Plan → Focus → Review → Dashboard → Repeat

Use AI as leverage while preserving my understanding, product judgment,
engineering judgment, debugging ability, and ownership.

I own product decisions and shipping decisions.

## Default Behavior

If I ask you to:

- explain
- review
- analyze
- investigate
- teach
- answer a question

do not modify files unless I explicitly ask.

If I ask you to:

- implement
- build
- fix
- refactor
- change

you may modify the relevant files.

If my intent is ambiguous, ask before editing.

## Before Editing

For meaningful changes:

1. Read `docs/current-roadmap.md`.
2. Inspect `git status` and the existing diff.
3. Preserve all unrelated uncommitted work.
4. Inspect the relevant existing code and established patterns.
5. Understand the requested behavior before implementing it.

Do not assume GitHub `main` represents the current local working tree.

If documentation conflicts with code, identify the discrepancy instead of
silently choosing one.

## Work Loop

Use:

Understand → Plan → Implement → Verify → Explain

Make the smallest coherent change that solves the requested problem.

Do not replace reasoning with implementation.

## Scope Discipline

Do not:

- Refactor unrelated code.
- Add dependencies without a concrete need.
- Introduce abstractions for hypothetical future problems.
- Change established architecture casually.
- Mix unrelated functional, refactoring, and polish work.
- Implement product decisions I have not made.

If you notice an unrelated issue, mention it instead of silently fixing it.

## Non-Negotiable Technical Patterns

Preserve established ExecutionOS patterns:

- Vanilla JavaScript, HTML, and CSS frontend.
- Flask backend using the app-factory architecture.
- SQLAlchemy 2.0 query style.
- Prefer `select()` + explicit execution/scalar result patterns.
- Do not introduce legacy `.query`.
- Strict Pylance typing with zero type errors as the baseline.
- Use `cast()` only at genuine data or weak typing boundaries.
- Keep application state separate from DOM state.
- Timer correctness is timestamp-based, not tick-based.
- The backend remains authoritative for persisted execution history.
- The database stores facts rather than duplicated derived conclusions.

Preserve the authentication architecture:

- Access token in JavaScript memory.
- Refresh token in an `httpOnly`, `Secure` cookie.
- `token_version` for refresh-session invalidation.
- Enumeration-safe authentication errors.
- Ownership enforcement for user resources.

Do not redesign authentication unless explicitly requested.

## Verification

Never treat plausible-looking code as proof that something works.

After implementation:

- Run the most relevant available checks.
- Check type errors when relevant.
- Test the affected behavior in the actual application when possible.
- Report what was verified.
- Report what was not verified.

Do not claim untested behavior works.

## Git Safety

Do not commit, push, reset, discard changes, rewrite history, or overwrite
unrelated work unless I explicitly ask.

Before modifying a dirty working tree, understand which changes already existed.

## Documentation Map

Use repository documentation as persistent context.

- `docs/product.md`
  Product purpose, user problem, product boundaries, and core behavior.

- `docs/architecture.md`
  Stable technical architecture and established implementation patterns.

- `docs/engineering-standards.md`
  Engineering quality, judgment, debugging, learning, and AI-native workflow.

- `docs/product-design-principles.md`
  Product-design and UX decision principles.

- `docs/current-roadmap.md`
  Current product state, active sprint, scope, and temporary decisions.

- `docs/changelog.md`
  Version history of what each shipped version delivered.

Read only the documents relevant to the current task.

Local working context: if `docs/organization/` exists (gitignored), read its
`README.md` first. Never commit it or reference it from committed docs.

## Documentation Rules

- Most docs change at version ship, not during work. Do not update `architecture.md`, `product.md`, `README.md`, or `changelog.md` until then.
- During a version, only `docs/current-roadmap.md` and the private workboard change often.
- `docs/current-roadmap.md` holds everything about the version in progress, including its vocabulary.
- `docs/product.md` holds only what is already in production: purpose, boundaries, and existing vocabulary. Never put unbuilt features there.
- `README.md` is usually stale on purpose. It is updated at version ship. Don't use it as a source of truth.
- Keep each fact in one place. Before adding a fact, check whether it already exists.

When a version ships, the product docs catch up. `product.md`, `architecture.md`, `README.md`, and `changelog.md` are updated, `current-roadmap.md` is reset for the next version, and the shipped idea is removed from `docs/organization/ideas.md`. Plans written in the roadmap during the version move to the file that owns them: architecture plans to `architecture.md`, design plans to the Figma file and `style.css`, product rules to `product.md`.

## Design and Figma

- Visual truth: `frontend/style.css`. Read it fully before any UI work. Don't copy its values into docs.
- Copy truth: `frontend/index.html` and the Figma file. Don't copy text into docs.
- Figma file: "ExecutionOS", key `B7vEWYtHv9pK4eK2V5ug6K`. Pages:
  - **Screens:** v0.5 live reference and current work.
  - **Foundations:** current tokens and components. Until it is rebuilt for v0.6, `style.css` wins.
  - **Archive:** old versions. Don't edit.
- Figma calls are scarce (Starter plan). Call Figma only when I ask. Don't read the file back to check your own work. Write a whole screen per call. Ask for a screenshot instead.
- The web app is desktop only. See `docs/product.md`.
- Don't invent colors, sizes, radii, or copy. Ask first.

## Communication

Be direct, concise, and technically precise.

When explaining meaningful changes, cover:

- What changed.
- Why.
- How it works.
- Important trade-offs.
- How it was verified.

When reviewing my reasoning, tell me when it is incomplete or incorrect.

Do not optimize for agreeing with me.

## Fundamental Rule

Use AI to compress the build → feedback → learn loop, not to remove me from it.