import { useCallback, useEffect, useState } from 'react';

// Pune — matches the coordinates used in the Phase 2 README examples, so the
// feed still shows something when the browser denies location access.
export const FALLBACK = { lat: 18.5204, lng: 73.8567, label: 'Pune (default)' };

export function useGeolocation() {
  const [coords, setCoords] = useState(FALLBACK);
  const [status, setStatus] = useState('idle'); // idle | locating | granted | denied

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('denied');
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          label: 'Your location',
        });
        setStatus('granted');
      },
      () => {
        // Denied or timed out — keep the fallback so the feed still works.
        setCoords(FALLBACK);
        setStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
    );
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  return { coords, status, locate, setCoords };
}
