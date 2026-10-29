import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useSyncExternalStore } from "react";

export type Source = "real" | "demo";
export type DeliveryState = "queued" | "sent" | "delivered" | "acknowledged" | "failed";
export type NotifCategory =
  | "emergency"
  | "device"
  | "battery"
  | "checkin"
  | "arrival"
  | "zone";

export interface Contact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  priority: number;
  shareLocation: boolean;
  shareMedical: boolean;
  verified: boolean;
  guardianAccess: boolean;
}
export interface Device {
  id: string;
  name: string;
  source: Source;
  status: "connected" | "disconnected";
  battery: number | null;
  authorized: boolean;
  lastSeen: number;
}
export interface Reading {
  t: number;
  bpm: number;
  source: Source;
}
export interface Incident {
  id: string;
  t: number;
  trigger: "button" | "shake" | "duress" | "checkin" | "deviation";
  lat: number | null;
  lng: number | null;
  status: "active" | "resolved" | "cancelled";
  resolvedAt?: number;
  synced: boolean;
  silent: boolean;
}
export interface Notif {
  id: string;
  t: number;
  category: NotifCategory;
  title: string;
  body: string;
  read: boolean;
  delivery: DeliveryState;
  to?: string;
}
export interface Zone {
  id: string;
  name: string;
  kind: "home" | "work" | "campus";
  lat: number;
  lng: number;
  radius: number;
}
export interface Journey {
  id: string;
  origin: string;
  destination: string;
  destLat: number;
  destLng: number;
  eta: number;
  startedAt: number;
  endedAt?: number;
  status: "active" | "arrived" | "cancelled";
  deviations: number;
}
export interface Evidence {
  id: string;
  name: string;
  type: string;
  size: number;
  description: string;
  t: number;
  dataUrl: string;
}
export interface RiskLog {
  t: number;
  score: number;
}
export interface CheckinLog {
  t: number;
  ok: boolean;
}
export interface Medical {
  bloodGroup: string;
  allergies: string;
  conditions: string;
  medications: string;
  notes: string;
  showAllergies: boolean;
  showConditions: boolean;
  showMedications: boolean;
  showNotes: boolean;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

interface State {
  lang: "en" | "hi";
  theme: "light" | "dark";
  highContrast: boolean;
  decoy: boolean;
  demoMode: boolean;
  profile: { name: string; email: string; phone: string; city: string };
  duressPin: string;
  unlockPin: string;
  sosCountdown: number;
  sosSound: boolean;
  shakeEnabled: boolean;
  shakeSensitivity: number;
  consent: { location: boolean; medical: boolean; guardian: boolean };
  pulseLow: number;
  pulseHigh: number;
  contacts: Contact[];
  devices: Device[];
  readings: Reading[];
  incidents: Incident[];
  notifs: Notif[];
  zones: Zone[];
  journeys: Journey[];
  evidence: Evidence[];
  riskLogs: RiskLog[];
  checkins: CheckinLog[];
  medical: Medical;
  shield: { active: boolean; intervalMin: number; nextDue: number | null; discreet: boolean };
  location: { lat: number; lng: number; acc: number; t: number; source: Source } | null;
  adminUnlocked: boolean;
  set: (p: Partial<State>) => void;
  addNotif: (n: Omit<Notif, "id" | "t" | "read" | "delivery"> & { delivery?: DeliveryState }) => void;
  addReading: (r: Reading) => void;
  triggerSOS: (trigger: Incident["trigger"], silent?: boolean) => Incident;
  resolveIncident: (id: string, status?: "resolved" | "cancelled") => void;
  syncQueue: () => number;
  checkIn: () => void;
  resetAll: () => void;
}

// Demo history must be identical in SSR, the browser, and resets.
const now = Date.parse("2026-10-28T03:20:00Z");
const H = 3600_000;

const demoContacts: Contact[] = [
  { id: "c1", name: "Priya Sharma", relationship: "Sister", phone: "+91 98765 43210", email: "priya@example.com", priority: 1, shareLocation: true, shareMedical: true, verified: true, guardianAccess: true },
  { id: "c2", name: "Anita Verma", relationship: "Friend", phone: "+91 91234 56780", email: "anita@example.com", priority: 2, shareLocation: true, shareMedical: false, verified: false, guardianAccess: false },
];

const initial = {
  lang: "en" as const,
  theme: "light" as const,
  highContrast: false,
  decoy: false,
  demoMode: true,
  profile: { name: "Kavita", email: "kavita@example.com", phone: "+91 90000 00000", city: "New Delhi" },
  duressPin: "9111",
  unlockPin: "1234",
  sosCountdown: 5,
  sosSound: true,
  shakeEnabled: false,
  shakeSensitivity: 18,
  consent: { location: true, medical: true, guardian: true },
  pulseLow: 50,
  pulseHigh: 120,
  contacts: demoContacts,
  devices: [] as Device[],
  readings: [] as Reading[],
  incidents: [
    { id: "i1", t: now - 72 * H, trigger: "button", lat: 28.6139, lng: 77.209, status: "resolved", resolvedAt: now - 72 * H + 4 * 60_000, synced: true, silent: false },
    { id: "i2", t: now - 30 * H, trigger: "checkin", lat: 28.62, lng: 77.21, status: "resolved", resolvedAt: now - 30 * H + 9 * 60_000, synced: true, silent: false },
  ] as Incident[],
  notifs: [
    { id: "n1", t: now - 2 * H, category: "arrival", title: "Arrived safely", body: "Journey to Office completed (demo).", read: false, delivery: "delivered", to: "Priya Sharma" },
    { id: "n2", t: now - 5 * H, category: "zone", title: "Left Safe Zone: Home", body: "Exited geofence (demo).", read: true, delivery: "acknowledged", to: "Priya Sharma" },
    { id: "n3", t: now - 30 * H, category: "checkin", title: "Missed check-in", body: "Escalated to contacts (demo).", read: true, delivery: "failed", to: "Anita Verma" },
  ] as Notif[],
  zones: [
    { id: "z1", name: "Home", kind: "home", lat: 28.6139, lng: 77.209, radius: 300 },
    { id: "z2", name: "Office", kind: "work", lat: 28.6304, lng: 77.2177, radius: 250 },
  ] as Zone[],
  journeys: [
    { id: "j1", origin: "Home", destination: "Office", destLat: 28.6304, destLng: 77.2177, eta: 25, startedAt: now - 3 * H, endedAt: now - 2 * H, status: "arrived", deviations: 0 },
  ] as Journey[],
  evidence: [] as Evidence[],
  riskLogs: Array.from({ length: 12 }, (_, i) => ({ t: now - (12 - i) * 2 * H, score: 15 + ((i * 7) % 25) })),
  checkins: [
    { t: now - 30 * H, ok: false },
    { t: now - 20 * H, ok: true },
    { t: now - 10 * H, ok: true },
  ],
  medical: { bloodGroup: "B+", allergies: "Penicillin", conditions: "", medications: "", notes: "", showAllergies: true, showConditions: true, showMedications: false, showNotes: false },
  shield: { active: false, intervalMin: 15, nextDue: null, discreet: false },
  location: null,
  adminUnlocked: false,
};

export const useApp = create<State>()(
  persist(
    (set, get) => ({
      ...initial,
      set: (p) => set(p),
      addNotif: (n) => {
        const online = typeof navigator === "undefined" ? true : navigator.onLine;
        const notif: Notif = { id: uid(), t: Date.now(), read: false, delivery: n.delivery ?? (online ? "sent" : "queued"), ...n };
        set({ notifs: [notif, ...get().notifs].slice(0, 300) });
        if (notif.delivery === "sent") {
          setTimeout(() => {
            set({ notifs: get().notifs.map((x) => (x.id === notif.id && x.delivery === "sent" ? { ...x, delivery: "delivered" } : x)) });
          }, 1500);
        }
      },
      addReading: (r) => set({ readings: [...get().readings, r].slice(-600) }),
      triggerSOS: (trigger, silent = false) => {
        const loc = get().location;
        const online = typeof navigator === "undefined" ? true : navigator.onLine;
        const inc: Incident = { id: uid(), t: Date.now(), trigger, lat: loc?.lat ?? null, lng: loc?.lng ?? null, status: "active", synced: online, silent };
        set({ incidents: [inc, ...get().incidents] });
        const contacts = [...get().contacts].sort((a, b) => a.priority - b.priority);
        contacts.forEach((c) =>
          get().addNotif({
            category: "emergency",
            title: `SOS alert sent to ${c.name}`,
            body: `${trigger.toUpperCase()} trigger${c.shareLocation && loc ? ` · ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}` : ""}`,
            to: c.name,
          }),
        );
        if (contacts.length === 0)
          get().addNotif({ category: "emergency", title: "SOS logged", body: "No emergency contacts configured.", delivery: "failed" });
        return inc;
      },
      resolveIncident: (id, status = "resolved") =>
        set({ incidents: get().incidents.map((i) => (i.id === id ? { ...i, status, resolvedAt: Date.now() } : i)) }),
      syncQueue: () => {
        const pend = get().incidents.filter((i) => !i.synced).length + get().notifs.filter((n) => n.delivery === "queued").length;
        set({
          incidents: get().incidents.map((i) => ({ ...i, synced: true })),
          notifs: get().notifs.map((n) => (n.delivery === "queued" ? { ...n, delivery: "delivered" } : n)),
        });
        return pend;
      },
      checkIn: () => {
        const s = get().shield;
        set({
          checkins: [...get().checkins, { t: Date.now(), ok: true }],
          shield: { ...s, nextDue: s.active ? Date.now() + s.intervalMin * 60_000 : null },
        });
      },
      resetAll: () => set({ ...initial }),
    }),
    {
      name: "wristband-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => {
        const { adminUnlocked, decoy, ...rest } = s;
        void adminUnlocked; void decoy;
        return rest;
      },
    },
  ),
);

