import { AppOrchestrator, type IAppOrchestrator } from '../../Orchestrator';

const assertContract = (value: IAppOrchestrator): IAppOrchestrator => value;

describe('AppOrchestrator public API contract', () => {
    it('satisfies IAppOrchestrator', () => {
        expect(assertContract(new AppOrchestrator())).toBeInstanceOf(AppOrchestrator);
    });
});
