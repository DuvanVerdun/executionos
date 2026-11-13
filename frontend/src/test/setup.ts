import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { authFormStore } from '../auth/forms-state';
import { authStore } from '../auth/state';
import { dashboardStore } from '../dashboard/dashboard';
import { feedbackStore } from '../feedback/feedback';
import { languageStore } from '../i18n/i18n';
import { roomSessionStore } from '../rooms/room-session-state';
import { roomSnapshotCache, roomStore, roomsStore } from '../rooms/state';
import { planDraftStore, sessionStore } from '../session/state';
import { focusStore, reviewStore } from '../session/ui-state';
import { floatingMessageStore } from '../shared/floating-message';
import { screenStore } from '../shared/navigation';
import { userMenuStore } from '../shared/user-menu';
import { streakStore } from '../streak/streak';
import type { Store } from '../lib/store';

/** Functions that put every store back to the state it started with. */
const restorers: (() => void)[] = [];

/** Remember a store's first state so it can be put back before each test. */
function remember<T extends object>(store: Store<T>): void {
    const initial = store.get();
    restorers.push(() => { store.set(initial); });
}

remember(authFormStore);
remember(authStore);
remember(dashboardStore);
remember(feedbackStore);
remember(languageStore);
remember(roomSessionStore);
remember(roomStore);
remember(roomsStore);
remember(planDraftStore);
remember(sessionStore);
remember(focusStore);
remember(reviewStore);
remember(floatingMessageStore);
remember(screenStore);
remember(userMenuStore);
remember(streakStore);

beforeEach(() => {
    restorers.forEach((restore) => { restore(); });
    roomSnapshotCache.clear();
    localStorage.clear();
});

afterEach(() => {
    cleanup();
});

Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: { request: (_name: string, callback: () => unknown) => Promise.resolve(callback()) }
});

if (typeof AbortSignal.timeout !== 'function') {
    AbortSignal.timeout = () => new AbortController().signal;
}

class IntersectionObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
        return [];
    }
}

Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: IntersectionObserverStub });

Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })
});
