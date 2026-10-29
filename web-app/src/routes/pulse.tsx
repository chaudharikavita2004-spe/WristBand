import { createFileRoute } from "@tanstack/react-router";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApp, downloadCSV } from "@/lib/store";
import { seo } from "@/lib/seo";
import { PageHeader, DemoBadge } from "@/components/AppShell";
import { Empty } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/pulse")({
  head: () => seo("Pulse Monitoring", "Real-time BPM, advisory thresholds and CSV export from your wristband."),
  component: Pulse,
});

function Pulse() {
  const s = useApp();
  const last = s.readings.at(-1);
  const data = s.readings.slice(-150).map((r) => ({ t: new Date(r.t).toLocaleTimeString(), bpm: r.bpm }));
  const abnormal = s.readings.filter((r) => r.bpm > s.pulseHigh || r.bpm < s.pulseLow).slice(-10).reverse();
  const avg = s.readings.length ? Math.round(s.readings.reduce((a, r) => a + r.bpm, 0) / s.readings.length) : null;
  const isAbn = last && (last.bpm > s.pulseHigh || last.bpm < s.pulseLow);
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Pulse Monitoring" desc="Wellness indicator only — not a medical device and not for diagnosis.">
        <Button variant="outline" onClick={() => downloadCSV("wristband-pulse.csv", s.readings.map((r) => ({ time: new Date(r.t).toISOString(), bpm: r.bpm, source: r.source })))} disabled={!s.readings.length}>Export CSV</Button>
        <Button variant="ghost" onClick={() => s.set({ readings: [] })}>Clear</Button>
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className={isAbn ? "ring-2 ring-destructive" : ""}>
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">Current BPM <DemoBadge show={last?.source === "demo"} /></div>
            <div className="font-display text-6xl font-extrabold" aria-live="polite">{last?.bpm ?? "—"}</div>
            {isAbn && <div className="text-sm font-semibold text-destructive">Outside advisory range</div>}
            <div className="mt-2 text-xs text-muted-foreground">Average {avg ?? "—"} · {s.readings.length} readings</div>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Advisory thresholds</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div><Label htmlFor="lo">Low (BPM)</Label><Input id="lo" type="number" value={s.pulseLow} onChange={(e) => s.set({ pulseLow: +e.target.value })} /></div>
            <div><Label htmlFor="hi">High (BPM)</Label><Input id="hi" type="number" value={s.pulseHigh} onChange={(e) => s.set({ pulseHigh: +e.target.value })} /></div>
            <p className="col-span-2 text-xs text-muted-foreground">Readings outside this range show an alert and raise your safety risk score. They never trigger SOS automatically.</p>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Time series</CardTitle></CardHeader>
        <CardContent className="h-72">
          {data.length ? (
            <ResponsiveContainer><LineChart data={data}><XAxis dataKey="t" minTickGap={40} /><YAxis domain={[40, 170]} width={30} /><Tooltip /><ReferenceLine y={s.pulseHigh} stroke="var(--destructive)" strokeDasharray="4 4" /><ReferenceLine y={s.pulseLow} stroke="var(--warning)" strokeDasharray="4 4" /><Line dataKey="bpm" stroke="var(--chart-1)" dot={false} strokeWidth={2} isAnimationActive={false} /></LineChart></ResponsiveContainer>
          ) : <Empty text="No readings. Pair a real sensor or a demo sensor in Devices." />}
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Abnormal readings</CardTitle></CardHeader>
        <CardContent>
          {abnormal.length ? <ul className="divide-y text-sm">{abnormal.map((r) => <li key={r.t} className="flex justify-between py-2"><span className="font-semibold text-destructive">{r.bpm} BPM {r.source === "demo" && <DemoBadge />}</span><span className="text-muted-foreground">{new Date(r.t).toLocaleString()}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">None recorded.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
