const SIZE = 32;
const THICKNESS = 6;
const RADIUS = (SIZE - THICKNESS) / 2;
const CENTER = SIZE / 2;

/** The two bars of the pause icon, in the hole of the ring. */
const BAR_WIDTH = 3;
const BAR_GAP = 3;
const BAR_HEIGHT = 9;

/**
 * The colors of `--color-reward`, `--color-white` and `--color-page`, which an icon cannot read from the stylesheet,
 * and a gray lighter than `--color-border`, which disappears on the dark bar of a browser.
 */
const TEAL = '#10c9bc';
const WHITE = '#ffffff';
const DARK = '#0b0b0b';
const GRAY = '#666666';

/** The parts of the icon that stand out from the bar of the browser: white on a dark bar, dark on a light one. */
const INK_STYLE = `<style>.ink-stroke{stroke:${WHITE}}.ink-fill{fill:${WHITE}}@media (prefers-color-scheme:light){.ink-stroke{stroke:${DARK}}.ink-fill{fill:${DARK}}}</style>`;

/** A circle with no fill, the shape of every part of the ring. */
function circle(attributes: string): string {
    return `<circle cx="${CENTER}" cy="${CENTER}" r="${RADIUS}" fill="none" stroke-width="${THICKNESS}" ${attributes}/>`;
}

/** The pause icon, drawn like the one in the ring of a member who is paused in a room. */
function pauseBars(): string {
    const firstBarX = CENTER - (2 * BAR_WIDTH + BAR_GAP) / 2;
    return [firstBarX, firstBarX + BAR_WIDTH + BAR_GAP].map(
        /** Draw one bar. */ (x) => `<rect x="${x}" y="${CENTER - BAR_HEIGHT / 2}" width="${BAR_WIDTH}" height="${BAR_HEIGHT}" rx="1" class="ink-fill"/>`
    ).join('');
}

/**
 * Return the address of an icon with a progress ring, drawn like the ring of Focus: before the target, white goes
 * round over gray. From the target on, white goes round over teal, so the target itself shows a whole teal ring.
 * A paused session has the pause icon inside the ring. The white turns dark in a browser with a light theme.
 */
export function ringFaviconUrl(percentage: number, isPaused: boolean): string {
    const isPastTarget = percentage >= 100;
    const whitePercentage = Math.min(100, Math.max(0, isPastTarget ? percentage - 100 : percentage));
    const track = circle(`stroke="${isPastTarget ? TEAL : GRAY}"`);
    const arc = circle(`class="ink-stroke" pathLength="100" stroke-dasharray="${whitePercentage} 100" transform="rotate(-90 ${CENTER} ${CENTER})"`);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">${INK_STYLE}${track}${arc}${isPaused ? pauseBars() : ''}</svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
