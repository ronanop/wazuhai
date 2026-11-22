import { motion } from "framer-motion";

export function FullScreenLoader() {
  return (
    <div className="loader-screen">
      <div className="atmosphere" />
      <motion.div
        className="loader-mark"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="loader-word">Aegis</span>
        <motion.div
          className="loader-bar"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], repeat: Infinity, repeatType: "mirror" }}
        />
      </motion.div>
      <style>{`
        .loader-screen {
          min-height: 100vh;
          display: grid;
          place-items: center;
        }
        .loader-mark {
          display: grid;
          gap: 1rem;
          justify-items: center;
        }
        .loader-word {
          font-family: var(--display);
          font-size: 2.6rem;
          letter-spacing: -0.03em;
        }
        .loader-bar {
          width: 72px;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--accent), transparent);
          transform-origin: center;
        }
      `}</style>
    </div>
  );
}
