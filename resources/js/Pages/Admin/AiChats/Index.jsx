import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Head, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';
import ReactMarkdown from 'react-markdown';

const CourseButton = ({ course, variant = 'add' }) => {
    const rm = variant === 'remove';
    if (!course || !course.id) return null;
    return (
        <div className="flex items-center gap-2 opacity-90 pointer-events-none">
            <button disabled
                className={`flex-1 font-black py-2.5 px-4 rounded-xl transition-all duration-200 flex justify-between items-center text-[11.5px] ${rm ? 'bg-red-50 text-red-600 border border-red-200/60' : 'bg-blue-50/70 text-blue-700 border border-blue-200/50'}`}>
                <span className="flex items-center gap-2">
                    {rm ? '🗑' : <span className="inline-block text-sm">+</span>}
                    {rm ? `إزالة ${course.name}` : `إضافة ${course.name}`}
                </span>
                <span className={`text-[9px] px-2 py-0.5 rounded-lg font-black ${rm ? 'bg-red-200/60' : 'bg-white/80'}`}>{course.credit_hours}س</span>
            </button>
        </div>
    );
};

const ComparisonWidget = ({ widget }) => {
    const diffLabel = ['', 'سهل جداً', 'سهل', 'متوسط', 'صعب', 'صعب جداً'];
    const diffColor = (d) => d <= 2 ? 'emerald' : d <= 3 ? 'amber' : 'red';
    return (
        <div className="mt-4 pt-3 border-t border-blue-100/40 opacity-90 pointer-events-none">
            <p className="text-[10px] font-black text-blue-600 mb-3">📊 {widget.title || 'قارن واختر'}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(widget.items || []).map((item, i) => {
                    const dc = diffColor(item.difficulty || 3);
                    return (
                        <div key={i} className="relative p-4 rounded-2xl border-2 border-slate-200/50 bg-white">
                            {item.recommendation && <span className="absolute -top-2.5 right-3 text-[8px] bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full font-black shadow-sm">{item.recommendation}</span>}
                            <p className="font-black text-[13px] text-slate-800">{item.name}</p>
                            <p className="text-[9px] text-slate-400 font-mono mb-3">{item.code} • {item.credit_hours} ساعة</p>
                            <div className="mb-2.5">
                                <div className="flex justify-between text-[9px] font-bold mb-1"><span className="text-slate-400">الصعوبة</span><span className={`text-${dc}-600`}>{diffLabel[item.difficulty || 0]}</span></div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full"><div className={`h-full rounded-full bg-${dc}-500`} style={{ width: `${((item.difficulty || 1) / 5) * 100}%` }} /></div>
                            </div>
                            <div className="flex justify-between text-[9px] font-bold mb-3">
                                <span className="text-blue-600">🔓 تفتح {item.unlocks || 0} مواد</span>
                                <span className={`px-1.5 py-0.5 rounded ${item.gpa_impact === 'مرتفع' ? 'bg-emerald-50 text-emerald-700' : item.gpa_impact === 'متوسط' ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-500'}`}>المعدل: {item.gpa_impact || '—'}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const PollWidget = ({ widget }) => {
    return (
        <div className="mt-4 pt-3 border-t border-blue-100/40 opacity-90 pointer-events-none">
            <p className="text-[10px] font-black text-blue-600 mb-3">🗳️ {widget.question}</p>
            <div className="space-y-1.5">
                {(widget.options || []).map((opt, i) => (
                    <button key={i} disabled
                        className="w-full py-3 px-4 rounded-xl font-black text-[12px] bg-blue-50/70 text-blue-700 border border-blue-200/50 flex items-center justify-between">
                        <span>{opt.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

const HoursSliderWidget = ({ widget }) => {
    const min = widget.min || 9, max = widget.max || 18;
    const val = widget.default || 15;
    const pct = ((val - min) / (max - min)) * 100;
    return (
        <div className="mt-4 pt-3 border-t border-teal-100/40 opacity-90 pointer-events-none">
            <p className="text-[10px] font-black text-teal-600 mb-3">⏱️ {widget.question || 'كم ساعة تبي تسجل؟'}</p>
            <div className="bg-gradient-to-br from-teal-50/80 to-emerald-50/60 rounded-2xl p-4 border border-teal-200/40">
                <div className="text-center mb-4">
                    <span className="text-5xl font-black text-teal-700 tabular-nums">{val}</span>
                    <span className="text-base font-bold text-teal-500 mr-1">ساعة</span>
                    {widget.current_cart_hours > 0 && <p className="text-[9px] text-slate-400 font-bold mt-1">التسجيل التجريبي حالياً: {widget.current_cart_hours} ساعة</p>}
                </div>
                <div className="relative mb-4">
                    <div className="w-full h-2.5 bg-teal-100 rounded-full"><div className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full" style={{ width: `${pct}%` }} /></div>
                </div>
                <div className="flex gap-1 justify-center flex-wrap mb-4">
                    {[...Array(max - min + 1)].map((_, i) => { const v = min + i; return <button key={v} disabled className={`w-8 h-8 rounded-lg text-[10px] font-black ${v === val ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}>{v}</button>; })}
                </div>
            </div>
        </div>
    );
};

const CartReviewWidget = ({ widget }) => {
    const s = widget.summary || {};
    const getCourseState = (c) => {
        if (c.verdict === 'remove') {
            return { borderClass: 'border-red-200 bg-red-50/40', icon: '🗑️', badge: { text: 'احذفها', bg: 'bg-red-200 text-red-800' }, reason: c.reason || 'ينصح المرشد بإزالتها لتخفيف العبء' };
        }
        if (c.verdict === 'warning') {
            return { borderClass: 'border-amber-200 bg-amber-50/40', icon: '⚠️', badge: { text: 'انتبه', bg: 'bg-amber-200 text-amber-800' }, reason: c.reason || 'راقب هذه المادة' };
        }
        return { borderClass: 'border-emerald-200 bg-emerald-50/40', icon: '✅', badge: { text: 'أبقِها', bg: 'bg-emerald-200 text-emerald-800' }, reason: c.reason || 'مادة مناسبة لجدولك' };
    };

    return (
        <div className="mt-4 pt-3 border-t border-slate-200/40 opacity-90 pointer-events-none">
            <p className="text-[10px] font-black text-slate-600 mb-3">📋 {widget.title || 'مراجعة التسجيل التجريبي'}</p>
            {s.recommendation && (
                <div className="bg-gradient-to-l from-slate-50 to-blue-50/30 rounded-xl p-3 mb-3 border border-slate-200/50 flex items-center justify-between">
                    <p className="text-[10px] font-bold text-blue-600 leading-snug">{s.recommendation}</p>
                </div>
            )}
            <div className="space-y-1.5">
                {(widget.courses || []).map((c, i) => {
                    const state = getCourseState(c);
                    return (
                        <div key={i} className={`flex items-center gap-2.5 p-3 rounded-xl border-2 ${state.borderClass}`}>
                            <span className="text-base">{state.icon}</span>
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-[12px] text-slate-800 truncate">
                                    {c.name} <span className="text-[8px] font-mono text-slate-400">{c.code}</span> <span className="text-[9px] text-slate-500">{c.credit_hours}س</span>
                                </p>
                                <p className="text-[9px] text-slate-500 font-bold">{state.reason}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg ${state.badge.bg}`}>{state.badge.text}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const Widget = ({ widget }) => {
    if (!widget?.type) return null;
    const map = { comparison: ComparisonWidget, poll: PollWidget, hours_slider: HoursSliderWidget, cart_review: CartReviewWidget };
    const C = map[widget.type]; if (!C) return null;
    return <C widget={widget} />;
};

const ReadOnlyMsg = ({ msg, studentName, studentAvatar, isDark, t }) => {
    const isAi = ['ai', 'assistant'].includes(String(msg.role).toLowerCase());
    const hasRaw = String(msg.raw_content || '').trim().startsWith('{') && String(msg.raw_content || '') !== msg.content;
    
    return (
        <div className={`flex ${!isAi ? 'justify-end' : 'justify-start'} mb-6`}>
            <div className={`flex w-full md:w-[85%] lg:w-[80%] gap-3 ${!isAi ? 'flex-row-reverse' : ''} items-end`}>
                {!isAi ? (
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-xs font-black text-white shrink-0 mb-1 shadow-md ring-2 ring-white/20 overflow-hidden">
                        {studentAvatar ? <img src={studentAvatar} alt={studentName} className="w-full h-full object-cover" /> : studentName?.charAt(0) || 'أ'}
                    </div>
                ) : (
                    <div className="w-10 h-10 rounded-full bg-white border border-indigo-100 flex items-center justify-center shrink-0 mb-1 overflow-hidden shadow-sm ring-2 ring-indigo-50">
                        <span className="text-xl">🤖</span>
                    </div>
                )}
                
                <div className={`group/m flex-1 min-w-0 ${!isAi ? 'bg-gradient-to-tr from-indigo-500 to-purple-600 text-white rounded-[2rem] rounded-se-sm shadow-lg shadow-indigo-500/20 p-5' : (isDark ? 'bg-slate-800/80 border border-slate-700/60 text-slate-200 rounded-[2rem] rounded-ss-sm shadow-md backdrop-blur-sm p-5' : 'bg-white border border-slate-200/80 text-slate-700 rounded-[2rem] rounded-ss-sm shadow-sm p-5')}`}>
                    <div className="flex items-center gap-2 mb-3 px-1">
                        <span className={`text-[11px] font-black ${!isAi ? 'text-indigo-100' : (isDark ? 'text-indigo-300' : 'text-indigo-600')}`}>
                            {isAi ? t.aiAssistant : studentName}
                        </span>
                        <span className={`text-[10px] font-bold ${!isAi ? 'text-indigo-200/70' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>
                            {msg.created_human || new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                    </div>

                    {!isAi ? <p className="font-bold leading-loose text-[13px] whitespace-pre-wrap">{msg.content}</p> : (
                        <div className="w-full min-w-0">
                            <div className={`prose prose-sm max-w-none rtl:prose-li:pl-0 rtl:prose-li:pr-2 prose-li:marker:text-indigo-500 prose-p:leading-relaxed prose-ul:my-2 prose-li:my-0.5 ${isDark ? 'prose-invert prose-strong:text-indigo-300' : 'prose-slate prose-strong:text-indigo-700'}`}>
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                            
                            {msg.suggested_courses?.length > 0 && (
                                <div className={`mt-4 pt-4 border-t ${isDark ? 'border-slate-700/50' : 'border-indigo-100/60'}`}>
                                    <p className={`text-[10px] font-black mb-3 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>✨ مواد مقترحة:</p>
                                    <div className="space-y-2">{msg.suggested_courses.map(c=><CourseButton key={c.id} course={c} />)}</div>
                                </div>
                            )}
                            
                            {msg.courses_to_remove?.length > 0 && (
                                <div className={`mt-4 pt-4 border-t ${isDark ? 'border-red-900/30' : 'border-red-100/60'}`}>
                                    <p className={`text-[10px] font-black mb-3 ${isDark ? 'text-red-400' : 'text-red-500'}`}>⚠️ تخفيف العبء:</p>
                                    <div className="space-y-2">{msg.courses_to_remove.map(c=><CourseButton key={`r-${c.id}`} course={c} variant="remove"/>)}</div>
                                </div>
                            )}
                            
                            {msg.interactive_widget && <Widget widget={msg.interactive_widget} />}
                            
                            {msg.follow_up_suggestions?.length > 0 && (
                                <div className={`mt-4 pt-4 border-t flex flex-wrap gap-2 ${isDark ? 'border-slate-700/50' : 'border-slate-100/80'}`}>
                                    {msg.follow_up_suggestions.map((q,i)=> (
                                        <button key={i} disabled className={`px-4 py-2 border rounded-xl text-[11px] font-bold opacity-80 pointer-events-none ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200/70 text-slate-600'}`}>
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {hasRaw && (
                                <details className={`mt-5 pt-4 border-t text-[11px] ${isDark ? 'border-slate-700/50' : 'border-indigo-100/50'}`}>
                                    <summary className={`cursor-pointer font-black opacity-70 hover:opacity-100 transition-opacity ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        {t.rawContent}
                                    </summary>
                                    <pre className={`mt-3 p-4 rounded-2xl font-mono text-[11px] overflow-x-auto opacity-90 ${isDark ? 'bg-slate-900 text-slate-300 border border-slate-800' : 'bg-slate-50 text-slate-700 border border-slate-200'}`} dir="ltr">
                                        {String(msg.raw_content)}
                                    </pre>
                                </details>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

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

    // We removed renderMessageText because we parse it per message logic below

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
                                        let c = message.display_content || message.content;
                                        let sc = [], cr = [], fu = [], iw = null;
                                        if (['ai', 'assistant'].includes(String(message.role).toLowerCase())) {
                                            try {
                                                const p = JSON.parse(message.raw_content);
                                                if (p.reply) {
                                                    c = p.reply;
                                                    sc = p.suggested_courses || [];
                                                    cr = p.courses_to_remove || [];
                                                    fu = p.follow_up_suggestions || [];
                                                    iw = p.interactive_widget || null;
                                                }
                                            } catch (e) {}
                                        }
                                        
                                        const enhancedMsg = {
                                            ...message,
                                            content: c,
                                            suggested_courses: sc,
                                            courses_to_remove: cr,
                                            follow_up_suggestions: fu,
                                            interactive_widget: iw
                                        };

                                        return <ReadOnlyMsg 
                                            key={message.id} 
                                            msg={enhancedMsg} 
                                            studentName={selectedChat.user?.name || t.student} 
                                            studentAvatar={selectedChat.user?.avatar} 
                                            isDark={isDark} 
                                            t={t} 
                                        />;
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

