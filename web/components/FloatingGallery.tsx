"use client";
import Image from "next/image";
import { motion } from "framer-motion";

const images = [
    // high-res black & white friendly imagery (we grayscale in CSS)
    "https://images.unsplash.com/photo-1526253038957-bce54e05968f?q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1587620962725-abab7fe55159?q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1600&auto=format&fit=crop"
];

export default function FloatingGallery() {
    return (
        <div className="relative h-[480px] md:h-[560px]">
            {/* left column */}
            <motion.div
                className="absolute top-6 left-0 w-40 md:w-56 float-slow"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}
            >
                <Image src={images[0]} alt="" width={800} height={1000} className="rounded-xl bw shadow-2xl" />
            </motion.div>

            {/* center big */}
            <motion.div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-64 md:w-96 float-slower"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
            >
                <Image src={images[1]} alt="" width={1200} height={1400} className="rounded-2xl bw shadow-2xl" priority />
            </motion.div>

            {/* right column */}
            <motion.div
                className="absolute bottom-4 right-0 w-44 md:w-60 float-slow"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
            >
                <Image src={images[2]} alt="" width={900} height={1200} className="rounded-xl bw shadow-2xl" />
            </motion.div>

            {/* small accents */}
            <motion.div
                className="absolute top-40 right-24 w-28 md:w-36 float-slower"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }}
            >
                <Image src={images[3]} alt="" width={800} height={800} className="rounded-lg bw shadow-xl" />
            </motion.div>

            <motion.div
                className="absolute bottom-10 left-24 w-24 md:w-32 float-slow"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.5 }}
            >
                <Image src={images[4]} alt="" width={800} height={800} className="rounded-lg bw shadow-xl" />
            </motion.div>
        </div>
    );
}
