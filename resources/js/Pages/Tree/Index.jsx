import React, { useMemo, useState, useCallback, useEffect } from 'react';
import ReactFlow, {
    MiniMap,
    Controls,
    Background,
    MarkerType,
    useNodesState,
    useEdgesState,
} from 'reactflow';
import dagre from 'dagre';
import axios from 'axios';
import Swal from 'sweetalert2';
import { Head, Link } from '@inertiajs/react';
import 'reactflow/dist/style.css';

// --- إعدادات الأبعاد للبطاقات ---
const nodeWidth = 220;
const nodeHeight = 95;

// --- خوارزمية الترتيب الشجري (Dagre) ---
const getLayoutedElements = (nodes, edges) => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    
    // ranksep: المسافة الرأسية (طول السهم) | nodesep: المسافة الأفقية بين المواد
    dagreGraph.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 130 });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    return nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
            ...node,
            targetPosition: 'top',
            sourcePosition: 'bottom',
            position: {
                x: nodeWithPosition.x - nodeWidth / 2,
                y: nodeWithPosition.y - nodeHeight / 2,
            },
        };
    });
};

export default function Tree({ courses = [], passed_course_ids = [] }) {
    const [passedIds, setPassedIds] = useState(passed_course_ids);

    // دالة تحديد حالة المادة
    const getStatus = useCallback((course) => {
        if (passedIds.includes(course.id)) return 'passed';
        if (!course.prerequisites || course.prerequisites.length === 0) return 'available';
        const allDone = course.prerequisites.every(p => passedIds.includes(p.id));
        return allDone ? 'available' : 'locked';
    }, [passedIds]);

    // بناء العقد والأسهم مع التصميم الاحترافي الجديد
    const { initialNodes, initialEdges } = useMemo(() => {
        const nodes = [];
        const edges = [];

        courses.forEach((course) => {
            const status = getStatus(course);
            const courseId = course.id.toString();

            // 🔥 تصميم البطاقات باستخدام Tailwind 🔥
            let cardStyle = '';
            let icon = '';

            if (status === 'passed') {
                cardStyle = 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-emerald-100/50 hover:shadow-emerald-200';
                icon = '✅';
            } else if (status === 'available') {
                cardStyle = 'bg-white border-blue-500 text-blue-900 shadow-blue-100/50 cursor-pointer hover:shadow-xl hover:shadow-blue-200 hover:-translate-y-1';
                icon = '🔓';
            } else {
                cardStyle = 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-80 grayscale-[30%]';
                icon = '🔒';
            }

            nodes.push({
                id: courseId,
                // نلغي ستايل ReactFlow الافتراضي لنتحكم به بالكامل عبر Tailwind
                style: { padding: 0, border: 'none', background: 'transparent', width: nodeWidth, height: nodeHeight },
                data: { 
                    label: (
                        <div className={`w-full h-full rounded-2xl border-2 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 shadow-lg ${cardStyle}`}>
                            
                            {/* الأيقونة العلوية */}
                            <div className="absolute top-2.5 right-3 text-sm drop-shadow-sm">{icon}</div>
                            
                            {/* شارة الساعات */}
                            <div className="absolute top-2.5 left-3 text-[9px] font-black bg-white/80 px-1.5 py-0.5 rounded text-slate-500 backdrop-blur-sm shadow-sm">
                                {course.credit_hours} س
                            </div>

                            {/* اسم المادة */}
                            <div className="font-black text-[13px] text-center px-4 mt-2 leading-snug">
                                {course.name}
                            </div>
                            
                            {/* رمز المادة */}
                            <div className="mt-1.5 text-[10px] font-mono font-bold tracking-wider bg-white/70 px-2 py-0.5 rounded-md text-slate-600">
                                {course.code}
                            </div>

                            {/* شريط النوع (إجباري/اختياري) في الأسفل */}
                            <div className={`absolute bottom-0 left-0 h-1.5 w-full ${course.type === 'compulsory' ? 'bg-indigo-500' : 'bg-amber-400'}`}></div>
                        </div>
                    ) 
                },
            });

            // رسم الأسهم 
            if (course.prerequisites) {
                course.prerequisites.forEach((prereq) => {
                    const isSourceDone = passedIds.includes(prereq.id);
                    edges.push({
                        id: `e${prereq.id}-${course.id}`,
                        source: prereq.id.toString(),
                        target: courseId,
                        type: 'smoothstep',
                        animated: isSourceDone && status !== 'passed', // يتحرك السهم إذا انفتح الطريق
                        style: { 
                            stroke: isSourceDone ? '#10b981' : '#cbd5e1', // أخضر إذا مفتوح، رمادي إذا مغلق
                            strokeWidth: isSourceDone ? 3 : 2,
                            transition: 'stroke 0.3s ease'
                        },
                        markerEnd: { 
                            type: MarkerType.ArrowClosed, 
                            color: isSourceDone ? '#10b981' : '#cbd5e1',
                            width: 15, height: 15
                        },
                    });
                });
            }
        });

        const layouted = getLayoutedElements(nodes, edges);
        return { initialNodes: layouted, initialEdges: edges };
    }, [courses, passedIds, getStatus]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    useEffect(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
    }, [initialNodes, initialEdges, setNodes, setEdges]);

    // 🔥 التفاعل مع المادة (AJAX)
    const onNodeClick = useCallback(async (event, node) => {
        const courseId = parseInt(node.id);
        const course = courses.find(c => c.id === courseId);
        if (!course) return;

        const status = getStatus(course);

        // تنبيه احترافي للمادة المغلقة
        if (status === 'locked') {
            const missing = course.prerequisites.filter(p => !passedIds.includes(p.id)).map(p => p.name);
            Swal.fire({
                icon: 'lock',
                iconHtml: '🔒',
                title: 'المادة مقفلة!',
                html: `<div class="text-sm text-slate-600 mt-2">تحتاج لاجتياز المتطلبات التالية أولاً:<br><br><b class="text-rose-500">${missing.join(' <br> ')}</b></div>`,
                confirmButtonText: 'حسناً',
                confirmButtonColor: '#3b82f6',
                customClass: { popup: 'rounded-3xl font-cairo' }
            });
            return;
        }

        // إرسال التحديث
        try {
            const response = await axios.post(route('tree.toggle'), { course_id: courseId });
            
            if (response.data.status === 'added') {
                setPassedIds(prev => [...prev, courseId]);
                Swal.fire({
                    toast: true, position: 'top-end', icon: 'success',
                    title: 'تم تسجيل إنجاز المادة! 👏', showConfirmButton: false, timer: 2000,
                    customClass: { popup: 'font-cairo rounded-xl shadow-xl' }
                });
            } else {
                setPassedIds(prev => prev.filter(id => id !== courseId));
            }
        } catch (error) {
            Swal.fire('خطأ', 'حدثت مشكلة بالاتصال', 'error');
        }
    }, [courses, passedIds, getStatus]);

    // نسبة الإنجاز
    const progress = useMemo(() => {
        const total = courses.length;
        const done = passedIds.length;
        return total > 0 ? Math.round((done / total) * 100) : 0;
    }, [courses, passedIds]);

    return (
        <div className="h-screen w-full flex flex-col bg-[#f8fafc]" dir="ltr">
            <Head title="خريطتي الأكاديمية - سنفور" />

            {/* استدعاء خط Cairo لفرضه على كامل الصفحة ومحتوى الشجرة */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
                body, .react-flow { font-family: 'Cairo', sans-serif !important; }
                .swal2-html-container { font-family: 'Cairo', sans-serif !important; }
            `}</style>
            
            {/* الهيدر الزجاجي (Glassmorphism) */}
            <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 p-4 shadow-sm z-10 flex justify-between items-center px-8 relative" dir="rtl">
                
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center text-white text-lg shadow-lg">🎓</div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 leading-tight">مساري الأكاديمي</h1>
                        <span className="text-[11px] font-bold text-slate-500">الخطة التفاعلية الذكية</span>
                    </div>
                </div>

                {/* شريط الإنجاز المطور */}
                <div className="flex-1 max-w-md mx-10 hidden md:block">
                    <div className="flex justify-between text-[11px] font-black text-slate-600 mb-1.5 px-1">
                        <span>إنجاز الخطة</span>
                        <span className="text-indigo-600">{progress}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 shadow-inner relative">
                        <div 
                            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-1000 ease-out relative" 
                            style={{ width: `${progress}%` }}
                        >
                            {/* تأثير لمعان داخل الشريط */}
                            <div className="absolute top-0 left-0 w-full h-full bg-white/20 animate-pulse"></div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {/* مفتاح الألوان (Legend) */}
                    <div className="hidden lg:flex gap-4 text-xs font-bold text-slate-500 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-emerald-400 rounded-md shadow-sm"></span> منجز</div>
                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-blue-500 rounded-md shadow-sm"></span> متاح</div>
                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-slate-200 border border-slate-300 rounded-md shadow-sm"></span> مغلق</div>
                    </div>
                    
                    <Link 
                        href={route('dashboard')} 
                        className="px-6 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-black transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 flex items-center gap-2"
                    >
                        <span>لوحة التحكم</span>
                        <span className="text-lg">➔</span>
                    </Link>
                </div>
            </div>

            {/* منطقة الرسم التفاعلي */}
            <div className="flex-1 w-full h-full relative overflow-hidden bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodeClick={onNodeClick}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    fitView
                    minZoom={0.05}
                    maxZoom={1.5}
                    className="react-flow-custom"
                >
                    <Controls 
                        position="bottom-right" 
                        className="bg-white border-slate-200 shadow-xl rounded-xl overflow-hidden fill-slate-700"
                    />
                    <MiniMap 
                        nodeColor={(n) => {
                            if (n.style.background.includes('emerald')) return '#34d399';
                            if (n.style.background.includes('blue')) return '#3b82f6';
                            return '#cbd5e1';
                        }} 
                        maskColor="rgba(248, 250, 252, 0.8)" 
                        style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                        zoomable pannable
                    />
                    {/* خلفية منقطة (Dots) بدلاً من الشبكة العادية */}
                    <Background color="#cbd5e1" gap={30} size={1.5} variant="dots" />
                </ReactFlow>
            </div>
        </div>
    );
}