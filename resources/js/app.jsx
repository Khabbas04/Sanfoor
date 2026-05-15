import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from '@/Contexts/LanguageContext';
import { ThemeProvider } from '@/Contexts/ThemeContext';
import GlobalLoader from '@/Components/GlobalLoader';
import ErrorBoundary from '@/Components/ErrorBoundary';

const appName = import.meta.env.VITE_APP_NAME || 'Sanfoor';
const defaultTitle = 'سنفور | Sanfoor - المرشد الأكاديمي الذكي';

createInertiaApp({
    title: (title) => (title ? `${title} | ${appName}` : defaultTitle),
    resolve: (name) => resolvePageComponent(`./Pages/${name}.jsx`, import.meta.glob('./Pages/**/*.jsx')),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <ErrorBoundary>
                <ThemeProvider>
                    <LanguageProvider>
                        <GlobalLoader />
                        <App {...props} />
                    </LanguageProvider>
                </ThemeProvider>
            </ErrorBoundary>
        );
    },
    progress: false,
});
