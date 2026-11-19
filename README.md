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
- A streak screen on the first session of the day, and a tab icon that shows your progress
- Edit session missions and rename rooms
- Co-DeepWork Rooms: work together through a link, with a ranking and hourly check-ins
- Profile and friends: follow people, and see their streak, heatmap, and live state
- Settings: username, password, privacy, blocked users, language, and feedback
- Landing page, and Spanish (default) and English

## Stack

**Frontend:** React, TypeScript (strict), Vite, CSS  
**Backend:** Flask  
**Database:** Turso / SQLite  
**ORM:** SQLAlchemy  
**Authentication:** JWT access + refresh tokens  
**Quality:** pytest and strict pyright, Vitest and Testing Library, strict TypeScript and ESLint, run by GitHub Actions on every push  
**Deployment:** Netlify + Render

## Architecture

Frontend → Flask API → Turso / SQLite

The frontend is deployed separately from the backend and database.

The frontend is React and TypeScript in `frontend/src/`, a folder per feature.

The backend is one Python package with a folder per feature (`auth`, `sessions`, `dashboard`, `rooms`, `social`, `account`).

Both structures are explained in `docs/architecture.md`.

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

**v0.6.1 — Rebuild, Spanish & Landing**  
A React and TypeScript rewrite with tests, a landing page, and Spanish.

**v0.6.2 — Polish Details**  
A streak screen, a progress ring in the tab icon, redesigned modals, and Days Worked on the Dashboard.

**v0.7 — Profile & Friends**  
A profile with your consistency, following people and seeing them work, blocking, and a settings panel.

## About the project

I designed, built, debugged, and deployed ExecutionOS end to end.

I used the project to learn product engineering by learning concepts when the product required them and immediately applying them to a real system.