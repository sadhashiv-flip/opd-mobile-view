/** Flat-style illustration (trash + figure) for delete-account confirmation. */
export function DeleteAccountIllustration() {
  return (
    <svg
      className="profile-delete-illustration"
      viewBox="0 0 240 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <ellipse cx="120" cy="168" rx="90" ry="8" fill="#E8E8E8" opacity="0.6" />
      {/* Trash */}
      <path
        d="M88 72h64v68H88V72z"
        fill="#E53935"
        stroke="#C62828"
        strokeWidth="1.5"
      />
      <path d="M82 72h76v10H82V72z" fill="#B71C1C" />
      <path d="M98 58h44v8H98v-8z" fill="#FFCDD2" stroke="#E57373" strokeWidth="1" />
      <path d="M108 52h24v6h-24v-6z" fill="#B71C1C" />
      {/* Papers */}
      <rect x="52" y="88" width="22" height="28" rx="2" fill="#FFEBEE" stroke="#E57373" />
      <rect x="48" y="82" width="22" height="28" rx="2" fill="#FFF" stroke="#E57373" />
      <rect x="168" y="90" width="20" height="26" rx="2" fill="#FFEBEE" stroke="#E57373" />
      {/* Figure */}
      <circle cx="168" cy="62" r="14" fill="#FFCCBC" />
      <path
        d="M152 118c4-28 32-28 36 0v22h-36V118z"
        fill="#EC407A"
      />
      <path d="M158 118h24v8h-24v-8z" fill="#880E4F" />
      <path
        d="M145 95c8-6 18-8 28-4"
        stroke="#5D4037"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
