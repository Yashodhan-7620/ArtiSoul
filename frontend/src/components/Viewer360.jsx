import { useEffect, useRef, useState } from 'react';

const RING = ['front', 'right', 'back', 'left'];

// Drag left/right to turn the product through its four side photos (adjacent
// photos are cross-faded for a smooth turn); drag up/down to tilt toward the
// top/bottom photos when they exist.
export default function Viewer360({ views, name }) {
  const [yaw, setYaw] = useState(0); // degrees, 0 = front
  const [pitch, setPitch] = useState(0); // -1 (bottom) .. 1 (top)
  const [auto, setAuto] = useState(false);
  const drag = useRef(null);

  useEffect(() => {
    if (!auto) return undefined;
    const t = setInterval(() => setYaw((y) => (y + 0.5) % 360), 40);
    return () => clearInterval(t);
  }, [auto]);

  if (!RING.every((a) => views[a])) return null;

  const pos = (((yaw % 360) + 360) % 360) / 90;
  const i = Math.floor(pos) % 4;
  const frac = pos - Math.floor(pos);
  const a = views[RING[i]];
  const b = views[RING[(i + 1) % 4]];
  const cap = (v) => (v === 'top' ? (views.top ? 1 : 0) : views.bottom ? 1 : 0);
  const topOpacity = pitch > 0 ? pitch * cap('top') : 0;
  const bottomOpacity = pitch < 0 ? -pitch * cap('bottom') : 0;

  const onDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
    setAuto(false);
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    setYaw((y) => y - dx * 0.4);
    if (views.top || views.bottom) {
      setPitch((p) => Math.max(views.bottom ? -1 : 0, Math.min(views.top ? 1 : 0, p + dy * 0.01)));
    }
  };
  const onUp = () => {
    drag.current = null;
    setPitch(0);
  };

  const layer = 'absolute inset-0 h-full w-full object-contain';

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">360Â° view</p>
        <button
          type="button"
          onClick={() => setAuto((v) => !v)}
          className="rounded-full bg-cream-200 px-3 py-1 text-[12px] font-semibold text-ink-700"
        >
          {auto ? 'Pause' : 'Play'}
        </button>
      </div>
      <div
        role="img"
        aria-label={`360 degree view of ${name}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ touchAction: 'pan-y' }}
        className="relative aspect-square w-full cursor-grab select-none overflow-hidden rounded-3xl bg-cream-100 active:cursor-grabbing"
      >
        <img src={a} alt="" draggable={false} className={layer} />
        <img src={b} alt="" draggable={false} className={layer} style={{ opacity: frac }} />
        {views.top && <img src={views.top} alt="" draggable={false} className={layer} style={{ opacity: topOpacity }} />}
        {views.bottom && <img src={views.bottom} alt="" draggable={false} className={layer} style={{ opacity: bottomOpacity }} />}
        <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink-900/60 px-3 py-1 text-[11.5px] font-medium text-cream-100">
          Drag to rotate{views.top || views.bottom ? ' Â· up/down to tilt' : ''}
        </span>
      </div>
    </div>
  );
}
