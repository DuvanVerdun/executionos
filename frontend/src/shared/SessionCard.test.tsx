import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBackendByPath, jsonBodyOf, pathOf, requestedPaths } from '../test/network';
import { ConfirmModal } from './ConfirmModal';
import { SessionMenu } from './SessionCard';

/** Draw a session menu, already open, with the confirm modal beside it. Return the functions it calls. */
function renderMenu() {
    const reload = vi.fn(() => Promise.resolve());
    const onMissionChanged = vi.fn();
    const onToggle = vi.fn();
    render(
        <>
            <SessionMenu sessionId={5} mission="write tests" screen="dashboard" isOpen onToggle={onToggle} onMissionChanged={onMissionChanged} reload={reload} />
            <ConfirmModal />
        </>
    );
    return { reload, onMissionChanged, onToggle };
}

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('deleting a session', () => {
    it('asks in the modal first, and sends nothing when the user cancels', async () => {
        const fake = fakeBackendByPath(() => ({ status: 200, body: { success: true } }));
        const { reload } = renderMenu();
        await userEvent.click(screen.getByRole('button', { name: 'Delete Session' }));
        expect(await screen.findByRole('alertdialog')).toHaveTextContent('Delete this session?');
        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(fake).not.toHaveBeenCalled();
        expect(reload).not.toHaveBeenCalled();
    });

    it('deletes the session and reloads when the user confirms', async () => {
        const fake = fakeBackendByPath(() => ({ status: 200, body: { success: true } }));
        const { reload } = renderMenu();
        await userEvent.click(screen.getByRole('button', { name: 'Delete Session' }));
        const dialog = await screen.findByRole('alertdialog');
        const confirmButton = Array.from(dialog.querySelectorAll('button')).find(/** Find the button that confirms. */ (button) => button.id === 'confirm-accept-btn');
        if (!confirmButton) throw new Error('The confirm button is missing.');
        await userEvent.click(confirmButton);
        await vi.waitFor(() => { expect(reload).toHaveBeenCalledOnce(); });
        expect(requestedPaths(fake)).toEqual(['delete-session/5']);
    });
});

describe('editing the mission of a session', () => {
    it('opens a modal with the current mission, and closes the menu', async () => {
        const { onToggle } = renderMenu();
        await userEvent.click(screen.getByRole('button', { name: 'Edit Mission' }));
        expect(await screen.findByRole('dialog', { name: 'Edit Mission' })).toBeInTheDocument();
        expect(screen.getByLabelText('Mission')).toHaveValue('write tests');
        expect(onToggle).toHaveBeenCalledOnce();
    });

    it('puts the focus in the mission box', async () => {
        renderMenu();
        await userEvent.click(screen.getByRole('button', { name: 'Edit Mission' }));
        expect(await screen.findByLabelText('Mission')).toHaveFocus();
    });

    it('saves the new mission, shows what the server saved, and closes', async () => {
        const fake = fakeBackendByPath(() => ({ status: 200, body: { success: true, mission: 'write better tests' } }));
        const { onMissionChanged } = renderMenu();
        await userEvent.click(screen.getByRole('button', { name: 'Edit Mission' }));
        const input = await screen.findByLabelText('Mission');
        await userEvent.clear(input);
        await userEvent.type(input, '  write better tests ');
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        await vi.waitFor(() => { expect(onMissionChanged).toHaveBeenCalledWith('write better tests'); });
        expect(requestedPaths(fake)).toEqual(['update-session/5']);
        expect(fake.mock.calls[0]?.[1]?.method).toBe('PATCH');
        expect(pathOf(fake.mock.calls[0]?.[0] ?? '')).toBe('update-session/5');
        expect(jsonBodyOf(fake.mock.calls[0]?.[1])).toEqual({ mission: 'write better tests' });
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('sends nothing and closes when the mission did not change', async () => {
        const fake = fakeBackendByPath(() => ({ status: 200, body: { success: true } }));
        const { onMissionChanged } = renderMenu();
        await userEvent.click(screen.getByRole('button', { name: 'Edit Mission' }));
        await screen.findByRole('dialog');
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(fake).not.toHaveBeenCalled();
        expect(onMissionChanged).not.toHaveBeenCalled();
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('shows an error and sends nothing when the mission is empty', async () => {
        const fake = fakeBackendByPath(() => ({ status: 200, body: { success: true } }));
        renderMenu();
        await userEvent.click(screen.getByRole('button', { name: 'Edit Mission' }));
        await userEvent.clear(await screen.findByLabelText('Mission'));
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Enter your mission.');
        expect(screen.getByLabelText('Mission')).toHaveAttribute('aria-invalid', 'true');
        expect(fake).not.toHaveBeenCalled();
    });

    it('clears the error when the user types again', async () => {
        renderMenu();
        await userEvent.click(screen.getByRole('button', { name: 'Edit Mission' }));
        const input = await screen.findByLabelText('Mission');
        await userEvent.clear(input);
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        await userEvent.type(input, 'a');
        expect(screen.getByRole('alert')).toBeEmptyDOMElement();
    });

    it('keeps the modal open with an error when the server refuses the mission', async () => {
        fakeBackendByPath(() => ({ status: 400, body: { success: false, error: 'Invalid session data' } }));
        const { onMissionChanged } = renderMenu();
        await userEvent.click(screen.getByRole('button', { name: 'Edit Mission' }));
        await userEvent.type(await screen.findByLabelText('Mission'), '!');
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(await screen.findByText('Couldn’t save the mission. Try again.')).toBeInTheDocument();
        expect(onMissionChanged).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('keeps the modal open with an error when the server cannot be reached', async () => {
        fakeBackendByPath(() => new Error('offline'));
        renderMenu();
        await userEvent.click(screen.getByRole('button', { name: 'Edit Mission' }));
        await userEvent.type(await screen.findByLabelText('Mission'), '!');
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(await screen.findByText("Couldn't reach the server. Try again.")).toBeInTheDocument();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('closes with Escape, and with the close button, without saving', async () => {
        const fake = fakeBackendByPath(() => ({ status: 200, body: { success: true } }));
        renderMenu();
        await userEvent.click(screen.getByRole('button', { name: 'Edit Mission' }));
        await screen.findByRole('dialog');
        await userEvent.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).toBeNull();
        await userEvent.click(screen.getByRole('button', { name: 'Edit Mission' }));
        await userEvent.click(await screen.findByRole('button', { name: 'Close edit mission form' }));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(fake).not.toHaveBeenCalled();
    });
});
