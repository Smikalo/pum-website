// web/components/LogosMarquee.tsx
'use client';

import { useEffect, useRef } from 'react';

type Sponsor = { file: string; url: string; name: string };

const SPONSORS: Sponsor[] = [
    { file: 'google.png',    url: 'https://google.com',             name: 'Google' },
    { file: 'microsoft.png', url: 'https://microsoft.com',          name: 'Microsoft' },
    { file: 'mercedes.png',  url: 'https://www.mercedes-benz.com',  name: 'Mercedes-Benz' },
    { file: 'tumai.png',     url: 'https://www.tum-ai.com',         name: 'TUM.ai' },
    { file: 'tum.png',       url: 'https://www.tum.de',             name: 'TUM' },
    { file: 'jetbrains.svg', url: 'https://www.jetbrains.com',      name: 'JetBrains' },
    { file: 'check24.png',   url: 'https://www.check24.de',         name: 'CHECK24' },
    { file: 'siemens.png',   url: 'https://www.siemens.com',        name: 'Siemens' },
    { file: 'openai.webp',   url: 'https://openai.com',             name: 'OpenAI' },
];

const PX_PER_SECOND = 22;
const GAP_REM = 3;
const DUPLICATES = 2;

function Logo({ file, url, name }: Sponsor) {
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={name}
            title={name}
            className="logo-wrap"
            role="listitem"
        >
            <img
                src={`/sponsors/${file}`}
                alt={`${name} logo`}
                className="logo-img"
                loading="lazy"
                decoding="async"
            />
        </a>
    );
}

export default function LogosMarquee() {
    const rootRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = rootRef.current!;
        const track = trackRef.current!;
        if (!root || !track) return;

        let raf = 0;
        let last = performance.now();
        let paused = false;
        let offsetX = 0;
        const widths: number[] = [];

        const measure = () => {
            widths.length = 0;
            const children = Array.from(track.children) as HTMLElement[];
            for (const el of children) {
                const gapPx = GAP_REM * parseFloat(getComputedStyle(document.documentElement).fontSize);
                widths.push(el.getBoundingClientRect().width + gapPx);
            }
        };

        const imgs = Array.from(track.querySelectorAll('img')) as HTMLImageElement[];
        let pending = imgs.length;
        const doneOne = () => {
            pending = Math.max(0, pending - 1);
            if (pending === 0) measure();
        };
        imgs.forEach((img) => {
            if (img.complete) return;
            img.addEventListener('load', doneOne);
            img.addEventListener('error', doneOne);
        });

        measure();

        const ro = new ResizeObserver(() => {
            offsetX = 0;
            track.style.transform = 'translate3d(0,0,0)';
            measure();
        });
        ro.observe(track);

        const prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const tick = (now: number) => {
            raf = requestAnimationFrame(tick);
            if (prefersReduce || paused || widths.length === 0) {
                last = now;
                return;
            }
            const dt = (now - last) / 1000;
            last = now;

            offsetX -= PX_PER_SECOND * dt;

            let cycled = 0;
            while (widths.length > 0 && -offsetX >= widths[0]) {
                const first = track.firstElementChild as HTMLElement;
                const w = widths.shift()!;
                track.appendChild(first);
                widths.push(w);
                offsetX += w;
                if (cycled++ > 50) break;
            }

            track.style.transform = `translate3d(${offsetX.toFixed(2)}px,0,0)`;
        };

        const onEnter = () => { paused = true; };
        const onLeave = () => { paused = false; };

        root.addEventListener('mouseenter', onEnter);
        root.addEventListener('mouseleave', onLeave);
        raf = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            root.removeEventListener('mouseenter', onEnter);
            root.removeEventListener('mouseleave', onLeave);
            imgs.forEach((img) => {
                img.removeEventListener('load', doneOne);
                img.removeEventListener('error', doneOne);
            });
        };
    }, []);

    const all = Array.from({ length: 1 + DUPLICATES }).flatMap(() => SPONSORS);

    return (
        <section className="section border-y border-white/10 py-6">
            <div className="ticker" ref={rootRef} aria-label="Sponsor logos" role="list">
                <div className="ticker__track" ref={trackRef}>
                    {all.map((s, i) => (
                        <Logo key={`${i}-${s.file}`} {...s} />
                    ))}
                </div>
                <div className="ticker__fade ticker__fade--left" aria-hidden />
                <div className="ticker__fade ticker__fade--right" aria-hidden />
            </div>
        </section>
    );
}
