import React, { useRef } from "react";
import { motion, type Variants } from "framer-motion";

interface RevealOnHoverTextProps {
  text: string;
  className?: string;
}

export default function RevealOnHoverText({ text, className = "" }: RevealOnHoverTextProps) {
  const containerVariants: Variants = {
    initial: {},
    hover: {
      transition: {
        staggerChildren: 0.03,
        ease: [0.22, 1, 0.36, 1],
      }
    }
  };

  const charVariants: Variants = {
    initial: { opacity: 0, y: "0.25em" },
    hover: {
      opacity: 1,
      y: "0em",
      transition: {
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
      }
    }
  };

  return (
    <motion.span
      initial="initial"
      whileHover="hover"
      variants={containerVariants}
      className={`inline-flex overflow-hidden ${className}`}
    >
      {text.split("").map((char, idx) => (
        <motion.span
          key={idx}
          variants={charVariants}
          className="inline-block"
        >
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
    </motion.span>
  );
}
