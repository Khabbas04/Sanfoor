import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, { Controls, Background, MarkerType, useNodesState, useEdgesState, getRectOfNodes, getTransformForBounds } from 'reactflow';
import dagre from 'dagre';
import { toPng } from 'html-to-image';
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
const MOBILE_NODE_WIDTH = 160;
const MOBILE_NODE_HEIGHT = 76;
const ELECTIVE_MAX_HOURS = 9;
const REQUIRED_TYPE_HOURS = {
    compulsory: 87,
    supporting: 6,
    university_req: 30,
};

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

    // Some plans arrive with all courses in the same semester value.
    // In that case, derive a visual level from prerequisite depth so the graph
    // becomes layered (compact/square-ish) instead of one ultra-wide row.
    const nodeIds = new Set(nodes.map((node) => node.id));
    const rawSemesters = nodes
        .map((node) => parseInt(node.data?.semester, 10))
        .filter((value) => !Number.isNaN(value) && value > 0);
    const uniqueRawSemesters = new Set(rawSemesters);
    const shouldDeriveLevels = nodes.length >= 16 && uniqueRawSemesters.size <= 2;

    const layoutSemesterById = new Map();

    if (shouldDeriveLevels) {
        const indegree = new Map();
        const nextById = new Map();
        const depth = new Map();

        nodes.forEach((node) => {
            indegree.set(node.id, 0);
            nextById.set(node.id, []);
            depth.set(node.id, 1);
        });

        edges.forEach((edge) => {
            if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return;
            nextById.get(edge.source)?.push(edge.target);
            indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1);
        });

        const queue = [];
        indegree.forEach((value, id) => {
            if (value === 0) queue.push(id);
        });

        while (queue.length > 0) {
            const current = queue.shift();
            const currentDepth = depth.get(current) || 1;
            const nextNodes = nextById.get(current) || [];

            nextNodes.forEach((nextId) => {
                depth.set(nextId, Math.max(depth.get(nextId) || 1, currentDepth + 1));
                indegree.set(nextId, (indegree.get(nextId) || 1) - 1);
                if ((indegree.get(nextId) || 0) === 0) {
                    queue.push(nextId);
                }
            });
        }

        nodes.forEach((node) => {
            layoutSemesterById.set(node.id, depth.get(node.id) || 1);
        });
    } else {
        nodes.forEach((node) => {
            layoutSemesterById.set(node.id, parseInt(node.data?.semester, 10) || 1);
        });
    }

    dagreGraph.setGraph({
        rankdir: direction,
        ranksep,
        nodesep,
        edgesep: 15
    });

    const sortedNodes = [...nodes].sort((a, b) => {
        const semA = layoutSemesterById.get(a.id) || 1;
        const semB = layoutSemesterById.get(b.id) || 1;
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

    const semesters = sortedNodes.map((n) => layoutSemesterById.get(n.id) || 1).filter((s) => !Number.isNaN(s));
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
            const sem = layoutSemesterById.get(node.id) || 1;
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
    const [compareMode, setCompareMode] = useState(false);
    const [compareFirstCourse, setCompareFirstCourse] = useState(null);
    const [compareCourse, setCompareCourse] = useState(null);
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
    const [flowInstance, setFlowInstance] = useState(null);
    const [isFullScreen, setIsFullScreen] = useState(false);

    const isMobile = viewportWidth < 1024;
    const isPortraitMobile = isMobile && viewportHeight > viewportWidth;
    const isLandscapeMobile = isMobile && viewportWidth >= viewportHeight;
    const showRotateHint = isPortraitMobile && !dismissedRotateHint;
    const orientationRef = useRef(isLandscapeMobile ? 'landscape' : 'portrait');
    const filterButtonSizing = isLandscapeMobile ? 'px-3 py-1.5 text-[10px]' : 'px-3.5 py-2 text-[11px]';

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
            ? (isLandscapeMobile
                ? { width: 170, height: 78, ranksep: 58, nodesep: 18 }
                : { width: MOBILE_NODE_WIDTH, height: MOBILE_NODE_HEIGHT, ranksep: 70, nodesep: 20 })
            : { width: DESKTOP_NODE_WIDTH, height: DESKTOP_NODE_HEIGHT, ranksep: 90, nodesep: 30 }
    ), [isMobile, isLandscapeMobile]);

    const flowView = useMemo(() => (
        isMobile
            ? (isLandscapeMobile
                ? { fitPadding: 0.12, minZoom: 0.55, maxZoom: 2.2 }
                : { fitPadding: 0.28, minZoom: 0.35, maxZoom: 2 })
            : { fitPadding: 0.2, minZoom: 0.1, maxZoom: 1.5 }
    ), [isMobile, isLandscapeMobile]);

    const flowCourses = useMemo(
        () => (Array.isArray(courses) ? courses.filter((course) => course.type !== 'university_req') : []),
        [courses]
    );

    const flowCourseIds = useMemo(
        () => new Set(flowCourses.map((course) => course.id)),
        [flowCourses]
    );

    const universityCourses = useMemo(
        () => (Array.isArray(courses) ? courses.filter((course) => course.type === 'university_req') : []),
        [courses]
    );

    const sortedUniversityCourses = useMemo(() => {
        return [...universityCourses].sort((a, b) => {
            const codeA = String(a?.code || '');
            const codeB = String(b?.code || '');
            if (codeA !== codeB) return codeA.localeCompare(codeB);
            return String(a?.name || '').localeCompare(String(b?.name || ''));
        });
    }, [universityCourses]);

    const universityHours = useMemo(
        () => sortedUniversityCourses.reduce((sum, course) => sum + Number(course.credit_hours || 0), 0),
        [sortedUniversityCourses]
    );

    const universityPassedCount = useMemo(
        () => sortedUniversityCourses.filter((course) => passedIds.includes(course.id)).length,
        [sortedUniversityCourses, passedIds]
    );

    const universityCompletionPct = useMemo(() => {
        if (sortedUniversityCourses.length === 0) return 0;
        return Math.round((universityPassedCount / sortedUniversityCourses.length) * 100);
    }, [sortedUniversityCourses.length, universityPassedCount]);

    // University aggregates (no free elective)


    const fitViewSmart = useCallback((duration = 260) => {
        if (!flowInstance) return;
        flowInstance.fitView({ padding: flowView.fitPadding, duration });
    }, [flowInstance, flowView.fitPadding]);

    const [isPrinting, setIsPrinting] = useState(false);

    const handlePrint = useCallback(async () => {
        if (!flowInstance) return;
        try {
            setIsPrinting(true);
            const nodesBounds = getRectOfNodes(flowInstance.getNodes());

            // Define header width and print boundaries including the new academic header at the top
            const headerWidth = Math.max(1000, nodesBounds.width);
            const printBounds = {
                x: nodesBounds.x - (headerWidth > nodesBounds.width ? (headerWidth - nodesBounds.width) / 2 : 0),
                y: nodesBounds.y - 240, // 240px above the topmost node to accommodate the header
                width: Math.max(headerWidth, nodesBounds.width),
                height: nodesBounds.height + 280 // Extra height to include the header
            };

            const padding = 100;
            const exportScale = 2; // For professional high-res quality

            const width = printBounds.width + padding * 2;
            const height = printBounds.height + padding * 2;

            const transform = getTransformForBounds(
                printBounds,
                width,
                height,
                0.05,
                2
            );

            // Create and style the premium academic header to insert into the exported image
            const headerDiv = document.createElement('div');
            headerDiv.id = 'print-plan-header';
            headerDiv.style.position = 'absolute';
            headerDiv.style.width = `${headerWidth}px`;
            headerDiv.style.height = '140px';
            headerDiv.style.left = `${(nodesBounds.x + nodesBounds.width / 2) - headerWidth / 2}px`;
            headerDiv.style.top = `${nodesBounds.y - 190}px`;
            headerDiv.style.zIndex = '9999';
            
            headerDiv.innerHTML = `
                <div style="
                    direction: rtl; 
                    font-family: 'Cairo', 'Inter', sans-serif; 
                    background: #ffffff; 
                    border: 4px double #1e293b; 
                    border-radius: 24px; 
                    padding: 20px 40px; 
                    box-sizing: border-box; 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                    width: 100%; 
                    height: 100%;
                    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);
                ">
                    <!-- Right side: University info -->
                    <div style="text-align: right; display: flex; flex-direction: column; justify-content: center;">
                        <h2 style="margin: 0; font-size: 20px; font-weight: 900; color: #0f172a;">جامعة الزرقاء</h2>
                        <h3 style="margin: 4px 0 0 0; font-size: 13px; font-weight: 700; color: #475569;">${college_name || 'كلية تكنولوجيا المعلومات'}</h3>
                        <p style="margin: 4px 0 0 0; font-size: 11px; font-weight: 700; color: #6366f1;">تخصص ${major_name || 'هندسة البرمجيات'}</p>
                    </div>

                    <!-- Center: Title & Emblem -->
                    <div style="text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <svg style="width: 36px; height: 36px; color: #0f172a; margin-bottom: 2px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">الخطة الدراسية الاسترشادية الشجرية</h1>
                        <span style="font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-top: 1px; letter-spacing: 0.5px;">Sanfoor Academic Infrastructure</span>
                    </div>

                    <!-- Left side: Plan Metadata -->
                    <div style="text-align: left; display: flex; flex-direction: column; justify-content: center; align-items: flex-end;">
                        <div style="background: #f1f5f9; padding: 5px 12px; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 4px;">
                            <span style="font-size: 10px; font-weight: 800; color: #1e293b;">رقم إصدار الخطة: </span>
                            <span style="font-size: 11px; font-weight: 900; color: #4f46e5;">خطة ${study_plan_version || 'معتمدة'}</span>
                        </div>
                        <p style="margin: 0; font-size: 10px; font-weight: 700; color: #64748b;">تاريخ التصدير: <span style="color: #0f172a; font-weight: 800;">${new Date().toLocaleDateString('ar-JO', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
                        <p style="margin: 2px 0 0 0; font-size: 10px; font-weight: 700; color: #10b981;">الحالة الأكاديمية: معتمدة رسمياً</p>
                    </div>
                </div>
            `;

            // Hide the background dots for a cleaner print
            const elementsToHide = document.querySelectorAll('.react-flow__background');
            elementsToHide.forEach(el => el.style.display = 'none');

            // Temporarily append the header to the React Flow viewport so html-to-image captures it
            const viewport = document.querySelector('.react-flow__viewport');
            viewport.appendChild(headerDiv);

            const dataUrl = await toPng(viewport, {
                backgroundColor: '#ffffff',
                width: width,
                height: height,
                style: {
                    width: `${width}px`,
                    height: `${height}px`,
                    transform: `translate(${transform[0]}px, ${transform[1]}px) scale(${transform[2]})`,
                    transformOrigin: 'top left'
                },
                pixelRatio: exportScale,
            });

            // Clean up and remove the temporary header element
            viewport.removeChild(headerDiv);
            elementsToHide.forEach(el => el.style.display = '');

            // Trigger download instead of window.print()
            const link = document.createElement('a');
            link.download = `study_plan_${major_name || 'plan'}.png`;
            link.href = dataUrl;
            link.click();

            setIsPrinting(false);

            Swal.fire({
                icon: 'success',
                title: 'تم التصدير بنجاح!',
                text: 'تم حفظ الخطة كصورة احترافية بدقة عالية تحتوي على معلومات الخطة والتخصص.',
                ...swalTheme
            });
        } catch (error) {
            console.error('Print failed', error);
            setIsPrinting(false);
            Swal.fire({
                icon: 'error',
                title: 'خطأ في التصدير',
                text: 'حدث خطأ أثناء محاولة حفظ الصورة.',
                ...swalTheme
            });
        }
    }, [flowInstance, major_name, college_name, study_plan_version]);

    const toggleFullScreen = useCallback(() => {
        setIsFullScreen((prev) => !prev);
        if (isMobile) setIsSidebarOpen(false);
        setTimeout(() => fitViewSmart(260), 140);
    }, [fitViewSmart, isMobile]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isFullScreen) {
                setIsFullScreen(false);
                setTimeout(() => fitViewSmart(260), 140);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFullScreen, fitViewSmart]);

    const handleZoom = useCallback((delta) => {
        if (!flowInstance) return;
        const current = flowInstance.getZoom();
        const next = Math.min(flowView.maxZoom, Math.max(flowView.minZoom, current + delta));
        flowInstance.zoomTo(next, { duration: 160 });
    }, [flowInstance, flowView.maxZoom, flowView.minZoom]);

    const nodeSnapGrid = useMemo(() => (
        isMobile ? [16, 16] : [20, 20]
    ), [isMobile]);

    const snapPositionToGrid = useCallback((position) => {
        const [gridX, gridY] = nodeSnapGrid;
        return {
            x: Math.round((Number(position?.x) || 0) / gridX) * gridX,
            y: Math.round((Number(position?.y) || 0) / gridY) * gridY,
        };
    }, [nodeSnapGrid]);

    const resolveNonOverlappingPosition = useCallback((nodeId, droppedPosition, currentPositions = {}) => {
        const safeGap = 14;
        const nodeWidth = nodeDimensions.width;
        const nodeHeight = nodeDimensions.height;
        const [gridX, gridY] = nodeSnapGrid;

        const snapped = snapPositionToGrid(droppedPosition);

        const occupiedEntries = Object.entries(currentPositions)
            .filter(([existingId]) => existingId !== nodeId.toString())
            .map(([existingId, pos]) => ({
                id: existingId,
                x: Number(pos?.x) || 0,
                y: Number(pos?.y) || 0,
            }));

        const collidesWithAny = (candidate) => {
            return occupiedEntries.some((entry) => {
                const overlapX = Math.abs(candidate.x - entry.x) < (nodeWidth + safeGap);
                const overlapY = Math.abs(candidate.y - entry.y) < (nodeHeight + safeGap);
                return overlapX && overlapY;
            });
        };

        if (!collidesWithAny(snapped)) {
            return snapped;
        }

        const maxRadius = 24;
        for (let radius = 1; radius <= maxRadius; radius += 1) {
            const candidates = [
                { x: snapped.x + radius * gridX, y: snapped.y },
                { x: snapped.x - radius * gridX, y: snapped.y },
                { x: snapped.x, y: snapped.y + radius * gridY },
                { x: snapped.x, y: snapped.y - radius * gridY },
                { x: snapped.x + radius * gridX, y: snapped.y + radius * gridY },
                { x: snapped.x + radius * gridX, y: snapped.y - radius * gridY },
                { x: snapped.x - radius * gridX, y: snapped.y + radius * gridY },
                { x: snapped.x - radius * gridX, y: snapped.y - radius * gridY },
            ];

            const match = candidates.find((candidate) => !collidesWithAny(candidate));
            if (match) {
                return match;
            }
        }

        return snapped;
    }, [nodeDimensions.width, nodeDimensions.height, nodeSnapGrid, snapPositionToGrid]);

    const layoutSeedPositions = useMemo(() => {
        if (!Array.isArray(flowCourses) || flowCourses.length === 0) {
            return new Map();
        }

        const layoutNodes = flowCourses.map((course) => ({
            id: course.id.toString(),
            position: { x: 0, y: 0 },
            data: {
                semester: parseInt(course.semester) || 1,
                code: course.code || '',
            },
        }));

        const layoutEdges = [];
        flowCourses.forEach((course) => {
            course.prerequisites?.forEach((prereq) => {
                if (!flowCourseIds.has(prereq.id)) return;
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
    }, [flowCourses, flowCourseIds, nodeDimensions]);

    useEffect(() => {
        if (!Array.isArray(flowCourses) || flowCourses.length === 0) return;

        const currentIds = new Set(flowCourses.map((course) => course.id.toString()));

        setNodePositions((prev) => {
            const next = { ...prev };

            flowCourses.forEach((course) => {
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
    }, [flowCourses, layoutSeedPositions]);

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
        if (isLandscapeMobile) {
            setIsSidebarOpen(false);
        }
    }, [isLandscapeMobile]);

    useEffect(() => {
        if (isLandscapeMobile) {
            setIsFullScreen(true);
        }
    }, [isLandscapeMobile]);

    useEffect(() => {
        if (!flowInstance) return;
        const orientation = isLandscapeMobile ? 'landscape' : 'portrait';
        if (orientationRef.current !== orientation) {
            orientationRef.current = orientation;
            const timer = setTimeout(() => fitViewSmart(240), 140);
            return () => clearTimeout(timer);
        }
    }, [isLandscapeMobile, fitViewSmart, flowInstance]);

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
        if (passedIds.includes(course.id)) {
            // Check if the latest attempt for this course is a failure (grade < 50)
            const passedCourse = Array.isArray(localPassedCourses)
                ? localPassedCourses.filter(c => c.id === course.id)
                : [];
            if (passedCourse.length > 0) {
                // Get the latest attempt (highest attempt_number)
                const latestAttempt = passedCourse.reduce((latest, c) => {
                    const attemptNum = c?.pivot?.attempt_number || 1;
                    const latestNum = latest?.pivot?.attempt_number || 1;
                    return attemptNum > latestNum ? c : latest;
                }, passedCourse[0]);
                const grade = latestAttempt?.pivot?.grade;
                if (grade !== null && grade !== undefined && parseFloat(grade) < 50) {
                    return 'failed';
                }
            }
            return 'passed';
        }
        if (cartIds.includes(course.id)) return 'cart';
        if (isLockedByHours(course)) return 'locked';
        if (!course.prerequisites || course.prerequisites.length === 0) return 'available';
        return course.prerequisites.every(p => passedIds.includes(p.id)) ? 'available' : 'locked';
    }, [passedIds, cartIds, isLockedByHours, localPassedCourses]);

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
            const manualDifficultyRaw = Number(course.difficulty_level ?? 3);
            const manualDifficulty = Number.isFinite(manualDifficultyRaw)
                ? Math.min(5, Math.max(1, manualDifficultyRaw))
                : 3;
            const manualDifficultyScore = (manualDifficulty - 1) * 25;
            const baseDifficulty =
                ((100 - avgGrade) * 0.5)
                + (failRate * 0.35)
                + Math.min(prerequisitesCount * 7, 25)
                + ((recommendedYear - 1) * 6);
            const blendedDifficulty = (baseDifficulty * 0.7) + (manualDifficultyScore * 0.3);

            return {
                ...course,
                recommended_year: recommendedYear,
                avg_grade: Number(avgGrade.toFixed(1)),
                fail_rate: Number(failRate.toFixed(1)),
                graded_attempts: Number(course.graded_attempts || 0),
                prerequisites_count: prerequisitesCount,
                manual_difficulty: manualDifficulty,
                difficulty_score: Math.max(0, Math.min(100, Number(blendedDifficulty.toFixed(1)))),
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
        const titleFontSize = isMobile ? (isLandscapeMobile ? '11.5px' : '11px') : '12px';
        const titleLineHeight = isMobile ? '1.35' : '1.45';
        const badgeFontSize = isMobile ? (isLandscapeMobile ? '9px' : '8.5px') : '9.5px';
        const metaFontSize = isMobile ? '8.5px' : '9px';
        const chipPadding = isMobile ? '2px 6px' : '2px 7px';
        const metaPadding = isMobile ? '1px 6px' : '1px 7px';
        const typeLabelFontSize = isMobile ? '8px' : '8.5px';
        const typeLabelPadding = isMobile ? '2px 6px' : '2px 7px';
        const initialNodes = [];
        const initialEdges = [];

        const backwardIds = selectedCourse ? Array.from(getBackwardPath(selectedCourse.id)) : [];
        const forwardIds = selectedCourse
            ? flowCourses
                .filter((c) => c.prerequisites?.some((p) => p.id === selectedCourse.id))
                .map((c) => c.id)
            : [];
        const connectedIds = [...new Set([...(selectedCourse ? [selectedCourse.id] : []), ...backwardIds, ...forwardIds])];

        flowCourses.forEach((course) => {
            const status = getStatus(course);
            const isHourLocked = status === 'locked' && isLockedByHours(course);
            const depth = getCourseDepth(course.id);
            const isCriticalPath = depth >= 2 && status !== 'passed';
            const unlocksCount = flowCourses.filter(c => c.prerequisites?.some(p => p.id === course.id)).length;
            const isBottleneck = unlocksCount >= 3 && status !== 'passed';
            const difficultyLevel = Number(course.difficulty_level ?? 3);
            const difficultyBand = difficultyLevel <= 2 ? 'easy' : (difficultyLevel === 3 ? 'balanced' : 'heavy');

            const isElective = course.type === 'elective';
            const isSupporting = course.type === 'supporting';
            const isUniversityReq = course.type === 'university_req';
            const hasDescription = course.description && course.description.trim() !== '';

            // 🆕 دالة الحصول على لون الصعوبة
            const getDifficultyColor = (difficulty) => {
                if (!difficulty) return null;
                if (difficulty >= 4) return { label: 'مكثّف', color: '#ef4444', icon: '🔥', bg: 'rgba(239,68,68,0.2)', border: '#f87171' };
                if (difficulty === 3) return { label: 'متوازن', color: '#f59e0b', icon: '⚡', bg: 'rgba(245,158,11,0.2)', border: '#fbbf24' };
                return { label: 'خفيف', color: '#10b981', icon: '✨', bg: 'rgba(16,185,129,0.2)', border: '#6ee7b7' };
            };
            const difficultyInfo = getDifficultyColor(course.difficulty_level);

            const themes = {
                passed: { bg: 'background:linear-gradient(135deg,#059669,#10b981)', border: 'border:1.5px solid rgba(16,185,129,0.8)', badgeBg: 'rgba(255,255,255,0.2)', textColor: '#fff', statusLabel: 'منجز', statusIcon: '✅' },
                failed: { bg: 'background:linear-gradient(135deg,#dc2626,#ef4444)', border: 'border:1.5px solid rgba(239,68,68,0.8)', badgeBg: 'rgba(255,255,255,0.2)', textColor: '#fff', statusLabel: 'راسب', statusIcon: '❌' },
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
            if (filterMode === 'easy' && difficultyBand !== 'easy') isFilteredOut = true;
            if (filterMode === 'balanced' && difficultyBand !== 'balanced') isFilteredOut = true;
            if (filterMode === 'heavy' && difficultyBand !== 'heavy') isFilteredOut = true;

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
            if (isElective) typeLabelHtml = `<span style="font-size:${typeLabelFontSize};font-weight:900;padding:${typeLabelPadding};border-radius:4px;background:rgba(0,0,0,0.15);color:${t.textColor};">اختياري</span>`;
            if (isSupporting) typeLabelHtml = `<span style="font-size:${typeLabelFontSize};font-weight:900;padding:${typeLabelPadding};border-radius:4px;background:rgba(0,0,0,0.15);color:${t.textColor};">مساندة</span>`;
            if (isUniversityReq) typeLabelHtml = `<span style="font-size:${typeLabelFontSize};font-weight:900;padding:${typeLabelPadding};border-radius:4px;background:rgba(0,0,0,0.15);color:${t.textColor};">جامعة</span>`;

            const nodeHtml = `
                <div class="sn-node-hover" style="width:100%;height:100%;${shapeStyle}display:flex;flex-direction:column;position:relative;overflow:hidden;transition:all 0.3s ease-out;${t.bg};${finalBorder};${ringStyle}${dimStyle}cursor:pointer;box-shadow:${!isDimmed && !ringStyle.includes('box-shadow') ? '0 4px 12px rgba(0,0,0,0.06)' : ''};">
                    <div style="position:absolute;top:-12px;right:-12px;width:48px;height:48px;background:rgba(255,255,255,0.15);border-radius:50%;filter:blur(12px);"></div>
                    
                    <div style="padding:8px 10px;display:flex;flex-direction:column;height:100%;justify-content:space-between;position:relative;z-index:1;">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="font-size:${badgeFontSize};font-weight:800;padding:${chipPadding};border-radius:6px;background:${t.badgeBg};color:${t.textColor};backdrop-filter:blur(4px);display:flex;align-items:center;gap:3px;letter-spacing:0.3px;">
                                ${statusIcon} ${statusLabel}
                                ${hasDescription ? '<span style="margin-right:3px; font-size:10px; animation: pulse 2s infinite;" title="يوجد لمحة عن المادة">📝</span>' : ''}
                            </span>
                            <div style="display:flex; gap:3px;">
                                ${typeLabelHtml}
                                <span style="font-size:${badgeFontSize};font-weight:800;padding:${chipPadding};border-radius:6px;background:${t.badgeBg};color:${t.textColor};">${course.credit_hours} س</span>
                            </div>
                        </div>
                        <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:2px 4px;">
                            <h3 style="font-weight:900;font-size:${titleFontSize};color:${t.textColor};line-height:${titleLineHeight};text-align:center;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;text-shadow:${status !== 'locked' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none'};">${course.name}</h3>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="font-size:${metaFontSize};font-weight:800;font-family:monospace;text-transform:uppercase;padding:${metaPadding};border-radius:5px;background:${t.badgeBg};color:${t.textColor};">${course.code}</span>
                            ${difficultyInfo ? `<span style="font-size:${metaFontSize};font-weight:800;padding:${metaPadding};border-radius:5px;background:${difficultyInfo.bg};color:${difficultyInfo.color};" title="${difficultyInfo.label}">${difficultyInfo.icon} ${course.difficulty_level}</span>` : ''}
                        </div>
                    </div>
                    ${isCriticalPath ? `<div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#ef4444 0%,#fb7185 50%,#f43f5e 100%);box-shadow:0 0 0 1px rgba(255,255,255,0.12) inset,0 2px 10px rgba(239,68,68,0.25);z-index:20;pointer-events:none;" title="هذه مادة على المسار الحرج"></div>` : ''}
                    ${status === 'failed' ? `<div style="position:absolute;bottom:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#dc2626 0%,#ef4444 50%,#f87171 100%);z-index:20;pointer-events:none;"></div>` : ''}
                </div>
            `;


            const seededPosition = layoutSeedPositions.get(course.id.toString()) || { x: 0, y: 0 };
            const storedPosition = (isMobile && !positionEditMode)
                ? seededPosition
                : (nodePositions[course.id.toString()] || seededPosition);

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
                    if (!flowCourseIds.has(prereq.id)) return;
                    const isSourceDone = passedIds.includes(prereq.id);
                    const isBackwardEdge = backwardIds.includes(prereq.id) && backwardIds.includes(course.id);
                    const isForwardEdge = Boolean(selectedCourse) && prereq.id === selectedCourse.id && forwardIds.includes(course.id);
                    const isActivePath = isBackwardEdge || isForwardEdge;
                    const prereqCourse = flowCourses.find(c => c.id === prereq.id);
                    const prereqDifficultyLevel = Number(prereqCourse?.difficulty_level ?? 3);
                    const prereqDifficultyBand = prereqDifficultyLevel <= 2 ? 'easy' : (prereqDifficultyLevel === 3 ? 'balanced' : 'heavy');

                    const palette = [
                        '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981',
                        '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
                        '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
                    ];
                    // Pick a specific color for all edges originating from this prerequisite
                    const sourceColor = palette[prereq.id % palette.length];

                    let edgeColor = sourceColor;
                    let edgeWidth = isActivePath ? 3.5 : (isSourceDone ? 2.5 : 2);
                    let isAnimated = (isSourceDone && status !== 'passed') || isActivePath;
                    let edgeFilteredOut = false;
                    if (filterMode === 'available' && status !== 'available') edgeFilteredOut = true;
                    if (filterMode === 'easy' && (difficultyBand !== 'easy' || prereqDifficultyBand !== 'easy')) edgeFilteredOut = true;
                    if (filterMode === 'balanced' && (difficultyBand !== 'balanced' || prereqDifficultyBand !== 'balanced')) edgeFilteredOut = true;
                    if (filterMode === 'heavy' && (difficultyBand !== 'heavy' || prereqDifficultyBand !== 'heavy')) edgeFilteredOut = true;

                    let finalOpacity = 1;
                    if ((selectedCourse && !isActivePath) || edgeFilteredOut) {
                        finalOpacity = 0.08;
                    } else if (!isSourceDone && !isActivePath) {
                        finalOpacity = 0.45; // slightly dimmed if not done, but color still visible
                    }

                    initialEdges.push({
                        id: `e${prereq.id}-${course.id}`,
                        source: prereq.id.toString(),
                        target: course.id.toString(),
                        type: 'smoothstep',
                        zIndex: isActivePath ? 1000 : (isSourceDone ? 10 : 0),
                        animated: isAnimated,
                        style: {
                            stroke: edgeColor,
                            strokeWidth: edgeWidth,
                            opacity: finalOpacity,
                            transition: 'all 0.5s ease',
                        },
                        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
                    });
                });
            }
        });

        return { initialNodes, initialEdges };
    }, [flowCourses, flowCourseIds, passedIds, cartIds, selectedCourse, filterMode, getStatus, getCourseDepth, getBackwardPath, getForwardPath, nodeDimensions, isMobile, isLandscapeMobile, canEditTreePositions, positionEditMode, nodePositions, layoutSeedPositions]);

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        const { initialNodes, initialEdges } = buildGraph();
        setNodes(initialNodes);
        setEdges(initialEdges);
    }, [buildGraph]);

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

    const onPaneClick = useCallback(() => {
        if (compareMode && !compareCourse) return; // don't cancel while picking
        setSelectedCourse(null);
        setCompareMode(false);
        setCompareFirstCourse(null);
        setCompareCourse(null);
        if (isMobile) setIsSidebarOpen(false);
    }, [isMobile, compareMode, compareCourse]);

    const onNodeClick = useCallback((e, node) => {
        const course = flowCourses.find(c => c.id === parseInt(node.id));
        if (!course) return;

        if (compareMode) {
            // In compare mode: picking the second course
            if (compareFirstCourse && compareFirstCourse.id !== course.id) {
                setCompareCourse(course);
            } else if (!compareFirstCourse) {
                // Edge case: no first course yet
                setCompareFirstCourse(course);
            }
            return;
        }

        setSelectedCourse(course);
        const next = legacyPlanSemesterToYearTerm(course.semester || 1);
        setTargetYear(next.year);
        setTargetTerm(next.term);
        setTargetSemester(yearTermToSemester(next.year, next.term));
        setActiveTab('details');
        if (isMobile && !isFullScreen) setIsSidebarOpen(true);
    }, [flowCourses, legacyPlanSemesterToYearTerm, yearTermToSemester, isMobile, isFullScreen, compareFirstCourse, compareMode]);

    const onNodeDragStop = useCallback((event, node) => {
        if (!canEditTreePositions || !positionEditMode) return;

        const basePositions = {
            ...nodePositions,
            ...draftNodePositions,
        };

        const droppedPosition = resolveNonOverlappingPosition(node.id, node.position, basePositions);

        setNodePositions((prev) => ({
            ...prev,
            [node.id.toString()]: droppedPosition,
        }));

        setDraftNodePositions((prev) => ({
            ...prev,
            [node.id.toString()]: droppedPosition,
        }));

        setHasUnsavedNodeMoves(true);
    }, [canEditTreePositions, positionEditMode, nodePositions, draftNodePositions, resolveNonOverlappingPosition]);

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

    // 🔄 إعادة المادة المرسوب فيها
    const retakeCourse = async (courseId) => {
        const course = courses.find(c => c.id === courseId);
        if (!course) return;

        const result = await Swal.fire({
            icon: 'question',
            title: '🔄 إعادة المادة',
            html: `هل تريد إعادة مادة <b>${course.name}</b>؟<br/><br/><span style="font-size:12px;color:#64748b;">سيتم إضافة محاولة جديدة وستبقى المادة منجزة في الشجرة.</span>`,
            showCancelButton: true,
            confirmButtonText: 'نعم، أعد المادة',
            cancelButtonText: 'تراجع',
            ...swalTheme
        });

        if (!result.isConfirmed) return;

        try {
            const response = await axios.post(route('tree.retake'), {
                course_id: courseId,
                studied_year: targetYear,
                studied_term: targetTerm,
            });

            if (response.data.status === 'retake_added') {
                // Add new retake record to local state
                setLocalPassedCourses(prev => [...prev, {
                    ...course,
                    pivot: {
                        grade: null,
                        studied_semester: targetSemester,
                        studied_year: targetYear,
                        studied_term: targetTerm,
                        is_retake: true,
                        attempt_number: response.data.attempt_number,
                    }
                }]);

                Swal.fire({
                    icon: 'success',
                    title: 'تمت إضافة الإعادة!',
                    text: response.data.msg,
                    ...swalTheme
                });
                setActiveTab('semesters');
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'خطأ!',
                text: error.response?.data?.msg || 'حدث خطأ أثناء إعادة المادة.',
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

        const electiveCart = courses.filter(c => cartIds.includes(c.id) && c.type === 'elective');
        const electiveCartHours = electiveCart.reduce((sum, c) => sum + (c.credit_hours || 0), 0);
        if (course.type === 'elective' && electiveCartHours + course.credit_hours > ELECTIVE_MAX_HOURS) {
            const overflow = electiveCartHours + course.credit_hours - ELECTIVE_MAX_HOURS;
            const suggestedDrop = electiveCart
                .slice()
                .sort((a, b) => {
                    const aScore = getCoursePriority(a);
                    const bScore = getCoursePriority(b);
                    if (aScore !== bScore) return aScore - bScore;
                    return (Number(a.credit_hours) || 0) - (Number(b.credit_hours) || 0);
                })[0];
            const currentListHtml = electiveCart.length
                ? electiveCart
                    .map(c => `<span style="display:inline-block;background:#fff7ed;border:1px solid #fed7aa;padding:3px 10px;border-radius:10px;margin:3px;font-weight:700;">🎨 ${c.name} (${c.credit_hours}س)</span>`)
                    .join('')
                : '';
            const suggestionHtml = suggestedDrop
                ? `نقترح إزالة <b>${suggestedDrop.name}</b> (${suggestedDrop.credit_hours}س) لتفريغ مساحة.`
                : 'أزل مادة اختيارية أولاً لتوفير مساحة.';

            Swal.fire({
                icon: 'warning',
                title: 'حد الاختياري 9 ساعات',
                html: `الساعات الاختيارية الحالية <b>${electiveCartHours}س</b>.<br/>إضافة <b>${course.name}</b> (${course.credit_hours}س) ستتجاوز الحد بـ <b>${overflow}س</b>.<br/><br/>${currentListHtml ? `<div style="text-align:right;font-size:12px;">${currentListHtml}</div><br/>` : ''}${suggestionHtml}`,
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
            const manualDifficulty = Number(course.manual_difficulty || course.difficulty_level || 3);
            const isHeavy = difficulty >= 65 || Number(course.fail_rate || 0) >= 30 || manualDifficulty >= 4;
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

            // Realism Adjustments based on Pace
            const isOnline = course.type === 'university_req';
            if (schedulePace === 'light') {
                if (isOnline) score += 80; // Huge boost to grab online courses
                score += difficulty < 45 ? 40 : -20; // Boost easy courses
            } else if (schedulePace === 'balanced') {
                if (isOnline) score += 50; // Boost to grab 1 online course
                score += (difficulty > 40 && difficulty < 70) ? 20 : 0; // Favor medium difficulty
            } else if (schedulePace === 'heavy') {
                if (isCompulsory || isMajor) score += 60; // Heavy relies on major courses
                if (isOnline) score -= 50; // Discourage online courses in heavy
            }

            return { course, score, isHeavy, difficulty, unlock, yearGap, difficultyFit, dataConfidence, isOnline };
        }).sort((a, b) => b.score - a.score);

        let newCart = [];
        let currentHours = 0;
        let heavyCount = 0;
        let onlineCount = 0;
        let electiveHours = 0;
        const targetOnline = schedulePace === 'light' ? 2 : (schedulePace === 'balanced' ? 1 : 0);
        const selectedMeta = {};

        const addCourse = (entry) => {
            const { course, isHeavy, difficulty, unlock, yearGap, difficultyFit, dataConfidence, isOnline } = entry;
            if (currentHours + course.credit_hours <= targetHours && !newCart.includes(course.id)) {
                
                // Enforce exact online course target to make it highly realistic
                if (isOnline && onlineCount >= targetOnline) return false;

                // Adjust difficulty thresholds slightly so it doesn't fail to generate a full schedule
                if (schedulePace === 'light' && difficulty > 65) return false;
                if (schedulePace === 'balanced' && difficulty > 85) return false;
                if (course.type === 'elective' && electiveHours + course.credit_hours > ELECTIVE_MAX_HOURS) return false;
                
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
                        isOnline ? '💻 متطلب جامعة (أونلاين)' : `📊 صعوبة ${Math.round(difficulty)}%`,
                        `🔑 يفتح ${unlock} مواد`,
                        `📅 سنة ${course.recommended_year}`,
                    ],
                };

                newCart.push(course.id);
                currentHours += course.credit_hours;
                if (isHeavy) heavyCount += 1;
                if (isOnline) onlineCount += 1;
                if (course.type === 'elective') electiveHours += course.credit_hours;
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
    const electiveCartHours = useMemo(
        () => courses.filter(c => cartIds.includes(c.id) && c.type === 'elective').reduce((acc, c) => acc + (c.credit_hours || 0), 0),
        [courses, cartIds]
    );
    const progressPct = useMemo(() => Math.min(Math.round((totalPassedCredits / 132) * 100), 100), [totalPassedCredits]);
    const typeProgress = useMemo(() => {
        const passedByType = {
            compulsory: 0,
            supporting: 0,
            university_req: 0,
        };

        courses.forEach((course) => {
            if (!passedIds.includes(course.id)) return;
            const type = course.type;
            if (!Object.prototype.hasOwnProperty.call(passedByType, type)) return;
            passedByType[type] += Number(course.credit_hours || 0);
        });

        return {
            compulsory: {
                label: 'إجباري',
                color: 'from-indigo-400 to-indigo-500',
                passed: passedByType.compulsory,
                target: REQUIRED_TYPE_HOURS.compulsory,
            },
            supporting: {
                label: 'مساندة',
                color: 'from-fuchsia-400 to-fuchsia-500',
                passed: passedByType.supporting,
                target: REQUIRED_TYPE_HOURS.supporting,
            },
            university_req: {
                label: 'متطلب جامعة',
                color: 'from-cyan-400 to-cyan-500',
                passed: passedByType.university_req,
                target: REQUIRED_TYPE_HOURS.university_req,
            },
        };
    }, [courses, passedIds]);

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
        if (val < 35) return 'bg-red-200 text-red-900 border-red-300'; // صفر جامعي
        if (val < 50) return 'bg-rose-100 text-rose-700 border-rose-200'; // رسوب
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
        let remainingCourses = [...courses.filter(c => !simulatedPassed.has(c.id))];
        let generatedSemesters = [];
        let currentSem = 1;
        const maxSemesters = 7; // 3.5 years max

        // تتبع الساعات المنجزة لكل نوع لضمان عدم تجاوز الخطة المطلوبة
        let categoryPassedHours = {
            university_req: courses.filter(c => simulatedPassed.has(c.id) && c.type === 'university_req').reduce((s, c) => s + Number(c.credit_hours || 0), 0),
            compulsory: courses.filter(c => simulatedPassed.has(c.id) && c.type === 'compulsory').reduce((s, c) => s + Number(c.credit_hours || 0), 0),
            elective: courses.filter(c => simulatedPassed.has(c.id) && c.type === 'elective').reduce((s, c) => s + Number(c.credit_hours || 0), 0),
            supporting: courses.filter(c => simulatedPassed.has(c.id) && c.type === 'supporting').reduce((s, c) => s + Number(c.credit_hours || 0), 0),
        };

        // حساب الساعات المطلوبة ديناميكياً لكل تخصص بناءً على الشجرة الحالية
        const totalCompulsory = courses.filter(c => c.type === 'compulsory').reduce((acc, c) => acc + (Number(c.credit_hours) || 0), 0);
        const totalSupporting = courses.filter(c => c.type === 'supporting').reduce((acc, c) => acc + (Number(c.credit_hours) || 0), 0);
        const universityReqCap = 30; // متطلبات الجامعة ثابتة تقريباً 30
        const totalPlanHours = 132; // الحد الأدنى للخطة
        
        // الاختياري هو ما يتبقى للوصول لـ 132 ساعة
        const electiveCap = Math.max(0, totalPlanHours - (totalCompulsory + totalSupporting + universityReqCap));

        // حدود الخطة الدراسية الديناميكية للتخصص الحالي
        const caps = { 
            university_req: universityReqCap, 
            compulsory: totalCompulsory > 0 ? totalCompulsory : 87, 
            elective: electiveCap > 0 ? electiveCap : 9, 
            supporting: totalSupporting > 0 ? totalSupporting : 6 
        };

        const normalizeName = (value) => String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[^\u0600-\u06FFa-z0-9 ]+/gi, '');
        const nameHasAll = (name, parts) => {
            const normalized = normalizeName(name);
            return parts.every(part => normalized.includes(normalizeName(part)));
        };

        while (remainingCourses.length > 0 && currentSem <= maxSemesters) {
            const simulatedPassedHours = courses
                .filter(c => simulatedPassed.has(c.id))
                .reduce((sum, c) => sum + Number(c.credit_hours || 0), 0);

            const remainingHours = remainingCourses.reduce((sum, c) => sum + Number(c.credit_hours || 0), 0);
            const isSummer = currentSem % 3 === 0;
            const baseMaxSemHours = isSummer ? 9 : 18;
            const canGraduateBoost = remainingHours <= baseMaxSemHours + 3;
            const maxSemHours = currentSem === 1 ? 12 : (canGraduateBoost ? baseMaxSemHours + 3 : baseMaxSemHours);
            const minSemHours = isSummer ? 0 : 12;

            let availableNow = remainingCourses.filter(c => {
                const type = c.type || 'compulsory';
                
                // التخطيط الواقعي: تطبيق حد الساعات فقط على المواد الاختيارية (elective).
                // جميع المواد الإجبارية (compulsory, supporting, university_req) يجب أن تكون موجودة في الخطة.
                if (type === 'elective' && categoryPassedHours[type] >= (caps[type] || 999) && !cartIds.includes(c.id)) return false;

                const requiredHours = Number(c.minimum_passed_hours || 0);
                if (requiredHours > 0 && simulatedPassedHours < requiredHours) return false;
                if (!c.prerequisites || c.prerequisites.length === 0) return true;
                return c.prerequisites.every(p => simulatedPassed.has(p.id));
            });

            if (availableNow.length === 0) break;

            const remainingOnlineCount = remainingCourses.filter(c => c.type === 'university_req').length;
            const remainingSemestersEstimate = Math.max(1, Math.ceil(remainingHours / baseMaxSemHours));
            const mustPlaceOnline = remainingOnlineCount > 0 && remainingOnlineCount >= remainingSemestersEstimate;

            // الترتيب الذكي: 
            // 1. الأولوية القصوى للمواد التي وضعها الطالب في التسجيل التجريبي.
            // 2. تأخير المواد التي تتطلب 90 ساعة فأكثر (مثل مشاريع التخرج) لنهاية الخطة.
            // 3. ثم المواد التي تفتح مسارات طويلة (المسار الحرج).
            availableNow.sort((a, b) => {
                if (mustPlaceOnline) {
                    const aOnline = a.type === 'university_req';
                    const bOnline = b.type === 'university_req';
                    if (aOnline && !bOnline) return -1;
                    if (!aOnline && bOnline) return 1;
                }
                if (cartIds.includes(a.id) && !cartIds.includes(b.id)) return -1;
                if (!cartIds.includes(a.id) && cartIds.includes(b.id)) return 1;
                
                const aReq = Number(a.minimum_passed_hours || 0);
                const bReq = Number(b.minimum_passed_hours || 0);
                if (aReq >= 90 && bReq < 90) return 1;
                if (bReq >= 90 && aReq < 90) return -1;

                const depthDelta = getCourseDepth(b.id) - getCourseDepth(a.id);
                if (depthDelta !== 0) return depthDelta;
                return (Number(b.credit_hours) || 0) - (Number(a.credit_hours) || 0);
            });

            let semCourses = [];
            let semHours = 0;
            let semOnlineCount = 0; // لضمان عدم تكدس متطلبات الجامعة (الأونلاين) في فصل واحد

            if (currentSem === 1) {
                const pickFirstSemesterCourse = (predicate) => {
                    const match = availableNow.find(c => predicate(c) && !semCourses.some(sc => sc.id === c.id));
                    if (!match) return false;
                    if (semHours + match.credit_hours > maxSemHours) return false;
                    semCourses.push({ ...match, isSummer, currentSem });
                    semHours += match.credit_hours;
                    if (match.type === 'university_req') semOnlineCount += 1;
                    remainingCourses = remainingCourses.filter(rc => rc.id !== match.id);
                    const type = match.type || 'compulsory';
                    if (categoryPassedHours[type] !== undefined) {
                        categoryPassedHours[type] += Number(match.credit_hours || 0);
                    }
                    return true;
                };

                pickFirstSemesterCourse((c) => nameHasAll(c.name, ['اساسيات', 'تكنولوجيا', 'معلومات']));
                pickFirstSemesterCourse((c) => nameHasAll(c.name, ['تصميم', 'منطق', 'رقمي']));
                pickFirstSemesterCourse((c) => nameHasAll(c.name, ['تربية', 'وطنية']));
                pickFirstSemesterCourse((c) => c.type === 'university_req' && nameHasAll(c.name, ['متطلب', 'جامعة', 'اختياري']));
            }

            for (let c of availableNow) {
                if (currentSem === 1 && semHours >= 12) break;
                if (semHours >= maxSemHours) break;
                if (semCourses.some(sc => sc.id === c.id)) continue;
                const isOnline = c.type === 'university_req';
                
                // الحد الواقعي: مادة أونلاين واحدة كحد أقصى في الفصل، إلا إذا أضافها الطالب بيده للتسجيل التجريبي
                if (isOnline && semOnlineCount >= 1 && !cartIds.includes(c.id)) continue;

                if (mustPlaceOnline && semOnlineCount === 0 && !isOnline && availableNow.some(course => course.type === 'university_req')) continue;

                if (semHours + c.credit_hours <= maxSemHours) {
                    semCourses.push({ ...c, isSummer, currentSem });
                    semHours += c.credit_hours;
                    if (isOnline) semOnlineCount++;
                    remainingCourses = remainingCourses.filter(rc => rc.id !== c.id);
                    
                    const type = c.type || 'compulsory';
                    if (categoryPassedHours[type] !== undefined) {
                        categoryPassedHours[type] += Number(c.credit_hours || 0);
                    }
                }
            }

            if (!isSummer && currentSem !== 1 && semHours > 0 && semHours < minSemHours && remainingHours > maxSemHours) {
                const relaxed = availableNow.filter(c => !semCourses.some(sc => sc.id === c.id));
                for (let c of relaxed) {
                    if (semHours >= minSemHours) break;
                    if (semHours + c.credit_hours > maxSemHours) continue;
                    semCourses.push({ ...c, isSummer, currentSem });
                    semHours += c.credit_hours;
                    if (c.type === 'university_req') semOnlineCount++;
                    remainingCourses = remainingCourses.filter(rc => rc.id !== c.id);

                    const type = c.type || 'compulsory';
                    if (categoryPassedHours[type] !== undefined) {
                        categoryPassedHours[type] += Number(c.credit_hours || 0);
                    }
                }
            }

            if (!isSummer && semHours > 0 && semHours < minSemHours && remainingHours > maxSemHours) {
                remainingCourses = [...semCourses.map(c => ({ ...c })), ...remainingCourses];
                semCourses = [];
            }
            semCourses.forEach(c => simulatedPassed.add(c.id));
            if (semCourses.length > 0) {
                generatedSemesters.push(semCourses);
            }
            currentSem++;
        }
        
        // يمكن إضافة المواد المتبقية غير القابلة للجدولة هنا إذا أردنا عرضها
        // if (remainingCourses.length > 0) generatedSemesters.push(remainingCourses);

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
                            <p className="text-sm text-indigo-300/60 font-bold">توزيع ذكي للمواد المتبقية مع مراعاة الفصول الصيفية</p>
                        </div>
                        <button onClick={() => setShow4YearPlan(false)} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center text-white transition-all text-lg relative z-10 active:scale-90">✕</button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#f8fafc]">
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                            {generatedSemesters.map((semCourses, i) => {
                                const semHours = semCourses.reduce((sum, c) => sum + c.credit_hours, 0);
                                const isSummer = semCourses.length > 0 && semCourses[0].isSummer;
                                const semNum = semCourses.length > 0 ? semCourses[0].currentSem : (i + 1);
                                
                                return (
                                    <div key={i} className={`bg-white border rounded-[1.25rem] p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col ${isSummer ? 'border-amber-200' : 'border-slate-200/80'}`} style={{ animationDelay: `${i * 50}ms` }}>
                                        <div className={`text-center py-2.5 rounded-xl mb-3.5 font-[800] text-[13px] border flex justify-between px-3.5 items-center ${isSummer ? 'bg-gradient-to-l from-amber-50 to-orange-50 text-amber-800 border-amber-100/60' : 'bg-gradient-to-l from-indigo-50 to-slate-50 text-indigo-800 border-indigo-100/60'}`}>
                                            <span className="flex items-center gap-1.5">{isSummer ? '☀️ صيفي' : '📅 اعتيادي'} (فصل +{semNum})</span>
                                            <span className={`bg-white px-2 py-0.5 rounded-md text-[10px] font-[800] border ${isSummer ? 'text-amber-600 border-amber-100' : 'text-indigo-600 border-indigo-100'}`}>{semHours} ساعة</span>
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

    const renderDetailsPanel = ({ showCloseButton = true } = {}) => (
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
                    {showCloseButton && (
                        <button onClick={() => setSelectedCourse(null)} className="absolute top-3 left-3 w-7 h-7 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center text-white/60 hover:text-white text-xs transition-all z-20 backdrop-blur-sm border border-white/10">✕</button>
                    )}
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
                    </div>
                </div>

                <div className="flex flex-col gap-2 mt-1">
                    <button
                        type="button"
                        onClick={() => {
                            setCompareMode(true);
                            setCompareFirstCourse(selectedCourse);
                            setCompareCourse(null);
                            if (isMobile) setIsSidebarOpen(false);
                        }}
                        className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-[14px] text-[13px] font-[900] bg-gradient-to-l from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/30 border border-white/10 transition-all active:scale-[0.98]"
                    >
                        <span className="text-xl">⚖️</span>
                        <span>مقارنة المادة مع مادة أخرى</span>
                    </button>
                </div>

                {/* 🆕 نقاط الأولوية + التأثير + الصعوبة */}
                {getStatus(selectedCourse) !== 'passed' && (
                    <div className="grid grid-cols-3 gap-2.5">
                        <div className="group relative bg-indigo-500/15 border border-indigo-400/20 rounded-xl p-3 text-center backdrop-blur-sm overflow-visible">
                            <p className="text-[8px] font-[800] text-indigo-300 uppercase mb-1">الأولوية</p>
                            <p className={`text-2xl font-[900] leading-none ${getCoursePriority(selectedCourse) >= 70 ? 'text-rose-400' : getCoursePriority(selectedCourse) >= 40 ? 'text-amber-400' : 'text-indigo-300'}`}>{getCoursePriority(selectedCourse)}%</p>
                            <p className="text-[8px] text-white/30 font-bold mt-0.5">نسبة</p>
                            <div className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-56 opacity-0 group-hover:opacity-100 group-hover:-translate-y-0 transition-all duration-200 z-30">
                                <div className="relative rounded-xl border border-indigo-200 bg-slate-950/95 px-3 py-2 text-right shadow-2xl backdrop-blur-md">
                                    <p className="text-[10px] font-[900] text-indigo-200 mb-0.5">ما معنى الأولوية؟</p>
                                    <p className="text-[10px] font-bold leading-snug text-white/75">كلما ارتفعت النسبة، كانت المادة أهم في ترتيب دراستك وتأثيرها على التقدم أكبر.</p>
                                    <span className="absolute left-1/2 -bottom-1.5 h-3 w-3 -translate-x-1/2 rotate-45 border-r border-b border-indigo-200 bg-slate-950/95"></span>
                                </div>
                            </div>
                        </div>
                        <div className="group relative bg-violet-500/15 border border-violet-400/20 rounded-xl p-3 text-center backdrop-blur-sm overflow-visible">
                            <p className="text-[8px] font-[800] text-violet-300 uppercase mb-1">التأثير</p>
                            <p className="text-2xl font-[900] text-violet-300 leading-none">{getTotalImpact(selectedCourse.id)}</p>
                            <p className="text-[8px] text-white/30 font-bold mt-0.5">مادة</p>
                            <div className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-56 opacity-0 group-hover:opacity-100 group-hover:-translate-y-0 transition-all duration-200 z-30">
                                <div className="relative rounded-xl border border-violet-200 bg-slate-950/95 px-3 py-2 text-right shadow-2xl backdrop-blur-md">
                                    <p className="text-[10px] font-[900] text-violet-200 mb-0.5">ما معنى التأثير؟</p>
                                    <p className="text-[10px] font-bold leading-snug text-white/75">هذا الرقم يوضح كم مادة أخرى تعتمد على هذه المادة، يعني كم مادة ممكن تتأثر إذا تأخرت.</p>
                                    <span className="absolute left-1/2 -bottom-1.5 h-3 w-3 -translate-x-1/2 rotate-45 border-r border-b border-violet-200 bg-slate-950/95"></span>
                                </div>
                            </div>
                        </div>
                        {selectedCourse.difficulty_level && (
                            <div className={`group relative rounded-xl p-3 text-center backdrop-blur-sm border overflow-visible ${selectedCourse.difficulty_level >= 4 ? 'bg-rose-500/15 border-rose-400/20' : selectedCourse.difficulty_level === 3 ? 'bg-amber-500/15 border-amber-400/20' : 'bg-emerald-500/15 border-emerald-400/20'}`}>
                                <p className={`text-[8px] font-[800] uppercase mb-1 ${selectedCourse.difficulty_level >= 4 ? 'text-rose-300' : selectedCourse.difficulty_level === 3 ? 'text-amber-300' : 'text-emerald-300'}`}>الصعوبة</p>
                                <p className={`text-2xl font-[900] leading-none ${selectedCourse.difficulty_level >= 4 ? 'text-rose-400' : selectedCourse.difficulty_level === 3 ? 'text-amber-400' : 'text-emerald-400'}`}>{selectedCourse.difficulty_level}</p>
                                <p className={`text-[8px] font-bold mt-0.5 ${selectedCourse.difficulty_level >= 4 ? 'text-white/30' : selectedCourse.difficulty_level === 3 ? 'text-white/30' : 'text-white/30'}`}>/5</p>
                                <div className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-56 opacity-0 group-hover:opacity-100 group-hover:-translate-y-0 transition-all duration-200 z-30">
                                    <div className="relative rounded-xl border px-3 py-2 text-right shadow-2xl backdrop-blur-md bg-slate-950/95 border-slate-700/80">
                                        <p className={`text-[10px] font-[900] mb-0.5 ${selectedCourse.difficulty_level >= 4 ? 'text-rose-200' : selectedCourse.difficulty_level === 3 ? 'text-amber-200' : 'text-emerald-200'}`}>ما معنى الصعوبة؟</p>
                                        <p className="text-[10px] font-bold leading-snug text-white/75">هذا الرقم يشرح ثقل المادة الدراسي: خفيف، متوسط، أو مكثف حسب الجهد المتوقع.</p>
                                        <span className="absolute left-1/2 -bottom-1.5 h-3 w-3 -translate-x-1/2 rotate-45 border-r border-b border-slate-700/80 bg-slate-950/95"></span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ⏳ مؤشر مخاطر التأخير */}
                {(getCourseDepth(selectedCourse.id) >= 2 || getTotalImpact(selectedCourse.id) >= 3 || Number(selectedCourse.difficulty_level || 0) >= 4) && (
                    <div className={`rounded-[1.25rem] border p-4 shadow-sm backdrop-blur-sm ${getCourseDepth(selectedCourse.id) >= 3 || getTotalImpact(selectedCourse.id) >= 5 ? 'bg-rose-500/12 border-rose-400/25' : 'bg-amber-500/12 border-amber-400/25'}`}>
                        <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0 ${getCourseDepth(selectedCourse.id) >= 3 || getTotalImpact(selectedCourse.id) >= 5 ? 'bg-rose-500 text-white shadow-[0_0_18px_rgba(244,63,94,0.25)]' : 'bg-amber-500 text-white shadow-[0_0_18px_rgba(245,158,11,0.2)]'}`}>
                                ⏳
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <h4 className={`font-[900] text-[13px] ${getCourseDepth(selectedCourse.id) >= 3 || getTotalImpact(selectedCourse.id) >= 5 ? 'text-rose-200' : 'text-amber-200'}`}>مؤشر مخاطر التأخير</h4>
                                    <span className={`text-[9px] font-[900] px-2 py-1 rounded-full border ${getCourseDepth(selectedCourse.id) >= 3 || getTotalImpact(selectedCourse.id) >= 5 ? 'bg-rose-500/20 text-rose-100 border-rose-400/25' : 'bg-amber-500/20 text-amber-100 border-amber-400/25'}`}>
                                        {getCourseDepth(selectedCourse.id) >= 3 || getTotalImpact(selectedCourse.id) >= 5 ? 'مرتفع' : 'متوسط'}
                                    </span>
                                </div>
                                <p className={`text-[11px] font-bold leading-relaxed ${getCourseDepth(selectedCourse.id) >= 3 || getTotalImpact(selectedCourse.id) >= 5 ? 'text-rose-100/80' : 'text-amber-100/80'}`}>
                                    {getCourseDepth(selectedCourse.id) >= 3 || getTotalImpact(selectedCourse.id) >= 5
                                        ? 'هذه المادة حساسة جدًا لأن التأخير فيها قد يؤخر مواد كثيرة بعدها أو يؤخر التخرج.'
                                        : 'تأخير هذه المادة قد يبطئ مسارك، لأنها ترتبط بعدد مهم من المواد التالية.'}
                                </p>
                            </div>
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
                    {/* 🔄 سجل المحاولات (يظهر إذا في أكثر من محاولة) */}
                    {(() => {
                        const allAttempts = Array.isArray(localPassedCourses)
                            ? localPassedCourses
                                .filter(c => c.id === selectedCourse.id)
                                .sort((a, b) => (a?.pivot?.attempt_number || 1) - (b?.pivot?.attempt_number || 1))
                            : [];
                        if (allAttempts.length <= 1) return null;
                        return (
                            <div className="bg-white/5 border border-white/10 p-4 rounded-[1.25rem] backdrop-blur-sm">
                                <h4 className="text-white/70 font-[800] text-[12px] flex items-center gap-2 mb-2.5">🔄 سجل المحاولات ({allAttempts.length}):</h4>
                                <div className="space-y-2">
                                    {allAttempts.map((attempt, i) => {
                                        const grade = attempt?.pivot?.grade;
                                        const gradeVal = grade !== null && grade !== undefined ? parseFloat(grade) : null;
                                        const isUniversityZero = gradeVal !== null && gradeVal < 35;
                                        const isFailed = gradeVal !== null && gradeVal < 50;
                                        const isPassing = gradeVal !== null && gradeVal >= 50;
                                        const isRetake = attempt?.pivot?.is_retake;
                                        const year = attempt?.pivot?.studied_year;
                                        const term = attempt?.pivot?.studied_term;
                                        const termLabel = term === 1 ? 'الأول' : term === 2 ? 'الثاني' : 'الصيفي';
                                        return (
                                            <div key={i} className={`flex justify-between items-center text-[11px] font-bold p-2.5 rounded-xl border transition-all ${isPassing ? 'bg-emerald-500/15 border-emerald-400/20 text-emerald-300' : isUniversityZero ? 'bg-red-500/20 border-red-400/30 text-red-300' : isFailed ? 'bg-rose-500/15 border-rose-400/20 text-rose-300' : 'bg-white/5 border-white/10 text-white/60'}`}>
                                                <span className="flex items-center gap-2">
                                                    {isPassing ? '✅' : isUniversityZero ? '🟥' : isFailed ? '❌' : '⏳'}
                                                    <span>المحاولة {attempt?.pivot?.attempt_number || i + 1}</span>
                                                    {isRetake && <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-400/20">إعادة</span>}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    {year && term && <span className="text-[9px] text-white/30">سنة {year} - {termLabel}</span>}
                                                    <span className={`font-[800] text-[10px] px-2 py-0.5 rounded-md ${isPassing ? 'bg-emerald-500/20 text-emerald-300' : isUniversityZero ? 'bg-red-500/25 text-red-200' : isFailed ? 'bg-rose-500/20 text-rose-300' : 'bg-white/10 text-white/40'}`}>
                                                        {gradeVal !== null ? (isUniversityZero ? `${grade}% (صفر جامعي)` : `${grade}%`) : 'بدون علامة'}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}

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
                    {getStatus(selectedCourse) === 'cart' && (
                        <button onClick={() => toggleCart(selectedCourse)} className="w-full bg-white/5 border border-white/10 text-white/50 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-400/30 py-3.5 rounded-xl font-[800] text-[13px] transition-all active:scale-[0.97]">
                            ✖ إزالة من التسجيل التجريبي
                        </button>
                    )}
                    
                    {/* زر إعادة المادة للمواد المرسوبة أو المنجزة */}
                    {(getStatus(selectedCourse) === 'failed' || getStatus(selectedCourse) === 'passed') && (
                        <>
                            <div className={`${getStatus(selectedCourse) === 'failed' ? 'bg-rose-500/10 border-rose-400/20' : 'bg-emerald-500/10 border-emerald-400/20'} border p-4 rounded-xl backdrop-blur-sm`}>
                                <div className="flex items-start gap-3">
                                    <span className="text-xl mt-0.5">{getStatus(selectedCourse) === 'failed' ? '❌' : '✅'}</span>
                                    <div>
                                        <h4 className={`${getStatus(selectedCourse) === 'failed' ? 'text-rose-200' : 'text-emerald-200'} font-[900] text-[13px]`}>
                                            {getStatus(selectedCourse) === 'failed' ? 'مادة مرسوبة' : 'مادة منجزة (متاحة للإعادة)'}
                                        </h4>
                                        <p className={`${getStatus(selectedCourse) === 'failed' ? 'text-rose-300/70' : 'text-emerald-300/70'} text-[11px] font-bold mt-0.5 leading-relaxed`}>
                                            {(() => {
                                                const attempts = Array.isArray(localPassedCourses) ? localPassedCourses.filter(c => c.id === selectedCourse.id) : [];
                                                const latest = attempts.reduce((a, b) => ((a?.pivot?.attempt_number || 1) > (b?.pivot?.attempt_number || 1) ? a : b), attempts[0]);
                                                const grade = latest?.pivot?.grade;
                                                const gradeVal = grade !== null && grade !== undefined ? parseFloat(grade) : null;
                                                
                                                if (getStatus(selectedCourse) === 'passed') {
                                                    return gradeVal !== null 
                                                        ? `العلامة الحالية: ${grade}%. يمكنك إعادة تسجيل المادة مرة أخرى لرفع معدلك التراكمي.`
                                                        : `لقد اجتزت هذه المادة، ولكن يمكنك إعادتها لرفع معدلك التراكمي إذا رغبت.`;
                                                }

                                                if (gradeVal !== null && gradeVal < 35) return `العلامة: ${grade}% (صفر جامعي - تحسب 0 بالمعدل). يمكنك إعادة المادة لرفع معدلك.`;
                                                if (gradeVal !== null && gradeVal < 50) return `العلامة: ${grade}% (رسوب). يمكنك إعادة المادة للنجاح.`;
                                                return 'يمكنك إعادة هذه المادة.';
                                            })()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className={`${getStatus(selectedCourse) === 'failed' ? 'bg-amber-500/10 border-amber-400/20' : 'bg-sky-500/10 border-sky-400/20'} border p-3 rounded-xl mb-3 shadow-sm backdrop-blur-sm space-y-2.5`}>
                                <span className={`text-[12px] font-[800] ${getStatus(selectedCourse) === 'failed' ? 'text-amber-300' : 'text-sky-300'} flex items-center gap-2`}>📅 تحديد فصل الإعادة:</span>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className={`text-[10px] font-bold ${getStatus(selectedCourse) === 'failed' ? 'text-amber-100/80' : 'text-sky-100/80'} mb-1 block`}>السنة الدراسية</label>
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
                                        <label className={`text-[10px] font-bold ${getStatus(selectedCourse) === 'failed' ? 'text-amber-100/80' : 'text-sky-100/80'} mb-1 block`}>الفصل</label>
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
                            </div>
                            <button onClick={() => retakeCourse(selectedCourse.id)} className={`w-full ${getStatus(selectedCourse) === 'failed' ? 'bg-gradient-to-l from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-amber-500/20' : 'bg-gradient-to-l from-sky-500 to-blue-500 hover:from-sky-400 hover:to-blue-400 shadow-sky-500/20'} text-white py-3.5 rounded-xl font-[800] text-[13px] transition-all shadow-lg active:scale-[0.97] flex items-center justify-center gap-2`}>
                                🔄 إعادة المادة (محاولة جديدة)
                            </button>
                            <button onClick={() => togglePassed(selectedCourse.id)} className="w-full bg-white/5 border border-white/10 text-white/50 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-400/30 py-3.5 rounded-xl font-[800] text-[13px] transition-all active:scale-[0.97]">
                                ✖ إلغاء تسجيلات المادة بالكامل
                            </button>
                        </>
                    )}
                </div>
            </motion.div>
        ) : (
            <div className="h-full flex flex-col items-center justify-center text-white/40 mt-8">
                <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-4xl mb-5 backdrop-blur-sm">🖱️</div>
                <p className="font-bold text-[13px] text-center leading-relaxed text-white/50">اضغط على أي مادة في الشجرة<br />لاستكشاف مسارها الأكاديمي</p>

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
    );

    return (
        <div className={`w-full flex flex-col overflow-hidden font-t ${isDark ? 'bg-[#0a0f18]' : 'bg-[#fafcff]'}`} dir={lang === 'ar' ? 'rtl' : 'ltr'} style={{ height: '100dvh' }}>
            <Head><title>{lang === 'ar' ? 'الخطة الشجرية الذكية | سنفور' : 'Smart Course Tree | Sanfoor'}</title><meta name="description" content={lang === 'ar' ? 'استعرض خطتك الشجرية، تتبع المتطلبات السابقة، وخطط تسجيل المواد بشكل ذكي داخل حسابك.' : 'Visualize your study tree, track prerequisites, and plan your courses smartly inside your account.'} /><meta name="robots" content="noindex,nofollow,noarchive" /><link rel="canonical" href={`${siteUrl}/tree`} /></Head>

            <style dangerouslySetInnerHTML={{
                __html: `
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
                @media print {
                    @page { size: landscape; margin: 0; }
                    body { background: white !important; }
                    body * { visibility: hidden; }
                    #print-container, #print-container * { visibility: visible !important; }
                    #print-container { position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; background: white; z-index: 999999; }
                    #print-container img { max-width: 100%; max-height: 100vh; object-fit: contain; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            ` }} />

            {/* ═══ HEADER ═══ */}
            {!isFullScreen && (
                <div className={`bg-white/90 backdrop-blur-xl border-b border-slate-200/60 px-4 md:px-6 ${isLandscapeMobile ? 'py-2 space-y-2' : 'py-3.5 space-y-3'} shadow-[0_1px_3px_rgba(0,0,0,0.03)] z-20 relative`}>
                    {isLandscapeMobile ? (
                        <div className="px-1">
                            <h1 className="text-xl sm:text-2xl font-[900] text-slate-900 tracking-tight">الخطة الشجرية</h1>
                        </div>
                    ) : (
                        <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.35)] backdrop-blur-xl">
                            <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-200/35 blur-3xl" />
                            <div className="absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-indigo-200/35 blur-3xl" />

                            <div className="relative z-10 p-4 sm:p-6">
                                <div className="text-center max-w-2xl mx-auto">
                                    <div className={`inline-block px-10 py-6 rounded-[2.25rem] border transition-all duration-700 relative overflow-hidden group ${isDark ? 'bg-slate-800/40 border-slate-700/50 shadow-indigo-500/10' : 'bg-white/80 border-slate-100 shadow-indigo-500/5'}`}>
                                        <h1 className={`text-3xl md:text-5xl font-[900] mb-2 relative z-10 ${isDark ? 'text-white' : 'text-slate-900'}`}>الخطة الشجرية</h1>
                                        <p className={`text-sm md:text-lg font-bold opacity-70 relative z-10 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>استعرض متطلبات المواد وخطط تسجيل فصولك</p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

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
            )}

            {/* ═══ TREE TOOLBAR (OUTSIDE FLOW) ═══ */}
            {!isFullScreen && (
                <div className="bg-slate-50/90 backdrop-blur-md border-b border-slate-200/80 p-2 md:px-5 flex flex-col md:flex-row gap-2.5 md:gap-0 justify-between items-center z-20 relative w-full overflow-visible shadow-sm" dir="rtl">
                    
                    {/* Filters (Scrollable on small screens) */}
                    <div className="w-full md:flex-1 overflow-x-auto hide-scrollbar flex md:justify-center">
                        <div className="flex gap-1.5 flex-nowrap min-w-max items-center py-1 px-1">
                            <div className="flex items-center gap-1.5 bg-slate-900/95 p-1.5 rounded-xl shadow-md border border-slate-700/30">
                                {[
                                    { id: 'none', label: '🌐 الخطة كاملة', mobileLabel: '🌐 الكل', active: 'bg-white text-slate-900 shadow-sm' },
                                    { id: 'available', label: '🔓 المتاح', mobileLabel: '🔓 المتاح', active: 'bg-indigo-600 text-white shadow-[0_0_12px_rgba(79,70,229,0.4)]', dot: 'bg-indigo-300' }
                                ].map(f => (
                                    <button key={f.id} onClick={() => setFilterMode(f.id)} className={`${filterButtonSizing} rounded-lg font-[800] transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${filterMode === f.id ? f.active : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>{f.dot && <span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />}{isMobile ? (f.mobileLabel || f.label) : f.label}</button>
                                ))}

                                <div className="relative shrink-0">
                                    <select
                                        value={['easy', 'balanced', 'heavy'].includes(filterMode) ? filterMode : 'all'}
                                        onChange={(e) => setFilterMode(e.target.value === 'all' ? 'none' : e.target.value)}
                                        className="appearance-none px-3.5 py-2 rounded-lg text-[11px] font-[800] transition-all bg-white text-slate-900 shadow-sm border border-white/10 pr-9 outline-none hover:bg-slate-50 focus:ring-2 focus:ring-indigo-400/60"
                                    >
                                        <option value="all">🎚️ كل الصعوبات</option>
                                        <option value="easy">🌿 خفيف</option>
                                        <option value="balanced">⚖️ متوسط</option>
                                        <option value="heavy">🔥 صعب</option>
                                    </select>
                                    <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-400 text-[10px]">⌄</span>
                                </div>

                                <button
                                    onClick={handlePrint}
                                    disabled={isPrinting}
                                    className="px-3.5 py-2 rounded-lg text-[11px] font-[800] transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 bg-white text-slate-900 shadow-sm hover:bg-slate-50 border border-slate-200/50 disabled:opacity-70"
                                    title="طباعة الخطة الشجرية"
                                >
                                    {isPrinting ? '⏳ جاري التجهيز...' : '🖨️ طباعة'}
                                </button>

                                {canEditTreePositions && !positionEditMode && (
                                    <button
                                        onClick={startPositionEditMode}
                                        className="px-3.5 py-2 rounded-lg text-[11px] font-[800] transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 bg-white text-slate-900 shadow-sm hover:bg-slate-50 border border-slate-200/50"
                                    >
                                        {isMobile ? '🖱️ تعديل الترتيب' : '🖱️ تعديل أماكن المواد'}
                                    </button>
                                )}

                                {canEditTreePositions && positionEditMode && (
                                    <>
                                        <button
                                            onClick={cancelPositionEditMode}
                                            disabled={isSavingNodePositions}
                                            className="px-3.5 py-2 rounded-lg text-[11px] font-[800] transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.35)] disabled:opacity-50 hover:bg-rose-600"
                                        >
                                            ✖️ إلغاء
                                        </button>
                                        <button
                                            onClick={saveAllNodePositions}
                                            disabled={isSavingNodePositions || !hasUnsavedNodeMoves}
                                            className="px-3.5 py-2 rounded-lg text-[11px] font-[800] transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.35)] disabled:opacity-50 hover:bg-emerald-600"
                                        >
                                            {isSavingNodePositions ? '⏳ جاري الحفظ...' : '💾 حفظ الترتيب'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Legend Button */}
                    <div className="shrink-0 relative w-full md:w-auto md:mr-3" dir="rtl">
                        <button onClick={() => setLegendOpen(true)} className={`w-full md:w-auto justify-center flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-[800] transition-all shadow-sm border bg-white text-slate-600 border-slate-200 hover:bg-slate-50`}>
                            🌳 دليل الشجرة
                        </button>
                    </div>
                </div>
            )}

            <div className="flex-1 flex w-full h-full relative overflow-hidden">
                {show4YearPlan && render4YearPlan()}
                {isSidebarOpen && isMobile && !isLandscapeMobile && !isFullScreen && (
                    <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
                )}

                {/* ═══ SIDEBAR ═══ */}
                {!isFullScreen && (
                    <div className={`
                    absolute lg:relative bg-slate-900/70 backdrop-blur-[16px] backdrop-saturate-[180%] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-50 lg:z-10 flex flex-col overflow-hidden transition-transform duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)]
                    ${isMobile && !isLandscapeMobile
                            ? `bottom-0 left-0 right-0 h-[82%] rounded-t-[1.5rem] border-b-0 border-l-0 border-r-0 ${isSidebarOpen ? 'translate-y-0' : 'translate-y-full'}`
                            : `${isLandscapeMobile ? 'top-0 right-0 h-full w-[320px] sm:w-[360px]' : 'top-0 right-0 h-full w-[92%] sm:w-[400px] lg:min-w-[420px] lg:max-w-[420px]'} rounded-none lg:rounded-r-3xl ${isSidebarOpen ? 'translate-x-0' : `translate-x-full ${isLandscapeMobile ? '' : 'lg:translate-x-0'}`}`
                        }
                `}>

                        <div className="flex p-2.5 gap-2 bg-white/5 border-b border-white/10 shrink-0">
                            {isMobile && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedCourse(null);
                                        setIsSidebarOpen(false);
                                    }}
                                    className="w-9 h-9 rounded-xl bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-all flex items-center justify-center text-sm"
                                >
                                    ✕
                                </button>
                            )}
                            <button onClick={() => setActiveTab('details')} className={`flex-1 py-2.5 rounded-xl text-[12px] font-[800] transition-all flex items-center justify-center gap-1.5 ${activeTab === 'details' ? 'bg-white/15 text-white shadow-sm border border-white/20' : 'text-white/40 hover:bg-white/10'}`}>📖 التفاصيل</button>
                            <button onClick={() => setActiveTab('simulator')} className={`flex-1 py-2.5 rounded-xl text-[12px] font-[800] transition-all flex items-center justify-center gap-1.5 relative ${activeTab === 'simulator' ? 'bg-indigo-500/30 text-white shadow-md shadow-indigo-500/15 border border-indigo-400/30' : 'text-white/40 hover:bg-white/10'}`}>
                                🪄 التخطيط
                                {cartIds.length > 0 && (<span className="bg-amber-400 text-amber-900 w-5 h-5 rounded-md text-[10px] flex items-center justify-center font-[900] mr-0.5">{cartIds.length}</span>)}
                            </button>
                            <button onClick={() => setActiveTab('semesters')} className={`flex-1 py-2.5 rounded-xl text-[12px] font-[800] transition-all flex items-center justify-center gap-1.5 ${activeTab === 'semesters' ? 'bg-white/15 text-white shadow-sm border border-white/20' : 'text-white/40 hover:bg-white/10'}`}>📚 الفصول</button>
                            <button onClick={() => setActiveTab('university')} className={`flex-1 py-2.5 rounded-xl text-[12px] font-[800] transition-all flex items-center justify-center gap-1.5 ${activeTab === 'university' ? 'bg-cyan-500/30 text-white shadow-sm border border-cyan-300/30' : 'text-white/40 hover:bg-white/10'}`}>☑️ الجامعة</button>
                        </div>

                        <div className={`flex-1 overflow-y-auto overscroll-contain touch-pan-y ${isLandscapeMobile ? 'p-4 pb-24' : 'p-5 pb-24'} hide-scrollbar`}>

                            {/* ═══ DETAILS TAB ═══ */}
                            {activeTab === 'details' && renderDetailsPanel()}

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
                                            <div className="mt-3 rounded-xl bg-white/5 border border-white/10 p-3">
                                                <div className="flex justify-between text-[10px] font-bold text-white/70">
                                                    <span>ساعات اختياري</span>
                                                    <span>{electiveCartHours} / {ELECTIVE_MAX_HOURS} س</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
                                                    <div className={`h-full transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${electiveCartHours > ELECTIVE_MAX_HOURS ? 'bg-rose-500' : 'bg-amber-400'}`} style={{ width: `${Math.min((electiveCartHours / ELECTIVE_MAX_HOURS) * 100, 100)}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white border border-slate-200 p-4 rounded-[1.25rem] shadow-sm space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-[900] text-[12px] text-slate-800">📈 ملخص التقدم حسب النوع</h4>
                                            <span className="text-[10px] font-bold text-slate-400">منجز / المطلوب</span>
                                        </div>
                                        {Object.values(typeProgress).map((item) => {
                                            const pct = item.target > 0 ? Math.min((item.passed / item.target) * 100, 100) : 0;
                                            return (
                                                <div key={item.label} className="space-y-1">
                                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
                                                        <span>{item.label}</span>
                                                        <span>{item.passed} / {item.target} س</span>
                                                    </div>
                                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className={`h-full bg-gradient-to-l ${item.color} transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]`} style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
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
                                        {recordDisplayedCourses.map((c, idx) => {
                                            const isRetakeRecord = c?.pivot?.is_retake;
                                            const gradeVal = c?.pivot?.grade !== null && c?.pivot?.grade !== undefined ? parseFloat(c.pivot.grade) : null;
                                            const isUniversityZero = gradeVal !== null && gradeVal < 35;
                                            const isFailed = gradeVal !== null && gradeVal < 50;
                                            const gradeLabel = gradeVal !== null
                                                ? (isUniversityZero ? `${c.pivot.grade}% (صفر جامعي)` : isFailed ? `${c.pivot.grade}% (راسب)` : `${c.pivot.grade}%`)
                                                : 'ناجح';
                                            return (
                                            <div key={`${activeSemesterTab}-${c.id}-${c?.pivot?.attempt_number || idx}`} className={`bg-white p-3.5 rounded-xl border shadow-sm flex items-center justify-between transition-colors animate-slideDown ${isFailed ? 'border-rose-200 hover:border-rose-300' : isRetakeRecord ? 'border-amber-200 hover:border-amber-300' : 'border-slate-200/80 hover:border-emerald-200'}`} style={{ animationDelay: `${idx * 40}ms` }}>
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-500 border border-slate-100 shrink-0">{c.credit_hours}س</div>
                                                    <div className="min-w-0 truncate pr-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <h4 className="text-[12px] font-[800] text-slate-800 truncate">{c.name}</h4>
                                                            {isRetakeRecord && <span className="text-[8px] font-[900] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">🔄 إعادة</span>}
                                                        </div>
                                                        <p className="text-[9px] font-bold text-slate-400 font-mono mt-0.5">{c.code} {c?.pivot?.attempt_number > 1 ? `• المحاولة ${c.pivot.attempt_number}` : ''}</p>
                                                    </div>
                                                </div>
                                                <div className="shrink-0 flex flex-col items-end gap-1 pl-1">
                                                    <span className={`px-2 py-0.5 rounded-[6px] text-[9px] font-[800] border shadow-sm ${getBadgeColor(c.pivot?.grade)}`}>{gradeLabel}</span>
                                                    <span className="px-2 py-0.5 rounded-[6px] text-[9px] font-[800] border shadow-sm bg-emerald-50 text-emerald-700 border-emerald-200">
                                                        سنة {c.localYear} - {c.localTerm === 1 ? 'الأول' : c.localTerm === 2 ? 'الثاني' : 'الصيفي'}
                                                    </span>
                                                </div>
                                            </div>
                                            );
                                        })}
                                        {recordDisplayedCourses.length === 0 && (<div className="text-center py-10 opacity-60"><div className="text-3xl mb-2">📭</div><p className="text-[12px] font-bold text-slate-500">لا يوجد مواد مسجلة.</p></div>)}
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-200/60"><Link href={route('calculator.index')} className="w-full bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 py-3 rounded-xl font-[800] text-[12px] transition-all flex items-center justify-center gap-2 shadow-sm">تعديل العلامات والفصول في الحاسبة ⚙️</Link></div>
                                </div>
                            )}

                            {activeTab === 'university' && (
                                <div className="space-y-5 sn-card-enter">
                                    <div className="relative overflow-hidden bg-gradient-to-br from-cyan-50 via-sky-50/90 to-white p-4 rounded-[1.25rem] border border-cyan-100/80 shadow-sm">
                                        <div className="pointer-events-none absolute -left-8 -top-10 w-28 h-28 rounded-full bg-cyan-200/45 blur-2xl" />
                                        <div className="pointer-events-none absolute -right-6 -bottom-8 w-24 h-24 rounded-full bg-sky-200/50 blur-2xl" />

                                        <div className="relative flex items-center gap-3">
                                            <div className="w-11 h-11 bg-gradient-to-br from-cyan-500 to-sky-500 text-white rounded-2xl flex items-center justify-center text-lg shadow-md shadow-cyan-200/60">🎓</div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-[13px] font-[900] text-cyan-950 truncate">متطلبات الجامعة</h3>
                                                <p className="text-[10px] font-bold text-cyan-800/80">قائمة متابعة الإنجاز</p>
                                            </div>
                                            <span className="shrink-0 px-2.5 py-1 rounded-lg bg-white/80 border border-cyan-100 text-[10px] font-black text-cyan-800 shadow-sm">
                                                {universityCompletionPct}%
                                            </span>
                                        </div>

                                        <div className="relative mt-4 grid grid-cols-3 gap-2.5">
                                            <div className="rounded-xl border border-cyan-100/80 bg-white/85 p-2.5 text-center shadow-sm">
                                                <p className="text-[9px] font-black text-slate-500">منجز</p>
                                                <p className="text-[14px] font-[900] text-emerald-700 leading-tight">{universityPassedCount}</p>
                                            </div>
                                            <div className="rounded-xl border border-cyan-100/80 bg-white/85 p-2.5 text-center shadow-sm">
                                                <p className="text-[9px] font-black text-slate-500">متبقي</p>
                                                <p className="text-[14px] font-[900] text-amber-700 leading-tight">{Math.max(sortedUniversityCourses.length - universityPassedCount, 0)}</p>
                                            </div>
                                            <div className="rounded-xl border border-cyan-100/80 bg-white/85 p-2.5 text-center shadow-sm">
                                                <p className="text-[9px] font-black text-slate-500">الساعات</p>
                                                <p className="text-[14px] font-[900] text-cyan-800 leading-tight">{universityHours}</p>
                                            </div>
                                        </div>

                                        <div className="relative mt-3">
                                            <div className="flex items-center justify-between text-[10px] font-black text-cyan-900 mb-1.5">
                                                <span>{universityPassedCount} / {sortedUniversityCourses.length}</span>
                                                <span>نسبة الإنجاز</span>
                                            </div>
                                            <div className="w-full h-2.5 rounded-full bg-cyan-100 overflow-hidden ring-1 ring-cyan-100/70">
                                                <div className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-sky-500 transition-all duration-500" style={{ width: `${universityCompletionPct}%` }} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2.5 pb-8">
                                        {sortedUniversityCourses.length === 0 ? (
                                            <div className="text-center py-10 opacity-60">
                                                <div className="text-3xl mb-2">📭</div>
                                                <p className="text-[12px] font-bold text-slate-500">لا يوجد متطلبات جامعة في الخطة الحالية.</p>
                                            </div>
                                        ) : sortedUniversityCourses.map((course) => {
                                            const isPassed = passedIds.includes(course.id);
                                            return (
                                                <label key={course.id} className={`group flex items-center justify-between gap-3 p-3.5 rounded-2xl border shadow-sm cursor-pointer transition-all ${isPassed ? 'bg-gradient-to-r from-emerald-50 to-cyan-50/70 border-emerald-200' : 'bg-white border-slate-200 hover:border-cyan-200 hover:shadow-md'}`}>
                                                    <div className="flex items-start gap-3 min-w-0">
                                                        <input
                                                            type="checkbox"
                                                            checked={isPassed}
                                                            onChange={() => togglePassed(course.id)}
                                                            className="peer sr-only"
                                                        />
                                                        <span className={`mt-0.5 h-5 w-5 rounded-[0.55rem] border flex items-center justify-center transition-all duration-200 shadow-sm ${isPassed ? 'bg-emerald-600 border-emerald-600 shadow-emerald-200/70' : 'bg-white border-slate-300 group-hover:border-cyan-400'} peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-400/60 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white`}>
                                                            <svg
                                                                viewBox="0 0 16 16"
                                                                className={`w-3.5 h-3.5 transition-all duration-200 ${isPassed ? 'text-white opacity-100 scale-100' : 'text-transparent opacity-0 scale-75'}`}
                                                                fill="none"
                                                                aria-hidden="true"
                                                            >
                                                                <path d="M3.5 8.3L6.5 11.2L12.5 5.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                                            </svg>
                                                        </span>
                                                        <div className="min-w-0">
                                                            <p className={`text-[12px] font-[900] truncate transition-colors ${isPassed ? 'text-emerald-800' : 'text-slate-800 group-hover:text-cyan-800'}`}>{course.name}</p>
                                                            <p className="text-[10px] text-slate-500 font-bold mt-0.5 font-mono tracking-wide" dir="ltr">{course.code}</p>
                                                        </div>
                                                    </div>
                                                    <div className="shrink-0 text-right">
                                                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-black border shadow-sm ${isPassed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{course.credit_hours} س</span>
                                                        <p className={`text-[9px] font-bold mt-1.5 ${isPassed ? 'text-emerald-700' : 'text-slate-400'}`}>{isPassed ? 'منجزة' : 'غير منجزة'}</p>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══ GRAPH AREA ═══ */}
                <div className={`flex-1 relative h-full bg-slate-100/50 ${isFullScreen ? 'p-0' : (isMobile ? (isLandscapeMobile ? 'p-1' : 'p-1.5') : 'p-2 md:p-4')} w-full`} dir="ltr">
                    <div className={`${isFullScreen ? 'rounded-none border-none shadow-none' : 'rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200/80 shadow-[inset_0_2px_12px_rgba(0,0,0,0.04)]'} w-full h-full bg-white/60 relative overflow-hidden backdrop-blur-sm`}>

                        {showRotateHint && !isFullScreen && (
                            <div className="absolute top-2 right-2 left-2 z-30" dir="rtl">
                                <div className="bg-amber-50/95 border border-amber-200 text-amber-800 rounded-xl px-3 py-2 shadow-lg backdrop-blur-sm flex items-center gap-2.5">
                                    <span className="text-base shrink-0">🔄</span>
                                    <p className="text-[10px] font-black leading-snug flex-1">لأفضل تجربة: لف الشاشة للوضع الأفقي ثم فعّل وضع ملء الشاشة.</p>
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




                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodeClick={onNodeClick}
                            onNodeDragStop={onNodeDragStop}
                            onPaneClick={onPaneClick}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onInit={setFlowInstance}
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
                            panOnScroll={isMobile && !positionEditMode}
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


                        {isFullScreen && selectedCourse && (
                            <div
                                className="absolute inset-y-0 right-0 z-40 w-full sm:w-[26rem] lg:w-[30rem] xl:w-[32rem] bg-slate-900/95 border-l border-white/10 backdrop-blur-xl flex flex-col shadow-2xl"
                                style={{ width: isMobile ? '100%' : 'clamp(20rem, 30vw, 32rem)' }}
                            >
                                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                                    <span className="text-white font-[900] text-[12px]">تفاصيل المادة</span>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedCourse(null)}
                                        className="w-8 h-8 rounded-lg bg-white/10 text-white/80 hover:text-white hover:bg-white/20 transition-all flex items-center justify-center text-sm"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto overscroll-contain p-4 hide-scrollbar">
                                    {renderDetailsPanel({ showCloseButton: false })}
                                </div>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={toggleFullScreen}
                            className={`absolute ${isFullScreen ? 'top-4 right-4 sm:top-5 sm:right-5 bg-rose-600 hover:bg-rose-700 text-white shadow-[0_0_20px_rgba(225,29,72,0.4)] border border-rose-500/50' : 'bottom-3 left-3 bg-white/95 text-slate-700 border-slate-200/70 shadow-lg'} z-[100] px-4 py-2.5 rounded-xl text-[12px] font-[900] backdrop-blur-md active:scale-95 transition-all`}
                        >
                            {isFullScreen ? '✕ خروج من ملء الشاشة' : '⛶ ملء الشاشة'}
                        </button>

                        {canEditTreePositions && positionEditMode && !isFullScreen && (
                            <div className="absolute bottom-12 left-3 z-20 bg-slate-900/90 text-white text-[10px] font-bold px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md flex items-center gap-2">
                                <span>🧭 اسحب بأي اتجاه - التداخل يُعالج تلقائيًا</span>
                                {hasUnsavedNodeMoves && <span className="text-amber-300">• يوجد تغييرات غير محفوظة</span>}
                            </div>
                        )}

                        {isMobile && !isFullScreen && (
                            <div className={`absolute ${isLandscapeMobile ? 'bottom-2 text-[9px] px-2 py-1' : 'bottom-3 text-[10px] px-3 py-1.5'} right-3 z-20 bg-slate-900/85 text-white/80 font-bold rounded-full border border-white/10 backdrop-blur-md pointer-events-none`}>
                                👌 اسحب للتنقل • قرّب بإصبعين
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* --- GLOBALLY MOVED MODALS --- */}
            {/* Tree Guide Modal */}
            {legendOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" dir="rtl">
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setLegendOpen(false)} />
                    <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-2xl" style={{ animation: 'sn-scale 0.25s cubic-bezier(0.16,1,0.3,1) both' }}>
                        
                        <div className="bg-slate-50 px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <span className="text-xl">🌳</span>
                                <h3 className="text-slate-800 font-[900] text-[15px]">دليل الشجرة الأكاديمية</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setLegendOpen(false)}
                                className="w-8 h-8 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-500 hover:text-slate-700 transition-all flex items-center justify-center text-sm shrink-0"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 p-4 sm:p-6 hide-scrollbar space-y-4">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-right space-y-2">
                                <p className="text-[13px] font-[900] text-slate-800 flex items-center justify-end gap-1.5">🌳 كيف تعمل الشجرة؟</p>
                                <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                                    الشجرة الأكاديمية تعرض خطتك الدراسية. يمكنك النقر على أي مادة لتمييزها كـ "منجزة". الشجرة تحسب الساعات وتفتح لك المواد التي تعتمد على مواد أخرى قمت باجتيازها تلقائياً، وتغلق المواد التي لم تستوفِ متطلباتها.
                                </p>
                            </div>

                            <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 text-right space-y-2">
                                <p className="text-[13px] font-[900] text-rose-800 flex items-center justify-end gap-1.5">🔄 نظام الإعادة (للمواد المرسوبة)</p>
                                <p className="text-[11px] font-bold text-rose-600/90 leading-relaxed">
                                    إذا رسبت في مادة (أقل من 50%) أو حصلت على صفر جامعي (أقل من 35%)، ستظهر المادة باللون الأحمر (حالة "راسب"). من تفاصيل المادة، ستتمكن من الضغط على زر <b>"إعادة المادة"</b> لفتح محاولة جديدة وإعادة دراستها ليتم حسابها كإعادة لرفع المعدل.
                                </p>
                            </div>

                            <div className="rounded-xl border border-violet-500/20 bg-violet-50 p-4 text-right">
                                <p className="text-[13px] font-[900] text-violet-700 mb-2 flex items-center justify-end gap-1.5">⚖️ المقارنة الاحترافية</p>
                                <p className="text-[11px] font-bold text-slate-600 leading-relaxed">
                                    افتح أي مادة من الشجرة ثم اضغط زر <b>"مقارنة المادة"</b>، بعدها اختر مادة أخرى من الشجرة. ستظهر لك نافذة تقارن بين المادتين من ناحية الصعوبة، التأثير (كم مادة تفتح)، والأولوية، لمساعدتك في اختيار المادة الأنسب للتسجيل.
                                </p>
                            </div>

                            <div className="pt-2">
                                <p className="text-[11px] font-[900] text-slate-400 uppercase tracking-wider mb-3 text-right">حالة المادة</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 mb-2">
                                    {[{ color: 'bg-[#10b981]', label: 'منجز' }, { color: 'bg-[#ef4444]', label: 'راسب (إعادة)' }, { color: 'bg-[#6366f1]', label: 'متاح' }, { color: 'bg-[#f59e0b]', label: 'في التسجيل التجريبي' }, { color: 'bg-slate-200', label: 'مغلق' }].map(l => (
                                        <div key={l.label} className="flex items-center justify-end gap-2"><span className="text-[11px] font-bold text-slate-700">{l.label}</span><span className={`w-4 h-4 rounded-[4px] ${l.color} shadow-sm border border-black/5`} /></div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-2">
                                <p className="text-[11px] font-[900] text-slate-400 uppercase tracking-wider mb-3 text-right">الرموز والمسار</p>
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-end gap-2"><span className="text-[11px] font-bold text-slate-600">إجباري (مستطيل)</span><div className="w-6 h-4 bg-slate-200 rounded-[4px] border border-black/5"></div></div>
                                    <div className="flex items-center justify-end gap-2"><span className="text-[11px] font-bold text-slate-600">مساندة (بيضاوي)</span><div className="w-6 h-4 bg-slate-200 rounded-[10px] border border-black/5"></div></div>
                                    <div className="flex items-center justify-end gap-2"><span className="text-[11px] font-bold text-slate-600">اختياري (مائل)</span><div className="w-6 h-4 bg-slate-200 rounded-tr-[8px] rounded-bl-[8px] rounded-tl-[1px] rounded-br-[1px] border border-black/5"></div></div>
                                    <div className="flex items-center justify-end gap-2"><span className="text-[11px] font-bold text-slate-600">جامعة (حاد)</span><div className="w-6 h-4 bg-slate-200 rounded-[2px] border border-black/5"></div></div>
                                    <div className="flex items-start justify-end gap-3 mt-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <div className="text-right flex-1">
                                            <p className="text-[11px] font-bold text-slate-800">المسار الحرج (شريط أحمر أعلى البطاقة)</p>
                                            <p className="text-[10px] font-bold text-slate-500 leading-snug mt-1">مواد تفتح سلسلة طويلة من المواد، تأخيرها قد يؤخر تخرجك.</p>
                                        </div>
                                        <span className="w-6 h-1.5 rounded-full bg-gradient-to-l from-rose-500 to-rose-400 shadow-sm mt-1.5 shrink-0"></span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* Compare Toast */}
            {compareMode && compareFirstCourse && !compareCourse && (
                <div className="fixed top-20 sm:top-24 left-1/2 -translate-x-1/2 z-[100] bg-violet-600/95 backdrop-blur-xl text-white px-5 py-3 rounded-2xl shadow-2xl shadow-violet-500/30 border border-violet-400/30 flex items-center gap-3" dir="rtl" style={{ animation: 'sn-scale 0.25s cubic-bezier(0.16,1,0.3,1) both' }}>
                    <span className="text-lg">⚖️</span>
                    <div>
                        <p className="text-[12px] font-[900]">اختر المادة الثانية من الشجرة</p>
                        <p className="text-[10px] font-bold text-violet-200/70">المادة الأولى: {compareFirstCourse.name}</p>
                    </div>
                    <button onClick={() => { setCompareMode(false); setCompareFirstCourse(null); setCompareCourse(null); }} className="w-7 h-7 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center text-xs transition-all mr-1">✕</button>
                </div>
            )}

            {/* Compare Modal */}
            {compareMode && compareFirstCourse && compareCourse && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6" dir="rtl">
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => { setCompareMode(false); setCompareFirstCourse(null); setCompareCourse(null); }} />
                    <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900 shadow-[0_30px_100px_rgba(15,23,42,0.6)]" style={{ animation: 'sn-scale 0.3s cubic-bezier(0.16,1,0.3,1) both' }}>
                        <div className="bg-gradient-to-l from-indigo-950/80 to-violet-950/80 px-4 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-400/20 flex items-center justify-center text-lg shadow-inner">⚖️</div>
                                <div>
                                    <h3 className="text-white font-[900] text-[15px]">مقارنة احترافية</h3>
                                    <p className="text-[10px] text-white/50 font-bold mt-0.5 tracking-wide">{compareFirstCourse.code} vs {compareCourse.code}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setCompareMode(false);
                                    setCompareFirstCourse(null);
                                    setCompareCourse(null);
                                }}
                                className="w-9 h-9 rounded-xl bg-white/5 hover:bg-rose-500/20 text-white/50 hover:text-rose-300 transition-all flex items-center justify-center text-sm shrink-0 border border-white/5"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 p-3 sm:p-5 md:p-6 hide-scrollbar bg-slate-950/50 space-y-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {[
                                    { course: compareFirstCourse, label: 'المادة الأولى', tone: 'indigo' },
                                    { course: compareCourse, label: 'المادة الثانية', tone: 'violet' },
                                ].map((entry, index) => {

                                    const { course, label, tone } = entry;
                                    const courseDifficulty = Number(course.difficulty_level || 3);
                                    const courseImpact = getTotalImpact(course.id);
                                    const coursePriority = getCoursePriority(course);
                                    const difficultyLabel = courseDifficulty >= 4 ? 'مكثّف' : courseDifficulty === 3 ? 'متوازن' : 'خفيف';
                                    const statusLabel = getStatus(course) === 'passed' ? 'منجزة' : getStatus(course) === 'available' ? 'متاحة' : 'مقفلة';

                                    return (
                                        <div
                                            key={course.id}
                                            className={`text-right rounded-2xl border p-4 sm:p-5 ${tone === 'indigo' ? 'bg-indigo-500/8 border-indigo-400/20' : 'bg-violet-500/8 border-violet-400/20'}`}
                                        >
                                            <div className="flex items-start justify-between gap-3 mb-4">
                                                <div className="min-w-0 flex-1">
                                                    <p className={`text-[9px] font-[900] uppercase tracking-wider mb-2 ${tone === 'indigo' ? 'text-indigo-300' : 'text-violet-300'}`}>{label}</p>
                                                    <p className="text-[16px] sm:text-[18px] font-[900] text-white leading-snug">{course.name}</p>
                                                    <p className="mt-1 text-[10px] text-white/45 font-bold">{course.code} • {course.credit_hours} ساعات • {course.type === 'compulsory' ? 'إجباري' : course.type === 'elective' ? 'اختياري' : course.type === 'supporting' ? 'مساندة' : 'جامعة'}</p>
                                                </div>
                                            </div>

                                            <div className="mb-3 flex flex-wrap items-center gap-1.5">
                                                <span className={`text-[9px] font-[800] px-2 py-1 rounded-full border ${getStatus(course) === 'passed' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20' : getStatus(course) === 'available' ? 'bg-sky-500/15 text-sky-300 border-sky-400/20' : 'bg-rose-500/15 text-rose-300 border-rose-400/20'}`}>{statusLabel}</span>
                                                {getCourseDepth(course.id) >= 2 && (
                                                    <span className="text-[9px] font-[800] px-2 py-1 rounded-full border bg-rose-500/10 text-rose-200 border-rose-400/20">في المسار الحرج</span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-3 gap-2.5">
                                                <div className="rounded-2xl bg-white/5 border border-white/10 p-3 text-center">
                                                    <p className="text-[8px] font-[900] text-white/45 mb-0.5">الصعوبة</p>
                                                    <p className="text-[18px] font-[900] text-white leading-none">{courseDifficulty}</p>
                                                    <p className={`text-[9px] font-[800] mt-1 ${courseDifficulty >= 4 ? 'text-rose-200' : courseDifficulty === 3 ? 'text-amber-200' : 'text-emerald-200'}`}>{difficultyLabel}</p>
                                                </div>
                                                <div className="rounded-2xl bg-white/5 border border-white/10 p-3 text-center">
                                                    <p className="text-[8px] font-[900] text-white/45 mb-0.5">التأثير</p>
                                                    <p className="text-[18px] font-[900] text-white leading-none">{courseImpact}</p>
                                                    <p className="text-[9px] font-[800] mt-1 text-white/45">مادة تتأثر</p>
                                                </div>
                                                <div className="rounded-2xl bg-white/5 border border-white/10 p-3 text-center">
                                                    <p className="text-[8px] font-[900] text-white/45 mb-0.5">الأولوية</p>
                                                    <p className="text-[18px] font-[900] text-white leading-none">{coursePriority}%</p>
                                                    <p className="text-[9px] font-[800] mt-1 text-white/45">ترتيبك</p>
                                                </div>
                                            </div>

                                            <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${tone === 'indigo' ? 'bg-indigo-400' : 'bg-violet-400'}`} style={{ width: `${Math.min(100, Math.max(5, coursePriority))}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}

                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 space-y-3 mt-4">
                                <h4 className="text-[12px] font-[900] text-white/60 flex items-center gap-2">📊 الخلاصة</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                    {(() => {
                                        const firstDifficulty = Number(compareFirstCourse.difficulty_level || 3);
                                        const secondDifficulty = Number(compareCourse.difficulty_level || 3);
                                        const firstImpact = getTotalImpact(compareFirstCourse.id);
                                        const secondImpact = getTotalImpact(compareCourse.id);
                                        const firstPriority = getCoursePriority(compareFirstCourse);
                                        const secondPriority = getCoursePriority(compareCourse);

                                        const harderCourse = secondDifficulty > firstDifficulty ? compareCourse : compareFirstCourse;
                                        const moreImpactCourse = secondImpact > firstImpact ? compareCourse : compareFirstCourse;
                                        const higherPriorityCourse = secondPriority > firstPriority ? compareCourse : compareFirstCourse;
                                        const difficultyGap = Math.abs(secondDifficulty - firstDifficulty);
                                        const impactGap = Math.abs(secondImpact - firstImpact);
                                        const priorityGap = Math.abs(secondPriority - firstPriority);


                                        return (
                                            <>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    <div className="rounded-xl bg-rose-500/8 border border-rose-400/15 p-3.5">
                                                        <p className="text-[9px] font-[900] text-rose-300/70 mb-1">🔥 الأثقل</p>
                                                        <p className="text-[13px] font-[900] text-white truncate">{harderCourse.name}</p>
                                                        <p className="text-[10px] text-white/40 font-bold mt-0.5">فارق: {difficultyGap} {difficultyGap === 1 ? 'نقطة' : 'نقاط'}</p>
                                                    </div>
                                                    <div className="rounded-xl bg-violet-500/8 border border-violet-400/15 p-3.5">
                                                        <p className="text-[9px] font-[900] text-violet-300/70 mb-1">🔗 الأكثر تأثيراً</p>
                                                        <p className="text-[13px] font-[900] text-white truncate">{moreImpactCourse.name}</p>
                                                        <p className="text-[10px] text-white/40 font-bold mt-0.5">فارق: {impactGap} {impactGap === 1 ? 'مادة' : 'مواد'}</p>
                                                    </div>
                                                    <div className="rounded-xl bg-indigo-500/8 border border-indigo-400/15 p-3.5">
                                                        <p className="text-[9px] font-[900] text-indigo-300/70 mb-1">⭐ الأعلى أولوية</p>
                                                        <p className="text-[13px] font-[900] text-white truncate">{higherPriorityCourse.name}</p>
                                                        <p className="text-[10px] text-white/40 font-bold mt-0.5">فارق: {priorityGap}%</p>
                                                    </div>
                                                </div>
                                                <div className="rounded-xl bg-emerald-500/8 border border-emerald-400/15 p-3.5 flex items-start gap-3">
                                                    <span className="text-lg mt-0.5 shrink-0">💡</span>
                                                    <div>
                                                        <p className="text-[12px] font-[900] text-emerald-200">التوصية</p>
                                                        <p className="text-[11px] font-bold text-emerald-100/70 leading-relaxed mt-0.5">
                                                            {firstPriority > secondPriority
                                                                ? `ابدأ بـ "${compareFirstCourse.name}" لأن أولويتها أعلى (${firstPriority}%) وتأثيرها على مسارك أكبر.`
                                                                : secondPriority > firstPriority
                                                                    ? `ابدأ بـ "${compareCourse.name}" لأن أولويتها أعلى (${secondPriority}%) وتأثيرها على مسارك أكبر.`
                                                                    : `المادتان متساويتان بالأولوية (${firstPriority}%). اختر حسب اهتمامك أو جدولك.`
                                                            }
                                                        </p>
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* Action buttons */}
                                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                                    <button onClick={() => { setSelectedCourse(compareFirstCourse); setCompareMode(false); setCompareFirstCourse(null); setCompareCourse(null); }} className="flex-1 min-w-[140px] max-w-[200px] px-5 py-3 rounded-xl text-[11px] font-[900] bg-indigo-500/15 text-indigo-300 border border-indigo-400/20 hover:bg-indigo-500/25 transition-all active:scale-95 shadow-sm">📖 تفاصيل {compareFirstCourse.code}</button>
                                    <button onClick={() => { setSelectedCourse(compareCourse); setCompareMode(false); setCompareFirstCourse(null); setCompareCourse(null); }} className="flex-1 min-w-[140px] max-w-[200px] px-5 py-3 rounded-xl text-[11px] font-[900] bg-violet-500/15 text-violet-300 border border-violet-400/20 hover:bg-violet-500/25 transition-all active:scale-95 shadow-sm">📖 تفاصيل {compareCourse.code}</button>
                                    <button onClick={() => { setCompareMode(false); setCompareFirstCourse(null); setCompareCourse(null); }} className="px-5 py-3 rounded-xl text-[11px] font-[800] bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 transition-all active:scale-95">إغلاق</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

Tree.layout = page => (
    <MainLayout absoluteNavbar hideNavbarOnMobileLandscape hideAiWidgetOnMobileLandscape>
        {page}
    </MainLayout>
);