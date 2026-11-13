# ExecutionOS — Architecture

## Purpose

This document records stable technical architecture and implementation patterns.

Its purpose is to preserve consistency without repeatedly reopening decisions
that have already been made.

Architecture may change when a concrete product or engineering reason justifies
it.

## System Architecture

### Frontend

- React and TypeScript (strict), built with Vite.
- One global stylesheet, `style.css`.
- Hosted on Netlify.
- Build: `npm run build`, output `frontend/dist`.
- See Frontend Structure below.

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

## Frontend Structure

`frontend/index.html` has one `<div id="root">` and loads `src/main.tsx`, which imports `style.css`.
`sounds/` lives in `frontend/public/`. All code lives in `frontend/src/`, one folder per feature, like the backend.

```
src/
  main.tsx       connects the screen-change steps, sets the page language, starts React, then starts the app
  App.tsx        shows the screen that is active, and the parts above every screen
  config.ts      backend address and timing constants
  app/           startup.ts (restore sign-in, first screen), hooks.ts (steps around screen changes), LoadingScreen
  lib/           pure helpers (durations, dates, validation, timing, errors, arrays, css), store.ts, dom.ts
  hooks/         shared React hooks: useDocumentEvent, useInView, useToday
  i18n/          en.ts, es.ts, i18n.ts (see Frontend Texts)
  types/         backend response shapes and shared types
  shared/        navigation (which screen shows), last-screen, floating message, confirm and edit-mission modals,
                 account menu (with the language menu), Header, Screen, ProgressRing, SessionCard
  auth/          state, http (token refresh), api, identity, logout, AuthShell (the layout of Login and Register,
                 with AuthVisual and InviteCard), Register and Login screens
  session/       state, ui-state, api, timer, storage (active session + offline queue), sync, plan, focus, review,
                 MissionCard, Plan, Focus and Review screens
  dashboard/     api, dashboard (state and loading flows), chart-math, TrendChart, SessionHistory, DashboardScreen
  streak/        api, streak (state and loading flows), StreakPopup
  feedback/      api, feedback (state and send flow), FeedbackForm
  landing/       the Landing: screen, header, one file per section, demo data, scroll effects (see Landing)
  rooms/         api, state, room-session-state, rooms, room, room-session, rename, menu, copy, links,
                 checkin-sound, and the Rooms and Room screens with their cards, menus and modals
```

- **Arrows go down.** `main` → `app` → features → `shared` → `lib` and `config`.
- **Logic and screens are separate.** A feature's logic (`dashboard.ts`, `room-session.ts`, ...) is plain
  TypeScript with no React. Its components (`*.tsx`) only draw what the logic holds.
- **State outside React.** State that must survive a screen change, or that async flows read after
  an `await`, lives in a small store (`lib/store.ts`). Components read it with `useStore`.
  State that belongs to one visit of a screen (form errors, open menus) is `useState`.
- **Same file names in each feature.** `api.ts` holds the backend calls (it mirrors that feature's
  `routes.py`) and `state.ts` the stores.
- **Only the active screen is rendered.** `Screen` gives it its layout. Stylesheet rules use ids and
  classes, so components keep them.
- **Hooks instead of upward imports.** `navigateTo` runs steps that features add with
  `addBeforeSwitchHook` (registered in `app/hooks.ts`). `apiFetch` calls a handler set with
  `setLoginRequiredHandler`.
- **Effects are for the outside world** (listeners, observers, timers) and always clean up.
  Everything else happens in event handlers.
- **Strict TypeScript.** No `any`. `as` only where backend JSON and browser storage enter
  (`auth/http.ts`, `session/storage.ts`). Lint: `npm run lint` (typescript-eslint strict and the React hooks rules).

## Screens and Navigation

- Screens: `loading`, `landing`, `register`, `login`, `plan`, `focus`, `review`, `dashboard`, `rooms`, `room`.
  There is no URL router. `screenStore` holds the screen, and `navigateTo` only follows the transitions
  that `shared/navigation.ts` allows.
- **Startup** (`app/startup.ts`): not signed in goes to `landing`, or to `register` with a `#join=` link. Signed in
  joins, restores running sessions, and returns to the last screen.
