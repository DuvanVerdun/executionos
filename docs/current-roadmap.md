# ExecutionOS — Current Roadmap

## Current State

**v0.5 is shipped and live in production.**

- v0.5 is complete. No v0.5 work remains.
- Shipped Oct 7, 2026, see docs/changelog.md.

## Next: v0.6 — Co-DeepWork Rooms

Goal: give users a shared challenge link where small groups do deep work
together and come back on their own.

Success test: 5 users, each returning on at least 3 days.

Why now: rooms are the social opportunity to acquire users, and building them
first gives more leverage when users arrive. Getting users comes after v0.6.

Status: scope defined, technical planning pending. No v0.6 code yet.

### In scope (single v0.6 release)

- **Rooms list screen:** create, open, and delete rooms. Only the creator can
  delete their room.
- **Create room:** simple form, then a prominent "Copy link" button.
- **Join by link:** logged in users join immediately. Logged out users register
  first, then join.
- **Room screen:**
  - Summary cards: total time, total sessions, people in the room, average
    session time across everyone. A CTA encourages users to beat that average.
  - Live time of sessions of other users in the room. Updates with server may
    happen each 15 seconds. If someone finishes a session, other users notice
    on their next server update (to be defined. If changes later, update this.)
  - Ranking by total time (hours), with the viewer's position highlighted.
  - Start session flow identical to the personal one, maybe review adapted to
  room screen.
- **Sessions:** saved to each user's personal history. Each user can delete
  their own sessions. Deleting a room never deletes sessions.
- **Leaving a room:** user intentionally should click to leave, and confirm.
  Sessions are saved both on the room, while it exist, and user's personal
  history.
- **Visibility:** members see username, target time, and actual time.
- **Hourly check in:** a popup each hour during a room session. "Are you
  still there?" The user has 5 minutes to confirm. If they do not, the
  session ends at the last confirmed check in. Evaluate making a click on
  pause or stop also behave as a check in, if on the next check in user
  doesn't show presence, the session ends on that last interaction.

### Live updates

- Displayed times tick every second on the client.
- Session state is posted and retrieved every 15 seconds. Others see a finish,
  stop or pause at the next 15-second sync, not instantly.
- Only sessions inside a room post state. Personal sessions do not (Yet,
  they probably will on v0.7).
- Technical design (active session state, endpoints) is decided during v0.6
  technical planning.

### Out of scope (v0.7+)

- Friends system and profile screens.
- Push notifications.
- Redeem rewards.
- Badges and progressive consistency.

## Optional, own commit

- Streak animation on finishing first session of the day.
- Start learning automated tests on the highest value behavior (streak and
  dashboard calculations, session saving).

## After v0.6

Priority: Users → Observation → Feedback → Iteration.

- Run the v0.6 success test and observe real room behavior.
- Review the folder structure and code organization after v0.6.
