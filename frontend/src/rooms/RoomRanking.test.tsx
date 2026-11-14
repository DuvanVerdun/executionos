import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RankingEntry } from '../types/rooms';
import { RoomRanking } from './RoomRanking';

/** Make a member of the ranking, who is not working unless the test says so. */
function member(overrides: Partial<RankingEntry>): RankingEntry {
    return {
        position: 1, username: 'ana', is_you: false, is_owner: false, state: 'not_working', session: null,
        total_time_seconds: 600, sessions_count: 1, ...overrides
    };
}

/** Return the row of a member, or fail the test. */
function rowOf(username: string): HTMLElement {
    const row = screen.getByText(username).closest<HTMLElement>('.room-ranking-row');
    if (!row) throw new Error(`Missing row: ${username}`);
    return row;
}

describe('hovering the row of a member', () => {
    it('shows the mission, the times and the percentage of a member who is working', () => {
        const session = { mission: 'Write the pitch', target_time_seconds: 3600, actual_time_seconds: 1800 };
        render(<RoomRanking ranking={[member({ state: 'working', session })]} />);
        fireEvent.mouseEnter(rowOf('ana'));
        expect(screen.getByRole('tooltip')).toHaveTextContent('Write the pitch');
        expect(screen.getByRole('tooltip')).toHaveTextContent('30:00 / 1:00:00 · 50%');
        fireEvent.mouseLeave(rowOf('ana'));
        expect(screen.queryByRole('tooltip')).toBeNull();
    });

    it('shows only the times when the member does not show missions, and keeps the percentage past the target', () => {
        const session = { mission: null, target_time_seconds: 3600, actual_time_seconds: 5400 };
        render(<RoomRanking ranking={[member({ state: 'paused', session })]} />);
        fireEvent.mouseEnter(rowOf('ana'));
        expect(screen.getByRole('tooltip')).toHaveTextContent('1:30:00 / 1:00:00 · 150%');
        expect(screen.getByRole('tooltip').querySelectorAll('p')).toHaveLength(1);
    });

    it('shows nothing for a member who is not working', () => {
        render(<RoomRanking ranking={[member({})]} />);
        fireEvent.mouseEnter(rowOf('ana'));
        expect(screen.queryByRole('tooltip')).toBeNull();
    });
});

describe('the ring of a member with a session', () => {
    it('keeps its progress while paused, and turns white over the teal after the target', () => {
        const session = { mission: null, target_time_seconds: 3600, actual_time_seconds: 5400 };
        render(<RoomRanking ranking={[member({ state: 'paused', session })]} />);
        const ring = screen.getByRole('img', { name: 'Paused' });
        expect(ring.style.getPropertyValue('--ring-pct')).toBe('100%');
        expect(ring.style.getPropertyValue('--ring-over')).toBe('50%');
    });
});
