import { useRef } from 'react';
import { useDocumentEvent } from '../hooks/useDocumentEvent';
import { useT } from '../i18n/i18n';
import { useStore } from '../lib/store';
import { answerConfirm, confirmStore } from './confirm';
import { ModalOverlay } from './ModalOverlay';

/** Draw the modal that asks the user to confirm. It is the only one in the app, and every confirmation uses it. */
export function ConfirmModal() {
    const t = useT();
    const { request } = useStore(confirmStore);
    const cancelButtonRef = useRef<HTMLButtonElement>(null);

    useDocumentEvent('keydown', /** Cancel with Escape. */ (event) => {
        if (event.key === 'Escape') answerConfirm(false);
    }, request !== null);

    if (request === null) return null;

    return (
        <ModalOverlay id="confirm-overlay" canClose onClose={() => { answerConfirm(false); }} initialFocusRef={cancelButtonRef}>
            <div id="confirm-modal" className="modal-card confirm-card" role="alertdialog" aria-modal="true" aria-describedby="confirm-message">
                <p id="confirm-message" className="modal-message">{request.message}</p>
                <div className="modal-actions">
                    <button
                        ref={cancelButtonRef}
                        type="button"
                        id="confirm-cancel-btn"
                        className="modal-submit-btn modal-secondary-btn"
                        onClick={() => { answerConfirm(false); }}
                    >
                        {t('common.cancel')}
                    </button>
                    <button type="button" id="confirm-accept-btn" className="modal-submit-btn" onClick={() => { answerConfirm(true); }}>
                        {request.confirmLabel}
                    </button>
                </div>
            </div>
        </ModalOverlay>
    );
}
