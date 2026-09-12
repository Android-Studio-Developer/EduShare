// Bold, filled glyphs for the V4 "OS" desktop — swapped in for the plain
// Lucide line-icons, which read as generic/templated sitting in a gradient
// squircle. These lean on solid shapes + layered opacity instead of thin
// strokes, closer to how macOS app icons build a glyph.

export function IconMemes() {
  return (
    <svg viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="12.5" fill="currentColor" opacity=".22" />
      <circle cx="16" cy="16" r="12.5" stroke="currentColor" strokeWidth="1.6" opacity=".55" />
      <circle cx="11.5" cy="13" r="1.8" fill="currentColor" />
      <circle cx="20.5" cy="13" r="1.8" fill="currentColor" />
      <path d="M9.5 18c1.6 3 4 4.5 6.5 4.5s4.9-1.5 6.5-4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function IconCalculator() {
  return (
    <svg viewBox="0 0 32 32" fill="none">
      <rect x="6" y="4" width="20" height="24" rx="4" fill="currentColor" opacity=".22" />
      <rect x="6" y="4" width="20" height="24" rx="4" stroke="currentColor" strokeWidth="1.6" opacity=".55" />
      <rect x="9.5" y="7.5" width="13" height="6" rx="1.4" fill="currentColor" />
      <circle cx="10.7" cy="18" r="1.6" fill="currentColor" />
      <circle cx="16" cy="18" r="1.6" fill="currentColor" />
      <circle cx="21.3" cy="18" r="1.6" fill="currentColor" />
      <circle cx="10.7" cy="23" r="1.6" fill="currentColor" />
      <circle cx="16" cy="23" r="1.6" fill="currentColor" />
      <circle cx="21.3" cy="23" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function IconDiscover() {
  return (
    <svg viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="12" fill="currentColor" opacity=".22" />
      <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.6" opacity=".55" />
      <path d="M21 11l-3.4 7.4L10 22l3.4-7.6L21 11z" fill="currentColor" />
      <circle cx="16" cy="16" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function IconBrowse() {
  return (
    <svg viewBox="0 0 32 32" fill="none">
      <circle cx="14.5" cy="14.5" r="8.5" fill="currentColor" opacity=".24" />
      <circle cx="14.5" cy="14.5" r="8.5" stroke="currentColor" strokeWidth="2.2" />
      <rect x="20.5" y="20.5" width="3" height="8" rx="1.5" transform="rotate(-45 20.5 20.5)" fill="currentColor" />
    </svg>
  );
}

export function IconChat() {
  return (
    <svg viewBox="0 0 32 32" fill="none">
      <path d="M6 9a3 3 0 013-3h14a3 3 0 013 3v9a3 3 0 01-3 3H14l-5.5 4.5a1 1 0 01-1.5-.8V21H9a3 3 0 01-3-3V9z" fill="currentColor" />
      <circle cx="12" cy="13.5" r="1.4" fill="var(--color-surface, #0b1220)" opacity=".85" />
      <circle cx="16" cy="13.5" r="1.4" fill="var(--color-surface, #0b1220)" opacity=".85" />
      <circle cx="20" cy="13.5" r="1.4" fill="var(--color-surface, #0b1220)" opacity=".85" />
    </svg>
  );
}

export function IconFriends() {
  return (
    <svg viewBox="0 0 32 32" fill="none">
      <circle cx="12.5" cy="11.5" r="4.5" fill="currentColor" opacity=".9" />
      <path d="M4 25c0-4.4 3.8-7.5 8.5-7.5s8.5 3.1 8.5 7.5v.5H4V25z" fill="currentColor" opacity=".9" />
      <circle cx="21.5" cy="10.5" r="3.4" fill="currentColor" opacity=".45" />
      <path d="M27.5 22.3c-.3-3.2-2.9-5.4-6-5.7.9 1.3 1.5 2.9 1.6 4.7.1.9 0 1.8-.2 2.7h4.8l-.2-1.7z" fill="currentColor" opacity=".45" />
    </svg>
  );
}

export function IconVoice() {
  return (
    <svg viewBox="0 0 32 32" fill="none">
      <rect x="12.5" y="5" width="7" height="13" rx="3.5" fill="currentColor" />
      <path d="M8.5 15.5a7.5 7.5 0 0015 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M16 23v4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M11.5 27h9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function IconArcade() {
  return (
    <svg viewBox="0 0 32 32" fill="none">
      <path d="M8 11h16a5 5 0 015 5.6l-.9 5.4a3.4 3.4 0 01-6-1.4l-.4-1.6H10.3l-.4 1.6a3.4 3.4 0 01-6 1.4L3 16.6A5 5 0 018 11z" fill="currentColor" />
      <rect x="9" y="14.3" width="1.8" height="5" rx=".9" fill="var(--color-surface, #0b1220)" opacity=".85" />
      <rect x="7.1" y="16.2" width="5.6" height="1.8" rx=".9" fill="var(--color-surface, #0b1220)" opacity=".85" />
      <circle cx="19.5" cy="15.5" r="1.5" fill="var(--color-surface, #0b1220)" opacity=".85" />
      <circle cx="23" cy="18.5" r="1.5" fill="var(--color-surface, #0b1220)" opacity=".85" />
    </svg>
  );
}

export function IconDashboard() {
  return (
    <svg viewBox="0 0 32 32" fill="none">
      <rect x="5" y="5" width="12" height="9" rx="3" fill="currentColor" />
      <rect x="19" y="5" width="8" height="14" rx="3" fill="currentColor" opacity=".55" />
      <rect x="5" y="16" width="8" height="11" rx="3" fill="currentColor" opacity=".55" />
      <rect x="15" y="21" width="12" height="6" rx="3" fill="currentColor" />
    </svg>
  );
}

export function IconNotifications() {
  return (
    <svg viewBox="0 0 32 32" fill="none">
      <path d="M16 5a2 2 0 012 2v1.1c3.4.9 6 4 6 7.7v4.3l2 2.9H6l2-2.9v-4.3c0-3.7 2.6-6.8 6-7.7V7a2 2 0 012-2z" fill="currentColor" />
      <path d="M12.5 25a3.5 3.5 0 007 0z" fill="currentColor" />
    </svg>
  );
}

export function IconProfile() {
  return (
    <svg viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="12.5" fill="currentColor" opacity=".2" />
      <circle cx="16" cy="12.5" r="4.5" fill="currentColor" />
      <path d="M7 25c1-4.6 4.6-7 9-7s8 2.4 9 7a12.5 12.5 0 01-18 0z" fill="currentColor" />
    </svg>
  );
}

export function IconPlayers() {
  return (
    <svg viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="9.5" r="4" fill="currentColor" />
      <path d="M8 22.5c0-4.1 3.4-6.5 8-6.5s8 2.4 8 6.5V24H8v-1.5z" fill="currentColor" />
      <circle cx="6" cy="12" r="3" fill="currentColor" opacity=".45" />
      <circle cx="26" cy="12" r="3" fill="currentColor" opacity=".45" />
      <path d="M2 22c.2-2.9 2.2-4.7 4.8-5-1 1.3-1.6 3-1.6 5v1H2v-1z" fill="currentColor" opacity=".45" />
      <path d="M30 22c-.2-2.9-2.2-4.7-4.8-5 1 1.3 1.6 3 1.6 5v1h3.2v-1z" fill="currentColor" opacity=".45" />
    </svg>
  );
}

export function IconGroups() {
  return (
    <svg viewBox="0 0 32 32" fill="none">
      <path d="M16 4l9 3.2v6.6c0 6.4-3.9 10.9-9 12.6-5.1-1.7-9-6.2-9-12.6V7.2L16 4z" fill="currentColor" />
      <path d="M16 4v22.4c-5.1-1.7-9-6.2-9-12.6V7.2L16 4z" fill="currentColor" opacity=".35" />
      <path d="M12 16l2.7 2.7L20 13.2" stroke="var(--color-surface, #0b1220)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".85" fill="none" />
    </svg>
  );
}

export function IconShares() {
  return (
    <svg viewBox="0 0 32 32" fill="none">
      <path d="M16 4l8 4.6v9.2L16 22.4l-8-4.6V8.6L16 4z" fill="currentColor" />
      <path d="M16 4l8 4.6-8 4.6-8-4.6L16 4z" fill="currentColor" opacity=".55" />
      <path d="M16 13.2v9.2l-8-4.6V8.6l8 4.6z" fill="currentColor" opacity=".8" />
      <path d="M8 24l8 4.5 8-4.5-8-4.4-8 4.4z" fill="currentColor" opacity=".35" />
    </svg>
  );
}

export function IconBedwars() {
  return (
    <svg viewBox="0 0 32 32" fill="none">
      <path d="M6 6l8 8-2.5 2.5-8-8L6 6z" fill="currentColor" />
      <rect x="4.6" y="4.6" width="4.2" height="2.2" rx=".8" transform="rotate(45 6.7 5.7)" fill="currentColor" />
      <path d="M26 6l-8 8 2.5 2.5 8-8L26 6z" fill="currentColor" opacity=".8" />
      <rect x="23.2" y="4.6" width="4.2" height="2.2" rx=".8" transform="rotate(-45 25.3 5.7)" fill="currentColor" opacity=".8" />
      <path d="M11.5 16.5l4.5 4.5-6 6-4-2 1.5-4.5 4-4z" fill="currentColor" opacity=".55" />
    </svg>
  );
}

export function IconTeam() {
  return (
    <svg viewBox="0 0 32 32" fill="none">
      <path d="M16 3l3.6 7.1 7.9 1.1-5.7 5.5 1.3 7.8L16 20.9 8.9 24.5l1.3-7.8-5.7-5.5 7.9-1.1L16 3z" fill="currentColor" />
    </svg>
  );
}

export function IconGuide() {
  return (
    <svg viewBox="0 0 32 32" fill="none">
      <path d="M16 9.5C13.8 7.8 10.8 7 7 7v15c3.8 0 6.8.8 9 2.5V9.5z" fill="currentColor" />
      <path d="M16 9.5c2.2-1.7 5.2-2.5 9-2.5v15c-3.8 0-6.8.8-9 2.5V9.5z" fill="currentColor" opacity=".6" />
    </svg>
  );
}

export function IconChangelog() {
  return (
    <svg viewBox="0 0 32 32" fill="none">
      <path d="M16 3l2.4 8.6L27 14l-8.6 2.4L16 25l-2.4-8.6L5 14l8.6-2.4L16 3z" fill="currentColor" />
      <circle cx="25" cy="24" r="2.4" fill="currentColor" opacity=".55" />
    </svg>
  );
}

export function IconWallpaper() {
  return (
    <svg viewBox="0 0 32 32" fill="none">
      <path d="M16 4c-7.2 0-12 5.2-12 11.5S9.8 26 16.5 26c1.7 0 2.8-1.1 2.8-2.5 0-.7-.3-1.2-.7-1.7-.4-.5-.7-1-.7-1.7 0-1.4 1.1-2.5 2.6-2.5H23c3 0 5-2.1 5-5C28 7.6 22.6 4 16 4z" fill="currentColor" opacity=".28" />
      <circle cx="10.5" cy="13" r="2" fill="currentColor" />
      <circle cx="16" cy="9.5" r="2" fill="currentColor" opacity=".7" />
      <circle cx="21.5" cy="13" r="2" fill="currentColor" opacity=".5" />
      <circle cx="11.5" cy="19" r="2" fill="currentColor" opacity=".85" />
    </svg>
  );
}
