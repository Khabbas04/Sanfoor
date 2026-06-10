import React, { useState, useRef, useEffect } from 'react';
import { Head, usePage, router } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Bot, Send, Trash2, Clock, Calendar, Users, Settings, Plus, Check } from 'lucide-react';
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

    // Preferences State
    const [showPrefs, setShowPrefs] = useState(false);
    const [showDirectory, setShowDirectory] = useState(false);
    const [prefDays, setPrefDays] = useState(preferences?.preferred_days || []);
    const [prefTimes, setPrefTimes] = useState(preferences?.preferred_times || []);
    const [carpoolIds, setCarpoolIds] = useState(preferences?.carpool_with_user_ids || []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

    const renderMessage = (msg, idx) => {
        const isUser = msg.role === 'user';
        let contentText = '';
        let proposedSchedule = null;

        if (isUser) {
            contentText = msg.content;
        } else {
            // Assistant message
            if (typeof msg.content === 'object') {
                contentText = msg.content.reply || '';
                proposedSchedule = msg.content.proposed_schedule || null;
            } else {
                contentText = msg.content;
            }
        }

        return (
            <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
                <div className={`max-w-[85%] rounded-2xl p-4 ${isUser ? 'bg-primary-600 text-white rounded-tr-none' : 'bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 rounded-tl-none'}`}>
                    <div className="prose dark:prose-invert max-w-none prose-sm sm:prose-base prose-p:leading-relaxed prose-pre:bg-gray-900 prose-pre:text-gray-100">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{contentText}</ReactMarkdown>
                    </div>
                    
                    {proposedSchedule && proposedSchedule.length > 0 && (
                        <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">الجدول المقترح:</h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-right text-gray-500 dark:text-gray-400">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                        <tr>
                                            <th className="px-4 py-2">المادة</th>
                                            <th className="px-4 py-2">الأيام</th>
                                            <th className="px-4 py-2">الوقت</th>
                                            <th className="px-4 py-2">القاعة</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {proposedSchedule.map((row, i) => (
                                            <tr key={i} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                                                <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{row.course_name}</td>
                                                <td className="px-4 py-2">{row.days}</td>
                                                <td className="px-4 py-2">{row.time}</td>
                                                <td className="px-4 py-2">{row.hall}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <button 
                                onClick={() => commitSchedule(proposedSchedule)}
                                className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors font-medium">
                                <Check size={18} />
                                اعتماد هذا الجدول وتسليمه للقسم
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <MainLayout
            user={auth.user}
            header={<h2 className="font-semibold text-xl text-gray-800 dark:text-gray-200 leading-tight">المساعد الذكي للجدول (AI Scheduler)</h2>}
        >
            <Head title="المساعد الذكي للجدول" />

            <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 flex h-[calc(100vh-120px)] gap-6">
                
                {/* Sidebar */}
                <div className="w-1/3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                        <button 
                            onClick={() => { setCurrentChatId(null); setMessages([]); }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors font-medium">
                            <Plus size={18} />
                            محادثة جديدة
                        </button>
                    </div>
                    {/* Directory Button */}
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
                        <button 
                            onClick={() => { setShowDirectory(true); setShowPrefs(false); }}
                            className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-colors font-medium ${showDirectory ? 'bg-primary-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 dark:hover:border-gray-600'}`}>
                            <Users size={18} />
                            كادر القسم (Directory)
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2">
                        {chats.map(chat => (
                            <div key={chat.id} 
                                className={`group flex items-center justify-between p-3 mb-1 rounded-xl cursor-pointer transition-colors ${currentChatId === chat.id && !showPrefs && !showDirectory ? 'bg-primary-50 dark:bg-primary-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                                <div onClick={() => loadChat(chat.id)} className="flex-1 truncate text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {chat.title}
                                </div>
                                <button onClick={() => deleteChat(chat.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Preferences Button */}
                    <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                        <button 
                            onClick={() => { setShowPrefs(true); setShowDirectory(false); }}
                            className={`w-full flex items-center justify-center gap-2 px-4 py-2 border rounded-xl transition-colors font-medium ${showPrefs ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                            <Settings size={18} />
                            تفضيلاتي وقيودي
                        </button>
                    </div>
                </div>

                {/* Main Chat Area */}
                <div className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col relative">
                    
                    {/* Disclaimer Note */}
                    <div className="bg-yellow-50 dark:bg-yellow-900/30 p-3 text-center text-sm text-yellow-800 dark:text-yellow-200 border-b border-yellow-100 dark:border-yellow-800/50 flex items-center justify-center gap-2">
                        ⚠️ <span>ملاحظة: النظام حالياً يستخدم معلومات افتراضية لتوضيح قدرة الذكاء الاصطناعي لحين توفر السعات الحقيقية للقاعات.</span>
                    </div>

                    {showDirectory ? (
                        <div className="p-6 bg-white dark:bg-gray-800 flex-1 overflow-y-auto">
                            <div className="mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
                                <h3 className="text-xl font-[900] text-gray-900 dark:text-white flex items-center gap-2">
                                    <Users className="text-primary-600" /> كادر القسم (Department Staff)
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">تصفح معلومات زملائك في القسم وتفضيلاتهم الأكاديمية لمساعدتك في تنسيق الجداول والأوقات المشتركة.</p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {other_instructors.length === 0 ? (
                                    <div className="col-span-full text-center py-10 text-gray-400">لا يوجد كادر تدريسي آخر في قسمك حالياً.</div>
                                ) : (
                                    other_instructors.map(inst => (
                                        <div key={inst.id} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/50 rounded-xl flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-xl">
                                                    {inst.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900 dark:text-white text-lg">{inst.name}</h4>
                                                    <p className="text-xs text-primary-600 dark:text-primary-400 font-medium">{rankToText(inst.academic_rank)}</p>
                                                </div>
                                            </div>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                                    <span className="font-semibold w-16">الإيميل:</span>
                                                    <span className="truncate">{inst.email}</span>
                                                </div>
                                                <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                                                    <span className="font-semibold w-16 shrink-0">الأيام:</span>
                                                    <span>{inst.preferences?.preferred_days?.length ? inst.preferences.preferred_days.join('، ') : 'غير محدد'}</span>
                                                </div>
                                                <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                                                    <span className="font-semibold w-16 shrink-0">الأوقات:</span>
                                                    <span>{inst.preferences?.preferred_times?.length ? inst.preferences.preferred_times.join('، ') : 'غير محدد'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ) : showPrefs ? (
                        <div className="p-6 bg-white dark:bg-gray-800 flex-1 overflow-y-auto">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">تفضيلاتك لترتيب الجدول</h3>
                            
                            <div className="space-y-6">
                                <div>
                                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        <Calendar size={18} /> الأيام المفضلة للدوام
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'].map(day => (
                                            <button key={day}
                                                onClick={() => setPrefDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${prefDays.includes(day) ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                                {day}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        <Clock size={18} /> الأوقات المفضلة
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {['صباحي (08:00 - 11:00)', 'ظهيرة (11:00 - 14:00)', 'مسائي (14:00 - 17:00)'].map(time => (
                                            <button key={time}
                                                onClick={() => setPrefTimes(prev => prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time])}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${prefTimes.includes(time) ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                                {time}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        <Users size={18} /> الزملاء في نفس السيارة (Carpooling)
                                    </label>
                                    <select 
                                        multiple 
                                        value={carpoolIds} 
                                        onChange={(e) => setCarpoolIds(Array.from(e.target.selectedOptions, option => parseInt(option.value)))}
                                        className="w-full border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 focus:border-primary-500 dark:focus:border-primary-600 focus:ring-primary-500 dark:focus:ring-primary-600 rounded-md shadow-sm h-32">
                                        {other_instructors.map(inst => (
                                            <option key={inst.id} value={inst.id}>{inst.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">اضغط Ctrl لتحديد أكثر من زميل. سيحاول الذكاء الاصطناعي ترتيب أوقاتكم معاً.</p>
                                </div>

                                <button onClick={handleSavePrefs} className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors">
                                    حفظ التفضيلات
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 overflow-y-auto p-6">
                                {messages.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                                        <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/50 rounded-full flex items-center justify-center mb-6">
                                            <Bot size={40} className="text-primary-600 dark:text-primary-400" />
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">أهلاً د. {auth.user.name}</h3>
                                        <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                                            أنا هنا لمساعدتك في ترتيب جداولك، توزيع الشُعب، واختيار القاعات التي تتناسب مع أعداد الطلاب وتفضيلاتك الشخصية.
                                        </p>
                                    </div>
                                ) : (
                                    messages.map((msg, idx) => renderMessage(msg, idx))
                                )}
                                {isLoading && (
                                    <div className="flex justify-start mb-4">
                                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 rounded-tl-none">
                                            <div className="flex gap-1">
                                                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                                <form onSubmit={sendMessage} className="relative">
                                    <textarea
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                sendMessage(e);
                                            }
                                        }}
                                        placeholder="اكتب طلبك... (مثال: اقترح لي جدول بأيامي المفضلة بحيث ما أداوم أكثر من 3 محاضرات ورا بعض)"
                                        className="w-full bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-2xl pl-14 pr-4 py-4 text-gray-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 resize-none"
                                        rows="2"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!input.trim() || isLoading}
                                        className="absolute left-3 bottom-3 top-3 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                    >
                                        <Send size={18} />
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
