import React, { useMemo, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

const translations = {
    ar: {
        title: 'محادثات AI',
        subtitle: 'عرض مباشر لمحادثات الطالب مع المساعد الأكاديمي، مع فلترة سريعة وقراءة الرسائل الكاملة.',
        searchPlaceholder: 'ابحث باسم الطالب أو عنوان المحادثة...',
        chats: 'المحادثات',
        messages: 'الرسائل',
        noChats: 'لا توجد محادثات مطابقة.',
        noSelectedChat: 'اختر محادثة لعرض التفاصيل.',
        totalChats: 'إجمالي المحادثات',
        totalMessages: 'إجمالي الرسائل',
        todayChats: 'محادثات اليوم',
        todayMessages: 'رسائل اليوم',
        by: 'الطالب',
        aiAssistant: 'AI',
        student: 'طالب',
        openConversation: 'فتح المحادثة',
        lastMessage: 'آخر رسالة',
        chatId: 'رقم المحادثة',
        createdAt: 'تاريخ الإنشاء',
        updatedAt: 'آخر تحديث',
    },
    en: {
        title: 'AI Chats',
        subtitle: 'Live student conversations with the academic assistant, with quick filtering and full message viewing.',
        searchPlaceholder: 'Search by student name or chat title...',
        chats: 'Chats',
        messages: 'Messages',
        noChats: 'No matching chats found.',
        noSelectedChat: 'Select a conversation to view details.',
        totalChats: 'Total Chats',
        totalMessages: 'Total Messages',
        todayChats: 'Today Chats',
        todayMessages: 'Today Messages',
        by: 'Student',
        aiAssistant: 'AI',
        student: 'Student',
        openConversation: 'Open Conversation',
        lastMessage: 'Last Message',
        chatId: 'Chat ID',
        createdAt: 'Created At',
        updatedAt: 'Updated At',
    },
};

export default function AdminAiChatsIndex({ auth, summary = {}, chats = [], selectedChat = null, messages = [], filters = {} }) {
    const { isDark } = useTheme();
    const { lang } = useLanguage();
    const t = translations[lang] || translations.ar;
    const [search, setSearch] = useState(filters.q || '');

    const card = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200';
    const cardSoft = isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-[#f8fafc] border-slate-200';
    const heading = isDark ? 'text-slate-100' : 'text-slate-800';
    const subtext = isDark ? 'text-slate-400' : 'text-slate-500';

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
            preserveScroll: true,
        });
    };

    const renderMessageText = (message) => {
        const primary = String(message.display_content || message.content || '').trim();
        if (primary) return primary;

        const raw = String(message.raw_content || '').trim();
        if (raw) return raw;

        return lang === 'ar' ? 'لا يوجد نص قابل للعرض في هذه الرسالة.' : 'No renderable text was found in this message.';
    };

    return (
        <AdminLayout user={auth?.user || {}}>
            <Head title={`${t.title} | سنفور`} />

            <div className="space-y-6 pb-8" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <div className={`${card} border rounded-3xl p-6`}>
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div>
                            <h1 className={`text-2xl font-black ${heading}`}>💬 {t.title}</h1>
                            <p className={`mt-1 text-sm font-bold ${subtext}`}>{t.subtitle}</p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
                            <MiniStat label={t.totalChats} value={summary.total_chats || 0} isDark={isDark} />
                            <MiniStat label={t.totalMessages} value={summary.total_messages || 0} isDark={isDark} />
                            <MiniStat label={t.todayChats} value={summary.today_chats || 0} isDark={isDark} />
                            <MiniStat label={t.todayMessages} value={summary.today_messages || 0} isDark={isDark} />
                        </div>
                    </div>

                    <div className="mt-5">
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t.searchPlaceholder}
                            className={`w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-6 min-h-[70vh]">
                    <section className={`${card} border rounded-3xl overflow-hidden flex flex-col`}>
                        <div className="px-5 py-4 border-b border-slate-200/50 flex items-center justify-between bg-gradient-to-b from-transparent to-slate-50/40 dark:to-slate-900/20">
                            <h2 className={`font-black ${heading}`}>{t.chats}</h2>
                            <span className={`text-[11px] font-black ${subtext}`}>{filteredChats.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {filteredChats.length > 0 ? filteredChats.map((chat) => {
                                const active = Number(selectedChat?.id) === Number(chat.id);
                                return (
                                    <button
                                        key={chat.id}
                                        onClick={() => openChat(chat.id)}
                                        className={`w-full text-right rounded-2xl border p-4 transition-all ${active ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-900/20' : cardSoft} hover:border-indigo-300 hover:-translate-y-0.5`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className={`font-black ${heading} truncate`}>{chat.title || `#${chat.id}`}</p>
                                                <p className={`text-[11px] font-bold ${subtext} mt-1 truncate`}>{chat.user?.name || t.student}{chat.user?.email ? ` • ${chat.user.email}` : ''}</p>
                                            </div>
                                            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">#{chat.id}</span>
                                        </div>
                                        <p className={`mt-3 text-[11px] font-bold ${subtext}`}>{chat.last_message_excerpt}</p>
                                        <div className={`mt-3 flex items-center justify-between text-[10px] font-bold ${subtext}`}>
                                            <span>{chat.messages_count} {t.messages}</span>
                                            <span>{chat.last_message_at ? new Date(chat.last_message_at).toLocaleString() : '--'}</span>
                                        </div>
                                    </button>
                                );
                            }) : (
                                <div className="p-8 text-center">
                                    <p className={`text-sm font-black ${subtext}`}>{t.noChats}</p>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className={`${card} border rounded-3xl overflow-hidden flex flex-col min-h-[70vh]`}>
                        {selectedChat ? (
                            <>
                                <div className="px-5 py-4 border-b border-slate-200/50 bg-gradient-to-r from-indigo-50/60 via-white to-transparent dark:from-indigo-900/20 dark:via-slate-900/40">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]"></span>
                                                <p className={`text-[11px] font-black ${subtext}`}>{t.openConversation}</p>
                                            </div>
                                            <h2 className={`font-black text-xl ${heading} truncate`}>{selectedChat.title || `#${selectedChat.id}`}</h2>
                                            <p className={`text-[11px] font-bold ${subtext} mt-1 truncate`}>
                                                {t.by}: {selectedChat.user?.name || t.student}{selectedChat.user?.email ? ` • ${selectedChat.user.email}` : ''}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-[10px] font-black">
                                            <span className="rounded-full px-2 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300">{t.chatId}: {selectedChat.id}</span>
                                            <span className="rounded-full px-2 py-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{t.messages}: {selectedChat.messages_count}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 border-b border-slate-200/50 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] font-bold">
                                    <InfoTile label={t.createdAt} value={selectedChat.created_at ? new Date(selectedChat.created_at).toLocaleString() : '--'} isDark={isDark} />
                                    <InfoTile label={t.updatedAt} value={selectedChat.updated_at ? new Date(selectedChat.updated_at).toLocaleString() : '--'} isDark={isDark} />
                                </div>

                                <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#fafbfc] dark:bg-slate-950/40">
                                    {messages.length > 0 ? messages.map((message) => {
                                        const isAi = String(message.role).toLowerCase() === 'ai';
                                        const text = renderMessageText(message);
                                        const hasStructuredPayload = String(message.raw_content || '').trim().startsWith('{') && String(message.raw_content || '') !== text;
                                        return (
                                            <div key={message.id} className={`flex items-end gap-3 ${isAi ? 'justify-start' : 'justify-end'}`}>
                                                {isAi && <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-lg shadow-indigo-500/20 shrink-0">AI</div>}
                                                <div className={`max-w-[92%] sm:max-w-[78%] rounded-3xl px-4 py-3.5 border shadow-sm ${isAi ? 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-700' : 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white border-indigo-500'}`}>
                                                    <div className="flex items-center justify-between gap-3 mb-2 text-[10px] font-black opacity-80">
                                                        <span>{isAi ? t.aiAssistant : t.student}</span>
                                                        <span>{message.created_human || '--'}</span>
                                                    </div>
                                                    <p className={`whitespace-pre-wrap break-words text-sm leading-7 font-bold ${isAi ? (isDark ? 'text-slate-100' : 'text-slate-800') : 'text-white'}`}>
                                                        {text}
                                                    </p>
                                                    {hasStructuredPayload && (
                                                        <details className="mt-3 rounded-2xl border border-dashed border-slate-300/70 dark:border-slate-600/70 px-3 py-2 text-[11px]">
                                                            <summary className={`cursor-pointer font-black ${isAi ? (isDark ? 'text-slate-400' : 'text-slate-500') : 'text-white/80'}`}>
                                                                {lang === 'ar' ? 'عرض النص الخام' : 'Show raw payload'}
                                                            </summary>
                                                            <pre className="mt-2 whitespace-pre-wrap break-words text-[10px] font-mono opacity-80 overflow-x-auto">
                                                                {String(message.raw_content || '')}
                                                            </pre>
                                                        </details>
                                                    )}
                                                </div>
                                                {!isAi && <div className="w-9 h-9 rounded-2xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-200 shrink-0">👤</div>}
                                            </div>
                                        );
                                    }) : (
                                        <div className="h-full flex items-center justify-center py-24">
                                            <p className={`text-sm font-black ${subtext}`}>{t.noSelectedChat}</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center p-10">
                                <p className={`text-sm font-black ${subtext}`}>{t.noSelectedChat}</p>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </AdminLayout>
    );
}

function MiniStat({ label, value, isDark }) {
    return (
        <div className={`rounded-2xl border px-3 py-2 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <p className={`text-[10px] font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
            <p className={`mt-1 text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
        </div>
    );
}

function InfoTile({ label, value, isDark }) {
    return (
        <div className={`rounded-2xl border px-4 py-3 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <p className={`text-[10px] font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
            <p className={`mt-1 text-sm font-black ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{value}</p>
        </div>
    );
}
