import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { useApp, downloadCSV, fmt } from "@/lib/store";
import { seo } from "@/lib/seo";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/analytics")({
  head: () => seo("Analytics & Reports", "SOS history, response times, pulse trends, check-in adherence and delivery stats."),
  component: Analytics,
});

const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Analytics() {
  const s = useApp();
  const resolved = s.incidents.filter((i) => i.resolvedAt);
  const avgResp = resolved.length ? Math.round(resolved.reduce((a, i) => a + (i.resolvedAt! - i.t), 0) / resolved.length / 60000) : 0;
  const adherence = s.checkins.length ? Math.round((s.checkins.filter((c) => c.ok).length / s.checkins.length) * 100) : 100;
  const delivery = ["queued", "sent", "delivered", "acknowledged", "failed"].map((d) => ({ name: d, value: s.notifs.filter((n) => n.delivery === d).length })).filter((d) => d.value);
  const pulseByMin: Record<string, number[]> = {};
  s.readings.forEach((r) => { const k = new Date(r.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); (pulseByMin[k] ??= []).push(r.bpm); });
  const pulseTrend = Object.entries(pulseByMin).slice(-30).map(([t, v]) => ({ t, avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length) }));
  const risk = s.riskLogs.slice(-40).map((r) => ({ t: new Date(r.t).toLocaleString([], { day: "2-digit", hour: "2-digit" }), score: r.score }));
  const respData = resolved.slice(0, 10).map((i) => ({ t: new Date(i.t).toLocaleDateString(), min: +((i.resolvedAt! - i.t) / 60000).toFixed(1) }));

  const exportAll = () => downloadCSV("wristband-incidents.csv", s.incidents.map((i) => ({ time: new Date(i.t).toISOString(), trigger: i.trigger, status: i.status, lat: i.lat, lng: i.lng, resolved: i.resolvedAt ? new Date(i.resolvedAt).toISOString() : "", synced: i.synced })));

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Analytics & Reports" desc="Built from your local WristBand history.">
        <Button variant="outline" onClick={exportAll}>Incidents CSV</Button>
        <Button variant="outline" onClick={() => downloadCSV("wristband-risk.csv", s.riskLogs.map((r) => ({ time: new Date(r.t).toISOString(), score: r.score })))}>Risk log CSV</Button>
        <Button variant="outline" onClick={() => downloadCSV("wristband-travel.csv", s.journeys.map((j) => ({ origin: j.origin, destination: j.destination, started: new Date(j.startedAt).toISOString(), status: j.status, deviations: j.deviations })))}>Travel CSV</Button>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[["SOS incidents", s.incidents.length], ["Avg resolution", `${avgResp} min`], ["Check-in adherence", `${adherence}%`], ["Journeys", s.journeys.length]].map(([l, v]) => (
          <Card key={l as string}><CardContent className="p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="font-display text-3xl font-bold">{v}</div></CardContent></Card>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Chart title="Resolution response times (min)">{respData.length ? <BarChart data={respData}><XAxis dataKey="t" /><YAxis width={30} /><Tooltip /><Bar dataKey="min" fill="var(--chart-2)" radius={4} /></BarChart> : null}</Chart>
        <Chart title="Notification delivery breakdown">{delivery.length ? <PieChart><Pie data={delivery} dataKey="value" nameKey="name" outerRadius={80} label>{delivery.map((_, i) => <Cell key={i} fill={colors[i % 5]} />)}</Pie><Legend /><Tooltip /></PieChart> : null}</Chart>
        <Chart title="Pulse trend (per-minute average)">{pulseTrend.length ? <LineChart data={pulseTrend}><XAxis dataKey="t" /><YAxis width={30} domain={[40, 160]} /><Tooltip /><Line dataKey="avg" stroke="var(--chart-1)" dot={false} /></LineChart> : null}</Chart>
        <Chart title="Risk score log">{risk.length ? <LineChart data={risk}><XAxis dataKey="t" /><YAxis width={30} domain={[0, 100]} /><Tooltip /><Line dataKey="score" stroke="var(--chart-2)" dot={false} /></LineChart> : null}</Chart>
      </div>
      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">SOS incident history</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-2">Time</th><th>Trigger</th><th>Status</th><th>Location</th><th>Synced</th></tr></thead>
            <tbody>{s.incidents.map((i) => <tr key={i.id} className="border-t"><td className="py-2">{fmt(i.t)}</td><td>{i.trigger}{i.silent && " (silent)"}</td><td>{i.status}</td><td>{i.lat ? `${i.lat.toFixed(4)}, ${i.lng?.toFixed(4)}` : "—"}</td><td>{i.synced ? "Yes" : "Queued"}</td></tr>)}</tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Chart({ title, children }: { title: string; children: React.ReactElement | null }) {
  return (
    <Card><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="h-64">{children ? <ResponsiveContainer>{children}</ResponsiveContainer> : <p className="text-sm text-muted-foreground">No data yet.</p>}</CardContent>
    </Card>
  );
}
