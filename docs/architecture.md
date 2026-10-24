# ExecutionOS — Architecture

## Purpose

This document records stable technical architecture and implementation patterns.

Its purpose is to preserve consistency without repeatedly reopening decisions
that have already been made.

Architecture may change when a concrete product or engineering reason justifies
it.

## System Architecture

### Frontend

- Vanilla JavaScript.
- HTML and CSS without a frontend framework.
- Hosted on Netlify.
- No build pipeline currently required.

Frontend responsibilities include:

- Application interaction.
- Temporary UI state.
- Timer behavior.
- Rendering data returned by the backend.
- Calling backend APIs.
- Holding the access token in memory.
- Local resilience mechanisms such as pending session saves.

### Backend

- Python.
- Flask.
- Flask-SQLAlchemy.
- Flask-Migrate.
- Flask-JWT-Extended.
- Flask-CORS.
- Hosted on Render.
- App factory architecture.

Backend responsibilities include:

- Authentication.
- Authorization.
- Persistence.
- User ownership enforcement.
- Session APIs.
- Validation.
- Authoritative persisted execution data.

### Database

- SQL database accessed through SQLAlchemy.
- Turso/libSQL in production.

The backend is the authoritative source of persisted execution history.

### Repository

Single repository with explicit boundaries:

- `/frontend`
- `/backend`
- `/docs`

Do not move responsibilities between layers without a concrete reason.

## Data Model Principle

The database stores facts, not conclusions.

Store source information such as:

- Mission.
- Planned time.
- Actual time.
- Date/time.
- User ownership.

Prefer deriving values such as:

- Completion percentage.
- Completion status.
- Aggregated statistics.
- Dashboard metrics.

Do not create competing stored sources of truth for values that can reliably be
derived from source data.

## Core Models

### User

Owns authentication information and execution sessions.

`token_version` is used to invalidate outstanding refresh-token sessions when
required.

### Session

A session belongs to exactly one user through a non-nullable `user_id`
foreign key.

A session saved from a room also has a nullable `room_id` (see "Rooms").

All session access must enforce ownership.

Requests involving another user's resource must not reveal whether that resource
exists.

## Authentication

ExecutionOS uses a two-token JWT system.

### Access Token

- Short-lived.
- Stored only in JavaScript memory.
- Sent through the `Authorization` header.
- Never persisted in `localStorage`.
- Never stored in a frontend-readable cookie.

### Refresh Token

- Long-lived relative to the access token.
- Stored in an `httpOnly`, `Secure` cookie.
- Sent using cookie authentication.
- Cross-origin requests that require it use `credentials: "include"`.

Cookie authentication and the `Authorization` header are separate mechanisms.

### Refresh

When the access token expires, the frontend may use the refresh endpoint to
obtain fresh credentials and retry the authenticated operation.

### Logout

`token_version` provides server-side invalidation of outstanding refresh
sessions.

### Authentication Privacy

Authentication errors must be enumeration-safe.

Do not expose whether an account exists separately from whether credentials are
incorrect.

## SQLAlchemy

Use SQLAlchemy 2.0 query patterns.

Preferred conceptual pattern:

`execute(select(...)) → scalar result`

Do not introduce the legacy `.query` API.

Keep database access patterns consistent across the backend.

## Type Boundaries

Python uses strict Pylance typing.

Use `cast()` only at genuine boundaries such as:

- Raw JSON.
- Weak third-party type information.
- Runtime-validated values static analysis cannot infer.

Do not use `cast()` to hide unclear application logic.

## Frontend State

Application state should have a clear source of truth.

Do not use rendered DOM state as application state when the value belongs to the
application's data model.

Keep persistent application state and temporary presentation state conceptually
separate.

Prefer data-driven rendering.

## Timer

Timer correctness is timestamp-based.

Elapsed time is derived from:

- Real timestamps.
- Accumulated paused time.
- Current session state.

`setInterval()` may update the display but must never determine elapsed-time
correctness.

## Active Session Persistence

An active work session can survive accidental reloads or tab closure.

Persist enough state to reconstruct the logical session accurately.

Reloading the page must not automatically create a new logical session.

## Offline Session Saves

Failed session saves may be queued locally and retried.

The queue is a resilience mechanism, not a second database.

The backend remains authoritative.

## Rooms

Shared rooms are a layer on top of personal execution. The server learns about a
running session only for room sessions. Personal sessions stay client-side.

Three ideas run through everything:

1. **Store facts, derive conclusions.** Totals, ranking, owner, member state, and
   overdue status are never stored.
