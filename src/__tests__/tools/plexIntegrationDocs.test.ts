import { readFileSync } from 'node:fs';
import path from 'node:path';

function readRepoFile(relativePath: string): string {
    return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('Plex integration API docs', () => {
    const docs = readRepoFile('docs/api/plex-integration.md');

    it('documents IPlexLibrary options and event methods that have drifted before', () => {
        expect(docs).toContain('itemCountConcurrency?: number;');
        expect(docs).toContain("type PlexLibraryRequestIntent = 'preview' | 'background';");
        expect(docs).toContain('requestIntent?: PlexLibraryRequestIntent;');
        expect(docs).toContain("type PlexTagDirectoryUnsupportedReason = 'unavailable' | 'empty';");
        expect(docs).toContain('onUnsupported?: (reason: PlexTagDirectoryUnsupportedReason) => void;');
        expect(docs).toContain('requireEntries?: boolean;');
        expect(docs).toContain('interface PlexLibraryEvents');
        expect(docs).toContain('authExpired: undefined;');
        expect(docs).toContain('libraryRefreshed: { libraryId: string };');
        expect(docs).toContain('on<K extends keyof PlexLibraryEvents>(');
        expect(docs).toContain('off<K extends keyof PlexLibraryEvents>(');
        expect(docs).toContain('refreshLibrary(libraryId: string): Promise<void>;');
        expect(docs).not.toContain('refreshLibrary(libraryId: string, options');
    });

    it('documents IPlexStreamResolver diagnostic event methods', () => {
        expect(docs).toContain('interface StreamResolverEventMap');
        expect(docs).toContain('error: StreamResolverError;');
        expect(docs).toContain('fetchUniversalTranscodeDecision(');
        expect(docs).toContain("request: NonNullable<StreamDecision['transcodeRequest']>");
        expect(docs).toContain("Promise<NonNullable<StreamDecision['serverDecision']>>");
        expect(docs).toContain('on<K extends keyof StreamResolverEventMap>(');
        expect(docs).toContain('off<K extends keyof StreamResolverEventMap>(');
    });
});