- Logout goes to `landing`. A request that needs a new sign-in goes to `login`. Login and Register never go
  back to `landing`.
- The last screen is saved in `sessionStorage` (`shared/last-screen.ts`) and forgotten at logout.
- Leaving `landing` scrolls to the top. Reaching `landing`, `login`, `register`, or `loading` clears the room
  data (`app/hooks.ts`).

## Frontend Tests

- `npm test` from `frontend/` runs Vitest once (`npm run test:watch` re-runs on save). The
  environment is jsdom, with Testing Library for components.
- A test sits next to the file it tests (`timer.ts` and `timer.test.ts`). Test files are also
  covered by `npm run typecheck` and `npm run lint`.
- Shared test setup is in `src/test/`. Before every test it puts every store back to its first
  state and clears `localStorage`. It sets the language to English, so texts in tests stay in English, and it stubs what jsdom lacks
  (`navigator.locks`, `IntersectionObserver`, `matchMedia`). `network.ts` fakes `fetch`, so no server runs.
- Dates run in the fixed timezone `America/Argentina/Buenos_Aires` (set in `vite.config.ts`).
  Timer tests use fake timers and a fake clock.
- Tests aim at behavior where a failure would hurt: formatting and validation, the timer, the
  saved session and offline queue, token refresh and retry, the finish flow, and the focus-time
  box. Layout and most display-only components are not tested.
- GitHub Actions runs them in the `frontend` job (`.github/workflows/tests.yml`).

## Frontend Texts (i18n)

- Every text the user sees goes through `t('feature.name')`. No screen holds its own text.
  Our own small module, no library (`src/i18n/`).
- `en.ts` holds the English texts and decides which keys exist. Keys are grouped by feature.
  `es.ts` holds the Spanish texts, written with "tú". It has a text for every key (`es.test.ts` checks it, and
  that both have the same `{slots}`). A text missing there would fall back to English.
- Keys are typed. A wrong key fails `npm run typecheck`. A text with a `{slot}` needs its
  value: `t('review.target', { time })`.
- Components call `useT()`, so they redraw when the language changes. Plain code (logic
  files) imports `t`.
- **The language.** Spanish is the default. `setLanguage` saves it in `localStorage` (`executionOS_language`)
  and sets `<html lang>`. The account menu has the language menu (`shared/Header.tsx`, `shared/user-menu.ts`).
- Plurals use two keys (`membersOne`, `membersOther`) and the code picks one.
- **Dates and units.** `lib/dates.ts` formats dates with `Intl` and `getLocale()` (`es` or `en-US`).
  `lib/durations.ts` takes the units `min` and `seg` from keys (`common.minutesShort`, `common.secondsLong`).
- Not through `t()`: messages that the backend sends. Developer messages (`console.error`, thrown
  errors) stay English.
- Store values that a screen turns into text (`pauseLabel`, `finishLabel`) stay as typed
  values. The screen calls `t()`.

## Landing

`src/landing/`. No backend endpoint.

- One file per section, put together by `LandingScreen`. `auth/AuthShell` reuses the demo parts.
- The demos use the real `TrendChart`, `RoomRanking`, `MissionCard`, `ProgressRing`, and calendar classes. The
  Focus and Review cards are copies. Demos are `inert`.
- `demo.ts` is pure and takes the visitor's date. Sessions and time depend on how many days ago a day was.
  Day states follow the week rule of the app (two rest days, the third is missed). The chart reaches 2h today.
- `hooks/useToday` gives today's date and refreshes it after midnight.
- Sizes are `calc(N * var(--lu))`. `--lu` follows the window's width and height, so each section fits one screen.
- The header sets `--header-background` (0 to 1 over 120px) and the CSS draws the bar. Its register button shows
  once the first one is above the header.
- `useRevealOnScroll` adds `is-revealed` to sections in view, under `landing-animated`. Reduced motion skips it.
- Keys: `landing.*`, `auth.visual.*`, `auth.invite.*`. The invite card is generic because no public endpoint
  gives a room's name.

## Backend Structure

`backend/main.py` only builds the app, so `gunicorn main:app` and `FLASK_APP=main.py`
keep working. All code lives in the `executionos` package, one folder per feature the
user sees. `migrations/` and `tests/` stay beside it.

