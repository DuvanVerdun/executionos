import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DashboardData } from '../types/dashboard';
import { dashboardStore } from './dashboard';
import { DashboardScreen } from './DashboardScreen';

const DATA: DashboardData = {
    period: { type: 'week', anchor_date: '2026-11-09', start_date: '2026-11-09', end_date: '2026-11-15' },
    summary: { total_time_seconds: 5400, total_sessions: 3, days_worked: 2, average_session_time_seconds: 1800 },
    trend: []
};

beforeEach(() => {
    dashboardStore.update({ surface: 'data', data: DATA });
});

describe('the stat cards of the Dashboard', () => {
    it('show the time focused, the sessions, the days worked and the average session time, in that order', () => {
        render(<DashboardScreen />);
        const labels = Array.from(document.querySelectorAll('#dashboard-summary-container .dashboard-summary-label'));
        expect(labels.map(/** Read the label of a card. */ (label) => label.textContent)).toEqual([
            'Focused', 'Sessions', 'Days Worked', 'Avg. Session Time'
        ]);
    });

    it('show how many days of the period have a session', () => {
        render(<DashboardScreen />);
        expect(document.getElementById('dashboard-days-worked-display')).toHaveTextContent('2');
    });

    it.each([
        [42, '42s'],
        [90, '1m']
    ] as const)('show an average session time of %i seconds as %s', (seconds, text) => {
        dashboardStore.update({ data: { ...DATA, summary: { ...DATA.summary, average_session_time_seconds: seconds } } });
        render(<DashboardScreen />);
        expect(document.getElementById('dashboard-average-session-time-display')).toHaveTextContent(text);
    });

    it('show 0 days worked when the period has no sessions', () => {
        dashboardStore.update({ data: { ...DATA, summary: { ...DATA.summary, total_sessions: 0, days_worked: 0, average_session_time_seconds: null } } });
        render(<DashboardScreen />);
        expect(document.getElementById('dashboard-days-worked-display')).toHaveTextContent('0');
        expect(screen.queryByText('Avg. Completion')).toBeNull();
    });
});
