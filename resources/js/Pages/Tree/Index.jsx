import React, { useMemo, useState, useCallback, useEffect } from 'react';
import ReactFlow, { Controls, Background, MarkerType, useNodesState, useEdgesState } from 'reactflow';
import dagre from 'dagre';
import axios from 'axios';
import Swal from 'sweetalert2';
import { Head, Link, router, usePage } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { useLanguage } from '@/Contexts/LanguageContext';
import { useTheme } from '@/Contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import 'reactflow/dist/style.css';

// Resolve the deployment URL once for canonical metadata on the tree page.
const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');

/* ═══════════════════════════════════════════════════════════
   CONSTANTS & LAYOUT ENGINE
   ═══════════════════════════════════════════════════════════ */

const DESKTOP_NODE_WIDTH = 200;
const DESKTOP_NODE_HEIGHT = 88;
const MOBILE_NODE_WIDTH = 150;
const MOBILE_NODE_HEIGHT = 72;

// Shared SweetAlert theme so all tree interactions feel visually consistent.
const swalTheme = {
    confirmButtonColor: '#4f46e5',
    customClass: { popup: 'rounded-3xl font-t', title: 'font-t', htmlContainer: 'font-t' },
};

// Build a readable DAG layout for course nodes before rendering with React Flow.
const getLayoutedElements = (nodes, edges, direction = 'TB', dimensions = { width: DESKTOP_NODE_WIDTH, height: DESKTOP_NODE_HEIGHT, ranksep: 90, nodesep: 30 }) => {
    const { width, height, ranksep, nodesep } = dimensions;
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    dagreGraph.setGraph({
        rankdir: direction,
        ranksep,
        nodesep,
        edgesep: 15
    });

    const sortedNodes = [...nodes].sort((a, b) => {
        const semA = parseInt(a.data?.semester) || 1;
        const semB = parseInt(b.data?.semester) || 1;
        if (semA !== semB) return semA - semB;
        const codeA = a.data?.code || '';
        const codeB = b.data?.code || '';
        return codeA.localeCompare(codeB);
    });

    sortedNodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width, height });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target, { weight: 2 });
    });

    const semesters = sortedNodes.map(n => parseInt(n.data?.semester) || 1).filter(s => !isNaN(s));
    if (semesters.length > 0) {
        const minSem = Math.min(...semesters);
        const maxSem = Math.max(...semesters);

        for (let s = minSem - 1; s <= maxSem; s++) {
            const anchorId = `anchor-sem-${s}`;
            dagreGraph.setNode(anchorId, { width: 1, height: 1 });
            if (s > minSem - 1) {
                dagreGraph.setEdge(`anchor-sem-${s - 1}`, `anchor-sem-${s}`, { weight: 100 });
            }
        }

        sortedNodes.forEach((node) => {
            const sem = parseInt(node.data?.semester) || 1;
            const prevAnchor = `anchor-sem-${sem - 1}`;
            dagreGraph.setEdge(prevAnchor, node.id, { weight: 1 });
        });
    }

    dagre.layout(dagreGraph);

    return nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
            ...node,
            targetPosition: 'top',
            sourcePosition: 'bottom',
            position: {
                x: nodeWithPosition ? nodeWithPosition.x - width / 2 : 0,
                y: nodeWithPosition ? nodeWithPosition.y - height / 2 : 0,
            },
        };
    });
};

/* ═══════════════════════════════════════════════════════════
   TREE PAGE
   ═══════════════════════════════════════════════════════════ */

