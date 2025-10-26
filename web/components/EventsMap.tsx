"use client";

import React, { useEffect, useMemo, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

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
    tags?: string[];
};

function formatDateRange(a?: string, b?: string) {
    if (!a && !b) return "";
    if (a && !b) return new Date(a).toLocaleDateString();
    if (!a && b) return new Date(b).toLocaleDateString();
    const da = new Date(a!);
    const db = new Date(b!);
    const opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };
    return `${da.toLocaleDateString(undefined, opts)} – ${db.toLocaleDateString(undefined, opts)}`;
}

// Easter egg target: 48°15'47.2"N 11°39'58.3"E  -> 48.263111, 11.666194
const SPEZI_TARGET = { lat: 48.26311111111111, lng: 11.666194444444445 };
const SPEZI_ZOOM = 17.2; // "really close"

// Inject our popup + marker theme once
function ensureThemeCSS() {
    if (typeof document === "undefined") return;
    if (document.getElementById("pum-map-theme")) return;
    const s = document.createElement("style");
    s.id = "pum-map-theme";
    s.textContent = `
/* === PUM dark neon popup theme === */
.maplibregl-popup.pum-popup .maplibregl-popup-content{
  background: rgba(8,8,10,.94);
  color: #fff;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow:
    0 0 0 2px rgba(255,255,255,.06),
    0 0 28px rgba(56,189,248,.35),
    0 0 100px rgba(56,189,248,.18);
  width: clamp(240px, 40vw, 340px);
  max-width: 90vw;
}
.maplibregl-popup.pum-popup .maplibregl-popup-tip{
  border-top-color: rgba(8,8,10,.94) !important;
  border-bottom-color: rgba(8,8,10,.94) !important;
}
.pum-popup .pum-title{ font-weight:700; line-height:1.2; }
.pum-popup .pum-sub{ color:#e5e7eb; font-size:12px; line-height:1.3; }
.pum-popup .pum-date{ color:#d1d5db; font-size:12px; margin-top:2px; }
.pum-popup .pum-desc{ color:#e6e6e6; font-size:14px; margin-top:8px; line-height:1.45;
  white-space: normal; word-break: break-word; overflow-wrap: anywhere; }
.pum-popup .pum-tags{ margin-top:8px; display:flex; flex-wrap:wrap; gap:6px; }
.pum-popup .pum-tag{ font-size:10px; padding:4px 8px; border-radius:9999px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); }
.pum-popup .pum-img{ width:100%; aspect-ratio: 16/9; object-fit: cover; display:block; border-radius:10px; border:1px solid rgba(255,255,255,.1); margin-top:10px; }
.pum-popup a{ color:#67e8f9; text-decoration: underline; text-underline-offset: 3px; }

/* === PUM marker styling === */
.pum-marker{
  width: 12px; height: 12px; border-radius: 9999px;
  background: #67e8f9; border: 1px solid rgba(255,255,255,.8);
  box-shadow:
    0 0 10px rgba(56,189,248,.9),
    0 0 24px rgba(56,189,248,.5);
  transform: translate(-50%, -50%);
}
.pum-marker--active{
  width: 14px; height: 14px;
  box-shadow:
    0 0 0 2px rgba(255,255,255,.8),
    0 0 24px rgba(56,189,248,.95),
    0 0 80px rgba(56,189,248,.7);
}
  `;
    document.head.appendChild(s);
}

