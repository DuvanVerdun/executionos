// Who is signed in: the access token lives in memory only.

/** Who is signed in. The access token lives in JavaScript memory only. */
export const authState: { accessToken: string | null; userId: number | null } = {
    accessToken: null,
    userId: null
};
