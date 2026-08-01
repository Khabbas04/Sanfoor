import React from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import axios from 'axios';
import Swal from 'sweetalert2';
import {
    Activity, BarChart3, BookOpen, ChevronLeft, ChevronRight,
    ClipboardList, Edit3, Eye, Filter, GraduationCap,
    Layers3, LoaderCircle, Printer, RefreshCw, Search, Trash2, UserRound,
    UsersRound, X,
} from 'lucide-react';
import {
    Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
    Tooltip, XAxis, YAxis,
} from 'recharts';
import AdminLayout from '@/Layouts/AdminLayout';

const TYPE_LABELS = {
    compulsory: 'إجباري',
    elective: 'اختياري',
    supporting: 'مساند',
    university_req: 'متطلب جامعة',
};

const TYPE_COLORS = {
    compulsory: '#4f46e5',
    elective: '#0f766e',
    supporting: '#d97706',
    university_req: '#7c3aed',
};

const numberFormatter = new Intl.NumberFormat('ar-JO');
const decimalFormatter = new Intl.NumberFormat('ar-JO', { maximumFractionDigits: 1 });

const formatNumber = (value) => numberFormatter.format(Number(value || 0));
const formatDecimal = (value) => decimalFormatter.format(Number(value || 0));
const asDate = (value) => value
    ? new Intl.DateTimeFormat('ar-JO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '—';

function MetricCard({ icon: Icon, label, value, helper, tone = 'indigo' }) {
    const tones = {
        indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300',
        teal: 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300',
        amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
        violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
        rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    };

    return (
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">{value}</p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">{helper}</p>
                </div>
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
                    <Icon className="size-5" aria-hidden="true" />
                </span>
            </div>
        </article>
    );
}

function EmptyState({ text }) {
    return (
        <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 text-center dark:border-white/10 dark:bg-white/[0.02]">
            <BookOpen className="size-9 text-slate-300" aria-hidden="true" />
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{text}</p>
        </div>
    );
}

function DemandTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const item = payload[0]?.payload;

    return (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-right shadow-xl" dir="rtl">
            <p className="max-w-56 text-xs font-black text-slate-900">{item?.name}</p>
            <p className="mt-1 text-[11px] font-bold text-slate-500">{item?.code}</p>
            <p className="mt-2 text-sm font-black text-indigo-700">{formatNumber(item?.cart_users_count)} طالب</p>
        </div>
    );
}

function EditCourseModal({ course, majors, form, onClose, onSubmit }) {
    if (!course) return null;

    const { data, setData, processing, errors } = form;

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm print:hidden" role="dialog" aria-modal="true" aria-labelledby="edit-course-title">
            <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="إغلاق نافذة التعديل" />
            <form onSubmit={onSubmit} className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900" dir="rtl">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur dark:border-white/10 dark:bg-slate-900/95">
                    <div>
                        <h2 id="edit-course-title" className="text-lg font-black text-slate-950 dark:text-white">تعديل بيانات المادة</h2>
                        <p className="mt-1 text-xs font-bold text-slate-500">{course.code} · ستنعكس التعديلات على الخطة الأكاديمية.</p>
                    </div>
                    <button type="button" onClick={onClose} className="flex size-10 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:hover:bg-white/10" aria-label="إغلاق">
                        <X className="size-5" />
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
                    <Field label="اسم المادة" error={errors.name}>
                        <input value={data.name} onChange={(e) => setData('name', e.target.value)} className="admin-demand-input" required />
                    </Field>
                    <Field label="رمز المادة" error={errors.code}>
                        <input value={data.code} onChange={(e) => setData('code', e.target.value)} className="admin-demand-input" required dir="ltr" />
                    </Field>
                    <Field label="التخصص" error={errors.major_id}>
                        <select value={data.major_id ?? ''} onChange={(e) => setData('major_id', e.target.value || null)} className="admin-demand-input">
                            <option value="">متطلب عام / دون تخصص</option>
                            {majors.map((major) => <option key={major.id} value={major.id}>{major.name}</option>)}
                        </select>
                    </Field>
                    <Field label="نوع المادة" error={errors.type}>
                        <select value={data.type} onChange={(e) => setData('type', e.target.value)} className="admin-demand-input">
                            {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                    </Field>
                    <Field label="الساعات المعتمدة" error={errors.credit_hours}>
                        <input type="number" min="0" max="12" value={data.credit_hours} onChange={(e) => setData('credit_hours', e.target.value)} className="admin-demand-input" required />
                    </Field>
                    <Field label="الفصل المقترح بالخطة" error={errors.semester}>
                        <input type="number" min="1" max="12" value={data.semester} onChange={(e) => setData('semester', e.target.value)} className="admin-demand-input" required />
                    </Field>
                    <Field label="إصدار الخطة" error={errors.study_plan_version}>
                        <select value={data.study_plan_version} onChange={(e) => setData('study_plan_version', e.target.value)} className="admin-demand-input">
                            <option value="12">الخطة 12</option>
                            <option value="11">الخطة 11</option>
                        </select>
                    </Field>
                    <Field label="مستوى الصعوبة (1–5)" error={errors.difficulty_level}>
                        <input type="number" min="1" max="5" value={data.difficulty_level} onChange={(e) => setData('difficulty_level', e.target.value)} className="admin-demand-input" />
                    </Field>
                    <Field label="شرط الساعات المجتازة" error={errors.minimum_passed_hours}>
                        <input type="number" min="1" max="200" value={data.minimum_passed_hours ?? ''} onChange={(e) => setData('minimum_passed_hours', e.target.value || null)} className="admin-demand-input" placeholder="لا يوجد" />
                    </Field>
                    <div className="md:col-span-2">
                        <Field label="وصف المادة" error={errors.description}>
                            <textarea rows="4" value={data.description ?? ''} onChange={(e) => setData('description', e.target.value)} className="admin-demand-input resize-y" />
                        </Field>
                    </div>
                </div>

                <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur dark:border-white/10 dark:bg-slate-900/95">
                    <button type="button" onClick={onClose} className="min-h-11 cursor-pointer rounded-xl border border-slate-200 px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">إلغاء</button>
                    <button type="submit" disabled={processing} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-black text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
                        {processing && <LoaderCircle className="size-4 animate-spin" />}
                        حفظ التعديلات
                    </button>
                </div>
            </form>
        </div>
    );
}

