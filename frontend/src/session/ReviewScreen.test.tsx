import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { roomSessionStore } from '../rooms/room-session-state';
import type { RankingEntry, RoomSummary } from '../types/rooms';
import { ReviewScreen } from './ReviewScreen';
import { reviewStore } from './ui-state';

const SUMMARY: RoomSummary = { total_time_seconds: 960, total_sessions: 16, members_count: 3, average_session_time_seconds: 60 };

/** Make a ranking with the given number of members. */
function ranking(count: number): RankingEntry[] {
    return Array.from({ length: count }, /** Make one member of the ranking. */ (_, index) => ({
        position: index + 1, username: `member${index + 1}`, is_you: index === 0, is_owner: index === 0,
        state: 'not_working', session: null, total_time_seconds: 600 * (count - index), sessions_count: 1
    }));
}

/** Return the element that has this selector, or fail the test. */
function find(selector: string): HTMLElement {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing element: ${selector}`);
    return element;
}

/** Tell whether the first element comes before the second one in the page. */
function isBefore(first: Element, second: Element): boolean {
    return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe('Review in a room session', () => {
    beforeEach(() => {
        roomSessionStore.update({ active: true, roomName: 'Fun Room' });
        reviewStore.update({ roomSummary: SUMMARY, roomRanking: { entries: ranking(3), receivedAt: 0 } });
    });

    it('has only the centered room name in the top bar, with no back button and no room menu', () => {
        render(<ReviewScreen />);
        const bar = find('.room-topbar');
        expect(bar.querySelector('.room-title.is-centered')).toHaveTextContent('Fun Room');
        expect(bar.querySelectorAll('button')).toHaveLength(0);
        expect(document.querySelector('#room-back-btn, #room-menu-btn')).toBeNull();
    });

    it('has the structure of the Room screen: top bar, summary cards, then the review card next to the ranking', () => {
        render(<ReviewScreen />);
        expect(find('.screen').classList).toContain('room-screen');
        const container = find('.room-container');
        expect(Array.from(container.children).map(/** Read the class of a child. */ (child) => child.className)).toEqual([
            'room-topbar',
            'room-summary-container',
            expect.stringContaining('room-main-row')
        ]);
        expect(Array.from(find('.room-main-row').children).map(/** Read the class of a child. */ (child) => child.className)).toEqual([
            expect.stringContaining('room-review-card'),
            expect.stringContaining('room-ranking')
        ]);
    });

    it('gives the review card the shell of the Plan card of the Room screen', () => {
        render(<ReviewScreen />);
        const card = find('.room-review-card');
        expect(card.classList).toContain('plan-input-section');
        expect(card.classList).toContain('room-mission-card');
        expect(card.querySelector('#review-finish-btn')).not.toBeNull();
    });

    it('shows the room summary and the ranking', () => {
        render(<ReviewScreen />);
        expect(find('#room-total-time')).toHaveTextContent('16m');
        expect(find('#room-session-count')).toHaveTextContent('16');
        expect(find('#room-people-count')).toHaveTextContent('3');
        expect(find('#room-ranking').querySelectorAll('.room-ranking-row')).toHaveLength(3);
    });

    it('keeps the slot under the average time, with no Beat button in it', () => {
        render(<ReviewScreen />);
        expect(find('.room-summary-footer')).toBeEmptyDOMElement();
        expect(document.querySelector('#room-beat-btn')).toBeNull();
    });

    it('shows dashes and an empty ranking until the room loads', () => {
        reviewStore.update({ roomSummary: null, roomRanking: null });
        render(<ReviewScreen />);
        expect(find('#room-total-time')).toHaveTextContent('—');
        expect(find('#room-ranking').querySelectorAll('.room-ranking-row')).toHaveLength(0);
        expect(find('#room-ranking h2')).toHaveTextContent('Ranking');
    });

    it('piles a long ranking inside the ranking card, so only that card has to scroll', () => {
        reviewStore.update({ roomRanking: { entries: ranking(40), receivedAt: 0 } });
        render(<ReviewScreen />);
        const rows = find('#room-ranking .room-ranking-rows');
        expect(rows.querySelectorAll('.room-ranking-row')).toHaveLength(40);
        expect(isBefore(find('#room-ranking h2'), rows)).toBe(true);
        expect(find('.room-review-card').querySelectorAll('.room-ranking-row')).toHaveLength(0);
    });
});

describe('Review in a personal session', () => {
    it('keeps the wordmark and the centered card, without summary cards or ranking', () => {
        render(<ReviewScreen />);
        expect(find('.screen').classList).toContain('review-screen');
        expect(find('.wordmark')).toHaveTextContent('ExecutionOS');
        expect(find('.review-body .review-container #review-finish-btn')).toBeInstanceOf(HTMLButtonElement);
        expect(document.querySelector('.room-summary-container, #room-ranking, .room-topbar')).toBeNull();
    });
});
