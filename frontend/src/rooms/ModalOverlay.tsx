import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { at } from '../lib/arrays';

interface ModalOverlayProps {
    id: string;
    /** False while the modal is busy sending something. Then it cannot be closed. */
    canClose: boolean;
    onClose: () => void;
    /** The element that gets focus when the modal opens. */
    initialFocusRef: RefObject<HTMLElement | null>;
    children: ReactNode;
}

/** Draw a modal overlay around a modal card. */
export function ModalOverlay({ id, canClose, onClose, initialFocusRef, children }: ModalOverlayProps) {
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        initialFocusRef.current?.focus();
        return () => {
            previouslyFocused?.focus();
        };
    }, [initialFocusRef]);

    /** Keep Tab and Shift+Tab inside the open modal. */
    function trapFocus(event: KeyboardEvent<HTMLDivElement>): void {
        if (event.key !== 'Tab') return;
        const overlay = overlayRef.current;
        if (!overlay) return;
        const focusable = Array.from(overlay.querySelectorAll('button:not(:disabled), input')).filter(
            /** Keep the elements that can take focus. */ (element): element is HTMLElement => element instanceof HTMLElement
        );
        if (focusable.length === 0) return;
        const first = at(focusable, 0);
        const last = at(focusable, focusable.length - 1);
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    return (
        <div
            ref={overlayRef}
            id={id}
            className="modal-overlay"
            onKeyDown={trapFocus}
            onClick={(event) => {
                if (event.target === overlayRef.current && canClose) onClose();
            }}
        >
            {children}
        </div>
    );
}
