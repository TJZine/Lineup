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
const eagerFeatureStylesheets = [
    'now-playing-info',
    'player-osd',
    'channel-number-overlay',
    'channel-badge',
    'mini-guide',
    'channel-transition',
    'playback-options',
    'exit-confirm',
    'settings',
].map((feature) => `./modules/ui/${feature}/styles.css`);
const stylesheetSeams = [...rootStylesheets, ...eagerFeatureStylesheets, './styles/shell.css'];
const deferredStyleOwners = new Map([
    ['modules/ui/profile-select/index.ts', './styles.css'],
    ['modules/ui/server-select/index.ts', './styles.css'],
    ['modules/ui/audio-setup/index.ts', './styles.css'],
    ['modules/ui/channel-setup/index.ts', './styles.css'],
    ['modules/ui/epg/component/EPGComponent.ts', '../styles.css'],
]);

function getSideEffectStylesheetImports(sourcePath: string = indexPath): string[] {
    const source = ts.createSourceFile(
        sourcePath,
        readFileSync(sourcePath, 'utf8'),
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
        expect(getSideEffectStylesheetImports()).toEqual(stylesheetSeams);
    });

    it('loads deferred feature styles from their concrete dynamic module owners', () => {
        for (const [relativePath, stylesheet] of deferredStyleOwners) {
            const ownerPath = path.resolve(__dirname, '..', relativePath);
            expect(getSideEffectStylesheetImports(ownerPath)).toEqual([stylesheet]);
        }
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
