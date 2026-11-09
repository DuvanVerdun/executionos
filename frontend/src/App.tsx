import { useLayoutEffect } from 'react';
import { LoadingScreen } from './app/LoadingScreen';
import { LoginScreen } from './auth/LoginScreen';
import { RegisterScreen } from './auth/RegisterScreen';
import { DashboardScreen } from './dashboard/DashboardScreen';
import { FeedbackForm } from './feedback/FeedbackForm';
import { useDocumentEvent } from './hooks/useDocumentEvent';
import { useStore } from './lib/store';
import { handleRoomSessionGesture } from './rooms/checkin-sound';
import { CheckinModal } from './rooms/CheckinModal';
import { RoomScreen } from './rooms/RoomScreen';
import { RoomsScreen } from './rooms/RoomsScreen';
import { FocusScreen } from './session/FocusScreen';
import { PlanScreen } from './session/PlanScreen';
import { ReviewScreen } from './session/ReviewScreen';
import { FloatingMessage } from './shared/FloatingMessage';
import { screenStore } from './shared/navigation';

/** Draw the screen that shows now, and the parts that every screen shares. */
export function App() {
    const { screen } = useStore(screenStore);

    useLayoutEffect(() => {
        document.body.dataset.screen = screen;
    }, [screen]);

    useDocumentEvent('pointerdown', handleRoomSessionGesture);
    useDocumentEvent('keydown', handleRoomSessionGesture);

    return (
        <>
            {screen === 'loading' && <LoadingScreen />}
            {screen === 'register' && <RegisterScreen />}
            {screen === 'login' && <LoginScreen />}
            {screen === 'plan' && <PlanScreen />}
            {screen === 'focus' && <FocusScreen />}
            {screen === 'review' && <ReviewScreen />}
            {screen === 'dashboard' && <DashboardScreen />}
            {screen === 'rooms' && <RoomsScreen />}
            {screen === 'room' && <RoomScreen />}
            <FeedbackForm />
            <CheckinModal />
            <FloatingMessage />
        </>
    );
}
