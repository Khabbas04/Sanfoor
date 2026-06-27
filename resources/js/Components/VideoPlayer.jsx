import React, { useRef, useEffect, useState } from 'react';
import { Plyr } from 'plyr-react';
import 'plyr-react/plyr.css';
import { useTheme } from '@/Contexts/ThemeContext';

const plyrOptions = {
    controls: [
        'play-large', 'play', 'progress', 'current-time', 'duration',
        'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen',
    ],
    settings: ['captions', 'quality', 'speed'],
    invertTime: false,
    toggleInvert: true,
    tooltips: { controls: true, seek: true },
    keyboard: { focused: true, global: false },
    captions: { active: true, language: 'auto', update: true },
};

export default function VideoPlayer({ source, title, chapters }) {
    const { isDark } = useTheme();
    const playerRef = useRef(null);
    const [currentTime, setCurrentTime] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            const player = playerRef.current?.plyr;
            if (player && typeof player.currentTime === 'number') {
                setCurrentTime(player.currentTime);
            }
        }, 250);
        return () => clearInterval(interval);
    }, []);

    const handleSeek = (time) => {
        const player = playerRef.current?.plyr;
        if (player) {
            player.currentTime = time;
            player.play();
        }
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const playerContent = (
        <div className={`relative w-full rounded-2xl overflow-hidden shadow-2xl ${isDark ? 'bg-slate-900 ring-1 ring-slate-800' : 'bg-slate-100 ring-1 ring-slate-200'}`}>
            <style dangerouslySetInnerHTML={{ __html: `
                .plyr {
                    --plyr-color-main: #3b82f6;
                    --plyr-video-background: transparent;
                    border-radius: 1rem;
                    font-family: inherit;
                }
                .plyr__menu__container { direction: ltr; }
                .plyr__cue-title {
                    font-weight: 700;
                    color: white;
                    background: rgba(0,0,0,0.7);
                    padding: 4px 8px;
                    border-radius: 4px;
                }
            `}} />
            <Plyr 
                ref={playerRef} 
                source={source} 
                options={plyrOptions} 
                onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
            />
        </div>
    );

    if (!chapters || chapters.length === 0) {
        return playerContent;
    }

    return (
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 w-full" dir="rtl">
            <div className="flex-1 min-w-0">
                {playerContent}
            </div>
            <div className={`w-full lg:w-72 shrink-0 rounded-2xl overflow-hidden shadow-xl border ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className={`p-4 border-b ${isDark ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-slate-50'}`}>
                    <h3 className={`font-black text-lg flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        <span className="text-xl">📑</span> محتويات الفيديو
                    </h3>
                    <p className={`text-xs font-bold mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        اضغط على أي قسم للانتقال إليه مباشرة
                    </p>
                </div>
                <div className="p-2 space-y-1 max-h-[300px] lg:max-h-[400px] overflow-y-auto sfr-scrollbar">
                    {chapters.map((ch, idx) => {
                        const isActive = currentTime >= ch.startTime && (idx === chapters.length - 1 || currentTime < chapters[idx + 1].startTime);
                        return (
                            <button
                                key={idx}
                                onClick={() => handleSeek(ch.startTime)}
                                className={`w-full text-right flex items-center justify-between p-3 rounded-xl transition-all duration-300 group ${
                                    isActive 
                                        ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20 scale-[1.02]' 
                                        : isDark 
                                            ? 'hover:bg-slate-700/50 text-slate-300' 
                                            : 'hover:bg-slate-50 text-slate-600'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black ${
                                        isActive 
                                            ? 'bg-white/20 text-white' 
                                            : isDark 
                                                ? 'bg-slate-800 text-slate-400 group-hover:text-blue-400 group-hover:bg-blue-500/10' 
                                                : 'bg-slate-100 text-slate-500 group-hover:text-blue-600 group-hover:bg-blue-50'
                                    }`}>
                                        {idx + 1}
                                    </span>
                                    <span className={`text-sm font-bold ${isActive ? 'text-white' : ''}`}>
                                        {ch.title}
                                    </span>
                                </div>
                                <span className={`text-[10px] font-mono tracking-wider ${isActive ? 'text-blue-100' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {formatTime(ch.startTime)}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
