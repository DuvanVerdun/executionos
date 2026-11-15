import { describe, expect, it } from 'vitest';
import { ringFaviconUrl } from './favicon';

/** Read the icon back as the text of its SVG. */
function svgOf(percentage: number, isPaused = false): string {
    return decodeURIComponent(ringFaviconUrl(percentage, isPaused).replace('data:image/svg+xml,', ''));
}

/** Read which part of the ring is white, in percent, and the color under it. */
function ringOf(percentage: number): { white: string | undefined; track: string | undefined } {
    const svg = svgOf(percentage);
    return {
        white: /stroke-dasharray="([\d.]+) 100"/.exec(svg)?.[1],
        track: /stroke="(#[0-9a-f]{6})"/.exec(svg)?.[1]
    };
}

const TEAL = '#10c9bc';
const GRAY = '#666666';

describe('the progress ring of the tab icon', () => {
    it('is an SVG data address', () => {
        expect(ringFaviconUrl(50, false)).toMatch(/^data:image\/svg\+xml,%3Csvg/);
        expect(svgOf(50)).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    });

    it('goes white over gray before the target', () => {
        expect(ringOf(0)).toEqual({ white: '0', track: GRAY });
        expect(ringOf(50)).toEqual({ white: '50', track: GRAY });
        expect(ringOf(99)).toEqual({ white: '99', track: GRAY });
    });

    it('is a whole teal ring at the target', () => {
        expect(ringOf(100)).toEqual({ white: '0', track: TEAL });
    });

    it('goes white over teal after the target, like the ring of Focus', () => {
        expect(ringOf(150)).toEqual({ white: '50', track: TEAL });
        expect(ringOf(199)).toEqual({ white: '99', track: TEAL });
    });

    it('stays a whole white ring once it has gone round twice', () => {
        expect(ringOf(200)).toEqual({ white: '100', track: TEAL });
        expect(ringOf(450)).toEqual({ white: '100', track: TEAL });
    });

    it('starts the white part at the top', () => {
        expect(svgOf(50)).toContain('rotate(-90 16 16)');
    });

    it('turns the white parts dark in a browser with a light theme, and only those', () => {
        const svg = svgOf(150, true);
        expect(svg).toContain('@media (prefers-color-scheme:light){.ink-stroke{stroke:#0b0b0b}.ink-fill{fill:#0b0b0b}}');
        expect(svg.match(/class="ink-stroke"/g)).toHaveLength(1);
        expect(svg.match(/class="ink-fill"/g)).toHaveLength(2);
        expect(svg.match(/<circle/g)).toHaveLength(2);
    });

    it('draws no attribute twice, which would make the icon fail to load', () => {
        for (const element of svgOf(150, true).match(/<(circle|rect)[^>]*>/g) ?? []) {
            const names = Array.from(element.matchAll(/\s([\w-]+)=/g), /** Read an attribute name. */ (match) => match[1]);
            expect(new Set(names).size).toBe(names.length);
        }
    });

    it('has the two pause bars in the hole of the ring only while paused', () => {
        expect(svgOf(50)).not.toContain('<rect');
        expect(svgOf(50, true).match(/<rect/g)).toHaveLength(2);
        expect(svgOf(150, true).match(/<rect/g)).toHaveLength(2);
    });

    it('keeps the ring as it is when it is paused', () => {
        expect(svgOf(50, true)).toContain(svgOf(50).replace('</svg>', ''));
    });
});
