import React, { Suspense } from 'react';
import { Head, Link } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

const CampusMap = React.lazy(() => import('@/Components/Campus/CampusMap'));

const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');

/* ═══════════════════════════════════════════════════════════
   MAP LOADING FALLBACK
   ═══════════════════════════════════════════════════════════ */

function MapFallback() {
    return (
        <div className="w-full h-full flex items-center justify-center bg-slate-950">
            <div className="text-center" dir="rtl">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30 animate-pulse">
                    <span className="text-2xl">🌍</span>
                </div>
                <p className="text-sm font-[800] text-white/60">جاري تحميل خريطة الحرم...</p>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   FLOATING HEADER
   ═══════════════════════════════════════════════════════════ */

function FloatingHeader({ isDark }) {
    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-2rem)] max-w-2xl" dir="rtl">
            <div className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl shadow-2xl border backdrop-blur-xl ${isDark
                ? 'bg-slate-900/75 border-white/10 shadow-black/20'
                : 'bg-white/75 border-slate-200/60 shadow-slate-900/10'
                }`}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-md ${isDark
                        ? 'bg-indigo-500/20 border border-indigo-400/20 shadow-indigo-500/10'
                        : 'bg-indigo-50 border border-indigo-100 shadow-indigo-200/30'
                        }`}
                    >
                        🗺️
                    </div>
                    <div className="min-w-0">
                        <h1 className={`text-[14px] font-[900] truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            خريطة الحرم الجامعي
                        </h1>
                        <p className={`text-[10px] font-bold truncate ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
                            عرض ثلاثي الأبعاد تفاعلي
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <Link
                        href={route('campus.directory')}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-[800] transition-all shadow-sm border ${isDark
                            ? 'bg-white/10 text-white/70 border-white/10 hover:bg-white/20'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                    >
                        📋 دليل المباني
                    </Link>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   CAMPUS MAP PAGE
   ═══════════════════════════════════════════════════════════ */

export default function CampusMapPage() {
    const { isDark } = useTheme();
    const { lang } = useLanguage();

    return (
        <div className="w-full h-full min-h-0 flex flex-col overflow-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <Head>
                <title>{lang === 'ar' ? 'خريطة الحرم الجامعي | سنفور' : 'Campus Map | Sanfoor'}</title>
                <meta
                    name="description"
                    content={lang === 'ar'
                        ? 'استكشف حرم الجامعة بخريطة تفاعلية ثلاثية الأبعاد. حدد المباني والكليات والمرافق بسهولة.'
                        : 'Explore the university campus with an interactive 3D map. Find buildings, colleges, and facilities easily.'
                    }
                />
                <meta name="robots" content="noindex,nofollow,noarchive" />
                <link rel="canonical" href={`${siteUrl}/campus-map`} />
            </Head>

            <style dangerouslySetInnerHTML={{
                __html: `
                /* Override Mapbox controls to match Sanfoor design */
                .mapboxgl-ctrl-group {
                    border-radius: 16px !important;
                    overflow: hidden !important;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.12) !important;
                    border: 1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} !important;
                    background: ${isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)'} !important;
                    backdrop-filter: blur(20px) saturate(180%) !important;
                    -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
                }
                .mapboxgl-ctrl-group button {
                    width: 36px !important;
                    height: 36px !important;
                    border: none !important;
                    background: transparent !important;
                }
                .mapboxgl-ctrl-group button + button {
                    border-top: 1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} !important;
                }
                .mapboxgl-ctrl-group button:hover {
                    background: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'} !important;
                }
                .mapboxgl-ctrl-group button .mapboxgl-ctrl-icon {
                    filter: ${isDark ? 'invert(0.7)' : 'none'};
                }
                .mapboxgl-ctrl-attrib {
                    border-radius: 12px !important;
                    padding: 3px 8px !important;
                    font-size: 9px !important;
                    background: ${isDark ? 'rgba(15,23,42,0.75)' : 'rgba(255,255,255,0.75)'} !important;
                    backdrop-filter: blur(12px) !important;
                    -webkit-backdrop-filter: blur(12px) !important;
                    color: ${isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)'} !important;
                    border: 1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'} !important;
                }
                .mapboxgl-ctrl-attrib a {
                    color: ${isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)'} !important;
                }
                .mapboxgl-ctrl-scale {
                    border-radius: 8px !important;
                    padding: 2px 6px !important;
                    font-size: 9px !important;
                    font-weight: 700 !important;
                    background: ${isDark ? 'rgba(15,23,42,0.75)' : 'rgba(255,255,255,0.75)'} !important;
                    backdrop-filter: blur(12px) !important;
                    -webkit-backdrop-filter: blur(12px) !important;
                    color: ${isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} !important;
                    border: 1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} !important;
                    border-top: 1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} !important;
                }
                .mapboxgl-ctrl-fullscreen .mapboxgl-ctrl-icon,
                .mapboxgl-ctrl-shrink .mapboxgl-ctrl-icon {
                    filter: ${isDark ? 'invert(0.7)' : 'none'};
                }
                .mapboxgl-ctrl-logo {
                    opacity: ${isDark ? '0.3' : '0.5'} !important;
                }
                /* Smooth canvas transition */
                .mapboxgl-canvas {
                    outline: none !important;
                }
                /* Building marker animations */
                .campus-building-marker {
                    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                }
                `
            }} />

            {/* Fullscreen map area */}
            <div className="flex-1 relative w-full min-h-0">
                <FloatingHeader isDark={isDark} />

                <Suspense fallback={<MapFallback />}>
                    <CampusMap />
                </Suspense>
            </div>
        </div>
    );
}

CampusMapPage.layout = (page) => (
    <MainLayout absoluteNavbar hideNavbarOnMobileLandscape appShell>
        {page}
    </MainLayout>
);
