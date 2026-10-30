# ExecutionOS

ExecutionOS is a deep-work consistency tracker built to help people execute on their plans and make consistency visible.

**Live app:** https://executionos-mvp.netlify.app/

## Why I built it

I built ExecutionOS to solve my own problem: consistently executing on plans I had already defined.

The product follows a simple flow:

**Plan → Focus → Review → Dashboard**

Each screen has one purpose so the user can focus on execution without unnecessary noise.

## Features

- Define a mission and target focus time
- Focus timer based on Timestamps with pause & resume
- Review sessions
- Weekly statistics and session history
- User accounts and persistent sessions
- Automatic access-token refresh
- Offline session queue and retry
- Session deletion
- Dashboard with trends, streaks, and a consistency calendar
- Co-DeepWork Rooms: join with a link, work together, ranking, hourly check-ins, and sessions saved to both your history and the room

## Stack

**Frontend:** Vanilla JavaScript, HTML, CSS  
**Backend:** Flask  
**Database:** Turso / SQLite  
**ORM:** SQLAlchemy  
**Authentication:** JWT access + refresh tokens  
**Quality:** pytest and strict pyright, run by GitHub Actions on every push  
**Deployment:** Netlify + Render

## Architecture

Frontend → Flask API → Turso / SQLite

The frontend is deployed separately from the backend and database.

The backend is one Python package with a folder per feature (`auth`, `sessions`, `dashboard`, `rooms`). See `docs/architecture.md`.

## Version history

**v0.1 — Core MVP**  
Plan → Focus → Review.

**v0.2 — Persistence & Dashboard**  
Added backend persistence and visibility of sessions & statistics.

**v0.3 — Account System**  
Accounts, user sessions, deletion, and completed core UI.

**v0.4 — Polished UI & UX**  
Redesigned and polished the core experience.

**v0.5 — Visual Dashboard & Streaks**  
Trend charts, streaks, a consistency calendar, and a full UI redesign.

**v0.6 — Co-DeepWork Rooms**  
Shared rooms where small groups do deep work together, with server-held sessions and check-ins.

## About the project

I designed, built, debugged, and deployed ExecutionOS end to end.

I used the project to learn product engineering by learning concepts when the product required them and immediately applying them to a real system.