"use client";

import React from "react";
import { tClient } from "@/lib/i18n-client";

function splitFenced(input: string): Array<{ type: "text" | "code"; content: string; lang?: string }> {
    const out: Array<{ type: "text" | "code"; content: string; lang?: string }> = [];
    const fence = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = fence.exec(input))) {
        if (m.index > lastIndex) out.push({ type: "text", content: input.slice(lastIndex, m.index) });
        out.push({ type: "code", content: m[2].replace(/\n$/, ""), lang: m[1] });
        lastIndex = fence.lastIndex;
    }
    if (lastIndex < input.length) out.push({ type: "text", content: input.slice(lastIndex) });
    return out;
}

function splitInline(text: string, re: RegExp): Array<string | { code: string }> {
    const out: Array<string | { code: string }> = [];
    let last = 0;
    let m: RegExpExecArray | null;
    const rx = new RegExp(re.source, "g");
    while ((m = rx.exec(text))) {
        if (m.index > last) out.push(text.slice(last, m.index));
        out.push({ code: m[1] });
        last = rx.lastIndex;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
}

function splitLinks(text: string): Array<string | { label: string; href: string }> {
    const out: Array<string | { label: string; href: string }> = [];
    const re = /\[([^\]]+)\]\(([^)]+)\)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
        if (m.index > last) out.push(text.slice(last, m.index));
        out.push({ label: m[1], href: m[2] });
        last = re.lastIndex;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
}

function normalizeHref(href: string): string {
    if (/^https?:\/\//i.test(href) || href.startsWith("mailto:")) return href;
    return `https://${href}`;
}

function inline(text: string): React.ReactNode[] {
    if (!text) return [];
    const segments = splitInline(text, /`([^`]+)`/);
    return segments.flatMap((seg, idx) => {
        if (typeof seg !== "string") {
            return (
                <code key={`code-${idx}`} className="px-1 rounded bg-white/10 text-white/90">
                    {seg.code}
                </code>
            );
        }
        // links
        const withLinks = splitLinks(seg).flatMap((s, j) => {
            if (typeof s !== "string") {
                const href = normalizeHref(s.href);
                return (
                    <a
                        key={`a-${idx}-${j}`}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-4"
                    >
                        {s.label}
                    </a>
                );
            }
            return s;
        });
        // bold
        const bolded = withLinks.flatMap((s, j) => {
            if (typeof s !== "string") return s;
            const parts = splitInline(s, /\*\*([^*]+)\*\*/);
            return parts.map((p, k) =>
                typeof p === "string" ? (
                    p
                ) : (
                    <strong key={`b-${idx}-${j}-${k}`} className="text-white">
                        {p.code}
                    </strong>
                ),
            );
        });
        // italic
        const italicized = bolded.flatMap((s, j) => {
            if (typeof s !== "string") return s;
            const parts = splitInline(s, /\*([^*]+)\*/);
            return parts.map((p, k) =>
                typeof p === "string" ? (
                    p
                ) : (
                    <em key={`i-${idx}-${j}-${k}`} className="italic">
                        {p.code}
                    </em>
                ),
            );
        });
        return italicized;
    });
}

function BlockText({ text }: { text: string }) {
    const lines = text.split("\n");
    const blocks: React.ReactNode[] = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) {
            i++;
            continue;
        }
        const h = /^(#{1,3})\s+(.*)$/.exec(line);
        if (h) {
            const level = h[1].length;
            const content = h[2];
            blocks.push(
                level === 1 ? (
                    <h3 key={`h-${i}`} className="text-2xl font-bold text-white mt-3">
                        {inline(content)}
                    </h3>
                ) : level === 2 ? (
                    <h4 key={`h-${i}`} className="text-xl font-semibold text-white mt-2">
                        {inline(content)}
                    </h4>
                ) : (
                    <h5 key={`h-${i}`} className="text-lg font-semibold text-white mt-2">
                        {inline(content)}
                    </h5>
                ),
            );
            i++;
            continue;
        }
        if (/^\s*\d+\.\s+/.test(line)) {
            const items: React.ReactNode[] = [];
            while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
                const item = lines[i].replace(/^\s*\d+\.\s+/, "");
                items.push(
                    <li key={`ol-${i}`} className="ml-4">
                        {inline(item)}
                    </li>,
                );
                i++;
            }
            blocks.push(
                <ol key={`ol-block-${i}`} className="list-decimal pl-5 space-y-1">
                    {items}
                </ol>,
            );
            continue;
        }
        if (/^\s*([-*+])\s+/.test(line)) {
            const items: React.ReactNode[] = [];
            while (i < lines.length && /^\s*([-*+])\s+/.test(lines[i])) {
                const item = lines[i].replace(/^\s*([-*+])\s+/, "");
                items.push(
                    <li key={`ul-${i}`} className="ml-4">
                        {inline(item)}
                    </li>,
                );
                i++;
            }
            blocks.push(
                <ul key={`ul-block-${i}`} className="list-disc pl-5 space-y-1">
                    {items}
                </ul>,
            );
            continue;
        }
        const paras: string[] = [];
        while (
            i < lines.length &&
            lines[i].trim() &&
            !/^(#{1,3})\s+/.test(lines[i]) &&
            !/^\s*\d+\.\s+/.test(lines[i]) &&
            !/^\s*([-*+])\s+/.test(lines[i])
            ) {
            paras.push(lines[i]);
            i++;
        }
        const paraText = paras.join(" ");
        blocks.push(
            <p key={`p-${i}`} className="text-white/85">
                {inline(paraText)}
            </p>,
        );
    }
    return <>{blocks}</>;
}

export default function SimpleMarkdown({ markdown }: { markdown: string }) {
    const src = (markdown || "").replace(/\r\n/g, "\n");
    const segments = splitFenced(src);
    if (!src.trim()) {
        return null;
    }
    return (
        <div className="space-y-3 leading-relaxed text-white/90">
            {segments.map((seg, i) =>
                seg.type === "code" ? (
                    <pre
                        key={`code-${i}`}
                        className="overflow-x-auto rounded-md bg-white/5 ring-1 ring-white/10 p-3 text-[13px] leading-relaxed"
                        aria-label={
                            seg.lang
                                ? tClient("projects.form.markdown.codeBlockWithLang").replace(
                                    "{lang}",
                                    seg.lang,
                                )
                                : tClient("projects.form.markdown.codeBlock")
                        }
                    >
                        <code>{seg.content}</code>
                    </pre>
                ) : (
                    <BlockText key={`txt-${i}`} text={seg.content} />
                ),
            )}
        </div>
    );
}