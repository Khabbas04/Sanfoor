import { Link } from '@inertiajs/react';

export default function Guest({ children }) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden selection:bg-indigo-100 selection:text-indigo-700" dir="rtl">

            {/* ── Page keyframes ── */}
            <style>{`
                @keyframes sn-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
                @keyframes sn-shimmer { 0%{transform:translateX(100%)} 100%{transform:translateX(-100%)} }
                @keyframes sn-glow { 0%,100%{opacity:0.15;transform:scale(1)} 50%{opacity:0.3;transform:scale(1.08)} }
                @keyframes sn-up { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
                @keyframes sn-scale { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
                @keyframes sn-orb-drift { 0%{transform:translate(0,0)} 33%{transform:translate(15px,-20px)} 66%{transform:translate(-10px,15px)} 100%{transform:translate(0,0)} }
                .sn-card-enter { animation: sn-scale 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s both; }
                .sn-logo-enter { animation: sn-up 0.5s cubic-bezier(0.16,1,0.3,1) both; }
                .sn-footer-enter { animation: sn-up 0.5s cubic-bezier(0.16,1,0.3,1) 0.3s both; }
            `}</style>

            {/* ══════════════════════════════════════
                BACKGROUND
            ══════════════════════════════════════ */}

            {/* Base gradient */}
            <div className="fixed inset-0 -z-20 bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50" />

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
                className="fixed inset-0 -z-10 opacity-[0.025] pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(circle, #6366f1 0.6px, transparent 0.6px)',
                    backgroundSize: '20px 20px',
                }}
            />


            {/* ══════════════════════════════════════
                LOGO
            ══════════════════════════════════════ */}

            <div className="sn-logo-enter mb-6 relative group">
                <Link href="/" className="block">
                    {/* glow behind logo on hover */}
                    <div
                        className="absolute -inset-3 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(6,182,212,0.1))', filter: 'blur(12px)' }}
                    />
                    <img
                        src="/images/sanfoor.png"
                        alt="سنفور"
                        className="relative h-14 sm:h-16 w-auto drop-shadow-sm group-hover:scale-105 transition-transform duration-300"
                    />
                </Link>
            </div>


            {/* ══════════════════════════════════════
                CARD
            ══════════════════════════════════════ */}

            <div className="sn-card-enter w-full sm:max-w-[440px] relative">
                {/* Shimmer on top edge */}
                <div className="absolute top-0 left-0 w-full h-[1px] overflow-hidden rounded-t-[1.6rem] z-20">
                    <div
                        className="w-1/3 h-full bg-gradient-to-r from-transparent via-indigo-300/40 to-transparent"
                        style={{ animation: 'sn-shimmer 5s ease-in-out infinite' }}
                    />
                </div>

                {/* Glass card */}
                <div className="bg-white/85 backdrop-blur-2xl shadow-xl shadow-slate-200/40 rounded-[1.6rem] border border-slate-200/60 px-6 sm:px-8 py-8 sm:py-9 relative overflow-hidden">
                    {/* subtle corner accent */}
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-indigo-50 to-transparent rounded-bl-[3rem] -z-0 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr from-cyan-50/50 to-transparent rounded-tr-[3rem] -z-0 pointer-events-none" />

                    <div className="relative z-10">
                        {children}
                    </div>
                </div>
            </div>


            {/* ══════════════════════════════════════
                FOOTER
            ══════════════════════════════════════ */}

            <div className="sn-footer-enter mt-6 mb-2 text-center">
                <p className="text-slate-400 text-[11px] font-bold">
                    © {new Date().getFullYear()} سنفور — المرشد الأكاديمي الذكي
                </p>
            </div>
        </div>
    );
}
