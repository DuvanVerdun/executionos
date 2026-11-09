import { useEffect, useEffectEvent } from 'react';

/** Call the handler on every event of the given type on the document. The newest handler always runs. */
export function useDocumentEvent<K extends keyof DocumentEventMap>(
    type: K,
    handler: (event: DocumentEventMap[K]) => void,
    enabled: boolean = true
): void {
    const onEvent = useEffectEvent(handler);
    useEffect(() => {
        if (!enabled) return undefined;
        /** Pass the event to the newest handler. */
        const listener = (event: DocumentEventMap[K]): void => {
            onEvent(event);
        };
        document.addEventListener(type, listener);
        return () => {
            document.removeEventListener(type, listener);
        };
    }, [type, enabled]);
}
