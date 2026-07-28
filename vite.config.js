import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [
        laravel({
            input: 'resources/js/app.jsx',
            refresh: true,
        }),
        react(),
    ],
    build: {
        // Keep hashed files from the immediately previous deployment. Open browser
        // sessions may still reference those chunks until Inertia reloads them.
        emptyOutDir: false,
        sourcemap: false,
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                manualChunks: {
                    react_vendor: ['react', 'react-dom', '@inertiajs/react'],
                    chart_vendor: ['recharts', 'reactflow', 'dagre']
                }
            }
        }
    }
});
