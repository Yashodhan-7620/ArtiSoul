import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { POLL_MS, createPeer, makeAnswer } from '../lib/webrtc';

// Customer side of a private order livestream: watches the artisan working on
// the customer's own order. Keeps polling, so it connects (or reconnects)
// automatically whenever the artisan is live.
export default function LiveViewer({ order, onClose }) {
  const { token } = useAuth();
  const orderId = order.order_id;
  const videoRef = useRef(null);
  const pc = useRef(null);
  const handled = useRef(null); // stream version we have answered

  const [state, setState] = useState('connecting'); // connecting | waiting | live | ended
  const [error, setError] = useState('');

  useEffect(() => {
    let busy = false;
    let stopped = false;

    const reset = () => {
      pc.current?.close();
      pc.current = null;
      handled.current = null;
    };

    // Ask the artisan's browser for a fresh connection offer.
    const rejoin = async () => {
      reset();
      setState('connecting');
      await api.streams.rejoin(orderId, token);
    };

    const tick = async () => {
      if (busy || stopped) return;
      busy = true;
      try {
        const { data } = await api.streams.state(orderId, token);
        if (data.status !== 'live') {
          reset();
          setState(data.status === 'ended' ? 'ended' : 'waiting');
          return;
        }
        if (handled.current === data.version) return; // answered; media is on its way
        if (!data.offer) {
          setState('connecting'); // artisan is preparing a new offer
          return;
        }
        if (data.answered) {
          await rejoin(); // offer was used by an earlier session (reload, other tab)
          return;
        }

        reset();
        setState('connecting');
        const peer = createPeer();
        pc.current = peer;
        peer.ontrack = (event) => {
          if (videoRef.current) videoRef.current.srcObject = event.streams[0];
        };
        peer.onconnectionstatechange = () => {
          if (pc.current !== peer) return;
          const s = peer.connectionState;
          if (s === 'connected') setState('live');
          else if (s === 'disconnected') setState('connecting');
          else if (s === 'failed') rejoin().catch(() => {});
        };
        const answer = await makeAnswer(peer, data.offer);
        if (pc.current !== peer || stopped) return;
        await api.streams.answer(orderId, answer, data.version, token);
        handled.current = data.version;
        setError('');
      } catch (err) {
        setError(err.message);
      } finally {
        busy = false;
      }
    };

    tick();
    const timer = setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
      reset();
    };
  }, [orderId, token]);

  const message = {
    connecting: 'Connecting to the artisan…',
    waiting: "The artisan isn't live yet. Keep this open and the stream will start on its own.",
    ended: 'The livestream has ended.',
  }[state];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/70 p-4 backdrop-blur-sm">
      <section className="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-ink-900 text-cream-100 shadow-lift">
        <header className="flex items-center gap-3 px-4 py-3">
          {state === 'live' ? (
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
              {order.shop_name} · a private stream of your order
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-cream-200/70 hover:bg-white/10 hover:text-white"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </header>

        <div className="relative aspect-video bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            controls={state === 'live'}
            className={`h-full w-full object-contain ${state === 'live' ? '' : 'invisible'}`}
          />
          {state !== 'live' && (
            <div className="absolute inset-0 grid place-items-center px-8 text-center">
              <div>
                {state === 'connecting' && (
                  <span className="mx-auto mb-3 block h-6 w-6 animate-spin rounded-full border-2 border-cream-200/60 border-t-transparent" />
                )}
                <p className="text-[13px] text-cream-200/80">{message}</p>
              </div>
            </div>
          )}
        </div>
        {error && <p className="px-4 py-2 text-[12px] text-clay-300">{error}</p>}
      </section>
    </div>
  );
}
