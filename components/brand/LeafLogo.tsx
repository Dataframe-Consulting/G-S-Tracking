export function LeafLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* GPS pin outer shape */}
      <path
        d="M24 2C13.5 2 5 10.5 5 21c0 14.5 19 33 19 33s19-18.5 19-33C43 10.5 34.5 2 24 2z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* GPS amber dot */}
      <circle cx="24" cy="14" r="4" fill="#C47D28" />
      {/* Central stem */}
      <line x1="24" y1="18" x2="24" y2="36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Left route arm */}
      <path d="M24 26 Q16 30 14 36" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      {/* Right route arm */}
      <path d="M24 26 Q32 30 34 36" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}
