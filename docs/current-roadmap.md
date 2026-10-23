# ExecutionOS — Current Roadmap

## Current State

**v0.5 is shipped and live in production.**

- v0.5 is complete. No v0.5 work remains.
- Shipped Oct 7, 2026, see docs/changelog.md.

## Next: v0.6 — Co-DeepWork Rooms

Goal: give users a shared challenge link where small groups do deep work
together and come back on their own. Rooms are a layer on top of personal
execution, not a replacement for it.

Success test: 5 users, each returning on at least 3 days.

Why now: rooms are the social opportunity to acquire users, and building them
first gives more leverage when users arrive. Getting users comes after v0.6.

While v0.6 is in progress, plans for anything not shipped yet (design, architecture, and everything else) live in this file. At ship, each one moves to the doc that owns it.

### In scope (single v0.6 release)

- **Focus Rooms** nav item in the Plan and Dashboard headers. See "Entry point."
- **Rooms screen:** create, join, and open rooms. See "Rooms screen."
- **Room screen:** summary cards, mission card, ranking, room history. See "Room screen."
- **Focus, Review, and check-ins** adapted for rooms. See "Starting a session in a room" and "Check-ins."
- **Ranking:** by total focused time, real sessions only. Positions are never shared: ties are broken by who joined the room earlier (see "Room screen"). No badges or other scores in v0.6. This is a deliberate tension with Principle 10 in `docs/product-design-principles.md`: watch for people gaming totals.
- **Room menu, ownership, and deletion.** See "Room menu" and "Ownership."
- **Sessions:** saved to each user's personal history. See "Personal sessions and rooms."

### Room flow

This section describes how the room screens work, in plain words. Anyone
building v0.6 should read this section first, then "Technical plan" below. Each
rule is marked **Decided**.

**Vocabulary (v0.6 words only):**
- **Room:** a shared space where a small group runs sessions together.
- **Owner:** the user who created the room, or the member who took ownership
  when the previous owner left (see "Ownership").
- **Member:** a user who has joined the room and has not left it.
- **Former member:** a user who has left the room. Their sessions stay in the
  room history.
- **Interaction:** a Pause, a Stop, or a successful **Still here**. Starting a
  session, **Resume**, **Continue**, and **Finish** are *not* interactions. The
  reason is explained in "Why only Pause, Stop, and Still here count" below.
- **Still here:** the check-in button.
- **Successful check-in:** the user clicked **Still here** within 5 minutes of
  the moment the check-in became due.
- **Unsuccessful check-in:** no click within 5 minutes.

**Entry point (Decided).** The Plan and Dashboard headers have a new nav item,
**Focus Rooms**, next to Dashboard and New Mission. Clicking it opens the Rooms
screen, whose title reads **Rooms**. The Rooms screen is the only room screen
with a header. Its header has
links to Plan (New Mission) and Dashboard, the streak, and the user menu (Send
Feedback, Logout). The
Room screen, the room Focus screen, and the room Review screen have no header.
So a user cannot log out or send feedback from inside a room.

**Rooms screen (Decided).** The title **Rooms**, with two buttons on the same
row: **Create** (white, primary) and **Join** (outlined, secondary). Below them,
a grid of room cards. There is no member limit in v0.6.

- **Create button:** opens a floating form, centered over the Rooms screen, with
  everything else darker. The form has one input, the room name, and a
  **Create room** button. After creating the room, the form shows the link with a
  prominent **Copy link** button, and the room appears as a card.
- **Join button:** opens a floating form, the same as the Create form, with one
  input where you paste a link and a **Join room** button. Joining a room you
  already belong to just opens that room.
- **Room card:** shows the room name, the number of members (for example,
  "4 members"), your total time ever in that room, and a live count such as "2 working now." "Working"
  means a member has a running session that is not paused.
- **Room card menu (⋮):** the same three-dot icon as the session cards in the
  dashboard. It opens the room menu (see "Room menu").
- **Clicking a room card** opens the Room screen.
- **Empty state:** only the title and the buttons are shown, with a centered
  message inviting the user to create a room with friends or coworkers, or to
  join one and work together, and a **Create room** button under it.

**Room menu (⋮) (Decided).** The same menu appears on each room card and on the
Room screen. The Room screen has it in its top bar. Exact placement is decided
in design. Options, by role:

| Option | Who sees it | What it does |
|---|---|---|
| Show my missions in this room | Everyone | Toggle, on by default. Only affects this room. |
| Copy link | Owner only | Copies the room link so the owner can send it to people. |
| Refresh link | Owner only | Creates a new link and invalidates the old one. |
| Delete room | Owner only | Deletes the room, with confirmation. |
| Leave room | Everyone | Leaves the room, with confirmation. |

For now, every confirmation in the room flow uses the browser's `confirm()`.
Custom confirmation popups come later, in their own commit, together with the
confirmations that already exist in the app (such as Logout and Delete session).

**Session card menu (⋮) (Decided).** Session cards keep their own ⋮, exactly as
in the dashboard. The only option is **Delete session**. Users can delete only
their own sessions. The mission input card has no menu.

**Joining with a link (Decided).** A link can be pasted into the Join form,
clicked in a chat or post, or pasted into the browser address bar. If the user
is logged in, they join right away and land on the Room screen. If the user is
logged out, they first go to the Login or Register screen. After login or
registration, they go straight to that room, not to the Plan screen. If the
user is already a member, the link just opens the room.

**Room unavailable (Decided).** If the room was deleted, the link is invalid or
was refreshed, or the user is not a member, the Room screen shows one generic
message ("This room isn't available") and a **Back to rooms** button. It never
says which of those happened.

**Room screen (Decided).** No header. The top bar has a back arrow on the left,
the room name, and the room menu (⋮). The back arrow returns to the Rooms
screen. It does not make the user leave the room. From top to bottom, the
screen has exactly four blocks:

1. **Four summary cards:** total time, total sessions, people in the room, and
   average session time across everyone. The average card has a CTA, shown as
   underlined text (working text: "Can you beat it?"). Clicking it fills the
   target time of the mission card with the current average plus at least one
   minute. The exact increment is decided at the end of v0.6: one minute, ten
   minutes, or rounding up to the next multiple of 10.
2. **Mission card:** the same look as the Plan screen card. A mission input, a
   target time input, and a **Start Work** button.
3. **Ranking:** titled `Ranking — Members of this room (4)`. It is numbered and
   ordered by total time, most first. Positions are never shared. When two
   members have the same total time, the one who joined the room earlier goes
   first. When the room has no session time yet, members are ordered by when they
   joined, so the user who created the room is always first. Each row
   shows the position, the username, the current state, total time, and number
   of sessions. The user's own row is highlighted and labeled "You". Former members
   do not appear here. The owner is labeled "Owner" in this list only.
