import { useCallback, useEffect, useRef, useState } from 'react';
import Button from './Button';
import Icon from './Icon';
import { api, API_BASE } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { POLL_MS, cameraErrorMessage, createPeer, makeOffer } from '../lib/webrtc';

// Artisan side of a private order livestream. The camera feed goes straight
// to the browser of the customer who placed `order`, and nobody else: the API
// only hands the connection details to that order's customer.
export default function LiveBroadcast({ order, onClose }) {
  const { token } = useAuth();
  const orderId = order.order_id;

  const videoRef = useRef(null);
  const media = useRef(null);
  const pc = useRef(null);
  const version = useRef(0);
  const answered = useRef(false);
  const live = useRef(false);

  // preview -> starting -> live -> ended, or error at any point.
  // Without mediaDevices (plain-HTTP origin, old browser) there is no camera.
  const hasCamera = Boolean(navigator.mediaDevices?.getUserMedia);
  const [phase, setPhase] = useState(hasCamera ? 'preview' : 'error');
  const [viewer, setViewer] = useState('waiting'); // waiting | connected | reconnecting
  const [error, setError] = useState(hasCamera ? '' : cameraErrorMessage);

  // Open the camera as soon as the panel appears, so the artisan can frame
  // the shot before going live.
  useEffect(() => {
    let cancelled = false;
    if (!hasCamera) return undefined;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        media.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch((err) => {
        setError(cameraErrorMessage(err));
        setPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, [hasCamera]);

  // One fresh peer connection per viewer session.
  const newPeer = useCallback(() => {
    pc.current?.close();
    const peer = createPeer();
    media.current.getTracks().forEach((track) => peer.addTrack(track, media.current));
    peer.onconnectionstatechange = () => {
      if (pc.current !== peer) return;
      const s = peer.connectionState;
      if (s === 'connected') setViewer('connected');
      else if (s === 'disconnected') setViewer('reconnecting');
      else if (s === 'failed' || s === 'closed') setViewer('waiting');
    };
    pc.current = peer;
    answered.current = false;
    setViewer('waiting');
    return peer;
  }, []);

  const start = async () => {
    if (!media.current) return;
    setPhase('starting');
    setError('');
    try {
      const offer = await makeOffer(newPeer());
      const { data } = await api.streams.start(orderId, offer, token);
      version.current = data.version;
      live.current = true;
      setPhase('live');
    } catch (err) {
      setError(err.message);
      setPhase('preview');
    }
  };

  // While live, poll for the viewer's answer, or for a rejoin request
  // (the customer reloaded or their connection dropped).
  useEffect(() => {
    if (phase !== 'live') return undefined;
    let busy = false;
    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        const { data } = await api.streams.state(orderId, token);
        if (data.status !== 'live') {
          live.current = false;
          pc.current?.close();
          setPhase('ended');
          return;
        }
        if (data.needs_offer && data.version !== version.current) {
          const offer = await makeOffer(newPeer());
          await api.streams.offer(orderId, offer, data.version, token);
          version.current = data.version;
        } else if (data.version === version.current && data.answer && !answered.current) {
          answered.current = true;
          await pc.current.setRemoteDescription(data.answer);
        }
        setError('');
      } catch (err) {
        setError(err.message);
      } finally {
        busy = false;
      }
    };
    tick();
    const timer = setInterval(tick, POLL_MS);
    return () => clearInterval(timer);
  }, [phase, orderId, token, newPeer]);

  // Leaving the page or closing the panel ends the stream for the viewer too.
  useEffect(() => {
    const endOnExit = () => {
      if (!live.current) return;
      live.current = false;
      fetch(`${API_BASE}/api/streams/${orderId}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener('pagehide', endOnExit);
    return () => {
      window.removeEventListener('pagehide', endOnExit);
      endOnExit();
      pc.current?.close();
      media.current?.getTracks().forEach((t) => t.stop());
    };
  }, [orderId, token]);

  const end = async () => {
    if (live.current) {
      live.current = false;
      try {
        await api.streams.end(orderId, token);
      } catch {
        /* closing anyway; the stream is ended again when the order moves on */
      }
    }
    onClose();
  };

  const status = {
    preview: 'Camera preview: only you can see this',
    starting: 'Going live…',
    live:
      viewer === 'connected'
        ? `${order.customer_name} is watching`
        : viewer === 'reconnecting'
          ? `Reconnecting to ${order.customer_name}…`
          : `Live. Waiting for ${order.customer_name} to join`,
    ended: 'Livestream ended',
    error: 'Camera unavailable',
  }[phase];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/70 p-4 backdrop-blur-sm">
      <section className="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-ink-900 text-cream-100 shadow-lift">
        <header className="flex items-center gap-3 px-4 py-3">
          {phase === 'live' ? (
            <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              Live
            </span>
          ) : (
            <Icon name="video" className="h-5 w-5 text-clay-300" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold">{order.product_name}</p>
            <p className="truncate text-[11.5px] text-cream-200/60">
              Private stream for {order.customer_name} · Order #{orderId}
            </p>
          </div>
          <button
            onClick={end}
            aria-label="Close"
            className="rounded-lg p-1.5 text-cream-200/70 hover:bg-white/10 hover:text-white"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </header>

        <div className="relative aspect-video bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          {phase === 'error' && (
            <div className="absolute inset-0 grid place-items-center px-8 text-center text-[13px] text-cream-200/80">
              {error}
            </div>
          )}
        </div>

        <div className="space-y-3 px-4 py-4">
          <p className="text-[13px] text-cream-200/80">{status}</p>
          {error && phase !== 'error' && <p className="text-[12px] text-clay-300">{error}</p>}

          {phase === 'preview' || phase === 'starting' ? (
            <Button className="w-full" onClick={start} loading={phase === 'starting'}>
              <Icon name="video" className="h-4 w-4" />
              Start livestream
            </Button>
          ) : phase === 'live' ? (
            <Button className="w-full !bg-red-600 hover:!bg-red-700" onClick={end}>
              End livestream
            </Button>
          ) : (
            <Button variant="outline" className="w-full" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
