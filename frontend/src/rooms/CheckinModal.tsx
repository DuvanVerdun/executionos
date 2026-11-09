import { useEffect, useRef } from 'react';
import { useStore } from '../lib/store';
import { handleCheckinConfirm } from './room-session';
import { roomSessionStore } from './room-session-state';

/** Draw the check-in popup. */
export function CheckinModal() {
    const { checkinOpen, checkinCountdown, isBusy } = useStore(roomSessionStore);
    const confirmButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (checkinOpen) confirmButtonRef.current?.focus();
    }, [checkinOpen]);

    return (
        <div
            id="checkin-overlay"
            className="modal-overlay checkin-overlay"
            hidden={!checkinOpen}
            onKeyDown={(event) => {
                if (event.key !== 'Tab') return;
                event.preventDefault();
                confirmButtonRef.current?.focus();
            }}
        >
            <div className="modal-card checkin-card" role="alertdialog" aria-modal="true" aria-labelledby="checkin-title" aria-describedby="checkin-countdown">
                <h2 id="checkin-title" className="checkin-title">Are you still there?</h2>
                <p id="checkin-countdown" className="checkin-countdown" role="timer">{checkinCountdown}</p>
                <button
                    ref={confirmButtonRef}
                    type="button"
                    id="checkin-confirm-btn"
                    className="modal-submit-btn"
                    disabled={isBusy}
                    onClick={() => { void handleCheckinConfirm(); }}
                >
                    Still here
                </button>
                <p id="checkin-error" className="form-error-message modal-field-error" role="alert"></p>
            </div>
        </div>
    );
}
