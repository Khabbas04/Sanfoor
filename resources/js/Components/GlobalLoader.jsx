import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';

export default function GlobalLoader() {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        let timeoutId;
        let progressInterval;
        let activeRequests = 0;

        const handleStart = () => {
            activeRequests++;
            if (activeRequests === 1) {
                // Show loader slightly delayed to avoid flash on instant loads
                timeoutId = setTimeout(() => {
                    setLoading(true);
                    setProgress(0);
                    
                    // Simulate progress
                    progressInterval = setInterval(() => {
                        setProgress(prev => {
                            if (prev >= 90) return prev;
                            return prev + Math.random() * 10;
                        });
                    }, 100);
                }, 5000); // 5 seconds delay
            }
        };

        const handleFinish = () => {
            activeRequests = Math.max(0, activeRequests - 1);
            if (activeRequests === 0) {
                clearTimeout(timeoutId);
                clearInterval(progressInterval);
                setProgress(100);
                
                // Wait for 100% animation to finish before fading out
                setTimeout(() => {
                    setLoading(false);
                    setTimeout(() => setProgress(0), 400); // reset after fade out
                }, 300);
            }
        };

        // Inertia event listeners
        const removeStart = router.on('start', handleStart);
        const removeFinish = router.on('finish', handleFinish);

        return () => {
            removeStart();
            removeFinish();
            clearTimeout(timeoutId);
            clearInterval(progressInterval);
        };
    }, []);

    // We use a floating dynamic pill so it doesn't block the beautiful page transitions
    return (
        <div 
            className={`fixed top-8 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-4 px-5 py-3 rounded-full bg-[#0a0f18]/90 backdrop-blur-xl border border-indigo-500/20 shadow-[0_20px_50px_-10px_rgba(99,102,241,0.3)] transition-all duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                loading ? 'opacity-100 translate-y-0 scale-100 visible' : 'opacity-0 -translate-y-8 scale-90 invisible pointer-events-none'
            }`}
            dir="ltr"
        >
            {/* Spinning Logo Container */}
            <div className="relative w-9 h-9 flex items-center justify-center shrink-0">
                <div className="absolute inset-0 bg-indigo-500/30 rounded-full blur-md animate-pulse"></div>
                
                {/* Outer spinning borders */}
                <svg className="absolute inset-[-4px] w-[calc(100%+8px)] h-[calc(100%+8px)] animate-[spin_3s_linear_infinite]" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
                    <circle cx="50" cy="50" r="46" fill="none" stroke="#6366f1" strokeWidth="3" strokeDasharray="60 200" strokeLinecap="round" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#06b6d4" strokeWidth="2" strokeDasharray="30 200" strokeLinecap="round" className="opacity-70" style={{ transformOrigin: 'center', transform: 'rotate(120deg)' }} />
                </svg>

                <img 
                    src="/images/sanfoor.png" 
                    alt="Loading" 
                    className="w-5 h-5 object-contain relative z-10" 
                />
            </div>

            {/* Progress Bar & Text */}
            <div className="flex flex-col justify-center gap-1.5 w-32 sm:w-40 mr-1">
                <div className="flex justify-between items-center w-full leading-none">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-300">Sanfoor AI</span>
                    <span className="text-[10px] font-black tracking-wider text-slate-300">{Math.round(progress)}%</span>
                </div>
                
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden relative shadow-inner">
                    <div 
                        className="h-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-violet-500 rounded-full transition-all duration-300 ease-out relative"
                        style={{ width: `${progress}%` }}
                    >
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGc+PHBhdGggZD0iTTQwIDBMMCA0MEg0MEwwIDBaIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz48L2c+PC9zdmc+')] bg-[length:20px_20px] animate-[shimmer_1s_linear_infinite]"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
