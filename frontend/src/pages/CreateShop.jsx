import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import Icon from '../components/Icon';
import TopBar from '../components/TopBar';
import { Field, Input, TextArea } from '../components/Field';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { FALLBACK } from '../lib/useGeolocation';
import { Container } from '../components/AppShell';

export default function CreateShop() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({
    shop_name: '',
    latitude: '',
    longitude: '',
    address: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // The shop's coordinates are what the Haversine search runs against, so
  // getting them right matters more than any other field on this form.
  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      toast.error('This browser cannot share a location');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setLocating(false);
        toast.success('Pinned to where you are now');
      },
      () => {
        setForm((f) => ({ ...f, latitude: String(FALLBACK.lat), longitude: String(FALLBACK.lng) }));
        setLocating(false);
        toast.error('Location denied — filled in Pune, edit if wrong');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (!form.shop_name.trim()) return setError('Your shop needs a name');
    if (!Number.isFinite(lat) || Math.abs(lat) > 90) return setError('Latitude must be between -90 and 90');
    if (!Number.isFinite(lng) || Math.abs(lng) > 180) return setError('Longitude must be between -180 and 180');

    setBusy(true);
    try {
      await api.shops.create(
        {
          shop_name: form.shop_name.trim(),
          latitude: lat,
          longitude: lng,
          address: form.address.trim() || null,
        },
        token
      );
      toast.success('Shop is live');
      navigate('/artisan', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar title="Open your shop" subtitle="Customers find you by distance" back />

      <form
        onSubmit={handleSubmit}
        className="min-h-0 flex-1 overflow-y-auto scroll-clean px-5 pb-8 pt-5 md:px-8 md:pt-7"
      >
        <Container size="form" className="space-y-4">
        <Field label="Shop name" id="shop_name" hint="How buyers will see you in the feed">
          <Input
            id="shop_name"
            placeholder="Meera's Handloom Studio"
            value={form.shop_name}
            onChange={set('shop_name')}
          />
        </Field>

        <div className="rounded-3xl border border-cream-300 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold text-ink-700">Where you are</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-400">
                This is the pin the "nearby" search measures from.
              </p>
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={useMyLocation} loading={locating}>
              <Icon name="pin" className="h-3.5 w-3.5" strokeWidth={2} />
              Use GPS
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="Latitude" id="latitude">
              <Input
                id="latitude"
                inputMode="decimal"
                placeholder="18.520430"
                value={form.latitude}
                onChange={set('latitude')}
              />
            </Field>
            <Field label="Longitude" id="longitude">
              <Input
                id="longitude"
                inputMode="decimal"
                placeholder="73.856740"
                value={form.longitude}
                onChange={set('longitude')}
              />
            </Field>
          </div>
        </div>

        <Field label="Address" id="address" hint="Optional — shown on the product page">
          <TextArea
            id="address"
            rows={3}
            placeholder="FC Road, Shivajinagar, Pune"
            value={form.address}
            onChange={set('address')}
          />
        </Field>

        {error && (
          <div className="flex items-start gap-2 rounded-2xl bg-clay-50 px-4 py-3 text-[13.5px] font-medium text-clay-700">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
            <span>{error}</span>
          </div>
        )}

          <Button type="submit" size="lg" loading={busy} className="w-full !mt-6">
            Create shop
          </Button>
        </Container>
      </form>
    </div>
  );
}
