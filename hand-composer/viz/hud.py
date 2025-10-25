import pygame
import numpy as np

class HUD:
    def __init__(self, width=960, height=540):
        pygame.init()
        self.w, self.h = width, height
        self.screen = pygame.display.set_mode((self.w, self.h))
        pygame.display.set_caption("Hand Composer – MVP")
        self.font = pygame.font.SysFont("Arial", 20)
        self.clock = pygame.time.Clock()

    def _frame_to_surface(self, frame_bgr):
        if frame_bgr is None:
            return None
        frame_rgb = frame_bgr[:, :, ::-1]
        h, w, _ = frame_rgb.shape
        surf = pygame.image.frombuffer(frame_rgb.tobytes(), (w, h), "RGB")
        # scale to fit width
        new_h = int(self.w * h / w)
        surf = pygame.transform.smoothscale(surf, (self.w, new_h))
        # center vertically (letterbox)
        canvas = pygame.Surface((self.w, self.h))
        canvas.fill((10,10,12))
        y0 = max(0, (self.h - new_h) // 2)
        canvas.blit(surf, (0, y0))
        return canvas

    def draw(self, frame_bgr, chord_label, bpm, velocity, fps_cam, infer_ms, extra_lines=None):
        # NOTE: we DON'T consume pygame events here; demo.run handles them.
        cam = self._frame_to_surface(frame_bgr)
        if cam is None:
            self.screen.fill((10,10,12))
        else:
            self.screen.blit(cam, (0,0))

        # overlay HUD text
        lines = [
            f"Chord: {chord_label}",
            f"BPM: {bpm}    Velocity: {velocity}",
            f"Camera FPS: {fps_cam:.1f}    Inference: {infer_ms:.2f} ms",
        ]
        if extra_lines:
            lines.extend(extra_lines)

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