4. **Room history:** the sessions of all members, grouped by day like the
   dashboard history. Each day has a card with its date pill and a Daily Summary
   (sessions, focused time, completion), followed by that day's sessions. Each
   session shows the mission, target time, actual time, completion, and the ⋮ menu
   with Delete session, with one addition: the owner's username. If that user hid their missions in this room, the card
   shows "Mission hidden," and the target and actual time still show. Sessions of
   former members stay here, with "(not a member anymore)" next to their name.

**Member states (Decided).** Each member in the ranking has a small ring that
shows their state:
- **Working:** a teal ring that fills as the session progresses
  (`--color-reward`).
- **Paused:** a white ring with a pause mark in the center.
- **Not working:** a gray ring with no fill.

**Starting a session in a room (Decided).** The user fills the mission card and
clicks **Start Work**. Starting a room session requires a connection. The Focus
screen opens. It is identical to a personal
session, with one difference: the room name appears above the ring (bigger than
a caption, smaller than the title of the Room screen). The screen shows the mission, the target time, the timer, and two buttons:

- **Pause:** the button text changes to **Resume**. Nothing else changes.
  Clicking **Resume** continues the timer from where it stopped.
- **Stop:** goes to the Review screen. From there, **Continue** returns to the
  Focus screen with the same session, the same as in the personal flow. **Finish**
  saves the session, ends it, and returns to the Room screen.

Other members see pauses, stops, and finishes at the next sync (see "Live updates").

**Review screen in a room (Decided).** From top to bottom, only three things:
1. The room name, centered, in the same style as the room name at the top of the
   Room screen.
2. The four summary cards of the room. They include the user's current session
   (the one being reviewed), even though it is not saved yet.
3. The review card, exactly the same card as in the normal review screen
   (mission, target, completion ring, focused time, Continue, and Finish).

Nothing else appears on this screen: no ranking, no room history, and no
comparison line.

**Being in a room during a session (Decided).** The user is never on a room
screen with the menu during a running session. So the user cannot leave a room
while their own session is running. The server also rejects leaving while the
user's own session is running in that room. Leaving a room is possible while
other members are working.

**Check-ins (Decided).** Check-ins happen at fixed points of actual time: 3600,
7200, 10800 seconds, and so on. A check-in is due whenever actual time reaches a
multiple of 3600 seconds. Pauses do not move the check-in mark, because paused
time is not counted.

When a check-in is due:
- A popup appears on the Focus screen, with a notification sound and the text
  "Are you still there?" It has one button: **Still here**. (The label is kept
  for now and can be polished later, with the app in production.)
- The popup is floating and centered over the Focus screen. It looks and behaves
  the same whether the tab is visible or in the background, and the sound plays
  in both cases, so a user in another tab comes back to it.
- The popup shows how much time is left to respond (for example, 4:52).
- The timer keeps running while the popup is open.
- The user has 5 minutes to click **Still here**.

*Successful check-in:* the user clicks **Still here** within 5 minutes. The
session continues, and this moment becomes the last successful check-in.

*Unsuccessful check-in:* no click within 5 minutes. The session is saved with an
end point, decided by this rule:
- Look at all of these moments since the session started: the **last successful
  check-in**, the **last Pause click**, and the **last Stop click**.
- The end point is the **latest** of them.
- If none of them exist (no successful check-in, no Pause, no Stop), the session
  is **not saved at all**.

Examples:
- The user works, pauses at 10 minutes of actual time, resumes 10 minutes later,
  and works until 50 minutes. The 1-hour check-in appears and is missed. The
  session is saved at **10 minutes**, because the last Pause is the last
  interaction. The 40 minutes after the Resume are not counted. This is intended
  (see below).
- The 1-hour check-in succeeds. The user pauses at 1h 20m, nobody returns, and
  the 2-hour check-in is missed. The session is saved at **1h 20m**, the last
  Pause.
- The 1-hour check-in succeeds, there are no Pause or Stop clicks after it, and
  the 2-hour check-in is missed. The session is saved at the actual time of that
  check-in (about **1h**), the last successful check-in.
- The user starts, never pauses or stops, and never clicks the popup. The
  1-hour check-in is missed. The session is **not saved**.

**Why only Pause, Stop, and Still here count (Decided).** If Resume or Continue
counted, a user could start, pause at minute 1, wait 58 minutes, resume at
minute 59, and then miss the check-in. The session would then count the paused
time as work. Counting only clicks that stop the clock (Pause, Stop) and clicks
that prove presence (Still here) keeps paused time out of the saved session.

**Accepted trade-off (Decided).** Work done after a Resume or Continue is lost if
the next check-in is missed. This is intentional, and it is the price of never
counting paused time as work.

**Message after a session ends on its own (Decided).** When the user comes back
to the app after a session ended without them, a floating message tells them what
happened, in the same style as the "Session saved. Nice work." message. There is
one message for each outcome:
- Missed check-in, saved to the server.
- Missed check-in, not saved, because there was no interaction.
- Paused or stopped and never came back, saved.
- Closed tab, closed browser, or lost connection, saved.
- Closed tab, closed browser, or lost connection, not saved, because there was
  no interaction.

The designs are in the Figma file. Room sessions are held by the server, so
"saved on this browser and waiting to sync" does not exist in v0.6. Its design
stays in Figma, unused.

**Stop or pause, then no return (Decided).** If a user pauses or stops and never
comes back, the session is saved one hour after that click, with the actual time
at the moment of the click. The clock for this is a timestamp.

**Closed tab, closed browser, lost connection, or computer turned off
(Decided).** If no update arrives for 180 seconds (see "Live updates"), the user
shows as gone. The session is then saved with the same end point rule as an
unsuccessful check-in:
- If there was a successful check-in, a Pause, or a Stop, the session is saved at
  the latest of them.
- If there was none (for example, the user started a session and closed the
  tab), the session is **not saved**.

**Leaving a room (Decided).** The user can leave from the room menu, on the Room
screen or on the Rooms card. A confirmation step appears. After leaving:
- The user no longer appears in the ranking or in the live member states.
- Their sessions stay in the room history, with "(not a member anymore)" next
  to their name. These sessions still count in the room totals.
- Their sessions stay in their personal history.
- They can join again only with a valid link.
- Leaving does not affect other members' sessions. A member can leave while
  someone else is working.

**Ownership (Decided).** The room has one owner at a time. When the owner leaves
and other members are still in the room, ownership passes to the member who
joined earliest among them.

- **Flow example:** Creator Ana creates a room and invites Pablo. Pablo joins.
  Then Jorge joins. Ana leaves. Pablo was the first member to join after Ana, so
  Pablo becomes the owner. Jorge stays a regular member.
