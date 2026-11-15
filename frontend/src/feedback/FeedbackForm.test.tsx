import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { closeFeedbackForm, feedbackStore, openFeedbackForm } from './feedback';
import { FeedbackForm } from './FeedbackForm';

/** Open the form the way the account menu does. */
function open(): void {
    act(() => { openFeedbackForm('plan'); });
}

describe('the feedback form', () => {
    it('shows nothing while it is closed', () => {
        render(<FeedbackForm />);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('opens as a form modal: a titled card with a close button, a labelled text box, and one button', () => {
        render(<FeedbackForm />);
        open();
        const dialog = screen.getByRole('dialog', { name: 'Send Feedback' });
        expect(dialog).toHaveClass('modal-card');
        expect(dialog.closest('.modal-overlay')).not.toBeNull();
        expect(screen.getByRole('button', { name: 'Close feedback form' })).toBeInTheDocument();
        expect(screen.getByLabelText('Your feedback')).toBeInstanceOf(HTMLTextAreaElement);
        expect(screen.getByRole('button', { name: 'Send Feedback' })).toHaveAttribute('type', 'submit');
    });

    it('puts the focus in the text box', () => {
        render(<FeedbackForm />);
        open();
        expect(screen.getByLabelText('Your feedback')).toHaveFocus();
    });

    it('closes with the close button, with Escape, and by clicking outside the card', async () => {
        render(<FeedbackForm />);
        open();
        await userEvent.click(screen.getByRole('button', { name: 'Close feedback form' }));
        expect(feedbackStore.get().isOpen).toBe(false);

        open();
        await userEvent.keyboard('{Escape}');
        expect(feedbackStore.get().isOpen).toBe(false);

        open();
        const overlay = screen.getByRole('dialog').closest('.modal-overlay');
        if (!overlay) throw new Error('Missing overlay');
        await userEvent.click(overlay);
        expect(feedbackStore.get().isOpen).toBe(false);
    });

    it('stays open when the click is inside the card', async () => {
        render(<FeedbackForm />);
        open();
        await userEvent.click(screen.getByRole('dialog'));
        expect(feedbackStore.get().isOpen).toBe(true);
    });

    it('keeps the text that was not sent when it is closed and opened again', () => {
        render(<FeedbackForm />);
        open();
        fireEvent.change(screen.getByLabelText('Your feedback'), { target: { value: 'Half written' } });
        act(() => { closeFeedbackForm(); });
        open();
        expect(screen.getByLabelText('Your feedback')).toHaveValue('Half written');
    });

    it('asks for a message when the text box is empty, and marks it as invalid', async () => {
        render(<FeedbackForm />);
        open();
        await userEvent.click(screen.getByRole('button', { name: 'Send Feedback' }));
        expect(await screen.findByText('Write a message before sending.')).toBeInTheDocument();
        expect(screen.getByLabelText('Your feedback')).toBeInvalid();
    });
});
