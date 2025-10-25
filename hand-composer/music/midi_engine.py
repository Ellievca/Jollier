# music/midi_engine.py
# Virtual MIDI engine (CoreMIDI) with defensive guards for macOS.

from typing import Iterable
import atexit
import time

import mido

# Ensure we use RtMidi (CoreMIDI) explicitly on macOS
try:
    mido.set_backend('mido.backends.rtmidi')
except Exception:
    pass

from mido import Message


class MidiEngine:
    def __init__(self, port_name: str = "HandComposer"):
        self._held = set()
        self.channel = 0
        self._dead = False
        self._port_name = port_name
        self.out = None
        self._open_port()
        atexit.register(self.stop)

    def _open_port(self):
        # Create a virtual output port visible to DAWs on macOS
        try:
            self.out = mido.open_output(self._port_name, virtual=True)
            print(f"[MIDI] Virtual output port created: {self._port_name}")
            self._dead = False
        except Exception as e:
            print("[MIDI] Failed to open virtual port:", e)
            self._dead = True

    def _safe_send(self, msg: Message):
        if self._dead or self.out is None:
            return
        try:
            self.out.send(msg)
        except Exception as e:
            # Don’t crash the app if the DAW disconnects; mark dead and ignore further sends
            print("[MIDI] Send error; muting MIDI (port likely closed):", e)
            self._dead = True

    def set_program(self, program_num: int, bank: int = 0, channel: int = 0):
        """Optional; many DAWs ignore program changes and use the track’s patch."""
        program_num = max(0, min(127, int(program_num)))
        self._safe_send(Message('program_change', program=program_num, channel=self.channel))

    def play_chord(self, notes: Iterable[int], velocity: int = 90):
        """Legato-style: only change what differs; guarded against backend errors."""
        if self._dead:
            return
        new = set(notes or [])
        on_first  = new - self._held
        off_later = self._held - new
        vel = max(1, min(127, int(velocity)))

        for n in sorted(on_first):
            self._safe_send(Message('note_on', note=n, velocity=vel, channel=self.channel))
        for n in sorted(off_later):
            self._safe_send(Message('note_off', note=n, velocity=0, channel=self.channel))
        self._held = new

    def panic(self):
        if self._dead:
            return
        for n in list(self._held):
            self._safe_send(Message('note_off', note=n, velocity=0, channel=self.channel))
        self._held.clear()

    def stop(self):
        try:
            self.panic()
            time.sleep(0.01)
        finally:
            try:
                if self.out is not None:
                    self.out.close()
            except Exception:
                pass
            self.out = None