const subscribeHydration = (notify: () => void) => {
  const unsubscribeStart = useApp.persist.onHydrate(notify);
  const unsubscribeFinish = useApp.persist.onFinishHydration(notify);
  return () => { unsubscribeStart(); unsubscribeFinish(); };
};

export function useAppHydrated() {
  return useSyncExternalStore(subscribeHydration, () => useApp.persist.hasHydrated(), () => false);
}

export function computeRisk(s: Pick<State, "readings" | "devices" | "shield" | "journeys" | "incidents" | "pulseHigh" | "pulseLow" | "location">) {
  const factors: { label: string; points: number }[] = [];
  const last = s.readings.at(-1);
  if (last && Date.now() - last.t < 60_000) {
    if (last.bpm > s.pulseHigh) factors.push({ label: "Pulse above advisory threshold", points: 25 });
    else if (last.bpm < s.pulseLow) factors.push({ label: "Pulse below advisory threshold", points: 15 });
  }
  if (!s.devices.some((d) => d.status === "connected")) factors.push({ label: "No wristband connected", points: 15 });
  if (s.shield.active && s.shield.nextDue && s.shield.nextDue < Date.now()) factors.push({ label: "Check-in overdue", points: 25 });
  const j = s.journeys.find((x) => x.status === "active");
  if (j) {
    factors.push({ label: "Travel session active", points: 5 });
    if (j.deviations > 0) factors.push({ label: "Route deviation detected", points: 20 });
    if (Date.now() > j.startedAt + j.eta * 60_000) factors.push({ label: "Past expected arrival", points: 15 });
  }
  if (s.incidents.some((i) => i.status === "active")) factors.push({ label: "Active SOS incident", points: 40 });
  const h = new Date().getHours();
  if (h >= 22 || h < 5) factors.push({ label: "Late-night hours", points: 10 });
  if (!s.location) factors.push({ label: "Location unavailable", points: 5 });
  return { score: Math.min(100, factors.reduce((a, f) => a + f.points, 0)), factors };
}

export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000, toR = (x: number) => (x * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function downloadCSV(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]!);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
}

export const fmt = (t?: number | null) => {
  if (!useApp.persist.hasHydrated() || t == null || !Number.isFinite(t)) return "—";
  const date = new Date(t);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
};
