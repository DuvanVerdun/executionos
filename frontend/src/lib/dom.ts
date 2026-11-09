// Find page elements. A missing element, or one of the wrong kind, stops the app at load with a clear
// message, instead of failing later in the middle of a click.

type ElementClass<T extends Element> = abstract new (...args: never[]) => T;

/** Return the one element matching the selector, checked to be of the given class. Search inside `root` when given. */
export function getElement<T extends Element>(selector: string, type: ElementClass<T>, root: ParentNode = document): T {
    const element = root.querySelector(selector);
    if (!(element instanceof type)) {
        throw new Error(`The page has no element "${selector}" of type ${type.name}.`);
    }
    return element;
}

/** Return the element with this ID, checked to be of the given class. */
export function getById<T extends Element>(id: string, type: ElementClass<T>): T {
    return getElement(`#${id}`, type);
}

/** Return the nearest ancestor of an event target (or the target itself) that matches, or null. */
export function closestElement<T extends Element>(target: EventTarget | null, selector: string, type: ElementClass<T>): T | null {
    if (!(target instanceof Element)) return null;
    const match = target.closest(selector);
    return match instanceof type ? match : null;
}

/** Return the nearest ancestor that matches. A page structure that must have one and does not is a bug. */
export function requireClosest<T extends Element>(element: Element, selector: string, type: ElementClass<T>): T {
    const match = closestElement(element, selector, type);
    if (!match) throw new Error(`The element has no ancestor "${selector}" of type ${type.name}.`);
    return match;
}

/** Return the event target as a Node, or null when it is not one. */
export function eventTargetNode(event: Event): Node | null {
    return event.target instanceof Node ? event.target : null;
}

/** Return the parent element of an element. A page element that must have one and does not is a bug. */
export function getParentElement(element: Element): HTMLElement {
    const parent = element.parentElement;
    if (!parent) throw new Error('The element has no parent element.');
    return parent;
}

/** Return every element matching the selector, each checked to be of the given class. */
export function getAllElements<T extends Element>(selector: string, type: ElementClass<T>, root: ParentNode = document): T[] {
    return Array.from(root.querySelectorAll(selector)).map(/** Check one matching element. */ (element) => {
        if (!(element instanceof type)) {
            throw new Error(`An element "${selector}" is not of type ${type.name}.`);
        }
        return element;
    });
}
