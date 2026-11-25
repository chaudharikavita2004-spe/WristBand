
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useSyncExternalStore } from "react";
import { apiRequest } from "@/lib/api";
import { supabase } from "@/lib/supabase";

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


export type DeviceKind =
  | "esp32"
  | "arduino"
  | "fitness-band"
  | "generic-ble"
  | "demo";

export type DeviceProtocol =
  | "ble-heart-rate"
  | "ble-custom"
  | "bluetooth-classic"
  | "demo";

export interface Device {
  id: string;
  name: string;
  source: Source;
  status: "connected" | "disconnected";
  battery: number | null;
  authorized: boolean;
  lastSeen: number;

  // Hardware identification
  deviceType?: DeviceKind;
  protocol?: DeviceProtocol;
  manufacturer?: string;

  // Supported sensor capabilities
  heartRateSupported?: boolean;
  batterySupported?: boolean;
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

type RemoteSOSResponse = {
  event: {
    id: string;
    trigger_type: Incident["trigger"];
    status: string;
    latitude: number | null;
    longitude: number | null;
    created_at: string;
  };
  alerts: {
    attempted: number;
    sent: number;
    message: string;
  };
};

type RemoteSOSStatus = {
  status: string;
};

const ACTIVE_SOS_STATUSES = [
  "initiated",
  "pending_synchronization",
  "alert_sent",
  "acknowledged",
  "delivery_failed",
];

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
  shield: {
    active: boolean;
    intervalMin: number;
    nextDue: number | null;
    discreet: boolean;
  };
  location: {
    lat: number;
    lng: number;
    acc: number;
    t: number;
    source: Source;
  } | null;
  liveLocationSharing: boolean;
  adminUnlocked: boolean;

  set: (p: Partial<State>) => void;

  addNotif: (
    n: Omit<Notif, "id" | "t" | "read" | "delivery"> & {
      delivery?: DeliveryState;
    },
  ) => void;

  addReading: (r: Reading) => void;

  triggerSOS: (
    trigger: Incident["trigger"],
    silent?: boolean,
  ) => Incident;

  triggerSOSRemote: (
    trigger: Incident["trigger"],
    silent?: boolean,
  ) => Promise<{
    incident: Incident;
    alerts: {
      attempted: number;
      sent: number;
      message: string;
    };
  }>;

  cancelSOSRemote: (
    id: string,
    pin: string,
  ) => Promise<"active" | "cancelled">;

  resolveIncident: (
    id: string,
    status?: "resolved" | "cancelled",
  ) => void;

  syncQueue: () => number;
  checkIn: () => void;
  resetAll: () => void;
}

// Demo history must be identical in SSR, the browser, and resets.
const now = Date.parse("2026-10-28T03:20:00Z");
const H = 3600_000;

const demoContacts: Contact[] = [
  {
    id: "c1",
    name: "Priya Sharma",
    relationship: "Sister",
    phone: "+91 98765 43210",
    email: "priya@example.com",
    priority: 1,
    shareLocation: true,
    shareMedical: true,
    verified: true,
    guardianAccess: true,
  },
  {
    id: "c2",
    name: "Anita Verma",
    relationship: "Friend",
    phone: "+91 91234 56780",
    email: "anita@example.com",
    priority: 2,
    shareLocation: true,
    shareMedical: false,
    verified: false,
    guardianAccess: false,
  },
];

