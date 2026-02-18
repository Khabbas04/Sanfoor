import React from 'react';
import { Link, usePage } from '@inertiajs/react';

export default function AdminLayout({ children, title }) {
    const { auth } = usePage().props;

    // روابط القائمة الجانبية
    const menuItems = [
        { name: '📊 الإحصائيات العامة', route: 'admin.dashboard', active: false }, // سنربطها لاحقاً
        { name: '📚 إدارة المواد والشجرة', route: 'admin.courses', active: true },
        { name: '👨‍🎓 إدارة الطلاب', route: '#', active: false },
        { name: '⚙️ الإعدادات', route: '#', active: false },
    ];

    return (
        <div className="min-h-screen bg-gray-100 font-sans text-right" dir="rtl">
            
            {/* --- 1. القائمة الجانبية (Sidebar) --- */}
            <aside className="fixed top-0 right-0 h-full w-64 bg-gray-900 text-white shadow-2xl z-50 flex flex-col">
                
                {/* لوجو الأدمن */}
                <div className="h-20 flex items-center justify-center border-b border-gray-800 bg-gray-900">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">🛡️</span>
                        <h1 className="text-xl font-bold tracking-wider">Sanfoor Admin</h1>
                    </div>
                </div>

                {/* معلومات الأدمن الحالي */}
                <div className="p-6 border-b border-gray-800 bg-gray-800/50">
                    <p className="text-xs text-gray-400 mb-1">مرحباً بك،</p>
                    <p className="font-bold text-lg truncate">{auth.user.name}</p>
                    <p className="text-xs text-green-400 mt-1">● متصل الآن</p>
                </div>

                {/* الروابط */}
                <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-2">
                    {menuItems.map((item, index) => (
                        <Link
                            key={index}
                            href={item.route === '#' ? '#' : route(item.route)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group
                                ${item.active 
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 translate-x-[-5px]' 
                                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                }
                            `}
                        >
                            <span className="font-medium">{item.name}</span>
                        </Link>
                    ))}
                </nav>

                {/* زر الخروج */}
                <div className="p-4 border-t border-gray-800">
                    <Link 
                        href={route('logout')} 
                        method="post" 
                        as="button" 
                        className="w-full flex items-center justify-center gap-2 bg-red-600/10 text-red-500 py-3 rounded-lg hover:bg-red-600 hover:text-white transition-all"
                    >
                        <span>🚪 تسجيل خروج</span>
                    </Link>
                </div>
            </aside>

            {/* --- 2. المحتوى الرئيسي (Main Content) --- */}
            <main className="mr-64 min-h-screen transition-all duration-300">
                {/* الهيدر العلوي للمحتوى */}
                <header className="bg-white shadow-sm h-20 flex items-center px-8 justify-between sticky top-0 z-40">
                    <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
                    <div className="flex gap-4">
                        <Link href="/" className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm font-bold">
                            🌐 زيارة الموقع
                        </Link>
                    </div>
                </header>

                {/* المحتوى المتغير */}
                <div className="p-8">
                    {children}
                </div>
            </main>

        </div>
    );
}