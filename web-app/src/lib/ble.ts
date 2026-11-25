import { useApp, uid } from "./store";
import type { DeviceKind } from "./store";

type BTDevice = {
  id: string;
  name?: string;
  gatt?: any;
  addEventListener: (event: string, callback: (event?: any) => void) => void;
};

const live = new Map<string, BTDevice>();

// Custom WristBand ESP32 BLE profile
const WRISTBAND_SERVICE_UUID =
  "7b7a0001-1234-5678-1234-56789abcdef0";

const WRISTBAND_HEART_RATE_UUID =
  "7b7a0002-1234-5678-1234-56789abcdef0";

const WRISTBAND_BATTERY_UUID =
  "7b7a0003-1234-5678-1234-56789abcdef0";

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
      "Web Bluetooth is not supported. Use Chrome or Edge on desktop or Android, or Demo Mode."
    );
  }

  const device: BTDevice = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [
      "heart_rate",
      "battery_service",
      WRISTBAND_SERVICE_UUID,
    ],
  });

  if (!device.gatt) {
    throw new Error("This Bluetooth device does not support GATT connections.");
  }

  try {
    const server = await device.gatt.connect();

    let hrCharacteristic: any;
    let protocol: "ble-heart-rate" | "ble-custom";

    // First try the standard Bluetooth Heart Rate service.
    try {
      const service = await server.getPrimaryService("heart_rate");
      hrCharacteristic = await service.getCharacteristic(
        "heart_rate_measurement"
      );
      protocol = "ble-heart-rate";
    } catch {
      // If standard Heart Rate is unavailable, try WristBand's custom profile.
      try {
        const service = await server.getPrimaryService(
          WRISTBAND_SERVICE_UUID
        );

        hrCharacteristic = await service.getCharacteristic(
          WRISTBAND_HEART_RATE_UUID
        );

        protocol = "ble-custom";
      } catch {
        throw new Error(
          "This device does not expose a supported Heart Rate service or WristBand custom BLE service."
        );
      }
    }

    await hrCharacteristic.startNotifications();

    const name = device.name || "BLE Heart Rate Sensor";
    const deviceType = detectDeviceType(name);

    let battery: number | null = null;
    let batterySupported = false;

    // Try standard Battery Service first.
    try {
      const batteryService = await server.getPrimaryService("battery_service");
      const batteryCharacteristic =
        await batteryService.getCharacteristic("battery_level");

      const value = await batteryCharacteristic.readValue();

      if (value.byteLength >= 1) {
        battery = value.getUint8(0);
        batterySupported = true;
      }
    } catch {
      // Standard battery service is optional.
    }

    // If standard battery information is unavailable, try custom battery data.
    if (!batterySupported) {
      try {
        const service = await server.getPrimaryService(
          WRISTBAND_SERVICE_UUID
        );

        const characteristic = await service.getCharacteristic(
          WRISTBAND_BATTERY_UUID
        );

        const value = await characteristic.readValue();

        if (value.byteLength >= 1) {
          battery = value.getUint8(0);
          batterySupported = true;
        }
      } catch {
        // Custom battery information is optional.
      }
    }

    // Listen for actual heart-rate notifications.
    hrCharacteristic.addEventListener(
      "characteristicvaluechanged",
      (event: any) => {
        const value: DataView = event.target.value;

        if (!value || value.byteLength < 2) return;

        let bpm: number;

        if (protocol === "ble-custom") {
          // Custom WristBand format: 2-byte unsigned integer, little-endian.
          bpm = value.getUint16(0, true);
        } else {
          // Standard Bluetooth Heart Rate Measurement format.
          const flags = value.getUint8(0);

          bpm =
            flags & 1
              ? value.getUint16(1, true)
              : value.getUint8(1);
        }

        if (bpm < 20 || bpm > 250) return;

        useApp.getState().addReading({
          t: Date.now(),
          bpm,
          source: "real",
        });
      }
    );

    const entry = {
      id: device.id,
      name,
      source: "real" as const,
      status: "connected" as const,
      battery,
      authorized: true,
      lastSeen: Date.now(),
      deviceType,
      protocol,
      manufacturer: undefined,
      heartRateSupported: true,
      batterySupported,
    };

    live.set(device.id, device);

    const state = useApp.getState();

    state.set({
      devices: [
        entry,
        ...state.devices.filter((item) => item.id !== device.id),
      ],
    });

    device.addEventListener("gattserverdisconnected", () => {
      live.delete(device.id);

      const current = useApp.getState();

      current.set({
        devices: current.devices.map((item) =>
          item.id === device.id
            ? { ...item, status: "disconnected" }
            : item
        ),
      });

      current.addNotif({
        category: "device",
        title: "Wristband disconnected",
        body: `${name} lost connection.`,
      });
    });

    return entry;
  } catch (error) {
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