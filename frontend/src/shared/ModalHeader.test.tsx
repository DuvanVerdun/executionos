import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ModalHeader } from './ModalHeader';

describe('the header of a form modal', () => {
    it('has the title and a close button, with ids that start with the given one', () => {
        render(<ModalHeader id="create-room" title="Create room" closeLabel="Close" onClose={() => undefined} />);
        expect(screen.getByRole('heading', { name: 'Create room' })).toHaveAttribute('id', 'create-room-title');
        expect(screen.getByRole('button', { name: 'Close' })).toHaveAttribute('id', 'create-room-close-btn');
    });

    it('calls onClose when the close button is clicked', async () => {
        const onClose = vi.fn();
        render(<ModalHeader id="x" title="Title" closeLabel="Close" onClose={onClose} />);
        await userEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(onClose).toHaveBeenCalledOnce();
    });
});