export default function EventsMap({ events }: { events: Event[] }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<maplibregl.Marker[]>([]);
    const speziRef = useRef<maplibregl.Marker | null>(null);
    const speziShownRef = useRef<boolean>(false);
    const lockedRef = useRef<{ popup: maplibregl.Popup; el: HTMLElement } | null>(null);

    // Prefer your MapTiler dark style (env), fall back to OpenFreeMap dark (no key).
    const style = useMemo(() => {
        const styleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL;
        if (styleUrl) return styleUrl as unknown as maplibregl.StyleSpecification | string;
        return "https://tiles.openfreemap.org/styles/dark";
    }, []);

    // Initialize map
    useEffect(() => {
        ensureThemeCSS();
        if (!containerRef.current || mapRef.current) return;

        const map = new maplibregl.Map({
            container: containerRef.current,
            style,
            center: [11.5761, 48.1374], // Munich default
            zoom: 3.5,
            attributionControl: true,
            cooperativeGestures: true,
        });

        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
        mapRef.current = map;

        // Clicking on the map background unlocks any locked popup
        map.on("click", (e) => {
            const target = e.originalEvent.target as HTMLElement;
            const locked = lockedRef.current;
            if (!locked) return;
            const insidePopup = locked.popup && locked.popup.getElement()?.contains(target);
            const isMarker = locked.el.contains(target);
            if (!insidePopup && !isMarker) {
                locked.popup.remove();
                locked.el.classList.remove("pum-marker--active");
                lockedRef.current = null;
            }
        });

        return () => {
            mapRef.current?.remove();
            mapRef.current = null;
        };
    }, [style]);

    // Add/update markers & fit bounds when events change
    useEffect(() => {
        const m = mapRef.current;
        if (!m) return;
        const map = m as maplibregl.Map;

        // Clear old markers
        for (const mk of markersRef.current) mk.remove();
        markersRef.current = [];

        const valid = events.filter(
            (e) => typeof e.lng === "number" && typeof e.lat === "number"
        );

        for (const e of valid) {
            const el = document.createElement("div");
            el.className = "pum-marker";

            const popupEl = document.createElement("div");
            popupEl.className = "pointer-events-auto";
            popupEl.innerHTML = renderPopupHtml(e);

            const popup = new maplibregl.Popup({
                offset: 8,                 // smaller gap -> easier to hover into
                closeButton: false,
                closeOnClick: false,       // don't auto-close on click (we manage it)
                closeOnMove: false,        // keep open while panning/zooming
                className: "pum-popup",    // custom class for our CSS
            }).setDOMContent(popupEl);    // official API for DOM content
            // Docs: PopupOptions.className, closeOnClick, closeOnMove; setDOMContent.
            // :contentReference[oaicite:4]{index=4}

            // State for hover handling
            let overPopup = false;
            let markerHovering = false;
            let hoverCloseTimer: number | null = null;

            const open = () => {
                if (!popup.isOpen()) popup.addTo(map);
                el.classList.add("pum-marker--active");
            };
            const closeAfterDelay = () => {
                if (hoverCloseTimer) window.clearTimeout(hoverCloseTimer);
                hoverCloseTimer = window.setTimeout(() => {
                    // Don't close if it's locked by click
                    if (lockedRef.current?.popup === popup) return;
                    if (!overPopup && !markerHovering) {
                        popup.remove();
                        el.classList.remove("pum-marker--active");
                    }
                }, 400); // generous time so you can move cursor into popup
            };

            // Hover opens popup and keeps it while hovering marker or popup
            el.addEventListener("mouseenter", () => {
                markerHovering = true;
                open();
            });
            el.addEventListener("mouseleave", () => {
                markerHovering = false;
                closeAfterDelay();
            });

            // Keep popup open while mouse is inside popup content
            popupEl.addEventListener("mouseenter", () => {
                overPopup = true;
                if (hoverCloseTimer) { window.clearTimeout(hoverCloseTimer); hoverCloseTimer = null; }
            });
            popupEl.addEventListener("mouseleave", () => {
                overPopup = false;
                closeAfterDelay();
            });

            // Clicking a marker locks its popup until clicking map background
            el.addEventListener("click", () => {
                open();
                // Clear any previous lock
                if (lockedRef.current && lockedRef.current.popup !== popup) {
                    lockedRef.current.popup.remove();
                    lockedRef.current.el.classList.remove("pum-marker--active");
                }
                lockedRef.current = { popup, el };
            });

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([e.lng as number, e.lat as number])
                .setPopup(popup); // keep association (not used for default open)
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

    // Easter egg — show a tiny Spezi shopper when zoomed very close to the target
    useEffect(() => {
        const m = mapRef.current;
        if (!m) return;
        const map = m as maplibregl.Map;

        function ensureSpeziMarker() {
            if (speziRef.current) return;
            const el = document.createElement("div");
            el.title = "Spezi stash!";
            el.className = "text-[12px] leading-none select-none pointer-events-none";
            el.style.transform = "translate(-50%, -100%)";
            el.innerHTML = `
        <div class="px-1.5 py-1 rounded-md bg-black/80 ring-1 ring-white/20 shadow">
          <span>here be spezi ;)</span>
        </div>
      `;
            speziRef.current = new maplibregl.Marker({ element: el }).setLngLat([SPEZI_TARGET.lng, SPEZI_TARGET.lat]);
        }

        function maybeShow() {
            const z = map.getZoom();
            const c = map.getCenter();
            const d = distanceMeters(c.lat, c.lng, SPEZI_TARGET.lat, SPEZI_TARGET.lng);
            if (z >= SPEZI_ZOOM && d < 40) {
                ensureSpeziMarker();
                if (!speziShownRef.current && speziRef.current) {
                    speziRef.current.addTo(map);
                    speziShownRef.current = true;
                }
            } else {
                if (speziShownRef.current && speziRef.current) {
                    speziRef.current.remove();
                    speziShownRef.current = false;
                }
            }
        }

        map.on("move", maybeShow);
        maybeShow();

        return () => {
            map.off("move", maybeShow);
            if (speziShownRef.current && speziRef.current) {
                speziRef.current.remove();
                speziShownRef.current = false;
            }
            speziRef.current = null;
        };
    }, []);

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

function renderPopupHtml(e: Event) {
    const img = e.photos && e.photos.length ? e.photos[0] : undefined;
    const imageBlock = img
        ? `<img alt="${escapeAttr(e.name)}" src="${escapeAttr(img)}" class="pum-img" />`
        : "";
    const tags =
        e.tags && e.tags.length
            ? `<div class="pum-tags">
          ${e.tags.slice(0, 6).map((t) => `<span class="pum-tag">${escapeHtml(t)}</span>`).join("")}
        </div>`
            : "";

    return `
    <div class="pum-body">
      <div class="pum-title">${escapeHtml(e.name)}</div>
      ${e.locationName ? `<div class="pum-sub">${escapeHtml(e.locationName)}</div>` : ""}
      <div class="pum-date">${escapeHtml(formatDateRange(e.dateStart, e.dateEnd))}</div>
      ${e.description ? `<div class="pum-desc">${escapeHtml(e.description)}</div>` : ""}
      ${tags}
      ${imageBlock}
      <div class="mt-3">
        <a href="/events/${encodeURIComponent(e.slug)}" class="text-xs">Open page →</a>
      </div>
    </div>
  `;
}

// Approx haversine for meters
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
