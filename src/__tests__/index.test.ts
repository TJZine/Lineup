import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

jest.mock('../bootstrap', () => ({
    installLineupBootstrap: jest.fn(),
}));

const indexPath = path.resolve(__dirname, '..', 'index.ts');
const rootStylesheets = [
    './styles/tokens.css',
    './styles/themes.css',
    './styles/video.css',
];
const featureStylesheets = [
    'epg',
    'now-playing-info',
    'player-osd',
    'channel-number-overlay',
    'channel-badge',
    'mini-guide',
    'channel-transition',
    'playback-options',
    'exit-confirm',
    'settings',
    'profile-select',
    'server-select',
    'audio-setup',
    'channel-setup',
].map((feature) => `./modules/ui/${feature}/styles.css`);
const stylesheetSeams = [...rootStylesheets, ...featureStylesheets, './styles/shell.css'];

function getSideEffectStylesheetImports(): string[] {
    const source = ts.createSourceFile(
        indexPath,
        readFileSync(indexPath, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
    );

    return source.statements.flatMap((statement) => {
        if (
            !ts.isImportDeclaration(statement) ||
            statement.importClause ||
            !ts.isStringLiteral(statement.moduleSpecifier) ||
            !statement.moduleSpecifier.text.endsWith('.css')
        ) {
            return [];
        }
        return statement.moduleSpecifier.text;
    });
}

function mockStylesheetSeams(): void {
    stylesheetSeams.forEach((specifier) => {
        jest.doMock(`../${specifier.slice(2)}`, () => ({}));
    });
}

describe('src/index', () => {
    afterEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('composes only root-owned stylesheets and feature stylesheet seams', () => {
        const imports = getSideEffectStylesheetImports();

        expect(imports).toEqual(stylesheetSeams);
        expect(imports).not.toContain(expect.stringMatching(/\/styles\.[^/]+\.css$/));
        expect(imports).not.toContain(expect.stringMatching(/\/shell\.[^/]+\.css$/));
    });

    it('installs the lineup bootstrap exactly once on direct module import', async () => {
        mockStylesheetSeams();

        let installLineupBootstrap!: jest.Mock;
        await jest.isolateModulesAsync(async () => {
            installLineupBootstrap = (await import('../bootstrap')).installLineupBootstrap as jest.Mock;
            await import('../index');
        });

        expect(installLineupBootstrap).toHaveBeenCalledTimes(1);
    });
});
