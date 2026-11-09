// Small timing helpers.

/** Wait until feedback has been visible for at least two seconds. */
export async function waitForMinimumFeedback(startedAt: number): Promise<void> {
    const remaining = 2000 - (performance.now() - startedAt);
    if (remaining > 0) await new Promise<void>(/** Resolve when the remaining feedback interval expires. */ (resolve) => setTimeout(resolve, remaining));
}

/** Wait for the given number of milliseconds. */
export function delay(milliseconds: number): Promise<void> {
    return new Promise<void>(/** Resolve when the delay expires. */ (resolve) => setTimeout(resolve, milliseconds));
}
