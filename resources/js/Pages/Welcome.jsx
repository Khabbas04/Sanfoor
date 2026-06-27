import { Link, Head } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/Contexts/LanguageContext';
import VideoPlayer from '@/Components/VideoPlayer';
import TourManager, { startWelcomeTour } from '@/Components/TourManager';
import { motion, AnimatePresence } from 'framer-motion';

// Resolve the public site URL for canonical and social metadata.
const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');
const creatorName = 'Asem Alkhabbas';
const creatorLinkedIn = 'https://www.linkedin.com/in/asem-alkhabbas-667471371/';

/* ─────────────────────────────────────────────
   Sanfoor – Premium Animated Landing Page v4.0
   By Kollia Team
───────────────────────────────────────────── */

// Reveal sections only after they enter the viewport to keep motion intentional.
function useInView(threshold = 0.15) {
    const ref = useRef(null);
    const [isInView, setIsInView] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setIsInView(true); obs.unobserve(el); } }, { threshold });
        obs.observe(el);
        return () => obs.disconnect();
    }, [threshold]);
    return [ref, isInView];
}

// Lightweight wrapper kept for future button motion experiments.
function MagneticButton({ children, className = '', ...props }) {
    return (
        <div
            className="inline-block"
        >
            <div className={className} {...props}>{children}</div>
        </div>
    );
}

// Small SVG helpers used to visualize the study-tree concept in the landing page.
function TreeNode({ x, y, delay, color, size = 52, label, shape = 'mandatory', textColor = 'white' }) {
    const width = size;
    const height = size * 0.58;
    const cx = parseFloat(x) + width / 2;
    const cy = parseFloat(y) + height / 2;

    let shapeElement;
    if (shape === 'supporting') {
        shapeElement = <rect x={x} y={y} width={width} height={height} rx={height / 2} fill={color} className="tree-node-rect" style={{ animationDelay: `${delay}s` }} />;
    } else if (shape === 'elective') {
        shapeElement = <rect x={x} y={y} width={width} height={height} rx="4" fill={color} className="tree-node-rect" transform={`translate(${cx}, ${cy}) skewX(-15) translate(${-cx}, ${-cy})`} style={{ animationDelay: `${delay}s` }} />;
    } else {
        shapeElement = <rect x={x} y={y} width={width} height={height} rx="6" fill={color} className="tree-node-rect" style={{ animationDelay: `${delay}s` }} />;
    }

    return (
        <g className="tree-node drop-shadow-sm" style={{ animationDelay: `${delay}s` }}>
            {shapeElement}
            {label && <text x={cx} y={parseFloat(y) + height * 0.6} textAnchor="middle" fill={textColor} fontSize="8" fontWeight="800" className="select-none">{label}</text>}
        </g>
    );
}