- **If the last member leaves, the room is deleted.** This includes the case
  where the owner leaves and nobody else is in the room. The room and its room
  history are removed. Each member's personal sessions stay in their own
  history.

**Deleting a room (Decided).** Only the owner can delete a room, with a
confirmation step. Deleting the room removes it, and its room history goes with
it. Each member's personal sessions stay in their own history. A room cannot be
deleted while any member has a running session in it.

**Refreshing a link (Decided).** The old link stops working right away. People
already in the room stay in the room. People who are not members and try the old
link cannot join.

**Personal sessions and rooms (Decided).** A user can start a personal session
from the Plan screen at any time, including while they are in one or more rooms.
It does not appear in any room history. Only sessions started inside a room count
for that room. All sessions, room or personal, count toward the user's streak and
dashboard.

**Deleting sessions (Decided).** Each user can delete their own sessions,
including from the room history. Deleting a session lowers the room totals,
because totals come from the sessions that still exist.

### Live updates

- Displayed times tick every second on the client.
- While in a room session, the client sends a heartbeat (no state) to the server
  every 15 seconds. State changes (pause, resume, stop, continue, still here,
  finish) are sent as events at the moment of the click. The Rooms and Room
  screens read states every 15 seconds. So a change can take up to 15 seconds to
  appear.
- Personal sessions do not post state (yet; they probably will in v0.7).
- Technical design: see "Technical plan" below.

### Technical plan

Decided during v0.6 technical planning (Oct 2026). Everything here is
**decided**, except the open items in section 14. At ship, each part moves to the
doc that owns it (section 17).

#### 0. Read this first: authority, scope, and protocol

- **This plan is a specification, not permission.** Nothing in it authorizes a
  change. A change needs an explicit request from the owner, in chat, for a
  specific mission or step.
- **Always ask, never assume.** If something is not written here, is ambiguous,
  or conflicts with the code, the docs, or the owner's words: stop, say what you
  found, and ask. Do not pick a default. Do not fill in details. This covers
  copy, colors, sizes, names, limits, behavior, and the order of operations.
- **Protocol for every change, inside an approved mission:**
  1. Say what you will change, in which files, and why.
  2. Check that it is inside the current mission's scope (section 13) and
     `AGENTS.md`.
  3. If it is not clearly in scope, ask first.
  4. Wait for an explicit yes.
  5. Make the smallest coherent change. Mention unrelated issues instead of
     fixing them.
  6. Verify, and report what was and was not verified.
- The protocol also applies when the plan names an exact edit. The plan says
  what. The owner says when.
- **Scope of v0.6.** Only what this roadmap lists. The app has **no automated
  tests**, and v0.6 does not add any. Verification is manual, done by the owner,
  and the agent writes step-by-step instructions. Automated tests, folder and code
  reorganization, restoring the last screen on reload, redesigns of other screens,
  and any refactor that v0.6 does not need are **out of scope**. Each gets its own
  commit after v0.6 ships to production (see "After v0.6").
- **Out of scope does not mean "never touch".** If the best way to build v0.6
  involves something outside its scope (a refactor, a shared helper, an existing
  bug, a style token, a new dependency), **stop and ask**. Explain what it is and
  why it matters to v0.6, give the options with pros and cons, give your
  recommendation, and wait. Do not silently avoid it when avoiding it makes v0.6
  worse. Do not silently do it either.
- **Never, without explicit approval for that specific action:** commit, push,
  merge, rewrite history, apply a migration, run a script that writes to the
  database, start a server that talks to the production database, add a
  dependency, change `style.css`, or call Figma.
- If this plan conflicts with `AGENTS.md`, `AGENTS.md` wins. Tell the owner.
- Only the owner approves changes to this plan. Record them in section 16.

#### 1. Status and vocabulary

- **Running session** (technical name: *active room session*): the server-side
  record of a room session in progress. Personal sessions have none.
- **Heartbeat:** a message every 15 seconds meaning "I'm alive". It carries no
  state.
- **Event:** a message sent at the moment of a click that changes state: start,
  pause (also Stop), resume (also Continue), still here, finish.
- **Overdue:** the heartbeat is more than 180 seconds old, or the session has been
  paused or stopped for more than 1 hour, or a check-in deadline has passed.
- **Finalize:** the server turning an overdue running session into a saved
  `Session`, or discarding it.
- **Claim:** deleting the running row to win the right to finalize it.
- **Notice:** a one-time record telling a returning user how a session ended
  without them.
- **Envelope:** the standard response shape of the room-session endpoints.

#### 2. Overview

v0.6 adds shared rooms to the personal loop. The server learns about a running
session **only for room sessions**. Personal sessions stay client-side, and their
behavior does not change.

Three ideas run through everything:
1. **Store facts, derive conclusions.** Totals, ranking, owner, member state, and
   overdue status are never stored.
2. **Lazy finalization.** There is no background worker. Whichever request next
   reads the relevant scope closes the overdue sessions, and closing is
   idempotent.
3. **The server row is the authority** for a running room session. The client
   displays it and sends events. Starting a room session requires a connection.

#### 3. Constants

The four time-rule constants are one block at the top of `room_session_rules.py`
(the pure-rules module, so both services can import them). `ROOM_NAME_MAX_LENGTH`,
`LINK_TOKEN_BYTES`, and `HISTORY_PAGE_SIZE` live at the top of `room_service.py`.
One block on the client, in the `CONFIGURATION` section of `app.js`. No magic numbers
elsewhere.

| Name | Value | Where |
|---|---|---|
| `HEARTBEAT_TIMEOUT_SECONDS` | 180. Overdue when the last heartbeat is **strictly more than** 180 seconds old. | backend |
| `PAUSED_TIMEOUT_SECONDS` | 3600 | backend |
| `CHECKIN_INTERVAL_SECONDS` | 3600 | backend |
| `CHECKIN_RESPONSE_SECONDS` | 300 | backend |
| `ROOM_NAME_MAX_LENGTH` | 50 | backend |
| `LINK_TOKEN_BYTES` | 16 | backend |
| `HISTORY_PAGE_SIZE` | 20 (query `limit(21)`, like `get_paginated_sessions`) | backend |
| `HEARTBEAT_INTERVAL_MS` | 15000 | client |
| `ROOM_POLL_INTERVAL_MS` | 15000 | client |

#### 4. Data model

All new datetime columns hold **UTC**. They are written with `datetime.now(UTC)`
and read through `_as_utc_aware` (from `dashboard_service.py`), because SQLite
returns naive values. Models live in `backend/models.py`, in the existing style:
`Mapped[...]`, `mapped_column`, explicit `__init__`, `__repr__`. Tables are plural
snake_case, and models are singular. Foreign key columns use `index=True` where
the existing code does.

