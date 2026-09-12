// One tiny stroke-icon set so the app has no icon-library dependency
// and every glyph shares the same weight.
const PATHS = {
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.2-12.2-2 4.6-4.4 2.2 2-4.6 4.4-2.2Z',
  store: 'M4 9h16m-16 0 1.2-4A1 1 0 0 1 6.2 4h11.6a1 1 0 0 1 1 .7L20 9M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M4 9a2.5 2.5 0 0 0 4 1.6A2.5 2.5 0 0 0 12 9a2.5 2.5 0 0 0 4 1.6A2.5 2.5 0 0 0 20 9',
  plus: 'M12 5v14M5 12h14',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 8a8 8 0 0 0-16 0',
  pin: 'M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  back: 'M15 19l-7-7 7-7',
  camera:
    'M4 8.5A1.5 1.5 0 0 1 5.5 7h2L9 5h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Zm8 8a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 5 5',
  check: 'M4 12.5l5 5L20 6.5',
  alert: 'M12 8v5m0 3.5v.5M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z',
  logout: 'M15 17l5-5-5-5M20 12H9M13 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7',
  box: 'M3.5 7.5 12 3l8.5 4.5M3.5 7.5v9L12 21m-8.5-13.5L12 12m0 9 8.5-4.5v-9M12 12l8.5-4.5M12 12v9',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z',
  chevron: 'M9 6l6 6-6 6',
  trash: 'M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13',
  refresh: 'M20 11a8 8 0 1 0-.6 4M20 5v6h-6',
};

export default function Icon({ name, className = 'h-5 w-5', strokeWidth = 1.75, ...rest }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}