const initial = {
  lang: "en" as const,
  theme: "light" as const,
  highContrast: false,
  decoy: false,
  demoMode: true,
  profile: {
    name: "Kavita",
    email: "kavita@example.com",
    phone: "+91 90000 00000",
    city: "New Delhi",
  },
  duressPin: "9111",
  unlockPin: "1234",
  sosCountdown: 5,
  sosSound: true,
  shakeEnabled: false,
  shakeSensitivity: 18,
  consent: {
    location: true,
    medical: true,
    guardian: true,
  },
  pulseLow: 50,
  pulseHigh: 120,
  contacts: demoContacts,
  devices: [] as Device[],
  readings: [] as Reading[],
  incidents: [
    {
      id: "i1",
      t: now - 72 * H,
      trigger: "button",
      lat: 28.6139,
      lng: 77.209,
      status: "resolved",
      resolvedAt: now - 72 * H + 4 * 60_000,
      synced: true,
      silent: false,
    },
    {
      id: "i2",
      t: now - 30 * H,
      trigger: "checkin",
      lat: 28.62,
      lng: 77.21,
      status: "resolved",
      resolvedAt: now - 30 * H + 9 * 60_000,
      synced: true,
      silent: false,
    },
  ] as Incident[],
  notifs: [
    {
      id: "n1",
      t: now - 2 * H,
      category: "arrival",
      title: "Arrived safely",
      body: "Journey to Office completed (demo).",
      read: false,
      delivery: "delivered",
      to: "Priya Sharma",
    },
    {
      id: "n2",
      t: now - 5 * H,
      category: "zone",
      title: "Left Safe Zone: Home",
      body: "Exited geofence (demo).",
      read: true,
      delivery: "acknowledged",
      to: "Priya Sharma",
    },
    {
      id: "n3",
      t: now - 30 * H,
      category: "checkin",
      title: "Missed check-in",
      body: "Escalated to contacts (demo).",
      read: true,
      delivery: "failed",
      to: "Anita Verma",
    },
  ] as Notif[],
  zones: [
    {
      id: "z1",
      name: "Home",
      kind: "home",
      lat: 28.6139,
      lng: 77.209,
      radius: 300,
    },
    {
      id: "z2",
      name: "Office",
      kind: "work",
      lat: 28.6304,
      lng: 77.2177,
      radius: 250,
    },
  ] as Zone[],
  journeys: [
    {
      id: "j1",
      origin: "Home",
      destination: "Office",
      destLat: 28.6304,
      destLng: 77.2177,
      eta: 25,
      startedAt: now - 3 * H,
      endedAt: now - 2 * H,
      status: "arrived",
      deviations: 0,
    },
  ] as Journey[],
  evidence: [] as Evidence[],
  riskLogs: Array.from({ length: 12 }, (_, i) => ({
    t: now - (12 - i) * 2 * H,
    score: 15 + ((i * 7) % 25),
  })),
  checkins: [
    { t: now - 30 * H, ok: false },
    { t: now - 20 * H, ok: true },
    { t: now - 10 * H, ok: true },
  ],
  medical: {
    bloodGroup: "B+",
    allergies: "Penicillin",
    conditions: "",
    medications: "",
    notes: "",
    showAllergies: true,
    showConditions: true,
    showMedications: false,
    showNotes: false,
  },
  shield: {
    active: false,
    intervalMin: 15,
    nextDue: null,
    discreet: false,
  },
  location: null,
  liveLocationSharing: false,
  adminUnlocked: false,
};

