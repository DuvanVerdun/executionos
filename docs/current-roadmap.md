# ExecutionOS — Current Roadmap

## Current State

**v0.6.1 (Rebuild, Spanish & Landing) is shipped and live in production.**

- It shipped Nov 13, 2026, see `docs/changelog.md`.
- Technical design is in `docs/architecture.md`, and behavior in `docs/product.md`.

## Decision

Priority is v0.6.2: observed problems, improvements, and polishing details. 
Next will be v0.7: Profile and Friends.

## Current Work: v0.6.2 — Polish Details.

There is no fixed list. Details come from the owner while using the app. Each one
is a small change with its own commit.

1. **Spanish copy.** The owner reads it while using the app and reports better
 wording. The tone is "tú". Longer texts may need a layout check.
2. **Landing feedback.** Pending: the effects when sections come into view, the glow
 of the last card, and other window sizes.
3. **Generic invite card.** Showing the room's name needs an endpoint that answers
 without a sign-in.
4. **Static creator card on the Landing.** Showing the creator's real session is a
 later idea.
5. **Backend messages are not translated.**
6. **Polish ideas.** Lift on main buttons on hover, a shadow on the app header, a
 tab icon as a progress ring, and a streak animation on Finish (needs design).

### Deferred or parked

- **Forgot password with an email code.** Needs an email service and a domain. It
 also completes the fix so that Register does not reveal whether an account exists.
- **Room "working now" instead of average time on the summary card:** wait for real
 user feedback.
- **Ask AI to analyze the UI** and **ask AI what changes it would make to the
 product:** parked indefinitely.

## Next

After **v0.6.2 — Polish Details**, **v0.7 — Profile and Friends** is next,
 then **v0.8 — Mobile Version**. 

While a version is in progress, its plans live in this file. At ship, each one moves
to the doc that owns it.
