# ExecutionOS — Current Roadmap

## Current State

**v0.6.2 (Polish Details) is shipped and live in production.**

- It shipped Nov 15, 2026, see `docs/changelog.md`.
- Technical design is in `docs/architecture.md`, and behavior in `docs/product.md`.

## v0.7 — Profile & Friends (in progress)

Goal: people keep each other consistent by seeing each other's consistency. Not a
social network: no posts, no messages, no feed. **v0.8 — Mobile Version** comes next.

While a version is in progress, its plans live in this file. At ship, each one moves
to the doc that owns it.

### Vocabulary

- **Follow:** one-way. There is no "friend" concept; two follows are a mutual follow.
- **Public account:** anyone can follow. **Private account:** a follow is a request that the owner accepts.
- **Block:** the blocked user cannot find or follow you, and any follow between you ends.

### Rules

- Only accepted followers see the profile data and the live state. Everyone else sees the card only.
- Blocked, private-locked and nonexistent users answer the same way (enumeration-safe).
- The database stores facts (follows with a status, blocks). Counts, streaks, state and "mutual" are derived.
- Live state: the client stays the authority of the session and only sends what it has. The server never gates the timer.
- Last activity is derived from saved sessions. Search is by username only.
- Avatars are generated from the initial. No uploads, no bio.

### Screen

- The header user icon opens the Profile, own profile by default. One screen, no scroll.
- Left: profile card. Center: streak, 6-month heatmap, four stats of the last 30 days. Right: search, requests above the list, people you follow (ring or avatar, username, streak).
- Clicking someone in the list opens their profile.
- **Settings:** the gear on your own card replaces the center and the right with one card: a column of options and the content of the selected one. They leave the header user menu.
  - Options in order: username, password, privacy, blocked users (with unblock), language, send feedback (a form in the panel), logout (confirm modal).
  - Username: once every 30 days, and the next date is shown. Password: current, new and confirm; it invalidates other sessions with `token_version`.
  - Privacy: switching to private keeps current followers.
- Everyone sees you working. There is no setting to hide the live state. The mission of someone working shows on hover of their row. A setting to hide missions, as in rooms, comes later.

### Open

- Review the Spanish and English copy.
- The Landing and Auth screens get updated for this version later.

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
  Changing the password while signed in is part of v0.7.
- **Room "working now" instead of average time on the summary card:** wait for real
  user feedback.
- **Ask AI to analyze the UI** and **ask AI what changes it would make to the
  product:** parked indefinitely.