export const useApp = create<State>()(
  persist(
    (set, get) => ({
      ...initial,

      set: (p) => set(p),

      addNotif: (n) => {
        const online =
          typeof navigator === "undefined" ? true : navigator.onLine;

        const notif: Notif = {
          id: uid(),
          t: Date.now(),
          read: false,
          delivery: n.delivery ?? (online ? "sent" : "queued"),
          ...n,
        };

        set({
          notifs: [notif, ...get().notifs].slice(0, 300),
        });

        if (notif.delivery === "sent") {
          setTimeout(() => {
            set({
              notifs: get().notifs.map((x) =>
                x.id === notif.id && x.delivery === "sent"
                  ? { ...x, delivery: "delivered" }
                  : x,
              ),
            });
          }, 1500);
        }
      },

      addReading: (r) =>
        set({
          readings: [...get().readings, r].slice(-600),
        }),

      // Demo Mode: local simulation only.
      triggerSOS: (trigger, silent = false) => {
        if (!get().demoMode) {
          throw new Error(
            "Real SOS must use triggerSOSRemote().",
          );
        }

        const loc = get().location;

        const inc: Incident = {
          id: uid(),
          t: Date.now(),
          trigger,
          lat: loc?.lat ?? null,
          lng: loc?.lng ?? null,
          status: "active",
          synced: true,
          silent,
        };

        set({
          incidents: [inc, ...get().incidents],
        });

        get().addNotif({
          category: "emergency",
          title: "Demo SOS recorded",
          body: `${trigger.toUpperCase()} trigger (demo simulation).`,
          delivery: "acknowledged",
        });

        return inc;
      },

      // Real Mode: send SOS to the authenticated backend.
      triggerSOSRemote: async (trigger, silent = false) => {
        if (get().demoMode) {
          throw new Error(
            "Switch off Demo Mode before sending a real SOS.",
          );
        }

        if (
          typeof navigator !== "undefined" &&
          !navigator.onLine
        ) {
          throw new Error(
            "You are offline. SOS could not be sent. Call 112 directly if you need emergency help.",
          );
        }

        const { data, error } =
          await supabase.auth.getSession();

        if (error) throw error;

        const accessToken = data.session?.access_token;

        if (!accessToken) {
          throw new Error(
            "Your session has expired. Please log in again.",
          );
        }

        const loc = get().location;

        const response = await apiRequest<RemoteSOSResponse>(
          "/api/sos",
          accessToken,
          {
            method: "POST",
            body: JSON.stringify({
              trigger,
              ...(loc
                ? {
                    lat: loc.lat,
                    lng: loc.lng,
                    accuracy_m: loc.acc,
                  }
                : {}),
              client_event_id:
                typeof crypto !== "undefined" &&
                "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : `${Date.now()}-${uid()}`,
            }),
          },
        );

        const event = response.event;

        const incident: Incident = {
          id: event.id,
          t: Date.parse(event.created_at) || Date.now(),
          trigger: event.trigger_type,
          lat: event.latitude,
          lng: event.longitude,
          status: ACTIVE_SOS_STATUSES.includes(event.status)
            ? "active"
            : event.status === "cancelled"
              ? "cancelled"
              : "resolved",
          synced: true,
          silent,
        };

        set({
          incidents: [
            incident,
            ...get().incidents.filter(
              (i) => i.id !== incident.id,
            ),
          ],
        });

        get().addNotif({
          category: "emergency",
          title:
            response.alerts.sent > 0
              ? `SOS: ${response.alerts.sent} SMS alert(s) sent`
              : "SOS recorded — SMS not confirmed",
          body: response.alerts.message,
          delivery:
            response.alerts.sent > 0
              ? "acknowledged"
              : "failed",
        });

        return {
          incident,
          alerts: response.alerts,
        };
      },

            // Real Mode: verify the PIN and read the actual event status.
      cancelSOSRemote: async (id, pin) => {
        const { data, error } =
          await supabase.auth.getSession();

        if (error) throw error;

        const accessToken = data.session?.access_token;

        if (!accessToken) {
          throw new Error(
            "Your session has expired. Please log in again.",
          );
        }

        await apiRequest<RemoteSOSStatus>(
          `/api/sos/${encodeURIComponent(id)}/cancel`,
          accessToken,
          {
            method: "POST",
            body: JSON.stringify({ pin }),
          },
        );

        // Backend deliberately returns the same response for
        // a normal cancel PIN and a duress PIN.
        // Verify the actual event status from backend history.
        const events = await apiRequest<
          Array<{ id: string; status: string }>
        >("/api/sos", accessToken);

        const event = events.find(
          (item) => item.id === id,
        );

        if (!event) {
          throw new Error(
            "Could not verify the SOS status.",
          );
        }

        // A duress PIN keeps the SOS active.
        if (ACTIVE_SOS_STATUSES.includes(event.status)) {
          return "active";
        }

        // Only an explicitly cancelled event is treated as cancelled.
        if (event.status !== "cancelled") {
          throw new Error(
            `Unexpected SOS status: ${event.status}. Could not confirm cancellation.`,
          );
        }

        set({
          incidents: get().incidents.map((i) =>
            i.id === id
              ? {
                  ...i,
                  status: "cancelled",
                  resolvedAt: Date.now(),
                }
              : i,
          ),
        });

        return "cancelled";
      },

      resolveIncident: (id, status = "resolved") =>
        set({
          incidents: get().incidents.map((i) =>
            i.id === id
              ? {
                  ...i,
                  status,
                  resolvedAt: Date.now(),
                }
              : i,
          ),
        }),

      // Only simulate queue delivery in Demo Mode.
      // Real Mode requires backend confirmation.
      syncQueue: () => {
        if (!get().demoMode) {
          return 0;
        }

        const pend =
          get().incidents.filter((i) => !i.synced).length +
          get().notifs.filter(
            (n) => n.delivery === "queued",
          ).length;

        set({
          incidents: get().incidents.map((i) => ({
            ...i,
            synced: true,
          })),
          notifs: get().notifs.map((n) =>
            n.delivery === "queued"
              ? { ...n, delivery: "delivered" }
              : n,
          ),
        });

        return pend;
      },

      checkIn: () => {
        const s = get().shield;

        set({
          checkins: [
            ...get().checkins,
            { t: Date.now(), ok: true },
          ],
          shield: {
            ...s,
            nextDue: s.active
              ? Date.now() + s.intervalMin * 60_000
              : null,
          },
        });
      },

      resetAll: () => set({ ...initial }),
    }),

    {
      name: "wristband-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,

      partialize: (s) => {
        const {
          adminUnlocked,
          decoy,
          liveLocationSharing,
          ...rest
        } = s;

        void adminUnlocked;
        void decoy;
        void liveLocationSharing;

        return rest;
      },
    },
  ),
);

