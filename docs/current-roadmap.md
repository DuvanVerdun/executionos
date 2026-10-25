# ExecutionOS — Current Roadmap

## Current State

**v0.6 is shipped and live in production.**

- v0.6 (Co-DeepWork Rooms) shipped Oct 24, 2026, see `docs/changelog.md`.
- Technical design moved to `docs/architecture.md`, and room behavior to `docs/product.md`.

## Decision

The v0.6 ship steps about users (a test with several accounts, preparing a launch,
and a 3-day challenge) are skipped. Priority is now observed problems,
improvements, and v0.7 (Profile and Friends), ahead of getting users. The dated
plan lives in `docs/organization/q4-plan-2026.md`.

Order of work: **Foundation Week** (Oct 26 - Oct 31) comes first, then v0.7
(Nov 2 - Nov 7).

## Current Work: Foundation Week

Foundation Week is the pending work before v0.7. It collects the observed
problems, technical foundations, and improvements that accumulated after v0.6.
The goal is a safer backend, tests, a clean architecture, a TypeScript + React
frontend, and then the features that the rewrite makes cheap.

The order below is deliberate:

- Hard things that unlock others come early (tests, the rewrite).
- Things the rewrite would destroy or simplify come after it.
- Things that survive the rewrite untouched (backend, CSS, static files) can go first.

Nothing here is a solution yet. Items marked "evaluate" must first be understood
as real problems. Each item gets its own work and its own commit when its turn
comes.

### Stage 1: Warm-up

Small, real, and they live in CSS, HTML, or a static file, so they carry into the
rewrite. They also give the rewrite a clear target: "looks exactly like this".

1. **Check-in sound file.** `sounds/checkin.mp3` does not exist, so the check-in sound is silently broken. The file must be supplied.
2. **Header shifting with the scrollbar.** The header looks different when there is a page scrollbar and when there is none. It is very visible when moving from Plan to Dashboard or Rooms with enough room cards.
3. **All rings the same direction (clockwise).** The Focus, Review, and member rings must share one direction.
4. **White buttons darker on hover.**
5. **Wordmark on the loading screen.**

### Stage 2: Learn tests, using real backend problems

6. **Learn testing and set up backend tests, starting with auth.** Tests make every later step safer. Auth is the place to learn, because the next three items can be proven with a test first and then fixed.
7. **Generic 500s instead of `str(e)`.** Several routes still return the exception text.
8. **Register no longer reveals whether an account exists.** Part of it can be done now. A complete fix probably needs email verification (item 26).
9. **Replace the legacy `.query` with `select()`.** It is in the history import script, which writes to the production database, so it is run by the owner only.

### Stage 3: Backend foundation

10. **More backend tests:** room rules, dashboard maths, ownership checks. Written before the refactor so the refactor cannot silently break anything.
11. **Backend refactor and module split.** Remove duplication, clean up code, split `main.py` into modules, and reorganize the backend folders.

### Stage 4: The big move

12. **Learn TypeScript and React** from their documentation.
13. **Plan the new folder structure.** Done once, as part of the rewrite.
14. **TypeScript commit, then React commit.** The rewrite is also the frontend refactor.
15. **Frontend tests**, written on the new code.
16. **Set up the Spanish toggle skeleton (i18n).** No translation yet. From now on, every new string goes through it.

### Stage 5: Features that get easier after the rewrite

17. **One shared header** with all three navigation buttons (Plan, Dashboard, Rooms). The current screen's button is brighter, to show where you are.
18. **Reload returns to the last screen,** after the authentication process.
19. **Modal cards instead of `confirm()`.** One reusable modal used everywhere.
20. **Deleting a single session makes the dashboard reload completely.** Evaluate.
21. **Edit session missions,** for personal and room sessions. Times never change.
22. **Edit room names.** Owner only. The new name shows everywhere the room appears.
23. **Streak calendar:** a gray state for today, a total-worked-days line (total days ever), and a hover summary like the daily summary on session cards, shown in a rounded box with padding. The hovered day gets a slightly brighter background.
24. **Timer in seconds leaves too much time between updates.** First understand whether it is a real problem.
25. **Ranking to the right of the Plan card** on the Room screen.

### Stage 6: Need new infrastructure or design

26. **Forgot password with an email code.** An email service must be chosen first. This also completes item 8.
27. **Landing and presentation page.** Explains ExecutionOS with a reworked copy, based on the pitch. Should exist before getting users.
28. **Translate the app to Spanish.** Everything, including errors and notices. Done last, after all new copy exists.

### Stage 7: Polish ideas

Any order, one commit each, discarded if they do not look good.

29. **Slight lift on main buttons** on hover (like "Start Work").
30. **Shadow on the header.** Evaluate.
31. **Tab icon as a progress ring** that updates over time.
32. **Streak animation on Finish.** Needs design first.

### Deferred or parked

- **Room "working now" instead of average time on the summary card:** wait for real user feedback.
- **Ask AI to analyze the UI** and **ask AI what changes it would make to the product:** parked indefinitely.
- **Trend chart minimums:** cleared.
- **App name:** discarded. The name stays.

## Next

After Foundation Week, v0.7 (Profile and Friends) is next (Nov 2 - Nov 7). Its
scope goes here when it is decided.

While a version is in progress, its plans (design, architecture, vocabulary) live
in this file. At ship, each one moves to the doc that owns it.
