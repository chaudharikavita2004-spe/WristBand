// Real hardware: standard Bluetooth Heart Rate profile (0x180D). Requires Chrome/Edge and HTTPS or localhost.
window.WBBle = {
  supported: () => "bluetooth" in navigator,
  async connect(onBpm, onDisconnect) {
    if (!navigator.bluetooth) throw new Error("Web Bluetooth not supported in this browser.");
    const device = await navigator.bluetooth.requestDevice({ filters: [{ services: ["heart_rate"] }], optionalServices: ["battery_service"] });
    device.addEventListener("gattserverdisconnected", () => onDisconnect && onDisconnect(device));
    const server = await device.gatt.connect();
    let battery = null;
    try { battery = (await (await (await server.getPrimaryService("battery_service")).getCharacteristic("battery_level")).readValue()).getUint8(0); } catch (_) {}
    const ch = await (await server.getPrimaryService("heart_rate")).getCharacteristic("heart_rate_measurement");
    await ch.startNotifications();
    ch.addEventListener("characteristicvaluechanged", (e) => {
      const v = e.target.value; const flags = v.getUint8(0);
      onBpm(flags & 1 ? v.getUint16(1, true) : v.getUint8(1));
    });
    return { id: device.id, name: device.name || "BLE Heart Rate Sensor", battery };
  },
};
