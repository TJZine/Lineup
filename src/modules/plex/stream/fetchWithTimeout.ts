import { fetchWithTimeoutCore } from '../shared/fetchWithTimeoutCore';

export async function fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number
): Promise<Response> {
    return fetchWithTimeoutCore(url, options, timeoutMs, options.signal ?? null);
}
