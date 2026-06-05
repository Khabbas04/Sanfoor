import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Head, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

const translations = {
    ar: {
        title: 'محادثات AI',
        subtitle: 'مراقبة مباشرة لمحادثات الطلاب مع المرشد الأكاديمي الذكي.',
        searchPlaceholder: 'ابحث عن طالب أو محادثة...',
        chats: 'المحادثات',
        messages: 'الرسائل',
        noChats: 'لا توجد محادثات.',
        noSelectedChat: 'اختر محادثة من القائمة لعرض الرسائل.',
        totalChats: 'المحادثات',
        totalMessages: 'الرسائل',
        todayChats: 'محادثات اليوم',
        todayMessages: 'رسائل اليوم',
        aiAssistant: 'المرشد الذكي',
        student: 'الطالب',
        chatId: 'رقم المحادثة',
        rawContent: 'البيانات الخام',
    },
    en: {
        title: 'AI Chats',
        subtitle: 'Live monitoring of student conversations with the AI Academic Advisor.',
        searchPlaceholder: 'Search for a student or chat...',
        chats: 'Chats',
        messages: 'Messages',
        noChats: 'No chats found.',
        noSelectedChat: 'Select a chat from the list to view messages.',
        totalChats: 'Total Chats',
        totalMessages: 'Messages',
        todayChats: 'Today Chats',
        todayMessages: 'Today Msgs',
        aiAssistant: 'AI Advisor',
        student: 'Student',
        chatId: 'Chat ID',
        rawContent: 'Raw Payload',
    },
};

