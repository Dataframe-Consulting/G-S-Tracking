export function LeafLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path
        d="M40 6c-11 0-22 4-28 12-5 7-5 16 1 22 6 6 15 6 22 1 8-6 12-17 12-28V6h-7z"
        fill="currentColor"
        opacity=".18"
      />
      <path
        d="M40 6c-11 0-22 4-28 12-5 7-5 16 1 22 6 6 15 6 22 1 8-6 12-17 12-28V6h-7z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12 40L32 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect
        x="20"
        y="26"
        width="6"
        height="14"
        rx="3"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="23" cy="38" r="3.2" fill="#dc2626" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
