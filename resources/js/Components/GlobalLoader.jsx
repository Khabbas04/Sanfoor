import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';

export default function GlobalLoader() {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        let timeoutId;
        let progressInterval;

        const handleStart = () => {
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
            }, 100);
        };

        const handleFinish = () => {
            clearTimeout(timeoutId);
            setProgress(100);
            
            // Wait for 100% animation to finish before fading out
            setTimeout(() => {
                setLoading(false);
                clearInterval(progressInterval);
                setTimeout(() => setProgress(0), 400); // reset after fade out
            }, 300);
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

    // We use pointer-events-none and opacity to smoothly fade in/out
    return (
        <div 
            className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#050B14]/95 backdrop-blur-md transition-all duration-500 ${
                loading ? 'opacity-100 visible pointer-events-auto' : 'opacity-0 invisible pointer-events-none'
            }`}
            dir="ltr"
        >
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes pulse-ring {
                    0% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.7); }
                    70% { transform: scale(1); box-shadow: 0 0 0 20px rgba(99, 102, 241, 0); }
                    100% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
                }
                .logo-ring {
                    animation: pulse-ring 2s infinite cubic-bezier(0.215, 0.61, 0.355, 1);
                }
            `}} />

            {/* Logo Container */}
            <div className="relative w-28 h-28 mb-8 flex items-center justify-center">
                {/* Glowing aura */}
                <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-2xl logo-ring"></div>
                
                {/* Outer spinning border */}
                <svg className="absolute inset-0 w-full h-full animate-spin-slow" style={{ animationDuration: '3s' }} viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                    <circle cx="50" cy="50" r="48" fill="none" stroke="#6366f1" strokeWidth="2" strokeDasharray="60 200" strokeLinecap="round" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="30 200" strokeLinecap="round" className="opacity-70" style={{ transformOrigin: 'center', transform: 'rotate(120deg)' }} />
                </svg>

                {/* The Logo */}
                <img 
                    src="/images/sanfoor.png" 
                    alt="Sanfoor Loading" 
                    className="w-16 h-16 object-contain relative z-10 drop-shadow-[0_0_15px_rgba(99,102,241,0.6)] animate-pulse" 
                />
            </div>

            {/* Progress Bar Container */}
            <div className="w-64 flex flex-col items-center">
                <div className="flex justify-between items-center w-full mb-3 px-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Loading</span>
                    <span className="text-[10px] font-black tracking-wider text-slate-400">{Math.round(progress)}%</span>
                </div>
                
                {/* The Bar */}
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden relative border border-white/5 shadow-inner">
                    <div 
                        className="h-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-violet-500 rounded-full transition-all duration-300 ease-out relative"
                        style={{ width: `${progress}%` }}
                    >
                        <div className="absolute top-0 right-0 bottom-0 left-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGc+PHBhdGggZD0iTTQwIDBMMCA0MEg0MEwwIDBaIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz48L2c+PC9zdmc+')] bg-[length:20px_20px] animate-[shimmer_1s_linear_infinite]"></div>
                    </div>
                </div>
            </div>
            
            <p className="mt-8 text-[11px] font-black text-slate-500 tracking-[0.2em] uppercase">Sanfoor AI System</p>
        </div>
    );
}
