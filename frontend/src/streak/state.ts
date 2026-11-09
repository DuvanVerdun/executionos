// Streak calendar state.

import type { HeaderScreenName } from '../types/screens';

export const streakState: { anchorDate: string; openScreen: HeaderScreenName | null; loadGeneration: number } = {
    anchorDate: '',
    openScreen: null,
    loadGeneration: 0
};
