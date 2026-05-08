"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";

// Default marker icon fix for Leaflet + Next.js
const outOfRangeIcon = new L.DivIcon({
  className: "",
  html: `<div style="background:#dc2626;border:2px solid white;width:18px;height:18px;border-radius:50%;box-shadow:0 0 0 3px rgba(220,38,38,.35)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9]
});
const inRangeIcon = new L.DivIcon({
  className: "",
  html: `<div style="background:#10b981;border:2px solid white;width:18px;height:18px;border-radius:50%;box-shadow:0 0 0 3px rgba(16,185,129,.35)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9]
});

function Recenter({ pos }: { pos: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.setView(pos, map.getZoom());
  }, [pos, map]);
  return null;
}

export default function MapaTracker({
  position,
  path,
  outOfRange,
  title
}: {
  position: { lat: number; lng: number } | null;
  path: Array<{ lat: number; lng: number }>;
  outOfRange: boolean;
  title?: string;
}) {
  const center = useMemo<[number, number]>(
    () => (position ? [position.lat, position.lng] : [23.6345, -102.5528]),
    [position]
  );

  const polyline = useMemo<[number, number][]>(
    () => path.map((p) => [p.lat, p.lng]),
    [path]
  );

  return (
    <MapContainer
      center={center}
      zoom={position ? 14 : 5}
      scrollWheelZoom
      className="h-full w-full rounded-xl overflow-hidden"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      {polyline.length > 1 && (
        <Polyline positions={polyline} pathOptions={{ color: "#085041", weight: 3, opacity: 0.7 }} />
      )}
      {position && (
        <Marker
          position={[position.lat, position.lng]}
          icon={outOfRange ? outOfRangeIcon : inRangeIcon}
        >
          <Popup>{title ?? "Posición actual"}</Popup>
        </Marker>
      )}
      <Recenter pos={position ? [position.lat, position.lng] : null} />
    </MapContainer>
  );
}