export default function Tree({
    courses = [],
    passed_course_ids = [],
    initial_cart_ids = [],
    student_name = 'طالب',
    major_name = '',
    college_name = '',
    study_plan_version = 12,
    passed_courses = [],
    total_passed_hours = 0,
}) {

    // Page-level state drives filtering, course selection, and AI planning behavior.

    const { props } = usePage();
    const { lang } = useLanguage();
    const { isDark } = useTheme();
    const authUser = props?.auth?.user;
    const canEditTreePositions = Boolean(authUser?.is_admin_or_owner);
    const [passedIds, setPassedIds] = useState(passed_course_ids || []);
    const [cartIds, setCartIds] = useState(initial_cart_ids || []);
    const [localPassedCourses, setLocalPassedCourses] = useState(passed_courses || []);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [targetSemester, setTargetSemester] = useState(1);
    const [targetYear, setTargetYear] = useState(1);
    const [targetTerm, setTargetTerm] = useState(1);
    const [activeTab, setActiveTab] = useState('details');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showAiSettings, setShowAiSettings] = useState(false);
    const [targetHours, setTargetHours] = useState(15);
    const [schedulePace, setSchedulePace] = useState('balanced');
    const [smartFocus, setSmartFocus] = useState('major');
    const [smartProtectGpa, setSmartProtectGpa] = useState(true);
    const [smartMetaByCourseId, setSmartMetaByCourseId] = useState({});
    const [filterMode, setFilterMode] = useState('none');
    const [legendOpen, setLegendOpen] = useState(false);
    const [show4YearPlan, setShow4YearPlan] = useState(false);
    const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);
    const [viewportHeight, setViewportHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 720);
    const [dismissedRotateHint, setDismissedRotateHint] = useState(false);
    const [positionEditMode, setPositionEditMode] = useState(false);
    const [nodePositions, setNodePositions] = useState({});
    const [draftNodePositions, setDraftNodePositions] = useState({});
    const [nodePositionsBeforeEdit, setNodePositionsBeforeEdit] = useState({});
    const [hasUnsavedNodeMoves, setHasUnsavedNodeMoves] = useState(false);
    const [isSavingNodePositions, setIsSavingNodePositions] = useState(false);

    const isMobile = viewportWidth < 1024;
    const isPortraitMobile = isMobile && viewportHeight > viewportWidth;
    const showRotateHint = isPortraitMobile && !dismissedRotateHint;

    const semesterToYearTerm = useCallback((semesterValue) => {
        const normalized = Math.min(18, Math.max(1, parseInt(semesterValue, 10) || 1));
        return {
            year: Math.ceil(normalized / 3),
            term: ((normalized - 1) % 3) + 1,
        };
    }, []);

    // Used to decode legacy plan-level semester numbering (1..12 regular terms only).
    const legacyPlanSemesterToYearTerm = useCallback((semesterValue) => {
        const normalized = Math.min(12, Math.max(1, parseInt(semesterValue, 10) || 1));
        return {
            year: Math.ceil(normalized / 2),
            term: normalized % 2 === 0 ? 2 : 1,
        };
    }, []);

    const yearTermToSemester = useCallback((yearValue, termValue) => {
        const safeYear = Math.min(6, Math.max(1, parseInt(yearValue, 10) || 1));
        const parsedTerm = parseInt(termValue, 10);
        const safeTerm = [1, 2, 3].includes(parsedTerm) ? parsedTerm : 1;
        return ((safeYear - 1) * 3) + safeTerm;
    }, []);

    const yearOptions = useMemo(() => ([
        { value: 1, label: 'السنة الأولى' },
        { value: 2, label: 'السنة الثانية' },
        { value: 3, label: 'السنة الثالثة' },
        { value: 4, label: 'السنة الرابعة' },
        { value: 5, label: 'السنة الخامسة' },
        { value: 6, label: 'السنة السادسة' },
    ]), []);

    const termOptions = useMemo(() => ([
        { value: 1, label: 'الفصل الأول' },
        { value: 2, label: 'الفصل الثاني' },
        { value: 3, label: 'الفصل الصيفي' },
    ]), []);

    const suggestedStudySlot = useMemo(() => {
        const passedArray = Array.isArray(localPassedCourses) ? localPassedCourses : [];

        if (passedArray.length === 0) {
            if (selectedCourse?.semester) {
                return legacyPlanSemesterToYearTerm(selectedCourse.semester);
            }

            return { year: 1, term: 1 };
        }

        let maxYear = 1;
        let maxTerm = 1;

        passedArray.forEach((course) => {
            const y = parseInt(course?.pivot?.studied_year, 10);
            const t = parseInt(course?.pivot?.studied_term, 10);

            if (y >= 1 && y <= 6 && [1, 2, 3].includes(t)) {
                if (y > maxYear || (y === maxYear && t > maxTerm)) {
                    maxYear = y;
                    maxTerm = t;
                }
                return;
            }

            const fallback = legacyPlanSemesterToYearTerm(course?.pivot?.studied_semester || course?.semester || 1);
            if (fallback.year > maxYear || (fallback.year === maxYear && fallback.term > maxTerm)) {
                maxYear = fallback.year;
                maxTerm = fallback.term;
            }
        });

        if (maxTerm < 3) {
            return { year: maxYear, term: maxTerm + 1 };
        }

        return { year: Math.min(6, maxYear + 1), term: 1 };
    }, [localPassedCourses, selectedCourse, legacyPlanSemesterToYearTerm]);
    const nodeDimensions = useMemo(() => (
        isMobile
            ? { width: MOBILE_NODE_WIDTH, height: MOBILE_NODE_HEIGHT, ranksep: 70, nodesep: 20 }
            : { width: DESKTOP_NODE_WIDTH, height: DESKTOP_NODE_HEIGHT, ranksep: 90, nodesep: 30 }
    ), [isMobile]);

    const flowView = useMemo(() => (
        isMobile
            ? { fitPadding: 0.28, minZoom: 0.35, maxZoom: 2 }
            : { fitPadding: 0.2, minZoom: 0.1, maxZoom: 1.5 }
    ), [isMobile]);

    const coursesById = useMemo(
        () => new Map(courses.map((course) => [course.id.toString(), course])),
        [courses]
    );

    const nodeSnapGrid = useMemo(() => (
        isMobile ? [16, 16] : [20, 20]
    ), [isMobile]);

    const layoutSeedPositions = useMemo(() => {
        if (!Array.isArray(courses) || courses.length === 0) {
            return new Map();
        }

        const layoutNodes = courses.map((course) => ({
            id: course.id.toString(),
            position: { x: 0, y: 0 },
            data: {
                semester: parseInt(course.semester) || 1,
                code: course.code || '',
            },
        }));

        const layoutEdges = [];
        courses.forEach((course) => {
            course.prerequisites?.forEach((prereq) => {
                layoutEdges.push({
                    id: `layout-${prereq.id}-${course.id}`,
                    source: prereq.id.toString(),
                    target: course.id.toString(),
                });
            });
        });

        return new Map(
            getLayoutedElements(layoutNodes, layoutEdges, 'TB', nodeDimensions)
                .map((node) => [node.id, node.position])
        );
    }, [courses, nodeDimensions]);

    const semesterLevelYMap = useMemo(() => {
        const levels = new Map();

        courses.forEach((course) => {
            const courseId = course.id.toString();
            const semester = Number.parseInt(course.semester, 10) || 1;
            const seeded = layoutSeedPositions.get(courseId);
            const fallbackY = (semester - 1) * (nodeDimensions.height + nodeDimensions.ranksep);
            const y = Number(seeded?.y ?? fallbackY);

            if (!levels.has(semester)) {
                levels.set(semester, []);
            }

            levels.get(semester).push(y);
        });

        const normalized = new Map();
        Array.from(levels.keys())
            .sort((a, b) => a - b)
            .forEach((semester, index) => {
                const values = levels.get(semester) || [];
                const avg = values.length > 0
                    ? values.reduce((sum, value) => sum + value, 0) / values.length
                    : index * (nodeDimensions.height + nodeDimensions.ranksep);

                normalized.set(semester, Math.round(avg));
            });

        return normalized;
    }, [courses, layoutSeedPositions, nodeDimensions.height, nodeDimensions.ranksep]);

    const lockNodeToSemesterLevel = useCallback((courseId, position) => {
        const course = coursesById.get(courseId.toString());
        if (!course) {
            return {
                x: Number(position?.x) || 0,
                y: Number(position?.y) || 0,
            };
        }

        const semester = Number.parseInt(course.semester, 10) || 1;
        const lockedY = semesterLevelYMap.get(semester);

        return {
            x: Number(position?.x) || 0,
            y: Number.isFinite(lockedY) ? lockedY : (Number(position?.y) || 0),
        };
    }, [coursesById, semesterLevelYMap]);

    useEffect(() => {
        if (!Array.isArray(courses) || courses.length === 0) return;

        const currentIds = new Set(courses.map((course) => course.id.toString()));

        setNodePositions((prev) => {
            const next = { ...prev };

            courses.forEach((course) => {
                const courseId = course.id.toString();
                if (next[courseId]) return;

                if (course.tree_position_x !== null && course.tree_position_x !== undefined && course.tree_position_y !== null && course.tree_position_y !== undefined) {
                    next[courseId] = {
                        x: Number(course.tree_position_x),
                        y: Number(course.tree_position_y),
                    };
                    return;
                }

                const seeded = layoutSeedPositions.get(courseId);
                if (seeded) {
                    next[courseId] = seeded;
                }
            });

            Object.keys(next).forEach((courseId) => {
                if (!currentIds.has(courseId)) {
                    delete next[courseId];
                }
            });

            return next;
        });
    }, [courses, layoutSeedPositions]);

    const startPositionEditMode = useCallback(() => {
        setNodePositionsBeforeEdit({ ...nodePositions });
        setDraftNodePositions({ ...nodePositions });
        setHasUnsavedNodeMoves(false);
        setPositionEditMode(true);
    }, [nodePositions]);

    const cancelPositionEditMode = useCallback(() => {
        setNodePositions({ ...nodePositionsBeforeEdit });
        setDraftNodePositions({ ...nodePositionsBeforeEdit });
        setHasUnsavedNodeMoves(false);
        setPositionEditMode(false);
    }, [nodePositionsBeforeEdit]);

    const saveAllNodePositions = useCallback(async () => {
        if (!canEditTreePositions) return;

        const changedEntries = Object.entries(draftNodePositions).filter(([courseId, position]) => {
            const basePosition = nodePositionsBeforeEdit[courseId] || { x: 0, y: 0 };
            const dx = Math.abs((Number(position?.x) || 0) - (Number(basePosition?.x) || 0));
            const dy = Math.abs((Number(position?.y) || 0) - (Number(basePosition?.y) || 0));
            return dx > 0.5 || dy > 0.5;
        });

        if (changedEntries.length === 0) {
            setPositionEditMode(false);
            return;
        }

        try {
            setIsSavingNodePositions(true);

            for (const [courseId, position] of changedEntries) {
                await axios.post(route('admin.tree.positions'), {
                    course_id: Number(courseId),
                    position_x: Number(position?.x) || 0,
                    position_y: Number(position?.y) || 0,
                });
            }

            setNodePositionsBeforeEdit({ ...draftNodePositions });
            setHasUnsavedNodeMoves(false);
            setPositionEditMode(false);
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'تعذر حفظ المكان',
                text: error.response?.data?.message || 'حدث خطأ أثناء حفظ مواضع المواد.',
                ...swalTheme
            });
        } finally {
            setIsSavingNodePositions(false);
        }
    }, [canEditTreePositions, draftNodePositions, nodePositionsBeforeEdit]);

    useEffect(() => {
        const onResize = () => {
            setViewportWidth(window.innerWidth);
            setViewportHeight(window.innerHeight);
        };
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        if (!isPortraitMobile) {
            setDismissedRotateHint(false);
        }
    }, [isPortraitMobile]);

    useEffect(() => {
        if (!isMobile) {
            setIsSidebarOpen(false);
        }
    }, [isMobile]);

    useEffect(() => {
        const next = semesterToYearTerm(targetSemester);
        setTargetYear(next.year);
        setTargetTerm(next.term);
    }, [targetSemester, semesterToYearTerm]);

    const syncCartWithDB = useCallback((ids) => {
        router.post(route('cart.sync'), { course_ids: ids }, {
            preserveState: true,
            preserveScroll: true,
        });
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            axios.post(route('cart.sync'), { course_ids: cartIds })
                .catch(err => console.error("Failed to sync cart", err));
        }, 1000);
        return () => clearTimeout(timer);
    }, [cartIds]);

    const totalPassedCredits = useMemo(() => {
        const calculated = courses
            .filter(c => passedIds.includes(c.id))
            .reduce((acc, c) => acc + (c.credit_hours || 0), 0);

        return calculated > 0 ? calculated : Number(total_passed_hours || 0);
    }, [courses, passedIds, total_passed_hours]);

    const isLockedByHours = useCallback((course) => {
        const required = Number(course?.minimum_passed_hours || 0);

        return required > 0 && totalPassedCredits < required;
    }, [totalPassedCredits]);

    const getHoursLockMessage = useCallback((course) => {
        const required = Number(course?.minimum_passed_hours || 0);
        if (required <= 0 || totalPassedCredits >= required) {
            return null;
        }

        return `هذه المادة تتطلب إنهاء ${required} ساعة معتمدة. الساعات الحالية: ${totalPassedCredits}.`;
    }, [totalPassedCredits]);

    const getStatus = useCallback((course) => {
        if (!course) return 'locked';
        if (passedIds.includes(course.id)) return 'passed';
        if (cartIds.includes(course.id)) return 'cart';
        if (isLockedByHours(course)) return 'locked';
        if (!course.prerequisites || course.prerequisites.length === 0) return 'available';
        return course.prerequisites.every(p => passedIds.includes(p.id)) ? 'available' : 'locked';
    }, [passedIds, cartIds, isLockedByHours]);

    const getUnlocksDetailed = useCallback((courseId) => {
        return courses.filter(c => c.prerequisites?.some(p => p.id === courseId));
    }, [courses]);

    const getBackwardPath = useCallback((courseId, visited = new Set()) => {
        if (visited.has(courseId)) return visited;
        visited.add(courseId);
        const course = courses.find(c => c.id === courseId);
        if (course?.prerequisites) course.prerequisites.forEach(p => getBackwardPath(p.id, visited));
        return visited;
    }, [courses]);

    const getForwardPath = useCallback((courseId, visited = new Set()) => {
        if (visited.has(courseId)) return visited;
        visited.add(courseId);
        courses.filter(c => c.prerequisites?.some(p => p.id === courseId))
            .forEach(u => getForwardPath(u.id, visited));
        return visited;
    }, [courses]);

    const getCourseDepth = useCallback((courseId, visited = new Set()) => {
        if (visited.has(courseId)) return 0;
        visited.add(courseId);
        const unlocks = courses.filter(c => c.prerequisites?.some(p => p.id === courseId));
        if (unlocks.length === 0) return 0;
        let maxDepth = 0;
        for (const u of unlocks) maxDepth = Math.max(maxDepth, 1 + getCourseDepth(u.id, new Set(visited)));
        return maxDepth;
    }, [courses]);

    const coursesWithDifficulty = useMemo(() => {
        return courses.map((course) => {
            const semester = Number(course.semester || 1);
            const recommendedYear = Math.min(4, Math.max(1, Math.ceil(semester / 2)));
            const avgGrade = Number(course.avg_grade ?? 72);
            const failRate = Number(course.fail_rate ?? 18);
            const prerequisitesCount = Number(course.prerequisites_count || (course.prerequisites?.length || 0));
            const baseDifficulty =
                ((100 - avgGrade) * 0.5)
                + (failRate * 0.35)
                + Math.min(prerequisitesCount * 7, 25)
                + ((recommendedYear - 1) * 6);

            return {
                ...course,
                recommended_year: recommendedYear,
                avg_grade: Number(avgGrade.toFixed(1)),
                fail_rate: Number(failRate.toFixed(1)),
                graded_attempts: Number(course.graded_attempts || 0),
                prerequisites_count: prerequisitesCount,
                difficulty_score: Math.max(0, Math.min(100, Number(baseDifficulty.toFixed(1)))),
            };
        });
    }, [courses]);

    // 🆕 أقصر طريق لفتح مادة مقفلة
    const getShortestPathToUnlock = useCallback((courseId) => {
        const course = courses.find(c => c.id === courseId);
        if (!course || !course.prerequisites) return [];

        // BFS لإيجاد الترتيب الصحيح للمتطلبات
        const steps = [];
        const visited = new Set();
        const queue = [...course.prerequisites];

        // نبدأ من المتطلبات المباشرة ونرجع للخلف
        const getAllPrereqs = (prereqs, depth = 0) => {
            for (const prereq of prereqs) {
                if (visited.has(prereq.id)) continue;
                visited.add(prereq.id);

                const prereqCourse = courses.find(c => c.id === prereq.id);
                if (!prereqCourse) continue;

                // أولاً: نعالج متطلبات المتطلب (الأعمق أولاً)
                if (prereqCourse.prerequisites && prereqCourse.prerequisites.length > 0) {
                    getAllPrereqs(prereqCourse.prerequisites, depth + 1);
                }

                const status = getStatus(prereqCourse);
                if (status !== 'passed') {
                    steps.push({
                        id: prereqCourse.id,
                        name: prereqCourse.name,
                        code: prereqCourse.code,
                        credit_hours: prereqCourse.credit_hours,
                        status: status,
                        isAvailableNow: status === 'available' || status === 'cart',
                        depth: depth,
                    });
                }
            }
        };

        getAllPrereqs(course.prerequisites);

        // إزالة التكرار وترتيب حسب العمق (الأعمق أولاً = الخطوة الأولى)
        const unique = [];
        const seen = new Set();
        for (const step of steps) {
            if (!seen.has(step.id)) {
                seen.add(step.id);
                unique.push(step);
            }
        }

        return unique;
    }, [courses, getStatus]);

    // 🆕 حساب التأثير الكلي المتسلسل
    const getTotalImpact = useCallback((courseId) => {
        return getForwardPath(courseId).size - 1;
    }, [getForwardPath]);

    // 🆕 نقاط الأولوية الاستراتيجية
    const getCoursePriority = useCallback((course) => {
        if (!course) return 0;
        const status = getStatus(course);
        if (status === 'passed') return 0;
        const depth = getCourseDepth(course.id);
        const unlocks = getUnlocksDetailed(course.id).length;
        const totalImpact = getTotalImpact(course.id);
        let score = 0;
        score += depth * 15;
        score += totalImpact * 8;
        score += unlocks * 10;
        if (course.type === 'compulsory') score += 5;
        if (status === 'available') score += 20;
        if (status === 'cart') score += 10;
        return Math.min(score, 100);
    }, [getStatus, getCourseDepth, getUnlocksDetailed, getTotalImpact]);

    // 🆕 بطاقات التحليل الذكي
    const getCourseInsights = useCallback((course) => {
        if (!course) return [];
        const insights = [];
        const status = getStatus(course);
        const unlocks = getUnlocksDetailed(course.id);
        const totalImpact = getTotalImpact(course.id);

        if (isLockedByHours(course)) {
            insights.push({
                icon: '⏳',
                title: `تحتاج ${course.minimum_passed_hours} ساعة قبل تسجيلها`,
                desc: `أنجز ${course.minimum_passed_hours - totalPassedCredits} ساعة إضافية ثم ستفتح تلقائياً.`,
                color: 'amber',
                p: 98,
            });
        }

        if (totalImpact >= 5 && status !== 'passed')
            insights.push({ icon: '💥', title: `تأجيلها يؤثر على ${totalImpact} مادة!`, desc: 'سلسلة طويلة من المواد تعتمد عليها بشكل مباشر أو غير مباشر.', color: 'rose', p: 100 });
        else if (totalImpact >= 2 && status !== 'passed')
            insights.push({ icon: '🔗', title: `${totalImpact} مادة تعتمد عليها`, desc: 'تأجيلها ممكن يبطئ مسارك الأكاديمي.', color: 'amber', p: 70 });

        if (unlocks.length >= 3 && status !== 'passed')
            insights.push({ icon: '🔑', title: `مادة مفصلية — تفتح ${unlocks.length} مواد مباشرة`, desc: 'أولوية قصوى! أنجزها لتوسيع خياراتك المتاحة.', color: 'violet', p: 90 });

        if (course.type === 'elective' && status === 'available')
            insights.push({ icon: '🎨', title: 'مادة اختيارية', desc: 'مثالية لتخفيف العبء أو رفع المعدل بفصل ثقيل.', color: 'amber', p: 30 });

        if (unlocks.length === 0 && status !== 'passed' && course.type === 'compulsory')
            insights.push({ icon: '🏁', title: 'مادة نهائية', desc: 'لا تفتح مواد أخرى — يمكن تأجيلها لآخر فصل بأمان.', color: 'slate', p: 10 });

        if (status === 'available' && course.prerequisites?.some(p => cartIds.includes(p.id)))
            insights.push({ icon: '⚠️', title: 'تنبيه مهم!', desc: 'أحد متطلباتها موجود بالتسجيل التجريبي — لا يُنصح بتسجيلهم بنفس الفصل.', color: 'rose', p: 95 });

        if (status === 'cart') {
            const cartHours = courses.filter(c => cartIds.includes(c.id)).reduce((s, c) => s + c.credit_hours, 0);
            insights.push({ icon: '🛒', title: `في التسجيل التجريبي (${cartHours} ساعة إجمالي)`, desc: cartHours > 18 ? '⚠️ تجاوزت الحد الأقصى!' : cartHours >= 15 ? 'عبء جيد ومتوازن.' : 'عبء خفيف — ممكن تضيف المزيد.', color: cartHours > 18 ? 'rose' : 'amber', p: 50 });
        }

        return insights.sort((a, b) => b.p - a.p);
    }, [getStatus, getUnlocksDetailed, getTotalImpact, cartIds, courses, isLockedByHours, totalPassedCredits]);

    // 🆕 اقتراح المادة التالية الأفضل
    const getNextBestCourse = useCallback(() => {
        const available = courses.filter(c => getStatus(c) === 'available' && !cartIds.includes(c.id));
        if (available.length === 0) return null;
        return available.sort((a, b) => getCoursePriority(b) - getCoursePriority(a))[0];
    }, [courses, getStatus, cartIds, getCoursePriority]);

    // 🆕 إحصائيات سريعة
    const miniStats = useMemo(() => {
        let availableCount = 0, criticalCount = 0;
        courses.forEach(c => {
            if (getStatus(c) === 'available') availableCount++;
            if (getStatus(c) !== 'passed' && getCourseDepth(c.id) >= 2) criticalCount++;
        });
        return { availableCount, criticalCount };
    }, [courses, getStatus, getCourseDepth]);

    // 🆕 تحليل صحة التسجيل التجريبي
    const cartHealthAnalysis = useMemo(() => {
        if (cartIds.length === 0) return null;
        const cc = courses.filter(c => cartIds.includes(c.id));
        const compulsory = cc.filter(c => c.type === 'compulsory').length;
        const elective = cc.filter(c => c.type === 'elective' || c.type === 'university_req').length;
        const supporting = cc.filter(c => c.type === 'supporting').length;
        const criticalInCart = cc.filter(c => getCourseDepth(c.id) >= 2).length;
        const totalImpactScore = cc.reduce((sum, c) => sum + getTotalImpact(c.id), 0);
        const compPct = cc.length > 0 ? Math.round((compulsory / cc.length) * 100) : 0;
        const elecPct = cc.length > 0 ? Math.round(((elective + supporting) / cc.length) * 100) : 0;
        return { compulsory, elective, supporting, criticalInCart, totalImpactScore, compPct, elecPct };
    }, [cartIds, courses, getCourseDepth, getTotalImpact]);

    const buildGraph = useCallback(() => {
        const nodeWidth = nodeDimensions.width;
        const nodeHeight = nodeDimensions.height;
        const titleFontSize = isMobile ? '10px' : '11.5px';
        const initialNodes = [];
        const initialEdges = [];

        const backwardIds = selectedCourse ? Array.from(getBackwardPath(selectedCourse.id)) : [];
        const forwardIds = selectedCourse ? Array.from(getForwardPath(selectedCourse.id)) : [];
        const connectedIds = [...new Set([...backwardIds, ...forwardIds])];

        // 🆕 FIX: حساب سلسلة المسار الحرج كاملة للفلتر
        const criticalChainIds = new Set();
        if (filterMode === 'critical') {
            courses.forEach(c => {
                if (getStatus(c) !== 'passed' && getCourseDepth(c.id) >= 2) {
                    getForwardPath(c.id).forEach(id => criticalChainIds.add(id));
                    getBackwardPath(c.id).forEach(id => criticalChainIds.add(id));
                }
            });
        }

        courses.forEach((course) => {
            const status = getStatus(course);
            const isHourLocked = status === 'locked' && isLockedByHours(course);
            const depth = getCourseDepth(course.id);
            const isCriticalPath = depth >= 2 && status !== 'passed';
            const unlocksCount = courses.filter(c => c.prerequisites?.some(p => p.id === course.id)).length;
            const isBottleneck = unlocksCount >= 3 && status !== 'passed';

            const isElective = course.type === 'elective';
            const isSupporting = course.type === 'supporting';
            const isUniversityReq = course.type === 'university_req';
            const hasDescription = course.description && course.description.trim() !== '';

            const themes = {
                passed: { bg: 'background:linear-gradient(135deg,#059669,#10b981)', border: 'border:1.5px solid rgba(16,185,129,0.8)', badgeBg: 'rgba(255,255,255,0.2)', textColor: '#fff', statusLabel: 'منجز', statusIcon: '✅' },
                cart: { bg: 'background:linear-gradient(135deg,#d97706,#f59e0b)', border: 'border:1.5px solid rgba(245,158,11,0.8)', badgeBg: 'rgba(255,255,255,0.2)', textColor: '#fff', statusLabel: 'تجريبي', statusIcon: '🛒' },
                available: { bg: 'background:linear-gradient(135deg,#4338ca,#6366f1)', border: 'border:1.5px solid rgba(99,102,241,0.8)', badgeBg: 'rgba(255,255,255,0.2)', textColor: '#fff', statusLabel: 'متاح', statusIcon: '🔓' },
                locked: { bg: 'background:#f8fafc', border: 'border:1.5px solid #cbd5e1', badgeBg: 'rgba(148,163,184,0.15)', textColor: '#64748b', statusLabel: 'مغلق', statusIcon: '🔒' },
            };
            const t = themes[status];
            const statusIcon = isHourLocked ? '⏳' : t.statusIcon;
            const statusLabel = isHourLocked ? `${course.minimum_passed_hours} ساعة` : t.statusLabel;

            let finalBorder = t.border;
            if (isElective || isUniversityReq) {
                if (status === 'locked') finalBorder = 'border: 2.5px dashed #94a3b8';
                else finalBorder = 'border: 2.5px dashed #ffffff';
            }

            let shapeStyle = 'border-radius:16px;';
            if (isSupporting) {
                shapeStyle = 'border-radius:50px;';
            } else if (isElective) {
                shapeStyle = 'border-radius:4px 24px 4px 24px;';
            } else if (isUniversityReq) {
                shapeStyle = 'border-radius:4px;';
            }

            let isFilteredOut = false;
            if (filterMode === 'available' && status !== 'available') isFilteredOut = true;
            // 🆕 FIX: فلتر المسار الحرج يستخدم السلسلة الكاملة بدل المادة لحالها
            if (filterMode === 'critical' && !criticalChainIds.has(course.id)) isFilteredOut = true;

            const isDimmed = isFilteredOut || (selectedCourse && !connectedIds.includes(course.id));
            const isSelected = selectedCourse?.id === course.id;
            const isBackward = backwardIds.includes(course.id) && !isSelected;
            const isForward = forwardIds.includes(course.id) && !isSelected;

            let ringStyle = '';
            if (isSelected) ringStyle = 'box-shadow:0 0 0 3px #fff,0 0 0 6px #4f46e5,0 12px 40px rgba(79,70,229,0.35);transform:scale(1.08);z-index:50;';
            else if (isBackward) ringStyle = 'box-shadow:0 0 0 2.5px #fbbf24,0 8px 24px rgba(245,158,11,0.25);';
            else if (isForward) ringStyle = 'box-shadow:0 0 0 2.5px #c084fc,0 8px 24px rgba(192,132,252,0.25);';
            else if (!isDimmed) ringStyle = 'box-shadow:0 4px 16px rgba(0,0,0,0.08);';

            const dimStyle = isDimmed ? 'opacity:0.25;filter:grayscale(1);' : '';

            let typeLabelHtml = '';
            if (isElective) typeLabelHtml = `<span style="font-size:7.5px;font-weight:900;padding:2px 5px;border-radius:4px;background:rgba(0,0,0,0.15);color:${t.textColor};">اختياري</span>`;
            if (isSupporting) typeLabelHtml = `<span style="font-size:7.5px;font-weight:900;padding:2px 5px;border-radius:4px;background:rgba(0,0,0,0.15);color:${t.textColor};">مساندة</span>`;
            if (isUniversityReq) typeLabelHtml = `<span style="font-size:7.5px;font-weight:900;padding:2px 5px;border-radius:4px;background:rgba(0,0,0,0.15);color:${t.textColor};">جامعة</span>`;

            const nodeHtml = `
                <div class="sn-node-hover" style="width:100%;height:100%;${shapeStyle}display:flex;flex-direction:column;position:relative;overflow:hidden;transition:all 0.3s ease-out;${t.bg};${finalBorder};${ringStyle}${dimStyle}cursor:pointer;box-shadow:${!isDimmed && !ringStyle.includes('box-shadow') ? '0 4px 12px rgba(0,0,0,0.06)' : ''};">
                    <div style="position:absolute;top:-12px;right:-12px;width:48px;height:48px;background:rgba(255,255,255,0.15);border-radius:50%;filter:blur(12px);"></div>
                    
                    <div style="padding:8px 10px;display:flex;flex-direction:column;height:100%;justify-content:space-between;position:relative;z-index:1;">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="font-size:8.5px;font-weight:800;padding:2px 7px;border-radius:6px;background:${t.badgeBg};color:${t.textColor};backdrop-filter:blur(4px);display:flex;align-items:center;gap:3px;letter-spacing:0.3px;">
                                ${statusIcon} ${statusLabel}
                                ${hasDescription ? '<span style="margin-right:3px; font-size:10px; animation: pulse 2s infinite;" title="يوجد لمحة عن المادة">📝</span>' : ''}
                            </span>
                            <div style="display:flex; gap:3px;">
                                ${typeLabelHtml}
                                <span style="font-size:8.5px;font-weight:800;padding:2px 7px;border-radius:6px;background:${t.badgeBg};color:${t.textColor};">${course.credit_hours} س</span>
                            </div>
                        </div>
                        <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:2px 4px;">
                            <h3 style="font-weight:900;font-size:${titleFontSize};color:${t.textColor};line-height:1.45;text-align:center;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;text-shadow:${status !== 'locked' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none'};">${course.name}</h3>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="font-size:8.5px;font-weight:800;font-family:monospace;text-transform:uppercase;padding:1px 6px;border-radius:5px;background:${t.badgeBg};color:${t.textColor};">${course.code}</span>
                            <span style="font-size:8.5px;font-weight:700;padding:1px 6px;border-radius:5px;background:${t.badgeBg};color:${t.textColor};">م ${course.semester || 1}</span>
                        </div>
                    </div>
                    ${isCriticalPath ? `<div style="position:absolute;top:-4px;left:-4px;width:22px;height:22px;background:#ef4444;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;box-shadow:0 2px 8px rgba(239,68,68,0.4);z-index:20;animation:bounce 1s infinite;" title="مسار حرج!">🚨</div>` : ''}
                    ${isBottleneck ? `<div style="position:absolute;top:-4px;right:-4px;width:22px;height:22px;background:#a855f7;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;box-shadow:0 2px 8px rgba(168,85,247,0.4);z-index:20;" title="مفصلية: تفتح ${unlocksCount} مواد">🔑</div>` : ''}
                </div>
            `;

            const rawPosition = nodePositions[course.id.toString()] || layoutSeedPositions.get(course.id.toString()) || { x: 0, y: 0 };
            const storedPosition = lockNodeToSemesterLevel(course.id.toString(), rawPosition);

            initialNodes.push({
                id: course.id.toString(),
                position: storedPosition,
                style: { padding: 0, border: 'none', background: 'transparent', width: nodeWidth, height: nodeHeight },
                data: {
                    label: <div dangerouslySetInnerHTML={{ __html: nodeHtml }} />,
                    semester: parseInt(course.semester) || 1,
                    code: course.code || ''
                },
                draggable: canEditTreePositions && positionEditMode,
                connectable: false,
            });

            if (course.prerequisites) {
                course.prerequisites.forEach((prereq) => {
                    const isSourceDone = passedIds.includes(prereq.id);
                    const isBackwardEdge = backwardIds.includes(prereq.id) && backwardIds.includes(course.id);
                    const isForwardEdge = forwardIds.includes(prereq.id) && forwardIds.includes(course.id);
                    const isActivePath = isBackwardEdge || isForwardEdge;

                    let edgeColor = isActivePath ? (isForwardEdge ? '#a855f7' : '#d97706') : (isSourceDone ? '#10b981' : '#cbd5e1');
                    let edgeWidth = isActivePath ? 3.5 : (isSourceDone ? 2.5 : 1.5);
                    let isAnimated = (isSourceDone && status !== 'passed') || isActivePath;
                    let edgeFilteredOut = false;
                    if (filterMode === 'available' && status !== 'available') edgeFilteredOut = true;
                    // 🆕 FIX: edges تستخدم نفس سلسلة الفلتر
                    if (filterMode === 'critical' && !criticalChainIds.has(course.id) && !criticalChainIds.has(prereq.id)) edgeFilteredOut = true;

                    initialEdges.push({
                        id: `e${prereq.id}-${course.id}`,
                        source: prereq.id.toString(),
                        target: course.id.toString(),
                        type: 'smoothstep',
                        animated: isAnimated,
                        style: {
                            stroke: edgeColor,
                            strokeWidth: edgeWidth,
                            opacity: (selectedCourse && !isActivePath) || edgeFilteredOut ? 0.08 : 1,
                            transition: 'all 0.5s ease',
                        },
                        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
                    });
                });
            }
        });

        return { initialNodes, initialEdges };
    }, [courses, passedIds, cartIds, selectedCourse, filterMode, getStatus, getCourseDepth, getBackwardPath, getForwardPath, nodeDimensions, isMobile, canEditTreePositions, positionEditMode, nodePositions, layoutSeedPositions, lockNodeToSemesterLevel]);

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        const { initialNodes, initialEdges } = buildGraph();
        setNodes(initialNodes);
        setEdges(initialEdges);
    }, [buildGraph]);

    const onNodeDrag = useCallback((event, node) => {
        if (!canEditTreePositions || !positionEditMode) return;

        const lockedPosition = lockNodeToSemesterLevel(node.id, node.position);
        if (Math.abs((node.position?.y ?? 0) - lockedPosition.y) < 0.5) return;

        setNodes((prev) => prev.map((currentNode) => {
            if (currentNode.id !== node.id) return currentNode;
            return {
                ...currentNode,
                position: {
                    ...currentNode.position,
                    y: lockedPosition.y,
                },
            };
        }));
    }, [canEditTreePositions, positionEditMode, lockNodeToSemesterLevel, setNodes]);

    // 🛡️ حدود الحركة — يمنع الطالب من الضياع بالفراغ الأبيض
    const translateExtent = useMemo(() => {
        const nodeWidth = nodeDimensions.width;
        const nodeHeight = nodeDimensions.height;
        if (!nodes || nodes.length === 0) return undefined;
        const PAD = 500; // هامش مريح حول الشجرة
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(n => {
            const x = n.position?.x ?? 0;
            const y = n.position?.y ?? 0;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x + nodeWidth > maxX) maxX = x + nodeWidth;
            if (y + nodeHeight > maxY) maxY = y + nodeHeight;
        });
        return [[minX - PAD, minY - PAD], [maxX + PAD, maxY + PAD]];
    }, [nodes, nodeDimensions]);

    const onPaneClick = useCallback(() => setSelectedCourse(null), []);

    const onNodeClick = useCallback((e, node) => {
        const course = courses.find(c => c.id === parseInt(node.id));
        setSelectedCourse(course);
        if (course) {
            const next = legacyPlanSemesterToYearTerm(course.semester || 1);
            setTargetYear(next.year);
            setTargetTerm(next.term);
            setTargetSemester(yearTermToSemester(next.year, next.term));
        }
        setActiveTab('details');
        if (window.innerWidth < 1024) setIsSidebarOpen(true);
    }, [courses, legacyPlanSemesterToYearTerm, yearTermToSemester]);

    const onNodeDragStop = useCallback((event, node) => {
        if (!canEditTreePositions || !positionEditMode) return;

        const lockedPosition = lockNodeToSemesterLevel(node.id, node.position);

        setNodePositions((prev) => ({
            ...prev,
            [node.id.toString()]: lockedPosition,
        }));

        setDraftNodePositions((prev) => ({
            ...prev,
            [node.id.toString()]: lockedPosition,
        }));

        setHasUnsavedNodeMoves(true);
    }, [canEditTreePositions, positionEditMode, lockNodeToSemesterLevel]);

    const handleTargetYearChange = (yearValue) => {
        const year = parseInt(yearValue, 10) || 1;
        setTargetYear(year);
        setTargetSemester(yearTermToSemester(year, targetTerm));
    };

    const handleTargetTermChange = (termValue) => {
        const parsed = parseInt(termValue, 10);
        const term = [1, 2, 3].includes(parsed) ? parsed : 1;
        setTargetTerm(term);
        setTargetSemester(yearTermToSemester(targetYear, term));
    };

    const applySuggestedStudySlot = () => {
        const year = suggestedStudySlot?.year || 1;
        const term = suggestedStudySlot?.term || 1;
        setTargetYear(year);
        setTargetTerm(term);
        setTargetSemester(yearTermToSemester(year, term));
    };

    // 🆕 FIX: منع إلغاء مادة إذا مواد بعدها منجزة
    const togglePassed = async (courseId) => {
        if (passedIds.includes(courseId)) {
            // نبحث عن مواد منجزة تعتمد على هالمادة كمتطلب سابق
            const dependentPassed = courses.filter(c =>
                passedIds.includes(c.id) &&
                c.id !== courseId &&
                c.prerequisites?.some(p => p.id === courseId)
            );

            if (dependentPassed.length > 0) {
                const names = dependentPassed.map(c => `• ${c.name}`).join('\n');
                Swal.fire({
                    icon: 'error',
                    title: 'لا يمكن إلغاء هذه المادة!',
                    html: `هذه المادة متطلب سابق لمواد <b>أنت ناجح فيها</b>:<br/><br/><div style="text-align:right;font-size:13px;line-height:2;">${dependentPassed.map(c => `<span style="display:inline-block;background:#f0fdf4;border:1px solid #bbf7d0;padding:2px 10px;border-radius:8px;margin:2px;font-weight:700;">✅ ${c.name}</span>`).join('')}</div><br/>لإلغائها، يجب إلغاء المواد اللاحقة أولاً.`,
                    ...swalTheme
                });
                return;
            }

            // لو مادة بالتسجيل التجريبي تعتمد عليها — نحذر بس نسمح
            const dependentInCart = courses.filter(c =>
                cartIds.includes(c.id) &&
                c.prerequisites?.some(p => p.id === courseId)
            );

            if (dependentInCart.length > 0) {
                const result = await Swal.fire({
                    icon: 'warning',
                    title: 'تنبيه!',
                    html: `إلغاء هذه المادة سيحذف هذه المواد من التسجيل التجريبي تلقائياً:<br/><br/><div style="text-align:right;font-size:13px;">${dependentInCart.map(c => `<span style="display:inline-block;background:#fef3c7;border:1px solid #fde68a;padding:2px 10px;border-radius:8px;margin:2px;font-weight:700;">🛒 ${c.name}</span>`).join('')}</div>`,
                    showCancelButton: true,
                    confirmButtonText: 'نعم، ألغِ الكل',
                    cancelButtonText: 'تراجع',
                    ...swalTheme
                });

                if (!result.isConfirmed) return;

                // حذف المواد المعتمدة من التسجيل التجريبي
                const idsToRemove = dependentInCart.map(c => c.id);
                const updatedCart = cartIds.filter(id => !idsToRemove.includes(id));
                setCartIds(updatedCart);
                syncCartWithDB(updatedCart);
            }
        }

        try {
            const response = await axios.post(route('tree.toggle'), {
                course_id: courseId,
                studied_year: targetYear,
                studied_term: targetTerm,
                studied_semester: targetSemester,
            });

            if (response.data.status === 'added') {
                setPassedIds(p => [...p, courseId]);
                const updatedCart = cartIds.filter(id => id !== courseId);
                setCartIds(updatedCart);
                syncCartWithDB(updatedCart);

                const addedCourse = courses.find(c => c.id === courseId);
                if (addedCourse) {
                    setLocalPassedCourses(prev => [...prev, {
                        ...addedCourse,
                        pivot: {
                            grade: null,
                            studied_semester: targetSemester,
                            studied_year: targetYear,
                            studied_term: targetTerm,
                        }
                    }]);
                }
                setActiveTab('semesters');

            } else if (response.data.status === 'removed') {
                setPassedIds(p => p.filter(id => id !== courseId));
                setLocalPassedCourses(prev => prev.filter(c => c.id !== courseId));
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'خطأ!',
                text: error.response?.data?.msg || error.response?.data?.message || 'حدث خطأ بالاتصال',
                ...swalTheme
            });
        }
    };

    // 🆕 FIX: فحص حد الساعات قبل الإضافة للتسجيل التجريبي
    const toggleCart = (course) => {
        let updatedCart;
        if (cartIds.includes(course.id)) {
            updatedCart = cartIds.filter(id => id !== course.id);
            setCartIds(updatedCart);
            setSmartMetaByCourseId((prev) => {
                const next = { ...prev };
                delete next[course.id];
                return next;
            });
            syncCartWithDB(updatedCart);
            return;
        }

        const requiredHours = Number(course?.minimum_passed_hours || 0);
        if (requiredHours > 0 && totalPassedCredits < requiredHours) {
            Swal.fire({
                icon: 'warning',
                title: 'المادة مغلقة حالياً',
                text: `تحتاج إنهاء ${requiredHours} ساعة معتمدة. الساعات الحالية: ${totalPassedCredits}.`,
                ...swalTheme
            });
            return;
        }

        const currentCartHours = courses
            .filter(c => cartIds.includes(c.id))
            .reduce((sum, c) => sum + (c.credit_hours || 0), 0);

        if (currentCartHours + course.credit_hours > 18) {
            Swal.fire({
                icon: 'error',
                title: 'تجاوزت الحد الأقصى!',
                html: `التسجيل التجريبي حالياً <b>${currentCartHours} ساعة</b>.<br/>إضافة <b>${course.name}</b> (${course.credit_hours} ساعات) ستتجاوز الحد الأقصى <b>18 ساعة</b>.<br/><br/>احذف مادة أولاً لتوفير مساحة.`,
                ...swalTheme
            });
            return;
        }

        if (course.prerequisites?.some(p => cartIds.includes(p.id))) {
            Swal.fire({
                icon: 'warning',
                title: 'تنبيه ذكي!',
                text: 'لا ينصح بإضافة المادة ومتطلبها في نفس الفصل الدراسي.',
                ...swalTheme
            });
            return;
        }

        updatedCart = [...cartIds, course.id];
        setCartIds(updatedCart);
        syncCartWithDB(updatedCart);
    };

    const executeSmartSchedule = () => {
        const paceConfig = {
            light: { targetDifficulty: 32, maxDifficulty: 52, maxHeavyCourses: 2, yearBias: -1 },
            balanced: { targetDifficulty: 52, maxDifficulty: 74, maxHeavyCourses: 3, yearBias: 0 },
            heavy: { targetDifficulty: 72, maxDifficulty: 100, maxHeavyCourses: 4, yearBias: 1 },
        };

        const pace = paceConfig[schedulePace] || paceConfig.balanced;

        const passedCredits = coursesWithDifficulty
            .filter((course) => passedIds.includes(course.id))
            .reduce((sum, course) => sum + (Number(course.credit_hours) || 0), 0);

        const currentAcademicYear = passedCredits < 33 ? 1 : passedCredits < 66 ? 2 : passedCredits < 99 ? 3 : 4;

        const childrenMap = new Map();
        coursesWithDifficulty.forEach((course) => {
            (course.prerequisites || []).forEach((prereq) => {
                const list = childrenMap.get(prereq.id) || [];
                list.push(course.id);
                childrenMap.set(prereq.id, list);
            });
        });

        const unlockCache = new Map();
        const unlockScore = (courseId, visited = new Set()) => {
            if (unlockCache.has(courseId)) return unlockCache.get(courseId);
            if (visited.has(courseId)) return 0;

            const nextVisited = new Set(visited);
            nextVisited.add(courseId);

            const children = childrenMap.get(courseId) || [];
            const score = children.reduce((sum, childId) => sum + 1 + unlockScore(childId, nextVisited), 0);

            unlockCache.set(courseId, score);
            return score;
        };

        let trulyAvailable = coursesWithDifficulty.filter(c => {
            if (passedIds.includes(c.id)) return false;
            if (isLockedByHours(c)) return false;
            if (!c.prerequisites || c.prerequisites.length === 0) return true;
            return c.prerequisites.every(p => passedIds.includes(p.id));
        });

        const scored = trulyAvailable.map((course) => {
            const unlock = unlockScore(course.id);
            const isMajor = course.major_id !== null;
            const isCompulsory = course.type === 'compulsory';
            const difficulty = Number(course.difficulty_score || 0);
            const isHeavy = difficulty >= 65 || Number(course.fail_rate || 0) >= 30;
            const yearGap = Number(course.recommended_year || 1) - currentAcademicYear;
            const difficultyFit = Math.max(0, 100 - Math.abs(difficulty - pace.targetDifficulty) * 1.7);
            const dataConfidence = Math.min(100, 42 + (Number(course.graded_attempts || 0) * 7));

            let yearFit = 0;
            if (pace.yearBias === -1) {
                yearFit = yearGap <= 0 ? 18 : Math.max(-28, -9 * yearGap);
            } else if (pace.yearBias === 0) {
                yearFit = Math.max(-22, 18 - Math.abs(yearGap) * 10);
            } else {
                yearFit = yearGap >= 0 ? 14 : Math.max(-24, yearGap * 12);
            }

            let score = unlock * 5 + difficultyFit + yearFit + (difficulty <= pace.maxDifficulty ? 12 : -42);

            if (smartFocus === 'major') {
                score += isMajor ? 10 : -5;
            } else if (smartFocus === 'graduation') {
                score += (unlock * 4) + (isCompulsory ? 5 : 0) + (yearGap <= 1 ? 6 : -6);
            } else if (smartFocus === 'gpa') {
                score += Number(course.avg_grade || 0) >= 75 ? 9 : -9;
                score += Number(course.fail_rate || 0) <= 20 ? 7 : -11;
                score += difficulty < 55 ? 5 : -8;
            }

            if (smartProtectGpa) {
                score += Number(course.fail_rate || 0) > 35 ? -18 : 4;
            }

            return { course, score, isHeavy, difficulty, unlock, yearGap, difficultyFit, dataConfidence };
        }).sort((a, b) => b.score - a.score);

        let newCart = [];
        let currentHours = 0;
        let heavyCount = 0;
        const selectedMeta = {};

        const addCourse = (entry) => {
            const { course, isHeavy, difficulty, unlock, yearGap, difficultyFit, dataConfidence } = entry;
            if (currentHours + course.credit_hours <= targetHours && !newCart.includes(course.id)) {
                if (schedulePace === 'light' && difficulty > 58) return false;
                if (schedulePace === 'balanced' && difficulty > 85) return false;
                if (smartProtectGpa && isHeavy && heavyCount >= pace.maxHeavyCourses) return false;

                const confidence = Math.max(
                    0,
                    Math.min(
                        100,
                        Number((
                            (difficultyFit * 0.34)
                            + ((100 - Math.min(Math.abs(yearGap) * 22, 100)) * 0.26)
                            + (Math.min(unlock * 18, 100) * 0.24)
                            + (dataConfidence * 0.16)
                        ).toFixed(1)),
                    ),
                );

                selectedMeta[course.id] = {
                    confidence,
                    dataConfidence,
                    reasons: [
                        `يفتح ${unlock} مواد`,
                        `صعوبة ${Math.round(difficulty)}%`,
                        `سنة ${course.recommended_year}`,
                    ],
                };

                newCart.push(course.id);
                currentHours += course.credit_hours;
                if (isHeavy) heavyCount += 1;
                return true;
            }
            return false;
        };

        scored.forEach((entry) => addCourse(entry));

        const avgDifficulty = newCart.length
            ? (newCart.reduce((sum, courseId) => sum + Number(coursesWithDifficulty.find((course) => course.id === courseId)?.difficulty_score || 0), 0) / newCart.length)
            : 0;

        if (newCart.length > 0) {
            setCartIds(newCart);
            setSmartMetaByCourseId(selectedMeta);
            syncCartWithDB(newCart);
            setShowAiSettings(false);
            const avgConfidence = Object.values(selectedMeta).length
                ? Object.values(selectedMeta).reduce((sum, item) => sum + Number(item.confidence || 0), 0) / Object.values(selectedMeta).length
                : 0;

            Swal.fire({ icon: 'success', title: 'تم التخطيط!', text: `تم اقتراح جدول بقيمة ${currentHours} ساعة وبمتوسط صعوبة ${avgDifficulty.toFixed(1)}% وثقة ${avgConfidence.toFixed(1)}%.`, ...swalTheme });
        } else {
            Swal.fire({ icon: 'info', title: 'لا يوجد مواد', text: 'لا يوجد مواد متاحة حالياً. تأكد من إنجاز متطالباتك.', ...swalTheme });
        }
    };

    const totalCartCredits = useMemo(() => courses.filter(c => cartIds.includes(c.id)).reduce((acc, c) => acc + (c.credit_hours || 0), 0), [courses, cartIds]);
    const progressPct = useMemo(() => Math.min(Math.round((totalPassedCredits / 132) * 100), 100), [totalPassedCredits]);

    const processedCourses = useMemo(() => {
        const coursesArray = Array.isArray(localPassedCourses) ? localPassedCourses : [];
        return coursesArray.map(c => {
            let year = c?.pivot?.studied_year;
            let term = c?.pivot?.studied_term;

            if (!year || !term) {
                const sem = c?.pivot?.studied_semester || c?.semester || 1;
                const legacy = legacyPlanSemesterToYearTerm(sem);
                year = legacy.year;
                term = legacy.term;
            }

            const safeYear = Math.min(6, Math.max(1, parseInt(year, 10) || 1));
            const parsedTerm = parseInt(term, 10);
            const safeTerm = [1, 2, 3].includes(parsedTerm) ? parsedTerm : 1;
            const tabKey = `${safeYear}-${safeTerm}`;

            return {
                ...c,
                localYear: safeYear,
                localTerm: safeTerm,
                tabKey,
            };
        });
    }, [localPassedCourses, legacyPlanSemesterToYearTerm]);

    const semesterRecord = useMemo(() => {
        const grouped = {};
        processedCourses.forEach(course => {
            const key = course.tabKey;
            if (!grouped[key]) {
                grouped[key] = {
                    year: course.localYear,
                    term: course.localTerm,
                    courses: [],
                    totalHours: 0,
                };
            }
            grouped[key].courses.push(course);
            grouped[key].totalHours += course.credit_hours || 0;
        });
        const sortedKeys = Object.keys(grouped).sort((a, b) => {
            const aItem = grouped[a];
            const bItem = grouped[b];
            if (aItem.year !== bItem.year) return aItem.year - bItem.year;
            return aItem.term - bItem.term;
        });
        return { grouped, sortedKeys };
    }, [processedCourses]);

    const [activeSemesterTab, setActiveSemesterTab] = useState('all');

    const recordDisplayedCourses = useMemo(() => {
        if (!processedCourses || processedCourses.length === 0) return [];
        if (activeSemesterTab === 'all') return processedCourses;
        return processedCourses.filter(c => c.tabKey === activeSemesterTab);
    }, [processedCourses, activeSemesterTab]);

    const getBadgeColor = (grade) => {
        if (grade === null || grade === undefined) return 'bg-slate-100 text-slate-500 border-slate-200';
        const val = parseFloat(grade);
        if (isNaN(val)) return 'bg-slate-100 text-slate-500 border-slate-200';
        if (val >= 84) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        if (val >= 76) return 'bg-blue-100 text-blue-700 border-blue-200';
        if (val >= 68) return 'bg-indigo-100 text-indigo-700 border-indigo-200';
        if (val >= 60) return 'bg-amber-100 text-amber-700 border-amber-200';
        return 'bg-rose-100 text-rose-700 border-rose-200';
    };

    const workloadAnalysis = useMemo(() => {
        if (totalCartCredits === 0) return null;
        const cartCourses = coursesWithDifficulty.filter(c => cartIds.includes(c.id));
        const heavyCount = cartCourses.filter(c => Number(c.difficulty_score || 0) >= 65 || Number(c.fail_rate || 0) >= 30).length;
        const avgDifficulty = cartCourses.length
            ? cartCourses.reduce((sum, c) => sum + Number(c.difficulty_score || 0), 0) / cartCourses.length
            : 0;

        if (totalCartCredits > 18) return { msg: '🚨 تجاوزت الحد الأقصى للساعات!', cls: 'bg-rose-50 text-rose-700 border-rose-200' };
        if (schedulePace === 'light' && avgDifficulty > 55) return { msg: '⚠️ هذا أعلى من مستوى الخفيف. خفف مواد الصعوبة العالية.', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
        if (schedulePace === 'heavy' && avgDifficulty < 50) return { msg: '💡 النمط مكثف لكن الصعوبة الفعلية منخفضة حالياً.', cls: 'bg-sky-50 text-sky-700 border-sky-200' };
        if (heavyCount >= 4) return { msg: '⚖️ العبء مرتفع جداً بناءً على صعوبة المواد الفعلية.', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
        if (totalCartCredits < 12) return { msg: '🐌 عبء منخفض. توقع تأخر بالتخرج.', cls: 'bg-slate-50 text-slate-600 border-slate-200' };
        return { msg: `✨ جدول متوازن ومثالي بمتوسط صعوبة ${avgDifficulty.toFixed(1)}%.`, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }, [cartIds, coursesWithDifficulty, totalCartCredits, schedulePace]);

    const render4YearPlan = () => {
        let simulatedPassed = new Set(passedIds);
        let remainingCourses = courses.filter(c => !simulatedPassed.has(c.id));
        let generatedSemesters = [];
        let currentSem = 1;

        while (remainingCourses.length > 0 && currentSem <= 12) {
            const simulatedPassedHours = courses
                .filter(c => simulatedPassed.has(c.id))
                .reduce((sum, c) => sum + Number(c.credit_hours || 0), 0);

            let availableNow = remainingCourses.filter(c => {
                const requiredHours = Number(c.minimum_passed_hours || 0);
                if (requiredHours > 0 && simulatedPassedHours < requiredHours) return false;
                if (!c.prerequisites || c.prerequisites.length === 0) return true;
                return c.prerequisites.every(p => simulatedPassed.has(p.id));
            });
            if (availableNow.length === 0) break;
            availableNow.sort((a, b) => getCourseDepth(b.id) - getCourseDepth(a.id));

            let semCourses = [];
            let semHours = 0;
            for (let c of availableNow) {
                if (semHours + c.credit_hours <= 18) {
                    semCourses.push(c);
                    semHours += c.credit_hours;
                    remainingCourses = remainingCourses.filter(rc => rc.id !== c.id);
                }
            }
            semCourses.forEach(c => simulatedPassed.add(c.id));
            generatedSemesters.push(semCourses);
            currentSem++;
        }
        if (remainingCourses.length > 0) generatedSemesters.push(remainingCourses);

        return (
            <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[100] flex items-center justify-center p-3 sm:p-6">
                <div className="bg-white w-full max-w-6xl h-[88vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden" style={{ animation: 'sn-scale 0.35s cubic-bezier(0.16,1,0.3,1) both' }}>
                    <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 p-5 sm:p-6 flex justify-between items-center shrink-0 relative overflow-hidden">
                        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle,#fff 0.8px,transparent 0.8px)', backgroundSize: '16px 16px' }} />
                        <div className="text-white relative z-10">
                            <h2 className="text-xl sm:text-2xl font-[900] mb-1 flex items-center gap-2.5">
                                <span className="w-9 h-9 bg-indigo-500/20 rounded-lg flex items-center justify-center text-lg">🤖</span>
                                خطة التخرج التنبؤية
                            </h2>
                            <p className="text-sm text-indigo-300/60 font-bold">توزيع ذكي للمواد المتبقية على فصولك القادمة</p>
                        </div>
                        <button onClick={() => setShow4YearPlan(false)} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center text-white transition-all text-lg relative z-10 active:scale-90">✕</button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#f8fafc]">
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                            {generatedSemesters.map((semCourses, i) => {
                                const semHours = semCourses.reduce((sum, c) => sum + c.credit_hours, 0);
                                return (
                                    <div key={i} className="bg-white border border-slate-200/80 rounded-[1.25rem] p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col" style={{ animationDelay: `${i * 50}ms` }}>
                                        <div className="bg-gradient-to-l from-indigo-50 to-slate-50 text-indigo-800 text-center py-2.5 rounded-xl mb-3.5 font-[800] text-[13px] border border-indigo-100/60 flex justify-between px-3.5 items-center">
                                            <span className="flex items-center gap-1.5">📅 الفصل +{i + 1}</span>
                                            <span className="bg-white px-2 py-0.5 rounded-md text-[10px] font-[800] text-indigo-600 border border-indigo-100">{semHours} ساعة</span>
                                        </div>
                                        <div className="space-y-1.5 flex-1">
                                            {semCourses.map(c => (
                                                <div key={c.id} className="text-[11px] bg-slate-50/80 border border-slate-100 hover:border-indigo-200 p-2.5 rounded-xl flex justify-between items-center font-bold text-slate-700 transition-colors group">
                                                    <span className="truncate flex-1 ml-2" title={c.name}>{c.name}</span>
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-[800] shrink-0 ${c.type === 'compulsory' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>{c.credit_hours}س</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="p-4 bg-white border-t border-slate-100 text-center shrink-0">
                        <button onClick={() => setShow4YearPlan(false)} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-[800] shadow-xl hover:bg-indigo-600 active:scale-95 transition-all flex items-center gap-2 mx-auto text-sm">
                            ✅ اعتماد والعودة للشجرة
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className={`w-full flex flex-col overflow-hidden font-t ${isDark ? 'bg-[#0a0f18]' : 'bg-[#fafcff]'}`} dir={lang === 'ar' ? 'rtl' : 'ltr'} style={{ height: 'calc(100vh - 80px)' }}>
            <Head>
                <title>{lang === 'ar' ? 'الخطة الشجرية الذكية | سنفور' : 'Smart Course Tree | Sanfoor'}</title>
                <meta name="description" content={lang === 'ar' ? 'استعرض خطتك الشجرية، تتبع المتطلبات السابقة، وخطط تسجيل المواد بشكل ذكي داخل حسابك.' : 'Visualize your study tree, track prerequisites, and plan your courses smartly inside your account.'} />
                <meta name="robots" content="noindex,nofollow,noarchive" />
                <link rel="canonical" href={`${siteUrl}/tree`} />
            </Head>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes sn-scale { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
                @keyframes sn-slide-r { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
                @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
                @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.15); } }
                .sn-card-enter { animation: sn-slide-r 0.35s cubic-bezier(0.16,1,0.3,1) both; }
                @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-slideDown { opacity: 0; animation: slideDown 0.4s ease-out forwards; }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .react-flow__edge-updater { display: none !important; }
                .sn-node-hover { cursor: pointer; }
                @media (hover: hover) and (pointer: fine) {
                    .sn-node-hover:hover { transform: scale(1.05) !important; box-shadow: 0 12px 32px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08) !important; z-index: 40; }
                }
            ` }} />

            {/* ═══ HEADER ═══ */}
            <div className="bg-white/90 backdrop-blur-xl border-b border-slate-200/60 px-4 md:px-6 py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] z-20 relative space-y-3">
                <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.35)] backdrop-blur-xl">
                    <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-200/35 blur-3xl" />
                    <div className="absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-indigo-200/35 blur-3xl" />

                    <div className="relative z-10 p-4 sm:p-6">
                        <div className="text-center max-w-2xl mx-auto">
                            <h1 className="text-4xl md:text-5xl font-[900] text-slate-900 tracking-tight">الخطة الشجرية</h1>
                        </div>
                    </div>
                </section>

                <div className="flex justify-between items-center gap-3">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden w-10 h-10 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 transition-colors active:scale-90 shadow-sm">
                            {isSidebarOpen ? '✕' : '☰'}
                        </button>

                        <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 font-i flex items-center gap-1.5">
                            <span>{major_name && `${major_name} • `}{student_name}</span>
                            <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-black text-indigo-700">
                                خطة {study_plan_version}
                            </span>
                        </p>
                    </div>

                    {/* 🆕 Header مع Mini Stats */}
                    <div className="hidden md:flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-[800] bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg border border-indigo-100 flex items-center gap-1.5">🔓 {miniStats.availableCount} متاحة</span>
                            {miniStats.criticalCount > 0 && (
                                <span className="text-[10px] font-[800] bg-rose-50 text-rose-600 px-2.5 py-1 rounded-lg border border-rose-100 flex items-center gap-1.5 animate-pulse">🚨 {miniStats.criticalCount} حرجة</span>
                            )}
                        </div>
                        <div className="flex flex-col items-end w-56">
                            <div className="flex justify-between w-full mb-1.5 items-center">
                                <span className="text-[10px] font-[800] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">نسبة الإنجاز</span>
                                <span className="text-[10px] font-bold text-slate-400 font-i">{totalPassedCredits} / 132 ساعة</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-l from-emerald-400 to-emerald-500 rounded-full transition-all duration-[1500ms] ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ width: `${progressPct}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex w-full h-full relative overflow-hidden">
                {show4YearPlan && render4YearPlan()}
                {isSidebarOpen && (<div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />)}

                {/* ═══ SIDEBAR ═══ */}
                <div className={`
                    absolute lg:relative bg-slate-900/70 backdrop-blur-[16px] backdrop-saturate-[180%] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-50 lg:z-10 flex flex-col overflow-hidden transition-transform duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)]
                    ${isMobile
                        ? `bottom-0 left-0 right-0 h-[78%] rounded-t-[1.5rem] border-b-0 border-l-0 border-r-0 ${isSidebarOpen ? 'translate-y-0' : 'translate-y-full'}`
                        : `top-0 right-0 h-full w-[92%] sm:w-[400px] lg:min-w-[420px] lg:max-w-[420px] rounded-none lg:rounded-r-3xl ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`
                    }
                `}>

                    <div className="flex p-2.5 gap-2 bg-white/5 border-b border-white/10 shrink-0">
                        <button onClick={() => setActiveTab('details')} className={`flex-1 py-2.5 rounded-xl text-[12px] font-[800] transition-all flex items-center justify-center gap-1.5 ${activeTab === 'details' ? 'bg-white/15 text-white shadow-sm border border-white/20' : 'text-white/40 hover:bg-white/10'}`}>📖 التفاصيل</button>
                        <button onClick={() => setActiveTab('simulator')} className={`flex-1 py-2.5 rounded-xl text-[12px] font-[800] transition-all flex items-center justify-center gap-1.5 relative ${activeTab === 'simulator' ? 'bg-indigo-500/30 text-white shadow-md shadow-indigo-500/15 border border-indigo-400/30' : 'text-white/40 hover:bg-white/10'}`}>
                            🪄 التخطيط
                            {cartIds.length > 0 && (<span className="bg-amber-400 text-amber-900 w-5 h-5 rounded-md text-[10px] flex items-center justify-center font-[900] mr-0.5">{cartIds.length}</span>)}
                        </button>
                        <button onClick={() => setActiveTab('semesters')} className={`flex-1 py-2.5 rounded-xl text-[12px] font-[800] transition-all flex items-center justify-center gap-1.5 ${activeTab === 'semesters' ? 'bg-white/15 text-white shadow-sm border border-white/20' : 'text-white/40 hover:bg-white/10'}`}>📚 الفصول</button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 pb-24 hide-scrollbar">

                        {/* ═══ DETAILS TAB ═══ */}
                        {activeTab === 'details' && (
                            selectedCourse ? (
                                <motion.div
                                    key={selectedCourse.id}
                                    className="space-y-5"
                                    style={{ zIndex: 50 }}
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                                >
                                    {/* Course Header */}
                                    <div className="bg-white/10 backdrop-blur-md p-5 rounded-[1.25rem] border border-white/15 shadow-lg relative overflow-hidden">
                                        <div className="absolute -top-8 -right-8 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl" />
                                        {/* Close Button */}
                                        <button onClick={() => setSelectedCourse(null)} className="absolute top-3 left-3 w-7 h-7 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center text-white/60 hover:text-white text-xs transition-all z-20 backdrop-blur-sm border border-white/10">✕</button>
                                        <div className="relative z-10">
                                            <div className="flex justify-between items-start mb-3.5">
                                                <div className="flex gap-2">
                                                    <span className="bg-white/15 text-white/90 px-2.5 py-1 rounded-lg font-mono text-[11px] font-[800] border border-white/10 shadow-sm backdrop-blur-sm">{selectedCourse.code}</span>
                                                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-[800] border backdrop-blur-sm ${selectedCourse.type === 'compulsory' ? 'bg-indigo-500/20 text-indigo-200 border-indigo-400/20' : selectedCourse.type === 'elective' ? 'bg-amber-500/20 text-amber-200 border-amber-400/20' : selectedCourse.type === 'supporting' ? 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/20' : 'bg-cyan-500/20 text-cyan-200 border-cyan-400/20'}`}>
                                                        {selectedCourse.type === 'compulsory' ? 'إجباري' : selectedCourse.type === 'elective' ? 'اختياري' : selectedCourse.type === 'supporting' ? 'مساندة' : 'متطلب جامعة'}
                                                    </span>
                                                </div>
                                                <span className="text-white/60 font-[800] text-[11px] bg-white/10 px-2.5 py-1 rounded-lg border border-white/10">{selectedCourse.credit_hours} ساعات</span>
                                            </div>
                                            <h2 className="text-xl font-[900] text-white leading-tight">{selectedCourse.name}</h2>
                                            <p className="text-[11px] text-white/40 font-bold mt-1.5 font-i">المستوى الافتراضي: {selectedCourse.semester || 1}</p>
                                        </div>
                                    </div>

                                    {/* 🆕 نقاط الأولوية + التأثير + العمق */}
                                    {getStatus(selectedCourse) !== 'passed' && (
                                        <div className="grid grid-cols-3 gap-2.5">
                                            <div className="bg-indigo-500/15 border border-indigo-400/20 rounded-xl p-3 text-center backdrop-blur-sm">
                                                <p className="text-[8px] font-[800] text-indigo-300 uppercase mb-1">الأولوية</p>
                                                <p className={`text-2xl font-[900] leading-none ${getCoursePriority(selectedCourse) >= 70 ? 'text-rose-400' : getCoursePriority(selectedCourse) >= 40 ? 'text-amber-400' : 'text-indigo-300'}`}>{getCoursePriority(selectedCourse)}%</p>
                                                <p className="text-[8px] text-white/30 font-bold mt-0.5">نسبة أولوية</p>
                                            </div>
                                            <div className="bg-violet-500/15 border border-violet-400/20 rounded-xl p-3 text-center backdrop-blur-sm">
                                                <p className="text-[8px] font-[800] text-violet-300 uppercase mb-1">التأثير</p>
                                                <p className="text-2xl font-[900] text-violet-300 leading-none">{getTotalImpact(selectedCourse.id)}</p>
                                                <p className="text-[8px] text-white/30 font-bold mt-0.5">مادة تتأثر</p>
                                            </div>
                                            <div className="bg-cyan-500/15 border border-cyan-400/20 rounded-xl p-3 text-center backdrop-blur-sm">
                                                <p className="text-[8px] font-[800] text-cyan-300 uppercase mb-1">العمق</p>
                                                <p className="text-2xl font-[900] text-cyan-300 leading-none">{getCourseDepth(selectedCourse.id)}</p>
                                                <p className="text-[8px] text-white/30 font-bold mt-0.5">مستويات</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* 🆕 بطاقات تحليل سنفور */}
                                    {getCourseInsights(selectedCourse).length > 0 && (
                                        <div className="space-y-2.5">
                                            <p className="text-[11px] font-[800] text-white/50 flex items-center gap-1.5">🧠 تحليل سنفور:</p>
                                            {getCourseInsights(selectedCourse).map((ins, i) => (
                                                <div key={i} className={`bg-${ins.color}-50 border border-${ins.color}-200 p-3.5 rounded-xl flex gap-3 items-start shadow-sm`} style={{ animationDelay: `${i * 80}ms`, animation: 'sn-slide-r 0.3s cubic-bezier(0.16,1,0.3,1) both' }}>
                                                    <span className="text-lg mt-0.5 shrink-0">{ins.icon}</span>
                                                    <div>
                                                        <h4 className={`text-${ins.color}-800 font-[800] text-[12px]`}>{ins.title}</h4>
                                                        <p className={`text-${ins.color}-600 text-[10.5px] font-bold mt-0.5 leading-relaxed`}>{ins.desc}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Description */}
                                    {selectedCourse.description && selectedCourse.description.trim() !== '' && (
                                        <div className="bg-amber-500/10 border border-amber-400/20 p-4 rounded-[1.25rem] relative overflow-hidden shadow-sm backdrop-blur-sm">
                                            <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-amber-400/60 to-orange-400/60"></div>
                                            <h4 className="text-amber-200 font-[900] text-[12px] flex items-center gap-2 mb-2"><span>💡</span> لمحة عن المادة:</h4>
                                            <p className="text-[11.5px] font-bold text-amber-100/70 leading-relaxed whitespace-pre-wrap pl-1">{selectedCourse.description}</p>
                                        </div>
                                    )}

                                    {/* Unlocks */}
                                    {getUnlocksDetailed(selectedCourse.id).length > 0 && (
                                        <div className="bg-white/5 border border-white/10 p-4 rounded-[1.25rem] backdrop-blur-sm">
                                            <h4 className="text-white/70 font-[800] text-[12px] flex items-center gap-2 mb-2.5">🚀 تفتح هذه المواد:</h4>
                                            <div className="flex flex-wrap gap-1.5">
                                                {getUnlocksDetailed(selectedCourse.id).map(u => (
                                                    <span key={u.id} className={`text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-sm border ${passedIds.includes(u.id) ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20 line-through opacity-60' : 'bg-white/10 text-white/80 border-white/10'}`}>{u.name}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Critical Path Warning */}
                                    {getCourseDepth(selectedCourse.id) >= 2 && getStatus(selectedCourse) !== 'passed' && (
                                        <div className="bg-rose-500/15 border border-rose-400/20 p-3.5 rounded-xl flex gap-3 items-start backdrop-blur-sm">
                                            <span className="text-xl mt-0.5">🚨</span>
                                            <div>
                                                <h4 className="text-rose-200 font-[800] text-[13px]">مادة مسار حرج!</h4>
                                                <p className="text-rose-300/70 text-[11px] font-bold mt-0.5 font-i">تأجيلها قد يؤخر تخرجك فصلاً كاملاً.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Locked */}
                                    {getStatus(selectedCourse) === 'locked' && (() => {
                                        const hoursLockMessage = getHoursLockMessage(selectedCourse);
                                        const pathSteps = getShortestPathToUnlock(selectedCourse.id);
                                        const availableSteps = pathSteps.filter(s => s.isAvailableNow);
                                        const futureSteps = pathSteps.filter(s => !s.isAvailableNow);
                                        const totalSteps = pathSteps.length;
                                        const completedPrereqs = selectedCourse.prerequisites.filter(p => passedIds.includes(p.id)).length;
                                        const totalPrereqs = selectedCourse.prerequisites.length;

                                        return (
                                            <div className="space-y-4">
                                                {hoursLockMessage && (
                                                    <div className="bg-amber-500/15 border border-amber-400/30 p-3.5 rounded-xl flex gap-3 items-start backdrop-blur-sm">
                                                        <span className="text-xl mt-0.5">⏳</span>
                                                        <div>
                                                            <h4 className="text-amber-200 font-[800] text-[13px]">شرط ساعات قبل التسجيل</h4>
                                                            <p className="text-amber-300/80 text-[11px] font-bold mt-0.5 font-i">{hoursLockMessage}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* المتطلبات المباشرة (الأصلي محسّن) */}
                                                <div className="bg-white/5 border border-white/10 p-4 rounded-[1.25rem] backdrop-blur-sm">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <p className="text-white/70 font-[800] text-[13px] flex items-center gap-2">🔒 المتطلبات المباشرة:</p>
                                                        <span className="text-[10px] font-[800] bg-white/10 text-white/60 px-2 py-0.5 rounded-lg">{completedPrereqs}/{totalPrereqs}</span>
                                                    </div>
                                                    {/* شريط تقدم المتطلبات */}
                                                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
                                                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${totalPrereqs > 0 ? (completedPrereqs / totalPrereqs) * 100 : 0}%` }} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        {selectedCourse.prerequisites.map(p => (
                                                            <div key={p.id} className={`flex justify-between items-center text-[11px] font-bold p-2.5 rounded-xl border transition-all ${passedIds.includes(p.id) ? 'bg-emerald-500/15 border-emerald-400/20 text-emerald-300' : cartIds.includes(p.id) ? 'bg-amber-500/15 border-amber-400/20 text-amber-300' : getStatus(courses.find(c => c.id === p.id)) === 'available' ? 'bg-indigo-500/15 border-indigo-400/20 text-indigo-300' : 'bg-white/5 border-rose-400/20 text-rose-300'}`}>
                                                                <span className="flex items-center gap-2">
                                                                    {passedIds.includes(p.id) ? '✅' : cartIds.includes(p.id) ? '🛒' : getStatus(courses.find(c => c.id === p.id)) === 'available' ? '🔓' : '🔒'}
                                                                    {p.name}
                                                                </span>
                                                                <span className="font-[800] text-[10px]">
                                                                    {passedIds.includes(p.id) ? 'منجز' : cartIds.includes(p.id) ? 'بالتسجيل التجريبي' : getStatus(courses.find(c => c.id === p.id)) === 'available' ? 'متاح الآن!' : 'مقفل'}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* 🆕 خارطة الطريق — أقصر مسار لفتح المادة */}
                                                {pathSteps.length > 0 && (
                                                    <div className="bg-indigo-500/10 border border-indigo-400/20 p-4 rounded-[1.25rem] relative overflow-hidden backdrop-blur-sm">
                                                        <div className="absolute -top-6 -left-6 w-20 h-20 bg-indigo-500/10 rounded-full blur-2xl opacity-40" />
                                                        <div className="relative z-10">
                                                            <div className="flex justify-between items-center mb-3">
                                                                <h4 className="text-indigo-200 font-[900] text-[12px] flex items-center gap-2">
                                                                    🗺️ خارطة الطريق لفتح المادة:
                                                                </h4>
                                                                <span className="text-[9px] font-[800] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-lg border border-indigo-400/20">
                                                                    {totalSteps} {totalSteps === 1 ? 'خطوة' : totalSteps === 2 ? 'خطوتين' : 'خطوات'}
                                                                </span>
                                                            </div>

                                                            <div className="space-y-0">
                                                                {/* الخطوات المتاحة الآن */}
                                                                {availableSteps.length > 0 && (
                                                                    <div className="mb-2">
                                                                        <p className="text-[9px] font-[800] text-emerald-400 mb-1.5 flex items-center gap-1">✨ ابدأ بهذه الآن:</p>
                                                                        {availableSteps.map((step, i) => (
                                                                            <div key={step.id} className="flex items-start gap-2.5 mb-2">
                                                                                <div className="flex flex-col items-center">
                                                                                    <div className="w-7 h-7 rounded-lg bg-emerald-500/80 text-white flex items-center justify-center text-[11px] font-[900] shadow-md shadow-emerald-500/20">{i + 1}</div>
                                                                                    {(i < availableSteps.length - 1 || futureSteps.length > 0) && <div className="w-0.5 h-4 bg-emerald-500/30 mt-0.5" />}
                                                                                </div>
                                                                                <div className="flex-1 bg-white/10 border border-emerald-400/20 rounded-xl p-2.5 shadow-sm backdrop-blur-sm">
                                                                                    <div className="flex justify-between items-center">
                                                                                        <span className="text-[11px] font-[800] text-emerald-200">{step.name}</span>
                                                                                        <div className="flex items-center gap-1.5">
                                                                                            <span className="text-[9px] font-mono text-white/30">{step.code}</span>
                                                                                            <span className="text-[9px] font-[800] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">{step.status === 'cart' ? '🛒 بالتسجيل التجريبي' : '🔓 متاح'}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                    {step.status === 'available' && (
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                const c = courses.find(c => c.id === step.id);
                                                                                                if (c) toggleCart(c);
                                                                                            }}
                                                                                            className="mt-1.5 w-full bg-emerald-500/15 hover:bg-emerald-500/80 hover:text-white text-emerald-300 border border-emerald-400/20 py-1.5 rounded-lg text-[10px] font-[800] transition-all active:scale-95"
                                                                                        >
                                                                                            🛒 أضف للتسجيل التجريبي
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* الخطوات المستقبلية */}
                                                                {futureSteps.length > 0 && (
                                                                    <div>
                                                                        <p className="text-[9px] font-[800] text-white/30 mb-1.5 flex items-center gap-1">🔮 بعدها تنفتح:</p>
                                                                        {futureSteps.map((step, i) => (
                                                                            <div key={step.id} className="flex items-start gap-2.5 mb-2">
                                                                                <div className="flex flex-col items-center">
                                                                                    <div className="w-7 h-7 rounded-lg bg-white/10 text-white/40 flex items-center justify-center text-[11px] font-[900]">{availableSteps.length + i + 1}</div>
                                                                                    {i < futureSteps.length - 1 && <div className="w-0.5 h-4 bg-white/10 mt-0.5" />}
                                                                                </div>
                                                                                <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-2.5">
                                                                                    <div className="flex justify-between items-center">
                                                                                        <span className="text-[11px] font-[800] text-white/40">{step.name}</span>
                                                                                        <span className="text-[9px] font-mono text-white/20">{step.code}</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* الهدف النهائي */}
                                                                <div className="flex items-start gap-2.5 mt-1">
                                                                    <div className="w-7 h-7 rounded-lg bg-indigo-500/80 text-white flex items-center justify-center text-[11px] font-[900] shadow-md shadow-indigo-500/20">🎯</div>
                                                                    <div className="flex-1 bg-indigo-500/15 border border-indigo-400/20 rounded-xl p-2.5">
                                                                        <span className="text-[11px] font-[900] text-indigo-200">{selectedCourse.name}</span>
                                                                        <span className="text-[9px] text-indigo-400 font-bold mr-2">← تنفتح!</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Actions */}
                                    <div className="space-y-2.5 pt-1">
                                        {getStatus(selectedCourse) === 'available' && (
                                            <div className="bg-emerald-500/10 border border-emerald-400/20 p-3 rounded-xl mb-3 shadow-sm backdrop-blur-sm space-y-2.5">
                                                <span className="text-[12px] font-[800] text-emerald-300 flex items-center gap-2">📅 تحديد الإنجاز حسب السنة والفصل:</span>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-[10px] font-bold text-emerald-100/80 mb-1 block">السنة الدراسية</label>
                                                        <select
                                                            value={targetYear}
                                                            onChange={(e) => handleTargetYearChange(e.target.value)}
                                                            className="w-full text-[12px] font-black text-white bg-white/10 border border-white/15 rounded-lg focus:ring-0 py-1.5 px-2 cursor-pointer shadow-sm outline-none"
                                                        >
                                                            {yearOptions.map(year => (
                                                                <option key={year.value} value={year.value} className="bg-slate-800 text-white">{year.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold text-emerald-100/80 mb-1 block">الفصل</label>
                                                        <select
                                                            value={targetTerm}
                                                            onChange={(e) => handleTargetTermChange(e.target.value)}
                                                            className="w-full text-[12px] font-black text-white bg-white/10 border border-white/15 rounded-lg focus:ring-0 py-1.5 px-2 cursor-pointer shadow-sm outline-none"
                                                        >
                                                            {termOptions.map(term => (
                                                                <option key={term.value} value={term.value} className="bg-slate-800 text-white">{term.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={applySuggestedStudySlot}
                                                    className="w-full text-[11px] font-black text-emerald-900 bg-emerald-100/80 hover:bg-emerald-100 border border-emerald-200 rounded-lg py-1.5 transition-colors"
                                                >
                                                    ✨ اختيار تلقائي: سنة {suggestedStudySlot.year} - {termOptions.find(t => t.value === suggestedStudySlot.term)?.label || 'الفصل الأول'}
                                                </button>
                                                <p className="text-[10px] font-bold text-emerald-100/70">سيتم الحفظ كسنة {targetYear} - {termOptions.find(t => t.value === targetTerm)?.label || 'الفصل الأول'}.</p>
                                            </div>
                                        )}
                                        {getStatus(selectedCourse) === 'available' && (
                                            <>
                                                <button onClick={() => toggleCart(selectedCourse)} className="w-full bg-white/10 border border-white/20 hover:bg-white/20 text-white py-3.5 rounded-xl font-[800] text-[13px] transition-all shadow-sm active:scale-[0.97] backdrop-blur-sm">🛒 إضافة للتسجيل التجريبي</button>
                                                <button onClick={() => togglePassed(selectedCourse.id)} className="w-full bg-emerald-500/80 hover:bg-emerald-500 text-white py-3.5 rounded-xl font-[800] text-[13px] transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.97]">✅ تأكيد اجتياز المادة</button>
                                            </>
                                        )}
                                        {(getStatus(selectedCourse) === 'passed' || getStatus(selectedCourse) === 'cart') && (
                                            <button onClick={() => getStatus(selectedCourse) === 'passed' ? togglePassed(selectedCourse.id) : toggleCart(selectedCourse)} className="w-full bg-white/5 border border-white/10 text-white/50 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-400/30 py-3.5 rounded-xl font-[800] text-[13px] transition-all active:scale-[0.97]">
                                                {getStatus(selectedCourse) === 'passed' ? '✖ إلغاء اجتياز المادة' : '✖ إزالة من التسجيل التجريبي'}
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-white/40 mt-8">
                                    <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-4xl mb-5 backdrop-blur-sm">🖱️</div>
                                    <p className="font-bold text-[13px] text-center leading-relaxed text-white/50">اضغط على أي مادة في الشجرة<br />لاستكشاف مسارها الأكاديمي</p>

                                    {/* 🆕 اقتراح المادة التالية الأفضل */}
                                    {getNextBestCourse() && (
                                        <div className="mt-8 w-full max-w-[320px]">
                                            <p className="text-[10px] font-[800] text-indigo-400 mb-2.5 text-center">💎 المادة الأهم للتسجيل حالياً:</p>
                                            <div className="bg-indigo-500/10 border border-indigo-400/20 p-4 rounded-[1.25rem] shadow-sm relative overflow-hidden backdrop-blur-sm">
                                                <div className="absolute -top-4 -left-4 w-16 h-16 bg-indigo-500/10 rounded-full blur-xl opacity-60" />
                                                <div className="relative z-10">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="bg-white/10 text-white/60 px-2 py-0.5 rounded-md font-mono text-[10px] font-[800] border border-white/10">{getNextBestCourse().code}</span>
                                                        <span className="text-[10px] font-[800] text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-md">أولوية: {getCoursePriority(getNextBestCourse())}%</span>
                                                    </div>
                                                    <h3 className="font-[900] text-[14px] text-white mb-1">{getNextBestCourse().name}</h3>
                                                    <p className="text-[10px] text-white/40 font-bold mb-3">{getNextBestCourse().credit_hours} ساعات • تفتح {getUnlocksDetailed(getNextBestCourse().id).length} مواد • تأثير على {getTotalImpact(getNextBestCourse().id)} مادة</p>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setSelectedCourse(getNextBestCourse())} className="flex-1 bg-indigo-500/80 hover:bg-indigo-500 text-white py-2.5 rounded-xl font-[800] text-[11px] shadow-md active:scale-95 transition-all">📖 التفاصيل</button>
                                                        <button onClick={() => toggleCart(getNextBestCourse())} className="flex-1 bg-white/10 border border-white/15 text-white/70 py-2.5 rounded-xl font-[800] text-[11px] shadow-sm active:scale-95 transition-all hover:bg-white/20">🛒 إضافة</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        )}

                        {/* ═══ SIMULATOR TAB ═══ */}
                        {activeTab === 'simulator' && (
                            <div className="space-y-5 sn-card-enter">
                                {!showAiSettings ? (
                                    <button onClick={() => setShowAiSettings(true)} className="w-full bg-gradient-to-l from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white py-4 rounded-[1.25rem] font-[800] shadow-xl shadow-indigo-200/30 flex items-center justify-center gap-3 active:scale-[0.97] transition-all relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-gradient-to-l from-white/0 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <span className="text-2xl relative z-10">🪄</span>
                                        <div className="text-right relative z-10"><p className="text-[13px]">توليد جدول ذكي</p><p className="text-[10px] text-indigo-200/60 font-bold">دع الخوارزمية تخطط فصلك القادم</p></div>
                                    </button>
                                ) : (
                                    <div className="bg-indigo-50/70 border border-indigo-100 p-5 rounded-[1.25rem] space-y-4">
                                        <div className="flex justify-between items-center"><h3 className="font-[800] text-indigo-800 text-[13px]">⚙️ إعدادات التوليد</h3><button onClick={() => setShowAiSettings(false)} className="text-slate-400 text-[11px] font-bold hover:text-rose-500 transition-colors">✕ إلغاء</button></div>
                                        <div><label className="text-[11px] font-bold text-indigo-700 mb-1.5 block font-i">الساعات المستهدفة:</label><div className="flex bg-white rounded-xl p-1 border border-indigo-100/60 shadow-sm">{[12, 15, 18].map(h => (<button key={h} onClick={() => setTargetHours(h)} className={`flex-1 py-2 text-[12px] font-[800] rounded-lg transition-all ${targetHours === h ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>{h} ساعة</button>))}</div></div>
                                        <div><label className="text-[11px] font-bold text-indigo-700 mb-1.5 block font-i">نمط الصعوبة:</label><div className="space-y-2">{[{ id: 'heavy', icon: '🏋️', label: 'مكثف (صعوبة فعلية أعلى)' }, { id: 'balanced', icon: '⚖️', label: 'متوازن (صعوبة وسط)' }, { id: 'light', icon: '🏖️', label: 'خفيف (صعوبة أقل)' }].map(p => (<button key={p.id} onClick={() => setSchedulePace(p.id)} className={`w-full p-2.5 rounded-xl border text-right transition-all flex items-center gap-2.5 shadow-sm ${schedulePace === p.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-200'}`}><span>{p.icon}</span><span className="text-[12px] font-bold">{p.label}</span></button>))}</div></div>
                                        <div><label className="text-[11px] font-bold text-indigo-700 mb-1.5 block font-i">الأولوية:</label><div className="grid grid-cols-3 gap-2">{[{ id: 'major', label: 'مواد تخصص' }, { id: 'graduation', label: 'تسريع تخرج' }, { id: 'gpa', label: 'حماية المعدل' }].map(f => (<button key={f.id} onClick={() => setSmartFocus(f.id)} className={`py-2 text-[11px] font-[800] rounded-lg border transition-all ${smartFocus === f.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-200'}`}>{f.label}</button>))}</div></div>
                                        <label className="flex items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-white px-3 py-2.5 cursor-pointer"><div><p className="text-[11px] font-[800] text-slate-700">توازن الحمل</p><p className="text-[10px] font-bold text-slate-400">تقليل المواد عالية الرسوب والصعوبة</p></div><button type="button" onClick={() => setSmartProtectGpa((prev) => !prev)} className={`w-12 h-7 rounded-full transition-colors p-1 ${smartProtectGpa ? 'bg-emerald-500' : 'bg-slate-300'}`}><span className={`block w-5 h-5 rounded-full bg-white transition-transform ${smartProtectGpa ? 'translate-x-0' : '-translate-x-5'}`} /></button></label>
                                        <button onClick={executeSmartSchedule} className="w-full bg-indigo-700 hover:bg-indigo-800 text-white py-3 rounded-xl font-[800] text-[13px] shadow-lg hover:-translate-y-0.5 active:scale-[0.97] transition-all">🚀 توليد الآن</button>
                                    </div>
                                )}

                                <button onClick={() => setShow4YearPlan(true)} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-[1.25rem] font-[800] shadow-xl flex items-center justify-center gap-3 active:scale-[0.97] transition-all ring-1 ring-inset ring-white/10 relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-l from-indigo-600/0 to-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <span className="text-2xl relative z-10">🤖</span>
                                    <div className="text-right relative z-10"><p className="text-[13px] text-indigo-200">خطة تخرج كاملة (محاكاة)</p><p className="text-[10px] text-slate-400 font-bold">توزيع المواد المتبقية على كل الفصول</p></div>
                                </button>

                                <div className="bg-gradient-to-bl from-slate-900 to-indigo-950 p-5 rounded-[1.25rem] text-white shadow-xl relative overflow-hidden">
                                    <div className="absolute -top-8 -right-8 w-24 h-24 bg-indigo-500/15 rounded-full blur-2xl" />
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-end mb-3"><p className="font-[800] text-base">الجدول المقترح</p><div className="text-right"><span className={`text-3xl font-[900] leading-none ${totalCartCredits > 18 ? 'text-rose-400' : 'text-amber-400'}`}>{totalCartCredits}</span><span className="text-slate-400 text-[10px] font-bold mr-1">/ 18 س</span></div></div>
                                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden shadow-inner"><div className={`h-full rounded-full transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${totalCartCredits > 18 ? 'bg-rose-500' : 'bg-gradient-to-l from-indigo-400 to-indigo-500'}`} style={{ width: `${Math.min((totalCartCredits / 18) * 100, 100)}%` }} /></div>
                                    </div>
                                </div>

                                {workloadAnalysis && (<div className={`p-3.5 rounded-xl border font-bold text-[12px] leading-relaxed shadow-sm ${workloadAnalysis.cls}`}>{workloadAnalysis.msg}</div>)}

                                {/* 🆕 مؤشر صحة التسجيل التجريبي */}
                                {cartHealthAnalysis && (
                                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-[1.25rem] space-y-3">
                                        <h4 className="font-[800] text-slate-700 text-[12px] flex items-center gap-2">📊 تحليل تركيبة التسجيل التجريبي</h4>
                                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                                            {cartHealthAnalysis.compPct > 0 && <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${cartHealthAnalysis.compPct}%` }} />}
                                            {cartHealthAnalysis.elecPct > 0 && <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${cartHealthAnalysis.elecPct}%` }} />}
                                        </div>
                                        <div className="flex justify-between text-[9px] font-bold">
                                            <span className="text-indigo-600 flex items-center gap-1"><span className="w-2 h-2 bg-indigo-500 rounded-sm" /> إجباري: {cartHealthAnalysis.compulsory}</span>
                                            <span className="text-amber-600 flex items-center gap-1"><span className="w-2 h-2 bg-amber-400 rounded-sm" /> اختياري/أخرى: {cartHealthAnalysis.elective + cartHealthAnalysis.supporting}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                            <div className="bg-white border border-slate-100 rounded-xl p-2.5 text-center"><p className="text-[8px] font-bold text-slate-400">مواد حرجة</p><p className={`text-lg font-[900] leading-tight ${cartHealthAnalysis.criticalInCart > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{cartHealthAnalysis.criticalInCart}</p></div>
                                            <div className="bg-white border border-slate-100 rounded-xl p-2.5 text-center"><p className="text-[8px] font-bold text-slate-400">مواد تتأثر</p><p className="text-lg font-[900] text-violet-600 leading-tight">{cartHealthAnalysis.totalImpactScore}</p></div>
                                        </div>
                                    </div>
                                )}

                                {cartIds.length > 0 ? (
                                    <div className="space-y-2.5 pb-8">
                                        <div className="flex justify-between items-center mb-1"><h4 className="font-[800] text-slate-800 text-[13px]">المواد المختارة ({cartIds.length}):</h4><button onClick={() => { setCartIds([]); setSmartMetaByCourseId({}); syncCartWithDB([]); }} className="text-[11px] text-rose-500 font-bold hover:text-rose-600 transition-colors">🗑️ تفريغ</button></div>
                                        {coursesWithDifficulty.filter(c => cartIds.includes(c.id)).map(c => (
                                            <div key={c.id} className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm flex justify-between items-center group hover:border-indigo-200 transition-colors">
                                                <div className="min-w-0 flex-1 ml-3">
                                                    <p className="font-[800] text-[13px] text-slate-800 truncate">{c.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold mt-0.5 font-i">{c.credit_hours} ساعات • {c.code} • سنة {c.recommended_year} • صعوبة {Math.round(c.difficulty_score)}%</p>
                                                    {smartMetaByCourseId[c.id] ? (
                                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${(smartMetaByCourseId[c.id].confidence || 0) >= 75 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : (smartMetaByCourseId[c.id].confidence || 0) >= 55 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>ثقة {Math.round(smartMetaByCourseId[c.id].confidence || 0)}%</span>
                                                            <span className="text-[9px] font-black px-2 py-0.5 rounded-md border bg-sky-50 text-sky-700 border-sky-200">بيانات {Math.round(smartMetaByCourseId[c.id].dataConfidence || 0)}%</span>
                                                        </div>
                                                    ) : null}
                                                </div>
                                                <button onClick={() => toggleCart(c)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all text-xs shrink-0 active:scale-90 shadow-sm">✕</button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (<div className="text-center py-8"><div className="text-3xl mb-2 opacity-30">🛒</div><p className="text-[12px] font-bold text-slate-400 font-i">أضف مواد من الشجرة لاستكشاف العبء.</p></div>)}
                            </div>
                        )}

                        {/* ═══ SEMESTERS TAB ═══ */}
                        {activeTab === 'semesters' && (
                            <div className="space-y-5 sn-card-enter">
                                <div className="bg-gradient-to-br from-emerald-50 to-teal-50/30 p-4 rounded-[1.25rem] border border-emerald-100/60 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center text-lg shadow-md shadow-emerald-200/50">📚</div>
                                        <div><h3 className="text-[13px] font-[900] text-emerald-900">سجلك الأكاديمي</h3><p className="text-[10px] font-bold text-emerald-700/70">توزيع المواد المنجزة حسب الفصول</p></div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
                                    <button onClick={() => setActiveSemesterTab('all')} className={`px-4 py-2 rounded-xl text-[11px] font-[800] whitespace-nowrap transition-all shadow-sm ${activeSemesterTab === 'all' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>🌐 الكل ({passedIds.length})</button>
                                    {semesterRecord.sortedKeys.map(key => {
                                        const item = semesterRecord.grouped[key];
                                        const termLabel = item.term === 1 ? 'الأول' : item.term === 2 ? 'الثاني' : 'الصيفي';
                                        return (
                                            <button key={key} onClick={() => setActiveSemesterTab(key)} className={`px-4 py-2 rounded-xl text-[11px] font-[800] whitespace-nowrap transition-all shadow-sm ${activeSemesterTab === key ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
                                                السنة {item.year} - {termLabel}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="space-y-2.5 pb-8">
                                    {recordDisplayedCourses.map((c, idx) => (
                                        <div key={`${activeSemesterTab}-${c.id}`} className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between hover:border-emerald-200 transition-colors animate-slideDown" style={{ animationDelay: `${idx * 40}ms` }}>
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-500 border border-slate-100 shrink-0">{c.credit_hours}س</div>
                                                <div className="min-w-0 truncate pr-2"><h4 className="text-[12px] font-[800] text-slate-800 truncate">{c.name}</h4><p className="text-[9px] font-bold text-slate-400 font-mono mt-0.5">{c.code}</p></div>
                                            </div>
                                            <div className="shrink-0 flex flex-col items-end gap-1 pl-1">
                                                <span className={`px-2 py-0.5 rounded-[6px] text-[9px] font-[800] border shadow-sm ${getBadgeColor(c.pivot?.grade)}`}>{c.pivot?.grade ? `${c.pivot.grade}%` : 'ناجح'}</span>
                                                <span className="px-2 py-0.5 rounded-[6px] text-[9px] font-[800] border shadow-sm bg-emerald-50 text-emerald-700 border-emerald-200">
                                                    سنة {c.localYear} - {c.localTerm === 1 ? 'الأول' : c.localTerm === 2 ? 'الثاني' : 'الصيفي'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                    {recordDisplayedCourses.length === 0 && (<div className="text-center py-10 opacity-60"><div className="text-3xl mb-2">📭</div><p className="text-[12px] font-bold text-slate-500">لا يوجد مواد مسجلة.</p></div>)}
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-200/60"><Link href={route('calculator.index')} className="w-full bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 py-3 rounded-xl font-[800] text-[12px] transition-all flex items-center justify-center gap-2 shadow-sm">تعديل العلامات والفصول في الحاسبة ⚙️</Link></div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══ GRAPH AREA ═══ */}
                <div className={`flex-1 relative h-full bg-slate-100/50 ${isMobile ? 'p-1.5' : 'p-2 md:p-4'} w-full`} dir="ltr">
                    <div className="w-full h-full bg-white/60 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200/80 shadow-[inset_0_2px_12px_rgba(0,0,0,0.04)] relative overflow-hidden backdrop-blur-sm">

                        {showRotateHint && (
                            <div className="absolute top-2 right-2 left-2 z-30" dir="rtl">
                                <div className="bg-amber-50/95 border border-amber-200 text-amber-800 rounded-xl px-3 py-2 shadow-lg backdrop-blur-sm flex items-center gap-2.5">
                                    <span className="text-base shrink-0">🔄</span>
                                    <p className="text-[10px] font-black leading-snug flex-1">لرؤية الشجرة بشكل أوضح، لف الشاشة للوضع الأفقي.</p>
                                    <button
                                        type="button"
                                        onClick={() => setDismissedRotateHint(true)}
                                        className="shrink-0 text-[10px] font-black px-2 py-1 rounded-md bg-white border border-amber-200 text-amber-700"
                                    >
                                        إخفاء
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className={`absolute ${showRotateHint ? 'top-[4.3rem]' : isMobile ? 'top-2' : 'top-3'} left-1/2 transform -translate-x-1/2 z-20 flex gap-1.5 bg-slate-900/90 backdrop-blur-xl p-1.5 rounded-xl shadow-2xl border border-slate-700/30 ${isMobile ? 'w-[calc(100%-0.75rem)] overflow-x-auto hide-scrollbar flex-nowrap justify-start' : 'flex-wrap justify-center max-w-[95%]'}`}>
                            {[
                                { id: 'none', label: '🌐 الخطة كاملة', mobileLabel: '🌐 الكل', active: 'bg-white text-slate-900 shadow-sm' },
                                { id: 'available', label: '🔓 المتاح', mobileLabel: '🔓 المتاح', active: 'bg-indigo-600 text-white shadow-[0_0_12px_rgba(79,70,229,0.4)]', dot: 'bg-indigo-300' },
                                { id: 'critical', label: '🚨 المسار الحرج', mobileLabel: '🚨 الحرج', active: 'bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.4)]', dot: 'bg-rose-300 animate-pulse' }
                            ].map(f => (
                                <button key={f.id} onClick={() => setFilterMode(f.id)} className={`px-3.5 py-2 rounded-lg text-[11px] font-[800] transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${filterMode === f.id ? f.active : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>{f.dot && <span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />}{isMobile ? (f.mobileLabel || f.label) : f.label}</button>
                            ))}
                            {canEditTreePositions && !positionEditMode && (
                                <button
                                    onClick={startPositionEditMode}
                                    className="px-3.5 py-2 rounded-lg text-[11px] font-[800] transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 bg-white text-slate-900 shadow-sm"
                                >
                                    {isMobile ? '🖱️ تعديل الترتيب' : '🖱️ تعديل أماكن المواد'}
                                </button>
                            )}

                            {canEditTreePositions && positionEditMode && (
                                <>
                                    <button
                                        onClick={cancelPositionEditMode}
                                        disabled={isSavingNodePositions}
                                        className="px-3.5 py-2 rounded-lg text-[11px] font-[800] transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.35)] disabled:opacity-50"
                                    >
                                        ✖️ إلغاء
                                    </button>
                                    <button
                                        onClick={saveAllNodePositions}
                                        disabled={isSavingNodePositions || !hasUnsavedNodeMoves}
                                        className="px-3.5 py-2 rounded-lg text-[11px] font-[800] transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.35)] disabled:opacity-50"
                                    >
                                        {isSavingNodePositions ? '⏳ جاري الحفظ...' : '💾 حفظ الترتيب'}
                                    </button>
                                </>
                            )}
                        </div>

                        {/* 🎨 دليل الألوان — قابل للطي */}
                        <div className="absolute top-3 left-3 z-20 hidden md:block" dir="rtl">
                            <button onClick={() => setLegendOpen(!legendOpen)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-[800] transition-all shadow-md active:scale-95 ${legendOpen ? 'bg-slate-900 text-white' : 'bg-white/95 backdrop-blur-md text-slate-600 border border-slate-200/60 hover:bg-slate-50'}`}>
                                🎨 {legendOpen ? 'إخفاء الدليل' : 'دليل الألوان'}
                            </button>
                            {legendOpen && (
                                <div className="mt-2 bg-white/95 backdrop-blur-md p-3.5 rounded-xl shadow-lg border border-slate-200/60 flex flex-col gap-2" style={{ animation: 'sn-scale 0.2s cubic-bezier(0.16,1,0.3,1) both' }}>
                                    <p className="text-[9px] font-[900] text-slate-400 uppercase tracking-wider mb-1 text-right">الحالات</p>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-2 pb-2 border-b border-slate-100">
                                        {[{ color: 'bg-[#10b981]', label: 'منجز' }, { color: 'bg-[#6366f1]', label: 'متاح' }, { color: 'bg-[#f59e0b]', label: 'في التسجيل التجريبي' }, { color: 'bg-slate-200', label: 'مغلق' }].map(l => (
                                            <div key={l.label} className="flex items-center justify-end gap-2"><span className="text-[10px] font-bold text-slate-600">{l.label}</span><span className={`w-3 h-3 rounded-[4px] ${l.color} shadow-sm`} /></div>
                                        ))}
                                    </div>
                                    <p className="text-[9px] font-[900] text-slate-400 uppercase tracking-wider mb-1 text-right">الأشكال</p>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-end gap-2"><span className="text-[10px] font-bold text-slate-500">إجباري (مستطيل)</span><div className="w-4 h-3 bg-slate-200 rounded-[4px]"></div></div>
                                        <div className="flex items-center justify-end gap-2"><span className="text-[10px] font-bold text-slate-500">مساندة (بيضاوي)</span><div className="w-4 h-3 bg-slate-200 rounded-[10px]"></div></div>
                                        <div className="flex items-center justify-end gap-2"><span className="text-[10px] font-bold text-slate-500">اختياري (مائل)</span><div className="w-4 h-3 bg-slate-200 rounded-tr-[8px] rounded-bl-[8px] rounded-tl-[1px] rounded-br-[1px]"></div></div>
                                        <div className="flex items-center justify-end gap-2"><span className="text-[10px] font-bold text-slate-500">جامعة (حاد)</span><div className="w-4 h-3 bg-slate-200 rounded-[1px]"></div></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodeClick={onNodeClick}
                            onNodeDrag={onNodeDrag}
                            onNodeDragStop={onNodeDragStop}
                            onPaneClick={onPaneClick}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            fitView
                            fitViewOptions={{ padding: flowView.fitPadding, minZoom: flowView.minZoom, maxZoom: flowView.maxZoom }}
                            minZoom={flowView.minZoom}
                            maxZoom={flowView.maxZoom}
                            translateExtent={translateExtent}
                            nodeExtent={translateExtent}
                            nodesDraggable={canEditTreePositions && positionEditMode}
                            snapToGrid={canEditTreePositions && positionEditMode}
                            snapGrid={nodeSnapGrid}
                            nodesConnectable={false}
                            elementsSelectable={true}
                            selectionOnDrag={false}
                            panOnDrag={!positionEditMode}
                            panOnScroll={false}
                            zoomOnPinch={true}
                            zoomOnScroll={!isMobile && !positionEditMode}
                            zoomOnDoubleClick={!isMobile && !positionEditMode}
                            proOptions={{ hideAttribution: true }}
                            className="react-flow-rtl-fix"
                        >
                            <Controls position="bottom-left" className={`hidden md:block border-slate-200 shadow-xl rounded-xl fill-slate-700 m-4 overflow-hidden ${isDark ? 'bg-slate-800 text-white border-white/10 opacity-75 hover:opacity-100' : 'bg-white'}`} showInteractive={false} />
                            <Background
                                color={isDark ? '#334155' : '#cbd5e1'}
                                style={{ backgroundColor: isDark ? '#0a0f18' : '#fafcff' }}
                                gap={28} size={1.2} variant="dots" opacity={0.6}
                            />
                        </ReactFlow>

                        {canEditTreePositions && positionEditMode && (
                            <div className="absolute bottom-3 left-3 z-20 bg-slate-900/90 text-white text-[10px] font-bold px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md flex items-center gap-2">
                                <span>🧭 السحب أفقي مع مستوى ثابت لكل فصل</span>
                                {hasUnsavedNodeMoves && <span className="text-amber-300">• يوجد تغييرات غير محفوظة</span>}
                            </div>
                        )}

                        {isMobile && (
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 bg-slate-900/85 text-white/80 text-[10px] font-bold px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md pointer-events-none">
                                👌 اسحب للتنقل • قرّب بإصبعين
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

Tree.layout = page => <MainLayout children={page} />;