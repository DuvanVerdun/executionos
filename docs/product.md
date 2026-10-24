# ExecutionOS — Product

## What ExecutionOS Is

ExecutionOS is a system for helping people execute consistently toward meaningful goals.

It turns intentional work into a visible feedback loop:

Plan → Focus → Review → Dashboard → Repeat

The product is not primarily a task manager, timer, analytics dashboard, or productivity tracker.

Those are components of a larger system whose purpose is to help someone repeatedly do the work they intended to do and see that execution clearly over time.

## The Problem

People often know what they want to work toward but struggle to execute consistently.

Common failure modes include:

- Planning without following through.
- Working without clear intention.
- Losing awareness of previous effort.
- Depending on motivation instead of feedback.
- Being unable to see whether consistency is actually improving.

Most productivity tools make it easy to record tasks or time.

ExecutionOS should make execution itself visible.

## Product Promise

ExecutionOS makes consistency visual and rewarding.

A user should be able to answer:

- What did I intend to do?
- Did I actually do it?
- How consistently have I been executing?
- Am I improving over time?
- What should I do next?

The system should make progress understandable without encouraging dishonest or meaningless metrics.

## Core Loop

### 1. Plan

Define the meaningful work to execute.

Planning should create enough clarity to begin without becoming an activity that replaces execution.

### 2. Focus

Execute the planned work with minimal distraction.

The timer supports execution, but elapsed time is not the product by itself.

### 3. Review

Record what actually happened.

The system should distinguish intention from reality instead of rewriting history to make performance look better.

### 4. Dashboard

Transform execution history into useful visual feedback.

The dashboard should make patterns, consistency, progress, and previous work easy to understand.

Raw statistics are useful only when they help the user interpret behavior.

### 5. Repeat

Use the feedback from previous execution to continue working intentionally.

Each cycle should make the next cycle clearer.

## Primary User

ExecutionOS is for someone who:

- Has meaningful goals or projects.
- Values focused work.
- Wants to become more consistent.
- Wants evidence of execution rather than motivational claims.
- Benefits from seeing progress accumulate over time.

The product should remain useful to a serious individual user before expanding toward broader use cases.

## User Outcome

ExecutionOS succeeds when the user becomes better at consistently executing meaningful work.

The desired outcome is not simply:

- More sessions.
- More tracked hours.
- Longer streaks.
- More dashboard activity.

Those metrics are useful only when they represent genuine execution.

The product should reinforce behavior rather than encourage gaming the measurement system.

## Product Principles

### Execution over planning

Planning exists to enable action.

Do not let preparation become a substitute for doing the work.

### Feedback over motivation

The system should provide evidence of behavior.

Users should not need artificial encouragement when clear progress can provide meaningful feedback.

### Visibility over raw data

Numbers alone are not enough.

Important patterns should be understandable visually and over time.

### Honest records over convenient records

Historical execution should represent what actually happened.

Features that make the product more convenient should not weaken the meaning of the data.

### Simplicity over feature accumulation

Every feature should justify how it strengthens the core loop.

Do not expand ExecutionOS into a general productivity suite without a clear reason.

### Behavior before polish

The underlying product behavior must work correctly before visual refinement becomes the priority.

Polish should improve comprehension, continuity, trust, or motivation rather than exist only as decoration.

## Product Boundaries

ExecutionOS is centered on personal execution. Every session belongs to the user's personal history, dashboard, and streak. Rooms are a layer on top of personal execution, not a replacement for it.

It is not trying to become:

- A general-purpose project management platform.
- A team collaboration suite. Rooms exist so small groups can do deep work together, not to manage a team's work.
- A calendar replacement.
- A complete task-management system.
- A general social network.
- A gamification system detached from real execution.

These boundaries may change if real user evidence creates a reason to change them.

## Platform

Desktop only. Design canvas: 1440×1024, for Figma prototypes. The built app is responsive, see `docs/architecture.md`.

## Glossary

- **Session:** one timed run on a mission.
- **Mission:** what you plan to work on.
- **Target time:** the time you set as your goal for the session.
- **Actual time:** time the timer really ran. Paused time never counts.
- **Room:** a shared space where a small group runs sessions together. People join with a link. There is no member limit.
- **Owner:** the user who created the room, or the member who took over when the previous owner left. Only the owner can copy or refresh the link and delete the room.
- **Member:** a user who has joined a room and has not left it.
- **Former member:** a user who left. Their sessions stay in the room history and totals, marked "(not a member anymore)".
- **Room session:** a session started inside a room. It is held by the server while it runs, and it is saved to the user's personal history and to the room.
- **Check-in:** once per hour of actual time, a popup asks "Are you still there?" The user has 5 minutes to click **Still here**.
- **Working, Paused, Not working:** the state each member shows in the ranking.

## Rooms

Rules a user can observe:

- A room has four summary cards (total time, sessions, people, average session time), a mission card, a ranking, and a history of everyone's sessions.
- The ranking is ordered by total focused time. Ties go to whoever joined earlier. Positions are never shared.
- A user can hide their missions in a room. Others then see "Mission hidden", with times still shown.
- When the owner leaves, ownership passes to the member who joined earliest. When the last member leaves, the room is deleted. Members keep their sessions in their personal history.
- A room cannot be deleted while anyone has a running or paused session in it. A user cannot leave a room while their own session runs there.
- When a session ends on its own, it is saved at the user's last Pause, Stop, or successful check-in. With none of those, it is not saved. This applies to a missed check-in, a closed tab, a lost connection, and a session left paused for an hour.
- Work done after a Resume is lost if the next check-in is missed. This is intentional: paused time is never counted as work.
- A user who returns after a session ended without them sees a message saying what happened.
- Personal sessions can be started at any time, even while in rooms. They never appear in a room.

## Product Decision Test

Before adding or changing something, ask:

1. What user problem does this solve?
2. What behavior should improve?
3. Which part of the core loop does it strengthen?
4. What evidence suggests the problem is real?
5. Does the solution introduce unnecessary complexity?
6. Could it weaken the integrity of execution data?
7. How will we know whether the change worked?

If those questions cannot be answered clearly, the feature probably needs more understanding before implementation.

## Success

ExecutionOS is successful when users can look at the product and clearly understand their execution history, feel the accumulated effect of consistency, and use that feedback to continue doing meaningful work.

The ultimate product is not the dashboard or the timer.

It is the repeated behavior the system helps create.
