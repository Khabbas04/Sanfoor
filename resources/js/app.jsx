import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from '@/Contexts/LanguageContext';
import { ThemeProvider } from '@/Contexts/ThemeContext';
import GlobalLoader from '@/Components/GlobalLoader';
import { AnimatePresence, motion } from 'framer-motion';

// This persistent layout wrapper allows for true crossfading between pages.
// By defining it outside, its reference never changes, preventing full DOM tear-downs.
const layoutFunction = (page) => {
    // Use the component name or URL as a unique key for AnimatePresence to track page changes.
    const key = typeof window !== 'undefined' ? window.location.pathname : page.type.name;
    
    return (
        // Use a CSS grid to overlap the old and new pages during the transition.
        // This prevents vertical stacking and eliminates the "white screen" flash!
        <div className="w-full min-h-screen grid" style={{ gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }}>
            <AnimatePresence>
                <motion.div
                    key={key}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                    style={{ gridColumn: 1, gridRow: 1 }}
                    className="w-full h-full flex flex-col"
                >
                    {page}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

// Resolve the application name used in browser titles.
const appName = import.meta.env.VITE_APP_NAME || 'Sanfoor';

// Use a stable fallback title when a page does not define its own title.
const defaultTitle = 'سنفور | Sanfoor - المرشد الأكاديمي الذكي';

createInertiaApp({
    // Standardize the browser title format for all Inertia pages.
    title: (title) => (title ? `${title} | ${appName}` : defaultTitle),

    // Resolve page components lazily from the Pages directory.
    resolve: (name) => {
        const pagePromise = resolvePageComponent(
            `./Pages/${name}.jsx`,
            import.meta.glob('./Pages/**/*.jsx'),
        );

        pagePromise.then((module) => {
            const originalLayout = module.default.layout;
            
            // Apply the global crossfade layout to every page, 
            // PRESERVING the existing layout (like Tree page) if it has one!
            module.default.layout = (page) => {
                const element = originalLayout ? originalLayout(page) : page;
                return layoutFunction(element);
            };
        });

        return pagePromise;
    },

    // Wrap the application with global providers before rendering the page.
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <ThemeProvider>
                <LanguageProvider>
                    <GlobalLoader />
                    <App {...props} />
                </LanguageProvider>
            </ThemeProvider>
        );
    },

    // Disable the default Inertia progress bar since we use GlobalLoader.
    progress: false,
});