2. **Lazy finalization.** There is no background worker. Whichever request next
   reads the relevant scope closes the overdue sessions, and closing is
   idempotent.
3. **The server row is the authority** for a running room session. The client
   displays it and sends events.

### Modules

- `room_session_rules.py`: pure rules and the time constants. No database, no
  clock.
- `room_service.py`: rooms, memberships, snapshot, summary, history.
- `room_session_service.py`: running sessions and finalization.
- Import direction: `room_session_service` → `room_service` →
  `room_session_rules`. Routes live in `main.py`. Service functions are named
  `*_for_user`.

### Constants

| Name | Value | Where |
|---|---|---|
| `HEARTBEAT_TIMEOUT_SECONDS` | 180 (overdue when strictly older) | backend |
| `PAUSED_TIMEOUT_SECONDS` | 3600 | backend |
| `CHECKIN_INTERVAL_SECONDS` | 3600 | backend |
| `CHECKIN_RESPONSE_SECONDS` | 300 | backend |
| `ROOM_NAME_MAX_LENGTH` | 50 | backend |
| `LINK_TOKEN_BYTES` | 16 | backend |
| `HISTORY_PAGE_SIZE` | 20 | backend |
| `HEARTBEAT_INTERVAL_MS`, `ROOM_POLL_INTERVAL_MS` | 15000 | client |

### Data model

All new datetime columns hold UTC, written with `datetime.now(UTC)` and read
through `_as_utc_aware`.

- **`rooms`:** `name` (max 50), unique `link_token`, `created_at`. No owner column.
- **`room_memberships`:** `room_id`, `user_id`, `joined_at`, `left_at` (empty means
  active), `show_missions`. Unique `(room_id, user_id)`: one row per person per
  room, forever. Rejoining resets `joined_at` and keeps `show_missions`.
- **`sessions`:** nullable `room_id` and index `ix_sessions_room_id_date`. Only
  server finalization creates a session with a `room_id`. `save-session` never
  reads it.
- **`active_room_sessions`:** one running session per user (unique `user_id`).
  Holds `room_id`, a server-generated `submission_id`, mission, target,
  `started_at`, `paused_at`, `paused_seconds` (float), `last_checkin_mark`,
  `last_interaction_at` and `last_interaction_actual_seconds` (set together), and
  `last_heartbeat_at`.
- **`session_end_notices`:** one per user. `reason` (`missed_checkin`,
  `paused_timeout`, `disconnected`), `saved`, `actual_time_seconds`. Read and
  deleted in the same request.

Migrations: two, both additive. On the shared database, changes to existing tables
stay additive and nullable, applied migrations are never edited, and a downgrade is
never run against production.

### Derivation rules

- **Actual time:** `max(0, floor((T - started_at) - paused_seconds))`, where `T` is
  now if running, else `paused_at`.
- **Check-in** (while running): `due_at = started_at + paused_seconds +
  next_mark * 3600`, with `next_mark = last_checkin_mark + 1`. It is outstanding
  when `now >= due_at`. `deadline_at = due_at + 300`. The five minutes count from
  the moment it became due, not from when a popup is displayed.
- **Overdue candidates:** `disconnected` at last heartbeat + 180s, `paused_timeout`
  at `paused_at` + 3600s (only if paused), `missed_checkin` at `deadline_at` (only
  if running). The earliest expired candidate gives the reason. Ties go in that
  order: disconnected, missed_checkin, paused_timeout.
- **End point of an overdue row:** saved only if there was an interaction. The
  session is saved at `last_interaction_at` with `last_interaction_actual_seconds`.
- **Interactions:** a pause (including Stop) and a successful Still here. Start,
  Resume, Continue, and Finish are never interactions, so paused time can never be
  counted as work.
- **Member state:** no row is `not_working`, a running row is `working`, a paused
  row is `paused` (Review counts as paused).
- **Ring percentage:** `min(100, floor(actual / target * 100))`, only when
  working. Raw target and actual time of others are never exposed.
- **Owner:** the active member with the smallest `(joined_at, membership id)`.
- **Ranking:** total room time descending, then `joined_at`, then membership `id`.
- **Summary:** totals include former members' sessions. The average is
  `round(total / count)`. `include_my_running_session` adds the requester's own
  running session in that room.

### Finalization

`finalize_overdue_for_users`, `finalize_overdue_for_rooms`: load the candidate rows,
evaluate them in Python, then for each overdue row, in one transaction:

1. **Claim** it with `DELETE ... RETURNING`. If nothing was claimed, another request
   already finalized it.
