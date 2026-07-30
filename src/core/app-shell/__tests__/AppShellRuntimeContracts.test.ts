import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('AppShellRuntimeContracts boundaries', () => {
    const source = readFileSync(
        path.resolve(process.cwd(), 'src/core/app-shell/runtime/AppShellRuntimeContracts.ts'),
        'utf8'
    );

    it.each([
        ['root orchestrator barrel', /from ['"].*\/Orchestrator['"]/],
        ['concrete orchestrator', /from ['"].*orchestrator\/AppOrchestrator['"]/],
        ['server-selection result owner', /server-selection\/ServerSelectionTypes/],
        ['core server-selection result', /OrchestratorServerSelectionResult/],
        ['selected-server storage getter', /getSelectedServerStorageKey/],
        ['server-health storage getter', /getServerHealthStorageKey/],
    ])('does not import or expose %s', (_boundary, forbidden) => {
        expect(source).not.toMatch(forbidden);
    });

    it.each([
        [
            'AppShellServerSelectionRuntimePort',
            ['getSelectedServerScreenState(): AppShellServerSelectState'],
        ],
        [
            'AppShellChannelSetupRuntimePort',
            [
                'getChannelSetupScreenWorkflowPort(): ChannelSetupScreenWorkflowPort',
                'getSelectedServerId(): string | null',
            ],
        ],
        [
            'AppShellDiagnosticsRuntimePort',
            ['getChannelSetupWorkflowPort(): ChannelSetupWorkflowPort'],
        ],
    ])('keeps the distinct %s shape', (interfaceName, members) => {
        const interfaceBlock = source.match(
            new RegExp(`export interface ${interfaceName} \\{[\\s\\S]*?\\n\\}`)
        )?.[0];

        expect(interfaceBlock).toBeDefined();
        members.forEach((member) => expect(interfaceBlock).toContain(member));
    });

    it('keeps workflow diagnostics out of the channel-setup screen port', () => {
        const channelSetupPort = source.match(
            /export interface AppShellChannelSetupRuntimePort \{[\s\S]*?\n\}/
        )?.[0];

        expect(channelSetupPort).not.toContain('getChannelSetupWorkflowPort');
        expect(channelSetupPort).not.toContain('getSetupPlanDiagnostics');
    });

    it('keeps the narrowed selected result without startup compatibility states', () => {
        const result = source.match(
            /export type AppShellServerSelectionResult =[\s\S]*?;\n\n/
        )?.[0];

        expect(result).toContain('persistedSelection');
        expect(result).toContain('epgRefresh');
        expect(result).not.toMatch(/startupResume|startup_pending|skipped_no_coordinator/);
    });
});
