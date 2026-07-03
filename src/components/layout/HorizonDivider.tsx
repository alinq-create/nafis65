const HorizonDivider = () => (
  <svg
    className="absolute inset-x-0 bottom-[-18px] h-24 w-full pointer-events-none drop-shadow-[0_8px_14px_rgba(15,23,42,0.08)]"
    viewBox="0 0 100 96"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <path
      d="M100 66 Q50 20 0 66 L0 96 L100 96 Z"
      fill="hsl(var(--background))"
    />
    <path
      d="M100 66 Q50 20 0 66"
      fill="none"
      stroke="rgba(255,255,255,0.55)"
      strokeWidth="1"
      strokeLinecap="round"
    />
  </svg>
);

export default HorizonDivider;
