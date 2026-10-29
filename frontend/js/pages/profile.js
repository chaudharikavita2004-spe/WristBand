(async () => {
  await requireLogin();
  const f = document.getElementById("profile-form");
  const { profile } = await api.get("/me");
  ["full_name", "phone", "blood_group", "allergies"].forEach((k) => { if (profile && profile[k]) f[k].value = profile[k]; });
  f.onsubmit = async (e) => {
    e.preventDefault();
    const body = {};
    ["full_name", "phone", "blood_group", "allergies", "cancel_pin", "duress_pin"].forEach((k) => { if (f[k].value) body[k] = f[k].value; });
    if (body.cancel_pin && body.cancel_pin === body.duress_pin) return flash("Cancel and duress PINs must differ.", "error");
    try { await api.patch("/me", body); f.cancel_pin.value = f.duress_pin.value = ""; flash("Saved.", "ok"); } catch (err) { flash(err.message, "error"); }
  };
})();
