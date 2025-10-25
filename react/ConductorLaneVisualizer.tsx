import React, { useMemo, useRef, useState, useEffect } from "react";

/**
 * Full app (voices/lanes, L/R handles, overlay dividers, assertions) — restored.
 * ONLY CHANGE: circular note nodes now fill with light pastel colors
 * (orange, yellow, green, blue). All other logic remains identical.
 */

// --- helper constants & functions ---
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const SCALES: Record<string, number[]> = {
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

function midiToNote(m: number) {
    const n = NOTE_NAMES[((m % 12) + 12) % 12];
    return `${n}${Math.floor(m / 12) - 1}`.toLowerCase();
}
function snapToScale(m: number, r: number, p: number[]) {
    let best = Math.round(m), bestAbs = Infinity;
    for (let k = -24; k <= 24; k++) {
        const cand = best + k, pc = ((cand % 12) + 12) % 12, rel = ((pc - r) + 12) % 12;
        if (p.includes(rel)) {
            const diff = Math.abs(cand - m);
            if (diff < bestAbs) { bestAbs = diff; best = cand; }
        }
    }
    return best;
}
function computePanForX(x: number, r: DOMRect, l: number) {
    const li = Math.floor(((x - r.left) / r.width) * l);
    const clamped = Math.max(0, Math.min(l - 1, li));
    const lw = r.width / l, ll = r.left + clamped * lw, c = ll + lw / 2;
    const pn = Math.max(-1, Math.min(1, ((x - c) / (lw / 2))));
    const pan = Math.round(64 + pn * 64);
    return { laneIndex: clamped, pan: Math.max(0, Math.min(127, pan)) };
}
function pitchToIntensity(p: number) { const min = 36, max = 84; return Math.max(0, Math.min(1, (p - min) / (max - min))); }

// --- dev tests for helpers (browser only) ---
(() => {
    try {
        if (typeof window !== 'undefined') {
            const rect: any = { left: 0, top: 0, width: 400, height: 200, right: 400, bottom: 200, x: 0, y: 0, toJSON() { return {} } };
            const a = computePanForX(-10, rect as DOMRect, 4);
            const b = computePanForX(410, rect as DOMRect, 4);
            const c = computePanForX(200, rect as DOMRect, 4);
            console.assert(a.laneIndex >= 0 && a.laneIndex < 4, 'laneIndex clamp left');
            console.assert(b.laneIndex >= 0 && b.laneIndex < 4, 'laneIndex clamp right');
            console.assert(c.pan >= 0 && c.pan <= 127, 'pan range 0..127');

            console.assert(midiToNote(60) === 'c4', 'midiToNote(60) -> c4');
            console.assert(midiToNote(69) === 'a4', 'midiToNote(69) -> a4');
            const snapMajC = snapToScale(61, 0, SCALES.major);
            console.assert([60, 62].includes(snapMajC), 'snapToScale near C major');
            console.assert(pitchToIntensity(36) === 0, 'intensity lower bound');
            console.assert(pitchToIntensity(84) === 1, 'intensity upper bound');
            const midI = pitchToIntensity(60);
            console.assert(midI > 0 && midI < 1, 'intensity mid');
        }
    } catch {/* non-fatal */ }
})();

// --- Ozone-style mini stereo visualizer ---
function StereoVisualizer({ pan = 64 }: { pan?: number }) {
    const intensity = Math.min(1, Math.abs(pan - 64) / 64);
    const panNorm = Math.max(-1, Math.min(1, (pan - 64) / 64));
    const { pathA, pathB, pathC } = useMemo(() => {
        const A = 6 + intensity * 10, B = 10 + intensity * 6, C = 16 + intensity * 8, ph = panNorm * Math.PI;
        const gen = (a: number, f: number, p: number) => { const pts: string[] = []; for (let x = 0; x <= 100; x += 2) { const y = 50 + a * Math.sin((x / 100) * (Math.PI * 2) * f + p); pts.push(`${x},${y.toFixed(2)}`); } return `M0,50L${pts.join(" ")}`; };
        return { pathA: gen(A, B, ph), pathB: gen(A * 0.75, C, ph + Math.PI / 3), pathC: gen(A * 0.5, B * 0.6, ph + Math.PI / 1.7) };
    }, [intensity, panNorm]);
    const dots = useMemo(() => Array.from({ length: 20 }).map(() => ({ x: 50 + (Math.random() - 0.5) * 50 * (panNorm * 2), y: 50 + (Math.random() - 0.5) * 40, opacity: 0.5 + Math.random() * 0.4 })), [panNorm]);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: 8, color: '#2b241c' }}>
            <svg width={112} height={32} viewBox="0 0 100 100">
                <path d={pathA} fill="none" stroke="#2b241c" strokeWidth={0.7} opacity={0.35} />
                <path d={pathB} fill="none" stroke="#2b241c" strokeWidth={0.5} opacity={0.3} />
                <path d={pathC} fill="none" stroke="#2b241c" strokeWidth={0.4} opacity={0.25} />
                {dots.map((d, i) => (<circle key={i} cx={d.x} cy={d.y} r={0.9} fill="black" opacity={d.opacity} />))}
            </svg>
        </div>
    );
}

