import { useEffect, useState } from 'react';

/** Return the current time in milliseconds, renewed every second while it is enabled. */
export function useNow(enabled: boolean): number {
    const [now, setNow] = useState(Date.now);

    useEffect(() => {
        if (!enabled) return undefined;
        const timer = setInterval(/** Take the time of this second. */ () => { setNow(Date.now()); }, 1000);
        return /** Stop the clock when it is disabled or the component is gone. */ () => { clearInterval(timer); };
    }, [enabled]);

    return now;
}
