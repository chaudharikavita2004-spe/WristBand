import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Bluetooth, FlaskConical, Trash2 } from "lucide-react";
import { useApp, fmt } from "@/lib/store";
import { seo } from "@/lib/seo";
import { bleSupported, scanAndConnect, disconnect, addDemoDevice } from "@/lib/ble";
import { PageHeader, DemoBadge } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/devices")({
  head: () => seo("Devices", "Pair WristBand and Bluetooth heart-rate sensors, or use Demo Mode."),
  component: Devices,
});

function Devices() {
  const s = useApp();
  const [busy, setBusy] = useState(false);
  const supported = typeof window !== "undefined" && bleSupported();
  const scan = async () => {
    setBusy(true);
    try { const d = await scanAndConnect(); toast.success(`Connected to ${d.name}`); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Devices" desc="Real Bluetooth sensors are read via Web Bluetooth. Simulated sensors are clearly marked DEMO." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Bluetooth className="h-5 w-5" /> Real hardware</CardTitle><CardDescription>Scans for BLE devices exposing the standard Heart Rate service (0x180D). Battery read via Battery service if available.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">Web Bluetooth: <b className={supported ? "text-success" : "text-destructive"}>{supported ? "Supported" : "Not supported in this browser"}</b></p>
            <Button onClick={scan} disabled={busy || !supported}>{busy ? "Scanning…" : "Scan & pair device"}</Button>
            <p className="text-xs text-muted-foreground">Requires Chrome or Edge on desktop/Android and a secure (https) page. May not work inside embedded previews — open in a new tab.</p>
          </CardContent>
        </Card>
        <Card className="ring-1 ring-warning">
          <CardHeader><CardTitle className="flex items-center gap-2"><FlaskConical className="h-5 w-5" /> Demo Mode <DemoBadge /></CardTitle><CardDescription>Simulated wristband for testing without hardware. Readings are synthetic and labeled DEMO everywhere.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center justify-between text-sm">Show DEMO MODE banner <Switch checked={s.demoMode} onCheckedChange={(v) => s.set({ demoMode: v })} /></label>
            <Button variant="secondary" onClick={() => { addDemoDevice(); toast("Demo sensor connected"); }}>Add simulated wristband</Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Authorized device registry</CardTitle></CardHeader>
        <CardContent>
          {s.devices.length === 0 ? <p className="text-sm text-muted-foreground">No devices yet.</p> : (
            <ul className="divide-y">
              {s.devices.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${d.status === "connected" ? "bg-success" : "bg-muted-foreground"}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-medium">{d.name} {d.source === "demo" ? <DemoBadge /> : <span className="rounded bg-primary/15 px-1.5 text-[10px] font-bold uppercase text-primary">Real</span>}</div>
                    <div className="text-xs text-muted-foreground">{d.status} · battery {d.battery ?? "n/a"}{d.battery != null && "%"} · last seen {fmt(d.lastSeen)}</div>
                  </div>
                  <label className="flex items-center gap-2 text-xs">Authorized <Switch checked={d.authorized} onCheckedChange={(v) => s.set({ devices: s.devices.map((x) => x.id === d.id ? { ...x, authorized: v } : x) })} /></label>
                  {d.status === "connected" ? (
                    <Button size="sm" variant="outline" onClick={() => { d.source === "real" ? disconnect(d.id) : s.set({ devices: s.devices.map((x) => x.id === d.id ? { ...x, status: "disconnected" } : x) }); s.addNotif({ category: "device", title: "Device disconnected", body: d.name }); }}>Disconnect</Button>
                  ) : d.source === "demo" ? (
                    <Button size="sm" variant="outline" onClick={() => s.set({ devices: s.devices.map((x) => x.id === d.id ? { ...x, status: "connected" } : x) })}>Connect</Button>
                  ) : <Button size="sm" variant="outline" onClick={scan}>Reconnect</Button>}
                  <Button size="icon" variant="ghost" aria-label={`Remove ${d.name}`} onClick={() => { if (d.source === "real") disconnect(d.id); s.set({ devices: s.devices.filter((x) => x.id !== d.id) }); }}><Trash2 className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
