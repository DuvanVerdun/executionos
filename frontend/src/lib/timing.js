// Small timing helpers.

/** Wait until feedback has been visible for at least two seconds. */
export async function waitForMinimumFeedback(startedAt) {
    const remaining = 2000 - (performance.now() - startedAt);
    if (remaining > 0) await new Promise(/** Resolve when the remaining feedback interval expires. */ (resolve) => setTimeout(resolve, remaining));
}

/** Wait for the given number of milliseconds. */
export function delay(milliseconds) {
    return new Promise(/** Resolve when the delay expires. */ (resolve) => setTimeout(resolve, milliseconds));
}
