import { useRef, useState, type SubmitEvent } from 'react';
import { useT } from '../i18n/i18n';
import { errorStatus } from '../lib/errors';
import { CloseIcon } from '../shared/CloseIcon';
import { setFloatingMessage } from '../shared/floating-message';
import { ModalOverlay } from '../shared/ModalOverlay';
import { postJoinRoom, postRoom } from './api';
import { buildRoomDisplayLink, buildRoomLink, extractRoomLinkToken } from './links';
import { openRoom } from './room';
import { loadRooms } from './rooms';

interface RoomFormModalProps {
    /** The room link, shown after a room is created. */
    onCreated: (link: { full: string; display: string }) => void;
    onClose: () => void;
    isSubmitting: boolean;
    setIsSubmitting: (value: boolean) => void;
}

/** Validate the room name, create the room, and show its link. */
export function CreateRoomModal({ onCreated, onClose, isSubmitting, setIsSubmitting }: RoomFormModalProps) {
    const t = useT();
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    /** Validate the room name and create the room. */
    async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (isSubmitting) return;
        setError('');
        const roomName = name.trim();
        if (!roomName) {
            setError(t('rooms.nameRequired'));
            inputRef.current?.focus();
            return;
        }
        setIsSubmitting(true);
        try {
            const result = await postRoom(roomName);
            if (!result.success) {
                setError(t('rooms.createFailed'));
                return;
            }
            onCreated({
                full: buildRoomLink(result.room.link_token),
                display: buildRoomDisplayLink(result.room.link_token)
            });
            void loadRooms({ silent: true });
        } catch (caught) {
            if (errorStatus(caught) === 401) return;
            console.error('Could not create the room:', caught);
            setError(t('common.serverUnreachable'));
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <ModalOverlay id="create-room-overlay" canClose={!isSubmitting} onClose={onClose} initialFocusRef={inputRef}>
            <form
                id="create-room-form" className="modal-card" role="dialog" aria-modal="true" aria-labelledby="create-room-title" noValidate
                onSubmit={(event) => { void handleSubmit(event); }}
            >
                <button type="button" id="create-room-close-btn" className="modal-close-btn" aria-label={t('rooms.closeCreate')} onClick={() => { if (!isSubmitting) onClose(); }}>
                    <CloseIcon />
                </button>
                <h2 id="create-room-title" className="modal-title">{t('rooms.createTitle')}</h2>
                <div className="modal-field">
                    <div className="input-container">
                        <input
                            ref={inputRef}
                            type="text" className="input" id="create-room-input" placeholder=" " maxLength={50} autoComplete="off"
                            aria-describedby="create-room-error"
                            aria-invalid={error ? true : undefined}
                            value={name}
                            onChange={(event) => { setName(event.target.value); setError(''); }}
                        />
                        <label className="input-placeholder" htmlFor="create-room-input">{t('rooms.nameLabel')}</label>
                    </div>
                    <p id="create-room-error" className="form-error-message modal-field-error" role="alert">{error}</p>
                </div>
                <button type="submit" id="create-room-submit-btn" className="modal-submit-btn" disabled={isSubmitting}>
                    {isSubmitting ? t('rooms.creating') : t('rooms.createTitle')}
                </button>
            </form>
        </ModalOverlay>
    );
}

/** Validate the pasted link and join the room. */
export function JoinRoomModal({ onClose, isSubmitting, setIsSubmitting }: Omit<RoomFormModalProps, 'onCreated'>) {
    const t = useT();
    const [link, setLink] = useState('');
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    /** Validate the pasted link and join the room. */
    async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (isSubmitting) return;
        setError('');
        const linkToken = extractRoomLinkToken(link);
        if (!linkToken) {
            setError(t('rooms.linkRequired'));
            inputRef.current?.focus();
            return;
        }
        setIsSubmitting(true);
        try {
            const result = await postJoinRoom(linkToken);
            if (result.success) {
                onClose();
                await openRoom(result.room.id, 'rooms');
                return;
            }
            const invalid = result.status === 400 || result.status === 404;
            setError(invalid ? t('rooms.invalidLink') : t('rooms.joinFailed'));
        } catch (caught) {
            if (errorStatus(caught) === 401) return;
            console.error('Could not join the room:', caught);
            setError(t('common.serverUnreachable'));
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <ModalOverlay id="join-room-overlay" canClose={!isSubmitting} onClose={onClose} initialFocusRef={inputRef}>
            <form
                id="join-room-form" className="modal-card" role="dialog" aria-modal="true" aria-labelledby="join-room-title" noValidate
                onSubmit={(event) => { void handleSubmit(event); }}
            >
                <button type="button" id="join-room-close-btn" className="modal-close-btn" aria-label={t('rooms.closeJoin')} onClick={() => { if (!isSubmitting) onClose(); }}>
                    <CloseIcon />
                </button>
                <h2 id="join-room-title" className="modal-title">{t('rooms.joinTitle')}</h2>
                <div className="modal-field">
                    <div className="input-container">
                        <input
                            ref={inputRef}
                            type="text" className="input" id="join-room-input" placeholder=" " autoComplete="off"
                            aria-describedby="join-room-error"
                            aria-invalid={error ? true : undefined}
                            value={link}
                            onChange={(event) => { setLink(event.target.value); setError(''); }}
                        />
                        <label className="input-placeholder" htmlFor="join-room-input">{t('rooms.linkLabel')}</label>
                    </div>
                    <p id="join-room-error" className="form-error-message modal-field-error" role="alert">{error}</p>
                </div>
                <button type="submit" id="join-room-submit-btn" className="modal-submit-btn" disabled={isSubmitting}>
                    {isSubmitting ? t('rooms.joining') : t('rooms.joinTitle')}
                </button>
            </form>
        </ModalOverlay>
    );
}

/** Show the new room's link, with a button to copy it. */
export function RoomCreatedModal({ link, onClose, isSubmitting }: { link: { full: string; display: string }; onClose: () => void; isSubmitting: boolean }) {
    const t = useT();
    const copyButtonRef = useRef<HTMLButtonElement>(null);

    /** Copy the new room's link and confirm it. */
    async function handleCopy(): Promise<void> {
        try {
            await navigator.clipboard.writeText(link.full);
            setFloatingMessage(t('rooms.linkCopied'));
        } catch (error) {
            console.error('Could not copy the room link:', error);
            setFloatingMessage(t('rooms.copyFailed'), { error: true });
        }
    }

    return (
        <ModalOverlay id="room-created-overlay" canClose={!isSubmitting} onClose={onClose} initialFocusRef={copyButtonRef}>
            <div id="room-created-modal" className="modal-card" role="dialog" aria-modal="true" aria-labelledby="room-created-title">
                <button type="button" id="room-created-close-btn" className="modal-close-btn" aria-label={t('rooms.closeCreated')} onClick={() => { if (!isSubmitting) onClose(); }}>
                    <CloseIcon />
                </button>
                <h2 id="room-created-title" className="modal-title">{t('rooms.createdTitle')}</h2>
                <input
                    type="text" className="input modal-link-display" id="room-created-link" readOnly aria-label={t('rooms.linkLabel')}
                    value={link.display}
                    onFocus={(event) => { event.currentTarget.select(); }}
                />
                <button ref={copyButtonRef} type="button" id="room-created-copy-btn" className="modal-submit-btn" onClick={() => { void handleCopy(); }}>
                    {t('rooms.copyLink')}
                </button>
            </div>
        </ModalOverlay>
    );
}
