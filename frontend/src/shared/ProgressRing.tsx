import type { ReactNode } from 'react';
import { withCssVariables } from '../lib/css';

interface ProgressRingProps {
    id: string;
    percentage: number;
    /** The color of the filled part before the target is reached. */
    beforeTargetColor: string;
    /** The color of the unfilled part after the target is passed. */
    afterTargetColor: string;
    children?: ReactNode;
}

/** Render completion using the colors before and after the target. */
export function ProgressRing({ id, percentage, beforeTargetColor, afterTargetColor, children }: ProgressRingProps) {
    const style = percentage < 100
        ? withCssVariables({
            background: `conic-gradient(${beforeTargetColor} 0%, ${beforeTargetColor} var(--pct), var(--color-border) var(--pct), var(--color-border) 100%)`
        }, { '--pct': `${percentage}%` })
        : withCssVariables({
            background: `conic-gradient(var(--color-white) 0%, var(--color-white) var(--pct), ${afterTargetColor} var(--pct), ${afterTargetColor} 100%)`
        }, { '--pct': `${percentage - 100}%` });
    return <div id={id} style={style}>{children}</div>;
}
