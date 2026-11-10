import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionStore, updateActiveSession } from './state';
import { pauseSession, resetSessionState, resumeSession, startTimer, stopSession } from './timer';

const START = new Date('2026-11-09T12:00:00Z');

/** Start a session of the given target at the fake "now". */
function beginSession(targetTimeSeconds: number): void {
    updateActiveSession({ currentMission: 'Write', targetTimeSeconds, startTimestamp: new Date().toISOString() });
    startTimer();
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
});

afterEach(() => {
    pauseSession();
    vi.useRealTimers();
});

describe('the timer', () => {
    it('counts elapsed time from the clock, once a second', () => {
        beginSession(600);
        vi.advanceTimersByTime(5000);
        expect(sessionStore.get().active.actualTimeSeconds).toBe(5);
    });

    it('does not depend on how many ticks happened', () => {
        beginSession(600);
        vi.setSystemTime(new Date(START.getTime() + 30_000));
        vi.advanceTimersByTime(1000);
        expect(sessionStore.get().active.actualTimeSeconds).toBe(31);
    });

    it('keeps the completion percentage with the elapsed time', () => {
        beginSession(100);
        vi.advanceTimersByTime(25_000);
        expect(sessionStore.get().active.percentageCompleted).toBe(25);
    });

    it('saves the running session in the browser on every tick', () => {
        beginSession(600);
        vi.advanceTimersByTime(2000);
        const saved = JSON.parse(localStorage.getItem('executionOS_activeSession') ?? '{}') as { actualTimeSeconds?: number };
        expect(saved.actualTimeSeconds).toBe(2);
    });

    it('does not count the time spent paused', () => {
        beginSession(600);
        vi.advanceTimersByTime(10_000);
        pauseSession();
        expect(sessionStore.get().active.isTimerRunning).toBe(false);
        vi.advanceTimersByTime(20_000);
        resumeSession();
        expect(sessionStore.get().active.pausedTimeSeconds).toBe(20);
        vi.advanceTimersByTime(5000);
        expect(sessionStore.get().active.actualTimeSeconds).toBe(15);
    });

    it('stops ticking after a pause', () => {
        beginSession(600);
        vi.advanceTimersByTime(3000);
        pauseSession();
        vi.advanceTimersByTime(10_000);
        expect(sessionStore.get().active.actualTimeSeconds).toBe(3);
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
        expect(sessionStore.get().active.actualTimeSeconds).toBe(4);
    });

    it('clears the mission and the time when reset', () => {
        beginSession(600);
        resetSessionState();
        expect(sessionStore.get().active).toMatchObject({ currentMission: '', targetTimeSeconds: 0, actualTimeSeconds: 0, isTimerRunning: false });
    });
});
