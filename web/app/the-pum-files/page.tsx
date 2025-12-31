/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import JSZip from "jszip";
import { saveAs } from "file-saver";

// --- Types ---

type MediaType = 'image' | 'video';

type RawMediaEntry = {
    src: string;        // Thumbnail or Image Path
    videoUrl?: string;  // Remote URL for videos
    date: string;       // YYYY-MM-DD
    time: string;       // HH:MM:SS
    datetime: string;   // ISO
    type: MediaType;
    year: number;
    filename?: string;
};

type EventSpan = {
    id: string;
    title: string;
    description: string;
    startDate: string;
    endDate: string;
};

type TimelineItemData = {
    id: string;
    year: number;
    dateLabel: string;
    title: string;
    description: string;
    gallery: RawMediaEntry[];
    isSpan: boolean;
};

export default function ThePumFilesPage() {
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"],
    });

    const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);

    // State
    const [mediaFiles, setMediaFiles] = useState<RawMediaEntry[]>([]);
    const [events, setEvents] = useState<EventSpan[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<TimelineItemData | null>(null);

    // Download state
    const [downloading, setDownloading] = useState(false);
    const [downloadStatus, setDownloadStatus] = useState("");

    // 1. Fetch Data on Mount
    useEffect(() => {
        async function loadData() {
            try {
                const [mediaRes, eventsRes] = await Promise.all([
                    fetch('/album/media_map.json'),
                    fetch('/album/events.json')
                ]);

                if (mediaRes.ok) setMediaFiles(await mediaRes.json());
                if (eventsRes.ok) setEvents(await eventsRes.json());
            } catch (e) {
                console.error("Failed to load album data", e);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    // 2. Group Media into Timeline Items (Memoized)
    const timelineData = useMemo(() => {
        if (!mediaFiles.length) return [];

        const items: TimelineItemData[] = [];
        const usedSrcs = new Set<string>();

        // A. Process Defined Events first
        events.forEach(evt => {
            const start = new Date(evt.startDate).getTime();
            const end = new Date(evt.endDate).getTime();

            const matchingMedia = mediaFiles.filter(m => {
                const t = new Date(m.date).getTime();
                return t >= start && t <= end;
            });

            if (matchingMedia.length > 0) {
                matchingMedia.forEach(m => usedSrcs.add(m.src));
                items.push({
                    id: evt.id,
                    year: new Date(evt.startDate).getFullYear(),
                    dateLabel: `${evt.startDate} — ${evt.endDate}`,
                    title: evt.title,
                    description: evt.description,
                    gallery: matchingMedia,
                    isSpan: true
                });
            }
        });

        // B. Process "Loose" media (not in an event)
        const looseMedia = mediaFiles.filter(m => !usedSrcs.has(m.src));
        const looseGroups: Record<string, RawMediaEntry[]> = {};

        looseMedia.forEach(m => {
            if (!looseGroups[m.date]) looseGroups[m.date] = [];
            looseGroups[m.date].push(m);
        });

        Object.entries(looseGroups).forEach(([date, media]) => {
            items.push({
                id: `loose-${date}`,
                year: new Date(date).getFullYear(),
                dateLabel: date,
                title: media.length > 1 ? `${media.length} Snapshots` : "Snapshot",
                description: `Captured on ${date}`,
                gallery: media,
                isSpan: false
            });
        });

        return items.sort((a, b) => {
            const da = a.isSpan ? (events.find(e => e.id === a.id)?.startDate || a.dateLabel) : a.dateLabel;
            const db = b.isSpan ? (events.find(e => e.id === b.id)?.startDate || b.dateLabel) : b.dateLabel;
            return da.localeCompare(db);
        });

    }, [mediaFiles, events]);

    // 3. Group by Year
    const itemsByYear = useMemo(() => {
        const groups: Record<number, TimelineItemData[]> = {};
        timelineData.forEach(item => {
            if (!groups[item.year]) groups[item.year] = [];
            groups[item.year].push(item);
        });
        return groups;
    }, [timelineData]);

    const years = Object.keys(itemsByYear).map(Number).sort((a, b) => a - b);

    // 4. Download Handler
    const handleDownloadAll = async () => {
        setDownloading(true);
        setDownloadStatus("Analyzing...");

        try {
            const zip = new JSZip();

            for (let i = 0; i < timelineData.length; i++) {
                const item = timelineData[i];
                const safeTitle = item.title.replace(/[^a-z0-9]/gi, '_').slice(0, 50);
                const folderName = `${item.year}/${item.dateLabel.split(' ')[0]}_${safeTitle}`;
                const folder = zip.folder(folderName);
                if (!folder) continue;

                folder.file("story.txt", `${item.title}\nDate: ${item.dateLabel}\n\n${item.description}`);

                await Promise.all(item.gallery.map(async (media, j) => {
                    const baseName = media.filename || `media_${j+1}`;
                    setDownloadStatus(`Zipping: ${baseName}...`);

                    if (media.type === 'video' && media.videoUrl) {
                        const urlContent = `[InternetShortcut]\nURL=${media.videoUrl}\n`;
                        folder.file(`${baseName}.url`, urlContent);
                        folder.file(`${baseName}_link.txt`, media.videoUrl);
                        try {
                            const res = await fetch(media.src);
                            if (res.ok) {
                                const blob = await res.blob();
                                folder.file(`${baseName}_thumb.jpg`, blob);
                            }
                        } catch { /* ignore thumbnail fail */ }

                    } else if (media.type === 'image') {
                        try {
                            const res = await fetch(media.src);
                            if (res.ok) {
                                const blob = await res.blob();
                                folder.file(baseName, blob);
                            }
                        } catch (e) {
                            console.warn(`Failed to dl ${media.src}`, e);
                        }
                    }
                }));
            }

            setDownloadStatus("Compressing...");
            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, "the-pum-archive.zip");
            setDownloadStatus("Done!");
            setTimeout(() => {
                setDownloading(false);
                setDownloadStatus("");
            }, 2000);

        } catch (error) {
            console.error(error);
            setDownloadStatus("Error");
            setTimeout(() => setDownloading(false), 3000);
        }
    };

    if (loading) {
        return <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono animate-pulse">Loading Classified Data...</div>;
    }

    return (
        <div ref={containerRef} className="relative min-h-screen overflow-hidden bg-zinc-950 text-white selection:bg-cyan-500/30">
            {/* Background noise */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />

            <div className="relative z-10 container mx-auto px-4 py-20 pb-40">
                <header className="mb-24 text-center space-y-4">
                    <motion.h1
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-purple-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]"
                    >
                        THE PUM FILES
                    </motion.h1>
                    <p className="text-xl text-white/60 font-mono">
                        {mediaFiles.length} Classified Records Found
                    </p>
                </header>

                <div className="relative max-w-4xl mx-auto">
                    {/* Center Timeline Line */}
                    <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-white/10 -translate-x-1/2">
                        <motion.div
                            style={{ scaleY, transformOrigin: "top" }}
                            className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-cyan-400 via-purple-500 to-transparent"
                        />
                    </div>

                    {years.map((year) => (
                        <div key={year} className="mb-32 relative">
                            {/* Year Marker */}
                            <div className="sticky top-24 z-20 flex justify-start md:justify-center mb-12 pl-12 md:pl-0">
                                <div className="bg-black/80 backdrop-blur border border-white/20 px-6 py-2 rounded-full text-2xl font-bold font-mono shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                                    {year}
                                </div>
                            </div>

                            <div className="space-y-24">
                                {itemsByYear[year].map((item, idx) => {
                                    const isEven = idx % 2 === 0;
                                    return (
                                        <TimelineItem
                                            key={item.id}
                                            item={item}
                                            isEven={isEven}
                                            onClick={() => setSelectedItem(item)}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Download Footer */}
                <div className="fixed bottom-0 left-0 right-0 p-6 flex justify-center pointer-events-none z-40 bg-gradient-to-t from-black via-black/80 to-transparent">
                    <button
                        onClick={handleDownloadAll}
                        disabled={downloading}
                        className={`pointer-events-auto flex items-center gap-3 px-6 py-3 rounded-full font-bold text-lg shadow-2xl transition-all transform hover:scale-105 active:scale-95 ${
                            downloading 
                                ? "bg-zinc-800 text-white/50 cursor-wait" 
                                : "bg-white text-black hover:bg-cyan-300"
                        }`}
                    >
                         {downloading ? (
                             <>
                                <svg className="animate-spin h-5 w-5 text-white/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>{downloadStatus}</span>
                             </>
                         ) : (
                             <span>Download All ({mediaFiles.length} items)</span>
                         )}
                    </button>
                </div>
            </div>

            {/* Lightbox */}
            <AnimatePresence>
                {selectedItem && (
                    <Lightbox
                        item={selectedItem}
                        onClose={() => setSelectedItem(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

function TimelineItem({ item, isEven, onClick }: { item: TimelineItemData; isEven: boolean; onClick: () => void; }) {
    const cover = item.gallery[0];
    const isVideo = cover.type === "video";

    return (
        <div className={`relative flex items-center ${isEven ? "md:flex-row" : "md:flex-row-reverse"} gap-8`}>
            {/* Center Marker */}
            <div className="absolute left-4 md:left-1/2 -translate-x-1/2 z-10 flex flex-col items-center">
                {item.isSpan ? (
                    <div className="w-4 h-24 rounded-full bg-zinc-900 border-2 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.6)] flex flex-col items-center justify-between py-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-200" />
                        <div className="w-0.5 h-full bg-cyan-500/30" />
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-200" />
                    </div>
                ) : (
                    <div className="w-4 h-4 rounded-full bg-black border-2 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,1)]" />
                )}
            </div>

            <div className="w-8 md:w-1/2 flex-shrink-0" />

            <motion.div
                initial={{ opacity: 0, x: isEven ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                whileHover={{ scale: 1.02 }}
                onClick={onClick}
                className="relative cursor-pointer group w-full md:w-1/2"
            >
                <div className="relative bg-white/5 border border-white/10 p-3 pb-12 rounded-xl shadow-2xl backdrop-blur-sm overflow-hidden hover:bg-white/10 hover:border-white/30 transition-colors">
                    {/* Media Thumbnail */}
                    <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-black/50">
                        {/* Always use Image for thumbnail. src is always a .jpg from Python script even for videos */}
                        <Image
                            src={cover.src}
                            alt={item.title}
                            fill
                            sizes="(max-width: 768px) 100vw, 400px"
                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                        />

                        {/* Play Overlay */}
                        {isVideo && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10">
                                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/50">
                                    <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                </div>
                            </div>
                        )}

                        {/* Count Badge */}
                        {item.gallery.length > 1 && (
                            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-xs font-mono text-white/80 border border-white/10">
                                +{item.gallery.length - 1}
                            </div>
                        )}
                    </div>

                    <div className="absolute bottom-3 right-4 font-mono text-xs text-white/40">
                        {item.dateLabel}
                    </div>

                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                        <h3 className="font-bold text-white text-lg leading-tight">{item.title}</h3>
                        {item.isSpan && <div className="text-xs text-cyan-300 font-mono mt-1">Multi-day Event</div>}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

function Lightbox({ item, onClose }: { item: TimelineItemData; onClose: () => void }) {
    const [index, setIndex] = useState(0);
    const [hasError, setHasError] = useState(false);
    const media = item.gallery[index];
    const isVideo = media.type === "video";
    const videoUrl = media.videoUrl;

    // Reset error when sliding to new media
    useEffect(() => { setHasError(false); }, [index]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-sm cursor-zoom-out"
        >
            <div
                className="w-full max-w-6xl h-[90vh] bg-zinc-900 rounded-2xl flex flex-col lg:flex-row overflow-hidden border border-white/10 shadow-2xl cursor-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Main Media */}
                <div className="flex-1 bg-black relative flex items-center justify-center">
                    {isVideo && videoUrl && !hasError ? (
                         <video
                            key={videoUrl} // Force remount on change to reset internal error state
                            src={videoUrl}
                            controls
                            autoPlay
                            className="w-full h-full object-contain"
                            onError={() => setHasError(true)}
                        />
                    ) : isVideo && hasError ? (
                        <div className="text-center p-8 text-white/80 flex flex-col items-center">
                            <div className="mb-4 p-4 rounded-full bg-red-500/10 text-red-400">
                                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            </div>
                            <h3 className="text-xl font-bold mb-2">Browser Cannot Play Video</h3>
                            <p className="text-sm mb-6 text-white/50 max-w-sm">
                                This video format (likely HEVC/H.265 from a phone) is not supported by your current browser/OS combination.
                            </p>
                            <a
                                href={videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg font-bold transition flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                Open External Player
                            </a>
                        </div>
                    ) : (
                        <div className="relative w-full h-full">
                            <Image
                                src={media.src}
                                alt={item.title}
                                fill
                                className="object-contain"
                                sizes="100vw"
                                priority
                            />
                        </div>
                    )}
                </div>

                <div className="w-full lg:w-96 bg-zinc-900 border-l border-white/10 flex flex-col">
                    <div className="p-6 flex-1 overflow-y-auto">
                        <div className="text-cyan-400 font-mono text-xs mb-2">{item.dateLabel}</div>
                        <h2 className="text-2xl font-bold mb-4">{item.title}</h2>
                        <p className="text-white/70 leading-relaxed text-sm whitespace-pre-wrap">{item.description}</p>
                    </div>

                    {item.gallery.length > 1 && (
                        <div className="p-4 bg-black/20 border-t border-white/5">
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                                {item.gallery.map((m, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setIndex(i)}
                                        className={`relative w-20 h-16 flex-shrink-0 rounded overflow-hidden border-2 transition-all ${
                                            index === i ? "border-cyan-400 opacity-100" : "border-transparent opacity-50 hover:opacity-100"
                                        }`}
                                    >
                                        <Image src={m.src} alt="" fill className="object-cover" />
                                        {m.type === 'video' && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="p-4 border-t border-white/10 flex justify-end">
                        <button onClick={onClose} className="text-sm font-mono text-white/50 hover:text-white uppercase tracking-wider">
                            Close [ESC]
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}