import type { LiveSession, MemberState } from '../types/rooms';

/** The time a member has worked now. A running session goes on counting from the answer, and a paused one stays where it was. */
export function workedSeconds(session: LiveSession, state: MemberState, secondsSinceAnswer: number): number {
    return session.actual_time_seconds + (state === 'working' ? secondsSinceAnswer : 0);
}

/** How much of a ring each color fills, in percent: teal up to the target, then white over the teal after it. */
export function ringFill(worked: number, target: number): { filled: number; over: number } {
    if (target <= 0) return { filled: 0, over: 0 };
    const percentage = worked / target * 100;
    return { filled: Math.min(percentage, 100), over: Math.min(Math.max(percentage - 100, 0), 100) };
}
