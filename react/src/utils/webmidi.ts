// src/utils/webmidi.ts
export type MidiEnv = {
    out: MIDIOutput | null;
    pick: (nameRegex?: RegExp) => MIDIOutput | null;
    sendNote: (ch: number, note: number, vel: number, whenMs?: number) => void;
    sendNoteOff: (ch: number, note: number, whenMs?: number) => void;
    sendCC: (ch: number, cc: number, val: number, whenMs?: number) => void;
    sendPitchBend: (ch: number, value14: number, whenMs?: number) => void;
};

export async function initWebMIDI(nameHint = /WebApp Out|IAC|loopMIDI/i): Promise<MidiEnv | null> {
    if (!("requestMIDIAccess" in navigator)) {
        console.warn("Web MIDI unsupported (use Chrome/Edge on HTTPS or localhost).");
        return null;
    }
    const access = await navigator.requestMIDIAccess({ sysex: false });

    const pick = (nameRegex = nameHint) =>
        [...access.outputs.values()].find(o => nameRegex.test(o.name || "")) || null;

    let out: MIDIOutput | null = pick();

    const when = (ms?: number) => (ms ?? 0) > 0 ? performance.now() + ms : undefined;

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

    return { out, pick, sendNote, sendNoteOff, sendCC, sendPitchBend };
}
