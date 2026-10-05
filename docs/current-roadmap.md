\# ExecutionOS — Current Roadmap



Last updated: October 4, 2026



\## Current Version



\### v0.5 — Visual Dashboard, Streak System, and Navigation/UI Redesign



Primary objective:



Make consistency visual and rewarding.



Secondary objective:



Improve the experience without changing the established execution behavior.



\## Repository State



\### Production / GitHub main



Remote `main` is still pre-v0.5.



Latest production baseline:



`c847649` — Sep 25, 2026

`fix: normalize and add type validations to auth inputs`



Production still uses the previous dashboard and navigation UI.



Do not assume remote `main` represents the current local working tree.



\### Local Working Tree



v0.5 engineering is functionally implemented locally but is not yet in

production.



The current local UI contains the functional v0.5 structure and behavior but has

not yet received the finished visual redesign.



Manual local happy-path testing has passed.



Automated tests and broader regression coverage are intentionally deferred until

after the initial v0.5 production release unless a blocking risk appears.



\## Implemented v0.5 Engineering



\### Dashboard Backend



A dedicated `dashboard\_service.py` owns dashboard-related calculations.



The backend owns:



\- Period filtering.

\- Timezone-aware aggregation.

\- Summary calculations.

\- Trend buckets.

\- Streak calculations.

\- Pagination.

\- Daily summaries.



\### APIs



Added:



\- `/api/dashboard`

\- `/api/streak`



Upgraded:



\- `/api/get-sessions`



Session retrieval supports:



\- Period filtering.

\- 20-session cursor pagination.

\- Complete daily summaries even when only part of that day's sessions are in

&#x20; the currently loaded page.



\### Dashboard Periods



Supported periods:



\- Week.

\- Month.

\- Year.

\- All Time.



Week, Month, and Year support previous/next calendar navigation.



All Time does not.



\### Summary Metrics



The dashboard provides:



\- Focused time.

\- Number of sessions.

\- Average completion.

\- Average session time.



\### Trend Visualization



Available metrics:



\- Time.

\- Completion.

\- Sessions.



Buckets:



\- Week and Month → daily.

\- Year and All Time → monthly.



\### Session History



Session history is:



\- Newest first.

\- Loaded 20 sessions at a time.

\- Infinite-scroll based.

\- Grouped by the user's local calendar day.



When a day contains more than one session, show a daily summary above its

sessions.



\### Streak



The streak is global and appears on Plan and Dashboard.



Rules already implemented:



\- Calendar weeks are Monday–Sunday.

\- Each week has exactly two rest days.

\- Restarting a broken streak does not restore previously consumed rest days.

\- Date handling is based on the user's local calendar dates.



Do not redesign streak behavior during the visual implementation.



\## Finished v0.5 Design Decisions



The Figma redesign is complete.



Implementation should translate the finished design into the existing local

behavior rather than inventing a new experience.



\### Navigation



Use the rounded soft header.



Do not implement the sidebar exploration.



Dashboard header:



\- ExecutionOS wordmark.

\- Neutral `New Mission` navigation.

\- Streak.

\- User avatar.



Plan header:



\- ExecutionOS wordmark.

\- `Dashboard` navigation.

\- Streak.

\- User avatar.



The user menu contains:



\- Username.

\- Send Feedback.

\- Logout.



The old footer is removed.



\### Product Hierarchy



Plan exists to start work.



Its hierarchy is:



Mission → Focus duration → Start Work



`Start Work` uses the action color and must remain the dominant control.



Dashboard exists to reward and explain consistency.



Its hierarchy is:



Period → Stats → Trend → Session History



\### Semantic Color



Coral/red represents execution/action.



Turquoise represents earned execution, consistency, and reward.



Neutral grays structure the interface.



Do not use accent colors decoratively when they do not communicate meaning.



\### Layout



The desktop Figma reference uses a 1440px viewport with approximately 1080px of

dashboard content width.



Treat this as design intent, not a fixed viewport requirement.



The implementation should remain fluid and work across the intended desktop

range.



\### Surfaces and Shape



Use the redesigned surface hierarchy instead of outlining every container.



