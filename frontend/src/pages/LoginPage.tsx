import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { BrandMark } from "../components/BrandMark";

type Mode = "login" | "forgot" | "reset" | "invite";

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/app";

  const initialMode = useMemo<Mode>(() => {
    if (params.get("invite")) return "invite";
    if (params.get("reset")) return "reset";
    if (params.get("mode") === "forgot") return "forgot";
    return "login";
  }, [params]);

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("admin@aegis.local");
  const [password, setPassword] = useState("Admin@12345");
  const [token, setToken] = useState(params.get("invite") || params.get("reset") || "");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && mode === "login") navigate("/app", { replace: true });
  }, [user, mode, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
        navigate(from, { replace: true });
        return;
      }
      if (mode === "forgot") {
        const res = await api.forgotPassword(email);
        setMessage(res.message);
        return;
      }
      if (mode === "reset") {
        await api.resetPassword(token, password);
        setMessage("Password reset. You can sign in now.");
        setMode("login");
        return;
      }
      if (mode === "invite") {
        await api.acceptInvite({ token, password, name: name || undefined });
        setMessage("Invite accepted. Sign in with your new password.");
        setMode("login");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login">
      <div className="atmosphere" />
      <motion.section
        className="login-hero"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="eyebrow">Enterprise Security Platform</p>
        <h1>
          Clarity for every
          <em> signal.</em>
        </h1>
        <p className="lede">
          A composed command surface for monitoring, investigation, and response — crafted for teams
          that expect precision.
        </p>
        <div className="hero-meta">
          <div>
            <strong>Grounded AI</strong>
            <span>Evidence-first assistant</span>
          </div>
          <div>
            <strong>Wazuh-backed</strong>
            <span>Live SOC telemetry</span>
          </div>
        </div>
      </motion.section>

      <motion.form
        className="login-card glass"
        onSubmit={onSubmit}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.75, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        <BrandMark large />
        <p className="card-copy">
          {mode === "login" && "Sign in with your Aegis credentials."}
          {mode === "forgot" && "Request a password reset token."}
          {mode === "reset" && "Set a new password with your reset token."}
          {mode === "invite" && "Accept your invitation and set a password."}
        </p>

        {(mode === "login" || mode === "forgot") && (
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        )}

        {(mode === "reset" || mode === "invite") && (
          <div className="field">
            <label htmlFor="token">Token</label>
            <input id="token" value={token} onChange={(e) => setToken(e.target.value)} required />
          </div>
        )}

        {mode === "invite" && (
          <div className="field">
            <label htmlFor="name">Name (optional)</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}

        {(mode === "login" || mode === "reset" || mode === "invite") && (
          <div className="field">
            <label htmlFor="password">{mode === "login" ? "Password" : "New password"}</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "login" ? 1 : 8}
            />
          </div>
        )}

        {error && <p className="form-error">{error}</p>}
        {message && <p className="form-success">{message}</p>}

        <button className="btn btn-primary login-submit" type="submit" disabled={submitting}>
          {submitting
            ? "Working…"
            : mode === "login"
              ? "Sign in"
              : mode === "forgot"
                ? "Send reset"
                : mode === "reset"
                  ? "Reset password"
                  : "Accept invite"}
        </button>

        <div className="auth-links">
          {mode !== "login" && (
            <button type="button" className="linkish" onClick={() => setMode("login")}>
              Back to sign in
            </button>
          )}
          {mode === "login" && (
            <>
              <button type="button" className="linkish" onClick={() => setMode("forgot")}>
                Forgot password
              </button>
              <button type="button" className="linkish" onClick={() => setMode("invite")}>
                Accept invite
              </button>
              <button type="button" className="linkish" onClick={() => setMode("reset")}>
                Have a reset token?
              </button>
            </>
          )}
        </div>
        <p className="fine">Administrator-controlled access. Public self-signup cannot grant admin rights.</p>
      </motion.form>

      <style>{`
        .login {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 2rem;
          align-items: center;
          padding: 2.5rem clamp(1.5rem, 4vw, 4rem);
          position: relative;
        }
        .login-hero {
          max-width: 36rem;
          padding-left: 0.5rem;
        }
        .login-hero .eyebrow {
          margin: 0 0 1rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 0.72rem;
          color: var(--muted);
          font-weight: 500;
        }
        .login-hero h1 {
          margin: 0;
          font-family: var(--display);
          font-weight: 400;
          font-size: clamp(3rem, 5.5vw, 4.6rem);
          line-height: 1.05;
          letter-spacing: -0.03em;
        }
        .login-hero em {
          font-style: italic;
          color: var(--accent);
        }
        .lede {
          margin: 1.25rem 0 0;
          color: var(--ink-soft);
          font-size: 1.08rem;
          line-height: 1.55;
          max-width: 32rem;
        }
        .hero-meta {
          display: flex;
          gap: 1.5rem;
          margin-top: 2rem;
        }
        .hero-meta div {
          display: grid;
          gap: 0.2rem;
        }
        .hero-meta strong {
          font-size: 0.95rem;
        }
        .hero-meta span {
          color: var(--muted);
          font-size: 0.82rem;
        }
        .login-card {
          width: min(420px, 100%);
          justify-self: end;
          border-radius: calc(var(--radius) + 4px);
          padding: 1.75rem 1.85rem 1.6rem;
          display: grid;
          gap: 0.85rem;
          box-shadow: var(--shadow);
        }
        .card-copy {
          margin: 0.15rem 0 0.35rem;
          color: var(--ink-soft);
          font-size: 0.95rem;
          line-height: 1.45;
        }
        .login-card .field {
          display: grid;
          gap: 0.4rem;
        }
        .login-card label {
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
          font-weight: 500;
        }
        .login-card input {
          width: 100%;
          border: 1px solid var(--line-strong);
          border-radius: 14px;
          padding: 0.95rem 1rem;
          background: rgba(255, 255, 255, 0.88);
          color: var(--ink);
          outline: none;
          transition: border-color 160ms ease, box-shadow 160ms ease;
        }
        .login-card input:focus {
          border-color: rgba(28, 78, 216, 0.45);
          box-shadow: 0 0 0 4px rgba(28, 78, 216, 0.12);
        }
        .login-submit {
          width: 100%;
          margin-top: 0.35rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          min-height: 3rem;
          padding-top: 0;
          padding-bottom: 0;
        }
        .form-error {
          margin: 0;
          color: var(--danger);
          font-size: 0.88rem;
        }
        .form-success {
          margin: 0;
          color: var(--success);
          font-size: 0.88rem;
        }
        .auth-links {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem 1rem;
          margin-top: 0.15rem;
        }
        .linkish {
          appearance: none;
          border: none;
          background: transparent;
          color: var(--accent);
          cursor: pointer;
          font-size: 0.84rem;
          padding: 0;
          font-weight: 500;
        }
        .linkish:hover {
          text-decoration: underline;
        }
        .fine {
          margin: 0.35rem 0 0;
          color: var(--muted);
          font-size: 0.76rem;
          line-height: 1.4;
        }
        @media (max-width: 960px) {
          .login {
            grid-template-columns: 1fr;
            padding: 1.5rem;
            align-content: start;
          }
          .login-hero {
            max-width: none;
            padding-left: 0;
          }
          .login-card {
            justify-self: stretch;
            width: 100%;
          }
          .hero-meta {
            margin-bottom: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}
