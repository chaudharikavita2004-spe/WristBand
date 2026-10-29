(async () => {
  await requireLogin();
  async function load() {
    const d = await api.get("/dashboard");
    const st = document.getElementById("status");
    st.textContent = d.status === "emergency" ? "EMERGENCY ACTIVE" : "Safe"; st.className = "big " + d.status;
    document.getElementById("score").textContent = d.safety_score + "/100";
    document.getElementById("contacts-count").textContent = d.contacts_count;
    document.getElementById("journey").textContent = d.active_journey ? `${d.active_journey.destination} (since ${fmt(d.active_journey.started_at)})` : "None";
    document.getElementById("devices").innerHTML = d.devices.map((x) => `<li>${esc(x.name)} — ${esc(x.status)} ${x.source === "demo" ? '<span class="badge">DEMO</span>' : ""}</li>`).join("") || "<li>No devices</li>";
    document.getElementById("sos-list").innerHTML = d.recent_sos.map((s) => `<li>${fmt(s.created_at)} — ${esc(s.trigger)} — ${esc(s.status)}</li>`).join("") || "<li>No SOS events</li>";
  }
  document.getElementById("checkin").onclick = async () => { await api.post("/checkins", { ok: true }); flash("Check-in recorded.", "ok"); };
  try { await load(); } catch (e) { flash(e.message, "error"); }
  // Realtime: refresh when your SOS events change (RLS filters to your rows)
  api.sb.channel("sos").on("postgres_changes", { event: "*", schema: "public", table: "sos_events" }, () => load().catch(() => {})).subscribe();
})();
