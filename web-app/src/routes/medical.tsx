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
export const Route = createFileRoute("/medical")({ head: () => seo("Emergency Medical Card", "Printable emergency medical card with privacy controls."), component: Medical });
function Medical() {
  const s = useApp(); const m = s.medical;
  const [pin, setPin] = useState(""); const [ok, setOk] = useState(false);
  if (!ok) return <div className="mx-auto max-w-sm"><PageHeader title="Emergency Medical Card" desc="Authorized access only. Enter your PIN (demo 1234)." /><div className="flex gap-2"><Input type="password" value={pin} onChange={(e) => setPin(e.target.value)} aria-label="PIN" /><Button onClick={() => pin === s.unlockPin ? setOk(true) : toast.error("Incorrect PIN")}>Unlock</Button></div></div>;
  const up = (k: string, v: unknown) => s.set({ medical: { ...m, [k]: v } });
  const fields = [["allergies", "showAllergies"], ["conditions", "showConditions"], ["medications", "showMedications"], ["notes", "showNotes"]] as const;
  return <div className="mx-auto max-w-4xl"><PageHeader title="Emergency Medical Card"><Button onClick={() => window.print()}>Print card</Button></PageHeader>
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="no-print"><CardContent className="space-y-3 p-4">
        <div><Label>Blood group</Label><Input value={m.bloodGroup} onChange={(e) => up("bloodGroup", e.target.value)} /></div>
        {fields.map(([k, sh]) => <div key={k}><div className="flex justify-between"><Label className="capitalize">{k}</Label><label className="flex items-center gap-1 text-xs">Show on card <Switch checked={m[sh]} onCheckedChange={(v) => up(sh, v)} /></label></div><Textarea value={m[k]} onChange={(e) => up(k, e.target.value)} /></div>)}
      </CardContent></Card>
      <Card className="border-2 border-destructive"><CardHeader><CardTitle className="text-destructive">WristBand Emergency Card</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
        <p><b>Name:</b> {s.profile.name}</p><p><b>Blood group:</b> {m.bloodGroup}</p>
        {fields.filter(([, sh]) => m[sh]).map(([k]) => <p key={k}><b className="capitalize">{k}:</b> {m[k] || "—"}</p>)}
        <p><b>Emergency contacts:</b></p><ul>{s.contacts.map((c) => <li key={c.id}>{c.name} ({c.relationship}) {c.phone}</li>)}</ul>
      </CardContent></Card>
    </div></div>;
}