function TreeEdge({ x1, y1, x2, y2, delay, active = 'inactive' }) {
    const midY = (parseFloat(y1) + parseFloat(y2)) / 2;
    const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

    // Determine color based on active state
    let strokeColor = "rgba(148, 163, 184, 0.4)";
    if (active === 'active') strokeColor = "#10b981";
    if (active === 'available') strokeColor = "#6366f1";

    return (
        <path
            d={d}
            fill="none"
            stroke={strokeColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            className="tree-edge-path"
            markerEnd={`url(#arrow-${active})`}
            style={{
                animationDelay: `${delay}s`,
                strokeDasharray: "300",
                strokeDashoffset: 0,
                transition: "stroke 0.8s ease"
            }}
        />
    );
}

function PremiumBadge({ text, color = 'sky', className = 'mb-6' }) {
    const colors = {
        sky: { from: 'from-sky-400', to: 'to-blue-500', text: 'text-sky-400', border: 'border-sky-500/20' },
        cyan: { from: 'from-cyan-400', to: 'to-teal-500', text: 'text-cyan-400', border: 'border-cyan-500/20' },
        emerald: { from: 'from-emerald-400', to: 'to-green-500', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    };
    const theme = colors[color] || colors.sky;

    return (
        <div className={`relative inline-flex items-center justify-center ${className} group cursor-default`}>
            {/* Background glow */}
            <div className={`absolute inset-0 bg-gradient-to-r ${theme.from} ${theme.to} rounded-full blur-[12px] opacity-20 group-hover:opacity-40 transition-opacity duration-500`}></div>

            {/* Pill Container */}
            <div className={`relative inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-[#050505]/90 backdrop-blur-xl border ${theme.border} shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] overflow-hidden`}>

                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out"></div>

                {/* Blinking dot */}
                <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-60 ${theme.text}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 bg-current ${theme.text}`}></span>
                </span>

                {/* Text */}
                <span className={`text-xs sm:text-sm font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-l ${theme.from} ${theme.to}`}>
                    {text}
                </span>
            </div>
        </div>
    );
}

function StackedFeaturesSection() {
    const [cards, setCards] = useState([
        { id: 1, icon: "🌳", title: 'الشجرة التفاعلية', desc: 'خريطة مرئية كاملة لموادك، تتحدث تلقائياً لتظهر لك ما تم إنجازه وما فُتح لك للتسجيل بألوان واضحة.', themeColor: 'sky' },
        { id: 2, icon: "⚖️", title: 'التسجيل التجريبي الذكي', desc: 'ضيف المواد للتسجيل التجريبي وشوف العبء الدراسي، النظام رح ينبهك إذا اخترت مواد بتتعارض مع قوانين الخطة.', themeColor: 'cyan' },
        { id: 3, icon: "📈", title: 'AI Sanfoor', desc: 'مساعد ذكي يقرأ خطتك، يفهم المتطلبات، ويقترح لك أفضل خيارات التسجيل بشكل واضح وسريع.', themeColor: 'emerald' },
        { id: 4, icon: "📚", title: 'الشباتر الدراسية', desc: 'شروحات مركزة لكل فصل مع أمثلة وتمارين تساعدك تراجع وتثبت المعلومة بسرعة.', themeColor: 'amber' },
        { id: 5, icon: "📝", title: 'بنك الأسئلة', desc: 'تجميعة أسئلة مختارة وتمارين متدرجة عشان تختبر نفسك قبل الامتحان بثقة.', themeColor: 'blue' },
        { id: 6, icon: "🏫", title: 'دليل الكليات', desc: 'اعرف مباني الكليات ومواقعها والخدمات القريبة منها عبر دليل واضح وسهل التصفح.', themeColor: 'purple' },
    ]);

    const bringToFront = (id) => {
        setCards(prev => {
            const index = prev.findIndex(c => c.id === id);
            if (index === prev.length - 1) return prev;
            const newCards = [...prev];
            const [clicked] = newCards.splice(index, 1);
            newCards.push(clicked);
            return newCards;
        });
    };

    const themes = {
        sky: { text: 'text-sky-400', bg: 'bg-sky-500/10', gradient: 'from-slate-900 via-[#0a192f] to-[#022c43]', glow: 'shadow-[0_0_30px_rgba(14,165,233,0.15)]' },
        cyan: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', gradient: 'from-slate-900 via-[#081e28] to-[#01353b]', glow: 'shadow-[0_0_30px_rgba(6,182,212,0.15)]' },
        emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', gradient: 'from-slate-900 via-[#062016] to-[#013622]', glow: 'shadow-[0_0_30px_rgba(16,185,129,0.15)]' },
        amber: { text: 'text-amber-400', bg: 'bg-amber-500/10', gradient: 'from-slate-900 via-[#261505] to-[#422002]', glow: 'shadow-[0_0_30px_rgba(245,158,11,0.15)]' },
        blue: { text: 'text-blue-400', bg: 'bg-blue-500/10', gradient: 'from-slate-900 via-[#0a1128] to-[#051c4a]', glow: 'shadow-[0_0_30px_rgba(59,130,246,0.15)]' },
        purple: { text: 'text-purple-400', bg: 'bg-purple-500/10', gradient: 'from-slate-900 via-[#150a24] to-[#2b0e4a]', glow: 'shadow-[0_0_30px_rgba(168,85,247,0.15)]' },
    };

    return (
        <div className="relative h-[480px] sm:h-[450px] w-full max-w-5xl mx-auto mt-4 sm:mt-10 perspective-1000" dir="rtl">
            {cards.map((card, index) => {
                const isFront = index === cards.length - 1;
                const reverseIndex = cards.length - 1 - index;

                // Stack DOWNWARDS to avoid huge margin-top.
                // The back card is at y=0, the front card is pushed down, making tabs peek beautifully from above.
                const yOffset = index * 36;
                const scale = 1 - reverseIndex * 0.04;

                const theme = themes[card.themeColor];

                return (
                    <motion.div
                        key={card.id}
                        id={`tour-feature-${card.id}`}
                        layout
                        initial={false}
                        animate={{
                            y: yOffset,
                            scale: scale,
                            zIndex: index,
                        }}
                        transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 30,
                            mass: 1,
                            bounce: 0.1
                        }}
                        onClick={() => bringToFront(card.id)}
                        className={`absolute top-0 left-0 right-0 mx-auto w-full max-w-4xl rounded-[1.5rem] sm:rounded-[2rem] cursor-pointer overflow-hidden transition-colors duration-500
                            ${isFront
                                ? `bg-gradient-to-br ${theme.gradient} border border-white/10 shadow-2xl ${theme.glow}`
                                : `bg-white border border-slate-200/80 shadow-[0_15px_40px_-10px_rgba(0,0,0,0.08)] hover:bg-slate-50`}
                        `}
                        style={{
                            transformOrigin: "top center",
                            filter: isFront ? 'brightness(1)' : `brightness(${1 - reverseIndex * 0.04})`
                        }}
                    >
                        {/* Tab Header (always visible, peeks out at the top) */}
                        <div className={`px-6 py-4 flex items-center gap-3 ${isFront ? 'border-b border-white/5 bg-white/5' : ''}`}>
                            <div className={`w-3 h-3 rounded-full ${theme.bg.replace('/10', '/80')} shadow-[0_0_10px_currentColor] ${theme.text}`} />
                            <span className={`text-xs sm:text-sm font-black tracking-widest uppercase transition-colors duration-300 ${isFront ? 'text-white' : 'text-slate-500'}`}>
                                {card.title}
                            </span>
                        </div>

                        {/* Expandable Content for the Front Card */}
                        <motion.div
                            initial={false}
                            animate={{
                                opacity: isFront ? 1 : 0,
                                height: isFront ? 'auto' : 0,
                            }}
                            className="overflow-hidden"
                        >
                            <div className="p-6 sm:p-10 flex flex-col sm:flex-row items-start gap-6 sm:gap-8 relative z-10">
                                <div className={`w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl bg-white/5 ${theme.text} border border-white/10 shadow-inner`}>
                                    {card.icon}
                                </div>
                                <div className="flex-1">
                                    <h3 className={`text-xl sm:text-2xl font-black mb-3 sm:mb-4 leading-snug transition-colors duration-300 ${isFront ? 'text-white' : 'text-slate-900'}`}>
                                        {card.title}
                                    </h3>
                                    <p className={`text-sm sm:text-base leading-[1.8] font-medium max-w-2xl transition-colors duration-300 ${isFront ? 'text-slate-300' : 'text-slate-500'}`}>
                                        {card.desc}
                                    </p>

                                    {/* Call to action inside the active card */}
                                    <div className="mt-6 flex justify-end">
                                        <span className={`text-xs font-bold px-4 py-2 rounded-full border bg-white/5 transition-colors duration-300 ${isFront ? 'text-slate-300 border-white/10' : 'text-slate-500 border-slate-200'}`}>
                                            ميزة رقم {card.id} من 6
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Inner ambient glow for the front card */}
                            {isFront && (
                                <div className={`absolute -inset-[1px] rounded-[1.5rem] sm:rounded-[2rem] blur-3xl opacity-20 -z-0 bg-gradient-to-br ${theme.text.replace('text-', 'from-')} to-transparent pointer-events-none`} />
                            )}
                        </motion.div>
                    </motion.div>
                );
            })}
        </div>
    );
}

function TreePreviewAnimation({ start }) {
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!start) return;

        let isMounted = true;
        let timeoutIds = [];

        const runSequence = () => {
            if (!isMounted) return;
            setStep(0);

            timeoutIds.push(setTimeout(() => isMounted && setStep(1), 1500));
            timeoutIds.push(setTimeout(() => isMounted && setStep(2), 3500));
            timeoutIds.push(setTimeout(() => isMounted && setStep(3), 5500));
            timeoutIds.push(setTimeout(() => isMounted && setStep(4), 7500));
            timeoutIds.push(setTimeout(() => isMounted && runSequence(), 12000));
        };

        runSequence();

        return () => {
            isMounted = false;
            timeoutIds.forEach(clearTimeout);
        };
    }, [start]);

    const stepData = [
        { title: "تحليل البيانات", text: "جاري استدعاء السجل الأكاديمي للطالب...", color: "text-slate-400", dot: "bg-slate-400" },
        { title: "قراءة السجل", text: "تم العثور على مواد منجزة ومطابقتها بنجاح ✔️", color: "text-emerald-400", dot: "bg-emerald-400" },
        { title: "فتح المتطلبات", text: "تحليل القوانين وإتاحة المواد الجديدة للتسجيل 🔓", color: "text-cyan-400", dot: "bg-cyan-400" },
        { title: "اقتراح ذكي", text: "إضافة أفضل المواد للسلة التجريبية لرفع المعدل 🛒", color: "text-amber-400", dot: "bg-amber-400" },
        { title: "النتيجة النهائية", text: "الخطة محدثة وجاهزة للتسجيل الفعلي 🚀", color: "text-blue-400", dot: "bg-blue-400" }
    ];

    const currentInfo = stepData[Math.min(step, stepData.length - 1)];

    return (
        <div className="relative w-full flex flex-col items-center">
            {/* Smart Terminal Box */}
            <div className="w-full max-w-2xl bg-[#0f172a]/95 backdrop-blur-xl border border-slate-700/50 shadow-2xl rounded-xl overflow-hidden mb-8" dir="ltr">
                {/* Window header */}
                <div className="px-4 py-2.5 bg-[#1e293b]/80 border-b border-slate-700/50 flex items-center justify-between">
                    <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-rose-500/80 shadow-[0_0_8px_rgba(244,63,94,0.4)]"></div>
                        <div className="w-3 h-3 rounded-full bg-amber-500/80 shadow-[0_0_8px_rgba(245,158,11,0.4)]"></div>
                        <div className="w-3 h-3 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">Sanfoor Auto-Pilot</span>
                </div>
                {/* Content */}
                <div className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4" dir="rtl">
                    <div className="flex items-center gap-3 shrink-0 bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-700/50 shadow-inner">
                        <span className={`w-2.5 h-2.5 rounded-full ${currentInfo.dot} animate-pulse shadow-[0_0_8px_currentColor]`} />
                        <h4 className={`text-sm sm:text-base font-black ${currentInfo.color} transition-colors duration-300`}>{currentInfo.title}</h4>
                    </div>
                    <p className="text-slate-300 text-sm sm:text-base font-medium w-full text-right leading-relaxed" key={step}>
                        <motion.span initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                            <span className={`${currentInfo.color} ml-2 font-black`}>❯</span>
                            {currentInfo.text}
                        </motion.span>
                    </p>
                </div>
            </div>

            <svg viewBox="0 0 500 280" className="w-full h-auto relative z-10" dir="ltr">
                <defs>
                    <marker id="arrow-inactive" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                        <path d="M 0 2 L 8 5 L 0 8 z" fill="rgba(148, 163, 184, 0.4)" />
                    </marker>
                    <marker id="arrow-active" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                        <path d="M 0 2 L 8 5 L 0 8 z" fill="#10b981" />
                    </marker>
                    <marker id="arrow-available" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                        <path d="M 0 2 L 8 5 L 0 8 z" fill="#6366f1" />
                    </marker>
                </defs>

                {start && <>
                    {/* Edges */}
                    <TreeEdge x1="130" y1="38" x2="70" y2="95" delay={0.5} active={step >= 2 ? 'available' : step >= 1 ? 'active' : 'inactive'} />
                    <TreeEdge x1="130" y1="38" x2="190" y2="95" delay={0.6} active={step >= 2 ? 'available' : step >= 1 ? 'active' : 'inactive'} />
                    <TreeEdge x1="70" y1="128" x2="40" y2="185" delay={0.9} active={step >= 3 ? 'available' : 'inactive'} />
                    <TreeEdge x1="70" y1="128" x2="130" y2="185" delay={1.0} active={step >= 3 ? 'available' : 'inactive'} />
                    <TreeEdge x1="190" y1="128" x2="190" y2="185" delay={1.0} active={step >= 3 ? 'available' : 'inactive'} />
                    <TreeEdge x1="370" y1="38" x2="310" y2="95" delay={0.7} active={step >= 2 ? 'available' : step >= 1 ? 'active' : 'inactive'} />
                    <TreeEdge x1="370" y1="38" x2="430" y2="95" delay={0.8} active={step >= 2 ? 'available' : step >= 1 ? 'active' : 'inactive'} />
                    <TreeEdge x1="310" y1="128" x2="310" y2="185" delay={1.1} active={step >= 3 ? 'available' : 'inactive'} />
                    <TreeEdge x1="430" y1="128" x2="370" y2="185" delay={1.1} active={step >= 3 ? 'available' : 'inactive'} />
                    <TreeEdge x1="430" y1="128" x2="460" y2="185" delay={1.2} active={step >= 3 ? 'available' : 'inactive'} />

                    {/* Nodes Level 1 (Roots) */}
                    <TreeNode x="104" y="8" delay={0.1} shape="mandatory" color={step >= 1 ? "#10b981" : "#e2e8f0"} textColor={step >= 1 ? "white" : "#64748b"} label={step >= 1 ? "منجزة ✓" : "مغلقة"} />
                    <TreeNode x="344" y="8" delay={0.2} shape="elective" color={step >= 1 ? "#10b981" : "#e2e8f0"} textColor={step >= 1 ? "white" : "#64748b"} label={step >= 1 ? "منجزة ✓" : "مغلقة"} />

                    {/* Nodes Level 2 */}
                    <TreeNode x="44" y="95" delay={0.3} shape="mandatory" color={step >= 2 ? "#6366f1" : "#e2e8f0"} textColor={step >= 2 ? "white" : "#64748b"} label={step >= 2 ? "متاحة" : "مغلقة"} />
                    <TreeNode x="164" y="95" delay={0.4} shape="supporting" color={step >= 2 ? "#6366f1" : "#e2e8f0"} textColor={step >= 2 ? "white" : "#64748b"} label={step >= 2 ? "متاحة" : "مغلقة"} />
                    <TreeNode x="284" y="95" delay={0.5} shape="mandatory" color={step >= 2 ? "#ef4444" : "#e2e8f0"} textColor={step >= 2 ? "white" : "#64748b"} label={step >= 2 ? "راسب ↺" : "مغلقة"} />
                    <TreeNode x="404" y="95" delay={0.6} shape="elective" color={step >= 2 ? "#6366f1" : "#e2e8f0"} textColor={step >= 2 ? "white" : "#64748b"} label={step >= 2 ? "متاحة" : "مغلقة"} />

                    {/* Nodes Level 3 */}
                    <TreeNode x="14" y="185" delay={0.7} shape="mandatory" color={step >= 3 ? "#f59e0b" : "#e2e8f0"} textColor={step >= 3 ? "white" : "#64748b"} label={step >= 3 ? "تجريبي 🛒" : "مغلقة"} />
                    <TreeNode x="104" y="185" delay={0.75} shape="supporting" color="#e2e8f0" textColor="#64748b" label="مغلقة 🔒" />
                    <TreeNode x="164" y="185" delay={0.8} shape="mandatory" color="#e2e8f0" textColor="#64748b" label="مغلقة 🔒" />
                    <TreeNode x="284" y="185" delay={0.85} shape="elective" color="#e2e8f0" textColor="#64748b" label="مغلقة 🔒" />
                    <TreeNode x="344" y="185" delay={0.9} shape="supporting" color={step >= 3 ? "#f59e0b" : "#e2e8f0"} textColor={step >= 3 ? "white" : "#64748b"} label={step >= 3 ? "تجريبي 🛒" : "مغلقة"} />
                    <TreeNode x="434" y="185" delay={0.95} shape="mandatory" color="#e2e8f0" textColor="#64748b" label="مغلقة 🔒" />
                </>}
            </svg>
        </div>
    );
}

function AiChatAnimation({ start }) {
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!start) return;
        setStep(0);

        const timers = [
            setTimeout(() => setStep(1), 500),   // User message appears
            setTimeout(() => setStep(2), 1500),  // AI starts typing/scanning
            setTimeout(() => setStep(3), 3000),  // AI shows processing progress bar
            setTimeout(() => setStep(4), 5000),  // AI shows the final answer
        ];

        return () => timers.forEach(clearTimeout);
    }, [start]);

    return (
        <div className="relative w-full max-w-[420px] mx-auto bg-slate-900/80 backdrop-blur-2xl border border-slate-700/60 rounded-[2.5rem] shadow-[0_30px_100px_-20px_rgba(16,185,129,0.2)] overflow-hidden flex flex-col font-sans h-[520px]" dir="rtl">
            {/* Animated background glow inside the container */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-b from-emerald-500/10 to-transparent opacity-50 pointer-events-none" />

            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/50 backdrop-blur-md z-10 relative">
                <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>
                <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-400 to-cyan-500 flex items-center justify-center text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] overflow-hidden p-2 border border-white/10">
                        <img src="/images/sanfoor.png" alt="AI" className="w-full h-full object-contain filter brightness-0 invert" />
                        <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent opacity-50" />
                    </div>
                    <div>
                        <h4 className="text-white text-base font-black tracking-wide flex items-center gap-2">
                            Sanfoor AI <span className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-[9px] px-1.5 py-0.5 rounded font-black tracking-widest shadow-sm">PRO</span>
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)] animate-pulse"></span>
                            <p className="text-slate-400 text-[11px] font-bold tracking-wider">متصل ومستعد للمساعدة</p>
                        </div>
                    </div>
                </div>
                <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-700"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-700"></div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-hidden p-5 flex flex-col gap-5 relative">

                {/* User Message */}
                <AnimatePresence>
                    {step >= 1 && (
                        <motion.div
                            initial={{ opacity: 0, y: 15, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className="flex gap-3 items-end justify-end mb-2"
                        >
                            <div className="bg-gradient-to-tr from-emerald-500 to-teal-400 text-white p-4 rounded-[1.5rem] rounded-br-sm text-sm font-semibold leading-relaxed shadow-[0_10px_25px_-5px_rgba(16,185,129,0.3)] max-w-[85%]">
                                بدي أرفع معدلي هاد الفصل، شو بتنصحني أنزل مواد خفيفة وتفتحلي مواد لقدام؟
                            </div>
                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-xs font-black shrink-0 shadow-inner">
                                أن
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* AI Typing / Response */}
                <AnimatePresence>
                    {step >= 2 && (
                        <motion.div
                            initial={{ opacity: 0, y: 15, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className="flex gap-3 items-start"
                        >
                            {/* AI Avatar */}
                            <div className="relative w-9 h-9 shrink-0">
                                <div className={`absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 ${step === 2 || step === 3 ? 'animate-[spin_2s_linear_infinite]' : ''}`} />
                                <div className="absolute inset-[2px] bg-slate-900 rounded-full z-10 flex items-center justify-center">
                                    <img src="/images/sanfoor.png" alt="AI" className="w-4 h-4 object-contain filter brightness-0 invert opacity-90" />
                                </div>
                            </div>

                            <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/50 text-slate-200 p-4 rounded-[1.5rem] rounded-tr-sm text-sm font-medium leading-loose shadow-xl max-w-[90%] w-full">
                                {step === 2 && (
                                    <div className="flex gap-1.5 items-center h-6">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce shadow-[0_0_8px_rgba(16,185,129,0.8)]" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce shadow-[0_0_8px_rgba(16,185,129,0.8)]" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce shadow-[0_0_8px_rgba(16,185,129,0.8)]" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                )}
                                {step >= 3 && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                        <p className="mb-3 leading-relaxed">
                                            أهلاً بك! قمت بتحليل <span className="text-emerald-400 font-bold">سجلك الأكاديمي</span> 📊
                                            <br />
                                            بناءً على خطتك، هذه أفضل مواد لرفع المعدل:
                                        </p>

                                        {step === 3 && (
                                            <div className="flex flex-col gap-2 mt-4 mb-2">
                                                <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                                                    <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_5px_currentColor]" /> جاري مطابقة قوانين الكلية...</span>
                                                    <span className="text-cyan-400 font-mono">78%</span>
                                                </div>
                                                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-700">
                                                    <motion.div
                                                        initial={{ width: "20%" }}
                                                        animate={{ width: "78%" }}
                                                        transition={{ duration: 1.5, ease: "easeOut" }}
                                                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full relative"
                                                    >
                                                        <div className="absolute inset-0 bg-white/20 animate-[pulse_1s_infinite]" />
                                                    </motion.div>
                                                </div>
                                            </div>
                                        )}

                                        {step >= 4 && (
                                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-2.5 mt-4">
                                                <div className="relative group bg-slate-900/60 hover:bg-slate-900 border border-slate-700/60 p-3 rounded-2xl transition-all duration-300 shadow-inner">
                                                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
                                                    <div className="flex items-center gap-3 relative z-10">
                                                        <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-emerald-400/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-lg shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                                                            💻
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <h5 className="text-white font-bold text-sm truncate">برمجة متقدمة (3س)</h5>
                                                                <span className="text-[9px] shrink-0 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-full font-bold">تفتح 3 مواد</span>
                                                            </div>
                                                            <p className="text-slate-400 text-[10px] mt-1 leading-snug truncate">متطلب تخصص، أساسية لفتح مواد السنة الثالثة.</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="relative group bg-slate-900/60 hover:bg-slate-900 border border-slate-700/60 p-3 rounded-2xl transition-all duration-300 shadow-inner">
                                                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
                                                    <div className="flex items-center gap-3 relative z-10">
                                                        <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-cyan-400/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-lg shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                                                            🧠
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <h5 className="text-white font-bold text-sm truncate">مهارات حياتية (3س)</h5>
                                                                <span className="text-[9px] shrink-0 bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 px-2 py-0.5 rounded-full font-bold">سهلة الامتياز</span>
                                                            </div>
                                                            <p className="text-slate-400 text-[10px] mt-1 leading-snug truncate">متطلب جامعة اختياري، ممتازة لرفع المعدل.</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>

            {/* Chat Input Mockup */}
            <div className="p-4 bg-slate-900/80 backdrop-blur-md border-t border-slate-700/50 mt-auto relative z-10">
                <div className="relative">
                    <div className="w-full bg-slate-800 border border-slate-700 rounded-full h-12 flex items-center px-4 text-slate-500 text-sm font-medium">
                        اسأل عن خطتك، موادك، أو قوانين الكلية...
                    </div>
                    <div className="absolute left-1.5 top-1.5 w-9 h-9 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 flex items-center justify-center shadow-md">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </div>
                </div>
            </div>

        </div>
    );
}

export default function Welcome({ auth }) {
    const heroRef = useRef(null);
    const { lang } = useLanguage();

    // Each observer controls the reveal timing of a different landing section.
    const [featRef, featIn] = useInView();
    const [previewRef, previewIn] = useInView();
    const [aiRef, aiIn] = useInView(0.3);
    const [howRef, howIn] = useInView();
    const [ctaRef, ctaIn] = useInView();
    const [videoRef, videoIn] = useInView();
    const [activeVideo, setActiveVideo] = useState(null);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('tour') === 'start') {
            startWelcomeTour();
        }
    }, []);

    return (
        <MainLayout>
            <TourManager />
            <Head>
                <title>سنفور | Sanfoor - المرشد الأكاديمي لطلاب جامعة الزرقاء</title>
                <meta name="description" content="منصة سنفور الأولى لطلاب جامعة الزرقاء (ZU). تساعدك على تخطيط المسار الأكاديمي، إدارة الخطة الدراسية، وحساب المعدل بذكاء مدعوم بالذكاء الاصطناعي." />
                <meta name="keywords" content="سنفور, Sanfoor, جامعة الزرقاء, ZU, Zarqa University, المرشد الأكاديمي, خطة دراسية, حساب المعدل, GPA, تسجيل مواد جامعة الزرقاء" />
                <meta name="author" content={creatorName} />
                <meta name="creator" content={creatorName} />
                <meta name="publisher" content={creatorName} />
                <meta name="robots" content="index,follow" />
                <link rel="canonical" href={`${siteUrl}/`} />
                <meta property="og:type" content="website" />
                <meta property="og:title" content="سنفور | Sanfoor - لطلاب جامعة الزرقاء (ZU)" />
                <meta property="og:description" content="خطط مسارك الجامعي بذكاء، احسب معدلك التراكمي، وتابع تقدمك الدراسي في جامعة الزرقاء من مكان واحد." />
                <meta property="og:url" content={`${siteUrl}/`} />
                <meta property="og:image" content={`${siteUrl}/images/sanfoor.png`} />
                <meta property="article:author" content={creatorName} />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="سنفور | Sanfoor - منصة طلاب جامعة الزرقاء" />
                <meta name="twitter:description" content="دليلك الذكي لاختيار المواد، فهم الخطة الجامعية، والتفوق في جامعة الزرقاء." />
                <meta name="twitter:image" content={`${siteUrl}/images/sanfoor.png`} />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            '@context': 'https://schema.org',
                            '@type': 'WebPage',
                            name: 'سنفور | Sanfoor - المرشد الأكاديمي لطلاب جامعة الزرقاء (ZU)',
                            url: `${siteUrl}/`,
                            author: {
                                '@type': 'Person',
                                name: creatorName,
                                url: creatorLinkedIn,
                            },
                        }),
                    }}
                />
            </Head>

            <style dangerouslySetInnerHTML={{
                __html: `
                /* ── HERO ENTRANCE ── */
                @keyframes heroSlideUp {
                    0% { opacity: 0; transform: translateY(40px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .hero-animate {
                    opacity: 0;
                    animation: heroSlideUp 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .h-rise-slow {
                    opacity: 0;
                    animation: heroSlideUp 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }

                /* ── FLOATING LOGO ── */
                @keyframes float-logo {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-12px); }
                }
                .animate-float { animation: float-logo 4s ease-in-out infinite; }

                /* ── BACKGROUND ORBS ── */
                @keyframes pulse-slow {
                    0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.5; }
                    50% { transform: scale(1.1) translate(10px, -10px); opacity: 0.8; }
                }
                .orb-pulse { animation: pulse-slow 8s infinite alternate ease-in-out; }

                /* ── GRADIENT TEXT ── */
                .txt-grad {
                    background: linear-gradient(135deg, #a5b4fc 0%, #67e8f9 50%, #6ee7b7 100%);
                    background-size: 200% 200%;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    animation: grad-flow 5s ease infinite;
                }
                .txt-grad-dark {
                    background: linear-gradient(135deg, #312e81 0%, #4f46e5 50%, #06b6d4 100%);
                    background-size: 200% 200%;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    animation: grad-flow 5s ease infinite;
                }
                @keyframes grad-flow {
                    0%   { background-position: 0% 50%; }
                    50%  { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }

                /* ── BUTTON SHIMMER ── */
                .btn-shimmer { position: relative; overflow: hidden; }
                .btn-shimmer::after {
                    content: '';
                    position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
                    background: linear-gradient(to right, transparent, rgba(255,255,255,0.18) 50%, transparent 75%);
                    transform: skewX(-20deg);
                    animation: shimmer 3s infinite;
                }
                @keyframes shimmer { 100% { left: 200%; } }

                /* ── CARD LIFT ── */
                .card-lift { transition: all 0.55s cubic-bezier(0.16, 1, 0.3, 1); }
                .card-lift:hover {
                    transform: translateY(-14px) scale(1.015);
                    box-shadow: 0 36px 80px -20px rgba(79,70,229,0.18), 0 0 0 1px rgba(79,70,229,0.06);
                }

                .route-card { transition: all 0.55s cubic-bezier(0.16, 1, 0.3, 1); }
                .route-card:hover {
                    transform: translateY(-10px);
                    box-shadow: 0 30px 60px -24px rgba(30, 41, 59, 0.35);
                }
                .route-card:hover .route-icon {
                    transform: translateY(-4px) scale(1.08) rotate(-4deg);
                }
                .route-icon {
                    transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
                }

                /* ── NOISE & DOT GRID ── */
                .noise { background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E"); }
                .dot-grid { background-image: radial-gradient(circle, rgba(99,102,241,0.07) 1px, transparent 1px); background-size: 28px 28px; }

                /* ── SVG TREE ANIMATIONS ── */
                .tree-node-rect { opacity: 0; animation: popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
                @keyframes popIn { 0% { opacity: 0; transform: scale(0.8); } 100% { opacity: 1; transform: scale(1); } }
                .tree-edge-path { animation: drawPath 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                @keyframes drawPath { to { stroke-dashoffset: 0; } }

                /* ── AI CHAT ANIMATIONS ── */
                @keyframes chat-pop {
                    0% { opacity: 0; transform: translateY(15px) scale(0.95); }
                    100% { opacity: 1; transform: translateY(0) scale(1); }
                }
                .chat-msg-1 { opacity: 0; animation: chat-pop 0.6s cubic-bezier(0.16,1,0.3,1) forwards; animation-delay: 0.5s; }
                .chat-msg-2 { opacity: 0; animation: chat-pop 0.6s cubic-bezier(0.16,1,0.3,1) forwards; animation-delay: 1.5s; }
                
                @keyframes typing { 0%, 80%, 100% { transform: scale(0); opacity: 0.5; } 40% { transform: scale(1); opacity: 1; } }
                .typing-dot { animation: typing 1.4s infinite ease-in-out both; }
                .typing-dot:nth-child(1) { animation-delay: -0.32s; }
                .typing-dot:nth-child(2) { animation-delay: -0.16s; }

                /* ── MISC ── */
                @keyframes ping-large { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(2); opacity: 0; } }
                .animate-ping-large { animation: ping-large 2.5s cubic-bezier(0, 0, 0.2, 1) infinite; }
                @keyframes rotate-border { to { transform: rotate(360deg); } }
                @keyframes bounce-s { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }

                /* 🔥 الانحناء الناعم الجديد بدل الـ Polygon 🔥 */
                .hero-curve { 
                    border-bottom-left-radius: 50% 80px; 
                    border-bottom-right-radius: 50% 80px; 
                }

                @media (max-width: 768px), (prefers-reduced-motion: reduce) {
                    html:focus-within { scroll-behavior: auto; }
                    .hero-animate,
                    .h-rise-slow,
                    .chat-msg-1,
                    .chat-msg-2,
                    .tree-node-rect,
                    .tree-edge-path,
                    .animate-float,
                    .animate-ping-large,
                    .typing-dot {
                        animation: none !important;
                        opacity: 1 !important;
                        transform: none !important;
                    }

                    .btn-shimmer::after {
                        animation: none !important;
                    }

                    .card-lift,
                    .route-card,
                    .route-icon {
                        transition-duration: 0.01ms !important;
                    }
                }
            ` }} />

            <div className="bg-[#fafbff] text-slate-800 overflow-x-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>

                {/* ════════════════════════════════════
                    1. HERO SECTION (Video & Curve)
                ════════════════════════════════════ */}
                <section ref={heroRef} className="relative min-h-[92vh] flex flex-col items-center justify-center overflow-hidden pt-10 pb-36 sm:pb-44 hero-curve bg-transparent z-10 shadow-none">

                    {/* Static Image Background */}
                    <div className="absolute inset-0 w-full h-[120%] -bottom-16 z-0 overflow-hidden rounded-b-[inherit]">
                        {/* Image-based hero background with layered overlays (same style as gym-store-pro) */}
                        <div className="absolute inset-0">
                            <img
                                src="/images/background.png"
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                                decoding="async"
                            />
                            <div className="absolute inset-0 bg-black/40" />
                            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#0f172a]" />
                        </div>

                        {/* Soft fade into the next section so the background extends lower */}
                        <div className="absolute -bottom-24 left-0 right-0 h-56 bg-gradient-to-b from-transparent to-[#fafbff]" />

                        {/* Very subtle highlight layer */}
                        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.03),transparent_40%)] rounded-b-[inherit] pointer-events-none" />
                    </div>

                    {/* Decorative Orbs */}
                    <div className="absolute hidden md:block w-[220px] h-[220px] bg-sky-400/10 blur-[80px] top-[2%] right-[6%] pointer-events-none z-0" />
                    <div className="absolute hidden md:block w-[200px] h-[200px] bg-cyan-300/10 blur-[80px] bottom-[6%] left-[6%] pointer-events-none z-0" />

                    {/* Content */}
                    <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center w-full mt-8">

                        {/* Premium AI Badge */}
                        <div className="hero-animate mb-10 flex justify-center" style={{ animationDelay: '0.1s' }}>
                            <div className="relative inline-flex p-[1px] rounded-full overflow-hidden shadow-[0_0_35px_rgba(56,189,248,0.25)] group cursor-default select-none">
                                <span className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#bae6fd_0%,#3b82f6_50%,#bae6fd_100%)] opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="inline-flex items-center gap-2.5 h-full w-full px-6 py-2 bg-[#020617]/90 rounded-full backdrop-blur-xl relative z-10">
                                    <div className="flex items-center justify-center text-sky-300 animate-pulse">
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 2L14.1 9.9L22 12L14.1 14.1L12 22L9.9 14.1L2 12L9.9 9.9L12 2Z" />
                                        </svg>
                                    </div>
                                    <span className="font-[900] text-[13px] tracking-wide text-transparent bg-clip-text bg-gradient-to-l from-sky-200 via-white to-white drop-shadow-sm">
                                        النظام الذكي الأول في الجامعات
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 🔥 Floating Animated Logo (تم تكبيره بشكل ضخم) 🔥 */}
                        <div className="hero-animate relative inline-flex justify-center items-center mb-10 mt-2" style={{ animationDelay: '0.3s' }}>
                            <div className="absolute inset-0 bg-sky-400/12 rounded-full blur-2xl"></div>
                            <div className="relative w-36 h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 animate-float">
                                <img src="/images/sanfoor.png" alt="Sanfoor Logo" className="w-full h-full object-contain drop-shadow-[0_15px_30px_rgba(0,0,0,0.6)]" />
                            </div>
                        </div>

                        {/* Heading */}
                        <h1 className="hero-animate mb-4" style={{ animationDelay: '0.65s' }}>
                            <span className="block text-4xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-black leading-[1.1] tracking-tight text-white drop-shadow-[0_10px_25px_rgba(0,0,0,0.9)]">
                                دليلك الذكي نحو
                            </span>
                        </h1>
                        <h1 className="hero-animate mb-8" style={{ animationDelay: '0.85s' }}>
                            <span className="block text-4xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-black leading-[1.1] tracking-tight text-cyan-200 drop-shadow-[0_10px_25px_rgba(0,0,0,0.95)]">
                                التفوق الأكاديمي.
                            </span>
                        </h1>

                        {/* Sub */}
                        <div className="h-rise-slow" style={{ animationDelay: '1.1s' }}>
                            <p className="max-w-2xl mx-auto text-base sm:text-lg md:text-xl text-white mb-7 font-semibold leading-relaxed px-4 drop-shadow-[0_4px_14px_rgba(0,0,0,0.75)]">
                                <strong className="text-white">سنفور</strong> ليس مجرد موقع، إنه مستشارك الشخصي. يرسم لك خريطة تخصصك، يفتح لك المواد المتاحة، ويخطط فصلك القادم بدقة مع <span className="text-cyan-200">AI Sanfoor</span>.
                            </p>
                            <a
                                href={creatorLinkedIn}
                                target="_blank"
                                rel="noopener noreferrer"
                                dir="ltr"
                                className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-2.5 text-[11px] sm:text-xs font-black tracking-[0.12em] text-white/80 backdrop-blur-md transition-all duration-300 hover:border-cyan-300/40 hover:bg-white/15 hover:text-cyan-100"
                            >
                                <span className="text-white/55">CREATED BY</span>
                                <span className="h-1 w-1 rounded-full bg-cyan-300"></span>
                                <span className="text-cyan-200">{creatorName}</span>
                            </a>
                        </div>

                        {/* CTA Buttons */}
                        <div className="h-rise-slow flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-5" style={{ animationDelay: '1.35s' }}>
                            {auth.user ? (
                                <MagneticButton>
                                    <Link id="tour-cta-btn" href={route('tree.index')} className="btn-shimmer flex items-center justify-center gap-3 px-10 py-[1.15rem] sm:py-5 bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white text-base sm:text-lg font-extrabold rounded-2xl transition-all shadow-xl shadow-blue-500/30 active:scale-[0.96] w-full sm:w-auto">
                                        <span>افتح خطتي الدراسية</span>
                                        <span className="text-xl group-hover:-translate-x-1.5 transition-transform duration-300">←</span>
                                    </Link>
                                </MagneticButton>
                            ) : (
                                <>
                                    <MagneticButton>
                                        <Link href={route('login')} className="btn-shimmer flex items-center justify-center gap-3 px-10 py-[1.15rem] sm:py-5 bg-white text-slate-900 text-base sm:text-lg font-black rounded-2xl hover:bg-slate-100 transition-all shadow-2xl shadow-black/40 active:scale-[0.96] w-full sm:w-auto">
                                            <span>ابدأ الآن</span>
                                            <span className="text-xl group-hover:-translate-x-1.5 transition-transform duration-300">←</span>
                                        </Link>
                                    </MagneticButton>
                                    <MagneticButton>
                                        <a href="#features" className="flex items-center justify-center gap-2 px-8 py-[1.15rem] sm:py-5 bg-white/10 backdrop-blur-md text-white text-base sm:text-lg font-bold rounded-2xl hover:bg-white/20 border border-white/20 transition-all w-full sm:w-auto">
                                            <span>شوف كيف بيشتغل</span>
                                            <svg className="w-5 h-5" style={{ animation: 'bounce-s 2s ease-in-out infinite' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                                        </a>
                                    </MagneticButton>
                                </>
                            )}
                        </div>
                    </div>
                </section>

                {/* ════════════════════════════════════
                    1.5. VIDEO TUTORIALS (شروحات المنصة)
                ════════════════════════════════════ */}
                <section ref={videoRef} className="py-16 sm:py-20 relative z-10 bg-slate-50 border-t border-slate-200/50 shadow-inner">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[1px] bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>

                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                        <div className={`transition-all duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] ${videoIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}>

                            <div className="mb-12">
                                <PremiumBadge text="دليل الاستخدام الذكي" color="blue" className="mb-4" />
                                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-4">كيف يعمل سنفور؟</h2>
                                <p className="text-slate-500 text-lg font-medium max-w-2xl mx-auto">شروحات سريعة ومفصلة تأخذك في جولة داخل المنصة لتكتشف كيف يمكنك إدارة خطتك الأكاديمية بذكاء وسهولة.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-5xl mx-auto">
                                <button onClick={() => setActiveVideo('tree')} className="group text-right overflow-hidden relative rounded-[2rem] shadow-[0_15px_40px_-15px_rgba(0,0,0,0.1)] hover:shadow-[0_25px_50px_-15px_rgba(59,130,246,0.25)] transition-all duration-500 hover:-translate-y-2 bg-white border border-slate-200 flex flex-col">
                                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-[#0f172a] opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0"></div>
                                    <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-blue-500/30 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-700 z-0"></div>
                                    
                                    <div className="relative w-full h-48 sm:h-56 bg-slate-100 overflow-hidden shrink-0 border-b border-slate-200 group-hover:border-slate-700 transition-colors duration-500 z-10">
                                        <img src="/images/tree-video-poster.jpg" alt="Tree Tutorial" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                        <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-slate-900/30 transition-colors duration-500"></div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-16 h-16 rounded-full bg-white/90 backdrop-blur shadow-lg flex items-center justify-center text-blue-600 transition-transform duration-500 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white">
                                                <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4l12 6-12 6z" /></svg>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-6 sm:p-8 relative z-10 flex flex-col flex-1 justify-between bg-transparent">
                                        <div>
                                            <h3 className="text-2xl font-black text-slate-900 group-hover:text-white mb-3 transition-colors duration-500">دليل الشجرة التفاعلية</h3>
                                            <p className="text-slate-500 group-hover:text-slate-300 font-medium leading-relaxed transition-colors duration-500 text-sm sm:text-base">تعرف على كيفية اجتياز المواد، فتح المتطلبات المغلقة، وإضافة المواد للسلة التجريبية لتبني خطتك بدقة.</p>
                                        </div>
                                    </div>
                                </button>

                                <button onClick={() => setActiveVideo('ai')} className="group text-right overflow-hidden relative rounded-[2rem] shadow-[0_15px_40px_-15px_rgba(0,0,0,0.1)] hover:shadow-[0_25px_50px_-15px_rgba(16,185,129,0.25)] transition-all duration-500 hover:-translate-y-2 bg-white border border-slate-200 flex flex-col">
                                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-[#022c22] opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0"></div>
                                    <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-700 z-0"></div>
                                    
                                    <div className="relative w-full h-48 sm:h-56 bg-slate-100 overflow-hidden shrink-0 border-b border-slate-200 group-hover:border-slate-700 transition-colors duration-500 z-10">
                                        <img src="/images/ai-video-poster.jpg" alt="AI Tutorial" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                        <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-slate-900/30 transition-colors duration-500"></div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-16 h-16 rounded-full bg-white/90 backdrop-blur shadow-lg flex items-center justify-center text-emerald-600 transition-transform duration-500 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white">
                                                <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4l12 6-12 6z" /></svg>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-6 sm:p-8 relative z-10 flex flex-col flex-1 justify-between bg-transparent">
                                        <div>
                                            <h3 className="text-2xl font-black text-slate-900 group-hover:text-white mb-3 transition-colors duration-500">دليل المرشد الذكي</h3>
                                            <p className="text-slate-500 group-hover:text-emerald-100/70 font-medium leading-relaxed transition-colors duration-500 text-sm sm:text-base">كيف تستخدم الذكاء الاصطناعي لتقييم خطتك، بناء جدول دراسي مثالي، واختيار أفضل المواد لرفع معدلك.</p>
                                        </div>
                                    </div>
                                </button>
                            </div>

                        </div>
                    </div>
                </section>

                {/* ════════════════════════════════════
                    2. FEATURES (Stacked Cards)
                ════════════════════════════════════ */}
                <section id="features" ref={featRef} className="py-20 sm:py-32 relative z-10">
                    {/* Straight Background */}
                    <div className="absolute inset-0 bg-white -z-10 shadow-sm border-b border-slate-200/50"></div>

                    <div className="w-full text-center pointer-events-none select-none z-0 overflow-hidden mb-8 sm:mb-16">
                        <span className="block leading-none text-[6rem] sm:text-[10rem] md:text-[14rem] font-black text-slate-900/[0.03] whitespace-nowrap tracking-tighter">FEATURES</span>
                    </div>

                    {/* Dark aesthetic subtle glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-400/10 rounded-full blur-[120px] pointer-events-none -z-10" />

                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

                        <div className={`transition-all duration-[1.5s] ease-[cubic-bezier(0.16,1,0.3,1)] ${featIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}>
                            <StackedFeaturesSection />
                        </div>
                    </div>
                </section>

                {/* ════════════════════════════════════
                    3. TREE PREVIEW (Animated SVG)
                ════════════════════════════════════ */}
                <section ref={previewRef} className="py-24 sm:py-32 relative mt-16 z-10">
                    {/* Skewed Background */}
                    <div className="absolute inset-0 bg-slate-100 skew-y-3 sm:skew-y-2 origin-top-right -z-10 shadow-inner border-y border-slate-200"></div>

                    <div className="w-full text-center pointer-events-none select-none z-0 overflow-hidden mb-8 sm:mb-16">
                        <span className="block leading-none text-[6rem] sm:text-[12rem] md:text-[16rem] font-black text-slate-900/[0.02] whitespace-nowrap tracking-tighter">PREVIEW</span>
                    </div>
                    <div className="absolute inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.15] -z-10"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-400/10 rounded-full blur-[120px] pointer-events-none -z-10"></div>

                    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

                        <div className={`max-w-3xl mx-auto transition-all duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] ${previewIn ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`} style={{ transitionDelay: '200ms' }}>
                            <div className="relative bg-white/70 backdrop-blur-2xl border border-slate-200 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] rounded-[2rem] p-6 sm:p-10 overflow-hidden">
                                <div className="absolute -inset-[1px] rounded-[2rem] overflow-hidden pointer-events-none opacity-40">
                                    <div className="absolute inset-[-50%] bg-[conic-gradient(from_0deg,transparent_0%,#0ea5e930_25%,transparent_50%)]" style={{ animation: 'rotate-border 8s linear infinite' }} />
                                </div>

                                {/* Title above SVG */}
                                <div className="relative z-10 mb-8 flex flex-col items-center justify-center text-center">
                                    <PremiumBadge text="شكل الخطة الشجرية" color="cyan" className="mb-4" />
                                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">الشجرة التفاعلية</h3>
                                </div>

                                <TreePreviewAnimation start={previewIn} />

                                {/* Legend below SVG */}
                                <div className="relative z-10 mt-8 pt-8 border-t border-slate-200/80 flex flex-col sm:flex-row justify-between gap-8 sm:gap-12 w-full text-right" dir="rtl">

                                    {/* حالة المادة */}
                                    <div className="flex-1">
                                        <h4 className="text-slate-400 font-bold text-xs sm:text-sm mb-4 tracking-wide">حالة المادة</h4>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-2">
                                            {[
                                                { label: 'منجز', color: 'bg-[#10b981]' },
                                                { label: 'راسب (إعادة)', color: 'bg-[#ef4444]' },
                                                { label: 'متاح', color: 'bg-[#6366f1]' },
                                                { label: 'في التسجيل التجريبي', color: 'bg-[#f59e0b]' },
                                                { label: 'مغلق', color: 'bg-[#e2e8f0]', border: 'border-slate-300/50' },
                                            ].map((item, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-[4px] ${item.color} ${item.border ? 'border ' + item.border : ''} shadow-sm`} />
                                                    <span className="text-slate-600 text-xs sm:text-sm font-bold">{item.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* الرموز والمسار */}
                                    <div className="sm:w-1/3">
                                        <h4 className="text-slate-400 font-bold text-xs sm:text-sm mb-4 tracking-wide">الرموز والمسار</h4>
                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-4 bg-[#e2e8f0] border border-slate-300/60 rounded-[4px]"></div>
                                                <span className="text-slate-600 text-xs sm:text-sm font-bold">إجباري (مستطيل)</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-4 bg-[#e2e8f0] border border-slate-300/60 rounded-full"></div>
                                                <span className="text-slate-600 text-xs sm:text-sm font-bold">مساندة (بيضاوي)</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-4 bg-[#e2e8f0] border border-slate-300/60 rounded-[3px] -skew-x-12"></div>
                                                <span className="text-slate-600 text-xs sm:text-sm font-bold">اختياري (مائل)</span>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>
                </section>


                {/* ════════════════════════════════════
                    5. AI BOT SECTION
                ════════════════════════════════════ */}
                <section ref={aiRef} className="py-24 sm:py-32 relative mt-16 z-10">
                    {/* Skewed Background */}
                    <div className="absolute inset-0 bg-white -skew-y-3 sm:-skew-y-2 origin-top-left -z-10 shadow-inner border-y border-slate-200"></div>

                    <div className="w-full text-center pointer-events-none select-none z-0 overflow-hidden mb-8 sm:mb-16">
                        <span className="block leading-none text-[6rem] sm:text-[12rem] md:text-[16rem] font-black text-slate-900/[0.03] whitespace-nowrap tracking-tighter">SMART AI</span>
                    </div>
                    <div className="absolute inset-0 dot-grid opacity-50 pointer-events-none -z-10" />

                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-10 items-center">

                            {/* Text Info */}
                            <div className={`transition-all duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] ${aiIn ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-14'}`}>
                                <PremiumBadge text="ميزة حصرية" color="sky" />
                                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight leading-[1.2]">
                                    محتار شو تنزل؟ <br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">اسأل مستشارك الذكي.</span>
                                </h2>
                                <p className="text-slate-500 font-medium text-base sm:text-lg leading-relaxed mb-8 max-w-lg">
                                    دربنا نموذج ذكاء اصطناعي خصيصاً ليقرأ خطتك الجامعية، يفهم القوانين، ويقترح عليك أفضل خيارات التسجيل اللي بترفع معدلك وبتقربك من التخرج.
                                </p>
                                <ul className="space-y-4">
                                    {['يقرأ خطتك المنجزة تلقائياً', 'يتجنب أوقات التعارض والضغط', 'يقترح مواد ترفع المعدل'].map((item, idx) => (
                                        <li key={idx} className="flex items-center gap-3 font-bold text-slate-700">
                                            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm">✓</div>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Chat Simulation */}
                            <div className={`relative transition-all duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] delay-200 ${aiIn ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-14'}`}>
                                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-cyan-500/10 rounded-[2.5rem] blur-3xl transform rotate-6"></div>
                                <div className="relative p-2 sm:p-4">
                                    <AiChatAnimation start={aiIn} />
                                </div>
                            </div>

                        </div>
                    </div>
                </section>


                {/* ════════════════════════════════════
                    6. HOW IT WORKS
                ════════════════════════════════════ */}
                <section ref={howRef} className="py-24 sm:py-32 relative mt-16 z-10 overflow-hidden">
                    {/* Skewed Background */}
                    <div className="absolute inset-0 bg-slate-50 skew-y-3 sm:skew-y-2 origin-top-right -z-10 shadow-inner border-y border-slate-200/60"></div>

                    {/* Fixed Watermark positioning so it doesn't push content down */}
                    <div className="absolute top-10 left-0 w-full text-center pointer-events-none select-none z-0 opacity-40">
                        <span className="block leading-none text-[8rem] sm:text-[14rem] md:text-[18rem] font-black text-slate-900/[0.04] whitespace-nowrap tracking-tighter">WORKFLOW</span>
                    </div>

                    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-10">

                        <div className={`text-center mb-20 transition-all duration-[1.1s] ease-[cubic-bezier(0.16,1,0.3,1)] ${howIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-14'}`}>
                            <PremiumBadge text="كيف بيشتغل؟" color="cyan" className="mb-6" />
                            <h2 className="text-3xl sm:text-4xl md:text-[3.5rem] font-black text-slate-900 mb-5 tracking-tight leading-tight">
                                ثلاث خطوات <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-500">وبتكون جاهز.</span>
                            </h2>
                        </div>

                        <div className="relative mt-8">
                            {/* Perfectly Aligned Connecting Line (Passes exactly through the icons) */}
                            <div className="hidden md:block absolute top-[64px] left-[15%] right-[15%] h-[3px] z-0 bg-slate-200 rounded-full overflow-hidden">
                                {howIn && (
                                    <motion.div
                                        initial={{ scaleX: 0 }}
                                        animate={{ scaleX: 1 }}
                                        transition={{ duration: 1.5, ease: "easeInOut", delay: 0.3 }}
                                        style={{ transformOrigin: "right" }}
                                        className="h-full w-full bg-gradient-to-l from-blue-500 via-cyan-400 to-emerald-400"
                                    />
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 relative z-10">
                                {[
                                    { step: '01', title: 'اختار تخصصك', desc: 'بضغطة زر، سنفور بيجهز لك هيكل تخصصك وكل متطلباته بشكل مرئي متكامل لتفهم خطتك بسرعة.', gradient: 'from-blue-500 to-sky-400', glow: 'shadow-blue-500/30', icon: '🎯', delay: 100 },
                                    { step: '02', title: 'حدد إنجازك', desc: 'علّم المواد اللي اجتزتها. النظام فوراً رح يحلل سجلّك، يحدث خطتك، ويفتحلك المواد المتاحة للتسجيل.', gradient: 'from-cyan-500 to-teal-400', glow: 'shadow-cyan-500/30', icon: '✨', delay: 300 },
                                    { step: '03', title: 'خطط بذكاء', desc: 'استخدم السلة التجريبية لحساب العبء، واسأل الذكاء الاصطناعي لاقتراح أفضل خيارات التنزيل.', gradient: 'from-emerald-500 to-green-400', glow: 'shadow-emerald-500/30', icon: '🚀', delay: 500 },
                                ].map((s, i) => (
                                    <div
                                        key={i}
                                        className={`relative bg-white/90 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/60 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group ${howIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-24'} overflow-hidden flex flex-col items-center text-center`}
                                        style={{ transitionDelay: `${s.delay}ms` }}
                                    >
                                        {/* Huge background number watermark */}
                                        <div className="absolute -top-6 -left-4 text-[10rem] font-black text-slate-900/[0.03] group-hover:text-slate-900/[0.06] transition-colors duration-500 pointer-events-none z-0 select-none leading-none">
                                            {s.step}
                                        </div>

                                        {/* Top Gradient Glow inside the card */}
                                        <div className={`absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r ${s.gradient} opacity-80 group-hover:opacity-100 transition-opacity duration-500`}></div>

                                        <div className="relative z-10 w-full flex flex-col items-center">
                                            {/* Icon aligns with top-[64px] line (p-8=32px + half h-16=32px = 64px) */}
                                            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${s.gradient} flex items-center justify-center text-white text-3xl font-black shadow-xl ${s.glow} group-hover:-translate-y-2 group-hover:rotate-6 transition-transform duration-500 mb-8 border border-white/20`}>
                                                {s.icon}
                                            </div>

                                            <h3 className="text-2xl font-black text-slate-900 mb-4">{s.title}</h3>
                                            <p className="text-slate-500 font-medium leading-relaxed text-[15px]">{s.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>


                {/* ════════════════════════════════════
                    7. BOTTOM CTA
                ════════════════════════════════════ */}
                {!auth.user && (
                    <section ref={ctaRef} className="py-20 sm:py-28 relative overflow-hidden bg-slate-900 border-t border-slate-800">
                        <div className="absolute inset-0 noise opacity-30 pointer-events-none" />
                        <div className="morph-orb absolute w-[400px] h-[400px] bg-sky-500/10 blur-[80px] top-[-20%] right-[-10%] pointer-events-none" />
                        <div className="morph-orb absolute w-[300px] h-[300px] bg-cyan-400/10 blur-[100px] bottom-[-20%] left-[-8%] pointer-events-none" style={{ animationDelay: '-6s' }} />

                        <div className={`max-w-4xl mx-auto px-4 relative z-10 text-center transition-all duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] ${ctaIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-14'}`}>
                            {/* 🔥 تكبير لوجو الـ CTA ليصبح متناسق مع الحجم الجديد 🔥 */}
                            <div className="inline-flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32 rounded-[2rem] bg-white/5 border border-white/10 mb-8 backdrop-blur-md shadow-2xl p-4" style={{ animation: 'bounce-s 3s ease-in-out infinite' }}>
                                <img src="/images/sanfoor.png" alt="Sanfoor Logo" className="w-full h-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]" />
                            </div>

                            <h2 className="text-3xl sm:text-4xl md:text-6xl font-black text-white mb-5 leading-tight tracking-tight">
                                جاهز تبدأ مشوارك <br className="hidden sm:block" />بأذكى طريقة؟
                            </h2>
                            <p className="text-sky-200/80 font-medium text-base sm:text-lg mb-10 max-w-xl mx-auto leading-relaxed">
                                انضم للطلاب اللي حولوا خطتهم لنجاح حقيقي. سجّل حسابك وابدأ التخطيط لفصلك القادم.
                            </p>
                            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                                <MagneticButton>
                                    <a href={route('auth.microsoft.redirect')} className="shimmer flex items-center justify-center gap-3 px-10 py-[1.15rem] sm:py-5 bg-white text-blue-600 text-base sm:text-lg font-black rounded-2xl hover:bg-slate-100 transition-all shadow-2xl shadow-black/40 active:scale-[0.96] w-full sm:w-auto">
                                        تسجيل الدخول (Microsoft)
                                    </a>
                                </MagneticButton>
                                <MagneticButton>
                                    <Link href={route('login')} className="flex items-center justify-center gap-2 px-8 py-[1.15rem] sm:py-5 text-white/90 text-base font-bold rounded-2xl border border-white/20 hover:bg-white/10 transition-all w-full sm:w-auto backdrop-blur-sm">
                                        دخول الحسابات الخارجية
                                    </Link>
                                </MagneticButton>
                            </div>
                        </div>
                    </section>
                )}

            </div>

            {/* Video Modal */}
            {activeVideo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" style={{ direction: 'rtl' }}>
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setActiveVideo(null)}></div>
                    <div className="relative z-10 w-full max-w-5xl bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-700 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
                            <h3 className="text-lg font-black text-white">
                                {activeVideo === 'tree' ? 'دليل الشجرة التفاعلية' : 'دليل المرشد الذكي'}
                            </h3>
                            <button onClick={() => setActiveVideo(null)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-rose-500 text-slate-400 hover:text-white flex items-center justify-center transition-colors">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-4 sm:p-6 bg-black" dir="ltr">
                            <VideoPlayer
                                source={{
                                    type: 'video',
                                    title: activeVideo === 'tree' ? 'Tree Tutorial' : 'AI Tutorial',
                                    sources: [
                                        {
                                            src: activeVideo === 'tree' ? '/videos/tree-demo.mp4' : '/videos/ai-demo.mp4',
                                            type: 'video/mp4',
                                        }
                                    ],
                                    tracks: [
                                        {
                                            kind: 'chapters',
                                            label: 'Chapters',
                                            srclang: 'ar',
                                            src: activeVideo === 'tree' ? '/videos/tree-chapters.vtt' : '/videos/ai-chapters.vtt',
                                            default: true,
                                        }
                                    ]
                                }}
                                chapters={
                                    activeVideo === 'tree' ? [
                                        { title: 'اجتياز مادة', startTime: 0 },
                                        { title: 'تسجيل تجريبي و مقارنة', startTime: 11 },
                                        { title: 'تخطيط', startTime: 30 },
                                        { title: 'مواد الاونلاين و دليل الشجرة', startTime: 35 }
                                    ] : [
                                        { title: 'كيف اعمل جدول؟', startTime: 0 },
                                        { title: 'تقييم الجدول', startTime: 33 }
                                    ]
                                }
                            />
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
