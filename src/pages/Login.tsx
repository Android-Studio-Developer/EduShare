import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, KeyRound, Mail, Orbit } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { useAuth } from "../context/AuthContext";
import AuthShell from "../components/AuthShell";

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
  const [showPassword, setShowPassword] = useState(false);

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setError("");
    setResetLoading(true);
    try { await resetPassword(email); setResetSent(true); }
    catch { setResetSent(true); }
    finally { setResetLoading(false); }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try { await logIn(email, password); navigate(from, { replace: true }); }
    catch { setError("Couldn't log you in — check your email and password."); }
    finally { setLoading(false); }
  }

  async function handleGoogle() {
    setError("");
    setGoogleLoading(true);
    try { await logInWithGoogle(); navigate(from, { replace: true }); }
    catch { setError("Couldn't sign in with Google. Try again."); }
    finally { setGoogleLoading(false); }
  }

  return (
    <AuthShell
      eyebrow={resetMode ? "Account recovery" : "Member access"}
      title={resetMode ? "Reset your password" : "Welcome back"}
      description={resetMode ? "We'll email you a secure link to get back into your account." : "Pick up where you left off on SpawnDex."}
      icon={resetMode ? KeyRound : Orbit}
    >
      {!resetMode && <>
        <button type="button" onClick={handleGoogle} disabled={googleLoading} className="cursor-target auth-google-button">
          <FcGoogle size={18} />{googleLoading ? "Signing in..." : "Continue with Google"}
        </button>
        <div className="auth-divider"><span>or use email</span></div>
      </>}

      {resetMode ? (resetSent ? (
        <div className="auth-success">
          <span><Mail size={22} /></span><strong>Check your inbox</strong>
          <p>If that email has an SpawnDex account, a reset link is on its way.</p>
          <button type="button" className="cursor-target auth-secondary-button" onClick={() => { setResetMode(false); setResetSent(false); }}>Back to log in</button>
        </div>
      ) : (
        <form onSubmit={handleReset} className="auth-form">
          <label className="auth-field"><span>Email address</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" />
          </label>
          <button type="submit" className="cursor-target auth-primary-button" disabled={resetLoading}>{resetLoading ? "Sending..." : <><span>Send reset link</span><ArrowRight size={17} /></>}</button>
          <button type="button" onClick={() => setResetMode(false)} className="cursor-target auth-text-button">Back to log in</button>
        </form>
      )) : <>
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-field"><span>Email address</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" />
          </label>
          <label className="auth-field">
            <span className="auth-field-label"><span>Password</span><button type="button" onClick={() => setResetMode(true)} className="cursor-target">Forgot password?</button></span>
            <span className="auth-password-wrap">
              <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Enter your password" />
              <button type="button" className="cursor-target auth-password-toggle" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </span>
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" className="cursor-target auth-primary-button" disabled={loading}>{loading ? "Logging in..." : <><span>Enter SpawnDex</span><ArrowRight size={17} /></>}</button>
        </form>
        <div className="auth-links">
          <p>Forgot your username? <Link to="/recover" className="cursor-target">Request help</Link></p>
          <p>New here? <Link to="/signup" className="cursor-target">Create an account</Link></p>
          <p className="mt-2 text-[10px] text-white/30">Successful logins record email, public IP, browser, and operating system for owner/dabug security review. Passwords and tokens are never logged.</p>
        </div>
      </>}
    </AuthShell>
  );
}
