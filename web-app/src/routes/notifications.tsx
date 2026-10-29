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
export const Route = createFileRoute("/notifications")({ head: () => seo("Notification Center", "Alerts with delivery health: queued, sent, delivered, acknowledged, failed."), component: Notifs });
const cats = ["all", "emergency", "device", "battery", "checkin", "arrival", "zone"];
function Notifs() {
  const s = useApp(); const [c, setC] = useState("all");
  const list = s.notifs.filter((n) => c === "all" || n.category === c);
  const states = ["queued", "sent", "delivered", "acknowledged", "failed"];
  return <div className="mx-auto max-w-5xl"><PageHeader title="Notification Center"><Button variant="outline" onClick={() => s.set({ notifs: s.notifs.map((n) => ({ ...n, read: true })) })}>Mark all read</Button></PageHeader>
    <div className="mb-4 grid grid-cols-5 gap-2">{states.map((d) => <Card key={d}><CardContent className="p-3 text-center"><DeliveryPill d={d} /><div className="font-display text-2xl font-bold">{s.notifs.filter((n) => n.delivery === d).length}</div></CardContent></Card>)}</div>
    <div className="mb-3 flex flex-wrap gap-1">{cats.map((k) => { const u = s.notifs.filter((n) => !n.read && (k === "all" || n.category === k)).length; return <Button key={k} size="sm" variant={c === k ? "default" : "outline"} onClick={() => setC(k)} className="capitalize">{k}{u > 0 && ` (${u})`}</Button>; })}</div>
    <Card><CardContent className="divide-y p-0">{list.map((n) => <div key={n.id} className={`flex flex-wrap items-center gap-2 p-3 ${n.read ? "" : "bg-accent/40"}`}>
      <div className="min-w-0 flex-1"><div className="font-medium">{n.title}</div><div className="text-xs text-muted-foreground">{n.category} · {n.body} · {fmt(n.t)}</div></div>
      <DeliveryPill d={n.delivery} />
      {!n.read && <Button size="sm" variant="ghost" onClick={() => s.set({ notifs: s.notifs.map((x) => x.id === n.id ? { ...x, read: true } : x) })}>Read</Button>}
      {n.delivery === "failed" && <Button size="sm" variant="outline" onClick={() => s.set({ notifs: s.notifs.map((x) => x.id === n.id ? { ...x, delivery: "delivered" } : x) })}>Retry</Button>}
    </div>)}{!list.length && <p className="p-4 text-sm text-muted-foreground">No notifications.</p>}</CardContent></Card></div>;
}
