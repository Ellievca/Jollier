import time
import cv2
import numpy as np
import mediapipe as mp

class HandTracker:
    def __init__(self, max_num_hands=2, detection=0.6, tracking=0.6, smooth_alpha=0.6):
        self.cap = cv2.VideoCapture(0)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH,  1280)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        self.hands = mp.solutions.hands.Hands(
            max_num_hands=max_num_hands,
            min_detection_confidence=detection,
            min_tracking_confidence=tracking)
        self.drawer = mp.solutions.drawing_utils
        self.ema_prev = None
        self.alpha = smooth_alpha
        self.last_ts = time.time()

    def _ema(self, arr):
        if arr is None:
            self.ema_prev = None
            return None
        if self.ema_prev is None:
            self.ema_prev = arr
        self.ema_prev = self.alpha * arr + (1 - self.alpha) * self.ema_prev
        return self.ema_prev

    def read(self):
        ok, frame = self.cap.read()
        if not ok:
            return None, None, 0.0
        frame = cv2.flip(frame, 1)
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        res = self.hands.process(rgb)

        hands_xyz = []
        if res.multi_hand_landmarks and res.multi_handedness:
            for lm, handedness in zip(res.multi_hand_landmarks, res.multi_handedness):
                xyz = np.array([[p.x, p.y, p.z] for p in lm.landmark], dtype=np.float32)  # (21,3)
                label = handedness.classification[0].label.lower()  # 'left' or 'right'
                hands_xyz.append((label, xyz))
                self.drawer.draw_landmarks(frame, lm, mp.solutions.hands.HAND_CONNECTIONS)

        smoothed = None
        if hands_xyz:
            # pack to fixed order: right, left (if present)
            ordered = []
            # collect dict for easy fetch
            d = {h: xyz for (h, xyz) in hands_xyz}
            for name in ("right", "left"):
                if name in d:
                    ordered.append(d[name])
            if ordered:
                concat = np.stack(ordered, axis=0)  # (H, 21, 3)
                smoothed = self._ema(concat)
        else:
            self._ema(None)

        now = time.time()
        fps = 1.0 / (now - self.last_ts) if now != self.last_ts else 0.0
        self.last_ts = now
        return frame, smoothed, fps

    def release(self):
        self.cap.release()
        self.hands.close()
