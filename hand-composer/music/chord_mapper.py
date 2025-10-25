# Handles chord logic

import numpy as np

C_MAJOR = [0,2,4,5,7,9,11]  # scale degrees in semitones from C

def _normalize01(y):
    return float(np.clip(y, 0.0, 1.0))

def _note_name(midi):
    names = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]
    return f"{names[midi%12]}{midi//12}"

def right_hand_root(hands):
    """Map right-hand average Y (lower Y = top of screen) -> root between C2..C5."""
    # hands shape: (H,21,3) or None
    if hands is None or hands.shape[0] == 0:
        return 60  # middle C default
    # right hand is index 0 in our ordering if present
    right = hands[0]
    y = right[:,1].mean()
    # invert Y: top (small) -> higher pitch
    y_inv = 1.0 - _normalize01(y)
    # map 0..1 to MIDI [36..72] (C2..C5)
    return int(round(36 + y_inv * (72-36)))

def hand_spread(hand):
    """Average distance of fingertips to wrist as a simple openness metric."""
    # landmarks: 0 wrist, fingertips: 4,8,12,16,20
    tip_idx = [4,8,12,16,20]
    wrist = hand[0,:2]
    d = 0.0
    for i in tip_idx:
        d += np.linalg.norm(hand[i,:2]-wrist)
    return d/len(tip_idx)

def left_pose_quality(hands, spread_thresholds=(0.065, 0.11)):
    """
    crude pose classifier using spread:
      small -> 'min', medium -> 'maj', large -> '7', thumb-ish -> 'sus'
    """
    if hands is None or hands.shape[0] < 2:
        return "maj"
    left = hands[1]
    s = hand_spread(left)
    lo, hi = spread_thresholds
    if s < lo:   return "min"
    if s < hi:   return "maj"
    return "7"

def chord_from(root_midi, quality):
    # build triads/seventh in semitones
    if quality == "maj":
        intervals = [0, 4, 7]
    elif quality == "min":
        intervals = [0, 3, 7]
    elif quality == "7":
        intervals = [0, 4, 7, 10]
    else:  # 'sus'
        intervals = [0, 5, 7]
    return [root_midi + i for i in intervals]

# chord voicing: keeps notes in range
def voice_chord(notes, low = 48, high = 72):
    voiced=[]
    for n in notes:
        while n < low: n += 12
        while n > high: n -= 12
        voiced.append(n)
    voiced.sort()

    if voiced and (max(voiced) - min(voiced) > 12):
        voiced[0] += 12
        voiced.sort()

    return voiced
    notes = voice_chord(notes, 48, 72)

def velocity_from_spread(hands):
    if hands is None or hands.shape[0] == 0:
        return 80
    right = hands[0]
    s = hand_spread(right)
    # map approx spread in [0.04..0.14] to velocity [50..127]
    v = 50 + (s - 0.04) * (77 / (0.10))
    return int(max(50, min(127, v)))

def tempo_from_distance(hands):
    if hands is None or hands.shape[0] < 2:
        return 110
    r = hands[0][:, :2].mean(axis=0)
    l = hands[1][:, :2].mean(axis=0)
    d = np.linalg.norm(r-l)
    # map approx distance [0.05..0.5] to [80..140] bpm
    bpm = 80 + (d - 0.05) * (60 / 0.45)
    return int(max(80, min(140, bpm)))

def label_chord(notes):
    if not notes: return "N.C."
    return "+".join(sorted({_note_name(n) for n in notes}))
