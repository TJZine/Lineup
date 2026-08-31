import { defineConfig, type PluginOption } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ command, mode }) => {
    const isDevBuildProfile = command === 'serve' || mode === 'dev' || mode === 'analyze-dev';
    const shouldAnalyze = mode === 'analyze' || mode === 'analyze-dev';
    const activeBuildProfile = isDevBuildProfile ? 'dev' : 'lean';

    return {
        base: './',
        define: {
            __LINEUP_DEV_BUILD__: JSON.stringify(isDevBuildProfile),
            __LINEUP_BUILD_PROFILE__: JSON.stringify(activeBuildProfile),
        },
        plugins: [
            shouldAnalyze
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
            rolldownOptions: {
                output: {
                    codeSplitting: {
                        groups: [
                            {
                                name: 'vendor',
                                test: /node_modules[\\/]/,
                            },
                        ],
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
