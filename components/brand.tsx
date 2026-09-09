export function Brand() {
  return (
    <a className="brand" href="/" aria-label="ReferVault home">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M5 5h9a5 5 0 0 1 0 10H9m0-5v10M5 5v15m9-5 5 5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      ReferVault<span className="brand-dot">.</span>
    </a>
  );
}
