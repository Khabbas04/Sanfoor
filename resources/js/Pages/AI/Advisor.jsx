import React, { useState, useEffect, useRef } from 'react';
import MainLayout from '@/Layouts/MainLayout';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

export default function Advisor() {
    // استقبال الداتا من الكنترولر
    const { studentStats, chats: initialChats } = usePage().props;

    // رسالة الترحيب التي تبرز قدرات الـ Agent
    const defaultWelcomeMessage = { 
        id: 'welcome', 
        role: 'ai', 
        content: `أهلاً بك يا **${studentStats?.name || 'بطل'}**! 👋\n\nأنا **سنفور**، المساعد الذكي الخاص بك من فريق Kollia. أنا لست مجرد شات بوت للدردشة، أنا **AI Agent** متصل بنظام جامعتك!\n\nأستطيع:\n* 📊 **قراءة وتحليل** معدلك التراكمي وساعاتك المنجزة.\n* 🛒 **قراءة** ما قمت بإضافته في المحاكي وتقييمه.\n* ⚡️ **التحكم بالموقع** وتنزيل أو مسح جداول كاملة من محاكيك تلقائياً إذا طلبت مني ذلك!\n\nكيف يمكنني هندسة فصلك القادم؟` 
    };

    const [chatList, setChatList] = useState(initialChats || []);
    const [activeChatId, setActiveChatId] = useState(null);
    const [messages, setMessages] = useState([defaultWelcomeMessage]);
    
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isLoadingChat, setIsLoadingChat] = useState(false);
    const messagesEndRef = useRef(null);

    // النزول التلقائي لآخر رسالة
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    // بدء محادثة جديدة
    const handleNewChat = () => {
        setActiveChatId(null);
        setMessages([defaultWelcomeMessage]);
        setInputValue('');
    };

    // فتح محادثة سابقة
    const loadChat = async (chatId) => {
        if (activeChatId === chatId) return;
        
        setIsLoadingChat(true);
        setActiveChatId(chatId);
        
        try {
            const response = await axios.get(route('ai.advisor.messages', chatId));
            const history = response.data.map(msg => ({
                id: msg.id,
                role: msg.role,
                content: msg.content
            }));
            setMessages(history);
        } catch (error) {
            console.error("Error loading chat:", error);
            setMessages([{ id: 'error', role: 'ai', content: 'عذراً، حدث خطأ أثناء تحميل المحادثة.' }]);
        } finally {
            setIsLoadingChat(false);
        }
    };

    // إرسال رسالة والتخاطب مع الخوارزمية
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const userMsg = inputValue.trim();
        setInputValue('');

        const optimisticMsgId = Date.now();
        setMessages(prev => [...prev, { id: optimisticMsgId, role: 'user', content: userMsg }]);
        setIsTyping(true);

        try {
            const payload = { message: userMsg };
            if (activeChatId) {
                payload.chat_id = activeChatId;
            }

            const response = await axios.post(route('ai.advisor.chat'), payload);

            if (response.data.status === 'success') {
                setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', content: response.data.reply }]);
                
                if (!activeChatId && response.data.chat_id) {
                    setActiveChatId(response.data.chat_id);
                    setChatList(prev => [
                        { id: response.data.chat_id, title: userMsg.substring(0, 30) + '...', created_at: new Date().toISOString() },
                        ...prev
                    ]);
                }
            } else {
                setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', content: 'عذراً، الخادم يواجه ضغطاً حالياً. أعد المحاولة.' }]);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', content: 'عذراً، فقدت الاتصال بقاعدة البيانات. تحقق من الإنترنت.' }]);
        } finally {
            setIsTyping(false);
        }
    };

    // اقتراحات تبرز قدرات الـ Agent الجديدة
    const suggestions = [
        "نزلّي جدول من 15 ساعة يرفع معدلي بالمحاكي",
        "شو رأيك بالمواد اللي أنا ضايفها بالمحاكي؟",
        "كم معدلي المئوي حالياً بناءً على داتابيس الجامعة؟",
        "امسح جدولي ونزلي مواد تخصص دسمة"
    ];

    const handleSuggestionClick = (suggestion) => {
        setInputValue(suggestion);
    };

    return (
        <MainLayout>
            <Head title="المرشد الذكي - سنفور" />
            
            <style>{`
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
                .typing-dot { animation: typing 1.4s infinite ease-in-out both; }
                .typing-dot:nth-child(1) { animation-delay: -0.32s; }
                .typing-dot:nth-child(2) { animation-delay: -0.16s; }
                @keyframes typing { 0%, 80%, 100% { transform: scale(0); opacity: 0.5; } 40% { transform: scale(1); opacity: 1; } }
                
                /* تنسيق الملاحظات النظامية الخاصة بإضافة المواد */
                .system-notification {
                    background: linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.05));
                    border: 1px solid rgba(16,185,129,0.2);
                    padding: 8px 12px;
                    border-radius: 12px;
                    color: #047857;
                    font-size: 11px;
                    font-weight: 800;
                    display: inline-block;
                    margin-top: 10px;
                }
            `}</style>

            <div className="py-6 md:py-10 bg-[#f4f7f9] min-h-screen font-t" dir="rtl">
                <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8 items-start">

                    {/* 🔥 القائمة الجانبية (سجل المحادثات والإحصائيات) 🔥 */}
                    <div className="lg:col-span-1 space-y-6 lg:sticky top-24">
                        
                        <button 
                            onClick={handleNewChat}
                            className="w-full bg-gradient-to-l from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white p-4 rounded-[1.5rem] font-black text-[15px] shadow-[0_8px_20px_rgba(79,70,229,0.3)] flex items-center justify-center gap-3 transition-all active:scale-[0.97] group"
                        >
                            <span className="text-xl group-hover:rotate-12 transition-transform">✨</span>
                            محادثة جديدة
                        </button>

                        <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col h-[350px]">
                            <div className="p-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
                                <h3 className="font-black text-slate-800 flex items-center gap-2 text-sm">
                                    🕒 محادثاتك السابقة
                                </h3>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-hide">
                                {chatList.length > 0 ? chatList.map(chat => (
                                    <button 
                                        key={chat.id}
                                        onClick={() => loadChat(chat.id)}
                                        className={`w-full text-right p-3.5 rounded-xl transition-all flex flex-col gap-1 ${
                                            activeChatId === chat.id 
                                                ? 'bg-indigo-50 border border-indigo-100' 
                                                : 'hover:bg-slate-50 border border-transparent'
                                        }`}
                                    >
                                        <span className={`text-[12px] font-bold truncate w-full ${activeChatId === chat.id ? 'text-indigo-700' : 'text-slate-600'}`}>
                                            💬 {chat.title}
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-400 font-mono pr-5">
                                            {new Date(chat.created_at).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}
                                        </span>
                                    </button>
                                )) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                        <span className="text-3xl mb-2">📭</span>
                                        <p className="text-[11px] font-bold">لا يوجد محادثات سابقة</p>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* نافذة المحادثة (الشات) */}
                    <div className="lg:col-span-3 bg-white rounded-[2rem] border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col h-[calc(100vh-140px)] min-h-[600px] overflow-hidden relative">
                        
                        {/* 🔥 الهيدر مع اللوجو الكبير والإضاءة 🔥 */}
                        <div className="p-4 md:p-6 border-b border-slate-100 bg-white/90 backdrop-blur-xl shrink-0 flex items-center justify-between relative z-20">
                            <div className="flex items-center gap-4 md:gap-5">
                                <div className="relative">
                                    {/* لوجو كبير ومضيء */}
                                    <div className="w-16 h-16 md:w-[72px] md:h-[72px] bg-gradient-to-br from-white to-slate-50 border-2 border-indigo-100 rounded-[1.5rem] flex items-center justify-center shadow-[0_0_25px_rgba(79,70,229,0.25)] overflow-hidden p-1.5 z-10 relative">
                                        <img 
                                            src="/images/logo.png" 
                                            alt="Sanfoor AI" 
                                            className="w-full h-full object-contain transform hover:scale-110 transition-transform duration-300"
                                            onError={(e) => { e.target.onerror = null; e.target.outerHTML = '<span class="text-3xl">🤖</span>' }}
                                        />
                                    </div>
                                    <span className="absolute bottom-0 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full z-20 shadow-sm"></span>
                                    {/* إضاءة خلفية للوجو */}
                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-indigo-400 rounded-full blur-2xl opacity-20 pointer-events-none"></div>
                                </div>
                                <div>
                                    <h2 className="text-xl md:text-2xl font-[900] text-slate-800 flex items-center gap-2">
                                        سنفور AI 
                                        <span className="text-[9px] md:text-[10px] bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-2.5 py-0.5 rounded-lg font-black tracking-widest uppercase shadow-sm">Agent</span>
                                    </h2>
                                    <p className="text-[11px] md:text-xs font-bold text-indigo-600/80 mt-1 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
                                        يحلل البيانات، يتحكم بالمحاكي، ويخطط مسارك.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* سجل الرسائل */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-[#f8fafc] scrollbar-hide relative">
                            {/* خلفية مائية خفيفة */}
                            <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, #000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

                            {isLoadingChat ? (
                                <div className="h-full flex flex-col items-center justify-center text-indigo-400">
                                    <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                                    <p className="font-bold text-xs">جاري المزامنة مع قاعدة البيانات...</p>
                                </div>
                            ) : (
                                <div className="relative z-10 space-y-6">
                                    {messages.map((msg) => (
                                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                                            <div className="flex max-w-[95%] md:max-w-[80%] gap-3 items-end">
                                                
                                                {/* صورة البوت المصغرة */}
                                                {msg.role === 'ai' && (
                                                    <div className="w-10 h-10 rounded-xl bg-white border border-indigo-100 flex items-center justify-center shrink-0 mb-1 overflow-hidden p-1 shadow-sm">
                                                        <img src="/images/logo.png" alt="Sanfoor" className="w-full h-full object-contain" onError={(e) => { e.target.onerror = null; e.target.outerHTML = '<span class="text-xl">🤖</span>' }}/>
                                                    </div>
                                                )}

                                                <div className={`p-4 md:p-5 rounded-[1.5rem] ${
                                                    msg.role === 'user'
                                                        ? 'bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white rounded-br-sm shadow-md shadow-indigo-200/50'
                                                        : 'bg-white border border-slate-200/80 text-slate-700 rounded-bl-sm shadow-sm'
                                                }`}>
                                                    {msg.role === 'user' ? (
                                                        <p className="font-bold leading-relaxed text-[13px] md:text-[14px] whitespace-pre-wrap">{msg.content}</p>
                                                    ) : (
                                                        <div className="font-bold leading-relaxed text-[13px] md:text-[14px] whitespace-pre-wrap prose prose-sm prose-slate rtl:prose-reverse max-w-none prose-p:leading-[1.7] prose-li:marker:text-indigo-500">
                                                            {/* 🔥 تنسيق ذكي لرسائل الإشعارات اللي بتيجي من الباك إند 🔥 */}
                                                            <ReactMarkdown components={{
                                                                em: ({node, ...props}) => {
                                                                    if (props.children[0]?.includes('✨ إشعار من النظام')) {
                                                                        return <span className="system-notification">{props.children}</span>
                                                                    }
                                                                    return <em {...props} className="text-slate-500 not-italic bg-slate-100 px-1.5 rounded" />
                                                                }
                                                            }}>
                                                                {msg.content}
                                                            </ReactMarkdown>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* صورة الطالب */}
                                                {msg.role === 'user' && (
                                                    <div className="w-10 h-10 rounded-xl bg-slate-200 border border-slate-300 flex items-center justify-center text-sm font-black text-slate-600 shrink-0 mb-1 shadow-inner">
                                                        {studentStats?.name?.charAt(0) || 'أ'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {isTyping && (
                                        <div className="flex justify-start items-end gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-white border border-indigo-100 flex items-center justify-center shrink-0 mb-1 overflow-hidden p-1 shadow-sm">
                                                <img src="/images/logo.png" alt="Sanfoor" className="w-full h-full object-contain" onError={(e) => { e.target.onerror = null; e.target.outerHTML = '<span class="text-xl">🤖</span>' }}/>
                                            </div>
                                            <div className="bg-white border border-slate-200/80 p-4 md:p-5 rounded-[1.5rem] rounded-bl-sm shadow-sm flex gap-1.5 items-center h-[52px]">
                                                <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full typing-dot"></div>
                                                <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full typing-dot"></div>
                                                <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full typing-dot"></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div ref={messagesEndRef} className="h-4" />
                        </div>

                        {/* قسم الإدخال */}
                        <div className="bg-white border-t border-slate-100 relative z-20">
                            {messages.length < 3 && !isTyping && !activeChatId && (
                                <div className="px-6 py-3.5 bg-slate-50/80 border-b border-slate-100 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-2.5">
                                    <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md flex items-center ml-1 border border-indigo-100">💡 قدرات سنفور:</span>
                                    {suggestions.map((suggestion, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleSuggestionClick(suggestion)}
                                            className="inline-block px-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm active:scale-95"
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="p-4 md:p-6">
                                <form onSubmit={handleSendMessage} className="relative flex items-center">
                                    <input
                                        type="text"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        placeholder="اطلب من سنفور ترتيب جدولك، أو اسأله عن معدلك..."
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.25rem] py-4 pr-6 pl-[68px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-indigo-500 focus:bg-white transition-all font-bold text-sm shadow-inner"
                                        disabled={isTyping || isLoadingChat}
                                    />
                                    <button
                                        type="submit"
                                        disabled={!inputValue.trim() || isTyping || isLoadingChat}
                                        className="absolute left-2 w-12 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:hover:bg-indigo-600 active:scale-90 shadow-[0_4px_12px_rgba(79,70,229,0.3)]"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 transform rotate-180">
                                            <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                                        </svg>
                                    </button>
                                </form>
                                <p className="text-center text-[10px] text-slate-400 mt-3.5 font-bold flex items-center justify-center gap-1.5">
                                    <span>🔒</span> محادثاتك وسجلك الأكاديمي مشفرة ومحفوظة بأمان.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}