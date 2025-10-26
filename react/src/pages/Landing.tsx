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
    <main className="relative min-h-dvh grid place-items-center overflow-hidden bg-[#f4ede0] text-white">

      {/* 🌐 Background spinning cube */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.25 }}
        transition={{ duration: 2.5, ease: easeOutExpo }}
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <SpinningCube />
      </motion.div>      

      {/* Foreground content */}
      <div style={{ perspective: 1200 }} className="relative z-10">
        <div className="text-center select-none">
          {/* Title with fall-in animation */}
          <motion.h1
            initial={initialTitle}
            animate={animateTitle}
            transition={{
              duration: 4,
              ease: easeOutExpo,
            }}
            className="text-6xl sm:text-6xl font-extralight tracking-widest text-[#5C4A36]"
          >
            nodal
          </motion.h1>

          {/* Subtle glow */}
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.1 }}
            animate={reduce ? { opacity: 0.08 } : { opacity: 0.12, scale: 1 }}
            transition={{ delay: 0.4, duration: 10.0, ease: easeOutExpo }}
            aria-hidden
            className="mx-auto mt-2 h-8 w-56 rounded-full bg-gradient-to-r from-indigo-500/40 via-purple-500/40 to-pink-500/40 blur-2xl"
          />

          {/* Start button */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6, ease: easeOutExpo }}
            className="mt-12"
          >
            <Link
              to="/app"
              onClick={() => {
              const audio = new Audio("/public/startup.wav"); // path to your sound file
              audio.volume = 0.3; // adjust volume (0.0–1.0)
              audio.play();
              }}
              className="inline-flex items-center rounded-xl px-22 py-3 text-base font-extralight tracking-widest text-[#5C4A36]
                         transition hover:opacity-70 active:scale-[0.99]
                         "
            >
              start
            </Link>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
