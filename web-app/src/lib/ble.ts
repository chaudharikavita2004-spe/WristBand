import { useApp, uid } from "./store";

// Real Web Bluetooth handles kept in memory (cannot be persisted).
type BTDevice = { id: string; name?: string; gatt?: any; addEventListener: (e: string, cb: () => void) => void };
const live = new Map<string, BTDevice>();

export const bleSupported = () => typeof navigator !== "undefined" && "bluetooth" in navigator;

export async function scanAndConnect() {
  const nav = navigator as any;
  if (!nav.bluetooth) throw new Error("Web Bluetooth is not supported in this browser. Use Chrome/Edge on desktop or Android, or Demo Mode.");
  const device: BTDevice = await nav.bluetooth.requestDevice({
    filters: [{ services: ["heart_rate"] }],
    optionalServices: ["battery_service"],
  });
  const st = useApp.getState();
  const server = await device.gatt.connect();
  live.set(device.id, device);
  const entry = { id: device.id, name: device.name || "BLE Heart Rate Sensor", source: "real" as const, status: "connected" as const, battery: null as number | null, authorized: true, lastSeen: Date.now() };
  st.set({ devices: [entry, ...st.devices.filter((d) => d.id !== device.id)] });
  device.addEventListener("gattserverdisconnected", () => {
    const s = useApp.getState();
    s.set({ devices: s.devices.map((d) => (d.id === device.id ? { ...d, status: "disconnected" } : d)) });
    s.addNotif({ category: "device", title: "Wristband disconnected", body: `${entry.name} lost connection.` });
  });
  try {
    const bs = await server.getPrimaryService("battery_service");
    const ch = await bs.getCharacteristic("battery_level");
    const v = await ch.readValue();
    const lvl = v.getUint8(0);
    const s = useApp.getState();
    s.set({ devices: s.devices.map((d) => (d.id === device.id ? { ...d, battery: lvl } : d)) });
  } catch { /* battery optional */ }
  const hr = await server.getPrimaryService("heart_rate");
  const ch = await hr.getCharacteristic("heart_rate_measurement");
  await ch.startNotifications();
  ch.addEventListener("characteristicvaluechanged", (e: any) => {
    const v: DataView = e.target.value;
    const flags = v.getUint8(0);
    const bpm = flags & 1 ? v.getUint16(1, true) : v.getUint8(1);
    useApp.getState().addReading({ t: Date.now(), bpm, source: "real" });
  });
  return entry;
}

export function disconnect(id: string) {
  const d = live.get(id);
  if (d?.gatt?.connected) d.gatt.disconnect();
  const s = useApp.getState();
  s.set({ devices: s.devices.map((x) => (x.id === id ? { ...x, status: "disconnected" } : x)) });
}

export function addDemoDevice() {
  const s = useApp.getState();
  const d = { id: "demo-" + uid(), name: "WristBand Demo Sensor", source: "demo" as const, status: "connected" as const, battery: 87, authorized: true, lastSeen: Date.now() };
  s.set({ devices: [d, ...s.devices] });
  return d;
}
