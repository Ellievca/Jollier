import React, { useMemo, useRef, useState, useEffect } from "react";
import { initWebMIDI } from "./utils/webmidi";
import HandTracker from "./components/HandTracker";

/**
 * Conductor Lane Visualizer with Hand Tracking Support
 */

// ---------------- Helper constants & functions ----------------
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const SCALES: Record<string, number[]> = {
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

const MIDI_CHANNEL_BASE = 1;
const PREVIEW_TONE = false;

function midiToNote(m: number) {
    const n = NOTE_NAMES[((m % 12) + 12) % 12];
    return `${n}${Math.floor(m / 12) - 1}`.toLowerCase();
}
function midiToFreq(m: number) { return 440 * Math.pow(2, (m - 69) / 12); }
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

function computeTargetIndicesDirectional(
    lanes: number,
    editCount: number,
    selectAll: boolean,
    startIndex: number,
    dir: 1 | -1
): number[] {
    if (lanes <= 0) return [];
    if (selectAll) return Array.from({ length: lanes }, (_, i) => i);
    const start = Math.max(0, Math.min(lanes - 1, startIndex));
    const count = Math.max(1, Math.min(editCount, lanes));
    const out: number[] = [];
    for (let k = 0; k < count; k++) {
        const idx = start + k * dir;
        if (idx >= 0 && idx < lanes) out.push(idx);
    }
    return out.sort((a, b) => a - b);
}

// ---------------- Dev tests (non-fatal) ----------------
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
            const s = snapToScale(61, 0, SCALES.major);
            console.assert([60, 62].includes(s), 'snapToScale around C major');
            const dirR = computeTargetIndicesDirectional(4, 2, false, 1, 1);
            const dirL = computeTargetIndicesDirectional(4, 2, false, 2, -1);
            console.assert(JSON.stringify(dirR) === JSON.stringify([1, 2]), 'dir +1 contiguous');
            console.assert(JSON.stringify(dirL) === JSON.stringify([1, 2]), 'dir -1 contiguous');
            console.assert(computeTargetIndicesDirectional(4, 2, true, 2, 1).length === 4, 'selectAll returns all');
            console.assert(JSON.stringify(computeTargetIndicesDirectional(1, 3, false, 0, 1)) === JSON.stringify([0]), 'single lane clamp ok');
        }
    } catch {/* non-fatal */ }
})();

// ---------------- Ozone-style mini stereo visualizer ----------------
function StereoVisualizer({ pan = 64 }: { pan?: number }) {
    const intensity = Math.min(1, Math.abs(pan - 64) / 64);
    const panNorm = Math.max(-1, Math.min(1, (pan - 64) / 64));
    const { pathA, pathB, pathC } = useMemo(() => {
        const A = 12 + intensity * 14, B = 18 + intensity * 10, C = 26 + intensity * 12, ph = panNorm * Math.PI;
        const gen = (a: number, f: number, p: number) => { const pts: string[] = []; for (let x = 0; x <= 100; x += 2) { const y = 50 + a * Math.sin((x / 100) * (Math.PI * 2) * f + p); pts.push(`${x},${y.toFixed(2)}`); } return `M0,50L${pts.join(" ")}`; };
        return { pathA: gen(A, B, ph), pathB: gen(A * 0.75, C, ph + Math.PI / 3), pathC: gen(A * 0.5, B * 0.6, ph + Math.PI / 1.7) };
    }, [intensity, panNorm]);
    const dots = useMemo(() => Array.from({ length: 24 }).map(() => ({ x: 50 + (Math.random() - 0.5) * 60 * (panNorm * 2), y: 50 + (Math.random() - 0.5) * 50, opacity: 0.5 + Math.random() * 0.4 })), [panNorm]);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: 8, color: '#2b241c' }}>
            <svg width={140} height={40} viewBox="0 0 100 100">
                <path d={pathA} fill="none" stroke="#2b241c" strokeWidth={0.7} opacity={0.35} />
                <path d={pathB} fill="none" stroke="#2b241c" strokeWidth={0.5} opacity={0.3} />
                <path d={pathC} fill="none" stroke="#2b241c" strokeWidth={0.4} opacity={0.25} />
                {dots.map((d, i) => (<circle key={i} cx={d.x} cy={d.y} r={1.2} fill="black" opacity={d.opacity} />))}
            </svg>
        </div>
    );
}