export default function AdminAiChatsIndex({ auth, summary = {}, chats = [], selectedChat = null, messages = [], filters = {} }) {
    const { isDark } = useTheme();
    const { lang } = useLanguage();
    const t = translations[lang] || translations.ar;
    const [search, setSearch] = useState(filters.q || '');
    const messagesEndRef = useRef(null);

    // Auto-scroll to bottom of messages
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, selectedChat]);

    const filteredChats = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return chats;

        return chats.filter((chat) => {
            const title = String(chat.title || '').toLowerCase();
            const userName = String(chat.user?.name || '').toLowerCase();
            const userEmail = String(chat.user?.email || '').toLowerCase();
            const chatId = String(chat.id || '');
            return title.includes(term) || userName.includes(term) || userEmail.includes(term) || chatId.includes(term);
        });
    }, [chats, search]);

    const openChat = (chatId) => {
        router.get(route('admin.ai_chats'), { chat_id: chatId, q: search || undefined }, {
            preserveState: true,
            preserveScroll: true,
            only: ['selectedChat', 'messages'],
        });
    };

    const renderMessageText = (message) => {
        const primary = String(message.display_content || message.content || '').trim();
        if (primary) return primary;
        const raw = String(message.raw_content || '').trim();
        if (raw) return raw;
        return lang === 'ar' ? 'لا يوجد نص لعرضه.' : 'No text to display.';
    };

    return (
        <AdminLayout user={auth?.user || {}}>
            <Head title={`${t.title} | سنفور`} />

            <div className="flex flex-col pb-6 min-h-[calc(100vh-100px)] lg:h-[calc(100vh-100px)] lg:overflow-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                {/* Header Stats Area */}
                <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                    <div>
                        <h1 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'} flex items-center gap-2`}>
                            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm shadow-md">🤖</span>
                            {t.title}
                        </h1>
                        <p className={`mt-1 text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.subtitle}</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <StatBadge label={t.totalChats} value={summary.total_chats || 0} isDark={isDark} color="indigo" />
                        <StatBadge label={t.totalMessages} value={summary.total_messages || 0} isDark={isDark} color="emerald" />
                        <StatBadge label={t.todayChats} value={summary.today_chats || 0} isDark={isDark} color="amber" />
                    </div>
                </div>

                {/* Main Chat Interface */}
                <div className={`flex-1 flex flex-col lg:flex-row gap-6 lg:overflow-hidden min-h-0`}>
                    
                    {/* Sidebar: Chat List */}
                    <div className={`w-full lg:w-[380px] h-[350px] lg:h-full shrink-0 flex flex-col rounded-[2rem] border overflow-hidden shadow-sm ${isDark ? 'bg-slate-900/50 border-slate-700/50' : 'bg-white border-slate-200/60'}`}>
                        {/* Search & Header */}
                        <div className={`p-5 pb-4 border-b ${isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-white/80'} backdrop-blur-md z-10`}>
                            <div className="relative">
                                <span className="absolute inset-y-0 right-4 flex items-center text-slate-400 pointer-events-none text-lg">🔍</span>
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={t.searchPlaceholder}
                                    className={`w-full rounded-2xl border-none ring-1 ring-inset pl-4 ${lang === 'ar' ? 'pr-12' : 'pl-12 pr-4'} py-3.5 text-sm font-bold outline-none transition-all ${
                                        isDark 
                                            ? 'bg-slate-800 ring-slate-700 text-white placeholder:text-slate-500 focus:ring-indigo-500' 
                                            : 'bg-slate-50 ring-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-indigo-500 focus:bg-white shadow-inner'
                                    }`}
                                />
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-1 custom-scrollbar">
                            {filteredChats.length > 0 ? filteredChats.map((chat) => {
                                const active = Number(selectedChat?.id) === Number(chat.id);
                                const userAvatar = chat.user?.avatar;
                                const userName = chat.user?.name || t.student;

                                return (
                                    <button
                                        key={chat.id}
                                        onClick={() => openChat(chat.id)}
                                        className={`w-full flex items-center gap-4 text-start p-3.5 rounded-2xl transition-all duration-200 ${
                                            active 
                                                ? (isDark ? 'bg-indigo-600/10 border border-indigo-500/20' : 'bg-indigo-50 border border-indigo-100 shadow-sm')
                                                : (isDark ? 'hover:bg-slate-800/60 border border-transparent' : 'hover:bg-slate-50 border border-transparent')
                                        }`}
                                    >
                                        <div className="relative shrink-0">
                                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-tr from-indigo-100 to-blue-50 text-indigo-600 flex items-center justify-center text-sm font-black shadow-sm">
                                                {userAvatar ? (
                                                    <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                                                ) : (
                                                    userName.charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            <span className={`absolute -bottom-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full border-2 text-[8px] font-black ${isDark ? 'border-slate-900 bg-slate-800 text-slate-300' : 'border-white bg-slate-100 text-slate-600'}`}>
                                                #{chat.id}
                                            </span>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className={`font-black text-sm truncate pr-2 ${isDark ? (active ? 'text-indigo-300' : 'text-slate-200') : (active ? 'text-indigo-900' : 'text-slate-800')}`}>
                                                    {userName}
                                                </h3>
                                                <span className={`text-[10px] font-bold shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                    {chat.last_message_at ? new Date(chat.last_message_at).toLocaleDateString() : ''}
                                                </span>
                                            </div>
                                            <p className={`text-[11px] font-bold truncate ${isDark ? (active ? 'text-indigo-200/70' : 'text-slate-400') : (active ? 'text-indigo-700/70' : 'text-slate-500')}`}>
                                                {chat.last_message_excerpt || '...'}
                                            </p>
                                        </div>
                                    </button>
                                );
                            }) : (
                                <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-50">
                                    <span className="text-4xl mb-3">📭</span>
                                    <p className={`text-sm font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.noChats}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Active Chat Area */}
                    <div className={`flex-1 min-h-[500px] lg:min-h-0 flex flex-col rounded-[2rem] border overflow-hidden shadow-sm relative ${isDark ? 'bg-[#0f172a] border-slate-700/50' : 'bg-[#f4f6f8] border-slate-200/60'}`}>
                        
                        {/* Background Pattern overlay (optional subtle dots) */}
                        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>

                        {selectedChat ? (
                            <>
                                {/* Chat Header */}
                                <div className={`relative px-6 py-4 border-b flex items-center justify-between z-10 backdrop-blur-xl ${isDark ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200/60 bg-white/70'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-tr from-indigo-100 to-blue-50 text-indigo-600 flex items-center justify-center text-sm font-black shadow-sm shrink-0">
                                            {selectedChat.user?.avatar ? (
                                                <img src={selectedChat.user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                (selectedChat.user?.name?.charAt(0) || '?').toUpperCase()
                                            )}
                                        </div>
                                        <div>
                                            <h2 className={`font-black text-base ${isDark ? 'text-white' : 'text-slate-900'} flex items-center gap-2`}>
                                                {selectedChat.user?.name || t.student}
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                                            </h2>
                                            <p className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                                {selectedChat.user?.email || 'بدون بريد'} • {t.chatId}: {selectedChat.id}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`hidden sm:flex px-3 py-1.5 rounded-xl text-[10px] font-black ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                                        {selectedChat.messages_count} {t.messages}
                                    </div>
                                </div>

                                {/* Messages Scroll Area */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10 custom-scrollbar">
                                    {messages.length > 0 ? messages.map((message) => {
                                        const isAi = ['ai', 'assistant'].includes(String(message.role).toLowerCase());
                                        const text = renderMessageText(message);
                                        const hasRaw = String(message.raw_content || '').trim().startsWith('{') && String(message.raw_content || '') !== text;
                                        
                                        return (
                                            <div key={message.id} className={`flex items-end gap-3 ${isAi ? 'flex-row' : 'flex-row-reverse'}`}>
                                                
                                                {/* Avatar Indicator */}
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shadow-sm shrink-0 overflow-hidden ${
                                                    isAi 
                                                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white' 
                                                        : (isDark ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-600 border border-slate-200')
                                                }`}>
                                                    {isAi ? '🤖' : (
                                                        selectedChat.user?.avatar ? (
                                                            <img src={selectedChat.user.avatar} className="w-full h-full object-cover" alt="Student" />
                                                        ) : '👤'
                                                    )}
                                                </div>

                                                {/* Message Bubble */}
                                                <div className={`max-w-[85%] sm:max-w-[75%] flex flex-col ${isAi ? 'items-start' : 'items-end'}`}>
                                                    <div className="flex items-center gap-2 mb-1.5 px-1">
                                                        <span className={`text-[10px] font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                                            {isAi ? t.aiAssistant : (selectedChat.user?.name || t.student)}
                                                        </span>
                                                        <span className={`text-[9px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                            {message.created_human || new Date(message.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                        </span>
                                                    </div>

                                                    <div className={`relative px-5 py-3.5 rounded-[1.5rem] text-sm leading-loose font-bold shadow-sm break-words whitespace-pre-wrap ${
                                                        isAi 
                                                            ? (isDark ? 'bg-slate-800 text-slate-100 rounded-bl-sm border border-slate-700/50' : 'bg-white text-slate-800 rounded-bl-sm border border-slate-200/50')
                                                            : 'bg-indigo-600 text-white rounded-br-sm shadow-indigo-500/20'
                                                    }`}>
                                                        {text}

                                                        {hasRaw && (
                                                            <details className={`mt-4 pt-3 border-t text-[11px] ${isAi ? (isDark ? 'border-slate-700/50' : 'border-slate-100') : 'border-indigo-500/50'}`}>
                                                                <summary className="cursor-pointer font-black opacity-70 hover:opacity-100 transition-opacity">
                                                                    {t.rawContent}
                                                                </summary>
                                                                <pre className="mt-3 p-3 rounded-xl bg-black/20 font-mono text-[10px] overflow-x-auto opacity-80" dir="ltr">
                                                                    {String(message.raw_content)}
                                                                </pre>
                                                            </details>
                                                        )}
                                                    </div>
                                                </div>

                                            </div>
                                        );
                                    }) : (
                                        <div className="h-full flex items-center justify-center">
                                            <p className={`text-sm font-black ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                لا توجد رسائل في هذه المحادثة حتى الآن.
                                            </p>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-10 relative z-10">
                                <div className={`w-24 h-24 mb-6 rounded-full flex items-center justify-center text-4xl shadow-inner ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                                    💬
                                </div>
                                <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>أهلاً بك في نظام المراقبة</h3>
                                <p className={`mt-2 text-sm font-bold text-center max-w-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {t.noSelectedChat}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
                    border-radius: 20px;
                }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                    background-color: ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'};
                }
            `}</style>
        </AdminLayout>
    );
}

function StatBadge({ label, value, isDark, color }) {
    const colors = {
        indigo: isDark ? 'bg-indigo-500/10 text-indigo-400 ring-indigo-500/20' : 'bg-indigo-50 text-indigo-700 ring-indigo-500/20',
        emerald: isDark ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' : 'bg-emerald-50 text-emerald-700 ring-emerald-500/20',
        amber: isDark ? 'bg-amber-500/10 text-amber-400 ring-amber-500/20' : 'bg-amber-50 text-amber-700 ring-amber-500/20',
    };

    return (
        <div className={`px-4 py-2 rounded-2xl ring-1 ring-inset flex items-center gap-2 ${colors[color]}`}>
            <span className="text-[10px] font-black uppercase tracking-wider opacity-80">{label}</span>
            <span className="text-sm font-black">{value}</span>
        </div>
    );
}

