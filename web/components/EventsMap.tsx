"use client";

import React, { useEffect, useMemo, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css"; // OK in App Router client components
// MapLibre docs & examples (markers & raster source). We use a simple OSM raster style with attribution. :contentReference[oaicite:1]{index=1}

type Event = {
    id: string;
    slug: string;
    name: string;
    dateStart?: string;
    dateEnd?: string;
    locationName?: string;
    lat?: number;
    lng?: number;
    description?: string;
    photos?: string[];
};

function formatDateRange(a?: string, b?: string) {
    if (!a && !b) return "";
    if (a && !b) return new Date(a).toLocaleDateString();
    if (!a && b) return new Date(b).toLocaleDateString();
    const da = new Date(a!);
    const db = new Date(b!);
    const sameMonth = da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth();
    const opts: Intl.DateTimeFormatOptions = sameMonth
        ? { year: "numeric", month: "short", day: "numeric" }
        : { year: "numeric", month: "short", day: "numeric" };
    return `${da.toLocaleDateString(undefined, opts)} – ${db.toLocaleDateString(undefined, opts)}`;
}

export default function EventsMap({ events }: { events: Event[] }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<maplibregl.Marker[]>([]);

    // Build a minimal raster style using OpenStreetMap tiles.
    // NOTE: For production traffic, please use a commercial/hosted tile provider. :contentReference[oaicite:2]{index=2}
    const style = useMemo(
        () => ({
            version: 8 as const,
            sources: {
                osm: {
                    type: "raster" as const,
                    tiles: [
                        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
                        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
                        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
                    ],
                    tileSize: 256,
                    attribution:
                        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
                },
            },
            layers: [
                {
                    id: "osm",
                    type: "raster" as const,
                    source: "osm",
                },
            ],
        }),
        []
    );

    // Initialize the map once
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const map = new maplibregl.Map({
            container: containerRef.current,
            style,
            center: [11.5761, 48.1374], // Munich-ish default
            zoom: 3.5,
            attributionControl: true,
            cooperativeGestures: true,
        });

        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
        mapRef.current = map;

        return () => {
            mapRef.current?.remove();
            mapRef.current = null;
        };
    }, [style]);

    // Update markers whenever events change
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        // Clear old markers
        for (const m of markersRef.current) m.remove();
        markersRef.current = [];

        const valid = events.filter((e) => typeof e.lng === "number" && typeof e.lat === "number") as Required<
            Pick<Event, "lat" | "lng">
        >[] & Event[];

        // Add markers
        for (const e of valid) {
            const el = document.createElement("div");
            el.className =
                "rounded-full w-3.5 h-3.5 shadow-[0_0_12px_2px_rgba(56,189,248,0.9)] bg-cyan-300 border border-white/80";
            el.style.transform = "translate(-50%, -50%)";

            const popup = new maplibregl.Popup({ offset: 12 }).setHTML(`
        <div class="min-w-[220px]">
          <div class="font-semibold">${escapeHtml(e.name)}</div>
          ${e.locationName ? `<div class="text-xs text-gray-400">${escapeHtml(e.locationName)}</div>` : ""}
          <div class="text-xs mt-1">${escapeHtml(formatDateRange(e.dateStart, e.dateEnd))}</div>
          ${
                e.photos && e.photos[0]
                    ? `<div class="mt-2"><img alt="${escapeHtml(e.name)}" src="${escapeAttr(
                        e.photos[0]
                    )}" class="rounded-md ring-1 ring-white/10 w-full h-28 object-cover"/></div>`
                    : ""
            }
          <div class="mt-2">
            <a href="/events/${encodeURIComponent(e.slug)}" class="text-xs underline underline-offset-4">Open page →</a>
          </div>
        </div>
      `);

            const marker = new maplibregl.Marker({ element: el }).setLngLat([e.lng as number, e.lat as number]).setPopup(popup);
            marker.addTo(map);
            markersRef.current.push(marker);
        }

        // Fit bounds
        if (valid.length === 1) {
            map.easeTo({ center: [valid[0].lng as number, valid[0].lat as number], zoom: 6 });
        } else if (valid.length > 1) {
            const bounds = new maplibregl.LngLatBounds();
            for (const e of valid) bounds.extend([e.lng as number, e.lat as number]);
            map.fitBounds(bounds, { padding: 60, maxZoom: 6 });
        }

    }, [events]);

    return (
        <div
            ref={containerRef}
            className="w-full h-[520px] rounded-2xl ring-1 ring-white/10 overflow-hidden bg-black/50"
            aria-label="Events map"
        />
    );
}

// helpers
function escapeHtml(s?: string) {
    if (!s) return "";
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function escapeAttr(s?: string) {
    return escapeHtml(s).replace(/"/g, "&quot;");
}
