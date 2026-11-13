import { useEffect, type RefObject } from 'react';

/**
 * Reveal each section of the Landing with an effect when it comes into view.
 * Nothing is hidden for a visitor who asks for less motion, or while this has not started.
 */
export function useRevealOnScroll(containerRef: RefObject<HTMLElement | null>): void {
    useEffect(() => {
        const container = containerRef.current;
        if (container === null || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
        const observer = new IntersectionObserver(/** Reveal the sections that came into view, once. */ (entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                entry.target.classList.add('is-revealed');
                observer.unobserve(entry.target);
            }
        }, { threshold: 0.2 });
        container.querySelectorAll('.landing-section').forEach(/** Watch one section. */ (section) => { observer.observe(section); });
        container.classList.add('landing-animated');
        return () => {
            observer.disconnect();
            container.classList.remove('landing-animated');
        };
    }, [containerRef]);
}
