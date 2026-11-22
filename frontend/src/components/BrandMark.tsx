export function BrandMark({ large = false }: { large?: boolean }) {
  return (
    <div className={`brand ${large ? "brand-large" : ""}`}>
      <div className="brand-glyph" aria-hidden>
        <svg viewBox="0 0 32 32" fill="none">
          <path
            d="M16 3L27 9.5V22.5L16 29L5 22.5V9.5L16 3Z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M16 10.5V21.5M11.5 13.5L16 16L20.5 13.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="brand-copy">
        <strong>Aegis</strong>
        {!large && <span>Enterprise Security</span>}
      </div>
      <style>{`
        .brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .brand-glyph {
          width: 34px;
          height: 34px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          color: var(--ink);
          background: rgba(255,255,255,0.7);
          border: 1px solid var(--line);
        }
        .brand-glyph svg {
          width: 18px;
          height: 18px;
        }
        .brand-copy {
          display: grid;
          gap: 0.05rem;
        }
        .brand-copy strong {
          font-weight: 600;
          letter-spacing: -0.02em;
          font-size: 1.05rem;
        }
        .brand-copy span {
          font-size: 0.72rem;
          color: var(--muted);
          letter-spacing: 0.02em;
        }
        .brand-large .brand-glyph {
          width: 48px;
          height: 48px;
          border-radius: 16px;
        }
        .brand-large .brand-glyph svg {
          width: 24px;
          height: 24px;
        }
        .brand-large .brand-copy strong {
          font-family: var(--display);
          font-size: 2rem;
          font-weight: 400;
          letter-spacing: -0.03em;
        }
      `}</style>
    </div>
  );
}
