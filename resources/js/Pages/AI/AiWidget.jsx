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
    const scrollRef = useRef(null);

    // التمرير التلقائي لأسفل عند وصول رسالة جديدة
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, isTyping]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const msg = inputValue;
        setInputValue('');
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: msg }]);
        setIsTyping(true);

        try {
            // استخدام الـ Route الذي قمت بإنشائه مسبقاً في Laravel
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
        <div className="fixed bottom-6 left-6 z-[999] font-sans" dir="rtl">
            {/* واجهة الدردشة */}
            {isOpen && (
                <div className="mb-4 w-[350px] sm:w-[380px] h-[500px] bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="p-4 bg-indigo-600 text-white flex justify-between items-center shadow-lg">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white rounded-lg p-1">
                                <img src="/images/sanfoor.png" alt="Sanfoor" />
                            </div>
                            <span className="font-black text-sm">مساعد سنفور الذكي</span>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

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
                            <div className="flex gap-1 p-2">
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-75"></div>
                                <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce delay-150"></div>
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleSend} className="p-3 border-t dark:border-white/10 bg-white dark:bg-slate-900">
                        <input 
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="اسأل سنفور..."
                            className="w-full bg-slate-100 dark:bg-white/5 border-none rounded-xl py-2.5 px-4 text-xs font-bold focus:ring-2 focus:ring-indigo-500 dark:text-white"
                        />
                    </form>
                </div>
            )}

            {/* زر التشغيل العائم */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-14 h-14 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-full shadow-lg shadow-indigo-500/40 flex items-center justify-center hover:scale-110 transition-transform active:scale-95 group relative"
            >
                <img src="/images/sanfoor.png" className="w-9 h-9 object-contain transition-transform group-hover:rotate-12" />
                {!isOpen && (
                    <span className="absolute top-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse"></span>
                )}
            </button>
        </div>
    );
}