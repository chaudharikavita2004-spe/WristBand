(function () {
  let current = null;
  const dlg = () => document.getElementById("sos-dialog");

  function position() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({});
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy_m: p.coords.accuracy }),
        () => resolve({}), { enableHighAccuracy: true, timeout: 8000 });
    });
  }

  window.triggerSOS = async function (trigger) {
    try {
      const pos = await position();
      const res = await api.post("/sos", { trigger: trigger || "button", ...pos });
      current = res.event.id;
      document.getElementById("sos-msg").textContent = res.alerts.message + (pos.lat ? "" : " Location unavailable.");
      dlg().showModal();
    } catch (e) { flash("SOS failed: " + e.message + ". Call 112 directly.", "error"); }
  };

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("sos-btn");
    if (!btn) return;
    btn.onclick = () => triggerSOS("button");
    document.getElementById("sos-close").onclick = () => dlg().close();
    document.getElementById("sos-cancel").onclick = async () => {
      try {
        await api.post(`/sos/${current}/cancel`, { pin: document.getElementById("sos-pin").value });
        dlg().close(); flash("SOS cancelled.", "ok");
      } catch (e) { document.getElementById("sos-msg").textContent = e.message; }
      document.getElementById("sos-pin").value = "";
    };
  });
})();
