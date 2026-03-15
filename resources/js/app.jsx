import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from '@/Contexts/LanguageContext';
import { ThemeProvider } from '@/Contexts/ThemeContext';

const appName = import.meta.env.VITE_APP_NAME || 'Sanfoor';
const defaultTitle = 'سنفور | Sanfoor - المرشد الأكاديمي الذكي';

createInertiaApp({
    title: (title) => (title ? `${title} | ${appName}` : defaultTitle),
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.jsx`,
            import.meta.glob('./Pages/**/*.jsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <ThemeProvider>
                <LanguageProvider>
                    <App {...props} />
                </LanguageProvider>
            </ThemeProvider>
        );
    },
    progress: {
        color: '#4B5563',
    },
});
