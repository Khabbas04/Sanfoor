import React, { useMemo } from 'react';
import ReactFlow, { Background, Controls, MarkerType } from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

// Renders the AI advisor "skill tree" from structured {nodes, edges} data using
// reactflow + dagre (already bundled elsewhere in the app), so we avoid adding a
// heavy diagramming dependency (e.g. mermaid) to the production build.

const STATUS = {
    passed:    { bg: '#dcfce7', border: '#22c55e', color: '#166534', label: 'مجتازة' },
    available: { bg: '#dbeafe', border: '#3b82f6', color: '#1e40af', label: 'متاحة' },
    inCart:    { bg: '#fef9c3', border: '#eab308', color: '#854d0e', label: 'في السلة' },
    locked:    { bg: '#fee2e2', border: '#ef4444', color: '#991b1b', label: 'مقفلة' },
};

const NODE_W = 190;
const NODE_H = 56;

function buildLayout(rawNodes, rawEdges) {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'TB', ranksep: 70, nodesep: 26 });

    rawNodes.forEach((n) => g.setNode(String(n.id), { width: NODE_W, height: NODE_H }));
    rawEdges.forEach((e) => {
        if (g.hasNode(String(e.from)) && g.hasNode(String(e.to))) {
            g.setEdge(String(e.from), String(e.to));
        }
    });

    dagre.layout(g);

    const nodes = rawNodes.map((n) => {
        const s = STATUS[n.status] || STATUS.available;
        const pos = g.node(String(n.id)) || { x: 0, y: 0 };
        return {
            id: String(n.id),
            position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
            data: {
                label: (
                    <div style={{ lineHeight: 1.25 }}>
                        <div style={{ fontWeight: 800, fontSize: 12 }}>{n.name}</div>
                        <div style={{ fontSize: 10, opacity: 0.75, direction: 'ltr' }}>
                            {n.code}{n.credit_hours ? ` • ${n.credit_hours}h` : ''}
                        </div>
                    </div>
                ),
            },
            style: {
                width: NODE_W,
                background: s.bg,
                border: `2px solid ${s.border}`,
                color: s.color,
                borderRadius: 12,
                padding: 6,
                textAlign: 'center',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            },
            sourcePosition: 'bottom',
            targetPosition: 'top',
        };
    });

    const edges = rawEdges.map((e, i) => ({
        id: `e-${e.from}-${e.to}-${i}`,
        source: String(e.from),
        target: String(e.to),
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#94a3b8' },
        style: { stroke: '#94a3b8', strokeWidth: 1.5 },
    }));

    const graphHeight = g.graph().height || 400;
    const height = Math.min(680, Math.max(320, graphHeight + 80));

    return { nodes, edges, height };
}

export default function SkillTreeDiagram({ nodes = [], edges = [], empty = false }) {
    const { nodes: flowNodes, edges: flowEdges, height } = useMemo(
        () => buildLayout(nodes, edges),
        [nodes, edges]
    );

    if (empty || nodes.length === 0) {
        return (
            <div className="my-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">
                لا توجد خطة دراسية متاحة لرسمها حالياً.
            </div>
        );
    }

    return (
        <div className="my-4 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div dir="ltr" style={{ height }}>
                <ReactFlow
                    nodes={flowNodes}
                    edges={flowEdges}
                    fitView
                    minZoom={0.2}
                    proOptions={{ hideAttribution: true }}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    elementsSelectable={false}
                    zoomOnScroll={false}
                    preventScrolling={false}
                >
                    <Background gap={16} color="#e2e8f0" />
                    <Controls showInteractive={false} position="top-left" />
                </ReactFlow>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-100 bg-slate-50/70 px-3 py-2" dir="rtl">
                {Object.values(STATUS).map((s) => (
                    <span key={s.label} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                        <span className="inline-block h-3 w-3 rounded" style={{ background: s.bg, border: `2px solid ${s.border}` }} />
                        {s.label}
                    </span>
                ))}
            </div>
        </div>
    );
}
