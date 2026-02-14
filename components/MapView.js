"use client";
import { useEffect, useRef, useState } from "react";

export default function MapView({ destination, carparks, selectedCarpark, onSelectCarpark }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const destMarkerRef = useRef(null);
  const [leaflet, setLeaflet] = useState(null);

  // Dynamically import Leaflet (not SSR-safe)
  useEffect(() => {
    import("leaflet").then((L) => {
      setLeaflet(L.default || L);
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!leaflet || !mapRef.current || mapInstanceRef.current) return;

    const map = leaflet.map(mapRef.current, {
      center: [destination.lat, destination.lng],
      zoom: 15,
      zoomControl: true,
      attributionControl: true,
    });

    leaflet
      .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://openstreetmap.org">OSM</a>',
        maxZoom: 19,
      })
      .addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [leaflet, destination]);

  // Update markers
  useEffect(() => {
    if (!leaflet || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (destMarkerRef.current) destMarkerRef.current.remove();

    // Destination marker
    const destIcon = leaflet.divIcon({
      className: "custom-marker",
      html: `<div style="
        width: 32px; height: 32px; border-radius: 50%;
        background: linear-gradient(135deg, #EF4444, #DC2626);
        border: 3px solid #fff;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
        font-size: 14px;
      ">📍</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    destMarkerRef.current = leaflet
      .marker([destination.lat, destination.lng], { icon: destIcon })
      .addTo(map)
      .bindPopup(
        `<div style="font-family: DM Sans, sans-serif; padding: 4px;">
          <strong>${destination.name}</strong><br/>
          <small style="color: #64748B;">Your destination</small>
        </div>`
      );

    // Carpark markers
    const bounds = [[destination.lat, destination.lng]];

    carparks.slice(0, 20).forEach((cp, i) => {
      const isSelected = selectedCarpark && cp.id === selectedCarpark.id;
      const color =
        cp.badge === "BEST MATCH"
          ? "#6366F1"
          : cp.badge === "CHEAPEST"
          ? "#10B981"
          : cp.badge === "NEAREST"
          ? "#F59E0B"
          : isSelected
          ? "#818CF8"
          : "#475569";

      const icon = leaflet.divIcon({
        className: "custom-marker",
        html: `<div style="
          width: ${isSelected ? 30 : 24}px;
          height: ${isSelected ? 30 : 24}px;
          border-radius: 50%;
          background: ${color};
          border: 2px solid rgba(255,255,255,${isSelected ? 0.9 : 0.5});
          box-shadow: 0 2px 8px rgba(0,0,0,0.3)${isSelected ? ", 0 0 15px " + color + "60" : ""};
          display: flex; align-items: center; justify-content: center;
          font-size: ${isSelected ? 12 : 10}px; font-weight: 800;
          color: #fff; transition: all 0.3s;
          font-family: 'Space Mono', monospace;
        ">${i + 1}</div>`,
        iconSize: [isSelected ? 30 : 24, isSelected ? 30 : 24],
        iconAnchor: [isSelected ? 15 : 12, isSelected ? 15 : 12],
      });

      const marker = leaflet
        .marker([cp.lat, cp.lng], { icon })
        .addTo(map)
        .bindPopup(
          `<div style="font-family: DM Sans, sans-serif; padding: 4px; min-width: 160px;">
            <strong style="font-size: 13px;">${cp.name}</strong><br/>
            <div style="margin-top: 4px; font-size: 12px; color: #64748B;">
              ${cp.agency} · ${cp.availableLots} lots · ${cp.walkTimeMin}min walk
            </div>
            <div style="margin-top: 4px; font-size: 16px; font-weight: 800; color: #10B981;">
              $${cp.cost.toFixed(2)}
            </div>
          </div>`,
          { className: "carpark-popup" }
        )
        .on("click", () => onSelectCarpark(cp));

      markersRef.current.push(marker);
      bounds.push([cp.lat, cp.lng]);
    });

    // Fit bounds
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
    }
  }, [leaflet, carparks, selectedCarpark, destination, onSelectCarpark]);

  // Pan to selected carpark
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedCarpark) return;
    mapInstanceRef.current.panTo([selectedCarpark.lat, selectedCarpark.lng], { animate: true });
  }, [selectedCarpark]);

  return (
    <div
      style={{
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid var(--border)",
        height: 250,
      }}
    >
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
