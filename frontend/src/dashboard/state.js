// Dashboard state.

export const dashboardState = {
    period: 'week',
    anchorDates: { week: '', month: '', year: '', all_time: '' },
    metric: 'time',
    data: null,
    sessions: [],
    dailySummaries: {},
    nextCursor: null,
    isLoadingMore: false,
    paginationFailed: false,
    isLoading: false,
    loadGeneration: 0,
    sessionObserver: null
};
