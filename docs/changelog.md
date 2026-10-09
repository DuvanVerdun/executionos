# ExecutionOS — Changelog

Each version is a meaningful product step. Small fixes and polish get their
own commits, not their own entry.

## v0.6 — Co-DeepWork Rooms (in progress)

See `docs/current-roadmap.md`.

## v0.5 — Visual Dashboard, Streaks, and UI Redesign (Oct 7, 2026)

- Dashboard periods: Week, Month, Year, and All Time (previous/next navigation
  for Week, Month, and Year).
- Trend chart with Time, Completion, and Sessions metrics.
- Responsive summary cards: focused time, sessions, average completion, and
  average session time.
- Paginated session history grouped by day, with daily summaries.
- Streak system and consistency calendar showing work and rest days (two rest
  days per week), available on Plan and Dashboard.
- Complete UI redesign: soft header, semantic colors, and redesigned Plan,
  Focus, Review, and auth screens.
- Header navigation switches between Plan and Dashboard.
- Send Feedback moved to the user menu.
- Loading, empty, and error states with retry.

## v0.4 — Polished UI & UX (Sep 13, 2026)

- Completely redesigned user interface.
- Progress ring around the focus timer.
- Defined CTA and reward colors.
- Sticky target time input, visible password toggle, local time, and ordered
  sessions.

## v0.3 — Account System, Session Deletion & Core UI (Aug 25, 2026)

- Account system: JWT authentication (access token plus httpOnly refresh cookie), live on Render and Turso.
- User menu with username and logout.
- Delete past sessions from the dashboard, with confirmation.
- Consistent minimal styling for loading, register, and login screens.
- Fixed dashboard data parsing and rendering bugs from the move to the real database schema.
- Local HTTPS setup for testing the full auth flow against a local backend.

## v0.2 — Backend, Memory, Dashboard & Robustness (Jul 2, 2026)

- Every finished session is saved to a JSON file.
- Dashboard with weekly stats and a scrollable session list.
- Interrupted sessions are restored after a page reload.
- Timer stays accurate when the tab is in the background.

## v0.1 — MVP Demo (Jun 12, 2026)

- Plan screen: mission, target time, and start.
- Focus screen: live timer, pause/resume, and stop.
- Review screen: target vs actual time, completion, status, and continue/finish.
