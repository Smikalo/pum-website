"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const WORDS = ["Hackathons", "Startups", "Research", "Open Source", "AI"];

export default function TypedHeadline() {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setIndex((i) => (i + 1) % WORDS.length), 2000);
        return () => clearInterval(id);
    }, []);

    const word = WORDS[index];

    return (
        <div className="relative inline-block">
            <AnimatePresence mode="popLayout">
                <motion.span
                    key={word}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.35 }}
                    className="inline-block"
                >
                    {word}
                </motion.span>
            </AnimatePresence>
            <span className="ml-1 inline-block w-[1ch] h-[1.2em] align-middle bg-white/90 animate-pulse" aria-hidden />
        </div>
    );
}
