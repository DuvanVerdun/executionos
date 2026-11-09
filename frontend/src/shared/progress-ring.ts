// The progress ring drawing.

/** Render completion using the colors before and after the target. */
export function renderProgressRing(ring: HTMLElement, percentage: number, beforeTargetColor: string, afterTargetColor: string): void {
    if (percentage < 100) {
        ring.style.setProperty('--pct', `${percentage}%`);
        ring.style.background =
            `conic-gradient(${beforeTargetColor} 0%, ${beforeTargetColor} var(--pct), var(--color-border) var(--pct), var(--color-border) 100%)`;
    } else {
        ring.style.setProperty('--pct', `${percentage - 100}%`);
        ring.style.background =
            `conic-gradient(var(--color-white) 0%, var(--color-white) var(--pct), ${afterTargetColor} var(--pct), ${afterTargetColor} 100%)`;
    }
}
