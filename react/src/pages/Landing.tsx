import React from "react";
import SpinningCube from "../components/SpinningCube";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";

const easeOutExpo = [0.16, 1, 0.3, 1] as const;

export default function LandingPage() {
  const reduce = useReducedMotion();

  // Keyframes for the “fall in” feel (simulate z by rotateX + scale + y)
  const initialTitle = reduce
    ? { opacity: 0 }
    : { opacity: 0, y: -14, scale: 2.2, rotateX: 12, filter: "blur(10px)" };

  const animateTitle = reduce
    ? { opacity: 1 }
    : { opacity: 1, y: 0, scale: 1, rotateX: 0, filter: "blur(0px)" };

  return (
    <main className="min-h-dvh grid place-items-center bg-[#f4ede0] text-white">
      {/* Perspective wrapper enhances the 3D feel */}
      <div style={{ perspective: 1200 }}>
        <div className="text-center select-none">
          {/* Gradient text with fall-in */}
          <motion.h1
            initial={initialTitle}
            animate={animateTitle}
            transition={{
              duration: 4,
              ease: easeOutExpo,
            }}
            className="
              text-6xl sm:text-7xl font-extralight tracking-widest text-[#5C4A36]"
          >
            nodal
          </motion.h1>

          {/* Subtle glow that also fades in (purely optional visual polish) */}
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.1 }}
            animate={reduce ? { opacity: 0.08 } : { opacity: 0.12, scale: 1 }}
            transition={{ delay: 0.4, duration: 10.0, ease: easeOutExpo }}
            aria-hidden
            className="mx-auto mt-2 h-8 w-56 rounded-full bg-gradient-to-r from-indigo-500/40 via-purple-500/40 to-pink-500/40 blur-2xl"
          />

          {/* Start button fades in after the title lands */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6, ease: easeOutExpo }}
            className="mt-12"
          >
            <Link
              to="/app"
              className="inline-flex items-center rounded-xl px-8 py-3 text-base font-medium
                         bg-white text-black shadow
                         transition hover:opacity-90 active:scale-[0.99]
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              Start
            </Link>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
