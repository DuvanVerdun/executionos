// The session being worked on right now, and the Finish flow flags.

export const activeSessionState = {
    currentMission: '',
    targetTimeSeconds: 0,
    actualTimeSeconds: 0,
    completionStatus: 'partial',
    percentageCompleted: 0,
    isTimerRunning: false,
    startTimestamp: '',
    pauseStartTimestamp: '',
    pausedTimeSeconds: 0
};

/** Flags and the unsent submission shared by the Plan, Focus and Review flows and the offline sync. */
export const sessionRuntime = {
    isFinishing: false,
    pendingSubmission: null
};