function Field({ label, error, children }) {
    return (
        <label className="block text-right">
            <span className="mb-2 block text-xs font-black text-slate-700 dark:text-slate-300">{label}</span>
            {children}
            {error && <span className="mt-1 block text-[11px] font-bold text-rose-600">{error}</span>}
        </label>
    );
}

function StudentsDrawer({ course, students, loading, search, setSearch, onClose, onRemove, removingId, onPrint }) {
    if (!course) return null;

    const visibleStudents = students.filter((student) => {
        const query = search.trim().toLowerCase();
        if (!query) return true;
        return [student.name, student.email, student.student_number, student.major]
            .some((value) => String(value || '').toLowerCase().includes(query));
    });

    return (
        <div className="fixed inset-0 z-[80] bg-slate-950/45 backdrop-blur-sm print:hidden" role="dialog" aria-modal="true" aria-labelledby="students-drawer-title">
            <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="إغلاق تفاصيل الطلاب" />
            <section className="absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col bg-white shadow-2xl dark:bg-slate-950" dir="rtl">
                <header className="border-b border-slate-200 px-5 py-5 dark:border-white/10 sm:px-7">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[11px] font-black text-indigo-600">{course.code}</p>
                            <h2 id="students-drawer-title" className="mt-1 text-xl font-black text-slate-950 dark:text-white">الطلاب المسجلون في {course.name}</h2>
                            <p className="mt-2 text-xs font-bold text-slate-500">التسجيل التجريبي للفصل الحالي · {formatNumber(students.length)} طالب</p>
                        </div>
                        <button onClick={onClose} className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:hover:bg-white/10" aria-label="إغلاق">
                            <X className="size-5" />
                        </button>
                    </div>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                        <label className="relative flex-1">
                            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                            <span className="sr-only">بحث في الطلاب</span>
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="الاسم، البريد، الرقم الجامعي أو التخصص" className="admin-demand-input pr-10" />
                        </label>
                        <button onClick={onPrint} disabled={loading || students.length === 0} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">
                            <Printer className="size-4" /> طباعة قائمة الطلاب
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {loading ? (
                        <div className="flex h-72 items-center justify-center gap-3 text-sm font-bold text-slate-500">
                            <LoaderCircle className="size-5 animate-spin text-indigo-600" /> جارٍ تحميل سجلات الطلاب…
                        </div>
                    ) : visibleStudents.length === 0 ? (
                        <EmptyState text={students.length ? 'لا توجد نتائج مطابقة للبحث.' : 'لا يوجد طلاب مسجلون في هذه المادة حالياً.'} />
                    ) : (
                        <div className="space-y-3">
                            {visibleStudents.map((student) => (
                                <article key={student.id} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-indigo-200 hover:shadow-sm dark:border-white/10 dark:bg-slate-900 dark:hover:border-indigo-500/40">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                                                <UserRound className="size-5" />
                                            </span>
                                            <div className="min-w-0">
                                                <h3 className="truncate text-sm font-black text-slate-950 dark:text-white">{student.name}</h3>
                                                <p className="mt-1 truncate text-[11px] font-semibold text-slate-500" dir="ltr">{student.email}</p>
                                                <p className="mt-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">{student.major} · خطة {student.study_plan_version}</p>
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 gap-2">
                                            <Link href={route('admin.students.index', { search: student.email })} className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[11px] font-black text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">
                                                <Eye className="size-3.5" /> إدارة الطالب
                                            </Link>
                                            <button onClick={() => onRemove(student)} disabled={removingId === student.id} className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-[11px] font-black text-rose-700 transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10">
                                                {removingId === student.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                                                إزالة التسجيل
                                            </button>
                                        </div>
                                    </div>
                                    <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-[11px] sm:grid-cols-4 dark:border-white/5">
                                        <div><dt className="font-bold text-slate-400">الرقم الجامعي</dt><dd className="mt-1 font-black text-slate-700 dark:text-slate-200">{student.student_number || '—'}</dd></div>
                                        <div><dt className="font-bold text-slate-400">ساعات السلة</dt><dd className="mt-1 font-black text-slate-700 dark:text-slate-200">{formatNumber(student.cart_hours)}</dd></div>
                                        <div><dt className="font-bold text-slate-400">مواد السلة</dt><dd className="mt-1 font-black text-slate-700 dark:text-slate-200">{formatNumber(student.cart_courses_count)}</dd></div>
                                        <div><dt className="font-bold text-slate-400">تاريخ الإضافة</dt><dd className="mt-1 font-black text-slate-700 dark:text-slate-200">{asDate(student.registered_at)}</dd></div>
                                    </dl>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

export default function Demand({
    courseDemand = [],
    summary = {},
    typeDistribution = [],
    colleges = [],
    majors = [],
    filters = {},
    report = {},
}) {
    const [selectedCollege, setSelectedCollege] = React.useState(String(filters.college_id || ''));
    const [selectedMajor, setSelectedMajor] = React.useState(String(filters.major_id || ''));
    const [query, setQuery] = React.useState('');
    const [typeFilter, setTypeFilter] = React.useState('');
    const [sortBy, setSortBy] = React.useState('demand_desc');
    const [page, setPage] = React.useState(1);
    const [selectedCourse, setSelectedCourse] = React.useState(null);
    const [students, setStudents] = React.useState([]);
    const [studentsLoading, setStudentsLoading] = React.useState(false);
    const [studentSearch, setStudentSearch] = React.useState('');
    const [removingId, setRemovingId] = React.useState(null);
    const [editingCourse, setEditingCourse] = React.useState(null);
    const [printMode, setPrintMode] = React.useState('summary');
    const pageSize = 12;

    const editForm = useForm({
        name: '', code: '', credit_hours: 3, difficulty_level: 3,
        minimum_passed_hours: null, type: 'compulsory', major_id: null,
        study_plan_version: 12, semester: 1, prerequisite_ids: [], description: '',
    });

    const filteredCourses = React.useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        const rows = courseDemand.filter((course) => {
            const matchesQuery = !normalizedQuery || [course.name, course.code, course.major_name, course.college_name]
                .some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
            return matchesQuery && (!typeFilter || course.type === typeFilter);
        });

        return [...rows].sort((a, b) => {
            if (sortBy === 'name_asc') return String(a.name).localeCompare(String(b.name), 'ar');
            if (sortBy === 'sections_desc') return Number(b.recommended_sections) - Number(a.recommended_sections);
            if (sortBy === 'hours_desc') return Number(b.credit_hours) - Number(a.credit_hours);
            return Number(b.cart_users_count) - Number(a.cart_users_count);
        });
    }, [courseDemand, query, typeFilter, sortBy]);

    React.useEffect(() => setPage(1), [query, typeFilter, sortBy, courseDemand]);

    const totalPages = Math.max(1, Math.ceil(filteredCourses.length / pageSize));
    const pageCourses = filteredCourses.slice((page - 1) * pageSize, page * pageSize);
    const topCourses = courseDemand.slice(0, 10);
    const topCourse = courseDemand[0] || null;
    const currentCollegeName = selectedCollege ? colleges.find((item) => String(item.id) === selectedCollege)?.name : 'جميع الكليات';
    const currentMajorName = selectedMajor ? majors.find((item) => String(item.id) === selectedMajor)?.name : 'جميع التخصصات';
    const periodLabel = report?.period?.label || 'الفصل الحالي';

    const applyScope = (collegeId, majorId) => {
        router.get(route('admin.reports.demand'), {
            college_id: collegeId || undefined,
            major_id: majorId || undefined,
        }, { preserveScroll: true, preserveState: true, replace: true });
    };

    const openStudents = async (course) => {
        setSelectedCourse(course);
        setStudents([]);
        setStudentSearch('');
        setStudentsLoading(true);
        try {
            const response = await axios.get(route('admin.reports.demand.students', course.id));
            setStudents(Array.isArray(response.data?.students) ? response.data.students : []);
        } catch (error) {
            setSelectedCourse(null);
            Swal.fire({ icon: 'error', title: 'تعذر تحميل الطلاب', text: error.response?.data?.message || 'حاول مرة أخرى.' });
        } finally {
            setStudentsLoading(false);
        }
    };

    const removeStudent = async (student) => {
        const result = await Swal.fire({
            icon: 'warning',
            title: 'إزالة التسجيل التجريبي؟',
            html: `سيتم حذف مادة <b>${selectedCourse.name}</b> من سلة الطالب <b>${student.name}</b> للفصل الحالي فقط.`,
            showCancelButton: true,
            confirmButtonText: 'نعم، إزالة التسجيل',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#dc2626',
            reverseButtons: true,
        });
        if (!result.isConfirmed) return;

        setRemovingId(student.id);
        try {
            const response = await axios.delete(route('admin.reports.demand.students.destroy', [selectedCourse.id, student.id]));
            setStudents((current) => current.filter((item) => item.id !== student.id));
            setSelectedCourse((current) => current ? { ...current, cart_users_count: Math.max(0, Number(current.cart_users_count) - 1) } : current);
            router.reload({ only: ['courseDemand', 'summary', 'typeDistribution'], preserveScroll: true });
            Swal.fire({ icon: 'success', title: 'تمت الإزالة', text: response.data?.message, timer: 1600, showConfirmButton: false });
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'لم تتم الإزالة', text: error.response?.data?.message || 'تعذر تعديل التسجيل.' });
        } finally {
            setRemovingId(null);
        }
    };

    const openEdit = (course) => {
        editForm.clearErrors();
        editForm.setData({
            name: course.name || '',
            code: course.code || '',
            credit_hours: course.credit_hours ?? 3,
            difficulty_level: course.difficulty_level ?? 3,
            minimum_passed_hours: course.minimum_passed_hours ?? null,
            type: course.type || 'compulsory',
            major_id: course.major_id ?? null,
            study_plan_version: course.study_plan_version ?? 12,
            semester: course.semester ?? 1,
            prerequisite_ids: course.prerequisite_ids || [],
            description: course.description || '',
        });
        setEditingCourse(course);
    };

    const submitEdit = (event) => {
        event.preventDefault();
        editForm.put(route('admin.courses.update', editingCourse.id), {
            preserveScroll: true,
            onSuccess: () => {
                setEditingCourse(null);
                Swal.fire({ icon: 'success', title: 'تم تحديث المادة', timer: 1500, showConfirmButton: false });
            },
        });
    };

    const deleteCourse = async (course) => {
        const result = await Swal.fire({
            icon: 'warning',
            title: 'حذف المادة نهائياً؟',
            html: `سيتم حذف <b>${course.name} (${course.code})</b> وكل علاقاتها، وليس تسجيلات الفصل الحالي فقط.`,
            input: 'text',
            inputLabel: 'اكتب رمز المادة للتأكيد',
            inputPlaceholder: course.code,
            showCancelButton: true,
            confirmButtonText: 'حذف نهائي',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#dc2626',
            preConfirm: (value) => {
                if (String(value || '').trim().toLowerCase() !== String(course.code).trim().toLowerCase()) {
                    Swal.showValidationMessage('رمز المادة غير مطابق.');
                    return false;
                }
                return true;
            },
        });
        if (!result.isConfirmed) return;

        router.delete(route('admin.courses.destroy', course.id), {
            preserveScroll: true,
            onSuccess: () => Swal.fire({ icon: 'success', title: 'تم حذف المادة', timer: 1500, showConfirmButton: false }),
        });
    };

    const printReport = (mode = 'summary') => {
        setPrintMode(mode);
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.print()));
    };

    return (
        <AdminLayout>
            <Head title="تحليل طلب المواد" />

            <main className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-[#0d1117] sm:px-6 lg:px-8 print:bg-white print:p-0" dir="rtl">
                <div className="mx-auto max-w-[1600px] print:max-w-none">
                    <section className="print:hidden">
                        <header className="overflow-hidden rounded-3xl border border-indigo-200/70 bg-gradient-to-l from-indigo-950 via-indigo-900 to-slate-950 p-6 text-white shadow-xl shadow-indigo-950/10 sm:p-8">
                            <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
                                <div className="max-w-3xl">
                                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-black text-indigo-100">
                                        <Activity className="size-3.5" /> بيانات التسجيل التجريبي · {periodLabel}
                                    </div>
                                    <h1 className="text-3xl font-black tracking-tight sm:text-4xl">مركز تحليل طلب المواد</h1>
                                    <p className="mt-3 text-sm font-semibold leading-7 text-indigo-100/80">راقب الطلب الحقيقي، اعرف الطلاب خلف كل رقم، وقدّر عدد الشعب المطلوبة مع أدوات إدارة وطباعة جاهزة للاعتماد.</p>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => router.reload({ preserveScroll: true })} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-black text-white transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white">
                                        <RefreshCw className="size-4" /> تحديث البيانات
                                    </button>
                                    <button onClick={() => printReport('summary')} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-indigo-950 transition hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-900">
                                        <Printer className="size-4" /> طباعة التقرير
                                    </button>
                                </div>
                            </div>
                            <dl className="mt-7 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 text-xs sm:grid-cols-4">
                                <div><dt className="font-bold text-indigo-200/70">الفترة الأكاديمية</dt><dd className="mt-1 font-black text-white">{periodLabel}</dd></div>
                                <div><dt className="font-bold text-indigo-200/70">الحد النظامي</dt><dd className="mt-1 font-black text-white">{formatNumber(report?.period?.max_hours)} ساعة</dd></div>
                                <div><dt className="font-bold text-indigo-200/70">سعة الشعبة التقديرية</dt><dd className="mt-1 font-black text-white">{formatNumber(summary.section_capacity)} طالب</dd></div>
                                <div><dt className="font-bold text-indigo-200/70">آخر توليد للتقرير</dt><dd className="mt-1 font-black text-white">{asDate(report.generated_at)}</dd></div>
                            </dl>
                        </header>

                        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                            <MetricCard icon={UsersRound} label="الطلاب الفاعلون" value={formatNumber(summary.total_students)} helper="طلاب لديهم تسجيل تجريبي" tone="indigo" />
                            <MetricCard icon={ClipboardList} label="إجمالي الاختيارات" value={formatNumber(summary.total_selections)} helper={`${formatDecimal(summary.average_courses_per_student)} مادة لكل طالب`} tone="teal" />
                            <MetricCard icon={BookOpen} label="المواد المطلوبة" value={formatNumber(summary.demanded_courses)} helper="مواد عليها طلب فعلي" tone="violet" />
                            <MetricCard icon={GraduationCap} label="متوسط العبء" value={`${formatDecimal(summary.average_hours_per_student)} س`} helper={`من أصل ${formatNumber(report?.period?.max_hours)} ساعة نظامية`} tone="amber" />
                            <MetricCard icon={Layers3} label="الشعب المقدّرة" value={formatNumber(summary.estimated_sections)} helper={`على سعة ${formatNumber(summary.section_capacity)} طالب`} tone="rose" />
                        </div>

                        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-5" aria-label="فلاتر التقرير">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                                <Field label="الكلية">
                                    <select value={selectedCollege} onChange={(e) => { const value = e.target.value; setSelectedCollege(value); setSelectedMajor(''); applyScope(value, ''); }} className="admin-demand-input">
                                        <option value="">جميع الكليات</option>
                                        {colleges.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}
                                    </select>
                                </Field>
                                <Field label="التخصص">
                                    <select value={selectedMajor} onChange={(e) => { setSelectedMajor(e.target.value); applyScope(selectedCollege, e.target.value); }} className="admin-demand-input">
                                        <option value="">جميع التخصصات</option>
                                        {majors.filter((major) => !selectedCollege || String(major.college_id) === selectedCollege).map((major) => <option key={major.id} value={major.id}>{major.name}</option>)}
                                    </select>
                                </Field>
                                <Field label="نوع المادة">
                                    <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="admin-demand-input">
                                        <option value="">جميع الأنواع</option>
                                        {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                    </select>
                                </Field>
                                <Field label="الترتيب">
                                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="admin-demand-input">
                                        <option value="demand_desc">الأعلى طلباً</option>
                                        <option value="sections_desc">الشعب المقترحة</option>
                                        <option value="hours_desc">الساعات المعتمدة</option>
                                        <option value="name_asc">اسم المادة</option>
                                    </select>
                                </Field>
                                <Field label="بحث سريع">
                                    <span className="relative block">
                                        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="اسم، رمز، تخصص…" className="admin-demand-input pr-10" />
                                    </span>
                                </Field>
                            </div>
                            {(selectedCollege || selectedMajor || typeFilter || query) && (
                                <button onClick={() => { setSelectedCollege(''); setSelectedMajor(''); setTypeFilter(''); setQuery(''); applyScope('', ''); }} className="mt-4 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 text-xs font-black text-indigo-700 transition hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-indigo-300 dark:hover:bg-indigo-500/10">
                                    <X className="size-4" /> مسح جميع الفلاتر
                                </button>
                            )}
                        </section>

                        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
                            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 xl:col-span-8">
                                <div className="mb-5 flex items-start justify-between gap-4">
                                    <div><h2 className="text-base font-black text-slate-950 dark:text-white">أعلى المواد طلباً</h2><p className="mt-1 text-xs font-bold text-slate-500">أرقام فعلية ظاهرة، وليست معتمدة على اللون أو التلميح فقط.</p></div>
                                    <BarChart3 className="size-5 text-indigo-600" />
                                </div>
                                {topCourses.length ? (
                                    <div className="h-[360px] w-full" dir="ltr">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={topCourses} layout="vertical" margin={{ top: 0, right: 42, bottom: 0, left: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                                <YAxis dataKey="code" type="category" width={72} tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} />
                                                <Tooltip content={<DemandTooltip />} cursor={{ fill: 'rgba(79, 70, 229, 0.05)' }} />
                                                <Bar dataKey="cart_users_count" fill="#4f46e5" radius={[0, 7, 7, 0]} barSize={20} label={{ position: 'right', fill: '#334155', fontSize: 11, fontWeight: 800 }} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : <EmptyState text="لا توجد تسجيلات تجريبية ضمن النطاق المحدد." />}
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 xl:col-span-4">
                                <div className="mb-4"><h2 className="text-base font-black text-slate-950 dark:text-white">توزيع الطلب حسب النوع</h2><p className="mt-1 text-xs font-bold text-slate-500">عدد اختيارات الطلاب لكل تصنيف.</p></div>
                                {typeDistribution.length ? (
                                    <>
                                        <div className="h-52" dir="ltr">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={typeDistribution} dataKey="count" nameKey="type" innerRadius={55} outerRadius={82} paddingAngle={3}>
                                                        {typeDistribution.map((entry) => <Cell key={entry.type} fill={TYPE_COLORS[entry.type] || '#64748b'} />)}
                                                    </Pie>
                                                    <Tooltip formatter={(value, name) => [`${formatNumber(value)} اختيار`, TYPE_LABELS[name] || name]} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="space-y-2">
                                            {typeDistribution.map((item) => (
                                                <div key={item.type} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-white/5">
                                                    <span className="flex items-center gap-2 font-bold text-slate-600 dark:text-slate-300"><span className="size-2.5 rounded-full" style={{ background: TYPE_COLORS[item.type] }} />{TYPE_LABELS[item.type] || item.type}</span>
                                                    <span className="font-black text-slate-900 dark:text-white">{formatNumber(item.count)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : <EmptyState text="لا توجد بيانات توزيع حالياً." />}
                                {topCourse && (
                                    <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-500/20 dark:bg-indigo-500/10">
                                        <p className="text-[11px] font-black text-indigo-700 dark:text-indigo-300">قرار تشغيلي مقترح</p>
                                        <p className="mt-2 text-xs font-bold leading-6 text-slate-700 dark:text-slate-200">ابدأ بجدولة <b>{topCourse.name}</b>: الطلب الحالي {formatNumber(topCourse.cart_users_count)} طالب ويحتاج تقريباً {formatNumber(topCourse.recommended_sections)} شعبة.</p>
                                    </div>
                                )}
                            </section>
                        </div>

                        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
                            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                                <div><h2 className="text-base font-black text-slate-950 dark:text-white">سجل الطلب وإدارة المواد</h2><p className="mt-1 text-xs font-bold text-slate-500">{formatNumber(filteredCourses.length)} مادة مطابقة · اضغط الطلاب لمراجعة أصحاب التسجيل.</p></div>
                                <div className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-500"><Filter className="size-4 text-indigo-600" /> النسب محسوبة من الطلاب الفاعلين ضمن النطاق.</div>
                            </div>

                            {pageCourses.length ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[1050px] text-right">
                                        <thead className="bg-slate-50 text-[11px] font-black text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
                                            <tr><th className="px-5 py-3">الترتيب والمادة</th><th className="px-4 py-3">التخصص</th><th className="px-4 py-3 text-center">النوع</th><th className="px-4 py-3 text-center">الطلب</th><th className="px-4 py-3 text-center">نسبة الطلاب</th><th className="px-4 py-3 text-center">الشعب</th><th className="px-5 py-3 text-left">الإجراءات</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                            {pageCourses.map((course) => {
                                                const percentage = summary.total_students > 0 ? (Number(course.cart_users_count) / Number(summary.total_students)) * 100 : 0;
                                                return (
                                                    <tr key={course.id} className="transition hover:bg-indigo-50/40 dark:hover:bg-indigo-500/[0.04]">
                                                        <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-500 dark:bg-white/5">{course.rank}</span><div><p className="text-sm font-black text-slate-950 dark:text-white">{course.name}</p><p className="mt-1 text-[11px] font-black text-indigo-600" dir="ltr">{course.code} · {formatNumber(course.credit_hours)} ساعات</p></div></div></td>
                                                        <td className="px-4 py-4"><p className="max-w-48 truncate text-xs font-black text-slate-700 dark:text-slate-200">{course.major_name}</p><p className="mt-1 max-w-48 truncate text-[10px] font-bold text-slate-400">{course.college_name} · خطة {course.study_plan_version}</p></td>
                                                        <td className="px-4 py-4 text-center"><span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-700 dark:bg-white/5 dark:text-slate-300">{TYPE_LABELS[course.type] || course.type}</span></td>
                                                        <td className="px-4 py-4 text-center"><button onClick={() => openStudents(course)} className="cursor-pointer text-lg font-black text-indigo-700 underline-offset-4 transition hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-indigo-300">{formatNumber(course.cart_users_count)}</button><p className="text-[10px] font-bold text-slate-400">طالب</p></td>
                                                        <td className="px-4 py-4"><div className="mx-auto w-28"><div className="mb-1 flex justify-between text-[10px] font-black text-slate-500"><span>{formatDecimal(percentage)}%</span><span>{formatNumber(course.cart_users_count)}/{formatNumber(summary.total_students)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.max(3, Math.min(100, percentage))}%` }} /></div></div></td>
                                                        <td className="px-4 py-4 text-center"><span className="text-base font-black text-slate-900 dark:text-white">{formatNumber(course.recommended_sections)}</span><p className="text-[10px] font-bold text-slate-400">تقديري</p></td>
                                                        <td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => openStudents(course)} className="admin-demand-action text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10" title="عرض الطلاب"><UsersRound className="size-4" /><span>الطلاب</span></button><button onClick={() => openEdit(course)} className="admin-demand-action text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-500/10" title="تعديل المادة"><Edit3 className="size-4" /><span className="sr-only">تعديل</span></button><button onClick={() => deleteCourse(course)} className="admin-demand-action text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10" title="حذف المادة"><Trash2 className="size-4" /><span className="sr-only">حذف</span></button></div></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : <div className="p-6"><EmptyState text="لا توجد مواد مطابقة للفلاتر الحالية." /></div>}

                            {filteredCourses.length > pageSize && (
                                <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-4 dark:border-white/10">
                                    <p className="text-[11px] font-bold text-slate-500">صفحة {formatNumber(page)} من {formatNumber(totalPages)}</p>
                                    <div className="flex gap-2"><button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="admin-demand-page"><ChevronRight className="size-4" /> السابق</button><button disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="admin-demand-page">التالي <ChevronLeft className="size-4" /></button></div>
                                </footer>
                            )}
                        </section>
                    </section>

                    <PrintReport mode={printMode} report={report} summary={summary} courses={filteredCourses} students={students} selectedCourse={selectedCourse} collegeName={currentCollegeName} majorName={currentMajorName} />
                </div>
            </main>

            <StudentsDrawer course={selectedCourse} students={students} loading={studentsLoading} search={studentSearch} setSearch={setStudentSearch} onClose={() => setSelectedCourse(null)} onRemove={removeStudent} removingId={removingId} onPrint={() => printReport('students')} />
            <EditCourseModal course={editingCourse} majors={majors} form={editForm} onClose={() => !editForm.processing && setEditingCourse(null)} onSubmit={submitEdit} />

            <style>{`
                .admin-demand-input { width: 100%; min-height: 44px; border-radius: 0.75rem; border: 1px solid #cbd5e1; background: #fff; padding: 0.65rem 0.85rem; font-size: 0.78rem; font-weight: 700; color: #0f172a; outline: none; transition: border-color 150ms, box-shadow 150ms, background-color 150ms; }
                .admin-demand-input:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.14); }
                .admin-demand-action { display: inline-flex; min-height: 40px; cursor: pointer; align-items: center; justify-content: center; gap: .35rem; border-radius: .65rem; padding: 0 .7rem; font-size: .68rem; font-weight: 900; transition: background-color 150ms, color 150ms; }
                .admin-demand-action:focus, .admin-demand-page:focus { outline: 2px solid #4f46e5; outline-offset: 2px; }
                .admin-demand-page { display: inline-flex; min-height: 40px; cursor: pointer; align-items: center; gap: .35rem; border-radius: .65rem; border: 1px solid #e2e8f0; padding: 0 .8rem; font-size: .7rem; font-weight: 900; color: #334155; transition: background-color 150ms; }
                .admin-demand-page:hover { background: #f8fafc; }
                .admin-demand-page:disabled { cursor: not-allowed; opacity: .45; }
                .demand-print-only { display: none; }
                @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; } }
                @media (prefers-color-scheme: dark) { .dark .admin-demand-input { border-color: rgba(255,255,255,.12); background: rgba(255,255,255,.04); color: #f8fafc; } .dark .admin-demand-page { border-color: rgba(255,255,255,.1); color: #e2e8f0; } .dark .admin-demand-page:hover { background: rgba(255,255,255,.05); } }
                @media print {
                    @page { size: A4 portrait; margin: 12mm; }
                    aside, header:not(.demand-print-header), footer, nav { display: none !important; }
                    body, main { margin: 0 !important; padding: 0 !important; background: #fff !important; color: #0f172a !important; }
                    .demand-print-only { display: block !important; }
                    .demand-print-table { width: 100%; border-collapse: collapse; font-size: 9px; }
                    .demand-print-table th, .demand-print-table td { border: 1px solid #cbd5e1; padding: 6px 7px; text-align: right; }
                    .demand-print-table th { background: #eef2ff !important; font-weight: 900; }
                    .demand-print-table tr { break-inside: avoid; page-break-inside: avoid; }
                    .demand-print-break { break-before: page; page-break-before: always; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            `}</style>
        </AdminLayout>
    );
}

function PrintReport({ mode, report, summary, courses, students, selectedCourse, collegeName, majorName }) {
    const isStudents = mode === 'students' && selectedCourse;
    return (
        <section className="demand-print-only text-right" dir="rtl">
            <header className="demand-print-header mb-7 border-b-4 border-double border-slate-700 pb-5">
                <div className="flex items-start justify-between gap-6">
                    <div><p className="text-xl font-black">نظام سنفور الأكاديمي</p><p className="mt-1 text-[10px] font-bold text-slate-500">لوحة إدارة التسجيل التجريبي</p></div>
                    <div className="text-left text-[9px] font-bold text-slate-600"><p>الفترة: {report?.period?.label || 'الفصل الحالي'}</p><p>تاريخ الإصدار: {asDate(report?.generated_at)}</p><p>مرجع: DEM-{report?.period?.academic_year || 'CURRENT'}-{report?.period?.academic_term || 'X'}</p></div>
                </div>
                <div className="mt-5 text-center"><h1 className="text-lg font-black">{isStudents ? `كشف الطلاب المسجلين في ${selectedCourse.name}` : 'تقرير تحليل طلب المواد الأكاديمية'}</h1><p className="mt-2 text-[10px] font-bold text-slate-500">{isStudents ? `${selectedCourse.code} · ${formatNumber(students.length)} طالب` : `${collegeName} · ${majorName}`}</p></div>
            </header>

            {!isStudents ? (
                <>
                    <div className="mb-6 grid grid-cols-5 gap-2">
                        {[['الطلاب الفاعلون', summary.total_students], ['الاختيارات', summary.total_selections], ['المواد المطلوبة', summary.demanded_courses], ['متوسط الساعات', summary.average_hours_per_student], ['الشعب المقدرة', summary.estimated_sections]].map(([label, value]) => <div key={label} className="rounded border border-slate-300 bg-slate-50 p-3"><p className="text-[8px] font-bold text-slate-500">{label}</p><p className="mt-1 text-lg font-black">{formatDecimal(value)}</p></div>)}
                    </div>
                    <table className="demand-print-table">
                        <thead><tr><th>#</th><th>رمز المادة</th><th>اسم المادة</th><th>التخصص</th><th>النوع</th><th>الساعات</th><th>الطلاب</th><th>نسبة الطلب</th><th>الشعب المقدرة</th></tr></thead>
                        <tbody>{courses.map((course, index) => <tr key={course.id}><td>{index + 1}</td><td dir="ltr">{course.code}</td><td className="font-black">{course.name}</td><td>{course.major_name}</td><td>{TYPE_LABELS[course.type] || course.type}</td><td>{course.credit_hours}</td><td>{course.cart_users_count}</td><td>{summary.total_students > 0 ? formatDecimal((course.cart_users_count / summary.total_students) * 100) : 0}%</td><td>{course.recommended_sections}</td></tr>)}</tbody>
                    </table>
                </>
            ) : (
                <table className="demand-print-table">
                    <thead><tr><th>#</th><th>الطالب</th><th>الرقم الجامعي</th><th>البريد الإلكتروني</th><th>التخصص</th><th>الخطة</th><th>مواد السلة</th><th>ساعات السلة</th><th>تاريخ الإضافة</th></tr></thead>
                    <tbody>{students.map((student, index) => <tr key={student.id}><td>{index + 1}</td><td className="font-black">{student.name}</td><td>{student.student_number || '—'}</td><td dir="ltr">{student.email}</td><td>{student.major}</td><td>{student.study_plan_version}</td><td>{student.cart_courses_count}</td><td>{student.cart_hours}</td><td>{asDate(student.registered_at)}</td></tr>)}</tbody>
                </table>
            )}

            <div className="mt-12 grid grid-cols-3 gap-12 text-center text-[9px] font-bold"><div><p>مُعدّ التقرير</p><div className="mt-10 border-t border-slate-500 pt-2">نظام سنفور الأكاديمي</div></div><div><p>رئيس القسم</p><div className="mt-10 border-t border-slate-500 pt-2">التوقيع والتاريخ</div></div><div><p>العمادة</p><div className="mt-10 border-t border-slate-500 pt-2">الاعتماد والختم</div></div></div>
            <p className="mt-8 border-t border-slate-200 pt-3 text-center text-[8px] font-bold text-slate-400">تقرير داخلي صادر عن بيانات التسجيل التجريبي للفصل المحدد. التقديرات التشغيلية لا تستبدل الاعتماد الأكاديمي الرسمي.</p>
        </section>
    );
}
