# ExecutionOS — Current Roadmap

## Current State

**v0.6.2 (Polish Details) is shipped and live in production.**

- It shipped Nov 15, 2026, see `docs/changelog.md`.
- Technical design is in `docs/architecture.md`, and behavior in `docs/product.md`.

## Next

**v0.7 — Profile & Friends** is next, then **v0.8 — Mobile Version**.

While a version is in progress, its plans live in this file. At ship, each one moves
to the doc that owns it.

### Left over from v0.6.2

- **Landing feedback.** The effects when sections come into view, the glow of the last
  card, and other window sizes.
- **Generic invite card.** Showing the room's name needs an endpoint that answers
  without a sign-in.
- **Static creator card on the Landing.** Showing the creator's real session is a later idea.
- **Backend messages are not translated.**
- **Lift on main buttons on hover.**

### Deferred or parked

- **Forgot password with an email code.** Needs an email service and a domain. It
  also completes the fix so that Register does not reveal whether an account exists.
- **Room "working now" instead of average time on the summary card:** wait for real
  user feedback.
- **Ask AI to analyze the UI** and **ask AI what changes it would make to the
  product:** parked indefinitely.
