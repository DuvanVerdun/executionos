// Entry point: connects every feature in a fixed order, then starts the app.

import { registerNavigationHooks } from './app/hooks.js';
import { initStartup, initializeApp, routeToInitialScreen } from './app/startup.js';
import { initAuthForms } from './auth/forms.js';
import { initDashboard } from './dashboard/dashboard.js';
import { initFeedback } from './feedback/feedback.js';
import { initRoomScreen } from './rooms/room-screen.js';
import { initRoomSession } from './rooms/room-session.js';
import { initRoomsScreen } from './rooms/rooms-screen.js';
import { initFocus } from './session/focus.js';
import { initPlan } from './session/plan.js';
import { initReview } from './session/review.js';
import { initSync } from './session/sync.js';
import { initUserMenu } from './shared/user-menu.js';
import { initStreak } from './streak/calendar.js';

registerNavigationHooks();
initStartup();
initSync();
initPlan();
initFocus();
initReview();
initAuthForms(routeToInitialScreen);
initUserMenu();
initStreak();
initDashboard();
initFeedback();
initRoomsScreen();
initRoomScreen();
initRoomSession();
document.addEventListener('DOMContentLoaded', /** Initialize the application after the document is ready. */ async () => {
    await initializeApp();
});
