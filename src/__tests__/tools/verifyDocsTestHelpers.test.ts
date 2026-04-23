jest.mock('node:child_process', () => ({
    spawnSync: jest.fn(),
}));

describe('verifyDocsTestHelpers', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    it('loads prompt inventories lazily and memoizes the result', () => {
        const childProcess = jest.requireMock('node:child_process') as {
            spawnSync: jest.Mock;
        };

        childProcess.spawnSync.mockReset();
        childProcess.spawnSync.mockReturnValue({
            status: 0,
            stdout: JSON.stringify({
                expectedEvalPromptFiles: ['eval-one.md'],
                expectedSessionPromptFiles: ['session-one.md'],
                requiredRepoLocalSkills: ['verification-strategy'],
                requiredRepoLocalSkillFiles: ['.codex/skills/verification-strategy/SKILL.md'],
                skillMirrorManifestPath: '.agents/skills/marketplace.json',
                sessionPromptSetStartMarker: '<!-- session-start -->',
                sessionPromptSetEndMarker: '<!-- session-end -->',
                evalPromptInventoryStartMarker: '<!-- eval-start -->',
                evalPromptInventoryEndMarker: '<!-- eval-end -->',
                renderedSessionPromptSet: 'session inventory',
                renderedEvalPromptInventory: 'eval inventory',
            }),
        });

        jest.isolateModules(() => {
            const helpers = require('./verifyDocsTestHelpers') as typeof import('./verifyDocsTestHelpers');

            expect(childProcess.spawnSync).not.toHaveBeenCalled();

            const first = helpers.getPromptInventories();
            const second = helpers.getPromptInventories();

            expect(first).toBe(second);
            expect(first.expectedEvalPromptFiles).toEqual(['eval-one.md']);
            expect(childProcess.spawnSync).toHaveBeenCalledTimes(1);
        });
    });

    it('formats sync failures with signal details when status is unavailable', () => {
        const childProcess = jest.requireMock('node:child_process') as {
            spawnSync: jest.Mock;
        };
        childProcess.spawnSync.mockReset();

        jest.isolateModules(() => {
            const helpers = require('./verifyDocsTestHelpers') as typeof import('./verifyDocsTestHelpers');

            const message = helpers.formatSyncFailure(
                'node',
                ['tools/example.mjs'],
                {
                    status: null,
                    signal: 'SIGTERM',
                    stdout: '',
                    stderr: 'terminated',
                } as ReturnType<typeof import('node:child_process').spawnSync>
            );

            expect(message).toContain('signal=SIGTERM');
            expect(message).toContain('terminated');
        });
    });
});
