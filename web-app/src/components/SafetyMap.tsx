import { useEffect, useRef } from "react";
import L from "leaflet";
import type { Zone } from "@/lib/store";

export default function SafetyMap({ me, zones, dest, onPick }: { me: { lat: number; lng: number } | null; zones: Zone[]; dest?: { lat: number; lng: number } | null; onPick?: (p: { lat: number; lng: number }) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    if (!el.current || map.current) return;
    const c = me ?? { lat: 28.6139, lng: 77.209 };
    map.current = L.map(el.current).setView([c.lat, c.lng], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    map.current.on("click", (e) => pick.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    return () => { map.current?.remove(); map.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const g = layer.current; if (!g) return;
    g.clearLayers();
    zones.forEach((z) => L.circle([z.lat, z.lng], { radius: z.radius, color: "#16a34a", fillOpacity: 0.12 }).bindTooltip(z.name).addTo(g));
    if (me) L.circleMarker([me.lat, me.lng], { radius: 9, color: "#fff", weight: 3, fillColor: "#7c3aed", fillOpacity: 1 }).bindTooltip("You").addTo(g);
    if (dest) {
      L.circleMarker([dest.lat, dest.lng], { radius: 8, color: "#dc2626", fillOpacity: 0.9 }).bindTooltip("Destination").addTo(g);
      if (me) L.polyline([[me.lat, me.lng], [dest.lat, dest.lng]], { color: "#7c3aed", dashArray: "6 6" }).addTo(g);
    }
  }, [me?.lat, me?.lng, zones, dest?.lat, dest?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className="h-full w-full rounded-lg" role="application" aria-label="Safety map" />;
}