2. If it is saved, insert the `Session` with `room_id` and the row's
   `submission_id`. The unique `(user_id, submission_id)` is the second guard, and
   an `IntegrityError` means "already saved".
3. Replace the user's notice, and commit.

Finish uses the same claim. If it finds no row but a saved session exists, it
returns success and deletes any pending notice, because the user is present.

Read paths (snapshot, summary, history, rooms list, dashboard, streak,
get-sessions) finalize their scope first. A failure is logged and ignored: an
overdue session is never displayed as working. On a user's own event paths, a
failure returns the generic 500.

Each `room-session` request loads the user's row together with the room name in
one query, so a request costs about three statements.

### API conventions

- Prefix `/api/`, `@jwt_required()`. Request body keys are camelCase, query
  parameters are snake_case, response keys are snake_case.
- Timestamps are naive UTC ISO 8601 with milliseconds and no `Z`. The client
  appends `Z`.
- Success is `{success: true, ...}`. Failure is `{success: false, error}` with a
  generic text. Never return `str(e)`.
- Status codes: 400, 403 (an active member who is not the owner), **404 for every
  "not available" case** (unknown room, non-member, bad or refreshed link, deleted
  room), 409.
- Responses are built from explicit whitelists, never from model objects.
  `link_token` goes only to the owner. Hidden missions are masked server-side.
  Integers reject booleans.
- Authorization on every room route goes through `get_active_membership` (none
  gives 404) and `is_owner` (a non-owner gives 403).
- Aggregate with `GROUP BY`. Never query per room or per member.
- **Room deletion** (owner delete, or the last member leaving), in one
  transaction: set `sessions.room_id` to null, delete memberships, delete the room.
  Turso enforces foreign keys, so the order matters.
- **Links:** `<origin>/#join=<token>`. The token is `secrets.token_urlsafe(16)`,
  stored plain so the owner can copy it. The fragment keeps it out of server logs,
  and the client removes it after the join attempt.
- **Room-session envelope**, returned by every endpoint:
  `{success, server_time, active, session, notice}`. A 409 is the same envelope with
  `success: false`. A response with `active: false` carries any pending notice.

### Room session client

- **Optimistic with a server queue.** Start, Pause/Resume, Stop, Continue, and Still
  here update the screen at once and send their requests through one ordered
  queue, so the server sees events in the order the user made them.
- **Retry and rollback.** A failed request retries for about 10 seconds. If it still
  fails, the client shows an error message and re-reads the server's state. A failed
  Start returns to the Room screen with the form kept.
- **Server truth.** Only the last request in the queue applies the server's state.
  The heartbeat is skipped while requests are queued.
- **Finish is server-confirmed.** It waits for the queue, shows "Saving…" for at
  least two seconds, and retries with the same `submission_id`.
- **Clock.** The client estimates the server clock offset from the midpoint of each
  round trip, so timers and check-ins follow server time.
- **Sync.** Rooms and Room screens poll every 15 seconds, skip hidden tabs, never
  overlap, and ignore stale responses (generation counters).
- **Stale-while-revalidate.** Rooms and Room screens show their last data at once and
  refresh silently. The skeleton appears only on a first visit. A failed load when
  opening a screen shows its error state, and a failed background poll stays silent.
- **Check-in.** The popup opens at `due_at` and plays a sound scheduled on the audio
  clock, so tab throttling does not delay it. Audio needs a user gesture to unlock.
- **Ordering at load.** Authenticate, join from `#join=` if present, restore the
  server's running session, then restore a personal session, then go to Plan.

### Deploy and safety

The local backend and the production backend use the same Turso database. Anything
local code writes lands in production data. Migrations and scripts that write to the
database are run by the owner only. Back up the database before each migration and
before any bulk change.

## Dynamic DOM

For dynamically generated elements, prefer event delegation when it creates a
simpler and more stable event model.

Attach listeners to stable parents and resolve intended actions through the event
target.

## UI Structure

HTML should reflect semantic responsibility.

CSS class names should describe stable intent rather than incidental layout
mechanisms.

Use a shared visual system for typography, spacing, borders, radii, semantic
colors, and interactions.

## Responsive Layout

Do not design around one exact viewport. The 1440×1024 Figma canvas is a prototyping tool, not a build limit.

Use fluid sizing where appropriate and verify the intended desktop range.

Values should come from design intent rather than browser zoom, monitor size, or
development-environment accidents.

## Architecture Rule

Prefer the simplest architecture that correctly solves the current problem while
remaining understandable enough to change later.

Complexity must earn its place.