import { useEffect, useState, type RefObject } from 'react';

/**
 * Return whether the element has been revealed: it came completely into view, or the wait ran out, whichever happened first.
 * Once it is true it stays true.
 */
export function useRevealedWhenInView(elementRef: RefObject<HTMLElement | null>, maximumWaitMs: number): boolean {
    const [isRevealed, setIsRevealed] = useState(false);

    useEffect(() => {
        const element = elementRef.current;
        if (element === null) return undefined;
        const observer = new IntersectionObserver(/** Reveal when the whole element is in view. */ (entries) => {
            if (entries.some(/** Find an entry that is in view. */ (entry) => entry.isIntersecting)) setIsRevealed(true);
        }, { threshold: 1 });
        observer.observe(element);
        const timer = setTimeout(() => { setIsRevealed(true); }, maximumWaitMs);
        return () => {
            observer.disconnect();
            clearTimeout(timer);
        };
    }, [elementRef, maximumWaitMs]);

    return isRevealed;
}
