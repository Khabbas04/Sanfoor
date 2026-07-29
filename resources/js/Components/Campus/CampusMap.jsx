import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTheme } from '@/Contexts/ThemeContext';

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */

// Al-Zarqa University — default center for the campus map.
const DEFAULT_CENTER = [36.0933, 32.0544]; // [lng, lat]
const DEFAULT_ZOOM = 17;
const DEFAULT_PITCH = 65;
const DEFAULT_BEARING = -35;
const MIN_ZOOM = 14;
const MAX_ZOOM = 20;

// University buildings placeholder — ready for future data.
const CAMPUS_BUILDINGS = [
    // Example structure for future use:
    // {
    //     id: 'farouk',
    //     name: 'مبنى الفاروق',
    //     symbol: 'أ.ب',
    //     center: [36.0930, 32.0545],
    //     color: '#6366f1',
    //     colleges: ['كلية الشريعة', 'كلية تكنولوجيا المعلومات'],
    // },
];

/* ═══════════════════════════════════════════════════════════
   ERROR STATE
   ═══════════════════════════════════════════════════════════ */

function MapTokenError() {
    return (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-[#0c1222] to-indigo-950 relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/8 rounded-full blur-[120px]" />
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-500/8 rounded-full blur-[100px]" />
                <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, #fff 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />
            </div>

            <div className="relative z-10 text-center max-w-lg px-6" dir="rtl">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 border border-rose-400/20 flex items-center justify-center backdrop-blur-sm shadow-2xl shadow-rose-500/10">
                    <span className="text-4xl">🗺️</span>
                </div>
                <h2 className="text-2xl font-[900] text-white mb-3 tracking-tight">
                    الخريطة غير متاحة حالياً
                </h2>
                <p className="text-sm text-white/50 font-bold leading-relaxed mb-6">
                    لم يتم تهيئة مفتاح Mapbox بعد. يرجى إضافة
                    <code className="mx-1.5 px-2 py-0.5 bg-white/10 text-amber-300 rounded-md text-[11px] font-mono border border-white/10">VITE_MAPBOX_TOKEN</code>
                    في ملف البيئة لتفعيل خريطة الحرم الجامعي.
                </p>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left backdrop-blur-sm">
                    <p className="text-[10px] font-mono text-white/30 mb-1">.env</p>
                    <code className="text-[12px] font-mono text-emerald-400">
                        VITE_MAPBOX_TOKEN=pk.eyJ1Ijoi...
                    </code>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   LOADING STATE
   ═══════════════════════════════════════════════════════════ */

function MapLoader() {
    return (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 backdrop-blur-md transition-opacity duration-500">
            <div className="text-center" dir="rtl">
                <div className="relative w-16 h-16 mx-auto mb-4">
                    <div className="absolute inset-0 rounded-2xl bg-indigo-500/20 animate-ping" />
                    <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30">
                        <span className="text-2xl">🌍</span>
                    </div>
                </div>
                <p className="text-sm font-[800] text-white/70">جاري تحميل الخريطة...</p>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   FLOATING CONTROLS OVERLAY
   ═══════════════════════════════════════════════════════════ */

function FloatingControls({ map, isDark }) {
    const handleResetView = useCallback(() => {
        if (!map) return;
        map.flyTo({
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            pitch: DEFAULT_PITCH,
            bearing: DEFAULT_BEARING,
            duration: 1800,
            essential: true,
        });
    }, [map]);

    const handleZoomIn = useCallback(() => {
        if (!map) return;
        map.zoomIn({ duration: 300 });
    }, [map]);

    const handleZoomOut = useCallback(() => {
        if (!map) return;
        map.zoomOut({ duration: 300 });
    }, [map]);

    const handleToggle3D = useCallback(() => {
        if (!map) return;
        const currentPitch = map.getPitch();
        map.easeTo({
            pitch: currentPitch > 10 ? 0 : DEFAULT_PITCH,
            duration: 800,
        });
    }, [map]);

    const handleNorthUp = useCallback(() => {
        if (!map) return;
        map.easeTo({
            bearing: 0,
            duration: 600,
        });
    }, [map]);

    const btnBase = `
        w-10 h-10 flex items-center justify-center text-[14px] font-[900] 
        transition-all duration-200 active:scale-90
        backdrop-blur-xl border
        ${isDark
            ? 'bg-slate-900/80 border-white/10 text-white/80 hover:bg-slate-800/90 hover:text-white'
            : 'bg-white/80 border-slate-200/60 text-slate-700 hover:bg-white/95 hover:text-slate-900'
        }
    `;

    return (
        <>
            {/* Right side floating controls */}
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2" dir="rtl">
                {/* Reset view button */}
                <button
                    type="button"
                    onClick={handleResetView}
                    title="إعادة العرض الافتراضي"
                    aria-label="إعادة العرض الافتراضي"
                    className={`${btnBase} rounded-xl shadow-lg`}
                >
                    🏠
                </button>
            </div>

            {/* Bottom-left custom controls */}
            <div className="absolute bottom-6 left-4 z-20 flex flex-col gap-2">
                {/* Zoom cluster */}
                <div className={`flex flex-col overflow-hidden rounded-2xl shadow-xl border ${isDark ? 'bg-slate-900/80 border-white/10' : 'bg-white/80 border-slate-200/60'} backdrop-blur-xl`}>
                    <button type="button" onClick={handleZoomIn} title="تقريب" aria-label="تقريب"
                        className={`${btnBase} rounded-none border-0`}>
                        +
                    </button>
                    <div className={`h-px ${isDark ? 'bg-white/10' : 'bg-slate-200/80'}`} />
                    <button type="button" onClick={handleZoomOut} title="تبعيد" aria-label="تبعيد"
                        className={`${btnBase} rounded-none border-0`}>
                        −
                    </button>
                </div>

                {/* 3D toggle */}
                <button
                    type="button"
                    onClick={handleToggle3D}
                    title="تبديل العرض ثلاثي الأبعاد"
                    aria-label="تبديل العرض ثلاثي الأبعاد"
                    className={`${btnBase} rounded-xl shadow-lg`}
                >
                    🏔️
                </button>

                {/* North-up compass */}
                <button
                    type="button"
                    onClick={handleNorthUp}
                    title="توجيه الشمال للأعلى"
                    aria-label="توجيه الشمال للأعلى"
                    className={`${btnBase} rounded-xl shadow-lg`}
                >
                    🧭
                </button>
            </div>
        </>
    );
}

/* ═══════════════════════════════════════════════════════════
   COORDINATES DISPLAY
   ═══════════════════════════════════════════════════════════ */

function CoordinatesBar({ coordinates, zoom, pitch, isDark }) {
    if (!coordinates) return null;

    return (
        <div className={`absolute bottom-4 right-4 z-20 px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold shadow-lg border backdrop-blur-xl select-none ${isDark
            ? 'bg-slate-900/80 border-white/10 text-white/50'
            : 'bg-white/80 border-slate-200/60 text-slate-500'
            }`}
            dir="ltr"
        >
            {coordinates.lat.toFixed(5)}, {coordinates.lng.toFixed(5)} · Z{zoom.toFixed(1)} · P{pitch.toFixed(0)}°
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   MAIN CAMPUS MAP COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function CampusMap({
    center = DEFAULT_CENTER,
    zoom = DEFAULT_ZOOM,
    pitch = DEFAULT_PITCH,
    bearing = DEFAULT_BEARING,
    buildings = CAMPUS_BUILDINGS,
    className = '',
}) {
    const { isDark } = useTheme();
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [mapInstance, setMapInstance] = useState(null);
    const [coordinates, setCoordinates] = useState(null);
    const [currentZoom, setCurrentZoom] = useState(zoom);
    const [currentPitch, setCurrentPitch] = useState(pitch);

    // Token validation
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    const hasToken = Boolean(token && token.trim() && token !== 'undefined');

    // Initialize the map exactly once.
    useEffect(() => {
        if (!hasToken || !mapContainerRef.current || mapRef.current) return;

        mapboxgl.accessToken = token;

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/standard',
            center,
            zoom,
            pitch,
            bearing,
            minZoom: MIN_ZOOM,
            maxZoom: MAX_ZOOM,
            antialias: true,
            attributionControl: false,
            logoPosition: 'bottom-left',
            fadeDuration: 300,
            trackResize: true,
            useWebGL2: true,
        });

        mapRef.current = map;

        // Compact attribution to bottom-right
        map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

        // Fullscreen control
        map.addControl(new mapboxgl.FullscreenControl({
            container: mapContainerRef.current,
        }), 'top-left');

        // Scale bar
        map.addControl(new mapboxgl.ScaleControl({
            maxWidth: 120,
            unit: 'metric',
        }), 'bottom-left');

        // ── Events ──
        map.on('load', () => {
            setIsLoaded(true);
            setMapInstance(map);

            // Enable 3D buildings on the standard style
            try {
                if (map.getConfigProperty) {
                    map.setConfigProperty('basemap', 'showPlaceLabels', true);
                    map.setConfigProperty('basemap', 'showPointOfInterestLabels', true);
                    map.setConfigProperty('basemap', 'show3dObjects', true);
                }
            } catch {
                // Standard style config API may not be available on all versions
            }
        });

        map.on('mousemove', (e) => {
            setCoordinates({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        });

        map.on('zoom', () => {
            setCurrentZoom(map.getZoom());
        });

        map.on('pitch', () => {
            setCurrentPitch(map.getPitch());
        });

        // Add building markers when buildings data is provided
        map.on('style.load', () => {
            addBuildingMarkers(map, buildings);
        });

        // Cleanup on unmount
        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, [hasToken]); // eslint-disable-line react-hooks/exhaustive-deps

    // If no token, show error state
    if (!hasToken) {
        return (
            <div className={`w-full h-full ${className}`}>
                <MapTokenError />
            </div>
        );
    }

    return (
        <div className={`relative w-full h-full overflow-hidden ${className}`}>
            {/* Map container */}
            <div
                ref={mapContainerRef}
                className="absolute inset-0 w-full h-full"
                style={{ cursor: 'grab' }}
            />

            {/* Loading overlay */}
            {!isLoaded && <MapLoader />}

            {/* Custom floating controls */}
            {isLoaded && (
                <>
                    <FloatingControls map={mapInstance} isDark={isDark} />
                    <CoordinatesBar
                        coordinates={coordinates}
                        zoom={currentZoom}
                        pitch={currentPitch}
                        isDark={isDark}
                    />
                </>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   HELPERS — Building Markers (prepared for future data)
   ═══════════════════════════════════════════════════════════ */

function addBuildingMarkers(map, buildings) {
    if (!buildings || buildings.length === 0) return;

    buildings.forEach((building) => {
        // Create a custom marker element
        const el = document.createElement('div');
        el.className = 'campus-building-marker';
        el.innerHTML = `
            <div style="
                background: ${building.color || '#6366f1'};
                color: white;
                padding: 6px 12px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 900;
                font-family: 'Cairo', sans-serif;
                box-shadow: 0 4px 20px ${building.color || '#6366f1'}40;
                border: 2px solid rgba(255,255,255,0.25);
                backdrop-filter: blur(8px);
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s;
                white-space: nowrap;
                text-align: center;
                line-height: 1.4;
            ">
                <div style="font-size: 13px;">${building.symbol || '📍'}</div>
                <div style="font-size: 10px; opacity: 0.85;">${building.name}</div>
            </div>
        `;

        el.addEventListener('mouseenter', () => {
            el.style.transform = 'scale(1.1) translateY(-2px)';
        });
        el.addEventListener('mouseleave', () => {
            el.style.transform = 'scale(1) translateY(0)';
        });

        new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat(building.center)
            .addTo(map);
    });
}
