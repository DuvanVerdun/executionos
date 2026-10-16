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
building v0.6 should read this section first. Each rule is marked **Decided**.

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
  the popup.
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
clicks **Start Work**. The Focus screen opens. It is identical to a personal
session, with one difference: the room name appears above the ring (bigger than
a caption, smaller than the title of the Room screen). The screen shows the mission, the target time, the timer, and two buttons:

- **Pause:** the button text changes to **Resume**. Nothing else changes.
  Clicking **Resume** continues the timer from where it stopped.
- **Stop:** goes to the Review screen. From there, **Continue** returns to the
  Focus screen with the same session, the same as in the personal flow. **Finish**
  saves the session and ends it.

Other members see pauses, stops, and finishes at the next sync (see "Live updates").

**Review screen in a room (Decided).** From top to bottom, only three things:
1. The room name, centered, in the same style as the room name at the top of the
   Room screen.
2. The four summary cards of the room.
3. The review card, exactly the same card as in the normal review screen
   (mission, target, completion ring, focused time, Continue, and Finish).

Nothing else appears on this screen: no ranking, no room history, and no
comparison line.

**Being in a room during a session (Decided).** The user is never on a room
screen with the menu during a running session. So the user cannot leave a room
while their own session is running. Leaving a room is possible while other
members are working.

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
  the 2-hour check-in is missed. The session is saved at **1h**, the last
  successful check-in.
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
- Missed check-in, saved on this browser and waiting to sync.
- Paused or stopped and never came back, saved.
- Closed tab, closed browser, or lost connection, saved.
- Closed tab, closed browser, or lost connection, not saved, because there was
  no interaction.

The designs are in the Figma file.

**Stop or pause, then no return (Decided).** If a user pauses or stops and never
comes back, the session is saved one hour after that click, with the actual time
at the moment of the click. The clock for this is a timestamp.

**Closed tab, closed browser, lost connection, or computer turned off
(Decided).** If no update arrives for 45 seconds (see "Live updates"), the user
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
it. Each member's personal sessions stay in their own history.

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
- Each user's session state is sent to the server every 15 seconds. The room
  screen gets the other members' states every 15 seconds. So a change can take up
  to 15 seconds to appear.
- Personal sessions do not post state (yet; they probably will in v0.7).
- Technical design (active session state, endpoints) is decided during v0.6
  technical planning.

### Out of scope (v0.7+)

- Friends system and profile screens.
- Push notifications.
- Redeem rewards.
- Badges and progressive consistency.
- Members inviting other people or sharing room links (needs a permission system).

## Optional, own commit

- Streak animation on finishing first session of the day.
- Start learning automated tests on the highest value behavior (streak and
  dashboard calculations, session saving).

## After v0.6

Priority: Users → Observation → Feedback → Iteration.

- Run the v0.6 success test and observe real room behavior.
- Review the folder structure and code organization after v0.6.
