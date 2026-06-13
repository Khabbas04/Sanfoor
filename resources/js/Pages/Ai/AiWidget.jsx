// resources/js/Pages/Ai/AiWidget.jsx

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

export default function AiWidget({ user }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [messages, setMessages] = useState([
        { id: 1, role: 'ai', content: `هلا ${user?.name?.split(' ')[0] || 'بطل'}! أنا سنفور، معك بكل خطوة بالموقع.. كيف بقدر أساعدك؟ 🤖` }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [chatId, setChatId] = useState(null);
    const [selectedFilters, setSelectedFilters] = useState([]);

    const filterOptions = [
        { id: 'compulsory', label: 'إجباري' },
        { id: 'elective', label: 'اختياري' },
        { id: 'university_req', label: 'متطلب جامعة (أونلاين)' },
        { id: 'supporting', label: 'مساندة' },
    ];

    const toggleFilter = (id) => {
        setSelectedFilters(prev => 
            prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
        );
    };
    const [showEntrance, setShowEntrance] = useState(true);
    const scrollRef = useRef(null);
    const dragRef = useRef({ startX: 0, active: false });

    // التمرير التلقائي لأسفل عند وصول رسالة جديدة
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, isTyping]);

    // 🆕 إيقاف أنيميشن الدخول بعد 3 ثوانٍ
    useEffect(() => {
        const timer = setTimeout(() => setShowEntrance(false), 3000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const update = () => setIsMobile(window.innerWidth < 768);
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);


    const handleSend = async (e) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const msg = inputValue;
        setInputValue('');
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: msg }]);
        setIsTyping(true);

        try {
            const response = await axios.post(route('ai.advisor.chat'), { 
                message: msg,
                chat_id: chatId,
                filters: selectedFilters
            });
            if (response.data.status === 'success') {
                if (response.data.chat_id) setChatId(response.data.chat_id);
                setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', content: response.data.reply }]);
            } else {
                setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', content: response.data.message || 'في مشكلة بالاتصال، جرب كمان شوي.' }]);
            }
        } catch (error) {
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', content: error?.response?.data?.message || 'في مشكلة بالاتصال، جرب كمان شوي.' }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleToggle = () => setIsOpen(prev => !prev);

    const onHandleTouchStart = (e) => {
        dragRef.current = { startX: e.touches[0].clientX, active: true };
    };

    const onHandleTouchMove = (e) => {
        if (!dragRef.current.active) return;
        const delta = dragRef.current.startX - e.touches[0].clientX;
        if (!isOpen && delta > 36) {
            setIsOpen(true);
            dragRef.current.active = false;
        } else if (isOpen && delta < -36) {
            setIsOpen(false);
            dragRef.current.active = false;
        }
    };

    const onHandleTouchEnd = () => {
        dragRef.current.active = false;
    };

    return (
        <>
            {/* 🎨 أنيميشنات مخصصة */}
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes ai-float-in {
                    0% { opacity: 0; transform: translateY(40px) scale(0.6); }
                    60% { opacity: 1; transform: translateY(-8px) scale(1.05); }
                    100% { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes ai-chat-in {
                    from { opacity: 0; transform: translateY(20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes ai-ping-ring {
                    0% { transform: scale(1); opacity: 0.25; }
                    100% { transform: scale(1.8); opacity: 0; }
                }
                .ai-float-in { animation: ai-float-in 0.7s cubic-bezier(0.16,1,0.3,1) both; }
                .ai-chat-in { animation: ai-chat-in 0.35s cubic-bezier(0.16,1,0.3,1) both; }
                .ai-ping-ring { animation: ai-ping-ring 2s cubic-bezier(0,0,0.2,1) infinite; }
            ` }} />

            {/* 🗨️ نافذة الشات — الزاوية السفلية اليمنى */}
            {isOpen && (
                <div
                    className="fixed right-2 sm:right-8 bottom-20 sm:bottom-28 z-[100] ai-chat-in font-sans"
                    dir="rtl"
                >
                    <div className="w-[calc(100vw-1rem)] max-w-[380px] h-[70dvh] max-h-[520px] min-h-[360px] bg-white dark:bg-slate-900 rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="p-4 bg-gradient-to-l from-sky-400 to-blue-500 text-white flex justify-between items-center shadow-lg relative overflow-hidden">
                            <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle,#fff 0.8px,transparent 0.8px)', backgroundSize: '12px 12px' }} />
                            <div className="flex items-center gap-2.5 relative z-10">
                                <div className="w-10 h-10 rounded-full overflow-hidden">
                                    <img src="/images/aiwidget.png" alt="AI Widget" className="w-full h-full object-contain" />
                                </div>
                                <div>
                                    <span className="font-black text-sm block leading-tight">مساعد سنفور الذكي</span>
                                    <span className="text-[9px] font-bold text-blue-100/70 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                        نشط ويستمع
                                    </span>
                                </div>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1.5 rounded-xl transition-all active:scale-90 relative z-10">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Messages */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950/50">
                            {messages.map(m => (
                                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-3 rounded-2xl text-[13px] font-bold leading-relaxed shadow-sm ${
                                        m.role === 'user' ? 'bg-gradient-to-r from-sky-400 to-blue-500 text-white' : 'bg-white dark:bg-slate-800 dark:text-slate-200 border dark:border-white/5'
                                    }`}>
                                        <ReactMarkdown>{m.content}</ReactMarkdown>
                                    </div>
                                </div>
                            ))}
                            {isTyping && (
                                <div className="flex gap-1.5 p-2 items-center">
                                    <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '75ms' }}></div>
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                </div>
                            )}
                        </div>

                        {/* Input area */}
                        <div className="flex flex-col border-t dark:border-white/10 bg-white dark:bg-slate-900">
                            {/* فلاتر المواد */}
                            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 flex gap-2 overflow-x-auto scrollbar-hide items-center border-b dark:border-white/5" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold whitespace-nowrap">تفضيلات:</span>
                                {filterOptions.map(opt => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => toggleFilter(opt.id)}
                                        className={`whitespace-nowrap px-3 py-1 text-[10px] font-bold rounded-full transition-all duration-200 border flex-shrink-0 ${
                                            selectedFilters.includes(opt.id) 
                                            ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white border-transparent shadow-md shadow-blue-500/20' 
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        {selectedFilters.includes(opt.id) && <span className="me-1 opacity-80">✓</span>}
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            <form onSubmit={handleSend} className="p-3 bg-white dark:bg-slate-900">
                                <div className="relative">
                                    <input
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        placeholder="اسأل سنفور (اختر التفضيلات أولاً)..."
                                        className="w-full bg-slate-100 dark:bg-white/5 border-none rounded-xl py-3 px-4 pe-12 text-xs font-bold focus:ring-2 focus:ring-blue-500 dark:text-white placeholder:text-slate-400"
                                        disabled={isTyping}
                                    />
                                    <button 
                                        type="submit" 
                                        disabled={!inputValue.trim() || isTyping}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500 transition-colors"
                                    >
                                        <svg className="w-4 h-4 -ms-0.5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {isMobile ? (
                <div className="fixed right-0 top-1/2 -translate-y-1/2 z-[100]">
                    <button
                        type="button"
                        onClick={handleToggle}
                        onTouchStart={onHandleTouchStart}
                        onTouchMove={onHandleTouchMove}
                        onTouchEnd={onHandleTouchEnd}
                        className={`h-14 w-10 rounded-l-2xl bg-slate-900/90 text-white text-[10px] font-black shadow-lg border border-white/10 backdrop-blur-md flex items-center justify-center gap-1 transition-all active:scale-95 ${isOpen ? 'ring-2 ring-blue-300 ring-offset-2' : ''}`}
                        style={{ touchAction: 'pan-y' }}
                        aria-label="AI chat"
                        title="اسحب أو اضغط"
                    >
                        <span className="-rotate-90">AI</span>
                    </button>
                </div>
            ) : (
                <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 sm:bottom-8 sm:right-8 z-[100]">
                    {!isOpen && (
                        <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-sky-400 to-blue-500 ai-ping-ring" />
                    )}

                    <button
                        onClick={handleToggle}
                        className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-visible shadow-lg shadow-blue-500/30 flex items-center justify-center transition-all duration-300 active:scale-90 group ${showEntrance ? 'ai-float-in' : ''} ${isOpen ? 'rotate-0 ring-2 ring-blue-300 ring-offset-2' : 'hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/40'}`}
                    >
                        <span className="w-full h-full rounded-full overflow-hidden bg-white/90 border border-white/80">
                            <img
                                src="/images/aiwidget.png"
                                alt="AI Widget"
                                className={`w-full h-full object-cover transition-transform duration-300 ${isOpen ? 'scale-110' : 'scale-110 group-hover:scale-[1.14]'}`}
                            />
                        </span>

                        {!isOpen && (
                            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse shadow-sm shadow-emerald-300 z-20" />
                        )}
                    </button>
                </div>
            )}
        </>
    );
}