import { createFileRoute, Link } from "@tanstack/react-router";
import { useNow, Empty } from "@/components/common";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Battery, Bluetooth, HeartPulse, MapPin, Timer } from "lucide-react";
import { useApp, computeRisk, fmt } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { seo } from "@/lib/seo";
import { PageHeader, DemoBadge } from "@/components/AppShell";
import { SOSButton } from "@/components/SOS";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => seo("WristBand Safety Dashboard", "Live overview of your WristBand: SOS, pulse, risk score, check-ins and travel."),
  component: Dashboard,
});

function Dashboard() {
  const t = useT();
  const s = useApp();
  const now = useNow();
  const dev = s.devices.find((d) => d.status === "connected");
  const last = s.readings.at(-1);
  const risk = computeRisk(s);
  const active = s.incidents.find((i) => i.status === "active");
  const journey = s.journeys.find((j) => j.status === "active");
  const due = s.shield.nextDue ? Math.max(0, s.shield.nextDue - now) : null;
  const pulse = s.readings.slice(-60).map((r) => ({ t: new Date(r.t).toLocaleTimeString(), bpm: r.bpm }));
  const activity = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now - (6 - i) * 86400_000);
    const k = day.toDateString();
    return { d: day.toLocaleDateString(undefined, { weekday: "short" }), events: s.notifs.filter((n) => new Date(n.t).toDateString() === k).length };
  });
  const riskColor = risk.score >= 60 ? "text-destructive" : risk.score >= 30 ? "text-warning" : "text-success";

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title={t("safetyDashboard")} desc={`Hello ${s.profile.name}. Stay connected, stay safe.`} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:row-span-2">
          <CardHeader><CardTitle>Emergency</CardTitle></CardHeader>
          <CardContent className="space-y-6 text-center">
            <SOSButton />
            <p className="text-xs text-muted-foreground">{s.sosCountdown}s countdown · cancel with PIN · shake-to-SOS {s.shakeEnabled ? "on" : "off"}</p>
            <div className={`rounded-lg p-3 ${active ? "bg-destructive/15 text-destructive" : "bg-success/15"}`}>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("status")}</div>
              <div className="font-display text-xl font-bold">{active ? `${t("alert")} — SOS active` : s.shield.active ? "Shield monitoring" : t("safe")}</div>
            </div>
            <div className="text-left">
              <div className="mb-1 flex items-baseline justify-between"><span className="text-sm font-semibold">{t("riskScore")}</span><span className={`font-display text-3xl font-bold ${riskColor}`}>{risk.score}</span></div>
              <div className="h-2 rounded bg-muted"><div className="h-full rounded bg-gradient-to-r from-success via-warning to-destructive" style={{ width: `${risk.score}%` }} /></div>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {risk.factors.length ? risk.factors.map((f) => <li key={f.label} className="flex justify-between"><span>{f.label}</span><span>+{f.points}</span></li>) : <li>No risk factors detected.</li>}
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          <Tile icon={Bluetooth} label="Wristband" value={dev ? t("connected") : t("notConnected")} sub={dev ? dev.name : <Link to="/devices" className="text-primary underline">Connect a device</Link>} demo={dev?.source === "demo"} />
          <Tile icon={HeartPulse} label="Live BPM" value={last && now - last.t < 15000 ? `${last.bpm}` : "—"} sub={last ? `Updated ${new Date(last.t).toLocaleTimeString()}` : "No readings yet"} demo={last?.source === "demo"} />
          <Tile icon={Timer} label="Next check-in" value={due !== null ? `${Math.floor(due / 60000)}:${String(Math.floor((due % 60000) / 1000)).padStart(2, "0")}` : "Off"} sub={s.shield.active ? <Button size="sm" variant="outline" onClick={s.checkIn}>{t("checkIn")}</Button> : <Link to="/shield" className="text-primary underline">Start Safety Shield</Link>} />
          <Tile icon={MapPin} label={t("travelSession")} value={journey ? `→ ${journey.destination}` : "None"} sub={journey ? `ETA ${new Date(journey.startedAt + journey.eta * 60000).toLocaleTimeString()}` : <Link to="/travel" className="text-primary underline">Start a journey</Link>} />
          <Tile icon={Battery} label={t("battery")} value={dev?.battery != null ? `${dev.battery}%` : "—"} sub={dev?.battery != null && dev.battery < 20 ? "Low battery" : "Device battery"} demo={dev?.source === "demo"} />
          <Tile icon={MapPin} label="Location" value={s.location ? `${s.location.lat.toFixed(3)}, ${s.location.lng.toFixed(3)}` : "—"} sub={s.location ? `±${Math.round(s.location.acc)}m` : "Permission needed"} demo={s.location?.source === "demo"} />
        </div>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Pulse (last 60 readings)</CardTitle></CardHeader>
          <CardContent className="h-48">
            {pulse.length ? (
              <ResponsiveContainer><AreaChart data={pulse}><XAxis dataKey="t" hide /><YAxis domain={[40, 160]} width={30} /><Tooltip /><Area dataKey="bpm" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.2} isAnimationActive={false} /></AreaChart></ResponsiveContainer>
            ) : <Empty text="Connect a wristband or enable a demo sensor to see pulse data." />}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Activity (events per day)</CardTitle></CardHeader>
          <CardContent className="h-48"><ResponsiveContainer><BarChart data={activity}><XAxis dataKey="d" /><YAxis allowDecimals={false} width={24} /><Tooltip /><Bar dataKey="events" fill="var(--chart-3)" radius={4} /></BarChart></ResponsiveContainer></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("recent")}</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {s.notifs.slice(0, 6).map((n) => (
                <li key={n.id} className="flex justify-between gap-2 py-2"><span className="font-medium">{n.title}</span><span className="shrink-0 text-xs text-muted-foreground">{fmt(n.t)}</span></li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Tile({ icon: Icon, label, value, sub, demo }: { icon: typeof Battery; label: string; value: React.ReactNode; sub?: React.ReactNode; demo?: boolean }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="rounded-lg bg-accent p-2 text-accent-foreground"><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">{label} <DemoBadge show={!!demo} /></div>
          <div className="truncate font-display text-xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{sub}</div>
        </div>
      </CardContent>
    </Card>
  );
}
