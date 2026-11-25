
import { useApp, uid } from "./store";
import type { DeviceKind } from "./store";

// Real Web Bluetooth handles are kept in memory (they cannot be persisted).
type BTDevice = {
  id: string;
  name?: string;
  gatt?: any;
  addEventListener: (event: string, callback: (event?: any) => void) => void;
};

const live = new Map<string, BTDevice>();

export const bleSupported = () =>
  typeof navigator !== "undefined" && "bluetooth" in navigator;

function detectDeviceType(name = ""): DeviceKind {
  const value = name.toLowerCase();

  if (value.includes("esp32")) return "esp32";
  if (value.includes("arduino")) return "arduino";

  if (
    value.includes("fitbit") ||
    value.includes("mi band") ||
    value.includes("xiaomi") ||
    value.includes("fitness") ||
    value.includes("smart band")
  ) {
    return "fitness-band";
  }

  return "generic-ble";
}

export async function scanAndConnect() {
  const nav = navigator as any;

  if (!nav.bluetooth) {
    throw new Error(
      "Web Bluetooth is not supported in this browser. Use Chrome or Edge on desktop or Android, or Demo Mode."
    );
  }

  // Show BLE devices instead of filtering only for Heart Rate devices.
  const device: BTDevice = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: ["heart_rate", "battery_service"],
  });

  if (!device.gatt) {
    throw new Error("This Bluetooth device does not support GATT connections.");
  }

  let server: any;

  try {
    server = await device.gatt.connect();

    // A compatible device must expose the standard Heart Rate service.
    let hrService: any;
    let hrCharacteristic: any;

    try {
      hrService = await server.getPrimaryService("heart_rate");
      hrCharacteristic = await hrService.getCharacteristic(
        "heart_rate_measurement"
      );
    } catch {
      throw new Error(
        "This device does not expose the standard Heart Rate service (0x180D). It may require a custom device-specific integration."
      );
    }

    // Start notifications before marking the device as connected.
    await hrCharacteristic.startNotifications();

    const name = device.name || "BLE Heart Rate Sensor";
    const deviceType = detectDeviceType(name);

    // Battery support is optional.
    let battery: number | null = null;
    let batterySupported = false;

    try {
      const batteryService = await server.getPrimaryService("battery_service");
      const batteryCharacteristic =
        await batteryService.getCharacteristic("battery_level");

      const value = await batteryCharacteristic.readValue();
      battery = value.getUint8(0);
      batterySupported = true;
    } catch {
      // The device may not expose battery information.
    }

    const entry = {
      id: device.id,
      name,
      source: "real" as const,
      status: "connected" as const,
      battery,
      authorized: true,
      lastSeen: Date.now(),
      deviceType,
      protocol: "ble-heart-rate" as const,
      manufacturer: undefined,
      heartRateSupported: true,
      batterySupported,
    };

    // Read actual Heart Rate Measurement notifications.
    hrCharacteristic.addEventListener(
      "characteristicvaluechanged",
      (event: any) => {
        const value: DataView = event.target.value;

        if (!value || value.byteLength < 2) return;

        const flags = value.getUint8(0);
        const bpm = flags & 1
          ? value.getUint16(1, true)
          : value.getUint8(1);

        useApp.getState().addReading({
          t: Date.now(),
          bpm,
          source: "real",
        });
      }
    );

    live.set(device.id, device);

    const st = useApp.getState();

    st.set({
      devices: [
        entry,
        ...st.devices.filter((item) => item.id !== device.id),
      ],
    });

    device.addEventListener("gattserverdisconnected", () => {
      live.delete(device.id);

      const state = useApp.getState();

      state.set({
        devices: state.devices.map((item) =>
          item.id === device.id
            ? { ...item, status: "disconnected" }
            : item
        ),
      });

      state.addNotif({
        category: "device",
        title: "Wristband disconnected",
        body: `${name} lost connection.`,
      });
    });

    return entry;
  } catch (error) {
    // Do not leave an incompatible or failed connection open.
    if (device.gatt?.connected) {
      device.gatt.disconnect();
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Unable to connect to this Bluetooth device.");
  }
}

export function disconnect(id: string) {
  const device = live.get(id);

  if (device?.gatt?.connected) {
    device.gatt.disconnect();
  }

  live.delete(id);

  const state = useApp.getState();

  state.set({
    devices: state.devices.map((item) =>
      item.id === id
        ? { ...item, status: "disconnected" }
        : item
    ),
  });
}

export function addDemoDevice() {
  const state = useApp.getState();

  const device = {
    id: "demo-" + uid(),
    name: "WristBand Demo Sensor",
    source: "demo" as const,
    status: "connected" as const,
    battery: 87,
    authorized: true,
    lastSeen: Date.now(),
    deviceType: "demo" as const,
    protocol: "demo" as const,
    heartRateSupported: true,
    batterySupported: true,
  };

  state.set({
    devices: [device, ...state.devices],
  });

  return device;
}
