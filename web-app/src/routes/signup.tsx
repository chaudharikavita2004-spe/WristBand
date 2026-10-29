
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setSuccess(false);

    if (password.length < 8) {
      setMessage("Your password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Your passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim(),
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setSuccess(true);
      setMessage(
        data.session
          ? "Your account has been created successfully. You can now sign in."
          : "Account created! Check your email for a confirmation link before signing in.",
      );

      setPassword("");
      setConfirmPassword("");
    } catch {
      setMessage("Unable to create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-[#07111f] text-white">
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-teal-400/10 blur-3xl" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl lg:grid-cols-2">
        <section className="flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-16 lg:py-10">
          <Link to="/login" className="flex w-fit items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-300">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8">
                <path d="M8 3h8l2 5v8l-2 5H8l-2-5V8l2-5Z" strokeLinejoin="round" />
                <path d="M9 12.5 11 14.5 15.5 10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <span className="text-xl font-bold tracking-wide">WristBand</span>
              <p className="text-xs tracking-[0.2em] text-slate-400">SAFETY, CONNECTED</p>
            </div>
          </Link>

          <div className="mx-auto w-full max-w-md py-10 lg:py-0">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/[0.07] px-3 py-2 text-xs font-medium text-teal-200">
              <span className="h-2 w-2 rounded-full bg-teal-300" />
              CREATE YOUR ACCOUNT
            </div>

            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Your safety.
              <span className="mt-2 block bg-gradient-to-r from-cyan-300 to-teal-300 bg-clip-text text-transparent">
                Your WristBand.
              </span>
            </h1>

            <p className="mt-4 leading-7 text-slate-400">
              Create your account to get started with your personal safety
              space.
            </p>

            <form onSubmit={handleSignup} className="mt-7 space-y-4">
              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-medium text-slate-200">
                  Full name
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10"
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-200">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-200">
                  Password
                </label>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-200">
                    Confirm password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs text-cyan-300 hover:text-cyan-200"
                  >
                    {showPassword ? "Hide passwords" : "Show passwords"}
                  </button>
                </div>
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Enter your password again"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10"
                />
              </div>

              {message && (
                <p
                  role="status"
                  className={`rounded-xl border p-3 text-sm ${
                    success
                      ? "border-teal-400/20 bg-teal-400/10 text-teal-200"
                      : "border-red-400/20 bg-red-400/10 text-red-200"
                  }`}
                >
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 px-4 py-3.5 font-semibold text-[#07111f] shadow-lg shadow-cyan-500/10 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Creating account..." : "Create my account"}
                {!loading && <span aria-hidden="true">→</span>}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-400">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-cyan-300 hover:text-cyan-200">
                Sign in
              </Link>
            </p>
          </div>

          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} WristBand · Personal Safety Platform
          </p>
        </section>

        <aside className="relative hidden items-center justify-center overflow-hidden border-l border-white/[0.06] bg-white/[0.015] p-12 lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.08),transparent_60%)]" />

          <div className="relative w-full max-w-md">
            <div className="relative mx-auto flex h-64 w-64 items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-cyan-300/10" />
              <div className="absolute inset-5 rounded-full border border-cyan-300/15" />
              <div className="absolute inset-10 rounded-full border border-teal-300/20" />
              <div className="absolute h-40 w-40 rounded-full bg-cyan-400/10 blur-2xl" />
              <div className="relative flex h-28 w-28 items-center justify-center rounded-[2rem] border border-cyan-200/30 bg-gradient-to-br from-cyan-300/20 to-teal-300/5 shadow-2xl shadow-cyan-500/10">
                <svg viewBox="0 0 24 24" fill="none" className="h-14 w-14 text-cyan-200" stroke="currentColor" strokeWidth="1.2">
                  <path d="M8 3h8l2 5v8l-2 5H8l-2-5V8l2-5Z" strokeLinejoin="round" />
                  <path d="M9 12.5 11 14.5 15.5 10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="absolute right-2 top-10 h-3 w-3 rounded-full bg-teal-300 shadow-lg shadow-teal-300/50" />
              <div className="absolute bottom-8 left-5 h-2 w-2 rounded-full bg-cyan-300" />
            </div>

            <div className="mt-10 text-center">
              <p className="text-xs font-semibold tracking-[0.3em] text-cyan-300">
                DESIGNED AROUND YOU
              </p>
              <h2 className="mt-4 text-3xl font-semibold leading-snug">
                Take the first step.
                <br />
                <span className="text-slate-400">Stay connected.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-slate-400">
                Set up your account and bring your personal safety tools into
                one connected experience.
              </p>
            </div>

            <div className="mt-8 flex justify-center gap-3">
              <span className="rounded-full border border-white/10 px-4 py-2 text-xs text-slate-300">
                Thoughtful design
              </span>
              <span className="rounded-full border border-white/10 px-4 py-2 text-xs text-slate-300">
                Connected care
              </span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
