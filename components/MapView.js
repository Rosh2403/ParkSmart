"use client";
// This component is loaded via next/dynamic with ssr:false in page.js,
// so it never runs on the server. Leaflet can be imported directly.
import { useEffect, useRef } from "react";
import L from "leaflet";
import styles from "./MapView.module.css";

export default function MapView({ destination, carparks, selectedCarpark, onSelectCarpark }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const destMarkerRef = useRef(null);

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [destination.lat, destination.lng],
      zoom: 15,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://openstreetmap.org">OSM</a>',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount — destination centering handled by the bounds effect below

  // Update markers whenever carparks, selectedCarpark, or destination changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (destMarkerRef.current) destMarkerRef.current.remove();

    // Destination marker
    const destIcon = L.divIcon({
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

    destMarkerRef.current = L.marker([destination.lat, destination.lng], { icon: destIcon })
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
        cp.badge === "BEST MATCH" ? "#6366F1"
        : cp.badge === "CHEAPEST"  ? "#10B981"
        : cp.badge === "NEAREST"   ? "#F59E0B"
        : isSelected               ? "#818CF8"
        : "#475569";

      const size = isSelected ? 30 : 24;
      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          width: ${size}px; height: ${size}px; border-radius: 50%;
          background: ${color};
          border: 2px solid rgba(255,255,255,${isSelected ? 0.9 : 0.5});
          box-shadow: 0 2px 8px rgba(0,0,0,0.3)${isSelected ? ", 0 0 15px " + color + "60" : ""};
          display: flex; align-items: center; justify-content: center;
          font-size: ${isSelected ? 12 : 10}px; font-weight: 800;
          color: #fff; transition: all 0.3s;
          font-family: 'Space Mono', monospace;
        ">${i + 1}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([cp.lat, cp.lng], { icon })
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

    // Fit bounds to show all markers; fall back to centering on the destination
    // alone when no carparks were found so the map still moves to the new area.
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
    } else {
      map.setView([destination.lat, destination.lng], 15, { animate: true });
    }
  }, [carparks, selectedCarpark, destination, onSelectCarpark]);

  // Pan to selected carpark
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedCarpark) return;
    mapInstanceRef.current.panTo([selectedCarpark.lat, selectedCarpark.lng], { animate: true });
  }, [selectedCarpark]);

  return (
    <div className={styles.container}>
      <div ref={mapRef} className={styles.map} />
    </div>
  );
}
