import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { streakCelebrationStore } from './celebration';
import { StreakScreen } from './StreakScreen';

/** Show a celebration on the screen, and return the function it runs on Continue. */
function celebrate(from: number, to: number): () => void {
    const onContinue = vi.fn();
    streakCelebrationStore.set({ celebration: { from, to, pledge: { say: (nextDay) => `Pledge for day ${nextDay}` }, onContinue } });
    return onContinue;
}

/** Read the digits of the number: what each place shows, and the digit it rolls away from. */
function placesOnScreen(): { digit: string | null; previous: string | null; place: string }[] {
    return Array.from(document.querySelectorAll<HTMLElement>('.streak-digit')).map(/** Read one place. */ (place) => ({
        digit: place.querySelector('span:not(.streak-digit-previous)')?.textContent ?? null,
        previous: place.querySelector('.streak-digit-previous')?.textContent ?? null,
        place: place.style.getPropertyValue('--place')
    }));
}

describe('the number of the streak screen', () => {
    it('is named by the new streak, for a screen reader', () => {
        celebrate(19, 20);
        render(<StreakScreen />);
        expect(screen.getByRole('img', { name: '20' })).toBeInTheDocument();
    });

    it('rolls every digit that changes, the units as place 0 and the tens right after as place 1', () => {
        celebrate(19, 20);
        render(<StreakScreen />);
        expect(placesOnScreen()).toEqual([
            { digit: '2', previous: '1', place: '1' },
            { digit: '0', previous: '9', place: '0' }
        ]);
    });

    it('leaves a digit that does not change where it is', () => {
        celebrate(10, 11);
        render(<StreakScreen />);
        expect(placesOnScreen()).toEqual([
            { digit: '1', previous: null, place: '1' },
            { digit: '1', previous: '0', place: '0' }
        ]);
    });

    it('rolls 0 into 1', () => {
        celebrate(0, 1);
        render(<StreakScreen />);
        expect(placesOnScreen()).toEqual([{ digit: '1', previous: '0', place: '0' }]);
    });

    it('brings in a new place with nothing to roll away from, when the streak gets another digit', () => {
        celebrate(9, 10);
        render(<StreakScreen />);
        expect(placesOnScreen()).toEqual([
            { digit: '1', previous: '', place: '1' },
            { digit: '0', previous: '9', place: '0' }
        ]);
    });
});

describe('the words of the streak screen', () => {
    it('names the streak, and puts each sentence of the message on its own line', () => {
        celebrate(19, 20);
        render(<StreakScreen />);
        expect(screen.getByText('day streak')).toBeInTheDocument();
        const lines = Array.from(document.querySelectorAll('.streak-message p'));
        expect(lines.map(/** Read one line. */ (line) => line.textContent)).toEqual([
            'You showed up again.', 'Come back tomorrow for day 21.'
        ]);
    });

    it('says that day 1 is done when the streak starts', () => {
        celebrate(0, 1);
        render(<StreakScreen />);
        const lines = Array.from(document.querySelectorAll('.streak-message p'));
        expect(lines.map(/** Read one line. */ (line) => line.textContent)).toEqual([
            'Day 1 is done.', 'Come back tomorrow for day 2.'
        ]);
    });

    it('puts the number before the flame, in one row', () => {
        celebrate(3, 4);
        render(<StreakScreen />);
        const row = document.querySelector('.streak-hero');
        expect(Array.from(row?.children ?? []).map(/** Read the class of a child. */ (child) => child.className)).toEqual(['streak-number', 'streak-flame']);
    });

    it('puts the pledge that was picked on the button, for the next day, and runs what the caller gave when it is clicked', async () => {
        const onContinue = celebrate(3, 4);
        render(<StreakScreen />);
        await userEvent.click(screen.getByRole('button', { name: 'Pledge for day 5' }));
        expect(onContinue).toHaveBeenCalledOnce();
    });

    it('draws nothing without a celebration', () => {
        const { container } = render(<StreakScreen />);
        expect(container).toBeEmptyDOMElement();
    });
});
