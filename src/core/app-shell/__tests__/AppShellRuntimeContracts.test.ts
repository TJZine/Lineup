import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('AppShellRuntimeContracts boundaries', () => {
    it('does not depend on root orchestrator barrels or concrete orchestrator types', () => {
        const source = readFileSync(
            path.resolve(process.cwd(), 'src/core/app-shell/AppShellRuntimeContracts.ts'),
            'utf8'
        );

        expect(source).not.toMatch(/from ['"].*\/Orchestrator['"]/);
        expect(source).not.toMatch(/from ['"].*orchestrator\/AppOrchestrator['"]/);
        expect(source).not.toMatch(/from ['"].*orchestrator\/OrchestratorTypes['"]/);
    });

    it('does not expose the core server-selection result through the app-shell port', () => {
        const source = readFileSync(
            path.resolve(process.cwd(), 'src/core/app-shell/AppShellRuntimeContracts.ts'),
            'utf8'
        );

        expect(source).not.toMatch(/from ['"].*server-selection\/ServerSelectionTypes['"]/);
        expect(source).not.toContain('OrchestratorServerSelectionResult');
        expect(source).toContain('AppShellServerSelectionResult');
    });
});
