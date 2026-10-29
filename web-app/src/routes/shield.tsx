import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useApp, fmt } from "@/lib/store";
import { seo } from "@/lib/seo";
import { PageHeader } from "@/components/AppShell";
import { useNow } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/shield")({
  head: () => seo("Safety Shield", "Periodic check-ins with missed check-in escalation and discreet emergency mode."),
  component: Shield,
});

function Shield() {
  const s = useApp();
  const now = useNow();
  const sh = s.shield;
  const left = sh.nextDue ? sh.nextDue - now : null;
  const overdue = left !== null && left < 0;
  const start = () => { s.set({ shield: { ...sh, active: true, nextDue: Date.now() + sh.intervalMin * 60000 } }); toast.success("Safety Shield active"); };
  const stop = () => { s.set({ shield: { ...sh, active: false, nextDue: null } }); toast("Safety Shield stopped"); };
  const mm = (ms: number) => `${Math.floor(Math.abs(ms) / 60000)}:${String(Math.floor((Math.abs(ms) % 60000) / 1000)).padStart(2, "0")}`;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Safety Shield" desc="If you miss a check-in, a 1-minute grace period starts, then your contacts are alerted." />
      <Card className={overdue ? "ring-2 ring-destructive" : ""}>
        <CardContent className="space-y-6 p-6 text-center">
          <div className="text-sm text-muted-foreground">{sh.active ? (overdue ? "CHECK-IN OVERDUE — escalation in" : "Next check-in in") : "Monitoring is off"}</div>
          <div className={`font-display text-6xl font-extrabold tabular-nums ${overdue ? "text-destructive" : ""}`} aria-live="polite">{left !== null ? (overdue ? mm(60000 + left) : mm(left)) : "--:--"}</div>
          <div className="flex flex-wrap justify-center gap-2">
            {sh.active ? <><Button size="lg" onClick={() => { s.checkIn(); toast.success("Checked in"); }}>I'm safe — check in</Button><Button size="lg" variant="outline" onClick={stop}>Stop monitoring</Button></> : <Button size="lg" onClick={start}>Start monitoring</Button>}
            <Button size="lg" variant="destructive" onClick={() => window.dispatchEvent(new CustomEvent("wb-sos", { detail: "button" }))}>Manual SOS</Button>
          </div>
        </CardContent>
      </Card>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Check-in interval</Label>
              <Select value={String(sh.intervalMin)} onValueChange={(v) => s.set({ shield: { ...sh, intervalMin: +v, nextDue: sh.active ? Date.now() + +v * 60000 : null } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 5, 10, 15, 30, 60].map((m) => <SelectItem key={m} value={String(m)}>{m} minute{m > 1 && "s"}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <label className="flex items-center justify-between text-sm"><span>Discreet emergency mode<br /><span className="text-xs text-muted-foreground">Escalations send silently with no on-screen alarm.</span></span><Switch checked={sh.discreet} onCheckedChange={(v) => s.set({ shield: { ...sh, discreet: v } })} /></label>
            <Button variant="outline" onClick={() => s.set({ decoy: true })}>Open decoy screen now</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Check-in history</CardTitle></CardHeader>
          <CardContent><ul className="max-h-64 divide-y overflow-y-auto text-sm">{[...s.checkins].reverse().map((c) => <li key={c.t} className="flex justify-between py-2"><span className={c.ok ? "text-success" : "text-destructive"}>{c.ok ? "Checked in" : "Missed"}</span><span className="text-muted-foreground">{fmt(c.t)}</span></li>)}</ul></CardContent>
        </Card>
      </div>
    </div>
  );
}
