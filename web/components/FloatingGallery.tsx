// web/components/FloatingGallery.tsx
"use client";

import Image from "next/image";
import { motion, type Transition } from "framer-motion";

/** Swap these freely; animation only affects transforms. */
const IMAGES = [
    "https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=1400&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1587620962725-abab7fe55159?q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1400&auto=format&fit=crop",
];

/** Smooth ease-in-out as a Bezier tuple (type-safe). */
const EASE_IN_OUT: [number, number, number, number] = [0.42, 0, 0.58, 1];

/** Base loop transition: mirrored, tweened, GPU-friendly (transform only). */
const baseLoop: Transition = {
    type: "tween",
    ease: EASE_IN_OUT,
    repeat: Infinity,
    repeatType: "mirror",
};

export default function FloatingGallery() {
    return (
        /* Taller so the larger cards have breathing room, but positioned to overlap tightly */
        <div className="relative h-[500px] md:h-[620px]">
            {/* LEFT — bigger and pulled inward; sits behind center */}
            <motion.div
                className="absolute top-16 left-[-10px] w-[18rem] md:w-[24rem] z-20"
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: 0.05, ease: EASE_IN_OUT }}
            >
                <motion.div
                    /* gentle float with tiny counter-tilt */
                    animate={{ y: [0, -8, 0], rotate: [0, -1, 0] }}
                    transition={{ ...baseLoop, duration: 11 }}
                    style={{ willChange: "transform" }}
                >
                    <Image
                        src={IMAGES[0]}
                        alt=""
                        width={1100}
                        height={1500}
                        className="rounded-2xl bw shadow-2xl border border-white/10"
                        priority={false}
                    />
                </motion.div>
            </motion.div>

            {/* CENTER — largest, slightly higher, overlaps the other two on top */}
            <motion.div
                className="absolute -top-8 left-1/2 -translate-x-1/2 w-[26rem] md:w-[34rem] z-30"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.08, ease: EASE_IN_OUT }}
            >
                <motion.div
                    /* calm float + minimal scale pulse for presence */
                    animate={{ y: [0, -10, 0], rotate: [0, 0.8, 0], scale: [1, 1.01, 1] }}
                    transition={{ ...baseLoop, duration: 12.5 }}
                    style={{ willChange: "transform" }}
                >
                    <Image
                        src={IMAGES[1]}
                        alt=""
                        width={1600}
                        height={2000}
                        className="rounded-2xl bw shadow-2xl border border-white/10"
                        priority={false}
                    />
                </motion.div>
            </motion.div>

            {/* RIGHT — bigger and pulled inward; slightly under center to ensure overlap */}
            <motion.div
                className="absolute bottom-10 right-[-12px] w-[20rem] md:w-[28rem] z-10"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: 0.12, ease: EASE_IN_OUT }}
            >
                <motion.div
                    animate={{ y: [0, -8, 0], rotate: [0, -0.6, 0] }}
                    transition={{ ...baseLoop, duration: 11.5 }}
                    style={{ willChange: "transform" }}
                >
                    <Image
                        src={IMAGES[2]}
                        alt=""
                        width={1300}
                        height={1700}
                        className="rounded-2xl bw shadow-2xl border border-white/10"
                        priority={false}
                    />
                </motion.div>
            </motion.div>
        </div>
    );
}
