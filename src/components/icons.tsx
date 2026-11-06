// Minimal 1.8px line icons (24px grid).
type P = { size?: number };
const base = (size = 18) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const IconBag = ({ size }: P) => (
  <svg {...base(size)}><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
);
export const IconShield = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 3 5 5.8v5.6c0 4.4 3 7.8 7 9.1 4-1.3 7-4.7 7-9.1V5.8L12 3Z" /><path d="m9 12 2.2 2.2L15.5 10" /></svg>
);
export const IconHandshake = ({ size }: P) => (
  <svg {...base(size)}><path d="m11 17 2 2a1.4 1.4 0 0 0 2-2" /><path d="m14 14 2.5 2.5a1.4 1.4 0 0 0 2-2l-3.9-3.9a2.8 2.8 0 0 0-4 0l-.9.9a1.4 1.4 0 0 1-2-2l2.8-2.8a4 4 0 0 1 4.8-.6l.5.3a3 3 0 0 0 2 .4H21" /><path d="M21 4v9h-2" /><path d="M3 4h8" /><path d="M3 4v9h2l4 4a1.4 1.4 0 0 0 2-2" /></svg>
);
export const IconCheck = ({ size }: P) => (
  <svg {...base(size)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const IconSpark = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></svg>
);
export const IconRefresh = ({ size }: P) => (
  <svg {...base(size)}><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" /><path d="M20 20v-4h-4" /></svg>
);
export const IconSend = ({ size }: P) => (
  <svg {...base(size)}><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></svg>
);
export const IconBolt = ({ size }: P) => (
  <svg {...base(size)}><path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" /></svg>
);
export const IconDoc = ({ size }: P) => (
  <svg {...base(size)}><path d="M7 3h7l4 4v14H7V3Z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></svg>
);
export const IconX = ({ size }: P) => (
  <svg {...base(size)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconTruck = ({ size }: P) => (
  <svg {...base(size)}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></svg>
);
export const IconArrow = ({ size }: P) => (
  <svg {...base(size)}><path d="M7 17 17 7M9 7h8v8" /></svg>
);
export const IconSun = ({ size }: P) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></svg>
);
export const IconMoon = ({ size }: P) => (
  <svg {...base(size)}><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" /></svg>
);
export const IconMonitor = ({ size }: P) => (
  <svg {...base(size)}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>
);
