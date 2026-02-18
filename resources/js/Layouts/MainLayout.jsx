// resources/js/Layouts/MainLayout.jsx
import React from 'react';
import { Link, usePage } from '@inertiajs/react';

export default function MainLayout({ children }) {
    // نجلب معلومات المستخدم المسجل من Inertia
    const { auth } = usePage().props;

    return (
        <div className="min-h-screen bg-slate-50 text-right font-cairo" dir="rtl">
            {/* --- الهيدر الثابت --- */}
            <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm transition-all duration-300">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-20 items-center">
                        
                        {/* الشعار */}
                        <Link href="/" className="flex items-center gap-3 group cursor-pointer">
                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg shadow-indigo-200 group-hover:scale-105 transition-transform duration-300">
                                🎓
                            </div>
                            <div className="flex flex-col">
                                <span className="text-2xl font-black text-slate-800 tracking-tight leading-none">سنفور</span>
                                <span className="text-[10px] font-bold text-indigo-600 tracking-widest uppercase">Smart Guide</span>
                            </div>
                        </Link>

                        {/* الروابط */}
                        <div className="hidden md:flex items-center gap-8 text-slate-600 font-bold text-sm">
                            <Link href="/" className="hover:text-indigo-600 transition-colors">الرئيسية</Link>
                            
                            {auth.user && (
                                <Link 
                                    href={route('tree.index')} 
                                    className="flex items-center gap-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl border border-indigo-100 transition-all"
                                >
                                    <span className="text-lg">🌳</span>
                                    <span>خريطتك الشجرية</span>
                                </Link>
                            )}
                        </div>

                        {/* أزرار الدخول */}
                        <div className="flex items-center gap-3">
                            {auth.user ? (
                                <Link href={route('dashboard')} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl hover:bg-black transition-all font-bold text-sm shadow-md hover:shadow-xl hover:-translate-y-0.5">
                                    لوحة التحكم
                                </Link>
                            ) : (
                                <>
                                    <Link href={route('login')} className="text-slate-600 hover:text-indigo-600 font-bold px-4 transition-colors hidden sm:block">دخول</Link>
                                    <Link href={route('register')} className="bg-gradient-to-l from-indigo-600 to-blue-600 text-white px-6 py-2.5 rounded-xl hover:shadow-lg hover:shadow-indigo-200 transition-all font-bold text-sm hover:-translate-y-0.5">
                                        حساب جديد
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* --- محتوى الصفحات المتغير (Children) --- */}
            <main className="pt-20"> {/* وضعنا مسافة علوية (pt-20) لتجنب اختفاء المحتوى تحت الهيدر الثابت */}
                {children}
            </main>
        </div>
    );
}