// --- Lane canvas (physics + labels) ---
function LaneCanvasTree({ pitch, pan }: { pitch: number; pan: number }) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    type NodeT = { id: number; x: number; y: number; baseX: number; baseY: number; note: string; color: string; createdAt: number; parent: number | null; vx: number; vy: number };
    const nodesRef = useRef<NodeT[]>([]);
    const nextIdRef = useRef(0);
    const lastSnapRef = useRef(Math.round(pitch));
    const lastSpawnRef = useRef(0);
    const rafRef = useRef<number | undefined>(undefined);

    // Pastel fill colors: orange, yellow, green, blue
    const colors = ["#ffd6a5", "#fdffb6", "#caffbf", "#9bf6ff"];

    const yFromMidi = (m: number, H: number) => { const min = 36, max = 96; const t = Math.max(0, Math.min(1, (m - min) / (max - min))); return (1 - t) * (H * 0.75) + (H * 0.1); };
    const xFromPan = (p: number, W: number) => { const t = Math.max(0, Math.min(1, p / 127)); return (W * 0.1) + t * (W * 0.8); };

    // DPI-aware resize
    useEffect(() => {
        const cvs = canvasRef.current; if (!cvs) return;
        const resize = () => { const parent = cvs.parentElement; if (!parent) return; const rect = parent.getBoundingClientRect(); const dpr = Math.max(1, (window as any).devicePixelRatio || 1); cvs.width = Math.floor(rect.width * dpr); cvs.height = Math.floor(rect.height * dpr); (cvs.style as any).width = `${rect.width}px`; (cvs.style as any).height = `${rect.height}px`; };
        resize();
        const RO = (window as any).ResizeObserver;
        const ro = RO ? new RO(resize) : null;
        ro?.observe(cvs.parentElement!);
        return () => ro?.disconnect();
    }, []);

    // spawn nodes on snapped pitch changes (debounced)
    useEffect(() => {
        const snap = Math.round(pitch); const now = Date.now();
        if (snap === lastSnapRef.current) return;
        if (now - lastSpawnRef.current < 100) { lastSnapRef.current = snap; return; }
        const cvs = canvasRef.current; if (!cvs) return; const W = cvs.width, H = cvs.height;
        const x = xFromPan(pan, W), y = yFromMidi(snap, H);
        const id = nextIdRef.current++;
        const parent = nodesRef.current.length ? nodesRef.current[nodesRef.current.length - 1].id : null;
        nodesRef.current.push({ id, x, y, baseX: x, baseY: y, note: midiToNote(snap).toUpperCase(), color: colors[id % colors.length], createdAt: now, parent, vx: (Math.random() - 0.5) * 0.9, vy: (Math.random() - 0.5) * 0.9 });
        lastSpawnRef.current = now; lastSnapRef.current = snap;
    }, [pitch, pan]);

    // animation loop
    useEffect(() => {
        const cvs = canvasRef.current; if (!cvs) return; const ctx = cvs.getContext('2d'); if (!ctx) return;
        const fadeTime = 7000, fall = 0.035;
        const loop = () => {
            const now = Date.now(); const W = cvs.width, H = cvs.height;
            ctx.clearRect(0, 0, W, H);
            const anchorX = ((): number => { const t = Math.max(0, Math.min(1, pan / 127)); return (W * 0.1) + t * (W * 0.8); })();
            const anchorY = ((): number => { const min = 36, max = 96; const m = Math.round(pitch); const t = Math.max(0, Math.min(1, (m - min) / (max - min))); return (1 - t) * (H * 0.75) + (H * 0.1); })();

            nodesRef.current = nodesRef.current.filter(n => now - n.createdAt < fadeTime);

            nodesRef.current.forEach(n => {
                const age = now - n.createdAt; const ageT = Math.max(0, Math.min(1, age / fadeTime));
                n.vx += (Math.random() - 0.5) * 0.06; n.vy += (Math.random() - 0.5) * 0.06;
                const spread = 1 + ageT * 1.6;
                n.x += n.vx * spread; n.y += n.vy * spread + fall;
                const influence = 0.012 * (1 - ageT);
                n.x += (anchorX - n.x) * influence; n.y += (anchorY - n.y) * influence;
            });

            // connections
            nodesRef.current.forEach(n => {
                if (n.parent == null) return; const p = nodesRef.current.find(m => m.id === n.parent); if (!p) return;
                const op = Math.max(0, 1 - (now - n.createdAt) / fadeTime) * 0.6;
                ctx.strokeStyle = `rgba(43,36,28,${op})`; ctx.lineWidth = 2.2 * (cvs.width / 800);
                ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(n.x, n.y); ctx.stroke();
            });

            // nodes
            nodesRef.current.forEach(n => {
                const op = Math.max(0, 1 - (now - n.createdAt) / fadeTime);
                const R = 28 * (cvs.width / 800);
                ctx.beginPath(); ctx.arc(n.x, n.y, R, 0, Math.PI * 2);
                // ONLY CHANGE: fill with pastel color
                ctx.fillStyle = n.color;
                ctx.globalAlpha = op * 0.95;
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.strokeStyle = `rgba(43,36,28,${op * 0.85})`; ctx.lineWidth = 2.4 * (cvs.width / 800); ctx.stroke();
                ctx.fillStyle = `rgba(0,0,0,${op})`; ctx.font = `${14 * (cvs.width / 800)}px ui-monospace, Menlo, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(n.note, n.x, n.y);
            });

            rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [pitch, pan]);

    return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />;
}

// --- Main visualizer with lanes/voices ---
function ConductorLaneVisualizer() {
    const [lanes, _setLanes] = useState<number>(2);
    const setLanes = (n: number) => _setLanes(Math.max(1, Math.min(8, Number.isFinite(n) ? n : 1)));

    const [laneData, setLaneData] = useState(() => Array.from({ length: 2 }, () => ({ pitch: 60, pan: 64 })));
    const [activeLaneL, setActiveLaneL] = useState<number | null>(null);
    const [activeLaneR, setActiveLaneR] = useState<number | null>(null);
    const [rootPc, setRootPc] = useState(0);
    const [scaleName, setScaleName] = useState<keyof typeof SCALES>('major');
    const [selectAll, setSelectAll] = useState(false);
    const [editCount, setEditCount] = useState<number>(1);
    const stageRef = useRef<HTMLDivElement | null>(null);
    const [left, setLeft] = useState({ x: 160, y: 240 });
    const [right, setRight] = useState({ x: 480, y: 240 });
    const [dragging, setDragging] = useState<null | 'L' | 'R'>(null);

    // sync laneData with lane count
    useEffect(() => {
        setLaneData(prev => {
            const next = prev.slice(0, lanes);
            while (next.length < lanes) next.push({ pitch: 60, pan: 64 });
            return next;
        });
        setActiveLaneL(l => (l == null ? l : Math.min(l, lanes - 1)));
        setActiveLaneR(r => (r == null ? r : Math.min(r, lanes - 1)));
        setEditCount(c => Math.min(Math.max(1, c), lanes));

        if (typeof window !== 'undefined') {
            console.assert(lanes >= 1 && lanes <= 8, 'lanes within 1..8');
        }
    }, [lanes]);

    const getLane = (i: number) => laneData[i] ?? { pitch: 60, pan: 64 };

    const isActive = (i: number) => {
        if (selectAll) return true;
        const actives: number[] = [];
        if (activeLaneL != null) actives.push(activeLaneL);
        if (activeLaneR != null) actives.push(activeLaneR);
        for (const a of actives) {
            const start = Math.max(0, Math.min(lanes - 1, a));
            const group = Array.from({ length: editCount }, (_, k) => Math.max(0, Math.min(lanes - 1, start + k))).includes(i);
            if (group) return true;
        }
        return false;
    };

    const applyToTargets = (laneIndex: number, updater: (idx: number) => void) => {
        if (selectAll) { for (let i = 0; i < lanes; i++) updater(i); return; }
        const start = Math.max(0, Math.min(lanes - 1, laneIndex));
        for (let k = 0; k < editCount; k++) {
            const idx = start + k;
            if (idx <= lanes - 1) updater(idx);
        }
    };

    const updatePitchAt = (x: number, y: number, w: 'L' | 'R') => {
        if (!stageRef.current) return; const r = stageRef.current.getBoundingClientRect();
        const { laneIndex, pan } = computePanForX(x, r, lanes);
        const raw = Math.max(21, Math.min(108 - ((y - r.top) / r.height) * 60, 108));
        const pitch = snapToScale(raw, rootPc, SCALES[scaleName]);
        if (w === 'L') setActiveLaneL(laneIndex); else setActiveLaneR(laneIndex);
        setLaneData(prev => { const u = [...prev]; applyToTargets(laneIndex, (idx) => { const lane = u[idx] ?? { pitch: 60, pan: 64 }; u[idx] = { ...lane, pitch, pan }; }); return u; });
    };

    const onMove = (e: React.PointerEvent) => { if (!dragging || !stageRef.current) return; const r = stageRef.current.getBoundingClientRect(), x = e.clientX, y = e.clientY; if (dragging === 'L') { setLeft({ x: x - r.left, y: y - r.top }); updatePitchAt(x, y, 'L'); } else { setRight({ x: x - r.left, y: y - r.top }); updatePitchAt(x, y, 'R'); } };
    const start = (w: 'L' | 'R') => (e: React.PointerEvent) => { setDragging(w); updatePitchAt(e.clientX, e.clientY, w); };
    const stop = () => setDragging(null);

    const containerStyle: React.CSSProperties = { width: '100%', minHeight: 700, background: '#f4ede0', color: '#2b241c', padding: 24, boxSizing: 'border-box', fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto' };
    const stageStyle: React.CSSProperties = { position: 'relative', width: '100%', aspectRatio: '16/9', border: '2px solid #5C4A36', borderRadius: 24, overflow: 'hidden' };

    return (
        <div style={containerStyle}>
            {/* top bar */}
            <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 0.4 }}>lane mode</div>

                {/* voices selector (controls number of lanes) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>voices</div>
                    <select value={String(lanes)} onChange={(e) => setLanes(parseInt(e.target.value))} style={{ height: 28, padding: '0 8px' }}>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={String(n)}>{n}</option>)}
                    </select>
                </div>

                {/* root */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>root</div>
                    <select value={String(rootPc)} onChange={(e) => setRootPc(parseInt(e.target.value))} style={{ height: 28, padding: '0 8px' }}>
                        {NOTE_NAMES.map((n, i) => (<option key={i} value={String(i)}>{n}</option>))}
                    </select>
                </div>

                {/* scale */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>scale</div>
                    <select value={String(scaleName)} onChange={(e) => setScaleName(e.target.value as keyof typeof SCALES)} style={{ height: 28, padding: '0 8px' }}>
                        {Object.keys(SCALES).map(k => (<option key={k} value={k}>{k}</option>))}
                    </select>
                </div>

                {/* select all */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, opacity: 0.8, userSelect: 'none' }}>
                    <input type="checkbox" checked={selectAll} onChange={(e) => setSelectAll(e.target.checked)} /> select all
                </label>

                {/* edit lanes */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
                    <span style={{ fontSize: 12, opacity: 0.8 }}>edit lanes</span>
                    {Array.from({ length: Math.min(4, lanes) }).map((_, i) => {
                        const n = i + 1; const active = editCount === n;
                        return (
                            <button key={n} onClick={() => setEditCount(n)} style={{ height: 28, padding: '0 12px', border: '1px solid #5C4A36', borderRadius: 999, background: active ? 'rgba(186,240,207,0.7)' : 'rgba(255,255,255,0.6)' }}>{n}</button>
                        );
                    })}
                </div>
            </div>

            {/* stage */}
            <div ref={stageRef} onPointerMove={onMove} onPointerUp={stop} onPointerLeave={stop} style={stageStyle}>
                {Array.from({ length: lanes }).map((_, i) => {
                    const lane = getLane(i);
                    const active = isActive(i);
                    const laneStyle: React.CSSProperties = {
                        position: 'absolute', top: 0, bottom: 0, left: `${(i * 100) / lanes}%`, width: `${100 / lanes}%`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                        borderRight: i !== lanes - 1 ? '1px solid #5C4A36' : 'none',
                        background: active ? `rgba(186,240,207,${0.28 + pitchToIntensity(lane.pitch) * 0.22})` : undefined,
                        boxShadow: active ? 'inset 0 0 0 2px rgba(138, 212, 170, 0.6), 0 0 22px rgba(186, 240, 207, 0.6)' : 'none'
                    };
                    return (
                        <div key={i} style={laneStyle}>
                            <LaneCanvasTree pitch={lane.pitch} pan={lane.pan} />
                            <div style={{ position: 'relative', marginBottom: 8, marginInline: 'auto', width: '78%', maxWidth: 152, textAlign: 'center', fontSize: 9, fontWeight: 600, pointerEvents: 'none' }}>
                                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, width: 12, height: 1, background: '#000' }} />
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, width: 1, height: 12, background: '#000' }} />
                                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 1, background: '#000' }} />
                                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 1, height: 12, background: '#000' }} />
                                </div>
                                <div style={{ marginBottom: 4, opacity: 0.9, letterSpacing: 0.4 }}>{lanes === 4 ? ["s", "a", "t", "b"][i] : `v${i + 1}`}</div>
                                <div style={{ opacity: 0.8, marginBottom: 4 }}>{midiToNote(lane.pitch)}</div>
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <div style={{ transform: 'scale(.85)', transformOrigin: 'top' }}>
                                        <StereoVisualizer pan={lane.pan} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* overlay subdivisions tied to voices */}
                {lanes > 1 && (
                    <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, zIndex: 40 }}>
                        {Array.from({ length: lanes - 1 }).map((_, i) => (
                            <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, width: 2, background: 'rgba(92,74,54,0.2)', left: `${((i + 1) * 100) / lanes}%` }} />
                        ))}
                    </div>
                )}

                {/* simple L/R handles */}
                <div onPointerDown={(e) => { setDragging('L'); updatePitchAt(e.clientX, e.clientY, 'L'); }} style={{ position: 'absolute', left: left.x - 16, top: left.y - 16, height: 32, width: 32, borderRadius: 16, background: '#e7d9be', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab' }}>L</div>
                <div onPointerDown={(e) => { setDragging('R'); updatePitchAt(e.clientX, e.clientY, 'R'); }} style={{ position: 'absolute', left: right.x - 16, top: right.y - 16, height: 32, width: 32, borderRadius: 16, background: '#f0dcc2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab' }}>R</div>
            </div>
        </div>
    );
}

export default function App() {
    return (
        <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4ede0' }}>
            <ConductorLaneVisualizer />
        </div>
    );
}

export { };

