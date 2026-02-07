import { defineConfig, type PluginOption } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ command }) => {
    const requestedProfile = (process.env.RETUNE_BUILD_PROFILE ?? '').toLowerCase();
    const isDevBuildProfile = command === 'serve' || requestedProfile === 'dev';
    const activeBuildProfile = isDevBuildProfile ? 'dev' : 'lean';

    return {
        base: './',
        define: {
            __RETUNE_DEV_BUILD__: JSON.stringify(isDevBuildProfile),
            __RETUNE_BUILD_PROFILE__: JSON.stringify(activeBuildProfile),
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
                        if (id.includes('node_modules')) return 'vendor';
                        if (
                            id.includes('/src/modules/ui/epg/') ||
                            id.includes('/src/modules/plex/') ||
                            id.includes('/src/modules/player/') ||
                            id.includes('/src/modules/scheduler/') ||
                            id.includes('/src/modules/navigation/') ||
                            id.includes('/src/modules/lifecycle/') ||
                            id.includes('/src/core/')
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
