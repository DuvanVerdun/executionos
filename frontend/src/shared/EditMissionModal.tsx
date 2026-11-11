import { useRef, useState, type SubmitEvent } from 'react';
import { useDocumentEvent } from '../hooks/useDocumentEvent';
import { useT } from '../i18n/i18n';
import { errorStatus } from '../lib/errors';
import { patchSessionMission } from '../session/api';
import { getMissionError } from '../session/plan';
import type { ScreenName } from '../types/screens';
import { CloseIcon } from './CloseIcon';
import { ModalOverlay } from './ModalOverlay';

interface EditMissionModalProps {
    sessionId: number;
    /** The mission that the session has now. */
    mission: string;
    /** The screen the session is on. The request needs it, in case the sign-in is lost. */
    screen: ScreenName;
    /** Called with the mission that the server saved. */
    onSaved: (mission: string) => void;
    onClose: () => void;
}

/** Draw the modal that changes the mission of a saved session. */
export function EditMissionModal({ sessionId, mission, screen, onSaved, onClose }: EditMissionModalProps) {
    const t = useT();
    const [value, setValue] = useState(mission);
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useDocumentEvent('keydown', /** Close the modal with Escape, unless it is saving. */ (event) => {
        if (event.key === 'Escape' && !isSaving) onClose();
    });

    /** Check the mission, save it, and close the modal. */
    async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (isSaving) return;
        const problem = getMissionError(value);
        if (problem) {
            setError(problem);
            inputRef.current?.focus();
            return;
        }
        const newMission = value.trim();
        if (newMission === mission) {
            onClose();
            return;
        }
        setIsSaving(true);
        try {
            const result = await patchSessionMission(sessionId, newMission, screen);
            if (!result.success) {
                setError(t('session.editFailed'));
                return;
            }
            onSaved(result.mission);
            onClose();
        } catch (caught) {
            if (errorStatus(caught) === 401) return;
            console.error('Could not change the mission:', caught);
            setError(t('common.serverUnreachable'));
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <ModalOverlay id="edit-mission-overlay" canClose={!isSaving} onClose={onClose} initialFocusRef={inputRef}>
            <form
                id="edit-mission-form" className="modal-card" role="dialog" aria-modal="true" aria-labelledby="edit-mission-title" noValidate
                onSubmit={(event) => { void handleSubmit(event); }}
            >
                <button type="button" id="edit-mission-close-btn" className="modal-close-btn" aria-label={t('session.editClose')} onClick={() => { if (!isSaving) onClose(); }}>
                    <CloseIcon />
                </button>
                <h2 id="edit-mission-title" className="modal-title">{t('session.edit')}</h2>
                <div className="modal-field">
                    <div className="input-container">
                        <input
                            ref={inputRef}
                            type="text" className="input" id="edit-mission-input" placeholder=" " maxLength={50} autoComplete="off"
                            aria-describedby="edit-mission-error"
                            aria-invalid={error ? true : undefined}
                            value={value}
                            onChange={(event) => { setValue(event.target.value); setError(''); }}
                        />
                        <label className="input-placeholder" htmlFor="edit-mission-input">{t('session.missionLabel')}</label>
                    </div>
                    <p id="edit-mission-error" className="form-error-message modal-field-error" role="alert">{error}</p>
                </div>
                <button type="submit" id="edit-mission-submit-btn" className="modal-submit-btn" disabled={isSaving}>
                    {isSaving ? t('common.saving') : t('common.save')}
                </button>
            </form>
        </ModalOverlay>
    );
}
