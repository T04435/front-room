/* Logo: hand-written, the brand mark (no library component draws one). Two overlapping circles, Apricot and Plum (Rose in
   dark), joined by one wave; the wordmark "front room" in lower case, in the heading face. */
export function Logo({ size = "md", withWordmark = true }: { size?: "sm" | "md" | "lg"; withWordmark?: boolean }) {
  const px = size === "lg" ? 56 : size === "sm" ? 28 : 36;
  return (
    <span role="img" aria-label="Front Room" className="inline-flex items-center gap-2.5 text-foreground">
      <svg width={px} height={px} viewBox="0 0 56 56" aria-hidden>
        <circle cx="21" cy="28" r="17" className="fill-accent" />
        <circle cx="35" cy="28" r="17" className="fill-primary" fillOpacity={0.92} />
        <path d="M8 30c3.5-6 7-6 10.5 0s7 6 10.5 0 7-6 10.5 0 5 5 8 1" fill="none" className="stroke-primary-foreground" strokeWidth={3} strokeLinecap="round" />
      </svg>
      {withWordmark && (
        <span aria-hidden className="font-heading tracking-[-0.01em] lowercase" style={{ fontSize: Math.round(px * 0.72) }}>
          front room
        </span>
      )}
    </span>
  );
}
