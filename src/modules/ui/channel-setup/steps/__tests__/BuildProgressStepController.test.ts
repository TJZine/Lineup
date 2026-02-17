/**
 * @jest-environment jsdom
 */

import { flushPromises } from '../../../../../__tests__/helpers';
import { BuildProgressStepController } from '../BuildProgressStepController';
import type { BuildProgressDeps, StepRenderContext } from '../types';

const createContext = (): StepRenderContext => {
    const contentEl = document.createElement('div');
    const stepEl = document.createElement('div');
    const statusEl = document.createElement('div');
    const detailEl = document.createElement('div');
    const errorEl = document.createElement('div');
    return { contentEl, stepEl, statusEl, detailEl, errorEl };
};

describe('BuildProgressStepController', () => {
    afterEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('surfaces startBuild failures to the user and re-enables Back', async () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);

        const startBuild = jest.fn().mockRejectedValue(new Error('boom'));
        const deps: BuildProgressDeps = {
            state: { isBuilding: true },
            registerFocusables: jest.fn(),
            onCancelOrBack: jest.fn(),
            onDone: jest.fn(),
            startBuild,
        };

        const controller = new BuildProgressStepController();
        controller.render(ctx, deps);

        await flushPromises();

        const backButton = ctx.contentEl.querySelector('#setup-back') as HTMLButtonElement | null;
        const doneButton = ctx.contentEl.querySelector('#setup-done') as HTMLButtonElement | null;
        const taskLabel = ctx.contentEl.querySelector('.setup-progress-task') as HTMLElement | null;

        expect(ctx.errorEl.textContent ?? '').not.toBe('');
        expect(taskLabel?.textContent ?? '').toContain('failed');
        expect(backButton?.disabled).toBe(false);
        expect(backButton?.textContent).toBe('Back');
        expect(doneButton?.disabled).toBe(true);
    });

    it('ignores abort-like startBuild errors and does not surface them to the user', async () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);

        const startBuild = jest.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));
        const deps: BuildProgressDeps = {
            state: { isBuilding: true },
            registerFocusables: jest.fn(),
            onCancelOrBack: jest.fn(),
            onDone: jest.fn(),
            startBuild,
        };

        const controller = new BuildProgressStepController();
        controller.render(ctx, deps);

        await flushPromises();

        const backButton = ctx.contentEl.querySelector('#setup-back') as HTMLButtonElement | null;
        const doneButton = ctx.contentEl.querySelector('#setup-done') as HTMLButtonElement | null;
        expect(ctx.errorEl.textContent ?? '').toBe('');
        expect(backButton?.textContent).toBe('Cancel');
        expect(backButton?.disabled).toBe(false);
        expect(doneButton?.disabled).toBe(true);
    });
});