Borders are subtle and used only when required to distinguish interactive or

overlapping surfaces.



Radius system:



\- 12px → controls, inputs, period navigation.

\- 16px → summary cards.

\- 24px → major cards and popovers.

\- Full pill → header and genuine pill controls.



Use consistent internal padding based on the shared spacing system.



\### Summary



Summary values use strong numeric hierarchy:



\- Large value.

\- Smaller semantic label.



Labels:



\- Focused.

\- Sessions.

\- Avg. Completion.

\- Avg. Session Time.



\### Trend Chart



The selected metric is turquoise.



Use:



\- Strong turquoise trend line.

\- Subtle area fill.

\- Extremely subtle gridlines.

\- Neutral surrounding UI.



Axis rules:



\- Week and Month → X axis shows days.

\- Year and All Time → X axis shows months.

\- Time → Y axis shows hours.

\- Completion → Y axis shows percentage.

\- Sessions → Y axis shows number of sessions.



The top Y-axis value is the maximum value reached by a bucket in the selected

period.



For the current incomplete period, show only buckets up to the current local

day/month.



\### Period Navigation



Week:



`< Sep 28 – Oct 4 >`



Weeks are Monday–Sunday.



Month:



`< October >`



Year:



`< 2026 >`



All Time:



No previous/next period control.



\### Consistency Calendar



The UI deliberately exposes only three visual states:



\- Work → turquoise filled circle.

\- Rest → turquoise outlined circle.

\- Neutral → plain date.



Any date that is not Work or Rest is displayed as Neutral.



This includes visually:



\- Missed past days.

\- Today when no work/rest state applies.

\- Future days.



Do not add a fourth visual state unless explicitly requested.



The popup also communicates the number of rest days remaining in the current

week.



\### Session History



One local day is represented by one card.



A single-session day shows the session directly.



A multiple-session day shows:



1\. Daily Summary.

2\. Divider.

3\. Sessions for that day.



Session metrics use:



\- Target.

\- Focused.

\- Completion.



\### Loading



Dashboard loading uses skeleton surfaces with a subtle gray brightness animation.



Do not invent additional loading experiences unless required by the actual

behavior.



\### Empty Period



When the selected period contains no sessions, show:



`No sessions during this period`



`Start a mission and build your consistency.`



Provide a Start Mission action.



This also covers a new user or the beginning of a new week when no session exists

in the current period.



\### Error



If dashboard data cannot be loaded, show:



`Couldn't reach the server.`



`Please try again in a moment.`



Provide a Retry action.



\### Pagination



When another session page is being fetched at the bottom of history, show:



`Loading more...`



aligned with the session-history content.



When no more sessions exist, the final session card is simply followed by normal

page spacing and the end of the page.



No explicit end-of-history message is required.



\## Remaining v0.5 Work



Primary remaining task:



Implement the finished Figma redesign on top of the existing local v0.5

engineering.



During implementation:



\- Preserve established behavior.

\- Preserve backend/frontend responsibility boundaries.

\- Reuse the existing state and API work.

\- Do not rewrite functioning v0.5 engineering solely to fit the redesign.

\- Verify responsive desktop behavior.

\- Verify all interactive states.

\- Compare the implementation against the Figma reference.

\- Fix real discrepancies rather than broadly refactoring.



\## Out of Scope



Unless required to fix a blocking issue:



\- New product areas.

\- Social/friends features.

\- Profile system.

\- Mobile application work.

\- Framework migration.

\- TypeScript migration.

\- Large unrelated refactors.

\- Broad automated-test expansion.



\## Definition of Done



v0.5 is done when:



\- Previous execution is materially easier to understand visually.

\- Consistency feels visible and rewarding.

\- Streak behavior remains predictable.

\- Dashboard calculations remain correct.

\- Plan still makes starting work the obvious primary action.

\- The redesigned states behave coherently.

\- Existing architecture and authentication remain intact.

\- The implementation has been manually verified locally.

\- The version works in production.



After v0.5, shift priority toward:



Users → Observation → Feedback → Iteration



and begin learning automated testing around the highest-value behavior.

