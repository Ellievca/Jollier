// src/utils/webmidi.ts
export type MidiNoteEvent = {
    ch: number; // 0–15
    note: number; // 0–127
    vel: number; // 0–127
    on: boolean; // true = note on, false = off
    raw: MIDIMessageEvent;
};

export type MidiCCEvent = {
    ch: number; // 0–15
    cc: number; // 0–127
    val: number; // 0–127
    raw: MIDIMessageEvent;
};

export type MidiEnv = {
    // OUTPUT
    out: MIDIOutput | null;
    pick: (nameRegex?: RegExp) => MIDIOutput | null;
    sendNote: (ch: number, note: number, vel: number, whenMs?: number) => void;
    sendNoteOff: (ch: number, note: number, whenMs?: number) => void;
    sendCC: (ch: number, cc: number, val: number, whenMs?: number) => void;
    sendPitchBend: (ch: number, value14: number, whenMs?: number) => void;

    // INPUT
    input: MIDIInput | null;
    pickIn: (nameRegex?: RegExp) => MIDIInput | null;

    // LISTENERS (return unsubscribe)
    onMessage: (fn: (e: MIDIMessageEvent) => void) => () => void;
    onNote: (fn: (d: MidiNoteEvent) => void) => () => void;
    onCC: (fn: (d: MidiCCEvent) => void) => () => void;
};

export async function initWebMIDI(
    nameHint = /WebApp Out|IAC|loopMIDI|Ableton|from DAW|to Browser/i
): Promise<MidiEnv | null> {
    if (!("requestMIDIAccess" in navigator)) {
        console.warn("Web MIDI unsupported (use Chrome/Edge on HTTPS or localhost).");
        return null;
    }

    const access = await navigator.requestMIDIAccess({ sysex: false });

    const findOut = (rx = nameHint) =>
        [...access.outputs.values()].find(o => rx.test(o.name || "")) || null;

    const findIn = (rx = nameHint) =>
        [...access.inputs.values()].find(i => rx.test(i.name || "")) || null;

    let out: MIDIOutput | null = findOut();
    let input: MIDIInput | null = findIn();

    const when = (ms?: number): number | undefined => {
        const delay = ms ?? 0;
        return delay > 0 ? performance.now() + delay : undefined;
    };

    // OUTPUT ------------------------
    const sendNote = (ch: number, note: number, vel: number, whenMs?: number) => {
        if (!out) return;
        out.send([0x90 | (ch & 0x0f), note & 0x7f, vel & 0x7f], when(whenMs));
    };

    const sendNoteOff = (ch: number, note: number, whenMs?: number) => {
        if (!out) return;
        out.send([0x80 | (ch & 0x0f), note & 0x7f, 0x00], when(whenMs));
    };

    const sendCC = (ch: number, cc: number, val: number, whenMs?: number) => {
        if (!out) return;
        out.send([0xB0 | (ch & 0x0f), cc & 0x7f, val & 0x7f], when(whenMs));
    };

    const sendPitchBend = (ch: number, value14: number, whenMs?: number) => {
        if (!out) return;
        const v = Math.max(0, Math.min(16383, value14 | 0));
        out.send([0xE0 | (ch & 0x0f), v & 0x7f, (v >> 7) & 0x7f], when(whenMs));
    };

    // INPUT HELPERS -----------------
    const attach = (fn: (e: MIDIMessageEvent) => void) => {
        if (!input) return () => { };
        input.addEventListener("midimessage", fn as unknown as EventListener);
        return () => input?.removeEventListener("midimessage", fn as unknown as EventListener);
    };

    const onMessage = (fn: (e: MIDIMessageEvent) => void) => attach(fn);

    const onNote = (fn: (d: MidiNoteEvent) => void) =>
        attach((e: MIDIMessageEvent) => {
            const data = e.data as unknown as Uint8Array | null;
            const st = data?.[0] ?? 0;
            const d1 = data?.[1] ?? 0;
            const d2 = data?.[2] ?? 0;

            const status = st & 0xf0;
            const ch = st & 0x0f;
            if (status === 0x90 && d2 > 0) {
                fn({ ch, note: d1 & 0x7f, vel: d2 & 0x7f, on: true, raw: e });
            } else if (status === 0x80 || (status === 0x90 && d2 === 0)) {
                fn({ ch, note: d1 & 0x7f, vel: 0, on: false, raw: e });
            }
        });

    const onCC = (fn: (d: MidiCCEvent) => void) =>
        attach((e: MIDIMessageEvent) => {
            const data = e.data as unknown as Uint8Array | null;
            const st = data?.[0] ?? 0;
            const d1 = data?.[1] ?? 0;
            const d2 = data?.[2] ?? 0;

            if ((st & 0xf0) === 0xB0) {
                fn({ ch: st & 0x0f, cc: d1 & 0x7f, val: d2 & 0x7f, raw: e });
            }
        });

    // HOT-PLUG SUPPORT ---------------
    const pick = (rx = nameHint) => {
        const next = findOut(rx);
        if (next) out = next;
        return out;
    };

    const pickIn = (rx = nameHint) => {
        const next = findIn(rx);
        if (next) input = next;
        return input;
    };

    access.onstatechange = () => {
        if (out && ![...access.outputs.values()].some(o => o.id === out!.id)) out = findOut();
        if (input && ![...access.inputs.values()].some(i => i.id === input!.id)) input = findIn();
    };

    return {
        out,
        pick,
        sendNote,
        sendNoteOff,
        sendCC,
        sendPitchBend,
        input,
        pickIn,
        onMessage,
        onNote,
        onCC,
    };
}
