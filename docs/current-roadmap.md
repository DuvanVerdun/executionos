# ExecutionOS — Current Roadmap

## Current State

**v0.7 (Profile & Friends) is shipped and live in production.**

- It shipped Nov 19, 2026, see `docs/changelog.md`.
- Technical design is in `docs/architecture.md`, and behavior in `docs/product.md`.

## Next

**v0.8 — Mobile Version** is next.

While a version is in progress, its plans live in this file. At ship, each one moves
to the doc that owns it.

### Left over from v0.7

- **Landing and Auth** do not mention profiles or friends yet.
- **Hide your mission** from the people who follow you, as in rooms.
- **Spanish and English copy** of the Profile and Settings is not reviewed.
- **Streaks of other people** use your time zone, so they can differ from theirs.
- **The list of people you follow** reads all their sessions. Make it lighter when it grows.
- **Register** checks the password rules only on the page, not on the server.

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
