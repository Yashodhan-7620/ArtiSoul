import { useState } from 'react';

// Swipeable photo/video preview. The main image is always the first slide.
export default function MediaGallery({ items, name }) {
  const [index, setIndex] = useState(0);
  if (items.length === 0) {
    return (
      <div className="space-y-2.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">Preview</p>
        <p className="rounded-3xl bg-cream-200 px-4 py-6 text-center text-[13px] text-ink-500">
          The artisan hasn't added a preview yet.
        </p>
      </div>
    );
  }

  const current = items[Math.min(index, items.length - 1)];

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">Preview</p>
      <div className="overflow-hidden rounded-3xl bg-ink-900">
        {current.media_type === 'video' ? (
          <video
            key={current.url}
            src={current.url}
            controls
            playsInline
            className="aspect-video w-full bg-black object-contain"
          />
        ) : (
          <img
            key={current.url}
            src={current.url}
            alt={`${name} preview ${index + 1}`}
            className="aspect-video w-full object-contain"
          />
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto scroll-clean pb-1">
        {items.map((m, i) => (
          <button
            key={m.url}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Show ${m.media_type} ${i + 1}`}
            className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 bg-cream-200 ${
              i === index ? 'border-clay-500' : 'border-transparent'
            }`}
          >
            {m.media_type === 'video' ? (
              <span className="grid h-full w-full place-items-center bg-ink-800 text-cream-100">▶</span>
            ) : (
              <img src={m.url} alt="" className="h-full w-full object-cover" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
