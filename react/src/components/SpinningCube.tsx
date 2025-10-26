"use client";
import { useRef, useEffect } from "react";

export default function SpinningCube() {
  const ref = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    function frame(t: number) {
      if (!ref.current) return;
      const rotate = Math.sin(t / 10000) * 200;
      const y = (1 + Math.sin(t / 1000)) * -50;
      ref.current.style.transform = `translateY(${y}px) rotateX(${rotate}deg) rotateY(${rotate}deg)`;
      rafId.current = requestAnimationFrame(frame);
    }
    rafId.current = requestAnimationFrame(frame);
    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="cube" ref={ref}>
        <div className="side front" />
        <div className="side left" />
        <div className="side right" />
        <div className="side top" />
        <div className="side bottom" />
        <div className="side back" />
      </div>
      <CubeStyles />
    </div>
  );
}

function CubeStyles() {
  return (
    <style>{`
      .cube {
        width: 180px;
        height: 180px;
        position: relative;
        transform-style: preserve-3d;
      }
      .side {
        position: absolute;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #6366f1, #a855f7);
        opacity: 0.08;
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 8px;
      }
      .front  { transform: rotateY(0deg) translateZ(90px); }
      .right  { transform: rotateY(90deg) translateZ(90px); }
      .back   { transform: rotateY(180deg) translateZ(90px); }
      .left   { transform: rotateY(-90deg) translateZ(90px); }
      .top    { transform: rotateX(90deg) translateZ(90px); }
      .bottom { transform: rotateX(-90deg) translateZ(90px); }
    `}</style>
  );
}
