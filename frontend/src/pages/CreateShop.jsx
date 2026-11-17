import { useEffect, useRef, useState } from 'react';
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
import { useT } from '../i18n';

const MAX_BYTES = 5 * 1024 * 1024;

export default function CreateShop() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useT();
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    shop_name: '',
    latitude: '',
    longitude: '',
    address: '',
  });
  const [picture, setPicture] = useState(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  // Shop details are permanent once created, so the owner must acknowledge it.
  const [acknowledged, setAcknowledged] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    if (!picture) return undefined;
    const url = URL.createObjectURL(picture);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [picture]);

  function pickPicture(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error(t('add.not_image'));
    if (file.size > MAX_BYTES) return toast.error(t('add.too_big'));
    setPicture(file);
  }

  // The shop's coordinates are what the Haversine search runs against, so
  // getting them right matters more than any other field on this form.
  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      toast.error(t('shop.no_geo'));
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
        toast.success(t('shop.pinned'));
      },
      () => {
        setForm((f) => ({ ...f, latitude: String(FALLBACK.lat), longitude: String(FALLBACK.lng) }));
        setLocating(false);
        toast.error(t('shop.geo_denied'));
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (!form.shop_name.trim()) return setError(t('shop.need_name'));
    if (!Number.isFinite(lat) || Math.abs(lat) > 90) return setError(t('shop.bad_lat'));
    if (!Number.isFinite(lng) || Math.abs(lng) > 180) return setError(t('shop.bad_lng'));
    if (!acknowledged) return setError(t('shop.need_ack'));

    const confirmed = window.confirm(
      t('shop.final_confirm', {
        name: form.shop_name.trim(),
        lat,
        lng,
        address: form.address.trim() || t('shop.none'),
        picture: picture ? t('shop.picture_yes') : t('shop.none'),
      })
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      let image_url = null;
      if (picture) {
        const { data } = await api.uploads.image(picture, token);
        image_url = data.image_url;
      }
      await api.shops.create(
        {
          shop_name: form.shop_name.trim(),
          latitude: lat,
          longitude: lng,
          address: form.address.trim() || null,
          image_url,
        },
        token
      );
      toast.success(t('shop.live'));
      navigate('/artisan', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar title={t('shop.create_title')} subtitle={t('shop.create_subtitle')} back />

      <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto scroll-clean px-5 pb-8 pt-5 md:px-8 md:pt-7">
        <Container size="form" className="space-y-4">
          <Field label={t('shop.name')} id="shop_name" hint={t('shop.name_hint')}>
            <Input id="shop_name" placeholder="Meera's Handloom Studio" value={form.shop_name} onChange={set('shop_name')} />
          </Field>

          <div>
            <span className="field-label">{t('shop.picture')}</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-cream-300 bg-white text-clay-500 hover:border-clay-300"
                aria-label={t('shop.add_picture')}
              >
                {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <Icon name="camera" className="h-6 w-6" />}
              </button>
              <div className="text-[12.5px] text-ink-400">
                <p>{t('shop.picture_hint')}</p>
                {picture && (
                  <button type="button" onClick={() => {
                      setPicture(null);
                      setPreview('');
                    }} className="mt-1 font-semibold text-clay-600 hover:underline">
                    {t('common.remove')}
                  </button>
                )}
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pickPicture(e.target.files?.[0])} />
          </div>

          <div className="rounded-3xl border border-cream-300 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[14px] font-semibold text-ink-700">{t('shop.where')}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-400">{t('shop.where_hint')}</p>
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={useMyLocation} loading={locating}>
                <Icon name="pin" className="h-3.5 w-3.5" strokeWidth={2} />
                {t('shop.use_gps')}
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label={t('shop.latitude')} id="latitude">
                <Input id="latitude" inputMode="decimal" placeholder="18.520430" value={form.latitude} onChange={set('latitude')} />
              </Field>
              <Field label={t('shop.longitude')} id="longitude">
                <Input id="longitude" inputMode="decimal" placeholder="73.856740" value={form.longitude} onChange={set('longitude')} />
              </Field>
            </div>
          </div>

          <Field label={t('shop.address')} id="address" hint={t('shop.address_hint')}>
            <TextArea id="address" rows={3} placeholder="FC Road, Shivajinagar, Pune" value={form.address} onChange={set('address')} />
          </Field>

          <label
            htmlFor="acknowledge"
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-saffron-400 bg-saffron-100 px-4 py-3"
          >
            <input
              id="acknowledge"
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-clay-500"
            />
            <span className="text-[13px] leading-relaxed text-ink-700">
              <span className="font-semibold">{t('shop.ack_strong')}</span> {t('shop.ack_rest')}
            </span>
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-2xl bg-clay-50 px-4 py-3 text-[13.5px] font-medium text-clay-700">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" size="lg" loading={busy} disabled={!acknowledged} className="!mt-6 w-full">
            {t('shop.create')}
          </Button>
        </Container>
      </form>
    </div>
  );
}
