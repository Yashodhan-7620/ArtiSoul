import { useEffect } from 'react';

// Loaded on demand so the 3D library only downloads when a customer picks it.
export default function ModelViewer({ src, name }) {
  useEffect(() => {
    import('@google/model-viewer');
  }, []);

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">3D model</p>
      <model-viewer
        src={src}
        alt={`3D model of ${name}`}
        camera-controls
        touch-action="pan-y"
        shadow-intensity="1"
        style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: '1.5rem', background: '#f6efe4' }}
      />
      <p className="text-center text-[12px] text-ink-400">Drag to rotate · pinch or scroll to zoom</p>
    </div>
  );
}
