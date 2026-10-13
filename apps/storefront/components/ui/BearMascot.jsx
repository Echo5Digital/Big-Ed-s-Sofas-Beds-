// PLACEHOLDER MASCOT ARTWORK.
// No approved "Big Ed" bear illustration asset was supplied with this project.
// This is a simple original SVG stand-in so the layout, sizing, and composition
// are ready to receive the official mascot artwork. Replace the <svg> below with
// the client-approved Big Ed bear illustration before launch — do not present
// this placeholder as final branding.

export default function BearMascot({ className = "", pose = "wave" }) {
  return (
    <svg
      viewBox="0 0 320 360"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Big Ed mascot placeholder illustration — bear character wearing blue overalls"
    >
      <ellipse cx="160" cy="340" rx="110" ry="16" fill="#000000" opacity="0.12" />
      <circle cx="160" cy="150" r="108" fill="#A9652E" />
      <circle cx="70" cy="80" r="34" fill="#A9652E" />
      <circle cx="250" cy="80" r="34" fill="#A9652E" />
      <circle cx="70" cy="80" r="16" fill="#7A4420" />
      <circle cx="250" cy="80" r="16" fill="#7A4420" />
      <ellipse cx="160" cy="175" rx="62" ry="50" fill="#D8A066" />
      <circle cx="128" cy="135" r="10" fill="#2B1B10" />
      <circle cx="192" cy="135" r="10" fill="#2B1B10" />
      <ellipse cx="160" cy="175" rx="20" ry="14" fill="#2B1B10" />
      {pose === "wave" ? (
        <path
          d="M160 205 q-18 18 -40 14"
          stroke="#2B1B10"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M135 208 q25 18 50 0"
          stroke="#2B1B10"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
      )}
      <path
        d="M70 220 h180 l-16 110 a20 20 0 0 1 -20 18 h-108 a20 20 0 0 1 -20 -18 z"
        fill="#2E5FA3"
      />
      <rect x="92" y="186" width="34" height="56" rx="6" fill="#2E5FA3" />
      <rect x="194" y="186" width="34" height="56" rx="6" fill="#2E5FA3" />
      <circle cx="109" cy="236" r="6" fill="#F7BF32" />
      <circle cx="211" cy="236" r="6" fill="#F7BF32" />
      <rect x="118" y="252" width="84" height="20" rx="4" fill="#F7BF32" opacity="0.9" />
      <circle cx="235" cy="60" r="30" fill="transparent" />
      {pose === "wave" && (
        <g>
          <circle cx="245" cy="195" r="20" fill="#A9652E" />
          <circle cx="245" cy="195" r="9" fill="#D8A066" />
        </g>
      )}
      {pose === "thumbsup" && (
        <g>
          <rect x="222" y="170" width="26" height="40" rx="10" fill="#A9652E" />
          <rect x="228" y="150" width="14" height="28" rx="7" fill="#A9652E" />
        </g>
      )}
    </svg>
  );
}
