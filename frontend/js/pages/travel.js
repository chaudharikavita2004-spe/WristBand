(async () => {
  await requireLogin();
  let watch = null, active = null;
  const f = document.getElementById("journey-form");
  async function load() {
    const rows = await api.get("/journeys");
    active = rows.find((j) => j.status === "active") || null;
    document.getElementById("active").hidden = !active;
    f.hidden = !!active;
    if (active) { document.getElementById("active-info").textContent = `${active.destination} via ${active.mode || "—"} — started ${fmt(active.started_at)}, expected ${active.expected_minutes} min`; track(); }
    document.getElementById("journey-list").innerHTML = rows.map((j) => `<li>${esc(j.destination)} — ${esc(j.status)} — ${fmt(j.started_at)}</li>`).join("");
  }
  function track() {
    if (watch || !navigator.geolocation) return;
    let last = 0;
    watch = navigator.geolocation.watchPosition(async (p) => {
      document.getElementById("loc-info").textContent = `Last fix ±${Math.round(p.coords.accuracy)} m at ${new Date().toLocaleTimeString()}`;
      if (Date.now() - last < 30000) return; last = Date.now();
      await api.post(`/journeys/${active.id}/points`, { lat: p.coords.latitude, lng: p.coords.longitude, accuracy_m: p.coords.accuracy }).catch(() => {});
    }, () => { document.getElementById("loc-info").textContent = "Location permission denied — journey continues without tracking."; }, { enableHighAccuracy: true });
  }
  f.onsubmit = async (e) => {
    e.preventDefault();
    const body = { destination: f.destination.value, mode: f.mode.value, expected_minutes: Number(f.expected_minutes.value) };
    if (f.vehicle_info.value) body.vehicle_info = f.vehicle_info.value;
    try { await api.post("/journeys", body); load(); } catch (err) { flash(err.message, "error"); }
  };
  document.getElementById("end").onclick = async () => {
    await api.post(`/journeys/${active.id}/end`, { status: "completed" });
    if (watch) navigator.geolocation.clearWatch(watch); watch = null; load(); flash("Arrived safely.", "ok");
  };
  load().catch((e) => flash(e.message, "error"));
})();
