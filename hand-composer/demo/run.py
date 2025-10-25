import time
import cv2
from perception.hands import HandTracker
from music.midi_engine import MidiEngine
from music.chord_mapper import (
    right_hand_root, left_pose_quality, chord_from,
    velocity_from_spread, tempo_from_distance, label_chord
)
from viz.hud import HUD

def main():
    tracker = HandTracker(smooth_alpha=0.6)
    synth = MidiEngine(soundfont_path="/Users/ellie/Downloads/FluidR3_GM.sf2")

    hud = HUD()

    try:
        while True:
            t0 = time.time()
            frame, hands, fps_cam = tracker.read()
            if frame is None:
                print("No camera frame.")
                break

            # --- mapping ---
            root  = right_hand_root(hands)
            qual  = left_pose_quality(hands)
            notes = chord_from(root, qual)
            velo  = velocity_from_spread(hands)
            bpm   = tempo_from_distance(hands)

            # play chord
            synth.play_chord(notes, velocity=velo)

            infer_ms = (time.time() - t0) * 1000.0
            chord_lbl = label_chord(notes)

            # show HUD
            ok = hud.draw(frame, chord_lbl, bpm, velo, fps_cam, infer_ms)
            if not ok:
                break

            # ESC to quit (optional)
            k = cv2.waitKey(1)
            if k == 27:
                break

    finally:
        synth.stop()
        tracker.release()
        hud.quit()

if __name__ == "__main__":
    main()
