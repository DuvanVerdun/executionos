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

Do not design around one exact viewport.

Use fluid sizing where appropriate and verify the intended desktop range.

Values should come from design intent rather than browser zoom, monitor size, or
development-environment accidents.

## Architecture Rule

Prefer the simplest architecture that correctly solves the current problem while
remaining understandable enough to change later.

Complexity must earn its place.