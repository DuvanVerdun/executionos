import { createStore } from '../lib/store';
import type { RoomSummary } from '../types/rooms';

/** The label of the Focus pause button. It changes when the user pauses or resumes. */
export const focusStore = createStore<{ pauseLabel: 'Pause' | 'Resume' }>({ pauseLabel: 'Pause' });

/** What the Finish button is doing. The screen turns each value into text. */
export type FinishLabel = 'Finish' | 'Saving…' | 'Retrying…' | 'Try again';

interface ReviewState {
    /** The message under the Review buttons. */
    saveMessage: string;
    /** The state of the Finish button. */
    finishLabel: FinishLabel;
    /** The room's totals shown on Review in a room session. Null shows dashes. */
    roomSummary: RoomSummary | null;
}

export const reviewStore = createStore<ReviewState>({
    saveMessage: '',
    finishLabel: 'Finish',
    roomSummary: null
});
