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
export const Route = createFileRoute("/guardian")({ head: () => seo("Guardian Dashboard", "Authorized guardians see alerts and shared location."), component: Guardian });
function Guardian() {
  const s = useApp(); const granted = s.contacts.filter((c) => c.guardianAccess);
  const active = s.incidents.filter((i) => i.status === "active");
  return <div className="mx-auto max-w-5xl"><PageHeader title="Guardian Dashboard" desc={`Preview of what authorized guardians see for ${s.profile.name}.`} />
    {!s.consent.guardian && <p className="mb-4 rounded bg-destructive/15 p-3 text-sm text-destructive">Guardian access is disabled in the consent center.</p>}
    <div className="grid gap-4 md:grid-cols-2">
      <Card><CardHeader><CardTitle className="text-base">Granted guardians</CardTitle></CardHeader><CardContent className="divide-y">{granted.map((c) => <div key={c.id} className="flex items-center justify-between py-2 text-sm"><span>{c.name} · {c.shareLocation ? "location" : "no location"}</span><Button size="sm" variant="outline" onClick={() => s.set({ contacts: s.contacts.map((x) => x.id === c.id ? { ...x, guardianAccess: false } : x) })}>Revoke</Button></div>)}{!granted.length && <p className="text-sm text-muted-foreground">No guardians granted.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Live shared location</CardTitle></CardHeader><CardContent className="text-sm">{s.consent.guardian && s.location ? `${s.location.lat.toFixed(5)}, ${s.location.lng.toFixed(5)} (updated ${fmt(s.location.t)})` : "Not shared"}</CardContent></Card>
      <Card className="md:col-span-2"><CardHeader><CardTitle className="text-base">Active emergency alerts</CardTitle></CardHeader><CardContent className="divide-y">{active.map((i) => <div key={i.id} className="flex items-center justify-between py-2 text-sm"><span className="text-destructive">SOS ({i.trigger}) · {fmt(i.t)}</span><Button size="sm" onClick={() => { s.set({ notifs: s.notifs.map((n) => n.category === "emergency" && n.t >= i.t ? { ...n, delivery: "acknowledged" } : n) }); toast.success("Acknowledged"); }}>Acknowledge</Button></div>)}{!active.length && <p className="text-sm text-muted-foreground">No active alerts.</p>}</CardContent></Card>
    </div></div>;
}
