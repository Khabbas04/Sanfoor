import React, { useState, useRef, useEffect } from 'react';
import { Head, usePage, router, Link } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Bot, Send, Trash2, Clock, Calendar, Users, Settings, Plus, Check, ArrowRight, Sparkles, MessageSquare, Zap, ChevronLeft, CalendarDays, Briefcase } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axios from 'axios';

export default function AiScheduler({ chats, preferences, other_instructors }) {
    const { auth } = usePage().props;
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentChatId, setCurrentChatId] = useState(null);
    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);

    // Preferences State
    const [showPrefs, setShowPrefs] = useState(false);
    const [showDirectory, setShowDirectory] = useState(false);
    const [prefDays, setPrefDays] = useState(preferences?.preferred_days || []);
    const [prefTimes, setPrefTimes] = useState(preferences?.preferred_times || []);
    const [carpoolIds, setCarpoolIds] = useState(preferences?.carpool_with_user_ids || []);

    const scrollToBottom = () => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSavePrefs = () => {
        router.post(route('instructor.ai.scheduler.preferences'), {
            preferred_days: prefDays,
            preferred_times: prefTimes,
            carpool_with_user_ids: carpoolIds,
        }, {
            preserveScroll: true,
            onSuccess: () => setShowPrefs(false)
        });
    };

    const loadChat = async (chatId) => {
        try {
            setShowPrefs(false);
            setShowDirectory(false);
            const res = await axios.get(route('instructor.ai.scheduler.messages', chatId));
            setMessages(res.data.messages);
            setCurrentChatId(chatId);
        } catch (error) {
            console.error('Failed to load chat');
        }
    };

    const deleteChat = async (chatId) => {
        if (!confirm('هل أنت متأكد من حذف هذه المحادثة؟')) return;
        try {
            await axios.delete(route('instructor.ai.scheduler.destroy', chatId));
            if (currentChatId === chatId) {
                setCurrentChatId(null);
                setMessages([]);
            }
            router.reload({ only: ['chats'] });
        } catch (error) {
            console.error('Failed to delete chat');
        }
    };

    const sendMessage = async (e, textOverride = null) => {
        if (e) e.preventDefault();
        const textToSend = textOverride || input;
        if (!textToSend.trim() || isLoading) return;

        const userMessage = { role: 'user', content: textToSend };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await axios.post(route('instructor.ai.scheduler.chat'), {
                message: userMessage.content,
                chat_id: currentChatId
            });

            if (res.data.status === 'success') {
                if (!currentChatId) {
                    setCurrentChatId(res.data.chat_id);
                    router.reload({ only: ['chats'] });
                }
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: res.data.message
                }]);
            }
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: { reply: 'حدث خطأ في الاتصال، حاول مرة أخرى.' } }]);
        } finally {
            setIsLoading(false);
        }
    };

    const commitSchedule = async (schedule) => {
        if (!confirm('هل أنت متأكد من اعتماد هذا الجدول؟ سيتم إرساله للقسم للإعتماد النهائي.')) return;
        
        try {
            const res = await axios.post(route('instructor.ai.scheduler.commit'), { schedule });
            alert(res.data.message);
        } catch (error) {
            alert('حدث خطأ أثناء حفظ الجدول.');
        }
    };

    const rankToText = (rank) => {
        switch (rank) {
            case 'professor': return 'أستاذ دكتور';
            case 'doctor': return 'دكتور';
            case 'master': return 'ماجستير';
            default: return 'عضو هيئة تدريس';
        }
    };

    const toggleCarpool = (id) => {
        setCarpoolIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const renderMessage = (msg, idx) => {
        const isUser = msg.role === 'user';
        let contentText = '';
        let proposedSchedule = null;

        if (isUser) {
            contentText = msg.content;
        } else {
            if (typeof msg.content === 'object') {
                contentText = msg.content.reply || '';
                proposedSchedule = msg.content.proposed_schedule || null;
            } else {
                contentText = msg.content;
            }
        }

        return (
            <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6 sfr-slide-up w-full`} dir="rtl">
                <div className={`flex max-w-[95%] xl:max-w-[85%] gap-3 ${isUser ? 'flex-row-reverse' : ''} items-end`}>
                    {isUser ? (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[12px] font-black text-white shrink-0 shadow-lg shadow-indigo-500/30 overflow-hidden ring-2 ring-white dark:ring-slate-800">
                            {auth?.user?.avatar ? <img src={auth.user.avatar} alt={auth.user.name} className="w-full h-full object-cover" /> : auth?.user?.name?.charAt(0)||'أ'}
                        </div>
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0 overflow-hidden shadow-lg shadow-teal-500/30 ring-2 ring-white dark:ring-slate-800">
                            <Bot size={22} className="text-white" />
                        </div>
                    )}
                    
                    <div className={`group/m ${isUser ? 'bg-gradient-to-tr from-indigo-500 to-purple-600 text-white rounded-3xl rounded-br-sm shadow-xl shadow-indigo-500/20 p-5' : 'glass-message text-slate-800 dark:text-slate-100 rounded-3xl rounded-bl-sm w-full shadow-lg p-5 border border-white/40 dark:border-slate-700/50'}`}>
                        {isUser ? (
                            <p className="font-bold leading-relaxed text-[14px] whitespace-pre-wrap">{contentText}</p>
                        ) : (
                            <div className="w-full">
                                <div className="sfr-md text-[14px] font-medium prose max-w-none prose-p:leading-loose text-slate-700 dark:text-slate-300">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{contentText}</ReactMarkdown>
                                </div>
                                
                                {proposedSchedule && proposedSchedule.length > 0 && (
                                    <div className="mt-6 pt-5 border-t border-slate-200/50 dark:border-slate-700/50 sfr-fade-up">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                                                <CalendarDays size={18} />
                                            </div>
                                            <h4 className="text-[14px] font-black text-slate-800 dark:text-white">الجدول المقترح</h4>
                                        </div>
                                        
                                        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                            {proposedSchedule.map((row, i) => (
                                                <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow relative overflow-hidden group/card">
                                                    <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-indigo-400 to-purple-500"></div>
                                                    <h5 className="font-black text-slate-800 dark:text-white mb-2 pr-2 text-sm">{row.course_name}</h5>
                                                    <div className="space-y-2 pr-2">
                                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                                                            <Calendar size={12} className="text-indigo-500" />
                                                            <span>{row.days}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400" dir="ltr">
                                                            <Clock size={12} className="text-purple-500" />
                                                            <span className="flex-1 text-right">{row.time}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                                                            <Users size={12} className="text-emerald-500" />
                                                            <span>{row.hall}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        <div className="mt-5 flex justify-end">
                                            <button 
                                                onClick={() => commitSchedule(proposedSchedule)}
                                                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl transition-all font-black text-sm shadow-lg shadow-emerald-500/30 active:scale-95">
                                                <Check size={18} /> اعتماد وإرسال للقسم
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <MainLayout user={auth.user}>
            <Head title="المساعد الذكي للجدول" />
            <style dangerouslySetInnerHTML={{ __html: `
            :root { 
                --sfr-primary: #4f46e5; 
                --sfr-primary-light: #818cf8;
                --sfr-accent: #0ea5e9; 
                --sfr-bg: #f0fdf4;
            }
            .sfr-scrollbar::-webkit-scrollbar { width: 6px; }
            .sfr-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .sfr-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.3); border-radius: 10px; }
            .sfr-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.5); }
            
            .glass-panel {
                background: rgba(255, 255, 255, 0.85);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.5);
            }
            .dark .glass-panel {
                background: rgba(15, 23, 42, 0.75);
                border: 1px solid rgba(255, 255, 255, 0.08);
            }
            .glass-message {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
            }
            .dark .glass-message {
                background: rgba(30, 41, 59, 0.85);
            }
            
            .animate-float { animation: float 6s ease-in-out infinite; }
            @keyframes float {
                0% { transform: translateY(0px); }
                50% { transform: translateY(-12px); }
                100% { transform: translateY(0px); }
            }
            
            .gradient-text {
                background: linear-gradient(135deg, #4f46e5 0%, #0ea5e9 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            .dark .gradient-text {
                background: linear-gradient(135deg, #818cf8 0%, #38bdf8 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            
            .suggestion-chip { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
            .suggestion-chip:hover {
                transform: translateY(-3px) scale(1.02);
                box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.25);
            }
            
            @keyframes sfr-su { from { opacity:0; transform: translateY(15px); } to { opacity:1; transform: translateY(0); } }
            .sfr-slide-up { animation: sfr-su .4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            
            @keyframes sfr-fu { from { opacity:0; } to { opacity:1; } }
            .sfr-fade-up { animation: sfr-fu .5s ease-out forwards; }
            
            .sfr-md p { margin-bottom: 0.8rem; line-height: 2; }
            .sfr-md p:last-child { margin-bottom: 0; }
            .sfr-md strong { color: #4338ca; font-weight: 800; background: rgba(79,70,229,0.08); padding: 0.2rem 0.5rem; border-radius: 8px; margin: 0 0.2rem; display: inline-block;}
            .dark .sfr-md strong { color: #818cf8; background: rgba(129,140,248,0.15); }
            .sfr-md ul { list-style: none; padding-right: 0.5rem; margin-bottom: 1rem; margin-top: 0.5rem; }
            .sfr-md li { position: relative; padding-right: 1.5rem; margin-bottom: 0.6rem; line-height: 1.8; }
            .sfr-md li::before { content: ""; position: absolute; right: 0.25rem; top: 0.7em; width: 6px; height: 6px; background: linear-gradient(135deg, var(--sfr-primary), var(--sfr-accent)); border-radius: 50%; box-shadow: 0 0 8px rgba(79,70,229,0.5); }
            
            .typing-indicator span {
                display: inline-block;
                width: 6px;
                height: 6px;
                background-color: #4f46e5;
                border-radius: 50%;
                animation: typing 1.4s infinite ease-in-out both;
                margin: 0 2px;
            }
            .dark .typing-indicator span { background-color: #818cf8; }
            .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
            .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
            @keyframes typing {
                0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
                40% { transform: scale(1); opacity: 1; }
            }
            ` }} />

            <div className="fixed inset-0 top-[64px] bg-[url('/assets/grid-pattern.svg')] bg-repeat opacity-[0.03] dark:opacity-[0.05] pointer-events-none z-0"></div>
            
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-400/20 dark:bg-indigo-600/20 blur-[120px] rounded-full mix-blend-multiply pointer-events-none -z-10"></div>
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-teal-400/20 dark:bg-teal-600/20 blur-[150px] rounded-full mix-blend-multiply pointer-events-none -z-10"></div>

            <div className="max-w-[1600px] mx-auto h-[calc(100vh-64px)] flex flex-col lg:flex-row p-2 sm:p-4 gap-4 relative z-10" dir="rtl">
                
                {/* Sidebar */}
                <div className="w-full lg:w-[380px] shrink-0 glass-panel rounded-[2rem] shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden flex flex-col h-full z-20 transition-all duration-300">
                    <div className="p-6 pb-4">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="font-black text-xl text-slate-800 dark:text-white flex items-center gap-3">
                                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
                                    <Sparkles className="text-white" size={20} />
                                </div>
                                المساعد الذكي
                            </h2>
                            <Link href={route('tree.index')} className="p-2.5 text-slate-400 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-900/40 dark:text-slate-300 dark:hover:text-indigo-300 rounded-xl transition-all shadow-sm" title="العودة للخطط الشجرية">
                                <ChevronLeft size={20} />
                            </Link>
                        </div>
                        
                        <button 
                            onClick={() => { setCurrentChatId(null); setMessages([]); setShowPrefs(false); setShowDirectory(false); }}
                            className="w-full relative group overflow-hidden flex items-center justify-center gap-3 px-6 py-4 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl transition-all shadow-xl hover:shadow-2xl hover:shadow-indigo-500/20 hover:-translate-y-0.5">
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <Plus size={20} strokeWidth={3} className="relative z-10" />
                            <span className="font-black text-[15px] relative z-10">محادثة جديدة</span>
                        </button>
                    </div>

                    <div className="px-4 pb-2">
                        <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl">
                            <button 
                                onClick={() => { setShowDirectory(true); setShowPrefs(false); }}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all text-sm font-bold ${showDirectory ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                                <Users size={18} />
                                الكادر
                            </button>
                            <button 
                                onClick={() => { setShowPrefs(true); setShowDirectory(false); }}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all text-sm font-bold ${showPrefs ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                                <Settings size={18} />
                                التفضيلات
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 sfr-scrollbar">
                        <div className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 pt-2 pb-2">السجل المسبق</div>
                        {chats.length === 0 ? (
                            <div className="text-center py-10 flex flex-col items-center justify-center opacity-60">
                                <MessageSquare size={32} className="text-slate-300 dark:text-slate-600 mb-3" />
                                <span className="text-sm font-bold text-slate-400">لا يوجد محادثات سابقة</span>
                            </div>
                        ) : (
                            chats.map(chat => (
                                <div key={chat.id} 
                                    className={`group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border ${currentChatId === chat.id && !showPrefs && !showDirectory ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800/50 shadow-sm' : 'bg-transparent border-transparent hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm'}`}>
                                    <div onClick={() => loadChat(chat.id)} className={`flex-1 truncate text-[14px] font-bold ${currentChatId === chat.id && !showPrefs && !showDirectory ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                        {chat.title}
                                    </div>
                                    <button onClick={() => deleteChat(chat.id)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all p-2 rounded-xl">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 glass-panel rounded-[2rem] shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden flex flex-col relative h-full z-20">
                    
                    {/* Disclaimer */}
                    <div className="bg-gradient-to-r from-amber-500/10 via-amber-400/10 to-amber-500/10 backdrop-blur-md border-b border-amber-500/20 px-6 py-3 flex items-center justify-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                            <span className="text-amber-600 dark:text-amber-400 text-xs font-black">!</span>
                        </div>
                        <p className="text-sm font-bold text-amber-700 dark:text-amber-300">النظام حالياً يستخدم بيانات افتراضية لتوضيح قدرة الذكاء الاصطناعي لحين ربط السعات الحقيقية.</p>
                    </div>

                    {showDirectory ? (
                        <div className="p-6 lg:p-12 flex-1 overflow-y-auto sfr-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="max-w-5xl mx-auto sfr-fade-up">
                                <div className="mb-10 text-center lg:text-right">
                                    <h3 className="text-3xl font-[900] text-slate-900 dark:text-white flex items-center justify-center lg:justify-start gap-4 mb-4">
                                        <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl shadow-lg shadow-blue-500/30"><Users size={28} /></div>
                                        كادر القسم 
                                    </h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-[15px] font-medium leading-relaxed max-w-2xl">تصفح معلومات زملائك في القسم وتفضيلاتهم الأكاديمية لمساعدتك في تنسيق الجداول والأوقات المشتركة.</p>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {other_instructors.length === 0 ? (
                                        <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white/50 dark:bg-slate-800/50 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-700">
                                            <Users size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
                                            <p className="text-slate-400 font-bold text-lg">لا يوجد كادر تدريسي آخر مسجل في قسمك حالياً.</p>
                                        </div>
                                    ) : (
                                        other_instructors.map((inst, index) => (
                                            <div key={inst.id} className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group" style={{animationDelay: `${index * 100}ms`}}>
                                                <div className="flex items-center gap-5 mb-6">
                                                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-2xl shadow-inner group-hover:scale-110 transition-transform">
                                                        {inst.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-slate-800 dark:text-white text-lg mb-1">{inst.name}</h4>
                                                        <span className="inline-flex items-center px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-black rounded-lg">{rankToText(inst.academic_rank)}</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                                                    <div className="flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-400">
                                                        <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center text-indigo-500 shadow-sm"><Briefcase size={16} /></div>
                                                        <span className="truncate">{inst.email}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-400">
                                                        <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center text-purple-500 shadow-sm"><Calendar size={16} /></div>
                                                        <span className="truncate">{inst.preferences?.preferred_days?.length ? inst.preferences.preferred_days.join('، ') : 'لم يحدد أيام'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-400">
                                                        <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center text-emerald-500 shadow-sm"><Clock size={16} /></div>
                                                        <span className="truncate">{inst.preferences?.preferred_times?.length ? inst.preferences.preferred_times.join('، ') : 'لم يحدد أوقات'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : showPrefs ? (
                        <div className="p-6 lg:p-12 flex-1 overflow-y-auto sfr-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="max-w-4xl mx-auto sfr-fade-up">
                                <div className="mb-10 text-center lg:text-right">
                                    <h3 className="text-3xl font-[900] text-slate-900 dark:text-white flex items-center justify-center lg:justify-start gap-4 mb-4">
                                        <div className="p-4 bg-gradient-to-br from-emerald-400 to-teal-500 text-white rounded-2xl shadow-lg shadow-teal-500/30"><Settings size={28} /></div>
                                        تفضيلاتي وقيودي
                                    </h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-[15px] font-medium leading-relaxed max-w-2xl">حدد تفضيلاتك ليتعلم الذكاء الاصطناعي طريقة جدولتك المفضلة ويطبقها تلقائياً عند طلب اقتراح جداول.</p>
                                </div>
                                
                                <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 shadow-sm border border-slate-100 dark:border-slate-700 space-y-10">
                                    {/* Days */}
                                    <div>
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl"><Calendar size={20} /></div>
                                            <h4 className="text-xl font-black text-slate-800 dark:text-white">الأيام المفضلة للدوام</h4>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                            {['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'].map(day => (
                                                <button key={day}
                                                    onClick={() => setPrefDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                                                    className={`relative overflow-hidden px-4 py-4 rounded-2xl text-[15px] font-black transition-all border-2 ${prefDays.includes(day) ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 text-indigo-700 dark:text-indigo-300 shadow-md transform scale-[1.02]' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                                    {prefDays.includes(day) && <div className="absolute top-2 left-2"><Check size={14} className="text-indigo-600 dark:text-indigo-400" /></div>}
                                                    {day}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Times */}
                                    <div>
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded-xl"><Clock size={20} /></div>
                                            <h4 className="text-xl font-black text-slate-800 dark:text-white">الأوقات المفضلة</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {['صباحي (08:00 - 11:00)', 'ظهيرة (11:00 - 14:00)', 'مسائي (14:00 - 17:00)'].map(time => (
                                                <button key={time}
                                                    onClick={() => setPrefTimes(prev => prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time])}
                                                    className={`relative overflow-hidden px-6 py-5 rounded-2xl text-[14px] font-black transition-all border-2 ${prefTimes.includes(time) ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-300 shadow-md transform scale-[1.02]' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                                    {prefTimes.includes(time) && <div className="absolute top-3 left-3"><Check size={16} className="text-purple-600 dark:text-purple-400" /></div>}
                                                    {time.split(' (')[0]}
                                                    <span className="block mt-1 text-xs opacity-70 font-bold" dir="ltr">{time.split('(')[1]?.replace(')', '')}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Carpooling */}
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-xl"><Users size={20} /></div>
                                            <h4 className="text-xl font-black text-slate-800 dark:text-white">مرافقة الزملاء (Carpooling)</h4>
                                        </div>
                                        <p className="text-sm font-bold text-slate-500 mb-6">حدد الزملاء الذين تتشارك معهم المواصلات، ليقوم المساعد بمزامنة أوقات فراغكم.</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {other_instructors.length === 0 ? (
                                                <div className="col-span-full p-6 text-center border-2 border-dashed rounded-2xl border-slate-200 dark:border-slate-700 text-slate-400 font-bold">لا يوجد زملاء متاحين حالياً.</div>
                                            ) : (
                                                other_instructors.map(inst => (
                                                    <div key={inst.id} 
                                                        onClick={() => toggleCarpool(inst.id)}
                                                        className={`cursor-pointer border-2 rounded-2xl p-4 flex items-center gap-4 transition-all ${carpoolIds.includes(inst.id) ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 shadow-md transform scale-[1.02]' : 'bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-emerald-300'}`}>
                                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl transition-colors ${carpoolIds.includes(inst.id) ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-500 shadow-sm'}`}>
                                                            {inst.name.charAt(0)}
                                                        </div>
                                                        <div className="flex-1 truncate">
                                                            <div className={`text-[15px] font-black truncate transition-colors ${carpoolIds.includes(inst.id) ? 'text-emerald-800 dark:text-emerald-200' : 'text-slate-700 dark:text-slate-300'}`}>{inst.name}</div>
                                                        </div>
                                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${carpoolIds.includes(inst.id) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                                                            {carpoolIds.includes(inst.id) && <Check size={14} strokeWidth={3} />}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                                        <button onClick={handleSavePrefs} className="px-10 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-lg transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 flex items-center justify-center gap-3">
                                            <Check size={24} strokeWidth={3} />
                                            حفظ تفضيلاتي الذكية
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full relative">
                            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 lg:p-10 sfr-scrollbar">
                                {messages.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto sfr-fade-up mt-[-40px]">
                                        <div className="relative mb-8">
                                            <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 dark:opacity-40 rounded-full animate-float"></div>
                                            <div className="w-32 h-32 bg-gradient-to-br from-indigo-500 via-purple-500 to-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-indigo-500/30 animate-float relative z-10 border-4 border-white dark:border-slate-800">
                                                <Bot size={64} className="text-white" />
                                            </div>
                                        </div>
                                        <h3 className="text-4xl font-[900] text-slate-800 dark:text-white mb-4 tracking-tight">أهلاً بك د. <span className="gradient-text">{auth.user.name}</span></h3>
                                        <p className="text-slate-500 dark:text-slate-400 text-lg font-bold leading-relaxed mb-12">
                                            أنا مساعدك الذكي لتنسيق الجداول. أستطيع اقتراح أوقات مثالية بناءً على تفضيلاتك وعبئك التدريسي. كيف يمكنني مساعدتك اليوم؟
                                        </p>
                                        
                                        <div className="w-full">
                                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center justify-center gap-2"><Zap size={16} className="text-amber-500" /> اقتراحات للبدء</p>
                                            <div className="flex flex-wrap justify-center gap-3">
                                                {[
                                                    "اقترح لي جدولاً بـ 3 أيام فقط",
                                                    "وزع محاضراتي على الفترة الصباحية",
                                                    "ابحث عن أوقات مشتركة مع زملائي",
                                                    "تجنب المحاضرات المتتالية"
                                                ].map((suggestion, i) => (
                                                    <button 
                                                        key={i}
                                                        onClick={() => sendMessage(null, suggestion)}
                                                        className="suggestion-chip px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-full text-sm shadow-sm hover:border-indigo-300 dark:hover:border-indigo-600 flex items-center gap-2"
                                                    >
                                                        <Sparkles size={14} className="text-indigo-500" />
                                                        {suggestion}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="max-w-4xl mx-auto space-y-2 pb-6">
                                        {messages.map((msg, idx) => renderMessage(msg, idx))}
                                        {isLoading && (
                                            <div className="flex justify-start mb-6 sfr-slide-up w-full" dir="rtl">
                                                <div className="flex max-w-[95%] xl:max-w-[85%] gap-3 items-end">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0 shadow-lg shadow-teal-500/30">
                                                        <Bot size={22} className="text-white" />
                                                    </div>
                                                    <div className="glass-message text-slate-800 dark:text-slate-100 rounded-3xl rounded-bl-sm shadow-lg p-5 border border-white/40 dark:border-slate-700/50 flex items-center h-[60px]">
                                                        <div className="typing-indicator flex items-center">
                                                            <span></span><span></span><span></span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div ref={messagesEndRef} className="h-4" />
                                    </div>
                                )}
                            </div>

                            <div className="p-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700/50 z-30">
                                <form onSubmit={(e) => sendMessage(e)} className="relative max-w-4xl mx-auto flex items-end gap-3">
                                    <div className="relative flex-1 bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-slate-200/60 dark:border-slate-700/60 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
                                        <textarea
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    sendMessage(e);
                                                }
                                            }}
                                            placeholder="اسأل المساعد عن تنسيق جدولك... (Shift + Enter لسطر جديد)"
                                            className="w-full bg-transparent border-none focus:ring-0 resize-none px-6 py-5 text-slate-800 dark:text-white font-bold text-[15px] max-h-40 min-h-[64px]"
                                            rows="1"
                                            dir="rtl"
                                            style={{ outline: 'none' }}
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={!input.trim() || isLoading}
                                        className="h-16 w-16 bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-3xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-xl shadow-indigo-500/30 shrink-0 transform active:scale-95"
                                    >
                                        <Send size={24} className="ml-1 rtl:ml-0 rtl:mr-1" />
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}
