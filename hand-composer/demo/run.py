import torch, time
import cv2
import pygame
import numpy as np
from perception.hands import HandTracker
from music.midi_engine import MidiEngine
from music.chord_mapper import (
    right_hand_root, left_pose_quality, chord_from,
    velocity_from_spread, tempo_from_distance, label_chord
)
from viz.hud import HUD
from collections import deque

SAFE_MODE = False # for debug, set to true if freezing / no audio desired

KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

ADC_URL = "http://localhost:8000/predict"

import requests
def gpu_quality(left_hand_21):
    r = requests.post(ADC_URL, json={"left21": left_hand_21.tolist()})
    r.raise_for_status()
    return r.json()["quality"]

class RootSmoother:
    """
    Smooths right-hand root changes:
      - EMA on continuous root
      - deadband in semitones around the committed root
      - max semitone step per commit (slew-rate)
      - minimum time between commits (debounce)
    """
    def __init__(self, low=36, high=72, alpha=0.35, deadband_semi=0.45,
                 max_step_semi=2, min_interval_ms=90):
        self.low, self.high = low, high
        self.alpha = alpha
        self.deadband = deadband_semi
        self.max_step = max_step_semi
        self.min_interval = min_interval_ms
        self._ema = None           # continuous (float) root
        self._commit = 60          # current committed MIDI root
        self._last_commit_ms = 0

    def _extract_y(self, hands):
        if hands is None or hands.shape[0] == 0:
            return None
        # right hand avg y in [0..1]
        return float(hands[0][:,1].mean())

    def update(self, hands, now_ms):
        y = self._extract_y(hands)
        if y is None:
            return self._commit

        # map to float MIDI in [low..high], top of screen -> higher pitch
        root_float = self.low + (1.0 - np.clip(y, 0.0, 1.0)) * (self.high - self.low)

        # EMA smoothing
        self._ema = root_float if self._ema is None else (self.alpha*root_float + (1-self.alpha)*self._ema)

        # propose rounded target
        target = int(round(self._ema))

        # deadband: if within ±deadband of current commit, keep current
        if abs(target - self._commit) <= self.deadband:
            return self._commit

        # debounce time
        if (now_ms - self._last_commit_ms) < self.min_interval:
            return self._commit

        # slew-rate limit: move at most ±max_step per commit
        delta = target - self._commit
        if abs(delta) > self.max_step:
            target = self._commit + (self.max_step if delta > 0 else -self.max_step)

        # clamp to range & commit
        target = int(max(self.low, min(self.high, target)))
        self._commit = target
        self._last_commit_ms = now_ms
        return self._commit
    


