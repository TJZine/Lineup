import { readFileSync } from 'node:fs';
import path from 'node:path';

function readRepoFile(relativePath: string): string {
    return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

function stripTsComments(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
}

function compactTypeScript(source: string): string {
    return stripTsComments(source)
        .replace(/\bexport\s+/g, '')
        .replace(/\s+/g, '');
}

function findBalancedBlockEnd(source: string, openBraceIndex: number): number {
    let depth = 0;

    for (let index = openBraceIndex; index < source.length; index += 1) {
        const char = source[index];

        if (char === '{') {
            depth += 1;
        } else if (char === '}') {
            depth -= 1;

            if (depth === 0) {
                return index + 1;
            }
        }
    }

    throw new Error(`Unable to find matching brace after index ${openBraceIndex}`);
}

function extractInterface(source: string, interfaceName: string): string {
    const declarationIndex = source.indexOf(`export interface ${interfaceName}`);
    if (declarationIndex === -1) {
        throw new Error(`Unable to find interface ${interfaceName}`);
    }

    const openBraceIndex = source.indexOf('{', declarationIndex);
    if (openBraceIndex === -1) {
        throw new Error(`Unable to find opening brace for interface ${interfaceName}`);
    }

    return source.slice(declarationIndex, findBalancedBlockEnd(source, openBraceIndex));
}

function extractTypeAlias(source: string, typeName: string): string {
    const declarationIndex = source.indexOf(`export type ${typeName}`);
    if (declarationIndex === -1) {
        throw new Error(`Unable to find type alias ${typeName}`);
    }

    let depth = 0;

    for (let index = declarationIndex; index < source.length; index += 1) {
        const char = source[index];

        if (char === '{' || char === '(' || char === '[') {
            depth += 1;
        } else if (char === '}' || char === ')' || char === ']') {
            depth -= 1;
        } else if (char === ';' && depth === 0) {
            return source.slice(declarationIndex, index + 1);
        }
    }

    throw new Error(`Unable to find terminator for type alias ${typeName}`);
}

function expectDocsToMatchSourceType(docs: string, sourceBlock: string): void {
    expect(compactTypeScript(docs)).toContain(compactTypeScript(sourceBlock));
}

describe('Plex integration API docs', () => {
    const docs = readRepoFile('docs/api/plex-integration.md');
    const authInterfaces = readRepoFile('src/modules/plex/auth/interfaces.ts');
    const discoveryInterfaces = readRepoFile('src/modules/plex/discovery/interfaces.ts');
    const libraryInterfaces = readRepoFile('src/modules/plex/library/interfaces.ts');
    const libraryTypes = readRepoFile('src/modules/plex/library/types.ts');
    const streamInterfaces = readRepoFile('src/modules/plex/stream/interfaces.ts');
    const streamTypes = readRepoFile('src/modules/plex/stream/types.ts');

    it('documents IPlexAuth from the exported source contract', () => {
        expectDocsToMatchSourceType(docs, extractInterface(authInterfaces, 'IPlexAuth'));
    });

    it('documents IPlexServerDiscovery from the exported source contract', () => {
        expectDocsToMatchSourceType(
            docs,
            extractTypeAlias(discoveryInterfaces, 'PlexServerSelectionFailureReason')
        );
        expectDocsToMatchSourceType(docs, extractTypeAlias(discoveryInterfaces, 'PlexServerSelectionResult'));
        expectDocsToMatchSourceType(docs, extractInterface(discoveryInterfaces, 'IPlexServerDiscovery'));
    });

    it('documents IPlexLibrary from the exported source contract', () => {
        expectDocsToMatchSourceType(
            docs,
            extractTypeAlias(libraryInterfaces, 'PlexTagDirectoryUnsupportedReason')
        );
        expectDocsToMatchSourceType(docs, extractTypeAlias(libraryInterfaces, 'PlexLibraryRequestIntent'));
        expectDocsToMatchSourceType(docs, extractInterface(libraryInterfaces, 'PlexTagDirectoryQueryOptions'));
        expectDocsToMatchSourceType(docs, extractInterface(libraryTypes, 'PlexLibraryEvents'));
        expectDocsToMatchSourceType(docs, extractInterface(libraryInterfaces, 'IPlexLibrary'));
    });

    it('documents IPlexStreamResolver from the exported source contract', () => {
        expectDocsToMatchSourceType(docs, extractTypeAlias(streamInterfaces, 'StreamResolverErrorStage'));
        expectDocsToMatchSourceType(docs, extractInterface(streamInterfaces, 'StreamResolverError'));
        expectDocsToMatchSourceType(docs, extractInterface(streamInterfaces, 'StreamResolverEventMap'));
        expectDocsToMatchSourceType(docs, extractInterface(streamInterfaces, 'IPlexStreamResolver'));
    });

    it('documents StreamDecision and transcode request diagnostics from the exported source contract', () => {
        expectDocsToMatchSourceType(docs, extractInterface(streamTypes, 'StreamDecision'));
        expectDocsToMatchSourceType(docs, extractTypeAlias(streamTypes, 'StreamDecisionTranscodeRequest'));
    });
});
