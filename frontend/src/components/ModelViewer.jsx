import { useEffect, useRef, useState } from 'react';

// Loaded on demand so the 3D library only downloads when a customer picks it.
export default function ModelViewer({ src, name, room = false }) {
  const viewerRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [canAR, setCanAR] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [camError, setCamError] = useState('');

  useEffect(() => {
    import('@google/model-viewer');
  }, []);

  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return undefined;
    const onLoad = () => setCanAR(Boolean(el.canActivateAR));
    el.addEventListener('load', onLoad);
    return () => el.removeEventListener('load', onLoad);
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  // Release the camera when the viewer closes.
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    []
  );

  const startCamera = async () => {
    setCamError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('Camera needs a secure (https) connection and a supported browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      setCamError('Could not open the camera. Please allow camera access and try again.');
    }
  };

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
        {room ? 'See it in your room' : '3D model'}
      </p>

      <div className="relative overflow-hidden rounded-3xl" style={{ background: cameraOn ? '#000' : '#f6efe4' }}>
        {cameraOn && (
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />
        )}
        <model-viewer
          ref={viewerRef}
          src={src}
          alt={`3D model of ${name}`}
          camera-controls
          ar={room ? '' : undefined}
          ar-modes="webxr scene-viewer quick-look"
          ar-placement="floor"
          touch-action="pan-y"
          shadow-intensity="1"
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1 / 1',
            background: 'transparent',
            '--poster-color': 'transparent',
          }}
        />
      </div>

      {room && (
        <div className="flex flex-wrap gap-2">
          {canAR && (
            <button
              type="button"
              onClick={() => viewerRef.current?.activateAR()}
              className="rounded-full bg-clay-500 px-4 py-2 text-[13px] font-semibold text-white active:scale-95"
            >
              View in your room (AR)
            </button>
          )}
          <button
            type="button"
            onClick={cameraOn ? stopCamera : startCamera}
            className="rounded-full border border-cream-300 bg-white px-4 py-2 text-[13px] font-semibold text-ink-700 active:scale-95"
          >
            {cameraOn ? 'Turn camera off' : 'Use camera overlay'}
          </button>
        </div>
      )}
      {camError && <p className="text-[12.5px] text-clay-600">{camError}</p>}
      <p className="text-center text-[12px] text-ink-400">
        {room
          ? cameraOn
            ? 'Drag to rotate · pinch to resize, and point the camera where you want it.'
            : 'AR places it on your floor at real size on supported phones. Camera overlay works on any device.'
          : 'Drag to rotate · pinch or scroll to zoom'}
      </p>
    </div>
  );
}
