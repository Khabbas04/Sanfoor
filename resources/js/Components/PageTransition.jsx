import React, { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import { useTheme } from '@/Contexts/ThemeContext';

export default function PageTransition() {
    const [isTransitioning, setIsTransitioning] = useState(false);
    const { isDark } = useTheme();

    useEffect(() => {
        const handleStart = () => {
            // Immediately start fading out the current page
            setIsTransitioning(true);
        };
        
        const handleFinish = () => {
            // Give the new page a tiny moment to render before fading back in
            setTimeout(() => {
                setIsTransitioning(false);
            }, 100);
        };

        const removeStart = router.on('start', handleStart);
        const removeFinish = router.on('finish', handleFinish);

        return () => {
            removeStart();
            removeFinish();
        };
    }, []);

    return (
        <div 
            className={`fixed inset-0 z-[99998] pointer-events-none transition-opacity duration-300 ease-in-out ${
                isDark ? 'bg-[#0a0f18]' : 'bg-[#fafcff]'
            } ${isTransitioning ? 'opacity-100' : 'opacity-0'}`}
            style={{
                // Ensure it covers everything but doesn't block clicks when invisible
                pointerEvents: isTransitioning ? 'auto' : 'none'
            }}
        />
    );
}
