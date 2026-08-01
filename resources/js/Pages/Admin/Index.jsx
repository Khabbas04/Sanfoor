import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Swal from 'sweetalert2';
import Papa from 'papaparse';
import axios from 'axios';
import { CheckCircle2, Download, FileSpreadsheet, LoaderCircle, UploadCloud, X } from 'lucide-react';

const CSV_HEADER_ALIASES = {
    code: ['course_code', 'course_id', 'code', 'رمز_المادة', 'رمز'],
    name: ['course_name', 'course_na', 'name', 'اسم_المادة', 'اسم'],
    credit_hours: ['credit_hours', 'credits', 'credit', 'hours', 'عدد_الساعات', 'الساعات'],
    type: ['type', 'group_title', 'group_ti', 'course_type', 'نوع'],
    category: ['category', 'classification', 'class', 'track', 'الفئة', 'التصنيف', 'مسار'],
    delivery_mode: ['delivery_mode', 'delivery', 'mode', 'teaching_mode', 'study_mode', 'طريقة_التدريس', 'نمط_التدريس'],
    prerequisites: ['prerequisites', 'prerequisite', 'prereq', 'pre_req', 'prerequisite_codes', 'المتطلبات_السابقة', 'المتطلبات', 'متطلب_سابق'],
    semester: ['semester', 'level', 'term', 'study_level', 'الفصل', 'المستوى'],
    description: ['description', 'desc', 'notes', 'note', 'وصف', 'ملاحظات'],
    minimum_passed_hours: ['minimum_passed_hours', 'min_passed_hours', 'minimum_hours', 'hours_required', 'شرط_الساعات', 'الساعات_المجتازة_المطلوبة'],
};

const normalizeCsvHeader = (header = '') => {
    return String(header)
        .replace(/^\uFEFF/, '')
        .trim()
        .toLowerCase()
        .replace(/[\s\-./\\]+/g, '_')
        .replace(/[^\w\u0600-\u06FF]/g, '')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
};

const cleanCsvCell = (value) => String(value ?? '').trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');

const findMappedHeader = (headers = [], aliases = []) => {
    const normalizedHeaders = headers.map((header) => normalizeCsvHeader(header));
    const normalizedAliases = aliases.map((alias) => normalizeCsvHeader(alias));

    for (let i = 0; i < normalizedHeaders.length; i += 1) {
        const header = normalizedHeaders[i];
        for (const alias of normalizedAliases) {
            if (!alias) continue;
            if (header === alias || header.includes(alias)) {
                return headers[i];
            }
        }
    }

    return null;
};

const parseCsvInteger = (value, fallback = null, min = null, max = null) => {
    const cleaned = cleanCsvCell(value);
    if (!cleaned) return fallback;

    const match = cleaned.match(/-?\d+/);
    if (!match) return fallback;

    const parsed = Number.parseInt(match[0], 10);
    if (Number.isNaN(parsed)) return fallback;
    if (min !== null && parsed < min) return fallback;
    if (max !== null && parsed > max) return fallback;

    return parsed;
};

const mapImportedCourseType = ({ typeValue = '', categoryValue = '', deliveryModeValue = '' }) => {
    const type = cleanCsvCell(typeValue).toLowerCase();
    const category = cleanCsvCell(categoryValue).toLowerCase();
    const deliveryMode = cleanCsvCell(deliveryModeValue).toLowerCase();
    const combined = `${type} ${category}`.trim();

    const containsAny = (haystack, needles) => needles.some((needle) => needle && haystack.includes(needle));

    if (containsAny(combined, ['اختياري', 'elective', 'optional'])) return 'elective';
    if (containsAny(combined, ['مساند', 'supporting'])) return 'supporting';
    if (containsAny(combined, ['جامعة', 'جامعي', 'university', 'general_requirement', 'gen_ed'])) return 'university_req';

    if (
        containsAny(deliveryMode, ['الكترون', 'إلكترون', 'online', 'e-learning', 'distance']) &&
        containsAny(combined, ['متطلب', 'requirement', 'req', 'اجباري', 'إجباري', 'mandatory', 'required'])
    ) {
        return 'university_req';
    }

    return 'compulsory';
};

const buildTabularPreview = ({ fileName, headers, dataRows, parseErrors = [], mappedHeadersOverride = {} }) => {
    const mappedHeaders = {
        code: mappedHeadersOverride.code ?? findMappedHeader(headers, CSV_HEADER_ALIASES.code),
        name: mappedHeadersOverride.name ?? findMappedHeader(headers, CSV_HEADER_ALIASES.name),
        credit_hours: mappedHeadersOverride.credit_hours ?? findMappedHeader(headers, CSV_HEADER_ALIASES.credit_hours),
        type: mappedHeadersOverride.type ?? findMappedHeader(headers, CSV_HEADER_ALIASES.type),
        category: mappedHeadersOverride.category ?? findMappedHeader(headers, CSV_HEADER_ALIASES.category),
        delivery_mode: mappedHeadersOverride.delivery_mode ?? findMappedHeader(headers, CSV_HEADER_ALIASES.delivery_mode),
        prerequisites: mappedHeadersOverride.prerequisites ?? findMappedHeader(headers, CSV_HEADER_ALIASES.prerequisites),
        semester: mappedHeadersOverride.semester ?? findMappedHeader(headers, CSV_HEADER_ALIASES.semester),
        description: mappedHeadersOverride.description ?? findMappedHeader(headers, CSV_HEADER_ALIASES.description),
        minimum_passed_hours: mappedHeadersOverride.minimum_passed_hours ?? findMappedHeader(headers, CSV_HEADER_ALIASES.minimum_passed_hours),
    };

    const sampleRows = [];
    let totalRows = 0;

    dataRows.forEach((row, index) => {
        const rowValues = Object.values(row || {}).map((value) => cleanCsvCell(value));
        if (rowValues.every((value) => value === '')) return;

        totalRows += 1;
        const code = cleanCsvCell(mappedHeaders.code ? row[mappedHeaders.code] : '').toUpperCase();
        const name = cleanCsvCell(mappedHeaders.name ? row[mappedHeaders.name] : '');
        const rawType = cleanCsvCell(mappedHeaders.type ? row[mappedHeaders.type] : '');
        const rawCategory = cleanCsvCell(mappedHeaders.category ? row[mappedHeaders.category] : '');
        const rawDeliveryMode = cleanCsvCell(mappedHeaders.delivery_mode ? row[mappedHeaders.delivery_mode] : '');
        const warnings = [];
        if (!code) warnings.push('رمز المادة مفقود');
        if (!name) warnings.push('اسم المادة مفقود');

        sampleRows.push({
            lineNumber: index + 2,
            code,
            name,
            creditHours: parseCsvInteger(mappedHeaders.credit_hours ? row[mappedHeaders.credit_hours] : '', 3, 0, 12),
            mappedType: mapImportedCourseType({ typeValue: rawType, categoryValue: rawCategory, deliveryModeValue: rawDeliveryMode }),
            rawType,
            rawCategory,
            rawDeliveryMode,
            prerequisites: cleanCsvCell(mappedHeaders.prerequisites ? row[mappedHeaders.prerequisites] : ''),
            semester: parseCsvInteger(mappedHeaders.semester ? row[mappedHeaders.semester] : '', 1, 1, 12),
            description: cleanCsvCell(mappedHeaders.description ? row[mappedHeaders.description] : ''),
            minimumPassedHours: parseCsvInteger(mappedHeaders.minimum_passed_hours ? row[mappedHeaders.minimum_passed_hours] : '', null, 1, 200),
            warnings,
        });
    });

    const codeCounts = sampleRows.reduce((counts, row) => {
        if (row.code) counts[row.code] = (counts[row.code] || 0) + 1;
        return counts;
    }, {});
    sampleRows.forEach((row) => {
        if (row.code && codeCounts[row.code] > 1) row.warnings.push('رمز مكرر داخل الملف');
    });

    const missingRequiredColumns = [];
    if (!mappedHeaders.code) missingRequiredColumns.push('رمز المادة');
    if (!mappedHeaders.name) missingRequiredColumns.push('اسم المادة');

    return {
        fileName,
        headers,
        rawRows: dataRows,
        mappedHeaders,
        totalRows,
        validRows: sampleRows.filter((row) => row.warnings.length === 0).length,
        rowsWithWarnings: sampleRows.filter((row) => row.warnings.length > 0).length,
        sampleRows,
        parseErrors,
        missingRequiredColumns,
        requiredColumnsFound: missingRequiredColumns.length === 0,
    };
};

const buildCsvPreview = (file) => {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: 'greedy',
            complete: (results) => {
                const headers = (results.meta?.fields || []).map((header) => String(header || '').trim());
                const parseErrors = (results.errors || []).map((error) => `${error.type}: ${error.message}`);
                resolve(buildTabularPreview({ fileName: file.name, headers, dataRows: results.data || [], parseErrors }));
            },
            error: (error) => reject(error),
        });
    });
};

