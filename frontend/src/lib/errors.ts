/** A request failed with this HTTP status. */
export class StatusError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'StatusError';
        this.status = status;
    }
}

/** Return the HTTP status of a caught value, or undefined when it has none. */
export function errorStatus(error: unknown): number | undefined {
    return error instanceof StatusError ? error.status : undefined;
}
