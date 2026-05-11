import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from '@/Contexts/LanguageContext';
import { ThemeProvider } from '@/Contexts/ThemeContext';
import GlobalLoader from '@/Components/GlobalLoader';
import PageTransition from '@/Components/PageTransition';

// Resolve the application name used in browser titles.
const appName = import.meta.env.VITE_APP_NAME || 'Sanfoor';

// Use a stable fallback title when a page does not define its own title.
const defaultTitle = 'سنفور | Sanfoor - المرشد الأكاديمي الذكي';

createInertiaApp({
    // Standardize the browser title format for all Inertia pages.
    title: (title) => (title ? `${title} | ${appName}` : defaultTitle),

    // Resolve page components lazily from the Pages directory.
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.jsx`,
            import.meta.glob('./Pages/**/*.jsx'),
        ),

    // Wrap the application with global providers before rendering the page.
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <ThemeProvider>
                <LanguageProvider>
                    <PageTransition />
                    <GlobalLoader />
                    <App {...props} />
                </LanguageProvider>
            </ThemeProvider>
        );
    },

    // Disable the default Inertia progress bar since we use GlobalLoader.
    progress: false,
});
