/**
 * UltraPetLogo
 *
 * variant="full" | "wordmark"
 *   Shows the original UltraPet logo artwork extracted directly from
 *   the official UltraPet_Logo.pdf file. The PDF was created in Adobe
 *   Illustrator and is served from /public. The JPEG thumbnail is the
 *   same artwork embedded inside the PDF by Illustrator itself.
 *
 * variant="mark"
 *   The circular brand mark as a scalable SVG — works on any background
 *   colour including the dark transparent header and dark footer.
 */

interface UltraPetLogoProps {
  className?: string;
  variant?: 'full' | 'mark' | 'wordmark';
  inverted?: boolean;
}

/* ─── Full / wordmark ─────────────────────────────────────────── */
// The 256×92 JPEG is extracted from the PDF's own embedded preview
// (xmpGImg:image in the XMP metadata), giving pixel-perfect fidelity
// to the original Illustrator artwork.
function FullLogo({ className }: { className: string }) {
  return (
    <img
      src="/UltraPet_Logo_thumb.jpg"
      alt="UltraPet — Premium Quality Pet Products"
      className={`object-contain select-none ${className}`}
      draggable={false}
      width={256}
      height={92}
    />
  );
}

/* ─── Circular brand mark SVG ─────────────────────────────────── */
// Reproduces the red circular mark from the original UltraPet logo.
function CircleMark({ inverted }: { inverted?: boolean }) {
  const red = '#BE1E24';
  const bg = inverted ? 'rgba(255,255,255,0.15)' : red;

  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      aria-hidden="true"
    >
      {/* Red circle background */}
      <circle cx="100" cy="100" r="96" fill={bg} />

      {/* Dog silhouette — white, German Shepherd profile */}
      <path
        d="M108,36 C113,29 123,28 127,36 C132,30 140,31 139,40
           C147,42 155,51 151,61 C159,64 166,74 162,85
           C158,95 146,98 138,99
           C141,110 141,123 136,130 C131,137 121,137 116,130
           C112,123 113,110 117,101
           C108,103 95,103 88,97 C80,91 77,80 81,70
           C76,63 70,52 74,42 C78,32 90,28 95,36
           C99,29 108,29 108,36 Z"
        fill="white"
      />
      {/* Ear */}
      <path d="M111,36 L102,20 L122,30 Z" fill="white" />
      {/* Snout */}
      <ellipse cx="153" cy="68" rx="10" ry="7" fill="white" />
      <circle cx="159" cy="66" r="3" fill={bg} opacity="0.6" />
      {/* Legs */}
      <path d="M132,106 C136,112 137,122 133,129 C129,133 122,132 121,128 C120,122 122,112 126,106 Z" fill="white" />
      <path d="M114,105 C118,111 118,121 114,127 C110,131 104,129 104,125 C104,119 108,111 112,105 Z" fill="white" />
      <path d="M79,104 C81,112 79,123 75,129 C71,132 63,130 64,125 C64,118 68,108 73,103 Z" fill="white" />
      {/* Tail */}
      <path
        d="M65,85 C55,75 47,60 52,49 C56,40 62,42 64,52 C62,62 66,72 72,78"
        fill="none" stroke="white" strokeWidth="9" strokeLinecap="round"
      />
      {/* Cat silhouette in foreground */}
      <ellipse cx="92" cy="132" rx="17" ry="21" fill={bg} />
      <circle cx="92" cy="107" r="15" fill={bg} />
      <polygon points="80,98 74,83 86,93" fill={bg} />
      <polygon points="104,98 110,83 98,93" fill={bg} />
      <ellipse cx="92" cy="111" rx="7" ry="6" fill="white" opacity="0.18" />
      <ellipse cx="80" cy="149" rx="7" ry="5" fill={bg} />
      <ellipse cx="104" cy="149" rx="7" ry="5" fill={bg} />
    </svg>
  );
}

/* ─── Main export ─────────────────────────────────────────────── */
export default function UltraPetLogo({
  className = '',
  variant = 'full',
  inverted = false,
}: UltraPetLogoProps) {
  if (variant === 'mark') {
    return (
      <div className={className}>
        <CircleMark inverted={inverted} />
      </div>
    );
  }

  return <FullLogo className={className} />;
}
