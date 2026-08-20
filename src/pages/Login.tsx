import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogIn } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { useAuth } from "../context/AuthContext";
import Button from "../components/Button";

export default function Login() {
  const { logIn, logInWithGoogle, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location })?.from?.pathname ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setError("");
    setResetLoading(true);
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch {
      // Firebase intentionally doesn't reveal whether the email exists —
      // show the same success state either way so this can't be used to
      // probe which emails are registered.
      setResetSent(true);
    } finally {
      setResetLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await logIn(email, password);
      navigate(from, { replace: true });
    } catch {
      setError("Couldn't log you in — check your email and password.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setGoogleLoading(true);
    try {
      await logInWithGoogle();
      navigate(from, { replace: true });
    } catch {
      setError("Couldn't sign in with Google. Try again.");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[75vh] max-w-md flex-col justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-surface p-8"
      >
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/15 text-brand-400">
            <LogIn size={17} />
          </div>
          <h1 className="font-mono text-xl font-bold text-white">Welcome back</h1>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="cursor-target flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-surface-2 py-2.5 text-sm font-medium text-white transition-colors hover:border-white/20 hover:bg-surface-2/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FcGoogle size={17} />
          {googleLoading ? "Signing in..." : "Continue with Google"}
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="font-mono text-[11px] tracking-wider text-white/30 uppercase">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {resetMode ? (
          resetSent ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-white/70">If that email has an eduShare account, a reset link is on its way — check your inbox.</p>
              <Button variant="secondary" className="w-full" onClick={() => { setResetMode(false); setResetSent(false); }}>
                Back to log in
              </Button>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
                />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={resetLoading}>
                {resetLoading ? "Sending..." : "Send reset link"}
              </Button>
              <button type="button" onClick={() => setResetMode(false)} className="cursor-target block w-full text-center text-sm text-white/45 hover:text-white">
                Back to log in
              </button>
            </form>
          )
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
                />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block text-xs font-medium text-white/50">Password</label>
                  <button type="button" onClick={() => setResetMode(true)} className="cursor-target text-xs text-brand-400 hover:underline">
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? "Logging in..." : "Log in"}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-white/45">
              Forgot your username?{" "}
              <Link to="/recover" className="cursor-target font-medium text-brand-400 hover:underline">
                Request help
              </Link>
            </p>

            <p className="mt-3 text-center text-sm text-white/45">
              New here?{" "}
              <Link to="/signup" className="cursor-target font-medium text-brand-400 hover:underline">
                Create an account
              </Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
