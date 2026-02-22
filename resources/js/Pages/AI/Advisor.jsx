import React, { useState, useEffect, useRef } from 'react';
import MainLayout from '@/Layouts/MainLayout';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';

export default function Advisor() {
    const { studentStats } = usePage().props;

    // Chat state
    const [messages, setMessages] = useState([
        { id: 1, role: 'ai', content: `أهلاً بك يا ${studentStats?.name || 'الطالب'} !أنا مرشدك الأكاديمي الذكي من سنفور 🤖. كيف يمكنني مساعدتك اليوم في خطتك الدراسية؟` }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);

    // Auto scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Handle sending message
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const userMsg = inputValue.trim();
        setInputValue('');

        // Add user message to UI
        const newMessages = [...messages, { id: Date.now(), role: 'user', content: userMsg }];
        setMessages(newMessages);
        setIsTyping(true);

        try {
            const response = await axios.post(route('ai.advisor.chat'), {
                message: userMsg
            });

            if (response.data.status === 'success') {
                setMessages([...newMessages, { id: Date.now() + 1, role: 'ai', content: response.data.reply }]);
            } else {
                setMessages([...newMessages, { id: Date.now() + 1, role: 'ai', content: 'عذراً، حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.' }]);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages([...newMessages, { id: Date.now() + 1, role: 'ai', content: 'عذراً، لا يمكنني الاتصال بالخادم حالياً. تأكد من اتصالك بالإنترنت.' }]);
        } finally {
            setIsTyping(false);
        }
    };

    const suggestions = [
        "اقترح لي مواد للفصل القادم",
        "كيف أرفع معدلي التراكمي؟",
        "هل تنصحني بتنزيل 15 ساعة؟",
        "ما هي المواد الاختيارية السهلة؟"
    ];

    const handleSuggestionClick = (suggestion) => {
        setInputValue(suggestion);
    };

    return (
        <MainLayout>
            <Head title="المرشد الذكي - سنفور" />
            <div className="py-8 md:py-12 bg-[#f8fafc] min-h-screen" dir="rtl">
                <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-4 gap-8">

                    {/* الجانب الأيمن: إحصائيات سريعة للتحليل */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                            <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                                📊 حالة التحليل
                            </h3>
                            <div className="space-y-4">
                                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                                    <p className="text-[10px] font-black text-emerald-600 uppercase">دقة التوصيات</p>
                                    <p className="text-xl font-black text-emerald-700">98%</p>
                                </div>
                                <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                                    <p className="text-[10px] font-black text-indigo-600 uppercase">المسار المكتشف</p>
                                    <p className="text-sm font-black text-indigo-700">تخصص الأمن السيبراني</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* نافذة المحادثة */}
                    <div className="lg:col-span-3 bg-white rounded-[2rem] border border-slate-200 shadow-sm flex flex-col h-[600px] md:h-[700px] overflow-hidden relative">
                        {/* الهيدر */}
                        <div className="p-6 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 ring-4 ring-indigo-50">
                                    <span className="text-2xl">🤖</span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-800">المرشد الذكي <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded-md ml-2 align-middle">BETA</span></h2>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                        <p className="text-xs font-bold text-slate-500">متصل وجاهز للمساعدة</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* سجل الرسائل */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} `}>
                                    <div className={`max - w - [85 %] md: max - w - [75 %] p - 4 rounded - 2xl md: rounded - 3xl ${msg.role === 'user'
                                            ? 'bg-indigo-600 text-white rounded-tl-sm shadow-md shadow-indigo-200/50'
                                            : 'bg-white border border-slate-200 text-slate-700 rounded-tr-sm shadow-sm'
                                        } `}>
                                        <p className="font-medium leading-relaxed text-sm md:text-base whitespace-pre-wrap">{msg.content}</p>
                                    </div>
                                </div>
                            ))}

                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-white border border-slate-200 p-4 rounded-3xl rounded-tr-sm shadow-sm flex gap-1.5 items-center">
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* اقتراحات سريعة (تظهر فقط إذا كانت المحادثة قصيرة) */}
                        {messages.length < 3 && !isTyping && (
                            <div className="px-6 pb-2 pt-4 bg-slate-50/50 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-2">
                                {suggestions.map((suggestion, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleSuggestionClick(suggestion)}
                                        className="inline-block px-4 py-2 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors shadow-sm"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* صندوق الإدخال */}
                        <div className="p-4 md:p-6 bg-white border-t border-slate-100">
                            <form onSubmit={handleSendMessage} className="relative flex items-center">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="اسأل المرشد الأكاديمي..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pr-6 pl-16 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-inner"
                                    disabled={isTyping}
                                />
                                <button
                                    type="submit"
                                    disabled={!inputValue.trim() || isTyping}
                                    className="absolute left-2 w-12 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:hover:bg-indigo-600 shadow-md active:scale-95 text-xl"
                                >
                                    ➤
                                </button>
                            </form>
                            <p className="text-center text-[10px] text-slate-400 mt-3 font-medium">المرشد الذكي يعتمد على الذكاء الاصطناعي وقد يُخطئ. يرجى مراجعة مرشدك الأكاديمي للقرارات المصيرية.</p>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}