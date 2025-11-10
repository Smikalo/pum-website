"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { tClient } from "@/lib/i18n-client";

const WORD_KEYS = [
    "home.hero.typed.hackathons",
    "home.hero.typed.startups",
    "home.hero.typed.research",
    "home.hero.typed.openSource",
] as const;

export default function TypedHeadline() {
    const [i, setI] = useState(0);
    const rm = useReducedMotion();

    useEffect(() => {
        const id = setInterval(
            () => setI((v) => (v + 1) % WORD_KEYS.length),
            2000,
        );
        return () => clearInterval(id);
    }, []);

    const word = tClient(WORD_KEYS[i]);

    return (
        <span className="relative inline-flex items-center">
            <AnimatePresence mode="popLayout">
                <motion.span
                    key={WORD_KEYS[i]}
                    initial={rm ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={rm ? { opacity: 0 } : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.35 }}
                    className="inline-block"
                >
                    {word}
                </motion.span>
            </AnimatePresence>
            <span className="ml-1 caret" aria-hidden />
        </span>
    );
}
