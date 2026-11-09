// Entry point: connects every feature in a fixed order, then starts the app.

import { registerNavigationHooks } from './app/hooks';
import { initStartup, initializeApp, routeToInitialScreen } from './app/startup';
import { initAuthForms } from './auth/forms';
import { initDashboard } from './dashboard/dashboard';
import { initFeedback } from './feedback/feedback';
import { initRoomScreen } from './rooms/room-screen';
import { initRoomSession } from './rooms/room-session';
import { initRoomsScreen } from './rooms/rooms-screen';
import { initFocus } from './session/focus';
import { initPlan } from './session/plan';
import { initReview } from './session/review';
import { initSync } from './session/sync';
import { initUserMenu } from './shared/user-menu';
import { initStreak } from './streak/calendar';

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
