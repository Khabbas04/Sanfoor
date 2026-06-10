import React, { useState, useRef, useEffect } from 'react';
import { Head, usePage, router, Link } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Bot, Send, Trash2, Clock, Calendar, Users, Settings, Plus, Check, ArrowRight } from 'lucide-react';
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

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = { role: 'user', content: input };
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
            case 'professor': return 'أستاذ دكتور (Professor)';
            case 'doctor': return 'دكتور (Doctor)';
            case 'master': return 'ماجستير (Master)';
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
            <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`} dir="rtl">
                <div className={`max-w-[90%] sm:max-w-[85%] rounded-2xl p-4 shadow-sm ${
                    isUser 
                    ? 'bg-gradient-to-tr from-sky-400 to-blue-500 text-white rounded-tl-none shadow-blue-500/10' 
                    : 'bg-white dark:bg-gray-800 border border-slate-200/50 dark:border-gray-700 text-slate-700 dark:text-gray-200 rounded-tr-none'
                }`}>
                    <div className={`prose max-w-none prose-sm sm:prose-base prose-p:leading-relaxed ${isUser ? 'prose-invert text-white' : 'dark:prose-invert dark:text-gray-200 text-slate-700'}`}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{contentText}</ReactMarkdown>
                    </div>
                    
                    {proposedSchedule && proposedSchedule.length > 0 && (
                        <div className="mt-5 bg-gray-50 dark:bg-gray-900/50 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                            <div className="p-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Calendar size={18} className="text-blue-600" /> الجدول المقترح
                                </h4>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-right text-gray-600 dark:text-gray-400">
                                    <thead className="text-xs text-gray-500 uppercase bg-gray-100/50 dark:bg-gray-800/50">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold">المادة</th>
                                            <th className="px-4 py-3 font-semibold">الأيام</th>
                                            <th className="px-4 py-3 font-semibold">الوقت</th>
                                            <th className="px-4 py-3 font-semibold">القاعة</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {proposedSchedule.map((row, i) => (
                                            <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                                                <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{row.course_name}</td>
                                                <td className="px-4 py-3">{row.days}</td>
                                                <td className="px-4 py-3 font-mono text-sm">{row.time}</td>
                                                <td className="px-4 py-3 text-blue-600 dark:text-blue-400">{row.hall}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                                <button 
                                    onClick={() => commitSchedule(proposedSchedule)}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all font-bold shadow-sm hover:shadow-md">
                                    <Check size={18} />
                                    اعتماد وتسليم للقسم
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <MainLayout user={auth.user}>
            <Head title="المساعد الذكي للجدول" />

            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 min-h-[calc(100vh-80px)] flex flex-col lg:flex-row gap-6" dir="rtl">
                
                {/* Sidebar */}
                <div className="w-full lg:w-[320px] shrink-0 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200/60 dark:border-gray-700 overflow-hidden flex flex-col h-[auto] lg:h-[calc(100vh-120px)] max-h-[800px]">
                    <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-800">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                                <Bot className="text-blue-600" /> المساعد الذكي
                            </h2>
                            <Link href={route('tree.index')} className="flex items-center gap-2 px-3 py-1.5 text-slate-500 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 dark:bg-slate-700/50 dark:hover:bg-slate-700 dark:text-slate-300 dark:hover:text-white rounded-lg transition-colors font-bold text-[11px]" title="العودة للخطط الشجرية">
                                <ArrowRight size={14} /> عودة للخطط
                            </Link>
                        </div>
                        <button 
                            onClick={() => { setCurrentChatId(null); setMessages([]); setShowPrefs(false); setShowDirectory(false); }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-sm hover:shadow-md font-bold text-sm">
                            <Plus size={18} strokeWidth={3} />
                            محادثة جديدة
                        </button>
                    </div>

                    <div className="flex gap-2 p-3 bg-gray-50/50 dark:bg-gray-900/20 border-b border-gray-100 dark:border-gray-700">
                        <button 
                            onClick={() => { setShowDirectory(true); setShowPrefs(false); }}
                            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl transition-all text-xs font-bold ${showDirectory ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shadow-sm ring-1 ring-blue-200 dark:ring-blue-800' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                            <Users size={20} />
                            الكادر
                        </button>
                        <button 
                            onClick={() => { setShowPrefs(true); setShowDirectory(false); }}
                            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl transition-all text-xs font-bold ${showPrefs ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shadow-sm ring-1 ring-blue-200 dark:ring-blue-800' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                            <Settings size={20} />
                            تفضيلاتي
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-1">
                        <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-2 pt-2 pb-1">السجل المسبق</div>
                        {chats.length === 0 ? (
                            <div className="text-center py-6 text-sm text-gray-400">لا يوجد محادثات سابقة</div>
                        ) : (
                            chats.map(chat => (
                                <div key={chat.id} 
                                    className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${currentChatId === chat.id && !showPrefs && !showDirectory ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-100 dark:ring-blue-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                                    <div onClick={() => loadChat(chat.id)} className={`flex-1 truncate text-sm font-medium ${currentChatId === chat.id && !showPrefs && !showDirectory ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                        {chat.title}
                                    </div>
                                    <button onClick={() => deleteChat(chat.id)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-lg">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200/60 dark:border-gray-700 overflow-hidden flex flex-col relative h-[600px] lg:h-[calc(100vh-120px)] max-h-[800px]">
                    
                    {/* Disclaimer */}
                    <div className="bg-amber-50 dark:bg-amber-900/20 px-4 py-2.5 text-center text-xs sm:text-sm font-medium text-amber-800 dark:text-amber-200 border-b border-amber-200/50 dark:border-amber-800/30 flex items-center justify-center gap-2">
                        <span className="text-lg">⚠️</span> النظام حالياً يستخدم بيانات افتراضية لتوضيح قدرة الذكاء الاصطناعي لحين ربط السعات الحقيقية.
                    </div>

                    {showDirectory ? (
                        <div className="p-6 md:p-10 flex-1 overflow-y-auto bg-gray-50/30 dark:bg-gray-900/30">
                            <div className="max-w-4xl mx-auto">
                                <div className="mb-8">
                                    <h3 className="text-2xl font-[900] text-gray-900 dark:text-white flex items-center gap-3">
                                        <div className="p-3 bg-blue-100 dark:bg-blue-900/50 text-blue-600 rounded-2xl"><Users size={24} /></div>
                                        كادر القسم 
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm leading-relaxed">تصفح معلومات زملائك في القسم وتفضيلاتهم الأكاديمية لمساعدتك في تنسيق الجداول والأوقات المشتركة.</p>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {other_instructors.length === 0 ? (
                                        <div className="col-span-full text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-300 dark:border-gray-600 text-gray-400">
                                            لا يوجد كادر تدريسي آخر مسجل في قسمك حالياً.
                                        </div>
                                    ) : (
                                        other_instructors.map(inst => (
                                            <div key={inst.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 to-transparent dark:from-blue-900/20 rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110"></div>
                                                <div className="flex items-center gap-4 mb-5">
                                                    <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-2xl flex items-center justify-center text-blue-700 dark:text-blue-300 font-black text-2xl shadow-inner">
                                                        {inst.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-gray-900 dark:text-white text-lg">{inst.name}</h4>
                                                        <span className="inline-block px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-lg mt-1">{rankToText(inst.academic_rank)}</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-3 border-t border-gray-50 dark:border-gray-700 pt-4">
                                                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                                                        <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-400"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg></div>
                                                        <span className="truncate">{inst.email}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                                                        <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-400"><Calendar size={16} /></div>
                                                        <span className="font-medium">{inst.preferences?.preferred_days?.length ? inst.preferences.preferred_days.join('، ') : 'لم يحدد أيام'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                                                        <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-400"><Clock size={16} /></div>
                                                        <span className="font-medium">{inst.preferences?.preferred_times?.length ? inst.preferences.preferred_times.join('، ') : 'لم يحدد أوقات'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : showPrefs ? (
                        <div className="p-6 md:p-10 flex-1 overflow-y-auto bg-gray-50/30 dark:bg-gray-900/30">
                            <div className="max-w-3xl mx-auto">
                                <div className="mb-8">
                                    <h3 className="text-2xl font-[900] text-gray-900 dark:text-white flex items-center gap-3">
                                        <div className="p-3 bg-blue-100 dark:bg-blue-900/50 text-blue-600 rounded-2xl"><Settings size={24} /></div>
                                        تفضيلاتي وقيودي
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm leading-relaxed">حدد تفضيلاتك ليتعلم الذكاء الاصطناعي طريقة جدولتك المفضلة ويطبقها تلقائياً عند طلب اقتراح جداول.</p>
                                </div>
                                
                                <div className="bg-white dark:bg-gray-800 border border-gray-200/60 dark:border-gray-700 rounded-3xl p-6 md:p-8 shadow-sm space-y-8">
                                    {/* Days */}
                                    <div>
                                        <label className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white mb-4">
                                            <Calendar className="text-blue-500" size={20} /> الأيام المفضلة للدوام
                                        </label>
                                        <div className="flex flex-wrap gap-3">
                                            {['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'].map(day => (
                                                <button key={day}
                                                    onClick={() => setPrefDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                                                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border ${prefDays.includes(day) ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-400 shadow-sm' : 'bg-transparent border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'}`}>
                                                    {day}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <hr className="border-gray-100 dark:border-gray-700" />

                                    {/* Times */}
                                    <div>
                                        <label className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white mb-4">
                                            <Clock className="text-blue-500" size={20} /> الأوقات المفضلة
                                        </label>
                                        <div className="flex flex-wrap gap-3">
                                            {['صباحي (08:00 - 11:00)', 'ظهيرة (11:00 - 14:00)', 'مسائي (14:00 - 17:00)'].map(time => (
                                                <button key={time}
                                                    onClick={() => setPrefTimes(prev => prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time])}
                                                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border ${prefTimes.includes(time) ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-400 shadow-sm' : 'bg-transparent border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'}`}>
                                                    {time}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <hr className="border-gray-100 dark:border-gray-700" />

                                    {/* Carpooling */}
                                    <div>
                                        <label className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white mb-2">
                                            <Users className="text-blue-500" size={20} /> مرافقة الزملاء (Carpooling)
                                        </label>
                                        <p className="text-sm text-gray-500 mb-4">حدد الزملاء الذين تتشارك معهم المواصلات، ليقوم المساعد بمزامنة أوقات فراغكم.</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {other_instructors.length === 0 ? (
                                                <span className="text-sm text-gray-400">لا يوجد زملاء متاحين حالياً.</span>
                                            ) : (
                                                other_instructors.map(inst => (
                                                    <div key={inst.id} 
                                                        onClick={() => toggleCarpool(inst.id)}
                                                        className={`cursor-pointer border rounded-2xl p-3 flex items-center gap-3 transition-all ${carpoolIds.includes(inst.id) ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 shadow-sm' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}>
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg transition-colors ${carpoolIds.includes(inst.id) ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                                                            {inst.name.charAt(0)}
                                                        </div>
                                                        <div className="flex-1 truncate">
                                                            <div className={`text-sm font-bold truncate transition-colors ${carpoolIds.includes(inst.id) ? 'text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-300'}`}>{inst.name}</div>
                                                        </div>
                                                        {carpoolIds.includes(inst.id) && <Check size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-4">
                                        <button onClick={handleSavePrefs} className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                                            <Check size={20} />
                                            حفظ تفضيلاتي الذكية
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
                                {messages.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center opacity-80 max-w-md mx-auto">
                                        <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/50 dark:to-blue-800/50 rounded-full flex items-center justify-center mb-6 shadow-inner ring-4 ring-white dark:ring-gray-800">
                                            <Bot size={48} className="text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <h3 className="text-2xl font-[900] text-gray-900 dark:text-white mb-3">أهلاً د. {auth.user.name}</h3>
                                        <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-sm">
                                            أنا هنا لمساعدتك في بناء وتنسيق جدولك الأكاديمي. أستطيع اقتراح الأوقات وتوزيع المواد حسب العبء التدريسي وتفضيلاتك الشخصية.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="max-w-4xl mx-auto space-y-6">
                                        {messages.map((msg, idx) => renderMessage(msg, idx))}
                                        {isLoading && (
                                            <div className="flex justify-start mb-4" dir="rtl">
                                                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 rounded-tr-none">
                                                    <div className="flex gap-2">
                                                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div ref={messagesEndRef} />
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200/60 dark:border-gray-700 z-10">
                                <form onSubmit={sendMessage} className="relative max-w-4xl mx-auto">
                                    <textarea
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                sendMessage(e);
                                            }
                                        }}
                                        placeholder="اكتب طلبك... (مثال: اقترح لي جدول بأيامي المفضلة بحيث ما أداوم أكثر من 3 محاضرات متتالية)"
                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl pr-5 pl-16 py-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none shadow-inner"
                                        rows="2"
                                        dir="rtl"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!input.trim() || isLoading}
                                        className="absolute left-3 bottom-3 top-3 px-5 bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-sm"
                                    >
                                        <Send size={20} className="mr-1" />
                                    </button>
                                </form>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}
