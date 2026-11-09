type ElementClass<T extends Element> = abstract new (...args: never[]) => T;

/** Return the one element matching the selector, checked to be of the given class. A missing element is a bug. */
export function getElement<T extends Element>(selector: string, type: ElementClass<T>, root: ParentNode = document): T {
    const element = root.querySelector(selector);
    if (!(element instanceof type)) {
        throw new Error(`The page has no element "${selector}" of type ${type.name}.`);
    }
    return element;
}

/** Return the nearest ancestor of an event target (or the target itself) that matches, or null. */
export function closestElement<T extends Element>(target: EventTarget | null, selector: string, type: ElementClass<T>): T | null {
    if (!(target instanceof Element)) return null;
    const match = target.closest(selector);
    return match instanceof type ? match : null;
}
