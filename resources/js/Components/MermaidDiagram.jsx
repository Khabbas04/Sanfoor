import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// Renders a Mermaid diagram from source text. `mermaid` is heavy, so this
// component is always imported lazily (React.lazy) — it lives in its own chunk
// and only loads when a student actually asks for their plan.

mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'inherit',
    flowchart: { htmlLabels: true, curve: 'basis', padding: 12 },
});

let counter = 0;

export default function MermaidDiagram({ chart }) {
    const ref = useRef(null);
    const idRef = useRef(`mermaid-${++counter}`);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const src = (chart || '').trim();
        if (!src) return;

        setError(false);
        mermaid
            .render(idRef.current, src)
            .then(({ svg }) => {
                if (!cancelled && ref.current) ref.current.innerHTML = svg;
            })
            .catch(() => {
                if (!cancelled) setError(true);
            });

        return () => { cancelled = true; };
    }, [chart]);

    if (error) {
        return (
            <div className="my-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-[12px] font-bold text-amber-700">
                تعذّر رسم المخطط. حاول إعادة طلب الخطة.
            </div>
        );
    }

    return (
        <div
            dir="ltr"
            ref={ref}
            className="mermaid-diagram my-4 flex justify-center overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        />
    );
}
