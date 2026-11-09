// Array helpers.

/** Return the item at an index that the surrounding code guarantees exists. Throws if it does not. */
export function at<T>(items: readonly T[], index: number): T {
    const item = items[index];
    if (item === undefined) throw new RangeError(`No item at index ${index}.`);
    return item;
}