**`rooms`** (`Room`)
- `id`, primary key.
- `name` `String(50)`, not null, not unique.
- `link_token` `String(64)`, not null, **unique**.
- `created_at`, not null.
- There is no owner column. The owner is derived (section 5).

**`room_memberships`** (`RoomMembership`)
- `id`, primary key.
- `room_id` FK to `rooms.id`, not null.
- `user_id` FK to `users.id`, not null, indexed.
- `joined_at`, not null.
- `left_at`, nullable. Empty means an active member.
- `show_missions` bool, not null, default true.
- **Unique `(room_id, user_id)`**, named `uq_room_memberships_room_user`. One row
  per person per room, forever.

**`sessions`** (existing, changed)
- Add `room_id` FK to `rooms.id`, nullable. Empty means a personal session.
- Add composite index `ix_sessions_room_id_date` on `(room_id, date)`.
- The `Session.__init__` signature does **not** change. Set `room_id` by attribute
  assignment, like `submission_id` today.
- The `save-session` endpoint never reads or sets `room_id`.
- **Only server finalization (section 6) may create a session with a `room_id`.**

**`active_room_sessions`** (`ActiveRoomSession`, migration 2)
- `id`, primary key.
- `user_id` FK, not null, **unique**. At most one running session per user.
- `room_id` FK, not null, indexed.
- `submission_id` `String(36)`, not null. A server-generated UUID. It is the
  idempotency key when the row becomes a `Session`.
- `mission` `String(200)`, `target_time_seconds` int.
- `started_at`, not null.
- `paused_at`, nullable. Empty means running.
- `paused_seconds` **Float**, not null, default 0. It mirrors the client's
  `pausedTimeSeconds`, which is a JavaScript float.
- `last_checkin_mark` int, not null, default 0.
- `last_interaction_at`, nullable, and `last_interaction_actual_seconds` int,
  nullable. Both are set together, or both are empty (no interaction yet).
- `last_heartbeat_at`, not null. Set at Start.

**`session_end_notices`** (`SessionEndNotice`, migration 2)
- `id`, primary key. `user_id` FK, **unique**.
- `reason` `String(32)`: `missed_checkin`, `paused_timeout`, or `disconnected`.
- `saved` bool.
- `actual_time_seconds` int, nullable. The saved duration. Empty when not saved.
  The messages show it.
- `created_at`.

#### 5. Derivation rules

Write these as **pure functions** that take plain values and return plain values.
All times are UTC.

- **Actual time (seconds):** `T = now` if running, otherwise `paused_at`. Then
  `actual = max(0, floor((T - started_at) - paused_seconds))`. This matches the
  client's formula.
- **Check-in** (only while running):
  - `next_mark = last_checkin_mark + 1`.
  - `due_at = started_at + paused_seconds + next_mark * 3600`. It is
    *outstanding* when `now >= due_at`.
  - `deadline_at = due_at + 300`. The 5 minutes count from the moment the
    check-in became due (actual time 3600, 7200, 10800, and so on), not from when
    a popup is displayed, because the server cannot observe the display. A user
    who returns to a hidden tab sees the modal already open, with a countdown to
    `deadline_at`, so it can start below 5:00.
- **Overdue.** The candidates are:
  - `disconnected` at `last_heartbeat_at + 180s`.
  - `paused_timeout` at `paused_at + 3600s`, only if paused.
  - `missed_checkin` at `deadline_at`, only if running.

  The row is overdue if any candidate is earlier than `now`. The **reason is the
  earliest** such candidate. Ties go in this order: `disconnected`,
  `missed_checkin`, `paused_timeout`.
- **End point of an overdue row:** it is saved only if `last_interaction_at` is
  not empty. The actual time is `last_interaction_actual_seconds`, and `date` is
  `last_interaction_at`. Otherwise nothing is saved.
- **Interactions** update `last_interaction_*` with `now` and the floored actual
  time at that moment. They are a **pause** (including Stop) and a successful
  **Still here**. Start, Resume, Continue, and Finish are never interactions. After
  a Still here, the end point is the actual time at the click, for example 1h 02m
  if it was clicked 2 minutes after the check-in became due.
- **Member state:** no row means `not_working`. A running row means `working`. A
  paused row means `paused`. The Review screen counts as paused.
- **Ring percentage:** `min(100, floor(actual / target * 100))`, and **only when
  working**. Otherwise null. Never expose another member's raw target or actual
  time.
- **Owner:** the active member with the smallest `(joined_at, membership id)`.
- **Ranking order:** total room time descending, then `joined_at` ascending, then
  membership `id` ascending.
- **Summary:**
  - `total_time_seconds` is the sum of `actual_time_seconds` over sessions with
    that `room_id` (including former members).
  - `total_sessions` is their count.
  - `members_count` is the number of active memberships.
  - `average_session_time_seconds` is `round(total / count)`, or null when there
    are no sessions. This matches the dashboard.
  - With `include_my_running_session`, if the requester has a running row **in
    this room**, add its actual time, add 1 to the count, and recompute the
    average. A row in another room has no effect.

#### 6. Finalization (lazy)

`finalize_overdue_for_users(user_ids)` and `finalize_overdue_for_rooms(room_ids)`:

1. Load the candidate rows. This is cheap, because only currently running
   sessions exist.
2. Evaluate each one in Python (section 5).
3. For each overdue row, in **one transaction**:
   - **Claim** the row with `DELETE ... RETURNING`, falling back to `rowcount`. If
     nothing was claimed, another request already finalized it, so skip.
   - If it is saved, insert the `Session` with `room_id` and the row's
     `submission_id`. The existing unique `(user_id, submission_id)` is the second
     guard. An `IntegrityError` is treated as "already saved".
   - Delete any existing notice for that user, then insert the new notice (with
     the saved duration).
   - Commit.

**Finish uses the same claim.** If Finish finds no row but a `Session` exists
with that `(user_id, submission_id)`, it returns success **and silently deletes
any pending notice**. The user is present, so they must not be told the session
"ended on its own".

**Call sites.** Each runs finalize for its scope before its own work:

| Request | Scope |
|---|---|
| Room snapshot, summary, history | that room |
| Rooms list | all the user's rooms |
| Every `room-session` endpoint | the user |
| Leave, Delete room | that room, before its guard |
| Existing `dashboard`, `streak`, `get-sessions` | the user. One call is added to each, explicitly in scope. |

**Failure behavior:** on read paths, log with `app.logger.exception` and continue.
An overdue session is **never** displayed as working, even if the save failed. On
the user's own event paths, return the generic 500.

#### 7. API

