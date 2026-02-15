"use client";
// Loaded via next/dynamic with ssr:false — Leaflet is browser-only.
import { useEffect, useRef } from "react";
import L from "leaflet";

export default function ParkedMap({ lat, lng }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [lat, lng],
      zoom: 17,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    const carIcon = L.divIcon({
      className: "custom-marker",
      html: `<div style="
        width: 40px; height: 40px; border-radius: 50%;
        background: linear-gradient(135deg, #6366F1, #8B5CF6);
        border: 3px solid #fff;
        box-shadow: 0 2px 12px rgba(99,102,241,0.5);
        display: flex; align-items: center; justify-content: center;
        font-size: 20px;
      ">🚗</div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    L.marker([lat, lng], { icon: carIcon }).addTo(map);

    mapInstanceRef.current = map;
    return () => { map.remove(); mapInstanceRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={mapRef}
      style={{ width: "100%", height: "180px", borderRadius: "12px", overflow: "hidden" }}
    />
  );
}