const buildExcelPreview = async (file) => {
    const { default: readXlsxFile } = await import('read-excel-file');
    const matrix = await readXlsxFile(file);
    if (!matrix.length) throw new Error('EMPTY_FILE');

    const headers = matrix[0].map((header) => String(header ?? '').trim());
    const dataRows = matrix.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));

    return buildTabularPreview({ fileName: file.name, headers, dataRows });
};

const buildFilePreview = async (file) => {
    const extension = String(file.name || '').split('.').pop()?.toLowerCase();
    if (extension === 'xlsx') return buildExcelPreview(file);
    if (['csv', 'txt'].includes(extension)) return buildCsvPreview(file);
    throw new Error('UNSUPPORTED_FILE');
};

export default function AdminIndex({ courses, universities, colleges, majors, logs }) {

    const [courseRows, setCourseRows] = useState(courses || []);
    const [selectedIds, setSelectedIds] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [prerequisiteQuery, setPrerequisiteQuery] = useState('');
    const [activeMajorFilter, setActiveMajorFilter] = useState('');
    const [activePlanFilter, setActivePlanFilter] = useState('');
    const [editingCourse, setEditingCourse] = useState(null);
    const [csvPreview, setCsvPreview] = useState(null);
    const [isParsingCsv, setIsParsingCsv] = useState(false);
    const [showImportPreview, setShowImportPreview] = useState(false);
    const [editablePreviewRows, setEditablePreviewRows] = useState([]);
    const [previewSubmitting, setPreviewSubmitting] = useState(false);
    const [manualSaving, setManualSaving] = useState(false);
    const [isImportDragging, setIsImportDragging] = useState(false);
    const fileInputRef = useRef(null);
    const nameInputRef = useRef(null);

    const { data, setData, reset, errors, clearErrors, setError } = useForm({
        id: null,
        college_id: '',
        major_id: '',
        name: '',
        code: '',
        credit_hours: 3,
        difficulty_level: 3,
        minimum_passed_hours: '',
        type: 'compulsory', // الأنواع: compulsory, elective, supporting, university_req
        prerequisite_ids: [],
        study_plan_version: '12',
        semester: 1, // هذا هو مستوى العقدة (Node Level)
        description: '', 
    });

    const {
        data: fileData,
        setData: setFileData,
        post: postFile,
        errors: fileErrors,
        clearErrors: clearFileErrors,
    } = useForm({
        csv_file: null,
        college_id: '',
        major_id: '',
        study_plan_version: '12',
    });

    const { data: colData, setData: setColData, post: postCol, processing: colProc, reset: resetCol } = useForm({
        name: '',
        university_id: (universities && universities.length > 0) ? universities[0].id : '',
    });

    const { data: majData, setData: setMajData, post: postMaj, processing: majProc, reset: resetMaj, errors: majErr } = useForm({
        name: '',
        code: '',
        college_id: '',
    });

    const safeColleges = colleges || [];
    const safeMajors = majors || [];
    const safeCourses = courseRows;

    useEffect(() => {
        setCourseRows(courses || []);
    }, [courses]);

    const mergeCourseRows = useCallback((incomingCourses) => {
        if (!Array.isArray(incomingCourses) || incomingCourses.length === 0) return;

        setCourseRows((current) => {
            const byId = new Map(current.map((course) => [Number(course.id), course]));
            incomingCourses.forEach((course) => byId.set(Number(course.id), course));
            return Array.from(byId.values()).sort((a, b) => Number(b.id) - Number(a.id));
        });
    }, []);

    const kpi = useMemo(() => ({
        totalCourses: safeCourses.length,
        filteredCourses: safeCourses.filter(c => {
            const matchesMajor = !activeMajorFilter
                ? true
                : activeMajorFilter === 'general'
                    ? c.major_id === null
                    : c.major_id == activeMajorFilter;
            const matchesPlan = !activePlanFilter
                ? true
                : String(c.study_plan_version || '12') === String(activePlanFilter);
            const matchesQuery = !searchQuery
                ? true
                : (String(c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || String(c.code || '').toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesMajor && matchesPlan && matchesQuery;
        }).length,
        selectedCount: selectedIds.length,
    }), [safeCourses, activeMajorFilter, activePlanFilter, searchQuery, selectedIds.length]);

  // ✅ تم إلغاء فلتر الجامعة لعرض كافة الكليات فوراً
const filteredManualColleges = safeColleges; 
const filteredManualMajors = safeMajors.filter(m => m.college_id == data.college_id);

// ✅ تم إلغاء فلتر الجامعة هنا أيضاً
const filteredImportColleges = safeColleges; 
const filteredImportMajors = safeMajors.filter(m => m.college_id == fileData.college_id);

    const filteredCourses = useMemo(() => {
        let result = safeCourses;
        if (activeMajorFilter) {
            if (activeMajorFilter === 'general') result = result.filter(c => c.major_id === null);
            else result = result.filter(c => c.major_id == activeMajorFilter);
        }
        if (activePlanFilter) {
            result = result.filter(c => String(c.study_plan_version || '12') === String(activePlanFilter));
        }
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(c =>
                String(c.name || '').toLowerCase().includes(query) ||
                String(c.code || '').toLowerCase().includes(query)
            );
        }
        return result;
    }, [searchQuery, safeCourses, activeMajorFilter, activePlanFilter]);

    const availablePrerequisites = useMemo(() => {
        const selectedMajor = data.major_id ? String(data.major_id) : null;
        const selectedPlan = String(data.study_plan_version || '12');

        return safeCourses.filter(c => {
            if (editingCourse && c.id === editingCourse.id) return false;

            const courseMajor = c.major_id ? String(c.major_id) : null;
            const coursePlan = String(c.study_plan_version || '12');

            return courseMajor === selectedMajor && coursePlan === selectedPlan;
        });
    }, [safeCourses, editingCourse, data.major_id, data.study_plan_version]);

    const selectedPrerequisiteIds = useMemo(
        () => (Array.isArray(data.prerequisite_ids) ? data.prerequisite_ids.map((id) => String(id)) : []),
        [data.prerequisite_ids]
    );

    const filteredPrerequisites = useMemo(() => {
        const query = prerequisiteQuery.trim().toLowerCase();
        if (!query) return availablePrerequisites;

        return availablePrerequisites.filter((course) =>
            String(course.name || '').toLowerCase().includes(query) ||
            String(course.code || '').toLowerCase().includes(query)
        );
    }, [availablePrerequisites, prerequisiteQuery]);

    const selectedPrerequisites = useMemo(() => {
        const byId = new Map(availablePrerequisites.map((course) => [String(course.id), course]));
        return selectedPrerequisiteIds.map((id) => byId.get(String(id))).filter(Boolean);
    }, [availablePrerequisites, selectedPrerequisiteIds]);

    const refreshCourseBoard = useCallback(() => {
        router.reload({
            only: ['courses', 'logs'],
            preserveState: true,
            preserveScroll: true,
        });
    }, []);

    useEffect(() => {
        if (!selectedPrerequisiteIds.length) return;

        const allowed = new Set(availablePrerequisites.map((course) => String(course.id)));
        const next = selectedPrerequisiteIds.filter((id) => allowed.has(String(id)));

        if (next.length !== selectedPrerequisiteIds.length) {
            setData('prerequisite_ids', next);
        }
    }, [availablePrerequisites, selectedPrerequisiteIds, setData]);

    const togglePrerequisite = (id) => {
        const value = String(id);
        const exists = selectedPrerequisiteIds.includes(value);
        const next = exists
            ? selectedPrerequisiteIds.filter((pid) => pid !== value)
            : [...selectedPrerequisiteIds, value];

        setData('prerequisite_ids', next);
    };

    const handleManualSubmit = async (e) => {
        e.preventDefault();
        clearErrors();
        setManualSaving(true);

        try {
            const response = editingCourse
                ? await axios.put(route('admin.courses.update', editingCourse.id), data, { headers: { Accept: 'application/json' } })
                : await axios.post(route('admin.courses.store'), data, { headers: { Accept: 'application/json' } });

            mergeCourseRows([response.data.course]);

            if (editingCourse) {
                cancelEdit();
            } else {
                reset('name', 'code', 'prerequisite_ids', 'description', 'minimum_passed_hours');
                window.requestAnimationFrame(() => nameInputRef.current?.focus());
            }

            Swal.fire({
                icon: 'success',
                title: editingCourse ? 'تم تحديث المادة' : 'أُضيفت المادة فوراً',
                text: editingCourse ? 'ظهرت التعديلات مباشرة دون تحديث الصفحة.' : 'يمكنك إدخال المادة التالية مباشرة بنفس التخصص والخطة.',
                timer: 1800,
                showConfirmButton: false,
            });
        } catch (error) {
            if (error.response?.status === 422) {
                const validationErrors = error.response.data?.errors || {};
                Object.entries(validationErrors).forEach(([field, messages]) => setError(field, Array.isArray(messages) ? messages[0] : messages));
                window.requestAnimationFrame(() => document.querySelector('[data-course-error="true"]')?.focus());
            } else {
                Swal.fire({ icon: 'error', title: 'تعذر الحفظ', text: error.response?.data?.message || 'حاول مرة أخرى.' });
            }
        } finally {
            setManualSaving(false);
        }
    };

    const editCourse = (course) => {
        setEditingCourse(course);
        let collId = '';
        if (course.major_id) {
            const major = safeMajors.find(m => m.id === course.major_id);
            if (major) collId = major.college_id;
        }

        setData({
            id: course.id,
            college_id: collId,
            major_id: course.major_id || '',
            name: course.name,
            code: course.code,
            credit_hours: course.credit_hours,
            difficulty_level: course.difficulty_level ?? 3,
            minimum_passed_hours: course.minimum_passed_hours ?? '',
            type: course.type,
            study_plan_version: String(course.study_plan_version || 12),
            semester: course.semester || 1,
            prerequisite_ids: Array.isArray(course.prerequisites) ? course.prerequisites.map((p) => String(p.id)) : [],
            description: course.description || '',
        });

        setTimeout(() => {
            const formElement = document.getElementById('course-action-form');
            if (formElement) {
                const y = formElement.getBoundingClientRect().top + window.scrollY - 100;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }
        }, 50);
    };

    const cancelEdit = () => {
        setEditingCourse(null);
        reset('id', 'name', 'code', 'prerequisite_ids', 'semester', 'description', 'minimum_passed_hours', 'difficulty_level');
        clearErrors();
    };

    const handleDeleteSingle = (id, name) => {
        Swal.fire({
            title: 'حذف المادة؟', text: `هل أنت متأكد من حذف (${name})؟`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#94a3b8', confirmButtonText: 'نعم، احذف', cancelButtonText: 'إلغاء'
        }).then((result) => {
            if (result.isConfirmed) {
                router.delete(route('admin.courses.destroy', id), {
                    onSuccess: () => {
                        refreshCourseBoard();
                        Swal.fire('تم الحذف!', 'تم تنظيف السجل بنجاح.', 'success');
                    }
                });
            }
        });
    };

    const processImportFile = async (selectedFile) => {
        setFileData('csv_file', selectedFile);
        setShowImportPreview(false);
        setCsvPreview(null);
        setEditablePreviewRows([]);
        clearFileErrors();

        if (!selectedFile) {
            return;
        }

        const extension = String(selectedFile.name || '').split('.').pop()?.toLowerCase();
        if (!['csv', 'txt', 'xlsx'].includes(extension)) {
            setFileData('csv_file', null);
            Swal.fire({ icon: 'warning', title: 'صيغة غير مدعومة', text: 'استخدم CSV أو ملف Excel بصيغة XLSX. لملفات XLS القديمة اختر Save As ثم XLSX.' });
            return;
        }

        if (selectedFile.size > 10 * 1024 * 1024) {
            setFileData('csv_file', null);
            Swal.fire({ icon: 'warning', title: 'الملف كبير', text: 'الحد الأعلى لحجم الملف هو 10MB.' });
            return;
        }

        setIsParsingCsv(true);
        try {
            const preview = await buildFilePreview(selectedFile);
            setCsvPreview(preview);
            setEditablePreviewRows(preview.sampleRows || []);

            if (!preview.requiredColumnsFound) {
                Swal.fire({
                    icon: 'warning',
                    title: 'ترويسة غير مكتملة',
                    text: `الأعمدة المطلوبة غير موجودة بالكامل: ${preview.missingRequiredColumns.join(' - ')}`,
                });
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'تعذر قراءة الملف',
                text: 'تأكد من أن الملف CSV سليم أو Excel بصيغة XLSX وأن الصف الأول يحتوي أسماء الأعمدة.',
            });
            setCsvPreview(null);
        } finally {
            setIsParsingCsv(false);
        }
    };

    const handleCsvFileChange = (event) => processImportFile(event.target.files?.[0] || null);

    const handleImportDrop = (event) => {
        event.preventDefault();
        setIsImportDragging(false);
        processImportFile(event.dataTransfer.files?.[0] || null);
    };

    const clearImportFile = () => {
        setFileData('csv_file', null);
        setCsvPreview(null);
        setEditablePreviewRows([]);
        setShowImportPreview(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const downloadImportTemplate = () => {
        const content = '\uFEFFcode,name,credit_hours,type,prerequisites,semester,description,minimum_passed_hours\nCS101,مقدمة في البرمجة,3,compulsory,,1,مدخل إلى البرمجة,\nCS102,البرمجة المتقدمة,3,compulsory,CS101,2,تكملة للمادة السابقة,';
        const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'sanfoor-course-import-template.csv';
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleColumnMappingChange = (field, header) => {
        if (!csvPreview) return;
        const nextPreview = buildTabularPreview({
            fileName: csvPreview.fileName,
            headers: csvPreview.headers,
            dataRows: csvPreview.rawRows,
            parseErrors: csvPreview.parseErrors,
            mappedHeadersOverride: { ...csvPreview.mappedHeaders, [field]: header || null },
        });
        setCsvPreview(nextPreview);
        setEditablePreviewRows(nextPreview.sampleRows);
    };

    const computeRowWarnings = (row) => {
        const warnings = [];
        if (!cleanCsvCell(row.code)) warnings.push('رمز المادة مفقود');
        if (!cleanCsvCell(row.name)) warnings.push('اسم المادة مفقود');
        return warnings;
    };

    const updateEditablePreviewRow = (index, field, value) => {
        setEditablePreviewRows((prev) => {
            const next = [...prev];
            const target = { ...next[index], [field]: value };
            target.warnings = computeRowWarnings(target);
            next[index] = target;
            return next;
        });
    };

    const addEditablePreviewRow = () => {
        setEditablePreviewRows((prev) => ([
            ...prev,
            {
                lineNumber: `جديد-${prev.length + 1}`,
                code: '',
                name: '',
                creditHours: 3,
                mappedType: 'compulsory',
                rawType: '',
                rawCategory: '',
                rawDeliveryMode: '',
                prerequisites: '',
                semester: 1,
                description: '',
                minimumPassedHours: null,
                warnings: ['رمز المادة مفقود', 'اسم المادة مفقود'],
            },
        ]));
    };

    const deleteEditablePreviewRow = (index) => {
        setEditablePreviewRows((prev) => prev.filter((_, i) => i !== index));
    };

    const previewCodeCounts = useMemo(() => editablePreviewRows.reduce((counts, row) => {
        const code = cleanCsvCell(row.code).toUpperCase();
        if (code) counts[code] = (counts[code] || 0) + 1;
        return counts;
    }, {}), [editablePreviewRows]);

    const getPreviewRowWarnings = useCallback((row) => {
        const warnings = computeRowWarnings(row);
        const code = cleanCsvCell(row.code).toUpperCase();
        if (code && previewCodeCounts[code] > 1) warnings.push('رمز مكرر داخل الملف');
        return warnings;
    }, [previewCodeCounts]);

    const previewStats = useMemo(() => {
        const total = editablePreviewRows.length;
        const valid = editablePreviewRows.filter((row) => getPreviewRowWarnings(row).length === 0).length;
        return {
            total,
            valid,
            warnings: Math.max(total - valid, 0),
        };
    }, [editablePreviewRows, getPreviewRowWarnings]);

    const handleImportSubmit = (e) => {
        if (e && typeof e.preventDefault === 'function') {
            e.preventDefault();
        }

        if (!fileData.csv_file) {
            Swal.fire({ icon: 'warning', title: 'اختر ملف أولاً', text: 'الرجاء اختيار ملف CSV أو XLSX قبل المتابعة.' });
            return;
        }

        if (isParsingCsv) {
            Swal.fire({ icon: 'info', title: 'جاري تحليل الملف', text: 'انتظر لحظات حتى تجهز المعاينة.' });
            return;
        }

        if (!csvPreview) {
            Swal.fire({ icon: 'warning', title: 'المعاينة غير جاهزة', text: 'يرجى إعادة اختيار الملف لتحضير المعاينة.' });
            return;
        }

        setEditablePreviewRows(csvPreview.sampleRows || []);
        setShowImportPreview(true);

        setTimeout(() => {
            const previewSection = document.getElementById('csv-import-preview-panel');
            if (previewSection) {
                const y = previewSection.getBoundingClientRect().top + window.scrollY - 110;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }
        }, 30);
    };

    const submitRowsPayload = async (rows, { loadingSetter = null, successTitle = 'تم الاستيراد!' } = {}) => {
        const sourceRows = (Array.isArray(rows) && rows.length > 0) ? rows : editablePreviewRows;
        const normalizedRows = sourceRows
            .filter((row) => cleanCsvCell(row.code) && cleanCsvCell(row.name))
            .map((row) => ({
            code: cleanCsvCell(row.code),
            name: cleanCsvCell(row.name),
            credit_hours: parseCsvInteger(row.creditHours ?? row.credit_hours, 3, 0, 12) ?? 3,
            type: cleanCsvCell(row.rawType ?? row.type),
            category: cleanCsvCell(row.rawCategory ?? row.category),
            delivery_mode: cleanCsvCell(row.rawDeliveryMode ?? row.delivery_mode),
            mappedType: cleanCsvCell(row.mappedType ?? row.mapped_type),
            prerequisites: cleanCsvCell(row.prerequisites),
            semester: parseCsvInteger(row.semester, 1, 1, 12) ?? 1,
            description: cleanCsvCell(row.description),
            minimum_passed_hours: parseCsvInteger(row.minimumPassedHours ?? row.minimum_passed_hours, null, 1, 200),
        }));

        if (loadingSetter) {
            loadingSetter(true);
        }
        try {
            const response = await axios.post(route('admin.courses.import'), {
                major_id: fileData.major_id,
                study_plan_version: fileData.study_plan_version,
                import_mode: 'upsert',
                rows_payload: normalizedRows,
            }, { headers: { Accept: 'application/json' } });

            const result = response.data?.result || {};
            mergeCourseRows(result.courses || []);
            clearImportFile();

            Swal.fire({
                icon: 'success',
                title: successTitle,
                html: `<div style="line-height:1.9"><b>${result.created || 0}</b> مادة جديدة<br><b>${result.updated || 0}</b> مادة تم تحديثها${result.skipped ? `<br><b>${result.skipped}</b> صف تم تجاوزه` : ''}</div>`,
                confirmButtonText: 'تم',
            });
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'فشل الاستيراد',
                text: error.response?.data?.message || 'تحقق من التخصص والخطة والصفوف ثم حاول مجدداً.',
            });
        } finally {
            if (loadingSetter) loadingSetter(false);
        }
    };

    const confirmImportSubmit = () => {
        submitRowsPayload(editablePreviewRows, { loadingSetter: setPreviewSubmitting, successTitle: 'تم الاستيراد!' });
    };

    const handleColSubmit = (e) => {
        e.preventDefault();
        postCol(route('admin.colleges.store'), {
            onSuccess: () => { resetCol('name'); Swal.fire({ icon: 'success', title: 'نجاح', text: 'تمت إضافة الكلية بنجاح 🏛️', timer: 1500, showConfirmButton: false }); }
        });
    };

    const handleMajSubmit = (e) => {
        e.preventDefault();
        postMaj(route('admin.majors.store'), {
            onSuccess: () => { resetMaj('name', 'code'); Swal.fire({ icon: 'success', title: 'نجاح', text: 'تمت إضافة التخصص بنجاح 🎓', timer: 1500, showConfirmButton: false }); }
        });
    };

    const handleBulkDelete = () => {
        Swal.fire({
            title: 'هل أنت متأكد؟', text: `سيتم حذف ${selectedIds.length} مادة مع علاقاتها نهائياً!`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#94a3b8', confirmButtonText: 'نعم، احذف', cancelButtonText: 'إلغاء'
        }).then((result) => {
            if (result.isConfirmed) {
                router.post(route('admin.courses.bulk_delete'), { ids: selectedIds }, {
                    onSuccess: () => { setSelectedIds([]); refreshCourseBoard(); Swal.fire('تم الحذف!', 'تم تنظيف السجلات بنجاح.', 'success'); }
                });
            }
        });
    };

    const renderCourseBadge = (type, hours) => {
        switch(type) {
            case 'compulsory': 
                return <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] border bg-indigo-50 text-indigo-600 border-indigo-100" title="إجباري">{hours}س</div>;
            case 'elective': 
                return <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] border bg-emerald-50 text-emerald-600 border-emerald-100" title="اختياري">{hours}س</div>;
            case 'supporting': 
                return <div className="w-12 h-9 rounded-[2rem] flex items-center justify-center font-black text-[10px] border bg-amber-50 text-amber-600 border-amber-200 shadow-sm" title="مادة مساندة">{hours}س</div>;
            case 'university_req': 
                return <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] border bg-cyan-50 text-cyan-600 border-cyan-200" title="متطلب جامعة (أونلاين)">{hours}س</div>;
            default: 
                return <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] border bg-slate-50 text-slate-600 border-slate-200">{hours}س</div>;
        }
    };

    return (
        <AdminLayout>
            <Head title="إدارة النظام - Sanfoor" />

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
                .delay-100 { animation-delay: 100ms; }
                .delay-200 { animation-delay: 200ms; }
                
                .edit-mode-active { border-color: rgba(245, 158, 11, .65); box-shadow: 0 0 0 3px rgba(245, 158, 11, .1); }

                /* 🔥 إضافة كلاس لإخفاء السكرول بار داخل الفورم 🔥 */
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .course-import-input { width: 100%; min-height: 44px; border-radius: .75rem; border: 1px solid #cbd5e1; background: #fff; padding: .65rem .8rem; font-size: .875rem; font-weight: 700; color: #0f172a; outline: none; transition: border-color 150ms, box-shadow 150ms; }
                .course-import-input:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.14); }
                @media (prefers-reduced-motion: reduce) { .animate-fade-in-up, .edit-mode-active { animation: none !important; opacity: 1 !important; } * { scroll-behavior: auto !important; transition-duration: .01ms !important; } }
            ` }} />

            <div className="p-4 md:p-8 bg-[#f4f7f9] min-h-screen" dir="rtl">

                {/* --- 1. الترويسة وأزرار التنقل (Header & Tabs) --- */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-5 animate-fade-in-up">
                    <div>
                        <h1 className="text-3xl font-[900] text-slate-800 tracking-tight">إدارة النظام الأكاديمي</h1>
                        <p className="text-slate-500 mt-1.5 font-bold text-sm">إدارة الشجرة الأكاديمية والمواد فقط. تمت إدارة الكليات والتخصصات والسجل من لوحة الداشبورد.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 animate-fade-in-up delay-100">
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                        <p className="text-[11px] font-black text-slate-400 mb-1">إجمالي المواد</p>
                        <p className="text-2xl font-black text-slate-900">{kpi.totalCourses}</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                        <p className="text-[11px] font-black text-slate-400 mb-1">مواد ضمن الفلتر الحالي</p>
                        <p className="text-2xl font-black text-indigo-600">{kpi.filteredCourses}</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                        <p className="text-[11px] font-black text-slate-400 mb-1">مواد محددة للحذف</p>
                        <p className="text-2xl font-black text-rose-600">{kpi.selectedCount}</p>
                    </div>
                </div>

                {/* --- 2. محتوى تبويب: الكليات والتخصصات --- */}
                {false && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up delay-100">
                        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-blue-500 to-cyan-500"></div>
                            <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><span>🏛️</span> إضافة كلية جديدة</h3>
                            <form onSubmit={handleColSubmit} className="space-y-5">
                                <div>
                                    <label className="text-[13px] font-bold text-slate-600 mb-1.5 block">اسم الكلية الرسمي</label>
                                    <input type="text" placeholder="مثال: كلية التمريض" className="w-full rounded-xl border-slate-200 focus:ring-blue-500 focus:border-blue-500 bg-slate-50/50 font-bold text-slate-800" value={colData.name} onChange={e => setColData('name', e.target.value)} required />
                                </div>
                                <button type="submit" disabled={colProc} className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 active:scale-95">
                                    {colProc ? 'جاري الحفظ...' : 'حفظ بيانات الكلية'}
                                </button>
                            </form>
                        </div>

                        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-violet-500 to-purple-500"></div>
                            <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><span>🎓</span> إضافة تخصص جديد</h3>
                            <form onSubmit={handleMajSubmit} className="space-y-5">
                                <div>
                                    <label className="text-[13px] font-bold text-slate-600 mb-1.5 block">الكلية التابعة لها</label>
                                    <select className="w-full rounded-xl border-slate-200 focus:ring-violet-500 focus:border-violet-500 bg-slate-50/50 font-bold text-slate-700" value={majData.college_id} onChange={e => setMajData('college_id', e.target.value)} required>
                                        <option value="">-- اختر الكلية --</option>
                                        {safeColleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="col-span-2">
                                        <label className="text-[13px] font-bold text-slate-600 mb-1.5 block">اسم التخصص</label>
                                        <input type="text" placeholder="مثال: الذكاء الاصطناعي" className="w-full rounded-xl border-slate-200 focus:ring-violet-500 focus:border-violet-500 bg-slate-50/50 font-bold text-slate-800" value={majData.name} onChange={e => setMajData('name', e.target.value)} required />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-[13px] font-bold text-slate-600 mb-1.5 block">الرمز</label>
                                        <input type="text" placeholder="AI" dir="ltr" className="w-full rounded-xl border-slate-200 focus:ring-violet-500 focus:border-violet-500 bg-slate-50/50 uppercase font-black text-center text-violet-700" value={majData.code} onChange={e => setMajData('code', e.target.value.toUpperCase())} required />
                                    </div>
                                </div>
                                {majErr.code && <div className="text-rose-500 text-xs mt-1 font-bold">{majErr.code}</div>}
                                <button type="submit" disabled={majProc} className="w-full bg-violet-600 text-white py-3.5 rounded-xl font-black hover:bg-violet-700 transition-all shadow-lg shadow-violet-500/30 active:scale-95 mt-2">
                                    {majProc ? 'جاري الحفظ...' : 'إضافة التخصص'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* --- 3. محتوى تبويب: الشجرة والمواد --- */}
                {(
                    <div className="space-y-8 animate-fade-in-up delay-100">

                        <section className={`overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition-opacity duration-200 ${editingCourse ? 'pointer-events-none opacity-50' : 'opacity-100'}`} aria-labelledby="course-import-title">
                            <header className="flex flex-col gap-4 border-b border-slate-200 bg-gradient-to-l from-indigo-50 to-white p-5 sm:flex-row sm:items-center sm:justify-between md:p-7">
                                <div className="flex items-start gap-3">
                                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"><FileSpreadsheet className="size-6" /></span>
                                    <div>
                                        <h2 id="course-import-title" className="text-xl font-black text-slate-950">استيراد مواد الخطة دفعة واحدة</h2>
                                        <p className="mt-1 max-w-3xl text-sm font-bold leading-6 text-slate-600">اسحب CSV أو Excel، راجع مطابقة الأعمدة والأخطاء، ثم أضف أو حدّث المواد دون حذف أي مادة أخرى.</p>
                                    </div>
                                </div>
                                <button type="button" onClick={downloadImportTemplate} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 text-xs font-black text-indigo-700 transition hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                    <Download className="size-4" /> تحميل قالب CSV
                                </button>
                            </header>

                            <div className="p-5 md:p-7">
                                <ol className="mb-6 grid grid-cols-1 gap-2 text-xs font-black text-slate-600 sm:grid-cols-3" aria-label="خطوات الاستيراد">
                                    {['حدد الخطة المستهدفة', 'ارفع الملف', 'راجع ثم احفظ'].map((label, index) => <li key={label} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5"><span className="flex size-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">{index + 1}</span>{label}</li>)}
                                </ol>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                    <label className="block"><span className="mb-2 block text-xs font-black text-slate-700">الكلية</span><select className="course-import-input" value={fileData.college_id} onChange={event => setFileData({ ...fileData, college_id: event.target.value, major_id: '' })}><option value="">اختر الكلية…</option>{filteredImportColleges.map(college => <option key={college.id} value={college.id}>{college.name}</option>)}</select></label>
                                    <label className="block"><span className="mb-2 block text-xs font-black text-slate-700">التخصص</span><select className="course-import-input disabled:cursor-not-allowed disabled:opacity-50" value={fileData.major_id} onChange={event => setFileData('major_id', event.target.value)} disabled={!fileData.college_id}><option value="">اختر التخصص…</option>{filteredImportMajors.map(major => <option key={major.id} value={major.id}>{major.name}</option>)}</select></label>
                                    <label className="block"><span className="mb-2 block text-xs font-black text-slate-700">رقم الخطة</span><select className="course-import-input" value={fileData.study_plan_version} onChange={event => setFileData('study_plan_version', event.target.value)}><option value="11">الخطة 11</option><option value="12">الخطة 12</option></select></label>
                                </div>

                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => fileInputRef.current?.click()}
                                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click(); }}
                                    onDragEnter={(event) => { event.preventDefault(); setIsImportDragging(true); }}
                                    onDragOver={(event) => event.preventDefault()}
                                    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsImportDragging(false); }}
                                    onDrop={handleImportDrop}
                                    className={`mt-5 flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${isImportDragging ? 'border-indigo-500 bg-indigo-50' : fileData.csv_file ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/50'}`}
                                    aria-label="اسحب ملف الخطة هنا أو اضغط لاختياره"
                                >
                                    <input ref={fileInputRef} type="file" accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleCsvFileChange} className="sr-only" />
                                    {isParsingCsv ? <LoaderCircle className="size-9 animate-spin text-indigo-600" /> : fileData.csv_file ? <CheckCircle2 className="size-9 text-emerald-600" /> : <UploadCloud className="size-9 text-indigo-600" />}
                                    <p className="mt-3 text-sm font-black text-slate-900">{isParsingCsv ? 'يتم تحليل الملف…' : fileData.csv_file ? fileData.csv_file.name : 'اسحب الملف وأفلته هنا'}</p>
                                    <p className="mt-1 text-xs font-bold text-slate-500">{fileData.csv_file ? `${(fileData.csv_file.size / 1024).toFixed(1)} KB · اضغط لاختيار ملف آخر` : 'أو اضغط للاختيار · CSV / XLSX · حتى 10MB'}</p>
                                </div>

                                {fileData.csv_file && !isParsingCsv && <div className="mt-3 flex justify-end"><button type="button" onClick={(event) => { event.stopPropagation(); clearImportFile(); }} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-xs font-black text-rose-700 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500"><X className="size-4" /> إزالة الملف</button></div>}

                                {(fileErrors.csv_file || fileErrors.major_id || fileErrors.study_plan_version) && <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{fileErrors.csv_file || fileErrors.major_id || fileErrors.study_plan_version}</div>}

                                {csvPreview && <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                        {[['إجمالي الصفوف', csvPreview.totalRows, 'text-slate-900'], ['صالحة', csvPreview.validRows, 'text-emerald-700'], ['بحاجة مراجعة', csvPreview.rowsWithWarnings, 'text-amber-700'], ['أعمدة مكتشفة', csvPreview.headers.length, 'text-indigo-700']].map(([label, value, color]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[11px] font-black text-slate-500">{label}</p><p className={`mt-1 text-xl font-black tabular-nums ${color}`}>{value}</p></div>)}
                                    </div>
                                    {csvPreview.missingRequiredColumns.length > 0 && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">الأعمدة المطلوبة غير مكتشفة: {csvPreview.missingRequiredColumns.join('، ')}. يمكنك مطابقتها يدوياً في المعاينة.</p>}
                                </div>}

                                <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                    <button type="button" onClick={handleImportSubmit} disabled={isParsingCsv || !fileData.csv_file || !fileData.major_id || !fileData.study_plan_version} className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45">
                                        <FileSpreadsheet className="size-5" /> مراجعة البيانات ومطابقة الأعمدة
                                    </button>
                                </div>
                            </div>
                        </section>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative">
                            
                            {/* 🔥 تم التعديل هنا: جعل الخصائص التي تسبب التغطية تعمل على الشاشات الكبيرة فقط لتصبح متجاوبة 🔥 */}
                            <div id="course-action-form" className={`lg:col-span-4 bg-white p-5 md:p-6 rounded-[2rem] border shadow-[0_8px_30px_rgb(0,0,0,0.03)] lg:sticky lg:top-24 lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto hide-scrollbar transition-all duration-300 z-10 ${editingCourse ? 'edit-mode-active bg-amber-50/10' : 'border-slate-200/80'}`}>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-[900] text-slate-800 flex items-center gap-2">
                                        {editingCourse ? <><span className="text-amber-500">✏️</span> تعديل بيانات المادة</> : <><span className="text-indigo-600">✍️</span> إضافة مادة يدوياً</>}
                                    </h3>
                                    {editingCourse && (
                                        <button onClick={cancelEdit} className="text-[10px] font-black text-rose-500 bg-rose-50 px-2.5 py-1.5 rounded-lg hover:bg-rose-100 transition-colors">إلغاء التعديل ✕</button>
                                    )}
                                </div>

                                <form onSubmit={handleManualSubmit} className="space-y-5 pb-2">
                                    
                                    <div className="space-y-3">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">المسار الأكاديمي</label>
                                        <select className="w-full rounded-xl border-slate-200 bg-slate-50 text-sm font-bold focus:ring-indigo-500 focus:border-indigo-500" value={data.college_id} onChange={e => setData({ ...data, college_id: e.target.value, major_id: '' })}>
                                            <option value="">-- اختر الكلية --</option>
                                            {filteredManualColleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <select className="w-full rounded-xl border-slate-200 bg-slate-50 text-sm font-bold focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50" value={data.major_id} onChange={e => setData('major_id', e.target.value)} disabled={!data.college_id}>
                                            <option value="">-- متطلب جامعة عام (بدون تخصص) --</option>
                                            {filteredManualMajors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                        <select className="w-full rounded-xl border-slate-200 bg-slate-50 text-sm font-bold focus:ring-indigo-500 focus:border-indigo-500" value={data.study_plan_version} onChange={e => setData('study_plan_version', e.target.value)} required>
                                            <option value="11">الخطة الشجرية 11</option>
                                            <option value="12">الخطة الشجرية 12</option>
                                        </select>
                                        {errors.study_plan_version && <div className="text-rose-500 text-xs mt-1 font-bold">{errors.study_plan_version}</div>}
                                    </div>

                                    <div className="h-px bg-slate-100 w-full"></div>

                                    <div className="space-y-4">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">تفاصيل المادة</label>
                                        <div>
                                            <input ref={nameInputRef} type="text" placeholder="اسم المادة (مثال: تفاضل وتكامل 1)" className="rounded-xl border-slate-200 w-full text-sm font-bold focus:ring-indigo-500 focus:border-indigo-500" value={data.name} onChange={e => setData('name', e.target.value)} required />
                                            {errors.name && <div className="text-rose-500 text-xs mt-1 font-bold">{errors.name}</div>}
                                        </div>
                                        <div className="grid grid-cols-5 gap-3">
                                            <div className="col-span-3 relative">
                                                <input type="text" placeholder="الرمز (MATH101)" className="rounded-xl border-slate-200 w-full text-sm font-black focus:ring-indigo-500 focus:border-indigo-500 uppercase font-mono pr-10" value={data.code} onChange={e => setData('code', e.target.value.toUpperCase())} required dir="ltr" />
                                                <span className="absolute right-3 top-2.5 text-slate-400">🔢</span>
                                                {errors.code && <div className="text-rose-500 text-xs mt-1 font-bold">{errors.code}</div>}
                                            </div>
                                            <div className="col-span-2 relative">
                                                <input type="number" min="0" max="6" className="rounded-xl border-slate-200 w-full text-sm font-black focus:ring-indigo-500 focus:border-indigo-500 pl-8 text-center" value={data.credit_hours} onChange={e => setData('credit_hours', e.target.value)} required />
                                                <span className="absolute left-3 top-2.5 text-[10px] font-black text-slate-400">ساعة</span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700">مستوى صعوبة المادة (للجدول الذكي)</label>
                                            <select
                                                className="rounded-xl border-slate-200 w-full text-sm font-bold focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 mt-1"
                                                value={data.difficulty_level}
                                                onChange={e => setData('difficulty_level', e.target.value)}
                                            >
                                                <option value="1">خفيف</option>
                                                <option value="3">متوازن</option>
                                                <option value="5">مكثف</option>
                                            </select>
                                            {errors.difficulty_level && <div className="text-rose-500 text-xs mt-1 font-bold">{errors.difficulty_level}</div>}
                                        </div>

                                        <div className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                                            <label className="flex items-center justify-between gap-3 cursor-pointer">
                                                <span className="text-[11px] font-bold text-amber-800">شرط ساعات قبل تنزيل المادة (اختياري)</span>
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                                                    checked={data.minimum_passed_hours !== ''}
                                                    onChange={e => setData('minimum_passed_hours', e.target.checked ? 90 : '')}
                                                />
                                            </label>

                                            {data.minimum_passed_hours !== '' && (
                                                <div>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="200"
                                                        className="rounded-xl border-amber-200 w-full text-sm font-black focus:ring-amber-500 focus:border-amber-500 text-center"
                                                        value={data.minimum_passed_hours}
                                                        onChange={e => setData('minimum_passed_hours', e.target.value)}
                                                        placeholder="مثال: 90"
                                                    />
                                                    <p className="text-[10px] text-amber-700 font-bold mt-1">لن يستطيع الطالب تسجيلها قبل إكمال هذا العدد من الساعات.</p>
                                                    {errors.minimum_passed_hours && <div className="text-rose-500 text-xs mt-1 font-bold">{errors.minimum_passed_hours}</div>}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex justify-between">
                                            ملاحظات (وصف)
                                            <span className="text-indigo-400 text-[9px] bg-indigo-50 px-1.5 rounded">يظهر للطلاب</span>
                                        </label>
                                        <textarea 
                                            placeholder="اكتب نبذة عن طبيعة المادة هنا (اختياري)..." 
                                            className="rounded-xl border-slate-200 w-full text-xs font-medium focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 min-h-[60px] resize-none" 
                                            value={data.description} 
                                            onChange={e => setData('description', e.target.value)}
                                        ></textarea>
                                    </div>

                                    <div className="h-px bg-slate-100 w-full"></div>

                                    <div className="space-y-4">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">موقع العقدة وتصنيفها</label>
                                        
                                        <div className="flex flex-col gap-1.5 mb-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[11px] font-bold text-slate-700">مستوى المادة (موقعها بالشجرة):</span>
                                                <span className="bg-blue-50 text-blue-600 text-[9px] font-black px-1.5 py-0.5 rounded">يحدد الـ X-Axis</span>
                                            </div>
                                            <select className="w-full rounded-xl border-slate-200 text-sm font-bold focus:ring-indigo-500 bg-slate-50" value={data.semester} onChange={e => setData('semester', e.target.value)}>
                                                {[1,2,3,4,5,6,7,8,9,10,11,12].map(num => <option key={num} value={num}>المستوى (الفصل) {num}</option>)}
                                            </select>
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[11px] font-bold text-slate-700">تصنيف العقدة (Node Type):</span>
                                            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-xl">
                                                <label className="cursor-pointer">
                                                    <input type="radio" className="hidden peer" name="type" value="compulsory" checked={data.type === 'compulsory'} onChange={e => setData('type', e.target.value)} />
                                                    <div className="text-center py-2 rounded-lg peer-checked:bg-white peer-checked:text-indigo-600 peer-checked:shadow-sm font-bold transition-all text-xs text-slate-500">إجباري</div>
                                                </label>
                                                <label className="cursor-pointer">
                                                    <input type="radio" className="hidden peer" name="type" value="elective" checked={data.type === 'elective'} onChange={e => setData('type', e.target.value)} />
                                                    <div className="text-center py-2 rounded-lg peer-checked:bg-white peer-checked:text-emerald-600 peer-checked:shadow-sm font-bold transition-all text-xs text-slate-500">اختياري</div>
                                                </label>
                                                <label className="cursor-pointer">
                                                    <input type="radio" className="hidden peer" name="type" value="supporting" checked={data.type === 'supporting'} onChange={e => setData('type', e.target.value)} />
                                                    <div className="text-center py-2 rounded-lg peer-checked:bg-amber-50 peer-checked:text-amber-600 peer-checked:shadow-sm peer-checked:border-amber-200 border border-transparent font-bold transition-all text-[11px] text-slate-500 flex flex-col items-center justify-center">
                                                        <span>مساندة</span>
                                                        <span className="text-[8px] font-normal opacity-70">(شكل بيضاوي)</span>
                                                    </div>
                                                </label>
                                                <label className="cursor-pointer">
                                                    <input type="radio" className="hidden peer" name="type" value="university_req" checked={data.type === 'university_req'} onChange={e => setData('type', e.target.value)} />
                                                    <div className="text-center py-2 rounded-lg peer-checked:bg-cyan-50 peer-checked:text-cyan-600 peer-checked:shadow-sm peer-checked:border-cyan-200 border border-transparent font-bold transition-all text-[11px] text-slate-500 flex flex-col items-center justify-center">
                                                        <span>متطلب جامعة</span>
                                                        <span className="text-[8px] font-normal opacity-70">(أونلاين)</span>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-col gap-2 mt-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold text-slate-700">المتطلبات السابقة:</span>
                                                <span className="text-[10px] font-black text-slate-400">{selectedPrerequisiteIds.length} محددة</span>
                                            </div>
                                            <div className="bg-slate-50/60 border border-slate-200 rounded-2xl p-3 space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="relative flex-1">
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                                                        <input
                                                            type="text"
                                                            value={prerequisiteQuery}
                                                            onChange={(e) => setPrerequisiteQuery(e.target.value)}
                                                            placeholder="ابحث بالرمز أو الاسم..."
                                                            className="w-full pr-8 rounded-xl border-slate-200 focus:ring-indigo-500 text-sm font-bold bg-white"
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setData('prerequisite_ids', [])}
                                                        disabled={selectedPrerequisiteIds.length === 0}
                                                        className="px-3 py-2 rounded-xl text-[11px] font-black border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                                                    >
                                                        تفريغ
                                                    </button>
                                                </div>

                                                <div className="flex flex-wrap gap-2">
                                                    {selectedPrerequisites.length > 0 ? selectedPrerequisites.map((course) => (
                                                        <button
                                                            key={course.id}
                                                            type="button"
                                                            onClick={() => togglePrerequisite(course.id)}
                                                            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black hover:bg-indigo-100"
                                                        >
                                                            {course.name} ({course.code})
                                                            <span className="text-[11px]">✕</span>
                                                        </button>
                                                    )) : (
                                                        <span className="text-[10px] font-bold text-slate-400">لم يتم اختيار متطلبات بعد.</span>
                                                    )}
                                                </div>

                                                <div className="max-h-48 overflow-y-auto pr-1 space-y-2">
                                                    {filteredPrerequisites.length > 0 ? filteredPrerequisites.map((course) => {
                                                        const checked = selectedPrerequisiteIds.includes(String(course.id));
                                                        return (
                                                            <label
                                                                key={course.id}
                                                                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 cursor-pointer transition-colors ${checked ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:border-indigo-200'}`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={checked}
                                                                        onChange={() => togglePrerequisite(course.id)}
                                                                        className="rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                                    />
                                                                    <div>
                                                                        <p className="text-[12px] font-bold text-slate-700">{course.name}</p>
                                                                        <p className="text-[10px] font-black text-slate-400 font-mono" dir="ltr">{course.code}</p>
                                                                    </div>
                                                                </div>
                                                                <span className="text-[10px] font-black text-slate-400">فصل {course.semester || 1}</span>
                                                            </label>
                                                        );
                                                    }) : (
                                                        <div className="text-[11px] font-bold text-slate-400 text-center py-3">لا توجد نتائج مطابقة.</div>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-400">اختر المتطلبات من القائمة، ويمكن إزالة أي متطلب بالضغط عليه.</p>
                                            {(errors.prerequisite_ids || errors.prerequisite_id) && (
                                                <p className="text-[11px] font-bold text-rose-500">{errors.prerequisite_ids || errors.prerequisite_id}</p>
                                            )}
                                        </div>
                                    </div>

                                    <button type="submit" disabled={manualSaving} className={`flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black text-white shadow-lg transition-all active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${editingCourse ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/30' : 'bg-slate-900 hover:bg-indigo-600 hover:shadow-indigo-500/30'}`}>
                                        {manualSaving && <LoaderCircle className="size-5 animate-spin" />}
                                        {manualSaving ? 'جاري الحفظ…' : (editingCourse ? 'حفظ التعديلات' : 'حفظ وإضافة مادة أخرى')}
                                    </button>
                                </form>
                            </div>

                            {/* جدول عرض المواد (Data Table) */}
                            <div className="lg:col-span-8 space-y-5">
                                <div className="bg-white p-5 rounded-[2rem] border border-slate-200/80 flex flex-col md:flex-row items-center gap-4 shadow-sm">
                                    <div className="flex-1 w-full">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">تصفية حسب التخصص</label>
                                        <select
                                            className="w-full rounded-xl border-slate-200 focus:ring-indigo-500 text-sm font-bold text-indigo-800 bg-indigo-50/50 border-transparent cursor-pointer"
                                            value={activeMajorFilter}
                                            onChange={e => setActiveMajorFilter(e.target.value)}
                                        >
                                            <option value="">🌍 عرض كل المواد (النظام كامل)</option>
                                            <option value="general">🏛️ متطلبات الجامعة الإجبارية والاختيارية</option>
                                            {safeMajors.map(m => <option key={m.id} value={m.id}>🎓 {m.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex-1 w-full">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">تصفية حسب الخطة</label>
                                        <select
                                            className="w-full rounded-xl border-slate-200 focus:ring-indigo-500 text-sm font-bold text-amber-800 bg-amber-50/60 border-transparent cursor-pointer"
                                            value={activePlanFilter}
                                            onChange={e => setActivePlanFilter(e.target.value)}
                                        >
                                            <option value="">🧭 عرض كل الخطط</option>
                                            <option value="12">🟦 خطة 12</option>
                                            <option value="11">🟨 خطة 11</option>
                                        </select>
                                    </div>
                                    <div className="flex-1 w-full relative">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">بحث سريع</label>
                                        <span className="absolute right-4 top-[34px] text-slate-400">🔍</span>
                                        <input type="text" placeholder="اكتب رمز أو اسم المادة..." className="w-full pr-12 rounded-xl border-slate-200 focus:ring-indigo-500 text-sm font-bold bg-slate-50/50" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                                    </div>
                                </div>

                                <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
                                    
                                    {selectedIds.length > 0 && (
                                        <div className="bg-indigo-50 border-b border-indigo-100 flex items-center justify-between px-6 py-3 animate-fade-in-up">
                                            <span className="text-sm font-black text-indigo-800 flex items-center gap-2">
                                                تم تحديد <span className="text-lg bg-white px-2 py-0.5 rounded-md shadow-sm">{selectedIds.length}</span> مواد
                                            </span>
                                            <div className="flex gap-2">
                                                <button onClick={() => setSelectedIds([])} className="px-3 py-1.5 bg-white text-slate-500 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all">إلغاء التحديد</button>
                                                <button onClick={handleBulkDelete} className="px-4 py-1.5 bg-rose-500 text-white rounded-xl text-xs font-black hover:bg-rose-600 shadow-md shadow-rose-500/20 active:scale-95 transition-all">🗑️ حذف نهائي</button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-right whitespace-nowrap">
                                            <thead className="bg-slate-50/80 border-b border-slate-100">
                                                <tr>
                                                    <th className="p-5 w-10">
                                                        <input type="checkbox" className="rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" onChange={(e) => e.target.checked ? setSelectedIds(filteredCourses.map(c => c.id)) : setSelectedIds([])} checked={selectedIds.length === filteredCourses.length && filteredCourses.length > 0} />
                                                    </th>
                                                    <th className="p-5 font-black text-slate-400 text-[11px] uppercase tracking-widest">المادة ورمزها</th>
                                                    <th className="p-5 font-black text-slate-400 text-[11px] uppercase tracking-widest">التصنيف والنوع</th>
                                                    <th className="p-5 font-black text-slate-400 text-[11px] uppercase tracking-widest">الاعتماد (يفتح)</th>
                                                    <th className="p-5 font-black text-slate-400 text-[11px] uppercase tracking-widest text-left">إجراءات</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {filteredCourses.map(course => (
                                                    <tr key={course.id} className={`transition-all duration-200 group ${editingCourse?.id === course.id ? 'bg-amber-50/30' : 'hover:bg-slate-50/50'}`}>
                                                        <td className="p-5">
                                                            <input type="checkbox" className="rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer opacity-40 group-hover:opacity-100 transition-opacity" checked={selectedIds.includes(course.id)} onChange={() => setSelectedIds(prev => prev.includes(course.id) ? prev.filter(i => i !== course.id) : [...prev, course.id])} />
                                                        </td>
                                                        <td className="p-5">
                                                            <div className="flex items-center gap-3">
                                                                {renderCourseBadge(course.type, course.credit_hours)}
                                                                <div>
                                                                    <div className="font-[900] text-slate-800 text-[13px] mb-0.5 flex items-center gap-1.5">
                                                                        {course.name}
                                                                        {course.description && <span className="text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded" title="تحتوي على ملاحظات">📝</span>}
                                                                    </div>
                                                                    <div className="text-[10px] font-black text-slate-400 font-mono tracking-wider" dir="ltr">{course.code}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-5">
                                                            <div className="flex flex-col gap-1.5 items-start">
                                                                {course.major ? <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg text-[10px] font-black border border-slate-200/60 shadow-sm">{course.major.name}</span> : <span className="bg-gradient-to-r from-violet-100 to-fuchsia-100 text-violet-700 px-2.5 py-1 rounded-lg text-[10px] font-black border border-violet-200/60 shadow-sm">🎓 متطلب جامعة</span>}
                                                                <span className="text-[10px] font-bold text-slate-400">
                                                                    {course.type === 'supporting' ? '🔸 مادة مساندة | ' : course.type === 'university_req' ? '🌐 أونلاين | ' : ''}
                                                                    الفصل {course.semester || 1}
                                                                </span>
                                                                <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-lg">الخطة {course.study_plan_version || 12}</span>
                                                                {course.minimum_passed_hours ? (
                                                                    <span className="text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-lg">⏳ شرط {course.minimum_passed_hours} ساعة</span>
                                                                ) : null}
                                                            </div>
                                                        </td>
                                                        <td className="p-5">
                                                            {course.prerequisites && course.prerequisites.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                                                                    {course.prerequisites.map(pre => (
                                                                        <span key={pre.id} className="bg-white text-slate-600 text-[10px] font-black px-2 py-1 rounded-md border border-slate-200 shadow-sm group-hover:border-indigo-200 transition-colors" title={`رمز: ${pre.code}`}>
                                                                            🔒 {pre.name}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : <span className="text-slate-300 font-black text-lg">-</span>}
                                                        </td>
                                                        <td className="p-5 text-left">
                                                            <div className="flex items-center justify-end gap-2 opacity-20 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => editCourse(course)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 flex items-center justify-center transition-all shadow-sm" title="تعديل المادة">
                                                                    ✏️
                                                                </button>
                                                                <button onClick={() => handleDeleteSingle(course.id, course.name)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 flex items-center justify-center transition-all shadow-sm" title="حذف نهائي">
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    
                                    {filteredCourses.length === 0 && (
                                        <div className="p-20 text-center flex flex-col items-center justify-center">
                                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-4xl mb-4 shadow-inner border border-slate-100">📂</div>
                                            <h4 className="text-slate-700 font-black text-lg mb-1">لا توجد مواد هنا</h4>
                                            <p className="text-slate-400 font-medium text-sm">جرب تغيير الفلتر المختار أو ابدأ بإضافة مواد جديدة.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- 4. محتوى تبويب: سجل العمليات --- */}
                {false && (
                    <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden animate-fade-in-up delay-100">
                        <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-[900] text-slate-800 tracking-tight">🕵️ سجل نشاطات النظام</h2>
                                <p className="text-[11px] font-bold text-slate-400 mt-1">تتبع من قام بإضافة، تعديل، أو حذف البيانات.</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right whitespace-nowrap">
                                <thead className="bg-white text-slate-400 text-[11px] font-black uppercase tracking-widest border-b border-slate-100">
                                    <tr><th className="p-5">التاريخ والوقت</th><th className="p-5">المسؤول (الأدمن)</th><th className="p-5">تفاصيل العملية</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-sm">
                                    {logs && logs.length > 0 ? logs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-5 text-slate-400 font-mono text-[11px] font-bold" dir="ltr">{new Date(log.created_at).toLocaleString('en-GB')}</td>
                                            <td className="p-5 font-[900] text-slate-700 flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] overflow-hidden">
                                                    {log.user?.avatar ? (
                                                        <img src={log.user.avatar} alt={log.user.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        log.user?.name?.charAt(0) || '?'
                                                    )}
                                                </div>
                                                {log.user?.name || 'مستخدم غير معروف'}
                                            </td>
                                            <td className="p-5 text-slate-500 font-bold whitespace-normal">
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ml-2 border ${
                                                    log.action.includes('add') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                    log.action.includes('delete') ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                    'bg-blue-50 text-blue-600 border-blue-100'
                                                }`}>
                                                    {log.action}
                                                </span>
                                                {log.details}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="3" className="p-10 text-center text-slate-400 font-bold">لم يتم تسجيل أي عمليات بعد.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {showImportPreview && csvPreview && (
                    <div id="csv-import-preview-panel" className="mt-6 bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden animate-fade-in-up">
                        <div className="px-6 md:px-8 py-5 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                                <h3 className="text-xl font-black text-slate-900">معاينة البيانات قبل الإرسال</h3>
                                <p className="text-xs text-slate-500 font-bold mt-1">الملف: {csvPreview.fileName}</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-black">
                                <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">صفوف: {previewStats.total}</span>
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700">صالحة: {previewStats.valid}</span>
                                <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700">مراجعة: {previewStats.warnings}</span>
                            </div>
                        </div>

                        <div className="p-6 md:p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="mb-1 text-xs font-black text-slate-800">مطابقة أعمدة الملف</p>
                                    <p className="mb-3 text-[11px] font-bold leading-5 text-slate-500">تمت المطابقة تلقائياً، ويمكنك تصحيح أي عمود قبل الحفظ.</p>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {[
                                            ['code', 'رمز المادة *'], ['name', 'اسم المادة *'], ['credit_hours', 'الساعات'], ['type', 'النوع'],
                                            ['prerequisites', 'المتطلبات السابقة'], ['semester', 'المستوى/الفصل'], ['description', 'الوصف'], ['minimum_passed_hours', 'شرط الساعات'],
                                        ].map(([field, label]) => <label key={field} className="block text-[11px] font-black text-slate-600"><span className="mb-1 block">{label}</span><select value={csvPreview.mappedHeaders[field] || ''} onChange={(event) => handleColumnMappingChange(field, event.target.value)} className="course-import-input !min-h-10 !py-1.5 !text-xs"><option value="">غير مربوط</option>{csvPreview.headers.map((header) => <option key={`${field}-${header}`} value={header}>{header}</option>)}</select></label>)}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                                    <p className="text-[11px] uppercase tracking-widest text-slate-500 font-black">فحوصات سريعة قبل الإرسال</p>
                                    {csvPreview.missingRequiredColumns.length > 0 ? (
                                        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
                                            الأعمدة الإلزامية المفقودة: {csvPreview.missingRequiredColumns.join(' - ')}
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">
                                            تم اكتشاف الأعمدة الإلزامية بنجاح.
                                        </div>
                                    )}

                                    {csvPreview.parseErrors.length > 0 && (
                                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-700 space-y-1">
                                            <div>تم رصد ملاحظات أثناء التحليل:</div>
                                            {csvPreview.parseErrors.slice(0, 3).map((error, idx) => (
                                                <div key={idx}>• {error}</div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="text-xs text-slate-500 font-bold">
                                        سيتم إرسال الصفوف الصالحة فقط (التي تحتوي رمز مادة واسم مادة).
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 overflow-hidden">
                                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-black text-slate-700 flex items-center justify-between">
                                    <span>كل بيانات المعاينة ({editablePreviewRows.length} صف)</span>
                                    <button type="button" onClick={addEditablePreviewRow} className="px-3 h-8 rounded-lg bg-indigo-600 text-white text-[11px] font-black hover:bg-indigo-500">+ إضافة صف</button>
                                </div>
                                <div className="overflow-auto max-h-[55vh]">
                                    <table className="w-full text-right text-xs whitespace-nowrap">
                                        <thead className="bg-white border-b border-slate-100 text-slate-500 font-black">
                                            <tr>
                                                <th className="px-3 py-2">#</th>
                                                <th className="px-3 py-2">code</th>
                                                <th className="px-3 py-2">name</th>
                                                <th className="px-3 py-2">credit_hours</th>
                                                <th className="px-3 py-2">type المفسر</th>
                                                <th className="px-3 py-2">prerequisites</th>
                                                <th className="px-3 py-2">semester</th>
                                                <th className="px-3 py-2">ملاحظات</th>
                                                <th className="px-3 py-2">حذف</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {editablePreviewRows.map((row, index) => {
                                                const rowWarnings = getPreviewRowWarnings(row);
                                                return (
                                                <tr key={`${row.lineNumber}-${index}`} className={rowWarnings.length > 0 ? 'bg-amber-50/50' : 'bg-white'}>
                                                    <td className="px-3 py-2 font-black text-slate-500">{row.lineNumber}</td>
                                                    <td className="px-3 py-2"><input value={row.code || ''} onChange={(e) => updateEditablePreviewRow(index, 'code', e.target.value)} className="w-[120px] rounded border border-slate-200 px-2 py-1 font-mono" dir="ltr" /></td>
                                                    <td className="px-3 py-2"><input value={row.name || ''} onChange={(e) => updateEditablePreviewRow(index, 'name', e.target.value)} className="w-[220px] rounded border border-slate-200 px-2 py-1 font-bold" /></td>
                                                    <td className="px-3 py-2"><input type="number" min="0" max="12" value={row.creditHours ?? 3} onChange={(e) => updateEditablePreviewRow(index, 'creditHours', e.target.value)} className="w-[80px] rounded border border-slate-200 px-2 py-1 text-center font-black" /></td>
                                                    <td className="px-3 py-2">
                                                        <select value={row.mappedType || 'compulsory'} onChange={(e) => updateEditablePreviewRow(index, 'mappedType', e.target.value)} className="w-[130px] rounded border border-slate-200 px-2 py-1 font-bold text-indigo-700">
                                                            <option value="compulsory">إجباري</option>
                                                            <option value="elective">اختياري</option>
                                                            <option value="supporting">مساندة</option>
                                                            <option value="university_req">متطلب جامعة</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-3 py-2"><input value={row.prerequisites || ''} onChange={(e) => updateEditablePreviewRow(index, 'prerequisites', e.target.value)} className="w-[170px] rounded border border-slate-200 px-2 py-1" dir="ltr" /></td>
                                                    <td className="px-3 py-2"><input type="number" min="1" max="12" value={row.semester ?? 1} onChange={(e) => updateEditablePreviewRow(index, 'semester', e.target.value)} className="w-[70px] rounded border border-slate-200 px-2 py-1 text-center font-black" /></td>
                                                    <td className={`px-3 py-2 font-bold ${rowWarnings.length > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{rowWarnings.length > 0 ? rowWarnings.join(' | ') : 'صالح'}</td>
                                                    <td className="px-3 py-2"><button type="button" onClick={() => deleteEditablePreviewRow(index)} className="px-2 h-7 rounded bg-rose-50 text-rose-600 font-black border border-rose-200">حذف</button></td>
                                                </tr>
                                            )})}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 md:px-8 py-4 border-t border-slate-100 bg-white flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                            <p className="text-xs font-bold text-slate-500">لن يتم الإرسال قبل الضغط على زر التأكيد.</p>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setShowImportPreview(false)} className="px-4 h-10 rounded-xl border border-slate-300 text-slate-700 font-black text-xs hover:bg-slate-50 transition-colors">
                                    إخفاء المعاينة
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmImportSubmit}
                                    disabled={previewSubmitting || !csvPreview.requiredColumnsFound || previewStats.valid === 0}
                                    className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-xs font-black text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {previewSubmitting && <LoaderCircle className="size-4 animate-spin" />}
                                    {previewSubmitting ? 'جاري الإرسال...' : 'تأكيد إرسال البيانات المعدلة'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