**Conventions** (they match the existing code):
- Prefix `/api/`. `@jwt_required()`, and `user_id = int(get_jwt_identity())`.
- **Request body keys are camelCase. Query parameters are snake_case. Response
  keys are snake_case.**
- Response timestamps are **naive UTC ISO 8601 with milliseconds and no `Z`**
  (`isoformat(timespec="milliseconds")`). The client appends `Z`, as it does for
  `session.date` today.
- Success is `{"success": true, ...}`. Failure is
  `{"success": false, "error": "<generic text>"}`.
- Error handling copies `save_session`: validation errors give 400. An unexpected
  error does `db.session.rollback()`, `app.logger.exception(...)`, and a generic
  500. **Never return `str(e)`.**
- Status codes: 200, 201 (create), 400, 403 (an active member who is not the
  owner, on an owner action), **404 (the generic "unavailable": unknown room,
  non-member, bad or refreshed link, deleted room)**, 409.
- Responses are **built from explicit whitelists**, never from model objects.
  `link_token` appears only in owner responses.
- **Strict input:** integers reject booleans, like the existing time checks.
  `showMissions` is a strict boolean. `linkToken` is a string of 1 to 64
  characters from `[A-Za-z0-9_-]`. `timezone` is required on history.
- **Query budget:** aggregate with `GROUP BY`. Never loop issuing queries per room
  or per member.

**Rooms**
- `GET /rooms`: one card per room the user is an active member of, ordered by
  membership `joined_at` then `id`. Fields: `id`, `name`, `members_count`,
  `my_total_time_seconds`, `working_now_count`, `is_owner`, `show_missions`.
  Mission 4 omits `working_now_count`, and mission 6 adds it.
- `POST /rooms` with `{name}`: trimmed, non-empty, at most 50. In one transaction,
  create the room, generate `secrets.token_urlsafe(16)` (retry on a unique
  collision), and add the creator's membership. Returns 201 with the card and
  `link_token`.
- `POST /rooms/join` with `{linkToken}`: a malformed token (not a string, bad
  characters, or too long) gives 400, and an unknown token gives 404.
  - No membership: create one.
  - A former member: set `left_at = null` and `joined_at = now`, only if `left_at`
    was set. `show_missions` is kept.
  - An active member: no-op.
  - An `IntegrityError` is re-read and treated as success.
  - Returns the card and `already_member`.
- `GET /rooms/<id>`: the snapshot. It returns `room` (`id`, `name`, `is_owner`,
  `show_missions`), `summary`, and `ranking`. Each ranking item has `position`,
  `username`, `is_you`, `is_owner`, `state`, `ring_percentage`,
  `total_time_seconds`, and `sessions_count`. It never includes user ids.
- `GET /rooms/<id>/summary?include_my_running_session=true|false`: the summary
  only. The default is false, and an invalid value gives 400.
- `GET /rooms/<id>/sessions?timezone=&cursor_date=&cursor_id=`: room history, 20
  per page. The cursor and `daily_summaries` shape match `get_paginated_sessions`,
  including the rule that both cursor values appear together or neither does.
  Summaries cover the **whole room's** sessions on the days represented. Each item
  has `id`, `date`, `mission` (null when hidden), `mission_hidden`,
  `target_time_seconds`, `actual_time_seconds`, `percentage_completed`,
  `completion_status`, `username`, `is_mine`, and `is_former_member`. A mission is
  hidden when the requester is **not the session's owner** and that member's
  `show_missions` is false. Former members' flags still apply.
- `POST /rooms/<id>/leave`: sets `left_at = now`. If no active members remain, run
  the deletion procedure. 409 if the user's own running session is in this room.
  Returns `room_deleted`.
- `DELETE /rooms/<id>`: owner only. 409 if **any** row (running or paused) exists
  in the room, after finalizing.
- `GET /rooms/<id>/link` (owner): returns `link_token`.
- `POST /rooms/<id>/link/refresh` (owner): replaces the token. The old one is
  invalid immediately.
- `PATCH /rooms/<id>/membership` with `{showMissions: bool}`: the **desired value,
  never a flip**.

**Response shapes** (implemented; keys are snake_case):
- `GET /rooms`: `{success, rooms}`. Each card also has `working_now_count`.
- `POST /rooms`: `{success, room}` (201, with `link_token`). `POST /rooms/join`:
  `{success, room, already_member}`.
- `POST /rooms/<id>/leave`: `{success, room_deleted}`. `DELETE /rooms/<id>`:
  `{success}`.
- Link endpoints: `{success, link_token}`. `PATCH .../membership`:
  `{success, show_missions}`.
- `GET /rooms/<id>`: `{success, room, summary, ranking}`. `.../summary`:
  `{success, summary}`. `.../sessions`: `{success, sessions, daily_summaries,
  next_cursor}`.
- A 409 on leave or delete is `{success: false, error}`.

