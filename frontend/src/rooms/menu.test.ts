import { beforeEach, describe, expect, it, vi } from 'vitest';
import { answerConfirm, confirmStore } from '../shared/confirm';
import { floatingMessageStore } from '../shared/floating-message';
import { fakeBackendByPath, requestedPaths } from '../test/network';
import type { RoomMenuHooks, RoomMenuRoom } from '../types/rooms';
import { runRoomMenuAction } from './menu';

const room: RoomMenuRoom = { id: 3, is_owner: true, show_missions: true };

/** Make menu hooks that record what the menu does. The spies come back beside the hooks. */
function makeHooks() {
    const setBusy = vi.fn();
    const setShowMissions = vi.fn();
    const onRemoved = vi.fn(() => Promise.resolve());
    const hooks: RoomMenuHooks = { screen: 'rooms', isBusy: () => false, setBusy, setShowMissions, onRemoved };
    return { hooks, setBusy, setShowMissions, onRemoved };
}

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('room menu actions that need a confirmation', () => {
    it.each([
        ['leave-room', 'Leave this room?', 'Leave room'],
        ['delete-room', 'Delete this room?', 'Delete room'],
        ['refresh-link', 'Create a new link?', 'Refresh link']
    ] as const)('%s asks in the modal, with the matching button', async (action, question, buttonText) => {
        fakeBackendByPath(() => ({ status: 200, body: { success: true } }));
        const running = runRoomMenuAction(action, room, makeHooks().hooks);
        expect(confirmStore.get().request?.message).toContain(question);
        expect(confirmStore.get().request?.confirmLabel).toBe(buttonText);
        answerConfirm(false);
        await running;
    });

    it('sends nothing and changes nothing when the user cancels', async () => {
        const fake = fakeBackendByPath(() => ({ status: 200, body: { success: true } }));
        const { hooks, setBusy, onRemoved } = makeHooks();
        const running = runRoomMenuAction('leave-room', room, hooks);
        answerConfirm(false);
        await running;
        expect(fake).not.toHaveBeenCalled();
        expect(setBusy).not.toHaveBeenCalled();
        expect(onRemoved).not.toHaveBeenCalled();
    });

    it('leaves the room and tells the screen when the user confirms', async () => {
        const fake = fakeBackendByPath(() => ({ status: 200, body: { success: true } }));
        const { hooks, onRemoved } = makeHooks();
        const running = runRoomMenuAction('leave-room', room, hooks);
        answerConfirm(true);
        await running;
        expect(requestedPaths(fake)).toEqual(['rooms/3/leave']);
        expect(onRemoved).toHaveBeenCalledOnce();
    });

    it('shows the "someone is working" message when a delete is refused with a 409', async () => {
        fakeBackendByPath(() => ({ status: 409, body: { success: false, error: 'busy' } }));
        const { hooks, onRemoved } = makeHooks();
        const running = runRoomMenuAction('delete-room', room, hooks);
        answerConfirm(true);
        await running;
        expect(floatingMessageStore.get().message).toBe('Someone is working in this room. Try again when they finish.');
        expect(onRemoved).not.toHaveBeenCalled();
    });
});

describe('room menu actions that need no confirmation', () => {
    it('changes the Show Missions setting without a modal', async () => {
        fakeBackendByPath(() => ({ status: 200, body: { success: true, show_missions: false } }));
        const { hooks, setShowMissions } = makeHooks();
        await runRoomMenuAction('toggle-missions', room, hooks);
        expect(confirmStore.get().request).toBeNull();
        expect(setShowMissions).toHaveBeenLastCalledWith(3, false);
    });
});
