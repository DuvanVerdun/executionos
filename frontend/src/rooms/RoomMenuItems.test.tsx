import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { RoomMenuAction } from '../types/rooms';
import { RoomMenuItems } from './RoomMenuItems';

/** Draw the menu of a room, and return the functions it calls. */
function renderMenu(isOwner: boolean, busyAction: RoomMenuAction | null = null) {
    const onAction = vi.fn();
    const onRename = vi.fn();
    render(<RoomMenuItems room={{ id: 3, is_owner: isOwner, show_missions: true }} busyAction={busyAction} onAction={onAction} onRename={onRename} />);
    return { onAction, onRename };
}

describe('the room menu', () => {
    it('shows the owner every row, with Rename room first among the actions', () => {
        renderMenu(true);
        expect(screen.getAllByRole('menuitem').map(/** Read a row's text. */ (row) => row.textContent)).toEqual([
            'Rename room', 'Copy link', 'Refresh link', 'Delete room', 'Leave room'
        ]);
    });

    it('does not show Rename room to a member who is not the owner', () => {
        renderMenu(false);
        expect(screen.queryByRole('menuitem', { name: 'Rename room' })).toBeNull();
        expect(screen.getByRole('menuitem', { name: 'Leave room' })).toBeInTheDocument();
    });

    it('opens the rename modal through onRename, without running a menu action', async () => {
        const { onAction, onRename } = renderMenu(true);
        await userEvent.click(screen.getByRole('menuitem', { name: 'Rename room' }));
        expect(onRename).toHaveBeenCalledOnce();
        expect(onAction).not.toHaveBeenCalled();
    });

    it('cannot rename while another action is running', () => {
        renderMenu(true, 'copy-link');
        expect(screen.getByRole('menuitem', { name: 'Rename room' })).toBeDisabled();
    });
});
