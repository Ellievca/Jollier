# music/midi_engine.py
import os, time
import fluidsynth  # pip package 'pyfluidsynth' but import name is 'fluidsynth'

class MidiEngine:
    def __init__(self, soundfont_path=None):
        self.fs = fluidsynth.Synth()
        self._held = set()

        # Force macOS driver explicitly
        try:
            self.fs.start(driver="coreaudio")
            print("[Fluidsynth] Started with driver=coreaudio")
        except Exception as e:
            print("[Fluidsynth] coreaudio failed:", e)
            # Last-ditch generic start
            self.fs.start()
            print("[Fluidsynth] Started with default driver")

        sf = soundfont_path or self._find_sf2()
        if not sf or not os.path.exists(sf):
            raise RuntimeError(
                "Soundfont .sf2 not found. Pass MidiEngine(soundfont_path='/full/path/FluidR3_GM.sf2')"
            )
        print(f"[Fluidsynth] Loading soundfont: {sf}")
        self.sfid = self.fs.sfload(sf)
        self.fs.program_select(0, self.sfid, 0, 0)  # ch0, bank0, program0 (piano)

    def _find_sf2(self):
        candidates = [
            os.path.expanduser("~/Downloads/FluidR3_GM.sf2"),
            "/usr/share/sounds/sf2/FluidR3_GM.sf2",
            "/usr/share/soundfonts/FluidR3_GM.sf2",
            os.path.join(os.getcwd(), "assets", "sf2", "FluidR3_GM.sf2"),
        ]
        for p in candidates:
            if os.path.exists(p):
                return p
        return None

    def play_chord(self, notes, velocity=90):
        # turn off notes not in new chord
        for n in list(self._held):
            if n not in notes:
                self.fs.noteoff(0, n)
                self._held.remove(n)
        # turn on new notes
        for n in notes:
            if n not in self._held:
                self.fs.noteon(0, n, max(1, min(127, int(velocity))))
                self._held.add(n)

    def panic(self):
        for n in list(self._held):
            self.fs.noteoff(0, n)
        self._held.clear()

    def stop(self):
        try:
            self.panic()
            time.sleep(0.05)
            self.fs.delete()
            print("[Fluidsynth] Stopped")
        except Exception:
            pass
