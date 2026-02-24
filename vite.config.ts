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
                            normalizedId.includes('/src/modules/ui/epg/') ||
                            normalizedId.includes('/src/modules/plex/') ||
                            normalizedId.includes('/src/modules/player/') ||
                            normalizedId.includes('/src/modules/scheduler/') ||
                            normalizedId.includes('/src/modules/navigation/') ||
                            normalizedId.includes('/src/modules/lifecycle/') ||
                            normalizedId.includes('/src/core/')
                        ) {
                            // Keep tightly-coupled runtime systems together to avoid circular chunk warnings.
                            return 'engine';
                        }
                        return undefined;
                    },
                },
            },
        },
        server: {
            port: 5173,
            strictPort: true,
        },
    };
});