def main():
    tracker = HandTracker(smooth_alpha=0.6)
    #synth = MidiEngine(soundfont_path="/Users/ellie/Downloads/FluidR3_GM.sf2")

    hud = HUD()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    from perception.classifier import load_classifier, predict_quality
    clf = load_classifier(device)
    use_gpu_classifier = torch.cuda.is_available()

    smoother = RootSmoother(low = 48, high = 72, alpha = 0.35, deadband_semi = 0.5, max_step_semi = 1, min_interval_ms = 100)

    # control state
    main_key_semitones = 0
    scale_lock = False #toggle with "S" key
    last_quit = False 

    clock = pygame.time.Clock()

    # synth only when not in safe mode
    synth = None
    if not SAFE_MODE:
        synth = MidiEngine(port_name="HandComposer")

    last_notes = []
    
    try:
        while True:
            t0 = time.time()
            # read key events
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    last_quit = True
                elif event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_UP:
                        main_key_semitones = (main_key_semitones + 1) % 12
                    elif event.key == pygame.K_DOWN:
                        main_key_semitones = (main_key_semitones - 1) % 12
                    elif event.key == pygame.K_s:
                        scale_lock = not scale_lock
                    elif event.key == pygame.K_SPACE:
                        synth.panic() #stops all notes
                    elif event.key == pygame.K_ESCAPE:
                        last_quit = True
                    elif event.key == pygame.K_g:
                        use_gpu_classifier = not use_gpu_classifier
            if last_quit:
                synth.stop()
                tracker.release()
                hud.quit()
                return
            
            frame, hands, fps_cam = tracker.read()
            if frame is None:
                continue

            #safe mode
            if SAFE_MODE:
                chord_lbl = "SAFE MODE (no audio)"
                bpm = 0
                velo = 0
                infer_ms = (time.time() - t0) * 1000.0
                help_line = "Press ESC to Quit. If smooth, turn SAFE_MODE = False"
                hud.draw(frame, chord_lbl, bpm, velo, fps_cam, infer_ms, extra_lines =[help_line])
                clock.tick(30) #cap fps at 30
                continue

            #normal mode
            #root = right_hand_root(hands) + main_key_semitones
            now_ms = int(time.time() * 1000)

            root = smoother.update(hands, now_ms) + main_key_semitones
            #qual = left_pose_quality(hands)
            qual = "maj"
            infer_ms = 0.0
            if hands is not None and hands.shape[0] >= 2:
                t0c = time.time()
            try:
                qual = gpu_quality(hands[1])
            except Exception as e:
                print("[GPU RPC] error, falling back to CPU:", e)
                qual = left_pose_quality(hands)
            infer_ms = (time.time() - t0c) * 1000.0
            notes = chord_from(root, qual)
            
            from music.chord_mapper import voice_chord
            notes = voice_chord(notes, low = 48, high = 72)
            velo = velocity_from_spread(hands)
            bpm = tempo_from_distance(hands)

            if notes != last_notes:
                try:   
                    synth.play_chord(notes, velo)
                    last_notes = notes
                except Exception as e:
                    print("[MIDI] play_chord error:", e)

            infer_ms = (time.time() - t0) * 1000.0
            chord_lbl = label_chord(notes)
            keyname = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][main_key_semitones]
            mode = "GPU" if (use_gpu_classifier and torch.cuda.is_available()) else "CPU"
            help_line = f"Key: {keyname} | S: Scale lock [{'ON' if scale_lock else 'OFF'}] | Up/Down: Change key | G: Toggle [{mode}] | Space: Panic"
            hud.draw(frame, chord_lbl, bpm, velo, fps_cam, infer_ms, extra_lines =[help_line])

            clock.tick(30) #cap fps at 30
        
    finally:
        if synth:
            synth.stop()
        tracker.release()
        hud.quit()

    # try:
    #     while True:
    #         t0 = time.time()
    #         frame, hands, fps_cam = tracker.read()
    #         if frame is None:
    #             print("No camera frame.")
    #             break

    #         # mapping
    #         root  = right_hand_root(hands)
    #         qual  = left_pose_quality(hands)
    #         notes = chord_from(root, qual)
    #         velo  = velocity_from_spread(hands)
    #         bpm   = tempo_from_distance(hands)

    #         #transpose by current key
    #         root += main_key_semitones

    #         # stabilize chord changes
    #         state = getattr(main, "_state", {"hist": deque(maxlen=5), "last_notes": []})
    #         state["hist"].append((root,qual))
    #         stable = len(set(state["hist"])) == 1
    #         now_ms = int(time.time() * 1000)
    #         last_ms = getattr(main, "_last_change_ms", 0)
            
    #         if stable and now_ms - last_ms >= 100:
    #             notes = chord_from(root, qual)
    #             main._last_change_ms = now_ms
    #             state["last_notes"] = notes
    #         else:
    #             notes = state["last_notes"]
    #         main._state = state

    #         # play chord
    #         synth.play_chord(notes, velocity=velo)

    #         infer_ms = (time.time() - t0) * 1000.0
    #         chord_lbl = label_chord(notes)

    #         # show HUD
    #         current_key = KEY_NAMES[main_key_semitones]
    #         help_line = f"Key: {current_key} | S: Scale lock [{'ON' if scale_lock else 'OFF'}] | Up/Down: Change key | Space: Panic | Esc: Quit"
    #         ok = hud.draw(frame, chord_lbl, bpm, velo, fps_cam, infer_ms, extra_lines =[help_line])

    #         if not ok:
    #             break

    #         # esc to quit
    #         k = cv2.waitKey(1)
    #         if k == 27:
    #             break

    # finally:
    #     synth.stop()
    #     tracker.release()
    #     hud.quit()

if __name__ == "__main__":
    main()