**Room deletion procedure** (shared by the owner's delete and last-member-leaves),
in one transaction:
1. `UPDATE sessions SET room_id = NULL WHERE room_id = :id`.
2. `DELETE FROM room_memberships WHERE room_id = :id`.
3. `DELETE FROM rooms WHERE id = :id`.

Do not rely on `ON DELETE SET NULL`. Turso enforces foreign keys (verified Oct 2026),
so the order above matters.

**Authorization helpers.** Every room route uses
`get_active_membership(room_id, user_id)` (none gives 404) and
`is_owner(room_id, user_id)` (false for a member gives 403).

**Room session** (one per user)
- Every endpoint returns the same **envelope**:
  `{success, server_time, active, session, notice}`.
  - `session`: `submission_id`, `room_id`, `room_name`, `mission`,
    `target_time_seconds`, `started_at`, `paused_at`, `paused_seconds`,
    `actual_time_seconds`, `state` (`running` or `paused`), and `checkin`
    (`mark`, `due_at`, `deadline_at`, `outstanding`). `mark` is the number of the
    next check-in (1 for the 1-hour one). While paused, `due_at` and `deadline_at`
    are null and `outstanding` is false.
  - `notice`: `{reason, saved, actual_time_seconds}` or null. It is **read and
    deleted in the same request**.
  - A 409 is the envelope with `success: false` and an `error` key.
- Every endpoint first finalizes the user's row if it is overdue, then applies its
  rule, then refreshes `last_heartbeat_at`. When the user's row is missing, the
  response is 200 with `active: false` and any pending notice.
- `GET /room-session`: the current state.
- `POST /room-session` with `{roomId, mission, targetTimeSeconds}`: the user must
  be an active member (else 404). Mission and target use the same validation as
  `save_session`. If a row already exists, return **409 with the envelope**.
  Success returns 201.
- `POST /room-session/pause`: valid only from running. **Rejected with 409 while a
  check-in is outstanding.** It sets `paused_at` and records the interaction. A
  repeat is a no-op.
- `POST /room-session/resume`: valid only from paused. It adds `now - paused_at`
  to `paused_seconds` and clears `paused_at`. A repeat is a no-op.
- `POST /room-session/checkin`: valid only while running with a check-in
  outstanding and `now <= deadline_at`. It increments `last_checkin_mark` and
  records the interaction. Otherwise it is a no-op, or `active: false` if the row
  was finalized.
- `POST /room-session/heartbeat`: refreshes `last_heartbeat_at` and carries no
  state.
- `POST /room-session/finish` with `{submissionId}`: the id must be a valid UUID.
  A mismatch with the row's `submission_id`, or a running row, gives **409 with
  the envelope**. Valid only when paused. It claims the row, saves the `Session`
  with `date = now` and the derived actual time, and returns
  `{saved: true, session_id}`. A repeat follows the idempotent path in section 6.
  When there is nothing to save (the session already ended on its own without a
  save), it returns 200 with `saved: false`.

#### 8. Client behavior

**Sync**
- **Rooms screen:** poll `GET /rooms` every 15 seconds. **Room screen:** poll
  `GET /rooms/<id>` every 15 seconds.
- Read polls skip ticks while `document.hidden`, fetch immediately on becoming
  visible, never overlap, and ignore stale responses (a generation counter, as
  `dashboardState.loadGeneration` does).
- Room history is re-fetched when `total_sessions` changes, and after the user's
  own Finish or delete.
- **Focus and Review in a room:** `POST /room-session/heartbeat` every 15
  seconds, never skipped. If one is in flight, skip the next tick. A hidden tab
  may fire about once a minute, which the 180-second rule tolerates.
- **Review screen:** read
  `GET /rooms/<id>/summary?include_my_running_session=true` **once** on entering.
- Use the existing `apiFetch`. Every room call passes `currentScreen`, so a failed
  token refresh sends the user to Login through `navigateTo`. Use a timeout
  pattern like `postSession`'s.

**Events and feedback**
- The client **waits for the response** before updating the screen. No optimistic
  updates.
- **One in-flight lock:** while any room-session event is waiting for its
  response, all Focus and Review controls are disabled, not only the clicked one.
  This keeps events in order.
- While an event is in flight, the control shows an in-flight label. When the
  response arrives, render from the returned state. On failure, restore the
  previous label, enable the controls, and show an inline error.
- Approved working text (once implemented, `app.js` is the copy truth). Pause shows
  "Pausing..." and then becomes Resume. Start Work shows "Starting...". Resume
  shows "Resuming...". Stop shows "Stopping..." and then Review opens. Continue
  shows "Continuing...". Still here shows "Confirming...". Create room shows
  "Creating...". Join room shows "Joining...". Finish keeps its existing
  "Saving...", "Retrying...", and "Try again". Use the single ellipsis character
  the app already uses.
- Labels for leave, delete, refresh link, and the toggle, and all inline error
  texts, are confirmed with the owner at the moment they are developed.

**Floating messages after a session ends on its own**
- The notice's `reason` and `saved` pick one of five Figma messages. The saved
  duration comes from `actual_time_seconds`, formatted like the Figma designs.

| reason | saved | Figma message |
|---|---|---|
| `missed_checkin` | true | Check-in missed, saved |
| `missed_checkin` | false | Check-in missed, not saved |
| `paused_timeout` | true | Left paused, saved |
| `disconnected` | true | App closed, saved |
| `disconnected` | false | App closed, not saved |

- The Figma design "Check-in missed, saved on browser" is **not used** in v0.6.
- The copy lives in Figma. Take it from there when implementing, and ask if it is
  not available. Text color shows the outcome: gray for saved with a caveat, red
  for nothing saved. Use existing tokens from `style.css`, and ask if none fits.
- They use the same pattern as "Session saved. Nice work." (held, then fading).
  **That container exists only on the Dashboard today**
  (`dashboard-save-message` and `setDashboardSaveMessage`). The messages, and the
  same "Session saved. Nice work." after Finish on the Room screen, get a home on
  Plan, Rooms, and Room (decided). How to build it (generalize the Dashboard
  function or add parallel elements) and where it sits on the Room screen, which
  has no header, are open (section 14).

**Check-in**
- The check-in becomes due at `checkin.due_at` (actual time 3600, 7200, 10800, and
  so on). At that moment the app opens the modal popup and plays the notification
  sound, **even if the tab is hidden**. When the user opens the tab, the popup is
  already there, showing the time left until `deadline_at` (5 minutes after it
  became due). At zero, make one `GET /room-session` call.
- Browsers can delay ordinary timers in hidden tabs, so how to play the sound
  exactly on time is open (section 11 item 5, section 14 item 3).
- The popup is modal, so Pause and Stop are not clickable behind it. The server
  also rejects them.
- Use `server_time` to compute a clock offset for countdowns.
- Browsers may block audio that was not started by a user action. The popup still
  shows. This is a known limitation.

**App load sequence** (replaces today's order only for room features)
1. Authenticate with the refresh cookie (existing). If it fails, go to Register as
   today, and keep any `#join=TOKEN` in the URL.
2. If `#join=TOKEN` is present, call `POST /rooms/join`. On a 404, show the
   designed unavailable state of the Room screen. On a network failure, show the
   loading error screen. The fragment stays in the URL, so Retry tries again.
   Remove the fragment with `history.replaceState` after the attempt succeeds or
   gets a 404.
3. Call `GET /room-session`. If `active`, go to **Focus** with the server's state
   (paused or running). Whatever the result, show the floating message if there is
   a notice, on the screen where this sequence ends. **If this call fails, show the
   existing loading error screen with Retry** (the owner accepted that this blocks
   personal users too).
4. Otherwise, if a personal session is saved in `localStorage`, restore it as
   today.
5. Otherwise, if a join succeeded, go to that Room screen.
6. Otherwise, go to Plan (existing, including loading the streak).

**When a response says `active: false` while the user is on Focus or Review:**
stop the timers and the heartbeat, clear the room-session state, show the notice
message, and go to the Room screen of that room, like Finish.

**Screen transitions to add** (the key is the new screen, and the list is the
allowed current screens). Check them against the Figma flows, and ask if anything
is unclear:
- `rooms`: from `plan`, `dashboard`, `room`.
- `room`: from `rooms`, `review` (Finish), `loading` (join link), `login`,
  `register` (join after authenticating).
- `focus`: add `room` (Start Work).
- `plan`: add `rooms`.
- `dashboard`: add `rooms`.
- `login`: add `rooms`, `room`.

**Room mode.** The Focus and Review screens are reused. Add a room-name element to
Focus and a summary-cards container to Review, both shown only for room sessions.
Room-session state lives in its own object, **separate** from the personal
`activeSessionState`.

**Join form and links**
- The link is `<origin>/#join=<token>`, built by the client from
  `window.location.origin`.
- The Join form accepts a full link or a bare token. It extracts only the token and
  never navigates to or fetches a pasted URL. Errors are generic.
- Copying uses `navigator.clipboard.writeText`.

**Text safety.** All user text (room names, usernames, missions) is inserted with
`textContent` only. Never `innerHTML` for these.

**UI work rules** (`AGENTS.md`): read `frontend/style.css` fully before any UI
work. Do not invent colors, sizes, radii, or copy. Call Figma only when the owner
asks.

#### 9. Security

- **Link token:** `secrets.token_urlsafe(16)`, stored plain (the owner needs Copy
  link), unique. Refreshing replaces it.
- **Generic 404** for every "not available" case.
- **Whitelisted responses.** `link_token` goes only to the owner. Hidden missions
  are masked server-side. A running session's mission is never sent to others. No
  emails.
- **Authorization** goes through the helpers in section 7, on every room route.
- **Validation** is as listed in section 7. **No new rate limits and no room
  caps** in v0.6.
- **Joining:** the fragment keeps the token out of server logs. The client extracts
  only the token and strips the fragment after the join attempt.

#### 10. Migration, database safeguards, deploy

**The production database is shared.** The local backend and the production
backend use the **same** Turso database. Everything local code writes lands in
production data.

- **Who runs what.** Migrations, scripts that write to the database, and any
  destructive SQL are run **by the owner only**, in the VS Code terminal in WSL
  Ubuntu, in the `backend` folder, after `source venv/bin/activate`, following
  steps the agent writes. The agent does not run them. The agent asks before
  starting any server that talks to the database. The `venv` folder also contains
  Windows leftovers (`Scripts`, `Lib`, `Include`). Use only the WSL activation.
- **Running locally** (per `main.py`, the `BACKEND_URL` block in `app.js`, and the
  CORS list; confirm with the owner if anything differs): the backend runs with
  `python main.py` in `backend`, with the venv active, at `https://localhost:5000`
  using the local certificates. The frontend runs with Live Server at
  `http://localhost:5500`. Ask the owner to start them.
- **Backups.** The agent never makes backups. Before each migration, before the
  mission 11 testing, before the launch merge, and before any ad-hoc SQL or script
  that changes data in bulk, the agent tells the owner to download a copy of the
  current Turso database and waits for confirmation that it is done. Only then does
  the owner make the migration or change.
- **Migrations:** migration 1 (mission 4) and migration 2 (mission 6). Use
  `batch_alter_table` for `sessions`, as the last migration did. Review each
  generated file by hand before applying.
- **While the old code is live on the shared database:**
  - Changes to **existing** tables must be additive and nullable.
  - Never edit an applied migration. Add a new one.
  - **Never run a downgrade against the production database.**
- After each migration, **smoke-test the production site**: log in, finish a
  session, open the dashboard, delete a session.
- **Test accounts** are `tester1`, `tester2`, and so on. They are kept
  permanently, with no cleanup, and used for manual development tests. Use
  non-trivial passwords. The success-test query excludes `tester%` accounts.
- **Launch order:** backup, migrations already applied, merge to `main` (Render and
  Netlify deploy automatically), verify, then create the first room.
- **Rollback:** use Render's Rollback to return to the old code. The new tables
  stay unused. If data is damaged, restore from the backup. Turso's 1-day
  point-in-time restore is the last resort.

#### 11. Verify early

Cheap checks, to run before relying on the assumption. The owner runs them, and
the agent writes the steps.
1. Does `DELETE ... RETURNING` or `rowcount` work through the libsql driver?
   Yes, `RETURNING` works (the mission 6 smoke test: Finish claimed the row).
2. Does Turso enforce foreign keys? **Yes** (a bad `room_id` insert was rejected).
3. Does `batch_alter_table` add a column to `sessions` on libsql? **Yes**
   (migration 1 ran).
4. Is audio blocked after a reload?
5. Does a hidden tab really stretch heartbeats to about a minute?
6. Does the CORS preflight for `PATCH` pass from the Netlify and
   `localhost:5500` origins?

#### 12. Verification scenarios

Manual, run by the owner with 2 or 3 accounts (`tester1`, `tester2`, ...). The
agent writes step-by-step instructions.

| Scenario | Expected |
|---|---|
| Start, never pause, close the tab, 181 seconds pass, someone polls | Not saved. Notice `disconnected`, `saved: false`. |
| Pause at 10 min, resume, work, miss the 1h check-in | Saved at 10 min. Reason `missed_checkin`. |
| 1h check-in answered at 1h02m, no more interactions, then closed | Saved at 1h02m. Reason `disconnected`. |
| Pause at 1h20m, tab left open, 1 hour passes | Saved at 1h20m. Reason `paused_timeout`. |
| Pause, then close the tab | Saved at the pause. Reason `disconnected`. |
| Two workers finalize the same row at once | One session, no duplicate. |
| Double click on Pause, Resume, Finish, or Join | One effect. |
| Pause while the check-in popup is outstanding | Rejected (409). |
| Start while a session already runs (second tab) | 409, and the client goes to the running session. |
| Delete a room while someone is working, or leave while the own session runs | 409. |
| Non-member requests a room, or an old refreshed link | The same generic 404. |
| A session whose user hid their missions, viewed by another member, by the room owner (not the session's owner), and by the session's own user | Hidden, hidden, and visible. |
| Review cards with `include_my_running_session` true | Room totals plus the paused session. |
| Deleting a room | Members' sessions remain in their personal history. |
| Finish right after another member's poll finalized the same session | One session, success, and no notice shown. |
| A returning user whose session ended while away | The matching floating message, with the saved duration. |

#### 13. Missions and their scope

Work only on the current mission's items and files. Anything else needs approval
(section 0).

- **Mission 4 (rooms backend).** Migration 1, the models `Room` and
  `RoomMembership`, `Session.room_id`, the helpers, and room CRUD (section 7,
  without `working_now_count`). Files: `backend/models.py`, `backend/main.py`, new
  `backend/room_service.py`, the new migration.
- **Mission 5 (sessions and aggregates).** The summary, ranking, and history
  endpoints. State is `not_working` for everyone until mission 6. Done when the
  numbers match a manual count.
- **Mission 6 (presence and check-in).** Migration 2, `ActiveRoomSession`,
  `SessionEndNotice`, new `backend/room_session_rules.py` and
  `backend/room_session_service.py`, the room-session
  endpoints, finalize and its call sites (including one call in each of
  `dashboard`, `streak`, and `get-sessions`), the leave and delete guards,
  `working_now_count`, live ranking states, and `include_my_running_session`. Done
  when the section 12 scenarios pass.
- **Missions 7 to 10 (frontend: Rooms screen, Room screen, room session flow,
  states and polish).** Per section 8. Files: `frontend/app.js`,
  `frontend/index.html`, `frontend/style.css`. The notification sound is deferred
  to these missions. The owner will provide or generate it. Do not pick or
  download one.
- **Missions 11 to 14 (test with 2 or 3 accounts, prepare the launch, deploy, run
  the 3-day challenge).** Plus the backup reminders and excluding tester accounts
  from the success-test query.

#### 14. Open items: ask the owner

1. **How to build the floating message home** on Plan, Rooms, and Room:
   generalize `setDashboardSaveMessage` or add parallel elements, and where it
   sits on the Room screen, which has no header. Present the options with pros and
   cons.
2. **Where the user lands when the app is opened after a session ended without
   them** (a fresh load). With the tab open, they land on the Room screen. After a
   fresh load the sequence ends on Plan today, and landing on the Room screen would
   need `room_id` on the notice. Ask.
3. **How to play the check-in sound exactly on time in a hidden tab** (ordinary
   timers can be delayed). Present the options with pros and cons.
4. **The "Can you beat it?" CTA:** the increment (decided at the end of v0.6) and
   what the CTA does when the average is empty.
5. **The notification sound file** (deferred, see section 13).
6. **Inline error texts, and the in-flight labels not listed in section 8.**
7. **Rooms and Room screen states and copy** come from Figma. Ask for
   screenshots. Do not call Figma without being asked.

#### 15. Out of scope for v0.6

Automated tests, folder and code reorganization, restoring the last screen on
reload (screens keep today's reload behavior), multi-tab synchronization (tabs
already open can start a second session, and a personal and a room session can
overlap; accepted), rate limiting, room caps, WebSockets, push notifications,
automatic migrations, custom confirmation popups, and redesigns of other
screens. Each follows the rule in section 0: if v0.6 really needs one of them,
ask first.

#### 16. Decision record

- **Finalization:** lazy, as one idempotent function; claim by deleting the row.
- **Data model:** the same `sessions` table with a nullable `room_id`; the owner is
  derived; membership rows with `left_at`; one row per user per room, with
  `joined_at` reset on rejoin and `show_missions` kept.
- **Sync:** polling every 15 seconds; heartbeat, snapshot, and events as separate
  calls; the heartbeat carries no state; tolerance 180 seconds.
- **Running session:** a "last interaction" snapshot; the server clock; the server
  row is authoritative; the check-in popup is modal; Review counts as paused;
  restore shows the server's state as it is; a new tab goes to the running
  session; Finish returns to the Room screen; the already-open tab gap is
  accepted; the double-click rules; notices with the saved duration; room delete
  and leave guards.
- **Trust:** server-derived time for room sessions. The Review summary has
  `include_my_running_session`.
- **Security:** a random plain link token; a generic 404; central helpers;
  whitelisted responses; no limits or caps. Room names are at most 50 characters.
  A user sees their own hidden missions. The live ring is a percentage only.
- **Links:** a fragment link; the token stays in the address bar until the join
  completes; the load priority order; the client builds the link; the Join form
  extracts only the token. Restoring the last screen on reload is out of v0.6.
- **Deploy:** the shared database accepted; migrations run by the owner in WSL;
  additive migrations first; a smoke test after each; backups are the owner's, with
  reminders from the agent; no automated tests in v0.6.
- **Implementation choices:** the end point after a check-in is the actual time at
  the click; `Session.date` is the Finish time for Finish and the last interaction
  time for server-closed sessions; Pause and Stop are one server transition, as are
  Resume and Continue; room cards are ordered by membership `joined_at`; read polls
  skip hidden tabs; room history re-fetches when `total_sessions` changes; two
  migrations (missions 4 and 6); the client awaits each response with one in-flight
  lock; new modules `room_service.py` and `room_session_service.py` with routes in
  `main.py`; best-effort finalize on reads; every room-session call refreshes the
  heartbeat; Focus and Review are reused in a room mode; a countdown-end call; the
  helpers from `dashboard_service.py` are imported as they are.
- **Owner additions:** in-flight feedback on every click; tester accounts kept; the
  loading error screen when `GET /room-session` fails at load; the sound deferred;
  floating messages get a home on Plan, Rooms, and Room; an ended session found
  with the tab open lands on the Room screen, like Finish.

- **Missions 4 to 6 (backend):** three modules, `room_service.py`,
  `room_session_rules.py` (constants and pure rules) and `room_session_service.py`,
  imported one way (`room_session_service` → `room_service` → `room_session_rules`);
  finalize calls live in the routes in `main.py`, except inside the room-session
  operations; service functions are named `*_for_user`, so routes keep clean names;
  four small exception classes and one `room_error_response` helper map errors to
  generic responses; the claim uses `DELETE ... RETURNING` only, with no `rowcount`
  fallback; the one-transaction guarantee of claim, save, and notice on Turso stays
  unverified; link tokens are checked for uniqueness before use instead of retried
  on collision; `active_room_sessions.mission` and `target_time_seconds` are not
  null; the room daily summaries duplicate the dashboard logic with a room filter
  (to revisit with the tests after v0.6); the owner skipped the time-based
  scenarios of section 12 for mission 6, so only the happy path was smoke-tested.

#### 17. At ship: where each part moves

Data model, derivation rules, finalization, API, security, and migration move to
`docs/architecture.md`. The vocabulary moves to `docs/product.md`, but only what
has shipped. Copy lives in the code and Figma. Then reset this file for the next
version.

### Out of scope (v0.7+)

- Friends system and profile screens.
- Push notifications.
- Redeem rewards.
- Badges and progressive consistency.
- Members inviting other people or sharing room links (needs a permission system).

## Optional, own commit

- Streak animation on finishing first session of the day.

## After v0.6

Priority: Users → Observation → Feedback → Iteration.

- Run the v0.6 success test and observe real room behavior.
- Review the folder structure and code organization after v0.6.
- Automated tests, in their own commit after v0.6 ships to production. The app
  has none today. Start with the highest value behavior (streak and dashboard
  calculations, session saving, and the pure room-session functions).
- Restore the last screen on reload for every screen, in its own commit. Today a
  reload lands on Plan, or on Focus when a session is saved.
- Revisit tabs that were already open when a session starts (they can start a
  second session) if it turns out to be a UX problem.
- During the structure review, give the helpers that `room_service.py` imports
  from `dashboard_service.py` public names.