const subscribeHydration = (notify: () => void) => {
  const unsubscribeStart =
    useApp.persist.onHydrate(notify);

  const unsubscribeFinish =
    useApp.persist.onFinishHydration(notify);

  return () => {
    unsubscribeStart();
    unsubscribeFinish();
  };
};

export function useAppHydrated() {
  return useSyncExternalStore(
    subscribeHydration,
    () => useApp.persist.hasHydrated(),
    () => false,
  );
}

export function computeRisk(
  s: Pick<
    State,
    | "readings"
    | "devices"
    | "shield"
    | "journeys"
    | "incidents"
    | "pulseHigh"
    | "pulseLow"
    | "location"
  >,
) {
  const factors: { label: string; points: number }[] = [];

  const last = s.readings.at(-1);

  if (last && Date.now() - last.t < 60_000) {
    if (last.bpm > s.pulseHigh) {
      factors.push({
        label: "Pulse above advisory threshold",
        points: 25,
      });
    } else if (last.bpm < s.pulseLow) {
      factors.push({
        label: "Pulse below advisory threshold",
        points: 15,
      });
    }
  }

  if (!s.devices.some((d) => d.status === "connected")) {
    factors.push({
      label: "No wristband connected",
      points: 15,
    });
  }

  if (
    s.shield.active &&
    s.shield.nextDue &&
    s.shield.nextDue < Date.now()
  ) {
    factors.push({
      label: "Check-in overdue",
      points: 25,
    });
  }

  const j = s.journeys.find(
    (x) => x.status === "active",
  );

  if (j) {
    factors.push({
      label: "Travel session active",
      points: 5,
    });

    if (j.deviations > 0) {
      factors.push({
        label: "Route deviation detected",
        points: 20,
      });
    }

    if (Date.now() > j.startedAt + j.eta * 60_000) {
      factors.push({
        label: "Past expected arrival",
        points: 15,
      });
    }
  }

  if (s.incidents.some((i) => i.status === "active")) {
    factors.push({
      label: "Active SOS incident",
      points: 40,
    });
  }

  const h = new Date().getHours();

  if (h >= 22 || h < 5) {
    factors.push({
      label: "Late-night hours",
      points: 10,
    });
  }

  if (!s.location) {
    factors.push({
      label: "Location unavailable",
      points: 5,
    });
  }

  return {
    score: Math.min(
      100,
      factors.reduce((a, f) => a + f.points, 0),
    ),
    factors,
  };
}

export function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371000;
  const toR = (x: number) => (x * Math.PI) / 180;

  const dLat = toR(b.lat - a.lat);
  const dLng = toR(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(a.lat)) *
      Math.cos(toR(b.lat)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

export function downloadCSV(
  name: string,
  rows: Record<string, unknown>[],
) {
  if (!rows.length) return;

  const keys = Object.keys(rows[0]!);

  const esc = (v: unknown) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;

  const csv = [
    keys.join(","),
    ...rows.map((r) =>
      keys.map((k) => esc(r[k])).join(","),
    ),
  ].join("\n");

  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([csv], { type: "text/csv" }),
  );
  a.download = name;
  a.click();
}

export const fmt = (t?: number | null) => {
  if (
    !useApp.persist.hasHydrated() ||
    t == null ||
    !Number.isFinite(t)
  ) {
    return "—";
  }

  const date = new Date(t);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString();
};
