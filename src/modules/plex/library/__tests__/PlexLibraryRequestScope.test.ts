import { AppErrorCode } from '../../../../types/app-errors';
import { PLEX_TOKEN_HEADER } from '../../shared/plexUrl';
import { PlexLibraryError, PlexLibraryScopeSupersededError } from '../PlexLibraryError';
import { PlexLibraryRequestScope } from '../PlexLibraryRequestScope';

describe('PlexLibraryRequestScope', () => {
    let serverUri: string | null;
    let authToken: string | null;
    let onScopeChange: jest.Mock;
    let scope: PlexLibraryRequestScope;

    beforeEach(() => {
        serverUri = 'http://server.example:32400';
        authToken = 'token-a';
        onScopeChange = jest.fn();
        scope = new PlexLibraryRequestScope({
            config: {
                getServerUri: (): string | null => serverUri,
                getAuthToken: (): string | null => authToken,
                getAuthHeaders: (): Record<string, string> =>
                    authToken ? { [PLEX_TOKEN_HEADER]: authToken } : {},
            },
            onScopeChange,
        });
    });

    it('captures an immutable normalized identity without exposing the auth token in its key', () => {
        const captured = scope.capture();

        expect(captured.serverUri).toBe('http://server.example:32400/');
        expect(captured.headers).toEqual({ [PLEX_TOKEN_HEADER]: 'token-a' });
        expect(captured.version).toBe(1);
        expect(captured.key).toEqual(expect.any(Object));
        expect(JSON.stringify(captured.key)).not.toContain('token-a');
        expect(Object.isFrozen(captured)).toBe(true);
        expect(Object.isFrozen(captured.headers)).toBe(true);
        expect(onScopeChange).toHaveBeenCalledTimes(1);
    });

    it('keeps version and key stable across unchanged normalized identity captures', () => {
        const first = scope.capture();
        serverUri = 'http://server.example:32400/';
        const second = scope.capture();

        expect(second.version).toBe(first.version);
        expect(second.key).toBe(first.key);
        expect(onScopeChange).toHaveBeenCalledTimes(1);
        expect(() => scope.assertCurrent(first)).not.toThrow();
    });

    it('supersedes captures across server URI changes', () => {
        const first = scope.capture();
        serverUri = 'http://other.example:32400';
        const second = scope.capture();

        expect(second.version).toBe(first.version + 1);
        expect(second.key).not.toBe(first.key);
        expect(onScopeChange).toHaveBeenCalledTimes(2);
        expect(() => scope.assertCurrent(first)).toThrow(PlexLibraryScopeSupersededError);
        expect(() => scope.assertCurrent(second)).not.toThrow();
    });

    it('uses exact private token identity even for tokens with the same former 32-bit hash', () => {
        authToken = '80d66f0c6fddd5f07618c8e1';
        const first = scope.capture();
        authToken = 'f323c0ea3298f86fa093c0c3';
        const second = scope.capture();

        expect(second.version).toBe(first.version + 1);
        expect(second.key).not.toBe(first.key);
        expect(onScopeChange).toHaveBeenCalledTimes(2);
        expect(() => scope.assertCurrent(first)).toThrow(PlexLibraryScopeSupersededError);
    });

    it('preserves caller-abort precedence over scope supersession', () => {
        const captured = scope.capture();
        serverUri = 'http://other.example:32400';
        const controller = new AbortController();
        const reason = new Error('caller canceled');
        controller.abort(reason);

        expect(() => scope.assertCurrent(captured, controller.signal)).toThrow(reason);
        expect(onScopeChange).toHaveBeenCalledTimes(1);
    });

    it('builds URLs from the captured server and query parameters', () => {
        const captured = scope.capture();

        expect(scope.buildUrl(captured, '/library/sections', { type: 1, genre: 'Comedy' }))
            .toBe('http://server.example:32400/library/sections?type=1&genre=Comedy');
    });

    it('throws SERVER_UNREACHABLE when a captured scope has no server URI', () => {
        serverUri = null;
        const captured = scope.capture();

        expect(() => scope.buildUrl(captured, '/library/sections')).toThrow(
            expect.objectContaining<Partial<PlexLibraryError>>({
                code: AppErrorCode.SERVER_UNREACHABLE,
                message: 'No server URI available',
            })
        );
    });
});
