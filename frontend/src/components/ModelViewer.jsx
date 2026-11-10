import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

const IS_MOBILE =
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Desktop-only: a QR code that opens this same page on the customer's phone.
function PhoneQr() {
  const [dataUrl, setDataUrl] = useState('');
  const base = (import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/$/, '');
  const link = `${base}${window.location.pathname}${window.location.search}`;
  const isLocal = /^(localhost|127\.|\[?::1)/.test(new URL(link).hostname);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(link, { margin: 1, width: 200 }).then((url) => !cancelled && setDataUrl(url));
    return () => {
      cancelled = true;
    };
  }, [link]);

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-cream-300 bg-white p-3">
      {dataUrl && <img src={dataUrl} alt="QR code to open this product on your phone" className="h-28 w-28 shrink-0" />}
      <div className="text-[12.5px] leading-relaxed text-ink-500">
        <p className="text-[13.5px] font-semibold text-ink-800">Open on your phone for AR</p>
        <p>Scan this code with your phone camera, then choose “View in your room”.</p>
        {isLocal && (
          <p className="mt-1 font-medium text-clay-600">
            This address only works on this computer. Open the site through its public https link to make the code work on a phone.
          </p>
        )}
      </div>
    </div>
  );
}

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
      {room && !IS_MOBILE && !canAR && <PhoneQr />}
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
