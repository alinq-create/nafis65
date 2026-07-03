const HorizonDivider = () => (
  <svg
    className="absolute inset-x-0 bottom-[-1px] h-16 w-full pointer-events-none"
    viewBox="0 0 100 64"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <path
      d="M100 52 Q50 -14 0 52 L0 64 L100 64 Z"
      fill="hsl(var(--background))"
    />
    <path
      d="M100 52 Q50 -14 0 52"
      fill="none"
      stroke="hsl(var(--background))"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export default HorizonDivider;
