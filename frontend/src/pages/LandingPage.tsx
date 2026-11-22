import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BrandMark } from "../components/BrandMark";
import { useAuth } from "../auth/AuthContext";

export function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="landing">
      <div className="atmosphere" />
      <div className="landing-visual" aria-hidden>
        <div className="visual-plane">
          <div className="visual-glow" />
          <div className="visual-grid" />
          <div className="visual-panel p1" />
          <div className="visual-panel p2" />
          <div className="visual-panel p3" />
          <div className="visual-scan" />
        </div>
      </div>

      <motion.header
        className="landing-nav"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <BrandMark />
        <div className="nav-actions">
          {user ? (
            <Link className="btn btn-primary" to="/app">
              Open platform
            </Link>
          ) : (
            <Link className="btn btn-primary" to="/login">
              Login
            </Link>
          )}
        </div>
      </motion.header>

      <main className="landing-hero">
        <motion.div
          className="hero-copy"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="brand-signal">Aegis</p>
          <h1>Security operations with clear signal.</h1>
          <p className="support">
            Monitor Wazuh telemetry, investigate incidents, and respond with grounded AI — one composed
            command surface.
          </p>
          <div className="cta-row">
            {user ? (
              <Link className="btn btn-primary" to="/app">
                Continue to dashboard
              </Link>
            ) : (
              <Link className="btn btn-primary" to="/login">
                Login
              </Link>
            )}
          </div>
        </motion.div>
      </main>

      <style>{`
        .landing {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          display: grid;
          grid-template-rows: auto 1fr;
        }
        .landing-visual {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }
        .visual-plane {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(115deg, rgba(238,240,244,0.2) 0%, rgba(238,240,244,0.72) 42%, rgba(247,248,250,0.55) 100%),
            radial-gradient(900px 520px at 78% 42%, rgba(28,78,216,0.16), transparent 60%);
        }
        .visual-glow {
          position: absolute;
          right: -8%;
          top: 8%;
          width: min(62vw, 760px);
          height: min(70vh, 640px);
          border-radius: 40% 48% 42% 55%;
          background:
            radial-gradient(circle at 40% 40%, rgba(42,94,240,0.22), transparent 55%),
            radial-gradient(circle at 70% 60%, rgba(18,19,26,0.08), transparent 50%);
          filter: blur(8px);
          animation: drift 14s ease-in-out infinite alternate;
        }
        .visual-grid {
          position: absolute;
          right: 4%;
          top: 18%;
          width: min(54vw, 680px);
          height: min(58vh, 520px);
          border-radius: 28px;
          border: 1px solid rgba(18,19,26,0.08);
          background-image:
            linear-gradient(rgba(28,78,216,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(28,78,216,0.05) 1px, transparent 1px);
          background-size: 44px 44px;
          mask-image: linear-gradient(135deg, transparent 0%, #000 28%, #000 78%, transparent 100%);
          transform: perspective(900px) rotateY(-18deg) rotateX(8deg);
          box-shadow: inset 0 0 80px rgba(28,78,216,0.06);
        }
        .visual-panel {
          position: absolute;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.55);
          background: rgba(255,255,255,0.42);
          backdrop-filter: blur(10px);
          box-shadow: 0 20px 50px rgba(18,19,26,0.08);
          transform: perspective(900px) rotateY(-18deg) rotateX(8deg);
        }
        .visual-panel.p1 {
          right: 18%;
          top: 26%;
          width: min(28vw, 320px);
          height: 120px;
          animation: rise 1.1s ease both;
        }
        .visual-panel.p2 {
          right: 10%;
          top: 42%;
          width: min(34vw, 400px);
          height: 160px;
          animation: rise 1.25s 0.08s ease both;
        }
        .visual-panel.p3 {
          right: 22%;
          top: 62%;
          width: min(22vw, 240px);
          height: 88px;
          animation: rise 1.35s 0.14s ease both;
        }
        .visual-scan {
          position: absolute;
          right: 8%;
          top: 20%;
          width: min(48vw, 600px);
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(28,78,216,0.45), transparent);
          animation: scan 5.5s ease-in-out infinite;
          opacity: 0.7;
        }
        .landing-nav {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.35rem clamp(1.25rem, 4vw, 3.5rem);
        }
        .nav-actions {
          display: flex;
          gap: 0.75rem;
        }
        .landing-hero {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          padding: 1rem clamp(1.25rem, 4vw, 3.5rem) 4rem;
          min-height: calc(100vh - 88px);
        }
        .hero-copy {
          max-width: 34rem;
        }
        .brand-signal {
          margin: 0 0 0.85rem;
          font-family: var(--display);
          font-size: clamp(2.6rem, 5vw, 3.8rem);
          font-weight: 400;
          letter-spacing: -0.03em;
          line-height: 1;
          color: var(--ink);
        }
        .hero-copy h1 {
          margin: 0;
          font-family: var(--font);
          font-weight: 500;
          font-size: clamp(1.55rem, 2.6vw, 2.05rem);
          letter-spacing: -0.025em;
          line-height: 1.25;
          color: var(--ink-soft);
          max-width: 18ch;
        }
        .support {
          margin: 1.1rem 0 0;
          color: var(--muted);
          font-size: 1.05rem;
          line-height: 1.55;
          max-width: 34ch;
        }
        .cta-row {
          display: flex;
          gap: 0.75rem;
          margin-top: 1.75rem;
        }
        .cta-row .btn {
          min-width: 8.5rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          min-height: 3rem;
          padding-top: 0;
          padding-bottom: 0;
        }
        @keyframes drift {
          from { transform: translate3d(0, 0, 0) scale(1); }
          to { transform: translate3d(-18px, 22px, 0) scale(1.04); }
        }
        @keyframes scan {
          0%, 100% { transform: translateY(0); opacity: 0.25; }
          50% { transform: translateY(320px); opacity: 0.85; }
        }
        @keyframes rise {
          from { opacity: 0; transform: perspective(900px) rotateY(-18deg) rotateX(8deg) translateY(18px); }
          to { opacity: 1; transform: perspective(900px) rotateY(-18deg) rotateX(8deg) translateY(0); }
        }
        @media (max-width: 860px) {
          .visual-grid,
          .visual-panel,
          .visual-scan {
            opacity: 0.35;
            right: -10%;
          }
          .hero-copy {
            max-width: 100%;
          }
          .hero-copy h1 {
            max-width: none;
          }
          .support {
            max-width: 40ch;
          }
        }
      `}</style>
    </div>
  );
}
