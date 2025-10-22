"use client";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

const IMAGES = [
    "https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=1200&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1587620962725-abab7fe55159?q=80&w=1200&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&auto=format&fit=crop"
];

export default function FloatingGallery() {
    const rm = useReducedMotion();
    return (
        <div className="relative h-[420px] md:h-[520px]">
            <motion.div
                className="absolute top-6 left-0 w-44 md:w-64"
                initial={{opacity:0,y:12}} whileInView={{opacity:1,y:0}} viewport={{ once:true }}
                transition={{duration:.6, delay:.05}}
                animate={rm ? undefined : "float"}
            >
                <Image src={IMAGES[0]} alt="" width={900} height={1200} className="rounded-3xl bw shadow-2xl border border-white/10" />
            </motion.div>

            <motion.div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-64 md:w-[28rem]"
                initial={{opacity:0,y:12}} whileInView={{opacity:1,y:0}} viewport={{ once:true }}
                transition={{duration:.6, delay:.1}}
            >
                <Image src={IMAGES[1]} alt="" width={1200} height={1400} className="rounded-[2rem] bw shadow-2xl border border-white/10" priority />
            </motion.div>

            <motion.div
                className="absolute bottom-4 right-0 w-48 md:w-72"
                initial={{opacity:0,y:12}} whileInView={{opacity:1,y:0}} viewport={{ once:true }}
                transition={{duration:.6, delay:.15}}
            >
                <Image src={IMAGES[2]} alt="" width={900} height={1200} className="rounded-3xl bw shadow-2xl border border-white/10" />
            </motion.div>
        </div>
    );
}