// ---------------- WebAudio (singleton) ----------------
const audioCtxRef: { current: AudioContext | null } =
    (globalThis as any).__audioCtxRef || ((globalThis as any).__audioCtxRef = { current: null } as any);
function getAudioContext(): AudioContext | null {
    try {
        if (!audioCtxRef.current) {
            const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (!Ctx) return null;
            audioCtxRef.current = new Ctx();
        }
        const ctx = audioCtxRef.current!;
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => { });
        }
        return ctx;
    } catch {
        return null;
    }
}

// ---------------- Lane audio buses ----------------
type LaneBus = {
    gain: GainNode;
    panner: StereoPannerNode;
    analyserFreq: AnalyserNode;
    analyserTime: AnalyserNode;
};

const audioBusesRef: { current: Array<LaneBus | null> } = { current: [] };

function getLaneBus(i: number): LaneBus | null {
    const ctx = getAudioContext(); if (!ctx) return null;
    if (!audioBusesRef.current[i]) {
        const gain = ctx.createGain();
        gain.gain.value = 1;

        const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

        const analyserFreq = ctx.createAnalyser();
        analyserFreq.fftSize = 1024;
        analyserFreq.smoothingTimeConstant = 0.8;

        const analyserTime = ctx.createAnalyser();
        analyserTime.fftSize = 2048;
        analyserTime.smoothingTimeConstant = 0.85;

        gain.connect(analyserFreq);
        gain.connect(analyserTime);

        if (panner) {
            gain.connect(panner);
            panner.connect(ctx.destination);
            audioBusesRef.current[i] = { gain, panner, analyserFreq, analyserTime };
        } else {
            const panGainL = ctx.createGain(), panGainR = ctx.createGain(), merger = ctx.createChannelMerger(2);
            const splitter = ctx.createChannelSplitter(2);
            gain.connect(splitter);
            splitter.connect(panGainL, 0);
            splitter.connect(panGainR, 1);
            panGainL.connect(merger, 0, 0);
            panGainR.connect(merger, 0, 1);
            merger.connect(ctx.destination);
            audioBusesRef.current[i] = {
                gain,
                panner: ({} as StereoPannerNode),
                analyserFreq,
                analyserTime,
            } as any;
            (audioBusesRef.current[i] as any)._panGains = { panGainL, panGainR };
        }
    }
    return audioBusesRef.current[i]!;
}

function setLanePan(i: number, pan0to127: number) {
    const bus = getLaneBus(i); const ctx = getAudioContext(); if (!bus || !ctx) return;
    const p = Math.max(-1, Math.min(1, (pan0to127 - 64) / 64));
    if (bus.panner && 'pan' in bus.panner) {
        bus.panner.pan.setValueAtTime(p, ctx.currentTime);
    } else {
        const g = (audioBusesRef.current[i] as any)?._panGains;
        if (g) {
            const left = Math.cos((p + 1) * 0.25 * Math.PI);
            const right = Math.sin((p + 1) * 0.25 * Math.PI);
            g.panGainL.gain.setValueAtTime(left, ctx.currentTime);
            g.panGainR.gain.setValueAtTime(right, ctx.currentTime);
        }
    }
}

function getLaneAnalysers(i: number) {
    const bus = getLaneBus(i);
    return bus ? { freq: bus.analyserFreq, time: bus.analyserTime } : null;
}

function playSoftPiano(freq: number, laneIndex: number, pan: number) {
    const ctx = getAudioContext(); if (!ctx) return;
    const bus = getLaneBus(laneIndex); if (!bus) return;
    setLanePan(laneIndex, pan);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0002, now + 1.2);
    osc.connect(gain).connect(bus.gain);
    osc.start(now);
    osc.stop(now + 1.3);
}

