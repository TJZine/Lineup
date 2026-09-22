import { createDeferred } from '../../../../__tests__/helpers';
import type { PlexCollection } from '../../../plex/library';
import { CollectionRecoveryLookup } from '../resolution/CollectionRecoveryLookup';
import { SourceResolutionScope } from '../resolution/SourceResolutionEntryAuthority';
import { createMockLibrary } from './channel-manager-test-helpers';

const collections: PlexCollection[] = [{
    ratingKey: 'replacement',
    key: '/library/collections/replacement',
    title: 'Daily Collection',
    thumb: null,
    childCount: 2,
}];

describe('CollectionRecoveryLookup ownership', () => {
    it('shares a producer while cancellation belongs to each consumer', async () => {
        const library = createMockLibrary();
        const lookup = new CollectionRecoveryLookup(library);
        const scope = new SourceResolutionScope([]);
        const pending = createDeferred<PlexCollection[]>();
        library.getCollections.mockReturnValue(pending.promise);
        const firstAbort = new AbortController();
        const first = lookup.lookup('library', scope, firstAbort.signal);
        const second = lookup.lookup('library', scope);
        const firstResult = expect(first).rejects.toThrow('first consumer left');
        await Promise.resolve();
        expect(library.getCollections).toHaveBeenCalledTimes(1);
        const producerSignal = library.getCollections.mock.calls[0]?.[1]?.signal;
        firstAbort.abort(new Error('first consumer left'));
        await firstResult;
        expect(producerSignal?.aborted).toBe(false);
        pending.resolve(collections);
        await expect(second).resolves.toEqual(collections);
        await lookup.whenIdle();
        scope.close();
        scope.release();
    });

    it('retires the last consumer but drains a transport that ignores cancellation', async () => {
        const library = createMockLibrary();
        const lookup = new CollectionRecoveryLookup(library);
        const scope = new SourceResolutionScope([]);
        const pending = createDeferred<PlexCollection[]>();
        library.getCollections.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(collections);
        const abort = new AbortController();
        const first = lookup.lookup('library', scope, abort.signal);
        const firstResult = expect(first).rejects.toThrow('left');
        await Promise.resolve();
        const producerSignal = library.getCollections.mock.calls[0]?.[1]?.signal;
        abort.abort(new Error('left'));
        await firstResult;
        expect(producerSignal?.aborted).toBe(true);
        let drained = false;
        const drain = lookup.whenIdle().then(() => { drained = true; });
        await expect(lookup.lookup('library', scope)).resolves.toEqual(collections);
        expect(library.getCollections).toHaveBeenCalledTimes(2);
        expect(drained).toBe(false);
        pending.resolve(collections);
        await drain;
        expect(drained).toBe(true);
        scope.close();
        scope.release();
    });

    it('does not share across scopes or publish a late old-scope result', async () => {
        const library = createMockLibrary();
        const lookup = new CollectionRecoveryLookup(library);
        const oldScope = new SourceResolutionScope([]);
        const newScope = new SourceResolutionScope([]);
        const pending = createDeferred<PlexCollection[]>();
        library.getCollections.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(collections);
        const old = lookup.lookup('library', oldScope);
        const oldResult = expect(old).rejects.toThrow();
        await Promise.resolve();
        await expect(lookup.lookup('library', newScope)).resolves.toEqual(collections);
        await oldResult;
        pending.resolve(collections);
        await lookup.whenIdle();
        expect(library.getCollections).toHaveBeenCalledTimes(2);
        oldScope.close();
        oldScope.release();
        newScope.close();
        newScope.release();
    });

    it('clears all waiters and waits for rejected retired work without unhandled promises', async () => {
        const library = createMockLibrary();
        const lookup = new CollectionRecoveryLookup(library);
        const scope = new SourceResolutionScope([]);
        const pending = createDeferred<PlexCollection[]>();
        library.getCollections.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(collections);
        const first = lookup.lookup('library', scope);
        const second = lookup.lookup('library', scope);
        const results = Promise.allSettled([first, second]);
        await Promise.resolve();
        lookup.clear();
        expect((await results).every((result) => result.status === 'rejected')).toBe(true);
        pending.reject(new Error('transport rejected after cancellation'));
        await lookup.whenIdle();
        await expect(lookup.lookup('library', scope)).resolves.toEqual(collections);
        scope.close();
        scope.release();
    });

    it('does not retain successful lists or rejected lookups for future repair attempts', async () => {
        const library = createMockLibrary();
        const lookup = new CollectionRecoveryLookup(library);
        const scope = new SourceResolutionScope([]);
        library.getCollections.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(collections);
        await expect(lookup.lookup('library', scope)).rejects.toThrow('offline');
        await expect(lookup.lookup('library', scope)).resolves.toEqual(collections);
        await expect(lookup.lookup('library', scope)).resolves.toEqual(collections);
        expect(library.getCollections).toHaveBeenCalledTimes(3);
        scope.close();
        scope.release();
        await lookup.whenIdle();
    });
});
