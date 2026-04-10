// resources/js/Components/AI/AiWidget.jsx

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

export default function AiWidget({ user }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { id: 1, role: 'ai', content: `هلا ${user?.name?.split(' ')[0] || 'بطل'}! أنا سنفور، معك بكل خطوة بالموقع.. كيف بقدر أساعدك؟ 🤖` }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [showEntrance, setShowEntrance] = useState(true);
    const scrollRef = useRef(null);

    // التمرير التلقائي لأسفل عند وصول رسالة جديدة
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, isTyping]);

    // 🆕 إيقاف أنيميشن الدخول بعد 3 ثوانٍ
    useEffect(() => {
        const timer = setTimeout(() => setShowEntrance(false), 3000);
        return () => clearTimeout(timer);
    }, []);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const msg = inputValue;
        setInputValue('');
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: msg }]);
        setIsTyping(true);

        try {
            const response = await axios.post(route('ai.advisor.chat'), { message: msg });
            if (response.data.status === 'success') {
                setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', content: response.data.reply }]);
            }
        } catch (error) {
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', content: 'في مشكلة بالاتصال، جرب كمان شوي.' }]);
        } finally {
            setIsTyping(false);
        }
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
                    className="fixed right-4 sm:right-8 bottom-24 sm:bottom-28 z-[100] ai-chat-in font-sans"
                    dir="rtl"
                >
                    <div className="w-[350px] sm:w-[380px] h-[500px] bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="p-4 bg-gradient-to-l from-indigo-600 to-violet-600 text-white flex justify-between items-center shadow-lg relative overflow-hidden">
                            <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle,#fff 0.8px,transparent 0.8px)', backgroundSize: '12px 12px' }} />
                            <div className="flex items-center gap-2.5 relative z-10">
                                <div className="w-10 h-10 rounded-full bg-white/15 border border-white/25 p-1 shadow-inner">
                                    <div className="w-full h-full rounded-full bg-white/90 overflow-hidden flex items-center justify-center p-[2px]">
                                        <img src="/images/aiwidget.png" alt="AI Widget" className="w-full h-full object-contain" />
                                    </div>
                                </div>
                                <div>
                                    <span className="font-black text-sm block leading-tight">مساعد سنفور الذكي</span>
                                    <span className="text-[9px] font-bold text-indigo-200/70 flex items-center gap-1">
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
                                        m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 dark:text-slate-200 border dark:border-white/5'
                                    }`}>
                                        <ReactMarkdown>{m.content}</ReactMarkdown>
                                    </div>
                                </div>
                            ))}
                            {isTyping && (
                                <div className="flex gap-1.5 p-2 items-center">
                                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '75ms' }}></div>
                                    <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <form onSubmit={handleSend} className="p-3 border-t dark:border-white/10 bg-white dark:bg-slate-900">
                            <input
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="اسأل سنفور..."
                                className="w-full bg-slate-100 dark:bg-white/5 border-none rounded-xl py-2.5 px-4 text-xs font-bold focus:ring-2 focus:ring-indigo-500 dark:text-white"
                            />
                        </form>
                    </div>
                </div>
            )}

            {/* 🔘 زر التشغيل العائم — الزاوية السفلية اليمنى */}
            <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-[100]">
                {/* 🔵 حلقة النبض الخلفية (Ping Ring) */}
                {!isOpen && (
                    <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 ai-ping-ring" />
                )}

                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`relative w-16 h-16 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-full shadow-lg shadow-indigo-500/40 flex items-center justify-center transition-all duration-300 active:scale-90 group ${showEntrance ? 'ai-float-in' : ''} ${isOpen ? 'rotate-0 ring-2 ring-indigo-300 ring-offset-2' : 'hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/50'}`}
                >
                    <span className="w-[86%] h-[86%] rounded-full bg-white/95 border border-white/70 overflow-hidden flex items-center justify-center shadow-inner p-[4px]">
                        <img
                            src="/images/aiwidget.png"
                            alt="AI Widget"
                            className={`w-full h-full object-contain transition-transform duration-300 ${isOpen ? 'rotate-0 scale-100' : 'group-hover:rotate-0 group-hover:scale-100'}`}
                        />
                    </span>

                    {/* 🟢 نقطة "نشط" */}
                    {!isOpen && (
                        <span className="absolute top-[3px] right-[3px] w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse shadow-sm shadow-emerald-300" />
                    )}
                </button>
            </div>
        </>
    );
}