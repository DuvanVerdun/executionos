import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBackendByPath, jsonBodyOf, pathOf } from '../test/network';
import { RenameRoomModal } from './RoomModals';
import { roomStore, roomsStore } from './state';

/** Draw the rename modal for room 3 and return the function it calls when it closes. */
function renderModal() {
    const onClose = vi.fn();
    render(<RenameRoomModal room={{ id: 3, name: 'Deep work' }} screen="rooms" onClose={onClose} />);
    return onClose;
}

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    roomsStore.update({
        rooms: [{ id: 3, name: 'Deep work', members_count: 1, my_total_time_seconds: 0, working_now_count: 0, is_owner: true, show_missions: true }]
    });
});

describe('the rename room modal', () => {
    it('opens with the current name, and the focus in the box', async () => {
        renderModal();
        expect(screen.getByRole('dialog', { name: 'Rename Room' })).toBeInTheDocument();
        expect(screen.getByLabelText('Room name')).toHaveValue('Deep work');
        expect(await screen.findByLabelText('Room name')).toHaveFocus();
    });

    it('sends the trimmed name, shows what the server saved, and closes', async () => {
        const fake = fakeBackendByPath(() => ({ status: 200, body: { success: true, name: 'Focus club' } }));
        const onClose = renderModal();
        const input = screen.getByLabelText('Room name');
        await userEvent.clear(input);
        await userEvent.type(input, '  Focus club ');
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        await vi.waitFor(() => { expect(onClose).toHaveBeenCalledOnce(); });
        expect(pathOf(fake.mock.calls[0]?.[0] ?? '')).toBe('rooms/3');
        expect(fake.mock.calls[0]?.[1]?.method).toBe('PATCH');
        expect(jsonBodyOf(fake.mock.calls[0]?.[1])).toEqual({ name: 'Focus club' });
        expect(roomsStore.get().rooms[0]?.name).toBe('Focus club');
        expect(roomStore.get().snapshot).toBeNull();
    });

    it('sends nothing and closes when the name did not change', async () => {
        const fake = fakeBackendByPath(() => ({ status: 200, body: { success: true } }));
        const onClose = renderModal();
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(fake).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('shows an error and sends nothing when the name is empty', async () => {
        const fake = fakeBackendByPath(() => ({ status: 200, body: { success: true } }));
        const onClose = renderModal();
        await userEvent.clear(screen.getByLabelText('Room name'));
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Enter a Room name.');
        expect(fake).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('keeps the modal open with an error when the server refuses', async () => {
        fakeBackendByPath(() => ({ status: 403, body: { success: false, error: 'Not allowed' } }));
        const onClose = renderModal();
        await userEvent.type(screen.getByLabelText('Room name'), '!');
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(await screen.findByText("Couldn't rename the room. Try again.")).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
        expect(roomsStore.get().rooms[0]?.name).toBe('Deep work');
    });

    it('keeps the modal open with an error when the server cannot be reached', async () => {
        fakeBackendByPath(() => new Error('offline'));
        const onClose = renderModal();
        await userEvent.type(screen.getByLabelText('Room name'), '!');
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(await screen.findByText("Couldn't reach the server. Try again.")).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('closes with Escape and with the close button, without saving', async () => {
        const fake = fakeBackendByPath(() => ({ status: 200, body: { success: true } }));
        const onClose = renderModal();
        await userEvent.keyboard('{Escape}');
        await userEvent.click(screen.getByRole('button', { name: 'Close rename room form' }));
        expect(onClose).toHaveBeenCalledTimes(2);
        expect(fake).not.toHaveBeenCalled();
    });
});
