import type { CSSProperties } from 'react';

/** Return a style that also sets CSS variables such as `--pct`. React applies variables like any other property. */
export function withCssVariables(style: CSSProperties, variables: Record<`--${string}`, string>): CSSProperties {
    return Object.assign({}, style, variables);
}
