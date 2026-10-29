import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  LayoutDashboard, Bluetooth, HeartPulse, Users, ShieldCheck, Map, BarChart3, FolderLock,
  IdCard, Bell, Settings, Eye, ServerCog, Moon, Sun, Contrast, Languages, EyeOff, Menu, X, WifiOff,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { useApp, useAppHydrated } from "@/lib/store";
import { useT, type TKey } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { SOSButton } from "./SOS";
import { Decoy } from "./Decoy";

const nav: { to: string; k: TKey; icon: typeof Bell }[] = [
  { to: "/", k: "dashboard", icon: LayoutDashboard },
  { to: "/devices", k: "devices", icon: Bluetooth },
  { to: "/pulse", k: "pulse", icon: HeartPulse },
  { to: "/contacts", k: "contacts", icon: Users },
  { to: "/shield", k: "shield", icon: ShieldCheck },
  { to: "/travel", k: "travel", icon: Map },
  { to: "/analytics", k: "analytics", icon: BarChart3 },
  { to: "/vault", k: "vault", icon: FolderLock },
  { to: "/medical", k: "medical", icon: IdCard },
  { to: "/notifications", k: "notifications", icon: Bell },
  { to: "/settings", k: "settings", icon: Settings },
  { to: "/guardian", k: "guardian", icon: Eye },
  { to: "/admin", k: "admin", icon: ServerCog },
];

function useBackground() {
  const s = useApp();
  const lastShake = useRef(0);
  const escalated = useRef<number | null>(null);

  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("dark", s.theme === "dark");
    el.classList.toggle("hc", s.highContrast);
    el.lang = s.lang;
  }, [s.theme, s.highContrast, s.lang]);

  // Geolocation
  useEffect(() => {
    if (!s.consent.location || !("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (p) => useApp.getState().set({ location: { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, t: Date.now(), source: "real" } }),
      () => { if (!useApp.getState().location) useApp.getState().set({ location: { lat: 28.6139, lng: 77.209, acc: 50, t: Date.now(), source: "demo" } }); },
      { enableHighAccuracy: true },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [s.consent.location]);

  // Demo sensor simulation
  const demoConnected = s.devices.some((d) => d.source === "demo" && d.status === "connected");
  useEffect(() => {
    if (!demoConnected) return;
    let base = 78;
    const id = setInterval(() => {
      base += (Math.random() - 0.5) * 4;
      base = Math.max(62, Math.min(100, base));
      const spike = Math.random() < 0.02 ? 45 : 0;
      useApp.getState().addReading({ t: Date.now(), bpm: Math.round(base + spike), source: "demo" });
    }, 2000);
    const bid = setInterval(() => {
      const st = useApp.getState();
      st.set({ devices: st.devices.map((d) => d.source === "demo" && d.battery ? { ...d, battery: Math.max(5, d.battery - 1), lastSeen: Date.now() } : d) });
    }, 60_000);
    return () => { clearInterval(id); clearInterval(bid); };
  }, [demoConnected]);

  // Abnormal pulse + low battery alerts
  const last = s.readings.at(-1);
  const lastAlert = useRef(0);
  useEffect(() => {
    if (!last) return;
    if ((last.bpm > s.pulseHigh || last.bpm < s.pulseLow) && Date.now() - lastAlert.current > 60_000) {
      lastAlert.current = Date.now();
      toast.warning(`Pulse advisory: ${last.bpm} BPM${last.source === "demo" ? " (DEMO)" : ""}`);
    }
  }, [last, s.pulseHigh, s.pulseLow]);

  // Shake detection
  useEffect(() => {
    if (!s.shakeEnabled) return;
    const h = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const mag = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2);
      if (mag > 9.8 + (40 - s.shakeSensitivity) && Date.now() - lastShake.current > 10_000) {
        lastShake.current = Date.now();
        window.dispatchEvent(new CustomEvent("wb-sos", { detail: "shake" }));
      }
    };
    window.addEventListener("devicemotion", h);
    return () => window.removeEventListener("devicemotion", h);
  }, [s.shakeEnabled, s.shakeSensitivity]);

  // Offline queue sync
  useEffect(() => {
    const on = () => { const n = useApp.getState().syncQueue(); if (n) toast.success(`Back online — synced ${n} queued item(s)`); };
    window.addEventListener("online", on);
    on();
    return () => window.removeEventListener("online", on);
  }, []);

  // Check-in escalation
  useEffect(() => {
    const id = setInterval(() => {
      const st = useApp.getState();
      const due = st.shield.nextDue;
      if (st.shield.active && due && Date.now() > due + 60_000 && escalated.current !== due) {
        escalated.current = due;
        st.set({ checkins: [...st.checkins, { t: Date.now(), ok: false }] });
        st.addNotif({ category: "checkin", title: "Missed check-in — escalating", body: "No response within 1 minute grace period." });
        st.triggerSOS("checkin", st.shield.discreet);
        toast.error("Missed check-in. Emergency contacts alerted.");
      }
      // risk log every 10 min
      const rl = st.riskLogs.at(-1);
      if (!rl || Date.now() - rl.t > 600_000) {
        import("@/lib/store").then(({ computeRisk }) => {
          const g = useApp.getState();
          g.set({ riskLogs: [...g.riskLogs, { t: Date.now(), score: computeRisk(g).score }].slice(-500) });
        });
      }
    }, 5000);
    return () => clearInterval(id);
  }, []);
}

