import { Link } from '@inertiajs/react';

export default function GuestLayout({ children }) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden selection:bg-indigo-100 selection:text-indigo-700" dir="rtl">

            {/* ── Page keyframes ── */}
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes sn-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
                @keyframes sn-shimmer { 0%{transform:translateX(100%)} 100%{transform:translateX(-100%)} }
                @keyframes sn-glow { 0%,100%{opacity:0.15;transform:scale(1)} 50%{opacity:0.3;transform:scale(1.08)} }
                @keyframes sn-up { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
                @keyframes sn-scale { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
                @keyframes sn-orb-drift { 0%{transform:translate(0,0)} 33%{transform:translate(15px,-20px)} 66%{transform:translate(-10px,15px)} 100%{transform:translate(0,0)} }
                .sn-card-enter { animation: sn-scale 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s both; }
                .sn-footer-enter { animation: sn-up 0.5s cubic-bezier(0.16,1,0.3,1) 0.3s both; }
            ` }} />

            {/* ══════════════════════════════════════
                BACKGROUND
            ══════════════════════════════════════ */}

            {/* Base gradient */}
            <div className="fixed inset-0 -z-20 bg-gradient-to-br from-slate-50 via-indigo-50/40 to-slate-100" />

            {/* Animated orbs */}
            <div
                className="fixed -top-20 -right-20 w-[26rem] h-[26rem] rounded-full -z-10 pointer-events-none"
                style={{
                    background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
                    filter: 'blur(40px)',
                    animation: 'sn-orb-drift 20s ease-in-out infinite',
                }}
            />
            <div
                className="fixed -bottom-16 -left-16 w-[22rem] h-[22rem] rounded-full -z-10 pointer-events-none"
                style={{
                    background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)',
                    filter: 'blur(40px)',
                    animation: 'sn-orb-drift 25s ease-in-out infinite reverse',
                }}
            />
            <div
                className="fixed top-1/3 left-1/2 w-[18rem] h-[18rem] rounded-full -z-10 pointer-events-none hidden md:block"
                style={{
                    background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)',
                    filter: 'blur(50px)',
                    animation: 'sn-orb-drift 18s ease-in-out 3s infinite',
                }}
            />

            {/* Dot texture */}
            <div
                className="fixed inset-0 -z-10 opacity-[0.03]"
                style={{
                    backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                }}
            />

            {/* ══════════════════════════════════════
                CARD
            ══════════════════════════════════════ */}

            <div className="sn-card-enter w-full sm:max-w-[440px] relative z-20">
                {/* Shimmer on top edge */}
                <div className="absolute top-0 left-0 w-full h-[2px] overflow-hidden rounded-t-[1.8rem] z-20">
                    <div
                        className="w-1/3 h-full bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent"
                        style={{ animation: 'sn-shimmer 4s ease-in-out infinite' }}
                    />
                </div>

                {/* Glass card */}
                <div className="bg-white/85 backdrop-blur-2xl shadow-2xl shadow-slate-300/50 rounded-[1.8rem] border border-white/60 px-6 sm:px-8 py-8 sm:py-10 relative overflow-hidden">
                    {/* subtle corner accents */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-50/80 to-transparent rounded-bl-[4rem] -z-0 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr from-cyan-50/60 to-transparent rounded-tr-[4rem] -z-0 pointer-events-none" />

                    <div className="relative z-10">
                        {children}
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════
                FOOTER
            ══════════════════════════════════════ */}

            <div className="sn-footer-enter mt-8 mb-4 text-center z-10 relative">
                <p className="text-slate-400 text-[11px] font-bold tracking-wide">
                    © {new Date().getFullYear()} سنفور — المرشد الأكاديمي الذكي
                </p>
            </div>

        </div>
    );
}