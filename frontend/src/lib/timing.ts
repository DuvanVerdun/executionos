/** Wait until feedback has been visible for at least two seconds. */
export async function waitForMinimumFeedback(startedAt: number): Promise<void> {
    const remaining = 2000 - (performance.now() - startedAt);
    if (remaining > 0) await new Promise<void>(/** Resolve when the remaining feedback interval expires. */ (resolve) => setTimeout(resolve, remaining));
}

/** A little extra wait, so a timer never wakes up just before the second changes. */
const NEXT_SECOND_MARGIN_MS = 5;

/**
 * Return how long to wait until the whole seconds of a running timer change.
 * A timer that wakes up then shows each second as it starts, instead of up to a second late.
 */
export function millisecondsUntilNextSecond(exactSeconds: number): number {
    return (1 - (exactSeconds - Math.floor(exactSeconds))) * 1000 + NEXT_SECOND_MARGIN_MS;
}

/** Wait for the given number of milliseconds. */
export function delay(milliseconds: number): Promise<void> {
    return new Promise<void>(/** Resolve when the delay expires. */ (resolve) => setTimeout(resolve, milliseconds));
}
