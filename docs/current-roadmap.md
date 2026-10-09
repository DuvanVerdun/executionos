# ExecutionOS — Current Roadmap

Last updated: October 9, 2026

## Current State

**v0.5 is shipped and live in production.**

- Deployed: October 7, 2026.
- GitHub `main` = tag `v0.5` = `fa3e918`.
- v0.5 is complete. No v0.5 work remains.

v0.5 delivered:

- Dashboard with Week / Month / Year / All Time periods, summary stats, trend
  chart, and paginated session history grouped by local day.
- Streak system and consistency calendar (Work / Rest / Neutral).
- Redesigned UI: soft header, semantic colors, redesigned Plan, Focus, Review,
  and auth screens, and loading / empty / error states.

### Navigation

- The header button switches screens: Plan → Dashboard, Dashboard → Plan.
- On the Dashboard, a floating "Back to stats" button appears at the bottom
  right once the "Sessions History" title scrolls off the top of the screen.
  It returns the user to the stats section.

## Versioning Rule

- A version is a meaningful product step (v0.5, v0.6, ...).
- Small detail implementations and small bug fixes get their own commit, not
  their own version.
- Hotfixes use short-lived branches merged into `main`.

## Next: v0.6 — Co-DeepWork Rooms

Goal: give Heroes a shared challenge link where small groups do deep work
together and come back on their own.

Success test: 5 people, each returning on at least 3 days.

Why now: rooms are the social opportunity to acquire users, and building them
first gives more leverage when users arrive. Getting users comes after v0.6.

Status: scope defined, technical planning pending. No v0.6 code yet.
Full scope: `v0.6-plan-and-scope.md` (Second Brain).

### In scope (single v0.6 release)

- **Auth required.** New users register, then land directly in the room.
- **Rooms list screen:** create, open, and delete rooms. Only the creator can
  delete their room. A joined room appears in the list while it exists.
- **Create room:** simple form, then a prominent "Copy link" button.
- **Join by link:** logged-in users join immediately. Logged-out users register
  first, then join.
- **Room screen:**
  - Summary cards: total time, total sessions, people in the room, average
    session time across everyone. A CTA encourages users to beat that average.
  - Live "currently working" list.
  - Ranking by total time (hours), with the viewer's position highlighted.
  - Start-session flow identical to the personal one.
- **Sessions:** saved to each user's personal history. Each user can delete
  their own sessions. Deleting a room never deletes sessions.
- **Leaving a room:** finishing a session in the room. Anyone removed from a
  deleted room loses no session data.
- **Visibility:** members see username, target time, and actual time.
- **Hourly check-in:** a popup each hour during a room session. The user has 5
  minutes to confirm. If they do not, the session ends at the last confirmed
  check-in.

### Live updates

- Displayed times tick every second on the client.
- Session state is posted and retrieved every 15 seconds. Others see a stop or
  pause at the next 15-second sync, not instantly.
- Only sessions inside a room post state. Personal sessions do not.
- Technical design (active-session state, endpoints) is decided during v0.6
  technical planning.

### Out of scope (v0.7+)

- Friends system and profile screens.
- Push notifications.
- Redeem rewards.
- Badges and progressive consistency.

Streak animation is not out of scope. It can ship as its own commit.

## After v0.6

Priority: Users → Observation → Feedback → Iteration.

- Run the v0.6 success test and observe real room behavior.
- Review the folder structure and code organization after v0.6.
- Start learning automated tests on the highest-value behavior (streak and
  dashboard calculations, session saving).
