import React, { useRef, useEffect } from 'react';
import Plyr from 'plyr-react';
import 'plyr-react/plyr.css';
import { useTheme } from '@/Contexts/ThemeContext';

export default function VideoPlayer({ source, title }) {
    const { isDark } = useTheme();
    const playerRef = useRef(null);

    // Customizing the player options to support chapters and custom controls
    const plyrOptions = {
        controls: [
            'play-large', // The large play button in the center
            'play', // Play/pause playback
            'progress', // The progress bar and scrubber for playback and buffering
            'current-time', // The current time of playback
            'duration', // The full duration of the media
            'mute', // Toggle mute
            'volume', // Volume control
            'captions', // Toggle captions
            'settings', // Settings menu
            'pip', // Picture-in-picture (currently Safari only)
            'airplay', // Airplay (currently Safari only)
            'fullscreen', // Toggle fullscreen
        ],
        settings: ['captions', 'quality', 'speed'],
        invertTime: false,
        toggleInvert: true,
        tooltips: { controls: true, seek: true },
        keyboard: { focused: true, global: false },
        captions: { active: true, language: 'auto', update: true },
    };

    return (
        <div className={`relative w-full rounded-2xl overflow-hidden shadow-2xl ${isDark ? 'bg-slate-900 ring-1 ring-slate-800' : 'bg-slate-100 ring-1 ring-slate-200'}`}>
            <style dangerouslySetInnerHTML={{ __html: `
                .plyr {
                    --plyr-color-main: #3b82f6; /* Tailwind Blue 500 */
                    --plyr-video-background: transparent;
                    border-radius: 1rem;
                    font-family: inherit;
                }
                .plyr__menu__container {
                    direction: ltr; /* Keep settings menu ltr for standard layout */
                }
                .plyr__cue-title { /* Style for chapter titles on hover */
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
            />
        </div>
    );
}
