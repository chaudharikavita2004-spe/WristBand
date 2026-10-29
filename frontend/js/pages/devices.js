(async () => {
  await requireLogin();
  const s = document.createElement("script"); s.src = "js/ble.js"; document.body.appendChild(s);
  await new Promise((r) => (s.onload = r));
  const list = document.getElementById("device-list");
  async function load() {
    const rows = await api.get("/devices");
    list.innerHTML = rows.map((d) => `<li><span>${esc(d.name)} ${d.source === "demo" ? '<span class="badge">DEMO</span>' : '<span class="badge real">REAL</span>'} — ${esc(d.status)}${d.battery != null ? " — " + d.battery + "%" : ""}</span><button class="ghost" data-id="${d.id}">Remove</button></li>`).join("") || "<li>No devices.</li>";
  }
  list.onclick = async (e) => { if (e.target.dataset.id) { await api.del(`/devices/${e.target.dataset.id}`); load(); } };
  document.getElementById("pair").onclick = async () => {
    if (!WBBle.supported()) return flash("Web Bluetooth isn't available in this browser. Use Chrome or Edge, or add a demo band.", "error");
    try {
      let dev;
      const info = await WBBle.connect(async (bpm) => {
        document.getElementById("bpm").textContent = bpm + " BPM";
        if (dev) api.post(`/devices/${dev.id}/readings`, { bpm, source: "real" }).catch(() => {});
      }, async () => { if (dev) await api.patch(`/devices/${dev.id}`, { status: "disconnected" }); flash("Wristband disconnected.", "error"); load(); });
      const body = { name: info.name, hardware_id: info.id, source: "real" };
      if (info.battery != null) body.battery = info.battery;
      dev = await api.post("/devices", body); load();
    } catch (err) { flash(err.message, "error"); }
  };
  document.getElementById("demo").onclick = async () => {
    const dev = await api.post("/devices", { name: "Demo WristBand", hardware_id: "demo-" + Date.now(), source: "demo", battery: 87 });
    load();
    setInterval(() => { const bpm = 70 + Math.round(Math.random() * 15); document.getElementById("bpm").textContent = bpm + " BPM (DEMO)"; api.post(`/devices/${dev.id}/readings`, { bpm, source: "demo" }).catch(() => {}); }, 5000);
  };
  load().catch((e) => flash(e.message, "error"));
})();
