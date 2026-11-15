import { createStore } from '../lib/store';
import type { RankingEntry, RoomSummary } from '../types/rooms';

/** The label of the Focus pause button. It changes when the user pauses or resumes. */
export const focusStore = createStore<{ pauseLabel: 'Pause' | 'Resume' }>({ pauseLabel: 'Pause' });

/** What the Finish button is doing. The screen turns each value into text. */
export type FinishLabel = 'Finish' | 'Saving…' | 'Retrying…' | 'Try again';

/** The ranking of the room, and when this client got it from the server. Without it, the running sessions stay as they were seen. */
interface ReviewRanking {
    entries: RankingEntry[];
    receivedAt: number | undefined;
}

interface ReviewState {
    /** The message under the Review buttons. */
    saveMessage: string;
    /** The state of the Finish button. */
    finishLabel: FinishLabel;
    /** The room's totals shown on Review in a room session. Null shows dashes. Both start as the last look at the room. */
    roomSummary: RoomSummary | null;
    /** The room's ranking shown on Review in a room session. Null shows an empty ranking. */
    roomRanking: ReviewRanking | null;
}

export const reviewStore = createStore<ReviewState>({
    saveMessage: '',
    finishLabel: 'Finish',
    roomSummary: null,
    roomRanking: null
});
