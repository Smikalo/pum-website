"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const WORDS = ["Hackathons", "Startups", "Research", "Open Source"];

export default function TypedHeadline() {
    const [i, setI] = useState(0);
    const rm = useReducedMotion();
    useEffect(() => { const id = setInterval(() => setI(v => (v + 1) % WORDS.length), 2000); return () => clearInterval(id); }, []);
    const word = WORDS[i];

    return (
        <span className="relative inline-flex items-center">
      <AnimatePresence mode="popLayout">
        <motion.span
            key={word}
            initial={rm ? {opacity:1,y:0} : {opacity:0,y:8}}
            animate={{opacity:1,y:0}}
            exit={rm ? {opacity:0} : {opacity:0,y:-8}}
            transition={{duration:.35}}
            className="inline-block"
        >
          {word}
        </motion.span>
      </AnimatePresence>
      <span className="ml-1 caret" aria-hidden />
    </span>
    );
}
