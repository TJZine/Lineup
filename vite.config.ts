import { defineConfig, normalizePath, type PluginOption } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ command }) => {
    const requestedProfile = (process.env.LINEUP_BUILD_PROFILE ?? '').toLowerCase();
    const isDevBuildProfile = command === 'serve' || requestedProfile === 'dev';
    const activeBuildProfile = isDevBuildProfile ? 'dev' : 'lean';

    return {
        base: './',
        define: {
            __LINEUP_DEV_BUILD__: JSON.stringify(isDevBuildProfile),
            __LINEUP_BUILD_PROFILE__: JSON.stringify(activeBuildProfile),
        },
        plugins: [
            process.env.ANALYZE
                ? (visualizer({
                    template: 'raw-data',
                    filename: 'dist/bundle-stats.json',
                    gzipSize: true,
                    brotliSize: true,
                }) as PluginOption)
                : null,
        ],
        build: {
            outDir: 'dist',
            emptyOutDir: true,
            target: 'es2018',
            sourcemap: isDevBuildProfile,
            rollupOptions: {
                output: {
                    manualChunks(id): string | undefined {
                        const normalizedId = normalizePath(id);
                        if (normalizedId.includes('/node_modules/')) return 'vendor';
                        if (
                            normalizedId.includes('/src/modules/ui/channel-setup/')
                            || normalizedId.includes('/src/core/channel-setup/')
                        ) {
                            return 'channel-setup-flow';
                        }
                        if (
                            normalizedId.includes('/src/modules/ui/settings/')
                            && !normalizedId.endsWith('/src/modules/ui/settings/theme.ts')
                        ) {
                            return 'settings-flow';
                        }
                        return undefined;
                    },
                    onlyExplicitManualChunks: true,
                },
            },
        },
        server: {
            port: 5173,
            strictPort: true,
        },
    };
});
