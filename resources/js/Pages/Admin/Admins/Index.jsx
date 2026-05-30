import React, { useMemo, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Swal from 'sweetalert2';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

const translations = {
    ar: {
        pageTitle: 'إدارة الأدمنز - Owner',
        heading: '👑 إدارة الأدمنز',
        subheading: 'هذه الصفحة خاصة بـ Owner لإدارة حسابات الأدمنز بالكامل.',
        totalAdmins: 'إجمالي الأدمنز',
        availableStudents: 'طلاب متاحون للترقية',
        ownerAccounts: 'حسابات Owner',
        promoteTitle: 'ترقية طالب إلى Admin',
        selectStudent: 'اختر طالبًا...',
        promote: 'ترقية إلى Admin',
        selected: 'المختار',
        searchPlaceholder: 'بحث في الأدمنز بالاسم أو الإيميل...',
        name: 'الاسم',
        email: 'البريد',
        rank: 'الرتبة',
        createdAt: 'تاريخ الإنشاء',
        actions: 'إجراءات',
        demote: 'تنزيل إلى Student',
        delete: 'حذف الحساب',
        noResults: 'لا توجد نتائج مطابقة.',
        promoteSuccess: 'تمت الترقية',
        promoteSuccessText: 'تمت ترقية الطالب إلى Admin.',
        selectRequired: 'اختيار مطلوب',
        selectRequiredText: 'اختر طالبًا أولًا.',
        demoteTitle: 'تنزيل الصلاحية',
        demoteText: (name) => `هل تريد تنزيل ${name} إلى Student؟`,
        demoteSuccess: 'تم التنزيل',
        demoteSuccessText: (name) => `تم تنزيل ${name} إلى Student.`,
        deleteTitle: 'حذف حساب الأدمن',
        deleteText: (name) => `سيتم حذف ${name} نهائيًا. هل أنت متأكد؟`,
        deleteSuccess: 'تم الحذف',
        deleteSuccessText: (name) => `تم حذف حساب ${name}.`,
        failed: 'فشل',
        yes: 'نعم',
        confirmDelete: 'نعم، احذف',
        cancel: 'إلغاء',
        changeRoleTitle: 'تغيير الرتبة',
        changeRoleText: (name) => `اختر الرتبة الجديدة للمستخدم ${name}`,
        changeRoleSuccess: 'تم التحديث',
        changeRoleSuccessText: (name) => `تم تغيير رتبة ${name} بنجاح.`,
        availableUsers: 'مستخدمون متاحون للتعديل',
        roleSelect: 'اختر الرتبة...',
        updateRoleBtn: 'تحديث الرتبة',
        changeRoleBtn: 'تغيير الرتبة',
        loginActivityTitle: 'سجل الدخول (للأونر)',
        loginActivitySubheading: 'آخر من سجل دخول للموقع مع التاريخ والوقت.',
        loginUser: 'المستخدم',
        loginRole: 'الدور',
        loginAt: 'وقت الدخول',
        unknownUser: 'مستخدم محذوف',
        noLoginLogs: 'لا يوجد سجل دخول حتى الآن.',
    },
    en: {
        pageTitle: 'Manage Admins - Owner',
        heading: '👑 Manage Admins',
        subheading: 'This page is for the Owner to fully manage admin accounts.',
        totalAdmins: 'Total Admins',
        availableStudents: 'Students Available for Promotion',
        ownerAccounts: 'Owner Accounts',
        promoteTitle: 'Promote Student to Admin',
        selectStudent: 'Select a student...',
        promote: 'Promote to Admin',
        selected: 'Selected',
        searchPlaceholder: 'Search admins by name or email...',
        name: 'Name',
        email: 'Email',
        rank: 'Role',
        createdAt: 'Created At',
        actions: 'Actions',
        demote: 'Demote to Student',
        delete: 'Delete Account',
        noResults: 'No matching results.',
        promoteSuccess: 'Promoted',
        promoteSuccessText: 'Student has been promoted to Admin.',
        selectRequired: 'Selection Required',
        selectRequiredText: 'Please select a student first.',
        demoteTitle: 'Demote Role',
        demoteText: (name) => `Do you want to demote ${name} to Student?`,
        demoteSuccess: 'Demoted',
        demoteSuccessText: (name) => `${name} has been demoted to Student.`,
        deleteTitle: 'Delete Admin Account',
        deleteText: (name) => `${name} will be permanently deleted. Are you sure?`,
        deleteSuccess: 'Deleted',
        deleteSuccessText: (name) => `${name}'s account has been deleted.`,
        failed: 'Failed',
        yes: 'Yes',
        confirmDelete: 'Yes, Delete',
        cancel: 'Cancel',
        changeRoleTitle: 'Change Role',
        changeRoleText: (name) => `Select new role for ${name}`,
        changeRoleSuccess: 'Updated',
        changeRoleSuccessText: (name) => `${name}'s role has been updated.`,
        availableUsers: 'Users available for edit',
        roleSelect: 'Select role...',
        updateRoleBtn: 'Update Role',
        changeRoleBtn: 'Change Role',
        loginActivityTitle: 'Login Activity (Owner)',
        loginActivitySubheading: 'Recent successful logins with date and time.',
        loginUser: 'User',
        loginRole: 'Role',
        loginAt: 'Login At',
        unknownUser: 'Deleted user',
        noLoginLogs: 'No login activity yet.',
    },
};

    export default function AdminsIndex({ auth, admins = [], students = [], loginLogs = [] }) {
    const { isDark } = useTheme();
    const { lang } = useLanguage();
    const t = translations[lang] || translations.ar;

    const [selectedUserId, setSelectedUserId] = useState('');
    const [query, setQuery] = useState('');

    const selectedStudent = useMemo(
        () => students.find((s) => String(s.id) === String(selectedUserId)),
        [students, selectedUserId],
    );

    const filteredAdmins = useMemo(() => {
        if (!query) return admins;
        const q = query.toLowerCase();
        return admins.filter((admin) => {
            const name = String(admin.name || '').toLowerCase();
            const email = String(admin.email || '').toLowerCase();
            const role = String(admin.role || '').toLowerCase();
            return name.includes(q) || email.includes(q) || role.includes(q);
        });
    }, [admins, query]);

    const [selectedRoleToAssign, setSelectedRoleToAssign] = useState('admin');

    const handleUpdateTopRole = () => {
        if (!selectedUserId) {
            Swal.fire({ icon: 'warning', title: t.selectRequired, text: t.selectRequiredText });
            return;
        }

        router.put(
            route('admin.admins.update_role', selectedUserId),
            { role: selectedRoleToAssign },
            {
                onSuccess: () => {
                    setSelectedUserId('');
                    Swal.fire({ icon: 'success', title: t.changeRoleSuccess, text: t.changeRoleSuccessText(selectedStudent?.name || '') });
                },
                onError: (errors) => {
                    Swal.fire({ icon: 'error', title: t.failed, text: Object.values(errors)[0] || (lang === 'ar' ? 'حدث خطأ أثناء الترقية.' : 'An error occurred during promotion.') });
                },
            },
        );
    };

    const handleChangeRoleTable = (admin) => {
        Swal.fire({
            icon: 'question',
            title: t.changeRoleTitle,
            text: t.changeRoleText(admin.name),
            input: 'select',
            inputOptions: {
                admin: 'Admin (أدمن)',
                instructor: 'Instructor (كادر تدريسي)',
                student: 'Student (طالب)'
            },
            inputValue: String(admin.role || '').toLowerCase(),
            showCancelButton: true,
            confirmButtonText: t.updateRoleBtn,
            cancelButtonText: t.cancel,
            confirmButtonColor: '#4f46e5',
        }).then((res) => {
            if (!res.isConfirmed || !res.value) return;

            router.put(route('admin.admins.update_role', admin.id), { role: res.value }, {
                onSuccess: () => Swal.fire({ icon: 'success', title: t.changeRoleSuccess, text: t.changeRoleSuccessText(admin.name) }),
                onError: (errors) => Swal.fire({ icon: 'error', title: t.failed, text: Object.values(errors)[0] || (lang === 'ar' ? 'حدث خطأ أثناء التنزيل.' : 'An error occurred during demotion.') }),
            });
        });
    };

    const handleDelete = (admin) => {
        Swal.fire({
            icon: 'warning',
            title: t.deleteTitle,
            text: t.deleteText(admin.name),
            showCancelButton: true,
            confirmButtonText: t.confirmDelete,
            cancelButtonText: t.cancel,
            confirmButtonColor: '#e11d48',
        }).then((res) => {
            if (!res.isConfirmed) return;

            router.delete(route('admin.admins.destroy', admin.id), {}, {
                onSuccess: () => Swal.fire({ icon: 'success', title: t.deleteSuccess, text: t.deleteSuccessText(admin.name) }),
                onError: (errors) => Swal.fire({ icon: 'error', title: t.failed, text: Object.values(errors)[0] || (lang === 'ar' ? 'حدث خطأ أثناء الحذف.' : 'An error occurred during deletion.') }),
            });
        });
    };

    return (
        <AdminLayout>
            <Head title={t.pageTitle} />

            <div className="py-8" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="mb-6">
                        <h1 className={`text-3xl font-black ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t.heading}</h1>
                        <p className={`${isDark ? 'text-slate-400' : 'text-slate-500'} font-bold mt-2 text-sm`}>{t.subheading}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                        <div className={`${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl p-4 shadow-sm`}>
                            <p className={`text-[11px] font-black ${isDark ? 'text-slate-400' : 'text-slate-400'} mb-1`}>{t.totalAdmins}</p>
                            <p className={`text-2xl font-black ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{admins.length}</p>
                        </div>
                        <div className={`${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl p-4 shadow-sm`}>
                            <p className={`text-[11px] font-black ${isDark ? 'text-slate-400' : 'text-slate-400'} mb-1`}>{t.availableUsers || t.availableStudents}</p>
                            <p className="text-2xl font-black text-indigo-500">{students.length}</p>
                        </div>
                        <div className={`${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl p-4 shadow-sm`}>
                            <p className={`text-[11px] font-black ${isDark ? 'text-slate-400' : 'text-slate-400'} mb-1`}>{t.ownerAccounts}</p>
                            <p className="text-2xl font-black text-amber-500">{admins.filter((a) => String(a.role || '').toLowerCase() === 'owner').length}</p>
                        </div>
                    </div>

                    <div className={`${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl p-5 shadow-sm mb-6`}>
                        <h2 className={`text-sm font-black ${isDark ? 'text-slate-200' : 'text-slate-800'} mb-4`}>{t.changeRoleTitle || t.promoteTitle}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                            <select
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                                className={`md:col-span-2 border rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${isDark ? 'bg-slate-700 border-slate-600 text-slate-100' : 'border-slate-200 text-slate-800'}`}
                            >
                                <option value="">{t.selectStudent}</option>
                                {students.map((student) => (
                                    <option key={student.id} value={student.id}>
                                        {student.name} - {student.email}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={selectedRoleToAssign}
                                onChange={(e) => setSelectedRoleToAssign(e.target.value)}
                                className={`md:col-span-2 border rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${isDark ? 'bg-slate-700 border-slate-600 text-slate-100' : 'border-slate-200 text-slate-800'}`}
                            >
                                <option value="admin">Admin (أدمن)</option>
                                <option value="instructor">Instructor (كادر تدريسي)</option>
                                <option value="student">Student (طالب)</option>
                            </select>

                            <button
                                onClick={handleUpdateTopRole}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-sm px-4 py-3"
                            >
                                {t.updateRoleBtn || t.promote}
                            </button>
                        </div>

                        {selectedStudent && (
                            <p className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-3`}>
                                {t.selected}: {selectedStudent.name} ({String(selectedStudent.role).toUpperCase()})
                            </p>
                        )}
                    </div>

                    <div className={`${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl overflow-hidden shadow-sm`}>
                        <div className={`p-4 border-b ${isDark ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-slate-50/70'}`}>
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={t.searchPlaceholder}
                                className={`w-full md:w-80 rounded-xl border text-sm font-bold focus:ring-indigo-500 focus:border-indigo-500 ${isDark ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-500' : 'border-slate-200 bg-white text-slate-800'}`}
                            />
                        </div>
                        <div className="overflow-x-auto">
                            <table className={`w-full ${lang === 'ar' ? 'text-right' : 'text-left'}`}>
                                <thead className={`${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'} border-b`}>
                                    <tr>
                                        <th className={`px-4 py-3 text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.name}</th>
                                        <th className={`px-4 py-3 text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.email}</th>
                                        <th className={`px-4 py-3 text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.rank}</th>
                                        <th className={`px-4 py-3 text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.createdAt}</th>
                                        <th className={`px-4 py-3 text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-500'} text-center`}>{t.actions}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAdmins.map((admin) => {
                                        const isOwner = String(admin.role || '').toLowerCase() === 'owner';

                                        return (
                                            <tr key={admin.id} className={`border-b ${isDark ? 'border-slate-700 hover:bg-slate-700/30' : 'border-slate-100 hover:bg-slate-50/50'} last:border-b-0`}>
                                                <td className={`px-4 py-3 font-black ${isDark ? 'text-slate-200' : 'text-slate-800'} text-sm`}>{admin.name}</td>
                                                <td className={`px-4 py-3 font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'} text-xs`}>{admin.email}</td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`px-2 py-1 rounded-md text-[11px] font-black ${
                                                            isOwner
                                                                ? isDark ? 'bg-amber-900/30 text-amber-300' : 'bg-amber-100 text-amber-800'
                                                                : isDark ? 'bg-indigo-900/30 text-indigo-300' : 'bg-indigo-100 text-indigo-800'
                                                        }`}
                                                    >
                                                        {isOwner ? 'OWNER' : 'ADMIN'}
                                                    </span>
                                                </td>
                                                <td className={`px-4 py-3 font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'} text-xs`}>
                                                    {new Date(admin.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            disabled={isOwner}
                                                            onClick={() => handleChangeRoleTable(admin)}
                                                            className={`px-3 py-2 rounded-lg text-[11px] font-black ${
                                                                isOwner
                                                                    ? isDark ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                                    : isDark ? 'bg-amber-900/30 text-amber-300 hover:bg-amber-900/50' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                                            }`}
                                                        >
                                                            {t.changeRoleBtn}
                                                        </button>

                                                        <button
                                                            disabled={isOwner}
                                                            onClick={() => handleDelete(admin)}
                                                            className={`px-3 py-2 rounded-lg text-[11px] font-black ${
                                                                isOwner
                                                                    ? isDark ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                                    : isDark ? 'bg-rose-900/30 text-rose-300 hover:bg-rose-900/50' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                                            }`}
                                                        >
                                                            {t.delete}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {filteredAdmins.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className={`text-center py-8 ${isDark ? 'text-slate-500' : 'text-slate-400'} font-bold text-sm`}>
                                                {t.noResults}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className={`${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl overflow-hidden shadow-sm mt-6`}>
                        <div className={`px-4 py-4 border-b ${isDark ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-slate-50/70'}`}>
                            <h2 className={`text-sm font-black ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t.loginActivityTitle}</h2>
                            <p className={`mt-1 text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.loginActivitySubheading}</p>
                        </div>

                        <div className="overflow-x-auto">
                            <table className={`w-full ${lang === 'ar' ? 'text-right' : 'text-left'}`}>
                                <thead className={`${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'} border-b`}>
                                    <tr>
                                        <th className={`px-4 py-3 text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.loginUser}</th>
                                        <th className={`px-4 py-3 text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.loginRole}</th>
                                        <th className={`px-4 py-3 text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.loginAt}</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {loginLogs.map((log) => {
                                        const role = String(log?.user?.role || '').toUpperCase() || 'N/A';
                                        const userName = log?.user?.name || t.unknownUser;
                                        const userEmail = log?.user?.email || '---';

                                        return (
                                            <tr key={log.id} className={`border-b ${isDark ? 'border-slate-700 hover:bg-slate-700/30' : 'border-slate-100 hover:bg-slate-50/50'} last:border-b-0`}>
                                                <td className="px-4 py-3">
                                                    <p className={`text-sm font-black ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{userName}</p>
                                                    <p className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{userEmail}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded-md text-[11px] font-black ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                                                        {role}
                                                    </span>
                                                </td>
                                                <td className={`px-4 py-3 text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                                    {new Date(log.created_at).toLocaleString()}
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {loginLogs.length === 0 && (
                                        <tr>
                                            <td colSpan="3" className={`text-center py-8 ${isDark ? 'text-slate-500' : 'text-slate-400'} font-bold text-sm`}>
                                                {t.noLoginLogs}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
