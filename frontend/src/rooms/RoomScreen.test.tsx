import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { RankingEntry, RoomSnapshot } from '../types/rooms';
import { RoomScreen } from './RoomScreen';
import { roomStore } from './state';

/** Make a ranking with the given number of members. */
function ranking(count: number): RankingEntry[] {
    return Array.from({ length: count }, /** Make one member of the ranking. */ (_, index) => ({
        position: index + 1, username: `member${index + 1}`, is_you: index === 0, is_owner: index === 0,
        state: 'not_working', ring_percentage: null, total_time_seconds: 600 * (count - index), sessions_count: 1
    }));
}

/** Make a room snapshot with the given number of members in its ranking. */
function snapshot(count: number): RoomSnapshot {
    return {
        room: { id: 3, name: 'Team', is_owner: true, show_missions: true },
        summary: { total_time_seconds: 0, total_sessions: 0, members_count: count, average_session_time_seconds: null },
        ranking: ranking(count)
    };
}

/** Return the element that has this selector, or fail the test. */
function find(selector: string): HTMLElement {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing element: ${selector}`);
    return element;
}

beforeEach(() => {
    roomStore.update({ roomId: 3, view: 'ready', snapshot: snapshot(3) });
});

describe('the Room screen layout', () => {
    it('puts the plan card first and the ranking next to it, in one row', () => {
        render(<RoomScreen />);
        const row = find('#room-data .room-main-row');
        expect(Array.from(row.children).map(/** Read the class of a child. */ (child) => child.className)).toEqual([
            expect.stringContaining('room-mission-card'),
            expect.stringContaining('room-ranking')
        ]);
    });

    it('keeps the ranking out of the plan card and the plan card out of the ranking', () => {
        render(<RoomScreen />);
        expect(find('#room-data .room-mission-card').querySelector('#room-ranking')).toBeNull();
        expect(find('#room-data #room-ranking').querySelector('#room-mission-input')).toBeNull();
    });

    it('keeps the summary above the row and the history below it', () => {
        render(<RoomScreen />);
        const row = find('#room-data .room-main-row');
        const summary = find('.room-summary-container');
        const history = find('#room-history');
        expect(summary.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(row.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('piles every member of a long ranking in the right column', () => {
        roomStore.update({ snapshot: snapshot(40) });
        render(<RoomScreen />);
        const column = find('#room-data #room-ranking');
        expect(column.querySelectorAll('.room-ranking-row')).toHaveLength(40);
        expect(find('#room-data .room-mission-card').querySelectorAll('.room-ranking-row')).toHaveLength(0);
    });

    it('has the title Ranking inside the ranking card, before the members, without the member count', () => {
        render(<RoomScreen />);
        const card = find('#room-data #room-ranking');
        const title = card.querySelector('h2');
        expect(title).toHaveTextContent(/^Ranking$/);
        expect((title?.compareDocumentPosition(find('#room-data .room-ranking-row')) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(card).not.toHaveTextContent('Members of this room');
    });

    it('draws the loading placeholders in the same row, plan card first', () => {
        roomStore.update({ view: 'loading', snapshot: null });
        render(<RoomScreen />);
        const row = find('#room-loading .room-main-row');
        expect(Array.from(row.children).map(/** Read the class of a child. */ (child) => child.className)).toEqual([
            expect.stringContaining('room-skeleton-mission'),
            expect.stringContaining('room-skeleton-ranking')
        ]);
    });
});
