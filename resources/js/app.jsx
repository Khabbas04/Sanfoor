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
    const key = typeof window !== 'undefined' ? window.location.pathname : (page?.type?.name || 'page');
    
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

import ErrorBoundary from '@/Components/ErrorBoundary';

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
            // Prevent recursive wrapping on router.reload() which causes the layout to unmount and flash
            if (!module?.default) return;
            if (module.default.__hasCrossfadeLayout) return;
            
            const originalLayout = module.default.layout;
            
            // Apply the global crossfade layout to every page, 
            // PRESERVING the existing layout (like Tree page) if it has one!
            module.default.layout = (page) => {
                if (!page) return null;
                
                let element;
                if (typeof originalLayout === 'function') {
                    // It's a function layout (like page => <Layout>{page}</Layout>)
                    element = originalLayout(page);
                } else if (originalLayout) {
                    // It's a component layout (like LayoutComponent)
                    const Layout = originalLayout;
                    element = <Layout>{page}</Layout>;
                } else {
                    // No layout defined
                    element = page;
                }
                
                return layoutFunction(element);
            };
            
            module.default.__hasCrossfadeLayout = true;
        });

        return pagePromise;
    },

    // Wrap the application with global providers before rendering the page.
    setup({ el, App, props }) {
        const root = createRoot(el);

        console.log('--- Inertia Debug [v5] ---');
        console.log('Page Name:', props.initialPage.component);
        console.log('Props Keys:', Object.keys(props.initialPage.props));
        console.log('--------------------------');

        root.render(
            <ErrorBoundary>
                <ThemeProvider>
                    <LanguageProvider>
                        <GlobalLoader />
                        <App {...(props || {})} />
                    </LanguageProvider>
                </ThemeProvider>
            </ErrorBoundary>
        );
    },

    // Disable the default Inertia progress bar since we use GlobalLoader.
    progress: false,
});
