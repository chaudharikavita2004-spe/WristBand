import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useApp, fmt, downloadCSV } from "@/lib/store";
import { seo } from "@/lib/seo";
import { PageHeader } from "@/components/AppShell";
import { DeliveryPill } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
void useState; void toast; void fmt; void downloadCSV; void DeliveryPill; void Input; void Label; void Switch; void Textarea; void Slider; void Button;
export const Route = createFileRoute("/admin")({ head: () => seo("WristBand Admin", "System stats, devices, incidents, delivery audits and diagnostics."), component: Admin });
function Admin() {
  const s = useApp(); const [pin, setPin] = useState(""); const [diag, setDiag] = useState<Record<string, string>>({});
  if (!s.adminUnlocked) return <div className="mx-auto max-w-sm"><PageHeader title="WristBand Secure Login" desc="Admin access (demo admin PIN: 0000)." /><div className="flex gap-2"><Input type="password" value={pin} onChange={(e) => setPin(e.target.value)} aria-label="Admin PIN" /><Button onClick={() => pin === "0000" ? s.set({ adminUnlocked: true }) : toast.error("Access denied")}>Sign in</Button></div></div>;
  const run = async () => {
    const r: Record<string, string> = {};
    r["Bluetooth"] = "bluetooth" in navigator ? "Available" : "Unsupported";
    r["GPS"] = await new Promise((res) => "geolocation" in navigator ? navigator.geolocation.getCurrentPosition(() => res("OK"), (e) => res("Error: " + e.message), { timeout: 8000 }) : res("Unsupported"));
    const t = performance.now(); try { await fetch("/favicon.png", { cache: "no-store" }); r["Backend"] = `OK (${Math.round(performance.now() - t)}ms)`; } catch { r["Backend"] = "Unreachable"; }
    r["Storage"] = `${(JSON.stringify(localStorage).length / 1024).toFixed(0)} KB used`; setDiag(r);
  };
  return <div className="mx-auto max-w-6xl"><PageHeader title="WristBand Admin"><Button variant="outline" onClick={() => s.set({ adminUnlocked: false })}>Sign out</Button></PageHeader>
    <div className="grid gap-4 sm:grid-cols-4">{[["Users", 1], ["Devices", s.devices.length], ["Active incidents", s.incidents.filter((i) => i.status === "active").length], ["Failed deliveries", s.notifs.filter((n) => n.delivery === "failed").length]].map(([l, v]) => <Card key={l}><CardContent className="p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="font-display text-3xl font-bold">{v}</div></CardContent></Card>)}</div>
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <Card><CardHeader><CardTitle className="text-base">Users</CardTitle></CardHeader><CardContent className="text-sm">{s.profile.name} · {s.profile.email} · {s.contacts.length} contacts</CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Device inventory</CardTitle></CardHeader><CardContent className="divide-y text-sm">{s.devices.map((d) => <div key={d.id} className="py-1">{d.name} · {d.source} · {d.status}</div>)}{!s.devices.length && "None"}</CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Live incident queue</CardTitle></CardHeader><CardContent className="divide-y text-sm">{s.incidents.slice(0, 10).map((i) => <div key={i.id} className="flex justify-between py-1"><span>{i.trigger} · {i.status} · {fmt(i.t)}</span>{i.status === "active" && <Button size="sm" variant="outline" onClick={() => s.resolveIncident(i.id)}>Resolve</Button>}</div>)}</CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Delivery audit</CardTitle></CardHeader><CardContent className="max-h-64 divide-y overflow-y-auto text-sm">{s.notifs.slice(0, 30).map((n) => <div key={n.id} className="flex justify-between gap-2 py-1"><span className="truncate">{n.title}</span><DeliveryPill d={n.delivery} /></div>)}</CardContent></Card>
      <Card className="md:col-span-2"><CardHeader><CardTitle className="text-base">System health & diagnostics</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><Button onClick={run}>Run diagnostics (Bluetooth, GPS, backend)</Button>{Object.entries(diag).map(([k, v]) => <p key={k}><b>{k}:</b> {v}</p>)}<p className="text-xs text-muted-foreground">Online: {String(navigator.onLine)} · Queued incidents: {s.incidents.filter((i) => !i.synced).length}</p></CardContent></Card>
    </div></div>;
}
