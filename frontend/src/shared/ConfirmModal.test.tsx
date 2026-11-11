import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { confirmAction, confirmStore } from './confirm';
import { ConfirmModal } from './ConfirmModal';

/** Ask a question in the modal and return the promise of the answer. */
function ask(): Promise<boolean> {
    let answer: Promise<boolean> = Promise.resolve(false);
    act(() => { answer = confirmAction({ message: 'Delete this?', confirmLabel: 'Delete' }); });
    return answer;
}

describe('the confirm modal', () => {
    it('shows nothing until a question is asked', () => {
        render(<ConfirmModal />);
        expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('shows the question, a Cancel button and the confirm button', async () => {
        render(<ConfirmModal />);
        void ask();
        expect(await screen.findByRole('alertdialog')).toHaveTextContent('Delete this?');
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it('puts the focus on Cancel, so Enter cannot confirm by accident', async () => {
        render(<ConfirmModal />);
        void ask();
        expect(await screen.findByRole('button', { name: 'Cancel' })).toHaveFocus();
    });

    it('answers true and closes when the user confirms', async () => {
        render(<ConfirmModal />);
        const answer = ask();
        await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
        await expect(answer).resolves.toBe(true);
        expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('answers false and closes when the user cancels', async () => {
        render(<ConfirmModal />);
        const answer = ask();
        await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
        await expect(answer).resolves.toBe(false);
        expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('answers false when the user presses Escape', async () => {
        render(<ConfirmModal />);
        const answer = ask();
        await screen.findByRole('alertdialog');
        await userEvent.keyboard('{Escape}');
        await expect(answer).resolves.toBe(false);
    });

    it('answers false when the user clicks outside the card', async () => {
        render(<ConfirmModal />);
        const answer = ask();
        await screen.findByRole('alertdialog');
        const overlay = document.getElementById('confirm-overlay');
        if (!overlay) throw new Error('The overlay is missing.');
        await userEvent.click(overlay);
        await expect(answer).resolves.toBe(false);
    });

    it('does not close when the user clicks inside the card', async () => {
        render(<ConfirmModal />);
        void ask();
        await userEvent.click(await screen.findByText('Delete this?'));
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
});

describe('confirmAction', () => {
    it('cancels the question that was open when a new one is asked', async () => {
        const first = confirmAction({ message: 'First?', confirmLabel: 'Yes' });
        void confirmAction({ message: 'Second?', confirmLabel: 'Yes' });
        await expect(first).resolves.toBe(false);
        expect(confirmStore.get().request?.message).toBe('Second?');
    });
});
