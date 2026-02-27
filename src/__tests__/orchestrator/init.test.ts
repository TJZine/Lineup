import { AppOrchestrator } from '../../Orchestrator';

describe('AppOrchestrator init suite', () => {
    it('provides module status map before initialization', () => {
        const orchestrator = new AppOrchestrator();
        expect(orchestrator.getModuleStatus()).toBeInstanceOf(Map);
    });

    it('seeds module status for channel number overlay UI', () => {
        const orchestrator = new AppOrchestrator();
        const status = orchestrator.getModuleStatus();
        expect(status.has('channel-number-overlay-ui')).toBe(true);
    });

    it('seeds module status for channel badge UI', () => {
        const orchestrator = new AppOrchestrator();
        const status = orchestrator.getModuleStatus();
        expect(status.has('channel-badge-ui')).toBe(true);
    });
});