// ---------------- Control-panel visualizers (transparent canvases) ----------------
function MiniVU({ analyser, width = 90, height = 8 }: { analyser: AnalyserNode; width?: number; height?: number }) {
    const ref = useRef<HTMLCanvasElement | null>(null);
    useEffect(() => {
        if (!analyser || !ref.current) return;
        const ctx = ref.current.getContext('2d');
        const buf = new Uint8Array(analyser.fftSize);
        let raf: number;
        const loop = () => {
            analyser.getByteTimeDomainData(buf);
            if (!ctx) return;
            ctx.clearRect(0, 0, width, height);
            let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
            const rms = Math.sqrt(sum / buf.length);
            ctx.fillStyle = 'rgba(138,212,170,0.85)';
            ctx.fillRect(0, 0, width * Math.min(1, rms * 1.8), height);
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [analyser, width, height]);
    return <canvas ref={ref} width={width} height={height} style={{ display: 'block', borderRadius: 4 }} />;
}

function OscilloscopeMini({ analyser, width = 120, height = 32 }: { analyser: AnalyserNode; width?: number; height?: number }) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    useEffect(() => {
        const cvs = canvasRef.current; if (!cvs || !analyser) return;
        const ctx = cvs.getContext('2d'); if (!ctx) return;
        const buf = new Uint8Array(analyser.fftSize);
        let raf: number;
        const loop = () => {
            analyser.getByteTimeDomainData(buf);
            ctx.clearRect(0, 0, width, height);
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(43,36,28,0.45)';
            ctx.beginPath();
            for (let i = 0; i < buf.length; i++) {
                const x = (i / (buf.length - 1)) * width;
                const y = (buf[i] / 255) * height;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [analyser, width, height]);
    return <canvas ref={canvasRef} width={width} height={height} style={{ display: 'block' }} />;
}

function SpectrumBars({ analyser, width = 96, height = 32, bars = 24 }: { analyser: AnalyserNode; width?: number; height?: number; bars?: number }) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    useEffect(() => {
        const cvs = canvasRef.current; if (!cvs || !analyser) return;
        const ctx = cvs.getContext('2d'); if (!ctx) return;
        const binCount = analyser.frequencyBinCount;
        const full = new Uint8Array(binCount);
        let raf: number;
        const loop = () => {
            analyser.getByteFrequencyData(full);
            ctx.clearRect(0, 0, width, height);
            const step = Math.max(1, Math.floor(binCount / bars));
            const barW = width / bars;
            for (let i = 0; i < bars; i++) {
                let sum = 0, n = 0;
                for (let k = i * step; k < (i + 1) * step && k < binCount; k++) { sum += full[k]; n++; }
                const v = n ? sum / n : 0;
                const h = (v / 255) * height;
                const x = i * barW;
                const alpha = 0.65;
                const low = i < 2;
                ctx.fillStyle = low ? `rgba(186,240,207,${alpha})` : `rgba(138,212,170,${alpha})`;
                ctx.fillRect(x, height - h, barW * 0.78, h);
            }
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [analyser, width, height, bars]);
    return <canvas ref={canvasRef} width={width} height={height} style={{ display: 'block' }} />;
}

// ---------------- Lane canvas (physics + labels, NO outlines) ----------------
function LaneCanvasTree({ laneIndex, pitch, pan }: { laneIndex: number; pitch: number; pan: number }) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    type NodeT = { id: number; x: number; y: number; baseX: number; baseY: number; note: string; color: string; createdAt: number; parent: number | null; vx: number; vy: number };
    const nodesRef = useRef<NodeT[]>([]);
    const nextIdRef = useRef(0);
    const lastSnapRef = useRef(Math.round(pitch));
    const lastSpawnRef = useRef(0);
    const rafRef = useRef<number | undefined>(undefined);

    const colors = ["#ffd6a5", "#fdffb6", "#caffbf", "#9bf6ff"];

    const yFromMidi = (m: number, H: number) => { const min = 36, max = 96; const t = Math.max(0, Math.min(1, (m - min) / (max - min))); return (1 - t) * (H * 0.75) + (H * 0.1); };
    const xFromPan = (p: number, W: number) => { const t = Math.max(0, Math.min(1, p / 127)); return (W * 0.1) + t * (W * 0.8); };

    useEffect(() => {
        const cvs = canvasRef.current; if (!cvs) return;
        const resize = () => { const parent = cvs.parentElement; if (!parent) return; const rect = parent.getBoundingClientRect(); const dpr = Math.max(1, (window as any).devicePixelRatio || 1); cvs.width = Math.floor(rect.width * dpr); cvs.height = Math.floor(rect.height * dpr); (cvs.style as any).width = `${rect.width}px`; (cvs.style as any).height = `${rect.height}px`; };
        resize();
        const RO = (window as any).ResizeObserver;
        const ro = RO ? new RO(resize) : null;
        ro?.observe(cvs.parentElement!);
        return () => ro?.disconnect();
    }, []);

    useEffect(() => {
        const snap = Math.round(pitch); const now = Date.now();
        if (snap === lastSnapRef.current) return;
        if (now - lastSpawnRef.current < 100) { lastSnapRef.current = snap; return; }
        const cvs = canvasRef.current; if (!cvs) return; const W = cvs.width, H = cvs.height;
        const x = xFromPan(pan, W), y = yFromMidi(snap, H);
        const id = nextIdRef.current++;
        const parent = nodesRef.current.length ? nodesRef.current[nodesRef.current.length - 1].id : null;
        nodesRef.current.push({ id, x, y, baseX: x, baseY: y, note: midiToNote(snap).toUpperCase(), color: colors[id % colors.length], createdAt: now, parent, vx: (Math.random() - 0.5) * 0.9, vy: (Math.random() - 0.5) * 0.9 });
        if (PREVIEW_TONE) playSoftPiano(midiToFreq(snap), laneIndex, pan); lastSpawnRef.current = now; lastSnapRef.current = snap;
    }, [pitch, pan, laneIndex]);

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

            nodesRef.current.forEach(n => {
                if (n.parent == null) return; const p = nodesRef.current.find(m => m.id === n.parent); if (!p) return;
                const op = Math.max(0, 1 - (now - n.createdAt) / fadeTime) * 0.35;
                ctx.strokeStyle = `rgba(43,36,28,${op})`; ctx.lineWidth = 2.0 * (cvs.width / 800);
                ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(n.x, n.y); ctx.stroke();
            });

            nodesRef.current.forEach(n => {
                const op = Math.max(0, 1 - (now - n.createdAt) / fadeTime);
                const R = 24 * (cvs.width / 800);
                const hex = n.color;
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);

                ctx.save();
                ctx.globalCompositeOperation = 'source-over';
                ctx.shadowColor = 'transparent';
                ctx.lineWidth = 0;

                ctx.beginPath();
                ctx.arc(n.x, n.y, R, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${r},${g},${b},${(op * 0.95).toFixed(3)})`;
                ctx.fill();

                ctx.fillStyle = `rgba(43,36,28,${(0.85 * op).toFixed(3)})`;
                ctx.font = `${12 * (cvs.width / 800)}px ui-monospace, Menlo, monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(n.note, n.x, n.y);

                ctx.restore();
            });

            rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [pitch, pan]);

    return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />;
}


// ---------------- Main visualizer with lanes/voices (max 4) ----------------
export function ConductorLaneVisualizer() {
    // --- state & refs ---
    const [lanes, _setLanes] = useState<number>(2);
    const setLanes = (n: number) => _setLanes(Math.max(1, Math.min(4, Number.isFinite(n) ? n : 1)));

    const [laneData, setLaneData] = useState(() => Array.from({ length: 2 }, () => ({ pitch: 60, pan: 64 })));
    const [rootPc, setRootPc] = useState(0);
    const [scaleName, setScaleName] = useState<keyof typeof SCALES>('major');
    const [selectAll, setSelectAll] = useState(false);
    const [editCount, setEditCount] = useState<number>(1);
    const stageRef = useRef<HTMLDivElement | null>(null);
    const [left, setLeft] = useState({ x: 160, y: 200 });
    const [right, setRight] = useState({ x: 480, y: 200 });
    const [dragging, setDragging] = useState<null | 'L' | 'R'>(null);

    // Hand tracking state
    const [useHandTracking, setUseHandTracking] = useState(false);

    // MIDI env + note memory / throttle / pan cache
    const midiRef = useRef<Awaited<ReturnType<typeof initWebMIDI>> | null>(null);
    const lastNoteRef = useRef<(number | undefined)[]>([]);
    const lastSendMsRef = useRef(0);
    const panCacheRef = useRef<Record<number, number>>({});

    // Highlight fade tracking
    const FADE_MS = 900;
    const [highlightAt, setHighlightAt] = useState<number[]>(() => Array.from({ length: 2 }, () => 0));
    const [tick, setTick] = useState(0);
    useEffect(() => { let raf: number; const loop = () => { setTick(t => t + 1); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf); }, []);

    // keep arrays in sync with lane count
    useEffect(() => {
        setLaneData(prev => { const next = prev.slice(0, lanes); while (next.length < lanes) next.push({ pitch: 60, pan: 64 }); return next; });
        setHighlightAt(prev => { const next = prev.slice(0, lanes); while (next.length < lanes) next.push(0); return next; });
        setEditCount(c => Math.min(Math.max(1, c), lanes));
    }, [lanes]);

    useEffect(() => { laneData.forEach((ld, i) => setLanePan(i, ld.pan)); }, [laneData]);

    // Initialize MIDI (pick IN and OUT once) + attach listeners
    useEffect(() => {
        let mounted = true;
        let offNote = () => { };
        let offCC = () => { };

        (async () => {
            const midi = await initWebMIDI(/IAC|loopMIDI|Ableton|DAW|Bus 1/i);
            if (!midi || !mounted) return;

            midi.pickIn(/From Ableton|from DAW|to Browser|Visualizer In|IAC|loopMIDI/i);
            midi.pick(/To Ableton|to DAW|IAC.*Bus 1|loopMIDI/i);

            midiRef.current = midi;
            console.log('[MIDI] IN =', midi.in?.name, 'OUT =', midi.out?.name);

            const toLane = (ch: number) => {
                return Math.max(0, Math.min(lanes - 1, ch - MIDI_CHANNEL_BASE));
            };

            offNote = midi.onNote(({ ch, note, on }) => {
                if (!on) return;
                const laneIndex = toLane(ch);
                setLaneData(prev => {
                    const u = [...prev];
                    const lane = u[laneIndex] ?? { pitch: 60, pan: 64 };
                    u[laneIndex] = { ...lane, pitch: note };
                    return u;
                });
            });

            offCC = midi.onCC(({ ch, cc, val }) => {
                if (cc !== 10) return;
                const laneIndex = toLane(ch);
                setLaneData(prev => {
                    const u = [...prev];
                    const lane = u[laneIndex] ?? { pitch: 60, pan: 64 };
                    u[laneIndex] = { ...lane, pan: val };
                    return u;
                });
            });
        })();

        return () => {
            mounted = false;
            offNote();
            offCC();
        };
    }, [lanes, setLaneData]);

    const getLane = (i: number) => laneData[i] ?? { pitch: 60, pan: 64 };

    const markHighlight = (idxs: number[]) => setHighlightAt(prev => { const next = [...prev]; const now = Date.now(); idxs.forEach(i => { if (i >= 0 && i < next.length) next[i] = now; }); return next; });

    const updatePitchAt = (x: number, y: number, w: 'L' | 'R') => {
        if (!stageRef.current) return; const r = stageRef.current.getBoundingClientRect();
        const { laneIndex, pan } = computePanForX(x, r, lanes);
        const raw = Math.max(21, Math.min(108 - ((y - r.top) / r.height) * 60, 108));
        const pitch = snapToScale(raw, rootPc, SCALES[scaleName]);
        const dir: 1 | -1 = w === 'L' ? 1 : -1;
        const targets = computeTargetIndicesDirectional(lanes, editCount, selectAll, laneIndex, dir);
        markHighlight(targets);
        setLaneData(prev => { const u = [...prev]; targets.forEach(idx => { const lane = u[idx] ?? { pitch: 60, pan: 64 }; u[idx] = { ...lane, pitch, pan }; setLanePan(idx, pan); }); return u; });

        const nowMs = performance.now();
        if (nowMs - lastSendMsRef.current < 30) {
            if (w === 'L') { setLeft({ x: x - r.left, y: y - r.top }); } else { setRight({ x: x - r.left, y: y - r.top }); }
            return;
        }
        lastSendMsRef.current = nowMs;

        const out = midiRef.current;
        if (out) {
            targets.forEach(idx => {
                const ch = Math.min(16, Math.max(MIDI_CHANNEL_BASE, idx + MIDI_CHANNEL_BASE));
                const newNote = Math.round(pitch);
                const prevNote = lastNoteRef.current[idx];

                if (prevNote != null && prevNote !== newNote) {
                    out.sendNoteOff(ch - 1, prevNote);
                }
                if (prevNote !== newNote) {
                    const vel = Math.max(1, Math.min(127, Math.round(20 + 100 * pitchToIntensity(newNote))));
                    out.sendNote(ch - 1, newNote, vel);
                    lastNoteRef.current[idx] = newNote;
                }

                if (panCacheRef.current[idx] !== pan) {
                    out.sendCC(ch - 1, 10, pan);
                    panCacheRef.current[idx] = pan;
                }
            });
        }

        if (w === 'L') { setLeft({ x: x - r.left, y: y - r.top }); } else { setRight({ x: x - r.left, y: y - r.top }); }
    };

    // Hand tracking handler - updated to support simultaneous hand control
    const handleHandUpdate = (centers: Array<{x: number, y: number, label: string}>) => {
        if (!stageRef.current || !useHandTracking) return;
        
        const stageRect = stageRef.current.getBoundingClientRect();
        const videoWidth = 640;
        const videoHeight = 480;
        
        // Process both hands simultaneously
        centers.forEach(hand => {
            // Map hand position from video coordinates to stage coordinates
            // Mirror x coordinate since video is mirrored
            const mappedX = stageRect.left + ((videoWidth - hand.x) / videoWidth) * stageRect.width;
            const mappedY = stageRect.top + (hand.y / videoHeight) * stageRect.height;
            
            // Calculate pitch and pan for this hand
            const { laneIndex, pan } = computePanForX(mappedX, stageRect, lanes);
            const raw = Math.max(21, Math.min(108 - ((mappedY - stageRect.top) / stageRect.height) * 60, 108));
            const pitch = snapToScale(raw, rootPc, SCALES[scaleName]);
            
            // Each hand controls its own marker and sends its own MIDI
            const marker = hand.label === 'left' ? 'R' : 'L';
            const dir: 1 | -1 = marker === 'L' ? 1 : -1;
            const targets = computeTargetIndicesDirectional(lanes, editCount, selectAll, laneIndex, dir);
            
            // Update visual position
            if (marker === 'L') {
                setLeft({ x: mappedX - stageRect.left, y: mappedY - stageRect.top });
            } else {
                setRight({ x: mappedX - stageRect.left, y: mappedY - stageRect.top });
            }
            
            // Update lane data
            markHighlight(targets);
            setLaneData(prev => {
                const u = [...prev];
                targets.forEach(idx => {
                    const lane = u[idx] ?? { pitch: 60, pan: 64 };
                    u[idx] = { ...lane, pitch, pan };
                    setLanePan(idx, pan);
                });
                return u;
            });
            
            // Send MIDI for this hand
            const out = midiRef.current;
            if (out) {
                targets.forEach(idx => {
                    const ch = Math.min(16, Math.max(MIDI_CHANNEL_BASE, idx + MIDI_CHANNEL_BASE));
                    const newNote = Math.round(pitch);
                    const prevNote = lastNoteRef.current[idx];
                    
                    if (prevNote != null && prevNote !== newNote) {
                        out.sendNoteOff(ch - 1, prevNote);
                    }
                    if (prevNote !== newNote) {
                        const vel = Math.max(1, Math.min(127, Math.round(20 + 100 * pitchToIntensity(newNote))));
                        out.sendNote(ch - 1, newNote, vel);
                        lastNoteRef.current[idx] = newNote;
                    }
                    
                    if (panCacheRef.current[idx] !== pan) {
                        out.sendCC(ch - 1, 10, pan);
                        panCacheRef.current[idx] = pan;
                    }
                });
            }
        });
    };

    // Hidden hand tracker for background processing
    useEffect(() => {
        if (!useHandTracking) return;
        
        // This effect will trigger the HandTracker to mount/unmount
        // The HandTracker is rendered hidden below
    }, [useHandTracking]);

    const onMove = (e: React.PointerEvent) => { if (!dragging || !stageRef.current || useHandTracking) return; updatePitchAt(e.clientX, e.clientY, dragging); };
    const start = (w: 'L' | 'R') => (e: React.PointerEvent) => { if (useHandTracking) return; setDragging(w); updatePitchAt(e.clientX, e.clientY, w); };

    const stop = () => {
        if (dragging && midiRef.current) {
            const out = midiRef.current;
            for (let i = 0; i < lanes; i++) {
                const prev = lastNoteRef.current[i];
                if (prev != null) {
                    const ch = Math.min(16, Math.max(MIDI_CHANNEL_BASE, i + MIDI_CHANNEL_BASE));
                    out.sendNoteOff(ch - 1, prev);
                    lastNoteRef.current[i] = undefined;
                }
            }
        }
        setDragging(null);
    };

    useEffect(() => {
        return () => {
            const out = midiRef.current;
            if (out) {
                for (let i = 0; i < Math.min(16, lanes); i++) {
                    const ch = Math.min(16, Math.max(MIDI_CHANNEL_BASE, i + MIDI_CHANNEL_BASE));
                    out.sendCC(ch - 1, 123, 0);
                }
            }
        };
    }, [lanes]);

    const containerStyle: React.CSSProperties = { width: '100%', minHeight: 620, background: '#f4ede0', color: '#2b241c', padding: 18, boxSizing: 'border-box', fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto' };
    const stageStyle: React.CSSProperties = { position: 'relative', width: '100%', aspectRatio: '16/8', border: '2px solid #5C4A36', borderRadius: 18, overflow: 'hidden' };

    const laneAlpha = (i: number) => { const t = highlightAt[i] || 0; if (!t) return 0; const dt = Date.now() - t; return Math.max(0, Math.min(1, 1 - dt / FADE_MS)); };

    return (
        <div style={containerStyle}>
            <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 0.4 }}>lane mode</div>
                
                {/* Hand Tracking Toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, padding: '6px 12px', background: useHandTracking ? 'rgba(74, 158, 255, 0.2)' : 'rgba(255, 255, 255, 0.35)', borderRadius: 999, border: '1px solid #5C4A36', cursor: 'pointer', userSelect: 'none' }}>
                    <input 
                        type="checkbox" 
                        checked={useHandTracking} 
                        onChange={(e) => setUseHandTracking(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                    />
                    <span>👋 Hand Tracking</span>
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>voices</div>
                    <select value={String(lanes)} onChange={(e) => setLanes(parseInt(e.target.value))} style={{ height: 26, padding: '0 8px' }}>
                        {[1, 2, 3, 4].map(n => <option key={n} value={String(n)}>{n}</option>)}
                    </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>root</div>
                    <select value={String(rootPc)} onChange={(e) => setRootPc(parseInt(e.target.value))} style={{ height: 26, padding: '0 8px' }}>
                        {NOTE_NAMES.map((n, i) => (<option key={i} value={String(i)}>{n}</option>))}
                    </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>scale</div>
                    <select value={String(scaleName)} onChange={(e) => setScaleName(e.target.value as keyof typeof SCALES)} style={{ height: 26, padding: '0 8px' }}>
                        {Object.keys(SCALES).map(k => (<option key={k} value={k}>{k}</option>))}
                    </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, opacity: 0.8, userSelect: 'none' }}>
                    <input type="checkbox" checked={selectAll} onChange={(e) => setSelectAll(e.target.checked)} /> select all
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, opacity: 0.8 }}>edit lanes</span>
                    {Array.from({ length: Math.min(4, lanes) }).map((_, i) => {
                        const n = i + 1; const active = editCount === n;
                        return (
                            <button key={n} onClick={() => setEditCount(n)} style={{ height: 26, padding: '0 10px', border: '1px solid #5C4A36', borderRadius: 999, background: active ? 'rgba(186,240,207,0.7)' : 'rgba(255,255,255,0.35)' }}>{n}</button>
                        );
                    })}
                </div>
            </div>

            {/* Hand Tracker - hidden, runs in background */}
            {useHandTracking && (
                <div style={{ position: 'fixed', top: -10000, left: -10000, pointerEvents: 'none' }}>
                    <HandTracker onHandUpdate={handleHandUpdate} />
                </div>
            )}

            <div ref={stageRef} onPointerMove={onMove} onPointerUp={stop} onPointerLeave={stop} style={stageStyle}>
                {Array.from({ length: lanes }).map((_, i) => {
                    const lane = getLane(i);
                    const alpha = laneAlpha(i);
                    const baseAlpha = 0.28 + pitchToIntensity(lane.pitch) * 0.22;
                    const bgAlpha = baseAlpha * alpha;
                    const glow = alpha > 0 ? `inset 0 0 0 2px rgba(138, 212, 170, ${0.55 * alpha}), 0 0 ${18 * alpha}px rgba(186, 240, 207, ${0.55 * alpha})` : 'none';
                    const laneStyle: React.CSSProperties = {
                        position: 'absolute', top: 0, bottom: 0, left: `${(i * 100) / lanes}%`, width: `${100 / lanes}%`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                        borderRight: i !== lanes - 1 ? '1px solid #5C4A36' : 'none',
                        background: alpha > 0 ? `rgba(186,240,207,${bgAlpha})` : undefined,
                        boxShadow: glow
                    };
                    const analysers = getLaneAnalysers(i);
                    return (
                        <div key={i} style={laneStyle}>
                            <LaneCanvasTree laneIndex={i} pitch={lane.pitch} pan={lane.pan} />
                            <div style={{ position: 'relative', margin: '8px auto', width: '88%', maxWidth: 520, textAlign: 'center', fontSize: 9, fontWeight: 600, pointerEvents: 'none', background: 'transparent', padding: '6px 18px', boxSizing: 'border-box', overflow: 'hidden', borderRadius: 10 }}>
                                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, width: 16, height: 2, background: '#2b241c', opacity: 0.35 }} />
                                    <div style={{ position: 'absolute', top: 0, left: 0, width: 2, height: 16, background: '#2b241c', opacity: 0.35 }} />
                                    <div style={{ position: 'absolute', top: 0, right: 0, width: 16, height: 2, background: '#2b241c', opacity: 0.35 }} />
                                    <div style={{ position: 'absolute', top: 0, right: 0, width: 2, height: 16, background: '#2b241c', opacity: 0.35 }} />
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, width: 16, height: 2, background: '#2b241c', opacity: 0.35 }} />
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, width: 2, height: 16, background: '#2b241c', opacity: 0.35 }} />
                                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 16, height: 2, background: '#2b241c', opacity: 0.35 }} />
                                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 2, height: 16, background: '#2b241c', opacity: 0.35 }} />
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 0 }}>
                                        <StereoVisualizer pan={lane.pan} />
                                        <div style={{ opacity: 0.9, letterSpacing: 0.4, width: 24, textTransform: 'uppercase' }}>{lanes === 4 ? ["s", "a", "t", "b"][i] : `v${i + 1}`}</div>
                                        <div style={{ opacity: 0.85, minWidth: 30, textAlign: 'left' }}>{midiToNote(lane.pitch)}</div>
                                    </div>

                                    {analysers && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end', paddingRight: 16, maxWidth: '56%' }}>
                                            <MiniVU analyser={analysers.time} width={85} />
                                            <OscilloscopeMini analyser={analysers.time} width={120} />
                                            <SpectrumBars analyser={analysers.freq} width={80} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {lanes > 1 && (
                    <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, zIndex: 40 }}>
                        {Array.from({ length: lanes - 1 }).map((_, i) => (
                            <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, width: 2, background: 'rgba(92,74,54,0.2)', left: `${((i + 1) * 100) / lanes}%` }} />
                        ))}
                    </div>
                )}

                {/* L marker */}
                <div 
                    onPointerDown={!useHandTracking ? start('L') : undefined}
                    style={{ 
                        position: 'absolute', 
                        left: left.x - 16, 
                        top: left.y - 16, 
                        height: 32, 
                        width: 32, 
                        borderRadius: 16, 
                        background: '#e7d9be',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        cursor: useHandTracking ? 'default' : 'grab',
                        pointerEvents: useHandTracking ? 'none' : 'auto',
                        fontWeight: 600,
                        fontSize: 14,
                        color: '#2b241c'
                    }}
                >
                    L
                </div>

                {/* R marker */}
                <div 
                    onPointerDown={!useHandTracking ? start('R') : undefined}
                    style={{ 
                        position: 'absolute', 
                        left: right.x - 16, 
                        top: right.y - 16, 
                        height: 32, 
                        width: 32, 
                        borderRadius: 16, 
                        background: '#f0dcc2',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        cursor: useHandTracking ? 'default' : 'grab',
                        pointerEvents: useHandTracking ? 'none' : 'auto',
                        fontWeight: 600,
                        fontSize: 14,
                        color: '#2b241c'
                    }}
                >
                    R
                </div>
            </div>
        </div>
    );
}

// ---------------- App ----------------
export default function App() {
    return (
        <div style={{ width: '100%', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4ede0' }}>
            <ConductorLaneVisualizer />
        </div>
    );
}