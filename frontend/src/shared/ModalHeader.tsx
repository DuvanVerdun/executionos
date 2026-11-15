import { CloseIcon } from './CloseIcon';

interface ModalHeaderProps {
    /** The start of the ids of the header: `<id>-title` and `<id>-close-btn`. */
    id: string;
    title: string;
    closeLabel: string;
    onClose: () => void;
}

/** Draw the header of a form modal: its title, and a round button that closes it. */
export function ModalHeader({ id, title, closeLabel, onClose }: ModalHeaderProps) {
    return (
        <div className="modal-header">
            <h2 id={`${id}-title`} className="modal-title">{title}</h2>
            <button type="button" id={`${id}-close-btn`} className="modal-close-btn" aria-label={closeLabel} onClick={onClose}>
                <CloseIcon />
            </button>
        </div>
    );
}
