import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { fakeBackendByPath, requestedPaths } from '../test/network';
import { ConfirmModal } from './ConfirmModal';
import { SessionMenu } from './SessionCard';

/** Draw a session menu, already open, with the confirm modal beside it. */
function renderMenu(reload: () => Promise<void>) {
    render(
        <>
            <SessionMenu sessionId={5} screen="dashboard" isOpen onToggle={vi.fn()} reload={reload} />
            <ConfirmModal />
        </>
    );
}

describe('deleting a session', () => {
    it('asks in the modal first, and sends nothing when the user cancels', async () => {
        const fake = fakeBackendByPath(() => ({ status: 200, body: { success: true } }));
        const reload = vi.fn(() => Promise.resolve());
        renderMenu(reload);
        await userEvent.click(screen.getByRole('button', { name: 'Delete Session' }));
        expect(await screen.findByRole('alertdialog')).toHaveTextContent('Delete this session?');
        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(fake).not.toHaveBeenCalled();
        expect(reload).not.toHaveBeenCalled();
    });

    it('deletes the session and reloads when the user confirms', async () => {
        const fake = fakeBackendByPath(() => ({ status: 200, body: { success: true } }));
        const reload = vi.fn(() => Promise.resolve());
        renderMenu(reload);
        await userEvent.click(screen.getByRole('button', { name: 'Delete Session' }));
        const dialog = await screen.findByRole('alertdialog');
        const confirmButton = Array.from(dialog.querySelectorAll('button')).find(/** Find the button that confirms. */ (button) => button.id === 'confirm-accept-btn');
        if (!confirmButton) throw new Error('The confirm button is missing.');
        await userEvent.click(confirmButton);
        await vi.waitFor(() => { expect(reload).toHaveBeenCalledOnce(); });
        expect(requestedPaths(fake)).toEqual(['delete-session/5']);
    });
});
