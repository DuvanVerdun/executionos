import { vi } from 'vitest';

/** One answer the fake backend gives: a status with an optional body, or an Error for a network failure. */
export type FakeAnswer = { status: number; body?: unknown } | Error;

/** Turn whatever `fetch` was given into the path after `/api/`. */
export function pathOf(url: Parameters<typeof fetch>[0]): string {
    const text = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
    return text.replace(/^.*\/api\//, '');
}

/** Turn one fake answer into the Promise `fetch` would give. */
function respond(answer: FakeAnswer): Promise<Response> {
    if (answer instanceof Error) return Promise.reject(answer);
    return Promise.resolve(new Response(JSON.stringify(answer.body ?? {}), { status: answer.status }));
}

/** Make `fetch` answer with the given answers, one for each call, and return the fake. */
export function fakeBackend(...answers: FakeAnswer[]) {
    const queue = [...answers];
    const fake = vi.fn<typeof fetch>(() => {
        const answer = queue.shift();
        return answer === undefined ? Promise.reject(new Error('The fake backend has no answer left.')) : respond(answer);
    });
    vi.stubGlobal('fetch', fake);
    return fake;
}

/** Make `fetch` answer every call with a function of the requested path. */
export function fakeBackendByPath(answer: (path: string, init: RequestInit | undefined) => FakeAnswer) {
    const fake = vi.fn<typeof fetch>((url, init) => respond(answer(pathOf(url), init)));
    vi.stubGlobal('fetch', fake);
    return fake;
}

/** Read the JSON body a request was sent with. */
export function jsonBodyOf(init: RequestInit | undefined): Record<string, unknown> {
    return typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
}

/** Return the paths of the requests a fake backend received. */
export function requestedPaths(fake: ReturnType<typeof fakeBackend>): string[] {
    return fake.mock.calls.map(/** Read the path of one request. */ ([url]) => pathOf(url));
}
