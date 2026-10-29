const form = document.getElementById("login-form");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const mode = e.submitter ? e.submitter.value : "signin";
  const email = form.email.value.trim(), password = form.password.value;
  const fn = mode === "signup" ? api.sb.auth.signUp({ email, password }) : api.sb.auth.signInWithPassword({ email, password });
  const { data, error } = await fn;
  if (error) return flash(error.message, "error");
  if (!data.session) return flash("Check your email to confirm your account, then sign in.", "info");
  location.href = "index.html";
});
