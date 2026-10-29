import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useApp, uid, haversine, fmt, type Zone } from "@/lib/store";
import { seo } from "@/lib/seo";
import { PageHeader, DemoBadge } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SafetyMap = lazy(() => import("@/components/SafetyMap"));

export const Route = createFileRoute("/travel")({
  head: () => seo("Travel Safety", "Journey tracking, safe zones and route deviation alerts."),
  component: Travel,
});

// Perpendicular-ish distance from point to straight route segment (meters)
function offRoute(p: { lat: number; lng: number }, a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const ab = haversine(a, b), ap = haversine(a, p), bp = haversine(b, p);
  if (ab < 1) return ap;
  const sp = (ab + ap + bp) / 2;
  const area = Math.sqrt(Math.max(0, sp * (sp - ab) * (sp - ap) * (sp - bp)));
  return (2 * area) / ab;
}

function Travel() {
  const s = useApp();
  const j = s.journeys.find((x) => x.status === "active");
  const [form, setForm] = useState({ origin: "Current location", destination: "", eta: 20, lat: "", lng: "" });
  const [zoneForm, setZoneForm] = useState({ name: "", kind: "home" as Zone["kind"], radius: 300 });
  const [threshold, setThreshold] = useState(300);
  const [start, setStart] = useState<{ lat: number; lng: number } | null>(null);
  const inside = useRef<Record<string, boolean>>({});
  const me = s.location;

  // Safe zone enter/exit + deviation + arrival
  useEffect(() => {
    if (!me) return;
    s.zones.forEach((z) => {
      const isIn = haversine(me, z) <= z.radius;
      const was = inside.current[z.id];
      if (was !== undefined && was !== isIn) s.addNotif({ category: "zone", title: `${isIn ? "Entered" : "Left"} Safe Zone: ${z.name}`, body: `${me.lat.toFixed(4)}, ${me.lng.toFixed(4)}` });
      inside.current[z.id] = isIn;
    });
    if (j && start) {
      const dest = { lat: j.destLat, lng: j.destLng };
      if (haversine(me, dest) < 100) {
        s.set({ journeys: s.journeys.map((x) => x.id === j.id ? { ...x, status: "arrived", endedAt: Date.now() } : x) });
        s.addNotif({ category: "arrival", title: `Arrived at ${j.destination}`, body: "Contacts notified of safe arrival." });
        toast.success("Arrived safely");
      } else if (offRoute(me, start, dest) > threshold) {
        s.set({ journeys: s.journeys.map((x) => x.id === j.id ? { ...x, deviations: x.deviations + 1 } : x) });
        s.addNotif({ category: "zone", title: "Route deviation alert", body: `More than ${threshold}m off expected route.` });
        toast.error("You've deviated from your planned route");
      }
    }
  }, [me?.lat, me?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const begin = () => {
    const lat = parseFloat(form.lat), lng = parseFloat(form.lng);
    if (!form.destination || isNaN(lat) || isNaN(lng)) { toast.error("Enter destination and pick it on the map"); return; }
    setStart(me ? { lat: me.lat, lng: me.lng } : null);
    s.set({ journeys: [{ id: uid(), origin: form.origin, destination: form.destination, destLat: lat, destLng: lng, eta: form.eta, startedAt: Date.now(), status: "active", deviations: 0 }, ...s.journeys] });
    toast.success("Journey started — contacts can follow your trip");
  };
  const simulateMove = (off: boolean) => {
    if (!me || !j) return;
    const t = 0.25, dLat = (j.destLat - me.lat) * t, dLng = (j.destLng - me.lng) * t;
    s.set({ location: { lat: me.lat + dLat + (off ? 0.006 : 0), lng: me.lng + dLng + (off ? -0.006 : 0), acc: 20, t: Date.now(), source: "demo" } });
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Travel Safety" desc="Click the map to set a destination or a safe zone center." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="h-[420px] p-2">
            <ClientOnly fallback={<div className="h-full animate-pulse rounded bg-muted" />}>
              <Suspense fallback={<div className="h-full animate-pulse rounded bg-muted" />}>
                <SafetyMap me={me} zones={s.zones} dest={j ? { lat: j.destLat, lng: j.destLng } : form.lat ? { lat: +form.lat, lng: +form.lng } : null} onPick={(p) => setForm((f) => ({ ...f, lat: p.lat.toFixed(5), lng: p.lng.toFixed(5) }))} />
              </Suspense>
            </ClientOnly>
          </CardContent>
          <div className="flex items-center gap-2 px-4 pb-3 text-xs text-muted-foreground">Location: {me ? `${me.lat.toFixed(5)}, ${me.lng.toFixed(5)} ±${Math.round(me.acc)}m` : "unavailable"} <DemoBadge show={me?.source === "demo"} /></div>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{j ? "Active journey" : "Start a journey"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {j ? (
              <>
                <p className="text-sm">{j.origin} → <b>{j.destination}</b></p>
                <p className="text-sm">ETA {new Date(j.startedAt + j.eta * 60000).toLocaleTimeString()} · deviations {j.deviations}</p>
                <div><Label>Deviation threshold (m)</Label><Input type="number" value={threshold} onChange={(e) => setThreshold(+e.target.value)} /></div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => { s.set({ journeys: s.journeys.map((x) => x.id === j.id ? { ...x, status: "arrived", endedAt: Date.now() } : x) }); s.addNotif({ category: "arrival", title: `Arrived at ${j.destination}`, body: "Marked arrived manually." }); }}>I've arrived</Button>
                  <Button variant="outline" onClick={() => s.set({ journeys: s.journeys.map((x) => x.id === j.id ? { ...x, status: "cancelled", endedAt: Date.now() } : x) })}>Cancel</Button>
                </div>
                <div className="rounded border border-warning p-2 text-xs"><DemoBadge /> Simulate movement:
                  <div className="mt-2 flex gap-2"><Button size="sm" variant="secondary" onClick={() => simulateMove(false)}>Step on route</Button><Button size="sm" variant="secondary" onClick={() => simulateMove(true)}>Step off route</Button></div>
                </div>
              </>
            ) : (
              <>
                <div><Label>Origin</Label><Input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} /></div>
                <div><Label>Destination name</Label><Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="e.g. College" /></div>
                <div className="grid grid-cols-2 gap-2"><div><Label>Lat</Label><Input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} /></div><div><Label>Lng</Label><Input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} /></div></div>
                <div><Label>ETA (minutes)</Label><Input type="number" value={form.eta} onChange={(e) => setForm({ ...form, eta: +e.target.value })} /></div>
                <Button className="w-full" onClick={begin}>Start journey</Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Safe Zones</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <ul className="divide-y text-sm">{s.zones.map((z) => <li key={z.id} className="flex items-center justify-between py-2"><span><b>{z.name}</b> · {z.kind} · {z.radius}m {me && `· ${Math.round(haversine(me, z))}m away`}</span><Button size="icon" variant="ghost" aria-label="Delete zone" onClick={() => s.set({ zones: s.zones.filter((x) => x.id !== z.id) })}><Trash2 className="h-4 w-4" /></Button></li>)}</ul>
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Name" value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} aria-label="Zone name" />
              <select className="rounded-md border bg-background px-2 text-sm" value={zoneForm.kind} onChange={(e) => setZoneForm({ ...zoneForm, kind: e.target.value as Zone["kind"] })} aria-label="Zone type"><option value="home">Home</option><option value="work">Work</option><option value="campus">Campus</option></select>
              <Input type="number" value={zoneForm.radius} onChange={(e) => setZoneForm({ ...zoneForm, radius: +e.target.value })} aria-label="Radius meters" />
            </div>
            <Button variant="outline" onClick={() => { const c = form.lat ? { lat: +form.lat, lng: +form.lng } : me; if (!zoneForm.name || !c) { toast.error("Name and a map point (or your location) required"); return; } s.set({ zones: [...s.zones, { id: uid(), ...zoneForm, lat: c.lat, lng: c.lng }] }); setZoneForm({ ...zoneForm, name: "" }); }}>Add zone at picked point / my location</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Travel history</CardTitle></CardHeader>
          <CardContent><ul className="divide-y text-sm">{s.journeys.map((x) => <li key={x.id} className="flex justify-between py-2"><span>{x.origin} → {x.destination} <span className="text-muted-foreground">({x.status})</span></span><span className="text-xs text-muted-foreground">{fmt(x.startedAt)}</span></li>)}</ul></CardContent>
        </Card>
      </div>
    </div>
  );
}