```
executionos/
  factory.py       create_app(): builds the app and registers every blueprint
  config.py        settings: production from the environment, or a test dict
  extensions.py    db and jwt
  models.py        all tables
  errors.py        error_response() and server_error(): every failure answer
  timeutils.py     UTC helpers and week/month/year bounds
  params.py        reading request values (period, date, timezone, cursor, JSON body)
  feedback.py      feedback route (a feature this small is one file)
  auth/            routes.py, tokens.py
  sessions/        routes.py, service.py, history.py
  dashboard/       routes.py, service.py, streak.py
  rooms/           routes.py, service.py, queries.py, session_service.py, rules.py, errors.py
```

- **Arrows only go down.** `routes.py` → `service` / `queries` / `streak` → shared
  modules (`rules`, `history`, `timeutils`, `params`, `errors`, `models`,
  `extensions`). A file never imports from a file above it. Only `factory.py` imports
  `routes.py` files.
- **A route is thin.** It reads the request, calls a function, and answers. One
  blueprint per feature, URLs unchanged (`/api/...`).
- **A new feature is a new folder.** Anything two features need goes in the shared
  modules, never in one feature's folder.
- **`sessions/history.py`** holds what any list of sessions needs, personal or room:
  serializing, completion, daily summaries and cursor paging.
- Absolute imports (`from executionos.models import Session`). No empty
  `__init__.py` files.

## Backend Tests

- `python -m pytest` from `backend/`. Tests call the API like the frontend does, on
  an empty in-memory database built by `create_app(test_config)`. They never touch
  Turso.
- `pyright` (strict, `pyrightconfig.json`) is the same check as Pylance.
  `requirements-dev.txt` holds both tools.
- GitHub Actions runs both on every push (`.github/workflows/tests.yml`).

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

Python uses strict Pylance typing. The frontend uses strict TypeScript (`npm run typecheck`).

Use `cast()` (Python) or `as` (TypeScript) only at genuine boundaries such as:

- Raw JSON.
- Weak third-party type information.
- Runtime-validated values static analysis cannot infer.

Do not use `cast()` or `as` to hide unclear application logic.

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

A timer may update the display but must never determine elapsed-time
correctness. The Focus and room timers wake up when the shown second changes
(`millisecondsUntilNextSecond` in `lib/timing.ts`), not on a fixed interval, so the
number is never late. A hidden tab catches up when it becomes visible.

## Active Session Persistence

An active work session can survive accidental reloads or tab closure.

Persist enough state to reconstruct the logical session accurately.

Reloading the page must not automatically create a new logical session.

## Offline Session Saves

Failed session saves may be queued locally and retried.

The queue is a resilience mechanism, not a second database.

The backend remains authoritative.

## Streak

`GET /api/streak` is computed on each request. `calculate_streak_states` (`dashboard/streak.py`) walks the days
from the first day worked to today. A day with work is `work`. After work, a day without work is `rest` while
the week (Monday to Sunday) has used fewer than two rest days, then `missed`, which resets the streak. Today
without work is `today`. The answer has `current_streak`, `total_worked_days`, `rest_days_remaining_this_week`,
and a month `calendar` with each day's state, sessions, and time. `PATCH /api/update-session/<id>` changes a
mission, never the times.

## Rooms

Shared rooms are a layer on top of personal execution. The server learns about a
running session only for room sessions. Personal sessions stay client-side.

Three ideas run through everything:

1. **Store facts, derive conclusions.** Totals, ranking, owner, member state, and
   overdue status are never stored.
2. **Lazy finalization.** There is no background worker. Whichever request next
   reads the relevant scope closes the overdue sessions, and closing is
   idempotent.
3. **The server row is the authority** for a running room session: its state, its
   saving, and a limit on the time. The client counts the time worked on its own clock
   and sends events with that count.

### Modules

- `rooms/rules.py`: pure rules and the time constants. No database, no clock.
- `rooms/service.py`: rooms and memberships (the actions that change data).
- `rooms/queries.py`: snapshot, summary and history (reads only).
- `rooms/session_service.py`: running sessions and finalization.
- `rooms/errors.py`: the room exceptions and their mapping to answers.
- Import direction: `session_service` → `service` → `rules`, and `queries` →
  `service`. Routes live in `rooms/routes.py`. Service functions are named
  `*_for_user`.

