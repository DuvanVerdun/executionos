import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MissionCard } from './MissionCard';
import type { MissionValidationError } from './plan';

/** A small page that holds the mission card's state, the way the real screens do. */
function Harness({ error = null, onStart = vi.fn() }: { error?: MissionValidationError | null; onStart?: () => void }) {
    const [mission, setMission] = useState('');
    const [targetTime, setTargetTime] = useState('00:00');
    const missionRef = useRef<HTMLInputElement>(null);
    const timeRef = useRef<HTMLInputElement>(null);
    return (
        <MissionCard
            idPrefix="plan" className="card" mission={mission} targetTime={targetTime} error={error}
            missionInputRef={missionRef} targetTimeInputRef={timeRef}
            onMissionChange={setMission} onTargetTimeChange={setTargetTime} onStart={onStart}
        />
    );
}

/** Find the focus time box. */
function timeBox(): HTMLInputElement {
    const input = document.querySelector<HTMLInputElement>('#plan-target-time-input');
    if (!input) throw new Error('The focus time box is missing.');
    return input;
}

describe('MissionCard focus time box', () => {
    it('replaces the digit before the cursor when a digit is typed', async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await user.click(timeBox());
        timeBox().setSelectionRange(2, 2);
        await user.keyboard('5');
        expect(timeBox().value).toBe('05:00');
    });

    it('skips the colon: typing at the end changes the last minute digit', async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await user.click(timeBox());
        timeBox().setSelectionRange(5, 5);
        await user.keyboard('7');
        expect(timeBox().value).toBe('00:07');
    });

    it('puts a zero back when Backspace is pressed', async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await user.click(timeBox());
        timeBox().setSelectionRange(5, 5);
        await user.keyboard('2');
        timeBox().setSelectionRange(5, 5);
        await user.keyboard('{Backspace}');
        expect(timeBox().value).toBe('00:00');
    });

    it('keeps the cursor next to the digit that changed', async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await user.click(timeBox());
        timeBox().setSelectionRange(5, 5);
        await user.keyboard('3');
        expect(timeBox().selectionStart).toBe(5);
    });

    it('does nothing when the cursor is at the very start', async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await user.click(timeBox());
        timeBox().setSelectionRange(0, 0);
        await user.keyboard('4');
        expect(timeBox().value).toBe('00:00');
    });
});

describe('MissionCard', () => {
    it('limits the mission to 50 characters in the box', () => {
        render(<Harness />);
        expect(document.getElementById('plan-mission-input')).toHaveAttribute('maxlength', '50');
    });

    it('shows a mission error under the mission box and marks it invalid', () => {
        render(<Harness error={{ field: 'mission', message: 'Enter your mission.' }} />);
        expect(screen.getByText('Enter your mission.')).toHaveAttribute('id', 'plan-mission-error');
        expect(document.getElementById('plan-mission-input')).toHaveAttribute('aria-invalid', 'true');
        expect(document.getElementById('plan-target-time-input')).not.toHaveAttribute('aria-invalid');
    });

    it('shows a time error under the time box only', () => {
        render(<Harness error={{ field: 'targetTime', message: 'Choose a focus time greater than zero.' }} />);
        expect(screen.getByText('Choose a focus time greater than zero.')).toHaveAttribute('id', 'plan-time-error');
        expect(document.getElementById('plan-mission-error')).toBeEmptyDOMElement();
    });

    it('calls onStart when Start Work is clicked', async () => {
        const onStart = vi.fn();
        render(<Harness onStart={onStart} />);
        await userEvent.click(screen.getByRole('button', { name: 'Start Work' }));
        expect(onStart).toHaveBeenCalledOnce();
    });

    it('does not let the user press Start Work when it is disabled', () => {
        render(
            <MissionCard
                idPrefix="room" className="card" mission="" targetTime="00:00" error={null}
                missionInputRef={createRef()} targetTimeInputRef={createRef()}
                onMissionChange={vi.fn()} onTargetTimeChange={vi.fn()} onStart={vi.fn()} startDisabled
            />
        );
        expect(screen.getByRole('button', { name: 'Start Work' })).toBeDisabled();
    });
});
