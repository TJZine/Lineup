import { AppOrchestrator } from '../../Orchestrator';

describe('AppOrchestrator startup routing suite', () => {
    it('open/close/toggle EPG are safe before module wiring', () => {
        const orchestrator = new AppOrchestrator();
        expect(() => orchestrator.openEPG()).not.toThrow();
        expect(() => orchestrator.closeEPG()).not.toThrow();
        expect(() => orchestrator.toggleEPG()).not.toThrow();
    });
});
