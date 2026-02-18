import React from 'react';
import { Head, Link } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';

export default function AdminDashboard({ stats }) {
    return (
        <AdminLayout title="📊 لوحة القيادة العامة">
            <Head title="الرئيسية - الأدمن" />

            {/* --- 1. قسم الترحيب --- */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-xl mb-10 relative overflow-hidden">
                <div className="relative z-10">
                    <h2 className="text-3xl font-bold mb-2">مرحباً بك في غرفة التحكم 👋</h2>
                    <p className="text-blue-100 text-lg opacity-90">
                        إليك نظرة سريعة على ما يحدث في نظام سنفور اليوم.
                    </p>
                    <div className="mt-6">
                        <Link 
                            href={route('admin.courses')} 
                            className="bg-white text-blue-700 px-6 py-2 rounded-lg font-bold hover:bg-blue-50 transition shadow-lg"
                        >
                            + إضافة مادة جديدة
                        </Link>
                    </div>
                </div>
                {/* زخرفة خلفية */}
                <div className="absolute top-0 left-0 -ml-10 -mt-10 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
            </div>

            {/* --- 2. بطاقات الإحصائيات (Grid) --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                
                {/* بطاقة الطلاب */}
                <StatCard 
                    title="الطلاب المسجلين" 
                    value={stats.students_count} 
                    icon="👨‍🎓" 
                    color="bg-purple-50 text-purple-600 border-purple-200"
                />

                {/* بطاقة المواد الكلية */}
                <StatCard 
                    title="إجمالي المواد" 
                    value={stats.courses_count} 
                    icon="📚" 
                    color="bg-blue-50 text-blue-600 border-blue-200"
                />

                {/* بطاقة مواد التخصص */}
                <StatCard 
                    title="مواد التخصص" 
                    value={stats.compulsory_count} 
                    icon="🟦" 
                    color="bg-indigo-50 text-indigo-600 border-indigo-200"
                />

                {/* بطاقة مواد الجامعة */}
                <StatCard 
                    title="متطلبات الجامعة" 
                    value={stats.elective_count} 
                    icon="🟩" 
                    color="bg-green-50 text-green-600 border-green-200"
                />
            </div>

            {/* --- 3. قسم الوصول السريع --- */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-4">🚀 وصول سريع</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <QuickAction 
                        title="إدارة المواد والشجرة" 
                        desc="أضف مواد جديدة واربط المتطلبات" 
                        link={route('admin.courses')}
                        color="bg-blue-50 hover:bg-blue-100 text-blue-700"
                    />
                    <QuickAction 
                        title="تعديل بيانات الطلاب" 
                        desc="قريباً..." 
                        link="#"
                        color="bg-gray-50 hover:bg-gray-100 text-gray-600"
                    />
                    <QuickAction 
                        title="إعدادات الموقع" 
                        desc="قريباً..." 
                        link="#"
                        color="bg-gray-50 hover:bg-gray-100 text-gray-600"
                    />
                </div>
            </div>

        </AdminLayout>
    );
}

// مكون صغير للبطاقة (عشان ما نكرر الكود)
function StatCard({ title, value, icon, color }) {
    return (
        <div className={`p-6 rounded-2xl border ${color} shadow-sm transition hover:-translate-y-1 hover:shadow-md`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-gray-500 text-sm font-bold mb-1">{title}</p>
                    <h3 className="text-4xl font-black">{value}</h3>
                </div>
                <span className="text-4xl opacity-80">{icon}</span>
            </div>
        </div>
    );
}

// مكون للوصول السريع
function QuickAction({ title, desc, link, color }) {
    return (
        <Link href={link} className={`p-4 rounded-xl transition ${color} flex flex-col gap-2`}>
            <span className="font-bold text-lg">{title}</span>
            <span className="text-sm opacity-70">{desc}</span>
        </Link>
    );
}