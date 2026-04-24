/** @jest-environment jsdom */

import { AppErrorCode, AppOrchestrator } from '../../Orchestrator';
import { createWebOsPlatformServices } from '../../platform';

describe('AppOrchestrator platform wiring suite', () => {
    it('maps AppError into LifecycleAppError', () => {
        const orchestrator = new AppOrchestrator();
        const lifecycleError = orchestrator.toLifecycleAppError({
            code: AppErrorCode.UNKNOWN,
            message: 'boom',
            recoverable: true,
        });

        expect(lifecycleError.code).toBe(AppErrorCode.UNKNOWN);
        expect(lifecycleError.message).toBe('boom');
        expect(lifecycleError.recoverable).toBe(true);
        expect(lifecycleError.phase).toBe('error');
    });

    it('gives fresh platform service bundles independent platform-version caches', () => {
        const webOsWindow = window as Window & typeof globalThis & {
            webOSTV?: { platform?: { version?: string } };
        };
        const hadOriginalWebOsTv = Object.prototype.hasOwnProperty.call(webOsWindow, 'webOSTV');
        const originalWebOsTv = webOsWindow.webOSTV;

        try {
            webOsWindow.webOSTV = { platform: { version: '24.0' } };
            const firstServices = createWebOsPlatformServices();

            expect(firstServices.identity.detectPlatformVersion()).toBe('24.0');

            webOsWindow.webOSTV = { platform: { version: '25.0' } };
            const secondServices = createWebOsPlatformServices();

            expect(firstServices.identity.detectPlatformVersion()).toBe('24.0');
            expect(secondServices.identity.detectPlatformVersion()).toBe('25.0');
            expect(
                secondServices.identity.getDefaultPlexIdentity('client-id')['X-Plex-Platform-Version']
            ).toBe('25.0');
        } finally {
            if (hadOriginalWebOsTv && originalWebOsTv !== undefined) {
                webOsWindow.webOSTV = originalWebOsTv;
            } else {
                delete webOsWindow.webOSTV;
            }
        }
    });
});
