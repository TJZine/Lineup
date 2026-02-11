import { AppOrchestrator } from '../../Orchestrator';

describe('AppOrchestrator init suite', () => {
    it('provides module status map before initialization', () => {
        const orchestrator = new AppOrchestrator();
        expect(orchestrator.getModuleStatus()).toBeInstanceOf(Map);
    });
});
