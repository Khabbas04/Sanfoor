import React, { useMemo, useState, useCallback, useEffect } from 'react';
import ReactFlow, { MiniMap, Controls, Background, MarkerType, useNodesState, useEdgesState } from 'reactflow';
import dagre from 'dagre';
import axios from 'axios';
import Swal from 'sweetalert2';
import { Head, Link, router } from '@inertiajs/react'; // تم إضافة router هنا
import MainLayout from '@/Layouts/MainLayout';
import 'reactflow/dist/style.css';

/* ═══════════════════════════════════════════════════════════
   CONSTANTS & LAYOUT ENGINE (المحرك المطور)
   ═══════════════════════════════════════════════════════════ */

const nodeWidth = 200;
const nodeHeight = 88;

const swalTheme = {
    confirmButtonColor: '#4f46e5',
    customClass: { popup: 'rounded-3xl font-t', title: 'font-t', htmlContainer: 'font-t' },
};

// 🔥 الخوارزمية الجديدة لترتيب المواد كصفوف حسب الفصول (مثل الجامعة) 🔥
const getLayoutedElements = (nodes, edges, direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    
    // إعدادات المسافات بين المواد والأسهم
    dagreGraph.setGraph({ 
        rankdir: direction, 
        ranksep: 90,    // المسافة العمودية بين الفصول
        nodesep: 30,    // المسافة الأفقية بين المواد
        edgesep: 15
    });

    // 1. ترتيب العقد لضمان ترتيب منطقي من اليمين لليسار داخل نفس الفصل
    const sortedNodes = [...nodes].sort((a, b) => {
        const semA = parseInt(a.data?.semester) || 1;
        const semB = parseInt(b.data?.semester) || 1;
        if (semA !== semB) return semA - semB;
        
        const codeA = a.data?.code || '';
        const codeB = b.data?.code || '';
        return codeA.localeCompare(codeB);
    });

    // 2. إضافة العقد للمحرك
    sortedNodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    // 3. إضافة الأسهم الحقيقية
    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target, { weight: 2 });
    });

    // 4. بناء "العمود الفقري الوهمي" لضبط الفصول (Anchors) لمنع الشاشة البيضاء وتمدد الشجرة
    const semesters = sortedNodes.map(n => parseInt(n.data?.semester) || 1).filter(s => !isNaN(s));
    if (semesters.length > 0) {
        const minSem = Math.min(...semesters);
        const maxSem = Math.max(...semesters);

        for (let s = minSem - 1; s <= maxSem; s++) {
            const anchorId = `anchor-sem-${s}`;
            dagreGraph.setNode(anchorId, { width: 1, height: 1 }); // عقدة وهمية
            
            if (s > minSem - 1) {
                // ربط الفصول ببعضها عمودياً بوزن ثقيل لتظل مستقيمة
                dagreGraph.setEdge(`anchor-sem-${s - 1}`, `anchor-sem-${s}`, { weight: 100 });
            }
        }

        // ربط كل مادة بالعقدة الوهمية الخاصة بفصلها
        sortedNodes.forEach((node) => {
            const sem = parseInt(node.data?.semester) || 1;
            const prevAnchor = `anchor-sem-${sem - 1}`;
            dagreGraph.setEdge(prevAnchor, node.id, { weight: 1 }); 
        });
    }

    // تشغيل المحرك
    dagre.layout(dagreGraph);

    // استخراج الإحداثيات للمواد الحقيقية فقط
    return nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
            ...node,
            targetPosition: 'top',
            sourcePosition: 'bottom',
            position: {
                x: nodeWithPosition ? nodeWithPosition.x - nodeWidth / 2 : 0,
                y: nodeWithPosition ? nodeWithPosition.y - nodeHeight / 2 : 0,
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
    passed_courses = []
}) {

    const [passedIds, setPassedIds] = useState(passed_course_ids || []);
    const [cartIds, setCartIds] = useState(initial_cart_ids || []);
    const [localPassedCourses, setLocalPassedCourses] = useState(passed_courses || []);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [targetSemester, setTargetSemester] = useState(1);
    const [activeTab, setActiveTab] = useState('details');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showAiSettings, setShowAiSettings] = useState(false);
    const [targetHours, setTargetHours] = useState(15);
    const [schedulePace, setSchedulePace] = useState('balanced');
    const [filterMode, setFilterMode] = useState('none');
    const [show4YearPlan, setShow4YearPlan] = useState(false);

    // 🔥 دالة مزامنة المحاكي مع قاعدة البيانات لضمان ظهورها عند الأدمن 🔥
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

    const getStatus = useCallback((course) => {
        if (!course) return 'locked';
        if (passedIds.includes(course.id)) return 'passed';
        if (cartIds.includes(course.id)) return 'cart';
        if (!course.prerequisites || course.prerequisites.length === 0) return 'available';
        return course.prerequisites.every(p => passedIds.includes(p.id)) ? 'available' : 'locked';
    }, [passedIds, cartIds]);

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

    const buildGraph = useCallback(() => {
        const initialNodes = [];
        const initialEdges = [];

        const backwardIds = selectedCourse ? Array.from(getBackwardPath(selectedCourse.id)) : [];
        const forwardIds = selectedCourse ? Array.from(getForwardPath(selectedCourse.id)) : [];
        const connectedIds = [...new Set([...backwardIds, ...forwardIds])];

        courses.forEach((course) => {
            const status = getStatus(course);
            const depth = getCourseDepth(course.id);
            const isCriticalPath = depth >= 2 && status !== 'passed';
            const unlocksCount = courses.filter(c => c.prerequisites?.some(p => p.id === course.id)).length;
            const isBottleneck = unlocksCount >= 3 && status !== 'passed';
            
            const isElective = course.type === 'elective';
            const hasDescription = course.description && course.description.trim() !== '';

            const themes = {
                passed: { bg: 'background:linear-gradient(135deg,#059669,#10b981)', border: 'border:1.5px solid rgba(16,185,129,0.8)', badgeBg: 'rgba(255,255,255,0.2)', textColor: '#fff', statusLabel: 'منجز', statusIcon: '✅' },
                cart: { bg: 'background:linear-gradient(135deg,#d97706,#f59e0b)', border: 'border:1.5px solid rgba(245,158,11,0.8)', badgeBg: 'rgba(255,255,255,0.2)', textColor: '#fff', statusLabel: 'محاكي', statusIcon: '🛒' },
                available: { bg: 'background:linear-gradient(135deg,#4338ca,#6366f1)', border: 'border:1.5px solid rgba(99,102,241,0.8)', badgeBg: 'rgba(255,255,255,0.2)', textColor: '#fff', statusLabel: 'متاح', statusIcon: '🔓' },
                locked: { bg: 'background:#f8fafc', border: 'border:1.5px solid #cbd5e1', badgeBg: 'rgba(148,163,184,0.15)', textColor: '#64748b', statusLabel: 'مغلق', statusIcon: '🔒' },
            };
            const t = themes[status];

            let finalBorder = t.border;
            if (isElective) {
                if (status === 'locked') {
                    finalBorder = 'border: 2.5px dashed #94a3b8';
                } else {
                    finalBorder = 'border: 2.5px dashed #ffffff';
                }
            }

            let isFilteredOut = false;
            if (filterMode === 'available' && status !== 'available') isFilteredOut = true;
            if (filterMode === 'critical' && !isCriticalPath) isFilteredOut = true;

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

            const nodeHtml = `
                <div style="width:100%;height:100%;border-radius:16px;display:flex;flex-direction:column;position:relative;overflow:hidden;transition:all 0.35s cubic-bezier(0.16,1,0.3,1);${t.bg};${finalBorder};${ringStyle}${dimStyle}cursor:pointer;">
                    <div style="position:absolute;top:-12px;right:-12px;width:48px;height:48px;background:rgba(255,255,255,0.15);border-radius:50%;filter:blur(12px);"></div>
                    
                    <div style="padding:8px 10px;display:flex;flex-direction:column;height:100%;justify-content:space-between;position:relative;z-index:1;">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="font-size:8.5px;font-weight:800;padding:2px 7px;border-radius:6px;background:${t.badgeBg};color:${t.textColor};backdrop-filter:blur(4px);display:flex;align-items:center;gap:3px;letter-spacing:0.3px;">
                                ${t.statusIcon} ${t.statusLabel}
                                ${hasDescription ? '<span style="margin-right:3px; font-size:10px; animation: pulse 2s infinite;" title="يوجد لمحة عن المادة">📝</span>' : ''}
                            </span>
                            <div style="display:flex; gap:3px;">
                                ${isElective ? `<span style="font-size:7.5px;font-weight:900;padding:2px 5px;border-radius:4px;background:rgba(0,0,0,0.15);color:${t.textColor};">اختياري</span>` : ''}
                                <span style="font-size:8.5px;font-weight:800;padding:2px 7px;border-radius:6px;background:${t.badgeBg};color:${t.textColor};">${course.credit_hours} س</span>
                            </div>
                        </div>
                        <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:2px 4px;">
                            <h3 style="font-weight:900;font-size:11.5px;color:${t.textColor};line-height:1.45;text-align:center;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;text-shadow:${status !== 'locked' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none'};">${course.name}</h3>
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

            initialNodes.push({
                id: course.id.toString(),
                position: { x: 0, y: 0 },
                style: { padding: 0, border: 'none', background: 'transparent', width: nodeWidth, height: nodeHeight },
                data: { 
                    label: <div dangerouslySetInnerHTML={{ __html: nodeHtml }} />,
                    semester: parseInt(course.semester) || 1, 
                    code: course.code || '' 
                },
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
                    if (filterMode === 'critical' && !(depth >= 2 && status !== 'passed')) edgeFilteredOut = true;

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

        return { initialNodes: getLayoutedElements(initialNodes, initialEdges), initialEdges };
    }, [courses, passedIds, cartIds, selectedCourse, filterMode, getStatus, getCourseDepth, getBackwardPath, getForwardPath]);

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        const { initialNodes, initialEdges } = buildGraph();
        setNodes(initialNodes);
        setEdges(initialEdges);
    }, [buildGraph]);

    const onPaneClick = useCallback(() => setSelectedCourse(null), []);
    
    const onNodeClick = useCallback((e, node) => {
        const course = courses.find(c => c.id === parseInt(node.id));
        setSelectedCourse(course);
        if(course) setTargetSemester(course.semester || 1);
        setActiveTab('details');
        if (window.innerWidth < 1024) setIsSidebarOpen(true);
    }, [courses]);

    const togglePassed = async (courseId) => {
        try {
            const response = await axios.post(route('tree.toggle'), { 
                course_id: courseId,
                studied_semester: targetSemester 
            });
            
            if (response.data.status === 'added') {
                setPassedIds(p => [...p, courseId]);
                // عند إنجاز مادة، نقوم بإزالتها من المحاكي ومزامنة قاعدة البيانات
                const updatedCart = cartIds.filter(id => id !== courseId);
                setCartIds(updatedCart);
                syncCartWithDB(updatedCart); 
                
                const addedCourse = courses.find(c => c.id === courseId);
                if (addedCourse) {
                    setLocalPassedCourses(prev => [...prev, {
                        ...addedCourse,
                        pivot: { grade: null, studied_semester: targetSemester } 
                    }]);
                }
                setActiveTab('semesters');
                
            } else if (response.data.status === 'removed') {
                setPassedIds(p => p.filter(id => id !== courseId));
                setLocalPassedCourses(prev => prev.filter(c => c.id !== courseId));
            }
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'خطأ!', text: error.response?.data?.message || 'حدث خطأ بالاتصال', ...swalTheme });
        }
    };

    const toggleCart = (course) => {
        let updatedCart;
        if (cartIds.includes(course.id)) {
            updatedCart = cartIds.filter(id => id !== course.id);
            setCartIds(updatedCart);
            syncCartWithDB(updatedCart); // مزامنة الحذف مع الأدمن
            return;
        }

        if (course.prerequisites?.some(p => cartIds.includes(p.id))) {
            Swal.fire({ icon: 'warning', title: 'تنبيه ذكي!', text: 'لا ينصح بإضافة المادة ومتطلبها في نفس الفصل الدراسي.', ...swalTheme });
            return;
        }
        updatedCart = [...cartIds, course.id];
        setCartIds(updatedCart);
        syncCartWithDB(updatedCart); // مزامنة الإضافة مع الأدمن
    };

    const executeSmartSchedule = () => {
        let trulyAvailable = courses.filter(c => {
            if (passedIds.includes(c.id)) return false;
            if (!c.prerequisites || c.prerequisites.length === 0) return true;
            return c.prerequisites.every(p => passedIds.includes(p.id));
        });

        const criticalAndMajor = trulyAvailable.filter(c => getCourseDepth(c.id) > 0 || c.major_id !== null);
        const universityAndElective = trulyAvailable.filter(c => c.major_id === null || c.type === 'elective');
        criticalAndMajor.sort((a, b) => getCourseDepth(b.id) - getCourseDepth(a.id));

        let newCart = [];
        let currentHours = 0;
        const addCourse = (course) => {
            if (currentHours + course.credit_hours <= targetHours && !newCart.includes(course.id)) {
                newCart.push(course.id);
                currentHours += course.credit_hours;
                return true;
            }
            return false;
        };

        if (schedulePace === 'heavy') {
            criticalAndMajor.forEach(addCourse);
            universityAndElective.forEach(addCourse);
        } else if (schedulePace === 'balanced') {
            let uniCounter = 0;
            universityAndElective.forEach(c => { if (uniCounter < 1 && addCourse(c)) uniCounter++; });
            criticalAndMajor.forEach(addCourse);
            universityAndElective.forEach(addCourse);
        } else {
            universityAndElective.forEach(addCourse);
            criticalAndMajor.forEach(addCourse);
        }

        if (newCart.length > 0) {
            setCartIds(newCart);
            syncCartWithDB(newCart); // مزامنة التوليد الذكي مع الأدمن
            setShowAiSettings(false);
            Swal.fire({ icon: 'success', title: 'تم التخطيط!', text: `تم اقتراح جدول بقيمة ${currentHours} ساعة بناءً على مسارك.`, ...swalTheme });
        } else {
            Swal.fire({ icon: 'info', title: 'لا يوجد مواد', text: 'لا يوجد مواد متاحة حالياً. تأكد من إنجاز متطالباتك.', ...swalTheme });
        }
    };

    const totalPassedCredits = useMemo(() => courses.filter(c => passedIds.includes(c.id)).reduce((acc, c) => acc + (c.credit_hours || 0), 0), [courses, passedIds]);
    const totalCartCredits = useMemo(() => courses.filter(c => cartIds.includes(c.id)).reduce((acc, c) => acc + (c.credit_hours || 0), 0), [courses, cartIds]);
    const progressPct = useMemo(() => Math.min(Math.round((totalPassedCredits / 132) * 100), 100), [totalPassedCredits]);

    // 🔥 المعالجة المحمية للبيانات لتجنب الشاشة البيضاء 🔥
    const processedCourses = useMemo(() => {
        const coursesArray = Array.isArray(localPassedCourses) ? localPassedCourses : [];
        return coursesArray.map(c => {
            let sem = 1;
            if (c.pivot && c.pivot.studied_semester) {
                sem = c.pivot.studied_semester;
            } else if (c.semester) {
                sem = c.semester;
            }
            return {
                ...c,
                localSemester: parseInt(sem, 10) || 1
            };
        });
    }, [localPassedCourses]);

    const semesterRecord = useMemo(() => {
        const grouped = {};
        processedCourses.forEach(course => {
            const sem = course.localSemester;
            if (!grouped[sem]) grouped[sem] = { courses: [], totalHours: 0 };
            grouped[sem].courses.push(course);
            grouped[sem].totalHours += course.credit_hours || 0;
        });

        const sortedSemesters = Object.keys(grouped)
            .map(Number)
            .filter(n => !isNaN(n))
            .sort((a, b) => a - b);

        return { grouped, sortedSemesters };
    }, [processedCourses]);

    const [activeSemesterTab, setActiveSemesterTab] = useState('all');

    // 🔥 فلترة آمنة حسب الفصول 🔥
    const recordDisplayedCourses = useMemo(() => {
        if (!processedCourses || processedCourses.length === 0) return [];
        if (activeSemesterTab === 'all') return processedCourses;
        return processedCourses.filter(c => c.localSemester === parseInt(activeSemesterTab, 10));
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
        const cartCourses = courses.filter(c => cartIds.includes(c.id));
        let heavyCount = cartCourses.filter(c => c.major_id !== null && c.type === 'compulsory').length;
        
        if (totalCartCredits > 18) return { msg: '🚨 تجاوزت الحد الأقصى للساعات!', cls: 'bg-rose-50 text-rose-700 border-rose-200' };
        if (heavyCount >= 4) return { msg: '⚖️ العبء مرتفع. أدمج مادة اختيارية.', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
        if (totalCartCredits < 12) return { msg: '🐌 عبء منخفض. توقع تأخر بالتخرج.', cls: 'bg-slate-50 text-slate-600 border-slate-200' };
        return { msg: '✨ جدول متوازن ومثالي!', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }, [cartIds, courses, totalCartCredits]);

    const render4YearPlan = () => {
        let simulatedPassed = new Set(passedIds);
        let remainingCourses = courses.filter(c => !simulatedPassed.has(c.id));
        let generatedSemesters = [];
        let currentSem = 1;

        while (remainingCourses.length > 0 && currentSem <= 12) {
            let availableNow = remainingCourses.filter(c => {
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
        <div className="w-full flex flex-col bg-[#f8fafc] overflow-hidden font-t" dir="rtl" style={{ height: 'calc(100vh - 80px)' }}>
            <Head title="الخطة الشجرية - سنفور" />

            <style>{`
                @keyframes sn-scale { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
                @keyframes sn-slide-r { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
                @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
                @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.15); } }
                
                .sn-card-enter { animation: sn-slide-r 0.35s cubic-bezier(0.16,1,0.3,1) both; }
                
                /* 🔥 تم إصلاح الأنيميشن بإضافة forwards ليثبت العنصر بعد الظهور 🔥 */
                @keyframes slideDown { 
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); } 
                }
                .animate-slideDown { 
                    opacity: 0;
                    animation: slideDown 0.4s ease-out forwards; 
                }

                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            <div className="bg-white/90 backdrop-blur-xl border-b border-slate-200/60 px-4 md:px-6 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)] z-20 flex justify-between items-center relative">
                <div className="flex items-center gap-3">
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden w-10 h-10 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 transition-colors active:scale-90 shadow-sm">
                        {isSidebarOpen ? '✕' : '☰'}
                    </button>
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-cyan-500 text-white rounded-xl flex items-center justify-center text-lg shadow-md shadow-indigo-200/40 hidden sm:flex">🌳</div>
                    <div>
                        <h1 className="text-base sm:text-lg font-[900] text-slate-800 leading-tight">الخطة الشجرية التفاعلية</h1>
                        <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 mt-0.5 font-i">{major_name && `${major_name} • `}{student_name}</p>
                    </div>
                </div>

                <div className="hidden md:flex flex-col items-end w-64">
                    <div className="flex justify-between w-full mb-1.5 items-center">
                        <span className="text-[10px] font-[800] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">نسبة الإنجاز</span>
                        <span className="text-[10px] font-bold text-slate-400 font-i">{totalPassedCredits} / 132 ساعة</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-l from-emerald-400 to-emerald-500 rounded-full transition-all duration-[1500ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 flex w-full h-full relative overflow-hidden">
                {show4YearPlan && render4YearPlan()}

                {isSidebarOpen && (
                    <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
                )}

                <div className={`
                    absolute lg:relative top-0 right-0 h-full
                    w-[92%] sm:w-[400px] lg:min-w-[420px] lg:max-w-[420px]
                    bg-white lg:border-l border-slate-200/80
                    shadow-2xl lg:shadow-none z-50 lg:z-10
                    flex flex-col overflow-hidden
                    transition-transform duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)]
                    ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
                `}>

                    <div className="flex p-2.5 gap-2 bg-slate-50/80 border-b border-slate-100 shrink-0">
                        <button onClick={() => setActiveTab('details')} className={`flex-1 py-2.5 rounded-xl text-[12px] font-[800] transition-all flex items-center justify-center gap-1.5 ${activeTab === 'details' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/80' : 'text-slate-400 hover:bg-white/50'}`}>
                            📖 التفاصيل
                        </button>
                        <button onClick={() => setActiveTab('simulator')} className={`flex-1 py-2.5 rounded-xl text-[12px] font-[800] transition-all flex items-center justify-center gap-1.5 relative ${activeTab === 'simulator' ? 'bg-slate-900 text-white shadow-md shadow-slate-900/15' : 'bg-white border border-slate-200/80 text-slate-500 hover:bg-slate-50'}`}>
                            🪄 التخطيط
                            {cartIds.length > 0 && (
                                <span className="bg-amber-400 text-amber-900 w-5 h-5 rounded-md text-[10px] flex items-center justify-center font-[900] mr-0.5">{cartIds.length}</span>
                            )}
                        </button>
                        <button onClick={() => setActiveTab('semesters')} className={`flex-1 py-2.5 rounded-xl text-[12px] font-[800] transition-all flex items-center justify-center gap-1.5 ${activeTab === 'semesters' ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/80' : 'text-slate-400 hover:bg-white/50'}`}>
                            📚 الفصول
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 pb-24">

                        {activeTab === 'details' && (
                            selectedCourse ? (
                                <div className="space-y-5 sn-card-enter">
                                    <div className="bg-gradient-to-br from-slate-50 to-white p-5 rounded-[1.25rem] border border-slate-200/80 shadow-sm relative overflow-hidden">
                                        <div className="absolute -top-8 -right-8 w-24 h-24 bg-indigo-50 rounded-full blur-2xl" />
                                        <div className="relative z-10">
                                            <div className="flex justify-between items-start mb-3.5">
                                                <div className="flex gap-2">
                                                    <span className="bg-white text-slate-600 px-2.5 py-1 rounded-lg font-mono text-[11px] font-[800] border border-slate-200 shadow-sm">{selectedCourse.code}</span>
                                                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-[800] border ${selectedCourse.type === 'compulsory' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                        {selectedCourse.type === 'compulsory' ? 'إجباري' : 'اختياري'}
                                                    </span>
                                                </div>
                                                <span className="text-slate-500 font-[800] text-[11px] bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">{selectedCourse.credit_hours} ساعات</span>
                                            </div>
                                            <h2 className="text-xl font-[900] text-slate-800 leading-tight">{selectedCourse.name}</h2>
                                            <p className="text-[11px] text-slate-400 font-bold mt-1.5 font-i">المستوى الافتراضي: {selectedCourse.semester || 1}</p>
                                        </div>
                                    </div>

                                    {selectedCourse.description && selectedCourse.description.trim() !== '' && (
                                        <div className="bg-gradient-to-br from-amber-50 to-orange-50/30 border border-amber-100 p-4 rounded-[1.25rem] relative overflow-hidden shadow-sm">
                                            <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-amber-400 to-orange-400"></div>
                                            <h4 className="text-amber-900 font-[900] text-[12px] flex items-center gap-2 mb-2">
                                                <span>💡</span> لمحة عن المادة:
                                            </h4>
                                            <p className="text-[11.5px] font-bold text-amber-800/80 leading-relaxed whitespace-pre-wrap pl-1">
                                                {selectedCourse.description}
                                            </p>
                                        </div>
                                    )}

                                    {getUnlocksDetailed(selectedCourse.id).length > 0 && (
                                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-[1.25rem]">
                                            <h4 className="text-slate-700 font-[800] text-[12px] flex items-center gap-2 mb-2.5">🚀 تفتح هذه المواد:</h4>
                                            <div className="flex flex-wrap gap-1.5">
                                                {getUnlocksDetailed(selectedCourse.id).map(u => (
                                                    <span key={u.id} className="text-[10px] font-bold bg-white text-indigo-600 border border-slate-200 px-2.5 py-1 rounded-lg shadow-sm">{u.name}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {getCourseDepth(selectedCourse.id) >= 2 && getStatus(selectedCourse) !== 'passed' && (
                                        <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl flex gap-3 items-start">
                                            <span className="text-xl mt-0.5">🚨</span>
                                            <div>
                                                <h4 className="text-rose-800 font-[800] text-[13px]">مادة مسار حرج!</h4>
                                                <p className="text-rose-600 text-[11px] font-bold mt-0.5 font-i">تأجيلها قد يؤخر تخرجك فصلاً كاملاً.</p>
                                            </div>
                                        </div>
                                    )}

                                    {getStatus(selectedCourse) === 'locked' && (
                                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-[1.25rem]">
                                            <p className="text-slate-700 font-[800] text-[13px] mb-3 flex items-center gap-2">🔒 المادة مغلقة. المتطلبات:</p>
                                            <div className="space-y-2">
                                                {selectedCourse.prerequisites.map(p => (
                                                    <div key={p.id} className={`flex justify-between items-center text-[11px] font-bold p-2.5 rounded-xl border ${passedIds.includes(p.id) ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-white border-rose-100 text-rose-500'}`}>
                                                        <span>{p.name}</span>
                                                        <span className="font-[800] text-[10px]">{passedIds.includes(p.id) ? '✅ منجز' : '⏳ مطلوب'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2.5 pt-1">
                                        {getStatus(selectedCourse) === 'available' && (
                                            <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl mb-3 flex justify-between items-center shadow-sm">
                                                <span className="text-[12px] font-[800] text-emerald-800 flex items-center gap-2">📅 أنجزت في الفصل:</span>
                                                <select
                                                    value={targetSemester}
                                                    onChange={(e) => setTargetSemester(parseInt(e.target.value))}
                                                    className="text-[12px] font-black text-emerald-700 bg-white border border-emerald-200 rounded-lg focus:ring-0 py-1 pl-2 pr-6 cursor-pointer shadow-sm outline-none"
                                                >
                                                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(num => (
                                                        <option key={num} value={num}>الفصل {num}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {getStatus(selectedCourse) === 'available' && (
                                            <>
                                                <button onClick={() => toggleCart(selectedCourse)} className="w-full bg-white border-2 border-slate-900 hover:bg-slate-50 text-slate-900 py-3.5 rounded-xl font-[800] text-[13px] transition-all shadow-sm active:scale-[0.97]">🛒 إضافة للمحاكي</button>
                                                <button onClick={() => togglePassed(selectedCourse.id)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 rounded-xl font-[800] text-[13px] transition-all shadow-lg shadow-emerald-200/50 active:scale-[0.97]">✅ تأكيد اجتياز المادة</button>
                                            </>
                                        )}
                                        {(getStatus(selectedCourse) === 'passed' || getStatus(selectedCourse) === 'cart') && (
                                            <button onClick={() => getStatus(selectedCourse) === 'passed' ? togglePassed(selectedCourse.id) : toggleCart(selectedCourse)} className="w-full bg-white border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 py-3.5 rounded-xl font-[800] text-[13px] transition-all active:scale-[0.97]">
                                                {getStatus(selectedCourse) === 'passed' ? '✖ إلغاء اجتياز المادة' : '✖ إزالة من المحاكي'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 mt-16">
                                    <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center text-4xl mb-5 shadow-inner">🖱️</div>
                                    <p className="font-bold text-[13px] text-center leading-relaxed">اضغط على أي مادة في الشجرة<br/>لاستكشاف مسارها الأكاديمي</p>
                                </div>
                            )
                        )}

                        {activeTab === 'simulator' && (
                            <div className="space-y-5 sn-card-enter">
                                {!showAiSettings ? (
                                    <button onClick={() => setShowAiSettings(true)} className="w-full bg-gradient-to-l from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white py-4 rounded-[1.25rem] font-[800] shadow-xl shadow-indigo-200/30 flex items-center justify-center gap-3 active:scale-[0.97] transition-all relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-gradient-to-l from-white/0 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <span className="text-2xl relative z-10">🪄</span>
                                        <div className="text-right relative z-10">
                                            <p className="text-[13px]">توليد جدول ذكي</p>
                                            <p className="text-[10px] text-indigo-200/60 font-bold">دع الخوارزمية تخطط فصلك القادم</p>
                                        </div>
                                    </button>
                                ) : (
                                    <div className="bg-indigo-50/70 border border-indigo-100 p-5 rounded-[1.25rem] space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h3 className="font-[800] text-indigo-800 text-[13px]">⚙️ إعدادات التوليد</h3>
                                            <button onClick={() => setShowAiSettings(false)} className="text-slate-400 text-[11px] font-bold hover:text-rose-500 transition-colors">✕ إلغاء</button>
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-indigo-700 mb-1.5 block font-i">الساعات المستهدفة:</label>
                                            <div className="flex bg-white rounded-xl p-1 border border-indigo-100/60 shadow-sm">
                                                {[12, 15, 18].map(h => (
                                                    <button key={h} onClick={() => setTargetHours(h)} className={`flex-1 py-2 text-[12px] font-[800] rounded-lg transition-all ${targetHours === h ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>{h} ساعة</button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-indigo-700 mb-1.5 block font-i">نمط الفصل:</label>
                                            <div className="space-y-2">
                                                {[
                                                    { id: 'heavy', icon: '🏋️', label: 'مكثف (مواد تخصص)' },
                                                    { id: 'balanced', icon: '⚖️', label: 'متوازن (ينصح به)' },
                                                    { id: 'light', icon: '🏖️', label: 'خفيف (مواد جامعة)' },
                                                ].map(p => (
                                                    <button key={p.id} onClick={() => setSchedulePace(p.id)} className={`w-full p-2.5 rounded-xl border text-right transition-all flex items-center gap-2.5 shadow-sm ${schedulePace === p.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-200'}`}>
                                                        <span>{p.icon}</span>
                                                        <span className="text-[12px] font-bold">{p.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <button onClick={executeSmartSchedule} className="w-full bg-indigo-700 hover:bg-indigo-800 text-white py-3 rounded-xl font-[800] text-[13px] shadow-lg hover:-translate-y-0.5 active:scale-[0.97] transition-all">🚀 توليد الآن</button>
                                    </div>
                                )}

                                <button onClick={() => setShow4YearPlan(true)} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-[1.25rem] font-[800] shadow-xl flex items-center justify-center gap-3 active:scale-[0.97] transition-all ring-1 ring-inset ring-white/10 relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-l from-indigo-600/0 to-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <span className="text-2xl relative z-10">🤖</span>
                                    <div className="text-right relative z-10">
                                        <p className="text-[13px] text-indigo-200">خطة تخرج كاملة (محاكاة)</p>
                                        <p className="text-[10px] text-slate-400 font-bold">توزيع المواد المتبقية على كل الفصول</p>
                                    </div>
                                </button>

                                <div className="bg-gradient-to-bl from-slate-900 to-indigo-950 p-5 rounded-[1.25rem] text-white shadow-xl relative overflow-hidden">
                                    <div className="absolute -top-8 -right-8 w-24 h-24 bg-indigo-500/15 rounded-full blur-2xl" />
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-end mb-3">
                                            <p className="font-[800] text-base">الجدول المقترح</p>
                                            <div className="text-right">
                                                <span className={`text-3xl font-[900] leading-none ${totalCartCredits > 18 ? 'text-rose-400' : 'text-amber-400'}`}>{totalCartCredits}</span>
                                                <span className="text-slate-400 text-[10px] font-bold mr-1">/ 18 س</span>
                                            </div>
                                        </div>
                                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${totalCartCredits > 18 ? 'bg-rose-500' : 'bg-gradient-to-l from-indigo-400 to-indigo-500'}`}
                                                style={{ width: `${Math.min((totalCartCredits / 18) * 100, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {workloadAnalysis && (
                                    <div className={`p-3.5 rounded-xl border font-bold text-[12px] leading-relaxed shadow-sm ${workloadAnalysis.cls}`}>{workloadAnalysis.msg}</div>
                                )}

                                {cartIds.length > 0 ? (
                                    <div className="space-y-2.5 pb-8">
                                        <div className="flex justify-between items-center mb-1">
                                            <h4 className="font-[800] text-slate-800 text-[13px]">المواد المختارة ({cartIds.length}):</h4>
                                            <button onClick={() => { setCartIds([]); syncCartWithDB([]); }} className="text-[11px] text-rose-500 font-bold hover:text-rose-600 transition-colors">🗑️ تفريغ</button>
                                        </div>
                                        {courses.filter(c => cartIds.includes(c.id)).map(c => (
                                            <div key={c.id} className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm flex justify-between items-center group hover:border-indigo-200 transition-colors">
                                                <div className="min-w-0 flex-1 ml-3">
                                                    <p className="font-[800] text-[13px] text-slate-800 truncate">{c.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold mt-0.5 font-i">{c.credit_hours} ساعات • {c.code}</p>
                                                </div>
                                                <button onClick={() => toggleCart(c)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all text-xs shrink-0 active:scale-90 shadow-sm">✕</button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <div className="text-3xl mb-2 opacity-30">🛒</div>
                                        <p className="text-[12px] font-bold text-slate-400 font-i">أضف مواد من الشجرة لاستكشاف العبء.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'semesters' && (
                            <div className="space-y-5 sn-card-enter">
                                
                                <div className="bg-gradient-to-br from-emerald-50 to-teal-50/30 p-4 rounded-[1.25rem] border border-emerald-100/60 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center text-lg shadow-md shadow-emerald-200/50">📚</div>
                                        <div>
                                            <h3 className="text-[13px] font-[900] text-emerald-900">سجلك الأكاديمي</h3>
                                            <p className="text-[10px] font-bold text-emerald-700/70">توزيع المواد المنجزة حسب الفصول</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
                                    <button 
                                        onClick={() => setActiveSemesterTab('all')}
                                        className={`px-4 py-2 rounded-xl text-[11px] font-[800] whitespace-nowrap transition-all shadow-sm ${
                                            activeSemesterTab === 'all' 
                                            ? 'bg-slate-900 text-white shadow-md' 
                                            : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        🌐 الكل ({passedIds.length})
                                    </button>
                                    {semesterRecord.sortedSemesters.map(sem => (
                                        <button
                                            key={sem}
                                            onClick={() => setActiveSemesterTab(sem)}
                                            className={`px-4 py-2 rounded-xl text-[11px] font-[800] whitespace-nowrap transition-all shadow-sm ${
                                                activeSemesterTab === sem 
                                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' 
                                                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                                            }`}
                                        >
                                            الفصل {sem}
                                        </button>
                                    ))}
                                </div>

                                <div className="space-y-2.5 pb-8">
                                    {recordDisplayedCourses.map((c, idx) => (
                                        <div 
                                            key={`${activeSemesterTab}-${c.id}`}
                                            className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between hover:border-emerald-200 transition-colors animate-slideDown"
                                            style={{ animationDelay: `${idx * 40}ms` }}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-500 border border-slate-100 shrink-0">
                                                    {c.credit_hours}س
                                                </div>
                                                <div className="min-w-0 truncate pr-2">
                                                    <h4 className="text-[12px] font-[800] text-slate-800 truncate">{c.name}</h4>
                                                    <p className="text-[9px] font-bold text-slate-400 font-mono mt-0.5">{c.code}</p>
                                                </div>
                                            </div>
                                            <div className="shrink-0 flex flex-col items-end gap-1 pl-1">
                                                <span className={`px-2 py-0.5 rounded-[6px] text-[9px] font-[800] border shadow-sm ${getBadgeColor(c.pivot?.grade)}`}>
                                                    {c.pivot?.grade ? `${c.pivot.grade}%` : 'ناجح'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}

                                    {recordDisplayedCourses.length === 0 && (
                                        <div className="text-center py-10 opacity-60">
                                            <div className="text-3xl mb-2">📭</div>
                                            <p className="text-[12px] font-bold text-slate-500">لا يوجد مواد مسجلة.</p>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-200/60">
                                    <Link href={route('calculator.index')} className="w-full bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 py-3 rounded-xl font-[800] text-[12px] transition-all flex items-center justify-center gap-2 shadow-sm">
                                        تعديل العلامات والفصول في الحاسبة ⚙️
                                    </Link>
                                </div>

                            </div>
                        )}
                    </div>
                </div>

                {/* ═══ GRAPH AREA ═══ */}
                <div className="flex-1 relative h-full bg-slate-100/50 p-2 md:p-4 w-full" dir="ltr">
                    <div className="w-full h-full bg-white/60 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200/80 shadow-[inset_0_2px_12px_rgba(0,0,0,0.04)] relative overflow-hidden backdrop-blur-sm">

                        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-20 flex flex-wrap justify-center gap-1.5 bg-slate-900/90 backdrop-blur-xl p-1.5 rounded-xl shadow-2xl border border-slate-700/30 max-w-[95%]">
                            {[
                                { id: 'none', label: '🌐 الخطة كاملة', active: 'bg-white text-slate-900 shadow-sm' },
                                { id: 'available', label: '🔓 المتاح', active: 'bg-indigo-600 text-white shadow-[0_0_12px_rgba(79,70,229,0.4)]', dot: 'bg-indigo-300' },
                                { id: 'critical', label: '🚨 المسار الحرج', active: 'bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.4)]', dot: 'bg-rose-300 animate-pulse' },
                            ].map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setFilterMode(f.id)}
                                    className={`px-3.5 py-2 rounded-lg text-[11px] font-[800] transition-all flex items-center gap-1.5 ${filterMode === f.id ? f.active : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                                >
                                    {f.dot && <span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />}
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {/* 🔥 الدليل (Legend) المحدث 🔥 */}
                        <div className="absolute bottom-4 left-4 z-20 bg-white/95 backdrop-blur-md p-3.5 rounded-xl shadow-lg border border-slate-200/60 hidden md:flex flex-col gap-2">
                            <p className="text-[9px] font-[900] text-slate-400 uppercase tracking-wider mb-1">دليل الألوان والرموز</p>
                            
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-2">
                                {[
                                    { color: 'bg-[#10b981]', label: 'منجز' },
                                    { color: 'bg-[#6366f1]', label: 'متاح للتسجيل' },
                                    { color: 'bg-[#f59e0b]', label: 'في المحاكي' },
                                    { color: 'bg-slate-200', label: 'مغلق' },
                                ].map(l => (
                                    <div key={l.label} className="flex items-center gap-2">
                                        <span className={`w-3 h-3 rounded-[4px] ${l.color} shadow-sm`} />
                                        <span className="text-[10px] font-bold text-slate-600" dir="rtl">{l.label}</span>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-0 border-t-[2.5px] border-dashed border-slate-400 ml-[-2px]"></div>
                                    <span className="text-[10px] font-bold text-slate-500">مادة اختيارية</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] w-3 text-center">📝</span>
                                    <span className="text-[10px] font-bold text-slate-500">مادة تحتوي على لمحة</span>
                                </div>
                            </div>
                        </div>

                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodeClick={onNodeClick}
                            onPaneClick={onPaneClick}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            fitView
                            fitViewOptions={{ padding: 0.15, minZoom: 0.1, maxZoom: 1.1 }}
                            minZoom={0.1}
                            maxZoom={1.5}
                            proOptions={{ hideAttribution: true }}
                            className="react-flow-rtl-fix"
                        >
                            <Controls
                                position="bottom-left"
                                className="bg-white border-slate-200 shadow-xl rounded-xl fill-slate-700 m-4 overflow-hidden"
                                showInteractive={false}
                            />
                            <Background color="#94a3b8" gap={28} size={1.2} variant="dots" opacity={0.35} />
                            <MiniMap
                                nodeBorderRadius={6}
                                nodeColor={(n) => {
                                    const html = n.data?.label?.props?.dangerouslySetInnerHTML?.__html || '';
                                    if (html.includes('#059669')) return '#a7f3d0';
                                    if (html.includes('#d97706')) return '#fde68a';
                                    if (html.includes('#4338ca')) return '#c7d2fe';
                                    return '#f1f5f9';
                                }}
                                maskColor="rgba(248,250,252,0.85)"
                                className="rounded-2xl border border-slate-200 shadow-xl overflow-hidden m-4 bg-white/80 backdrop-blur-sm"
                                position="bottom-right"
                                zoomable
                                pannable
                            />
                        </ReactFlow>
                    </div>
                </div>
            </div>
        </div>
    );
}

Tree.layout = page => <MainLayout children={page} />;