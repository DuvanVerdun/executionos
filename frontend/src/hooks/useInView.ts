import { useEffect, useEffectEvent, type RefObject } from 'react';

/**
 * Watch an element and call `onVisible` when it is within 300px of the viewport.
 * The watch starts again whenever `restartKey` changes, so an element that stays in view is checked again.
 */
export function useInView(
    ref: RefObject<Element | null>,
    onVisible: () => void,
    enabled: boolean,
    restartKey: unknown
): void {
    const onVisibleEvent = useEffectEvent(onVisible);
    useEffect(() => {
        const element = ref.current;
        if (!enabled || !element) return undefined;
        const observer = new IntersectionObserver(
            /** Load another page when the element enters the viewport. */
            (entries) => {
                if (entries[0]?.isIntersecting) onVisibleEvent();
            },
            { root: null, rootMargin: '300px' }
        );
        observer.observe(element);
        return () => {
            observer.disconnect();
        };
    }, [ref, enabled, restartKey]);
}
