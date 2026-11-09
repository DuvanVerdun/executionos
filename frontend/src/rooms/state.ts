import { createStore } from '../lib/store';
import type { DailySummary, HistoryCursor } from '../types/session';
import type {
    HistoryFailure, RoomCard, RoomHistorySession, RoomMenuAction, RoomSnapshot
} from '../types/rooms';

/** What the Rooms screen shows: loading cards, the room cards, the empty state, or an error. */
export type RoomsSurface = 'loading' | 'rooms' | 'empty' | 'error';

interface RoomsState {
    /** The latest rooms from the server. */
    rooms: RoomCard[];
    /** The rooms on screen. They wait while a room menu is open, so the menu is not rebuilt under the user. */
    shownRooms: RoomCard[];
    surface: RoomsSurface;
    hasLoaded: boolean;
    isLoading: boolean;
    openMenuRoomId: number | null;
    renderDeferred: boolean;
    busyAction: RoomMenuAction | null;
}

/** What the Room screen shows: loading placeholders, the room, an error, or the unavailable message. */
export type RoomView = 'loading' | 'ready' | 'error' | 'unavailable';

interface RoomState {
    roomId: number | null;
    view: RoomView;
    snapshot: RoomSnapshot | null;
    sessions: RoomHistorySession[];
    dailySummaries: Record<string, DailySummary>;
    nextCursor: HistoryCursor | null;
    historyLoaded: boolean;
    historyFailure: HistoryFailure | null;
    historyMessage: string;
    isLoading: boolean;
    isLoadingMore: boolean;
    menuOpen: boolean;
    busyAction: RoomMenuAction | null;
}

export const roomsStore = createStore<RoomsState>({
    rooms: [],
    shownRooms: [],
    surface: 'loading',
    hasLoaded: false,
    isLoading: false,
    openMenuRoomId: null,
    renderDeferred: false,
    busyAction: null
});

export const roomStore = createStore<RoomState>({
    roomId: null,
    view: 'loading',
    snapshot: null,
    sessions: [],
    dailySummaries: {},
    nextCursor: null,
    historyLoaded: false,
    historyFailure: null,
    historyMessage: '',
    isLoading: false,
    isLoadingMore: false,
    menuOpen: false,
    busyAction: null
});

export const roomSnapshotCache = new Map<number, RoomSnapshot>();

interface CheckinAudio {
    context: AudioContext | null;
    buffer: AudioBuffer | null;
    loading: Promise<void> | null;
    source: AudioBufferSourceNode | null;
    failed: boolean;
}

/** The check-in sound. Nothing on screen depends on it. */
export const checkinAudio: CheckinAudio = {
    context: null,
    buffer: null,
    loading: null,
    source: null,
    failed: false
};
