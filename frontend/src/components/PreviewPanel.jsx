import { useState } from 'react';
import Viewer360 from './Viewer360';
import ModelViewer from './ModelViewer';
import MediaGallery from './MediaGallery';

// Shows only the preview modes the artisan provided. Nothing loads or plays
// until the customer picks one, which keeps weak devices and data plans safe.
export default function PreviewPanel({ product }) {
  const [mode, setMode] = useState(null);

  const views = product.views360 || {};
  const gallery = product.media || [];
  const modes = [
    product.view360_enabled && { id: '360', label: '360° photos' },
    product.model_url && { id: '3d', label: '3D model' },
    gallery.length > 0 && { id: 'gallery', label: 'Photos & videos' },
  ].filter(Boolean);

  if (modes.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">Preview this product</p>
      <div className="flex flex-wrap gap-2">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(mode === m.id ? null : m.id)}
            aria-pressed={mode === m.id}
            className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition active:scale-95 ${
              mode === m.id
                ? 'border-clay-500 bg-clay-500 text-white'
                : 'border-cream-300 bg-white text-ink-700 hover:bg-cream-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === '360' && <Viewer360 views={views} name={product.name} />}
      {mode === '3d' && <ModelViewer src={product.model_url} name={product.name} />}
      {mode === 'gallery' && (
        <MediaGallery
          name={product.name}
          items={[
            ...(product.image_url ? [{ media_type: 'image', url: product.image_url }] : []),
            ...gallery,
          ]}
        />
      )}
    </div>
  );
}
