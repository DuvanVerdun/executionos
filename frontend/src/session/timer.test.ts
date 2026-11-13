import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionStore, updateActiveSession } from './state';
import { catchUpTimer, pauseSession, resetSessionState, resumeSession, startTimer, stopSession } from './timer';

const START = new Date('2026-11-09T12:00:00Z');

/** Start a session of the given target at the fake "now". */
function beginSession(targetTimeSeconds: number): void {
    updateActiveSession({ currentMission: 'Write', targetTimeSeconds, startTimestamp: new Date().toISOString() });
    startTimer();
}

/** Read the number of seconds that Focus shows. */
function shown(): number {
    return sessionStore.get().active.actualTimeSeconds;
}

/** Read the active session as the browser saved it. */
function saved(): { actualTimeSeconds: number; pauseStartTimestamp: string } {
    return JSON.parse(localStorage.getItem('executionOS_activeSession') ?? '{}') as { actualTimeSeconds: number; pauseStartTimestamp: string };
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
});

afterEach(() => {
    resetSessionState();
    vi.useRealTimers();
});

describe('the timer', () => {
    it('counts elapsed time from the clock, once a second', () => {
        beginSession(600);
        vi.advanceTimersByTime(5500);
        expect(shown()).toBe(5);
    });

    it('does not depend on how many ticks happened', () => {
        beginSession(600);
        vi.setSystemTime(new Date(START.getTime() + 30_000));
        vi.advanceTimersByTime(1100);
        expect(shown()).toBe(31);
    });

    it('keeps the completion percentage with the elapsed time', () => {
        beginSession(100);
        vi.advanceTimersByTime(25_500);
        expect(sessionStore.get().active.percentageCompleted).toBe(25);
    });

    it('saves the running session in the browser on every tick', () => {
        beginSession(600);
        vi.advanceTimersByTime(2500);
        expect(saved().actualTimeSeconds).toBe(2);
    });

    it('does not count the time spent paused', () => {
        beginSession(600);
        vi.advanceTimersByTime(10_000);
        pauseSession();
        expect(sessionStore.get().active.isTimerRunning).toBe(false);
        vi.advanceTimersByTime(20_000);
        resumeSession();
        expect(sessionStore.get().active.pausedTimeSeconds).toBe(20);
        vi.advanceTimersByTime(5500);
        expect(shown()).toBe(15);
    });

    it('stops ticking after a pause', () => {
        beginSession(600);
        vi.advanceTimersByTime(3000);
        pauseSession();
        vi.advanceTimersByTime(10_000);
        expect(shown()).toBe(3);
    });

    it('marks the session completed when it stops at or past the target', () => {
        beginSession(10);
        vi.advanceTimersByTime(12_000);
        stopSession();
        const { active } = sessionStore.get();
        expect(active.completionStatus).toBe('completed');
        expect(active.isTimerRunning).toBe(false);
        expect(active.pauseStartTimestamp).not.toBe('');
    });

    it('keeps the session partial when it stops before the target', () => {
        beginSession(600);
        vi.advanceTimersByTime(4000);
        stopSession();
        expect(sessionStore.get().active.completionStatus).toBe('partial');
        expect(shown()).toBe(4);
    });

    it('clears the mission and the time when reset', () => {
        beginSession(600);
        resetSessionState();
        expect(sessionStore.get().active).toMatchObject({ currentMission: '', targetTimeSeconds: 0, actualTimeSeconds: 0, isTimerRunning: false });
    });

    it('stops the timer when reset, so nothing ticks into the next session', () => {
        beginSession(600);
        resetSessionState();
        vi.advanceTimersByTime(5000);
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe('the number on screen and the clock', () => {
    it('shows each second as it starts, not up to a second late', () => {
        beginSession(600);
        vi.advanceTimersByTime(1004);
        expect(shown()).toBe(0);
        vi.advanceTimersByTime(2);
        expect(shown()).toBe(1);
    });

    it('changes at the real second even when the pauses had a fractional length', () => {
        beginSession(600);
        vi.advanceTimersByTime(10_400);
        pauseSession();
        vi.advanceTimersByTime(300);
        resumeSession();
        vi.advanceTimersByTime(590);
        expect(shown()).toBe(10);
        vi.advanceTimersByTime(20);
        expect(shown()).toBe(11);
    });

    it('shows the time of the pause moment, so Stop shows the same number', () => {
        beginSession(600);
        vi.advanceTimersByTime(11_002);
        pauseSession();
        expect(shown()).toBe(11);
        stopSession();
        expect(shown()).toBe(11);
    });

    it('gives Review the same number that Focus showed, at any moment of the second', () => {
        for (const stopAtMs of [10_100, 10_450, 10_900, 10_990]) {
            beginSession(600);
            vi.advanceTimersByTime(4300);
            pauseSession();
            vi.advanceTimersByTime(700);
            resumeSession();
            vi.advanceTimersByTime(stopAtMs - 5000);
            const onFocus = shown();
            stopSession();
            expect(shown()).toBe(onFocus);
            resetSessionState();
            vi.setSystemTime(START);
        }
    });

    it('keeps the number right through many quick pauses and resumes', () => {
        beginSession(600);
        vi.advanceTimersByTime(10_000);
        let runningMs = 10_000;
        for (let round = 0; round < 6; round += 1) {
            pauseSession();
            expect(shown()).toBe(Math.floor(runningMs / 1000));
            vi.advanceTimersByTime(500);
            resumeSession();
            vi.advanceTimersByTime(500);
            runningMs += 500;
        }
        vi.advanceTimersByTime(300);
        stopSession();
        expect(shown()).toBe(Math.floor((runningMs + 300) / 1000));
    });

    it('catches up at once when the page was asleep, and keeps counting after that', () => {
        beginSession(600);
        vi.setSystemTime(new Date(START.getTime() + 120_000));
        catchUpTimer();
        expect(shown()).toBe(120);
        vi.advanceTimersByTime(1100);
        expect(shown()).toBe(121);
    });

    it('does nothing when it catches up while paused', () => {
        beginSession(600);
        vi.advanceTimersByTime(3000);
        pauseSession();
        vi.setSystemTime(new Date(Date.now() + 60_000));
        catchUpTimer();
        expect(shown()).toBe(3);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('never shows a negative time, for example when the clock moved back', () => {
        beginSession(600);
        vi.setSystemTime(new Date(START.getTime() - 5000));
        catchUpTimer();
        expect(shown()).toBe(0);
    });
});

describe('saving and resuming', () => {
    it('saves the session when it starts, before the first tick', () => {
        beginSession(600);
        expect(saved().actualTimeSeconds).toBe(0);
    });

    it('saves the session when it resumes, so a reload right after loses nothing', () => {
        beginSession(600);
        vi.advanceTimersByTime(4300);
        pauseSession();
        vi.advanceTimersByTime(2000);
        resumeSession();
        expect(saved().pauseStartTimestamp).toBe('');
        expect(saved().actualTimeSeconds).toBe(4);
    });

    it('saves the session when it stops', () => {
        beginSession(600);
        vi.advanceTimersByTime(4500);
        stopSession();
        expect(saved().actualTimeSeconds).toBe(4);
        expect(saved().pauseStartTimestamp).not.toBe('');
    });

    it('does not turn the time into NaN when the pause moment is missing', () => {
        beginSession(600);
        vi.advanceTimersByTime(2000);
        pauseSession();
        updateActiveSession({ pauseStartTimestamp: '' });
        resumeSession();
        expect(Number.isFinite(sessionStore.get().active.pausedTimeSeconds)).toBe(true);
        expect(Number.isFinite(shown())).toBe(true);
    });

    it('does nothing when pause is called on a session that is not running', () => {
        beginSession(600);
        vi.advanceTimersByTime(2000);
        pauseSession();
        const pausedAt = sessionStore.get().active.pauseStartTimestamp;
        vi.advanceTimersByTime(5000);
        pauseSession();
        expect(sessionStore.get().active.pauseStartTimestamp).toBe(pausedAt);
    });

    it('never runs two timers at once, even when started twice', () => {
        beginSession(600);
        startTimer();
        expect(vi.getTimerCount()).toBe(1);
    });
});