### Constants

| Name | Value | Where |
|---|---|---|
| `HEARTBEAT_TIMEOUT_SECONDS` | 180 (overdue when strictly older) | backend |
| `PAUSED_TIMEOUT_SECONDS` | 3600 | backend |
| `CHECKIN_INTERVAL_SECONDS` | 3600 | backend |
| `CHECKIN_RESPONSE_SECONDS` | 300 | backend |
| `REPORTED_TIME_TOLERANCE_SECONDS` | 10, margin on the client's count | backend |
| `CHECKIN_EARLY_TOLERANCE_SECONDS` | 60, a check-in can be confirmed this early | backend |
| `ROOM_NAME_MAX_LENGTH` | 50 | backend |
| `LINK_TOKEN_BYTES` | 16 | backend |
| `PAGE_SIZE` | 20, personal list and room history | backend |
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
  `last_interaction_at` and `last_interaction_actual_seconds` (set together: the time
  worked that the client counted at that moment, limited by the server), and
  `last_heartbeat_at`.
- **`session_end_notices`:** one per user. `reason` (`missed_checkin`,
  `paused_timeout`, `disconnected`), `saved`, `actual_time_seconds`. Read and
  deleted in the same request.

Migrations: two, both additive. On the shared database, changes to existing tables
stay additive and nullable, applied migrations are never edited, and a downgrade is
never run against production.

### Derivation rules

- **Actual time (server's own count):** `max(0, floor((T - started_at) - paused_seconds))`, where `T` is
  now if running, else `paused_at`. It is the fallback and the limit.
- **Time worked that is kept:** pause, check-in, and finish may carry the client's count
  (`workedSeconds`, `actualSeconds`). The server keeps it between 0 and its own elapsed time since
  `started_at` plus `REPORTED_TIME_TOLERANCE_SECONDS`. Without it, the server uses its own count. While
  paused, the time shown to others is `last_interaction_actual_seconds`.
- **Check-in** (while running): `due_at = started_at + paused_seconds +
  next_mark * 3600`, with `next_mark = last_checkin_mark + 1`. It is outstanding
  when `now >= due_at`. `deadline_at = due_at + 300`. The five minutes count from
  the moment it became due, not from when a popup is displayed. A confirmation is
  accepted from `CHECKIN_EARLY_TOLERANCE_SECONDS` before `due_at` until `deadline_at`,
  because the client opens the popup when its own count reaches the hour.
- **Overdue candidates:** `disconnected` at last heartbeat + 180s, `paused_timeout`
  at `paused_at` + 3600s (only if paused), `missed_checkin` at `deadline_at` (only
  if running). The earliest expired candidate gives the reason. Ties go in that
  order: disconnected, missed_checkin, paused_timeout.
- **End point of an overdue row:** saved only if there was an interaction. The
  session is saved at `last_interaction_at` with `last_interaction_actual_seconds`.
- **Interactions:** a pause (including Stop) and a successful Still here, each saving the
  time worked at that moment. Start,
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
- Renaming is `PATCH /api/rooms/<id>` with `{name}`, owner only (a non-owner gets 403).
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
- **Time.** The client counts the time worked from its own clock, and sends the count with Pause,
  Still here, and Finish. After a reload the client has no timeline, so it rebuilds one from the
  time the server counted (`adoptServerTimeline`). The server's state only changes a known
  timeline when the server says paused or running and the client disagrees.
- **Sync.** Rooms and Room screens poll every 15 seconds, skip hidden tabs, never
  overlap, and ignore stale responses (generation counters).
- **Stale-while-revalidate.** Rooms and Room screens show their last data at once and
  refresh silently. The skeleton appears only on a first visit. A failed load when
  opening a screen shows its error state, and a failed background poll stays silent.
- **Check-in.** The popup opens when the client's worked time reaches the next whole hour, and
  plays a sound scheduled on the audio clock, so tab throttling does not delay it. Audio needs a
  user gesture to unlock. A tab that becomes visible again brings the timer and the check-in up to date.
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