function Background() {
  useBackground();
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useAppHydrated();
  useEffect(() => { void useApp.persist.rehydrate(); }, []);
  const t = useT();
  const s = useApp();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const u = () => setOnline(navigator.onLine);
    u();
    window.addEventListener("online", u); window.addEventListener("offline", u);
    return () => { window.removeEventListener("online", u); window.removeEventListener("offline", u); };
  }, []);
  useEffect(() => setOpen(false), [loc.pathname]);
  const unread = s.notifs.filter((n) => !n.read).length;

  if (s.decoy) return <Decoy />;

  return (
    <div className="flex min-h-screen">
      {hydrated && <Background />}
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-card focus:p-2">Skip to content</a>
      <aside className={`no-print fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-2 px-4 py-5">
          <img src={logo} alt="" width={36} height={36} className="h-9 w-9" />
          <span className="font-display text-lg font-bold">WristBand</span>
          <button className="ml-auto lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
        </div>
        <nav className="space-y-0.5 px-2 pb-6" aria-label="Main">
          {nav.map((n) => {
            const active = n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" : "hover:bg-sidebar-accent/60"}`}>
                <n.icon className="h-4 w-4" />
                <span className="flex-1">{t(n.k)}</span>
                {n.k === "notifications" && unread > 0 && <span className="rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">{unread}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-foreground/40 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex items-center gap-2 border-b bg-card/90 px-3 py-2 backdrop-blur">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          {s.demoMode && <span className="rounded bg-warning/20 px-2 py-0.5 text-xs font-bold text-foreground ring-1 ring-warning">{t("demo")}</span>}
          {!online && <span className="flex items-center gap-1 rounded bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive"><WifiOff className="h-3 w-3" /> Offline — SOS queued locally</span>}
          <div className="ml-auto flex items-center gap-1">
            <Button size="icon" variant="ghost" aria-label="Toggle language" title="English / हिन्दी" onClick={() => s.set({ lang: s.lang === "en" ? "hi" : "en" })}><Languages className="h-4 w-4" /><span className="sr-only">{s.lang}</span></Button>
            <Button size="icon" variant="ghost" aria-label="Toggle theme" onClick={() => s.set({ theme: s.theme === "dark" ? "light" : "dark" })}>{s.theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
            <Button size="icon" variant={s.highContrast ? "secondary" : "ghost"} aria-label="Toggle high contrast" onClick={() => s.set({ highContrast: !s.highContrast })}><Contrast className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" aria-label="Discreet decoy mode" title="Decoy mode" onClick={() => s.set({ decoy: true })}><EyeOff className="h-4 w-4" /></Button>
            <SOSButton compact />
          </div>
        </header>
        <main id="main" className="flex-1 p-4 md:p-6" aria-busy={!hydrated}>
          {hydrated ? children : <div role="status" aria-label="Loading saved safety data" className="min-h-[600px] animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, desc, children }: { title: string; desc?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function DemoBadge({ show = true }: { show?: boolean }) {
  if (!show) return null;
  return <span className="rounded bg-warning/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-warning">Demo</span>;
}
