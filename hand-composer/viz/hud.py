# viz/hud.py
import pygame
import numpy as np

class HUD:
    def __init__(self, width=1280, height=720):
        pygame.init()
        self.w, self.h = width, height
        self.screen = pygame.display.set_mode((self.w, self.h))
        pygame.display.set_caption("Hand Composer")
        self.font = pygame.font.SysFont("Arial", 20)
        self.clock = pygame.time.Clock()

    def _frame_to_surface(self, frame_bgr):
        # OpenCV gives BGR (H,W,3) uint8. Convert to RGB and scale to window.
        if frame_bgr is None:
            return None
        frame_rgb = frame_bgr[:, :, ::-1]  # BGR -> RGB
        h, w, _ = frame_rgb.shape
        surf = pygame.image.frombuffer(frame_rgb.tobytes(), (w, h), "RGB")
        # scale to fit window while preserving aspect
        surf = pygame.transform.smoothscale(surf, (self.w, int(self.w * h / w))) if w else surf
        # if taller than window, center-crop
        if surf.get_height() > self.h:
            y0 = (surf.get_height() - self.h) // 2
            subsurf = pygame.Surface((self.w, self.h))
            subsurf.blit(surf, (0, -y0))
            return subsurf
        else:
            # letterbox vertically
            subsurf = pygame.Surface((self.w, self.h))
            subsurf.fill((10,10,12))
            y0 = (self.h - surf.get_height()) // 2
            subsurf.blit(surf, (0, y0))
            return subsurf

    def draw(self, frame_bgr, chord_label, bpm, velocity, fps_cam, infer_ms):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return False

        # draw camera frame
        cam = self._frame_to_surface(frame_bgr)
        if cam is None:
            self.screen.fill((10,10,12))
        else:
            self.screen.blit(cam, (0,0))

        # overlay HUD text
        lines = [
            f"Chord: {chord_label}",
            f"BPM: {bpm}    Velocity: {velocity}",
            # f"Camera FPS: {fps_cam:.1f}    Inference: {infer_ms:.2f} ms",
            "Tips: Right-hand height = root, Left-hand openness = quality (maj/min/7)",
        ]
        y = 10
        for s in lines:
            surf = self.font.render(s, True, (255,255,255))
            self.screen.blit(surf, (12, y))
            y += 24

        pygame.display.flip()
        self.clock.tick(60)
        return True

    def quit(self):
        pygame.quit()
