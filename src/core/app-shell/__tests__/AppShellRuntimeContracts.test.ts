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

    it('does not expose diagnostics on the channel setup screen runtime port', () => {
        const source = readFileSync(
            path.resolve(process.cwd(), 'src/core/app-shell/AppShellRuntimeContracts.ts'),
            'utf8'
        );
        const match = source.match(/export interface AppShellChannelSetupRuntimePort \{[\s\S]*?\n\}/);

        expect(match?.[0]).toBeDefined();
        expect(match?.[0]).not.toContain('ChannelSetupWorkflowPort');
        expect(match?.[0]).not.toContain('getSetupPlanDiagnostics');
        expect(match?.[0]).toContain('getChannelSetupScreenWorkflowPort(): ChannelSetupScreenWorkflowPort');
    });

    it('keeps the full channel setup workflow port on the diagnostics runtime port', () => {
        const source = readFileSync(
            path.resolve(process.cwd(), 'src/core/app-shell/AppShellRuntimeContracts.ts'),
            'utf8'
        );
        const match = source.match(/export interface AppShellDiagnosticsRuntimePort \{[\s\S]*?\n\}/);

        expect(match?.[0]).toBeDefined();
        expect(match?.[0]).toContain('getChannelSetupWorkflowPort(): ChannelSetupWorkflowPort');
    });
});
