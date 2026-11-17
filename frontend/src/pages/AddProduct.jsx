import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import TopBar from '../components/TopBar';
import { Field, Input, TextArea } from '../components/Field';
import { api } from '../lib/api';
import { CATEGORIES, formatPrice } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Container } from '../components/AppShell';
import { useT } from '../i18n';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_MEDIA = 8;
const VIEW_ANGLES = [
  { id: 'front', required: true },
  { id: 'right', required: true },
  { id: 'back', required: true },
  { id: 'left', required: true },
  { id: 'top', required: false },
  { id: 'bottom', required: false },
];
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

export default function AddProduct() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const editing = Boolean(editId);
  const toast = useToast();
  const { t, tc, lang } = useT();
  const fileRef = useRef(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState('');
  const [existingMedia, setExistingMedia] = useState([]);
  const [existingViews, setExistingViews] = useState({});
  const [existingModel, setExistingModel] = useState(null);

  const [shops, setShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(true);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [useUrl, setUseUrl] = useState(false);

  const [form, setForm] = useState({
    shop_id: '',
    name: '',
    price: '',
    category: '',
    description: '',
    stock_quantity: '1',
  });
  const [error, setError] = useState('');
  const [extras, setExtras] = useState([]);
  const [enable360, setEnable360] = useState(false);
  const [views, setViews] = useState({});
  const [glb, setGlb] = useState(null);
  const extraRef = useRef(null);
  const [stage, setStage] = useState(null); // 'uploading' | 'saving'

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    api.shops
      .mine(token)
      .then(({ data }) => {
        setShops(data);
        if (data.length) setForm((f) => ({ ...f, shop_id: String(data[0].shop_id) }));
      })
      .catch((err) => setError(err.message))
      .finally(() => setShopsLoading(false));
  }, [token]);

  // Show the AI button only when the server has an AI key configured.
  useEffect(() => {
    api.ai
      .status(token)
      .then(({ data }) => setAiEnabled(data.enabled))
      .catch(() => setAiEnabled(false));
  }, [token]);

  // AI-assisted listing: Claude suggests a name, description, category and
  // price from the photo. Fields the artisan already filled are kept unless
  // they agree to replace them.
  async function suggestWithAi() {
    if (!file) return toast.error(t('ai.need_photo'));
    const filled = form.name.trim() || form.description.trim() || form.price !== '';
    if (filled && !window.confirm(t('ai.replace_confirm'))) return;
    setAiBusy(true);
    setAiNote('');
    try {
      const { data } = await api.ai.listing(file, lang, token);
      setForm((f) => ({
        ...f,
        name: data.name || f.name,
        description: data.description || f.description,
        category: data.category || f.category,
        price: data.price ? String(data.price) : f.price,
      }));
      setAiNote(data.price_note);
      toast.success(t('ai.done'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAiBusy(false);
    }
  }

  useEffect(() => {
    if (!editId) return;
    api.products
      .byId(editId)
      .then(({ data: p }) => {
        setForm({
          shop_id: String(p.shop_id),
          name: p.name || '',
          price: String(p.price ?? ''),
          category: p.category || '',
          description: p.description || '',
          stock_quantity: String(p.stock_quantity ?? 0),
        });
        if (p.image_url) {
          setUseUrl(true);
          setImageUrlInput(p.image_url);
        }
        setExistingMedia(p.media || []);
        setExistingViews(p.views360 || {});
        setExistingModel(p.model_url || null);
        setEnable360(Boolean(p.view360_enabled));
      })
      .catch((err) => setError(err.message));
  }, [editId]);

  // Revoke the object URL when it's replaced or the screen unmounts,
  // otherwise every re-pick leaks a blob.
  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleFile(picked) {
    if (!picked) return;
    if (!picked.type.startsWith('image/')) {
      toast.error(t('add.not_image'));
      return;
    }
    if (picked.size > MAX_BYTES) {
      toast.error(t('add.too_big'));
      return;
    }
    setFile(picked);
    setUseUrl(false);
  }

  function clearPhoto() {
    setFile(null);
    setPreview('');
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleExtras(fileList) {
    const next = [...extras];
    for (const f of Array.from(fileList || [])) {
      const isVideo = f.type.startsWith('video/');
      if (!isVideo && !f.type.startsWith('image/')) {
        toast.error(t('add.not_media', { name: f.name }));
        continue;
      }
      if (f.size > (isVideo ? MAX_VIDEO_BYTES : MAX_BYTES)) {
        toast.error(t('add.file_too_big', { name: f.name, mb: isVideo ? 30 : 5 }));
        continue;
      }
      if (next.length + existingMedia.length >= MAX_MEDIA) {
        toast.error(t('add.max_media', { max: MAX_MEDIA }));
        break;
      }
      next.push(f);
    }
    setExtras(next);
    if (extraRef.current) extraRef.current.value = '';
  }

  function handleView(angle, picked) {
    if (!picked) return;
    if (!picked.type.startsWith('image/')) return toast.error(t('add.not_image'));
    if (picked.size > MAX_BYTES) return toast.error(t('add.too_big'));
    setViews((v) => ({ ...v, [angle]: picked }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.shop_id) return setError(t('add.need_shop'));
    if (!form.name.trim()) return setError(t('add.need_name'));
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) return setError(t('add.bad_price'));
    const stock_quantity = Number(form.stock_quantity);
    if (!Number.isInteger(stock_quantity) || stock_quantity < 0) {
      return setError(t('add.bad_qty'));
    }
    if (enable360 && !VIEW_ANGLES.filter((a) => a.required).every((a) => views[a.id] || existingViews[a.id])) {
      return setError(t('add.need_360'));
    }

    try {
      let image_url = useUrl ? imageUrlInput.trim() || null : null;

      // Upload happens only on submit, so abandoning the form never leaves
      // an orphaned file on the server.
      if (!useUrl && file) {
        setStage('uploading');
        const { data } = await api.uploads.image(file, token);
        image_url = data.image_url;
      }

      const media = existingMedia.map((m) => ({ media_type: m.media_type, url: m.url }));
      if (extras.length) {
        setStage('uploading');
        for (const f of extras) {
          const { data } = await api.uploads.media(f, token);
          media.push({ media_type: data.media_type, url: data.url });
        }
      }

      const views360 = {};
      if (enable360) {
        setStage('uploading');
        for (const a of VIEW_ANGLES) {
          if (views[a.id]) {
            const { data } = await api.uploads.image(views[a.id], token);
            views360[a.id] = data.image_url;
          } else if (existingViews[a.id]) {
            views360[a.id] = existingViews[a.id];
          }
        }
      }

      let model_url = existingModel;
      if (glb) {
        setStage('uploading');
        ({ data: { model_url } } = await api.uploads.model(glb, token));
      }

      setStage('saving');
      const payload = {
        shop_id: Number(form.shop_id),
        name: form.name.trim(),
        price,
        category: form.category.trim() || null,
        description: form.description.trim() || null,
        image_url,
        media,
        view360_enabled: enable360,
        views: views360,
        model_url,
        stock_quantity,
      };
      if (editing) await api.products.update(editId, payload, token);
      else await api.products.add(payload, token);

      toast.success(editing ? t('add.updated', { name: form.name.trim() }) : t('add.listed', { name: form.name.trim() }));
      navigate('/artisan', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setStage(null);
    }
  }

  if (shopsLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <TopBar title={t('add.title')} />
        <div className="flex-1 space-y-4 p-5">
          <div className="skeleton aspect-[4/3] w-full rounded-3xl" />
          <div className="skeleton h-12 w-full rounded-2xl" />
          <div className="skeleton h-12 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  // A product cannot exist without a shop_id, so this is a dead end worth
  // naming clearly rather than failing on submit.
  if (shops.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <TopBar title={t('add.title')} />
        <EmptyState
          icon="store"
          title={t('add.need_shop_title')}
          message={t('add.need_shop_body')}
          action={<Button onClick={() => navigate('/artisan/shop')}>{t('dash.open_shop')}</Button>}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar title={editing ? t('add.edit_title') : t('add.title')} subtitle={editing ? t('add.edit_subtitle') : t('add.subtitle')} />

      <form
        onSubmit={handleSubmit}
        className="min-h-0 flex-1 overflow-y-auto scroll-clean px-5 pb-8 pt-5 md:px-8 md:pt-7"
      >
        <Container size="form" className="space-y-5">
        {/* ---------- Photo ---------- */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="field-label !mb-0">{t('add.photo')}</span>
            <button
              type="button"
              onClick={() => {
                setUseUrl((v) => !v);
                clearPhoto();
              }}
              className="text-[12.5px] font-semibold text-clay-600 underline-offset-4 hover:underline"
            >
              {useUrl ? t('add.upload_instead') : t('add.link_instead')}
            </button>
          </div>

          {useUrl ? (
            <>
              <Input
                placeholder="https://example.com/saree.jpg"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
              />
              {imageUrlInput.trim() && (
                <div className="mt-3 aspect-[4/3] overflow-hidden rounded-3xl bg-cream-200">
                  <img
                    src={imageUrlInput.trim()}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.opacity = '0';
                    }}
                  />
                </div>
              )}
            </>
          ) : preview ? (
            <div className="relative overflow-hidden rounded-3xl">
              <img src={preview} alt="Selected product" className="aspect-[4/3] w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-ink-900/80 to-transparent p-3">
                <span className="truncate text-[12px] font-medium text-cream-100">{file?.name}</span>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="rounded-full bg-cream-100/90 px-3 py-1.5 text-[12px] font-semibold text-ink-800 active:scale-95"
                  >
                    {t('add.replace')}
                  </button>
                  <button
                    type="button"
                    onClick={clearPhoto}
                    aria-label={t('common.remove')}
                    className="grid h-[30px] w-[30px] place-items-center rounded-full bg-cream-100/90 text-clay-700 active:scale-95"
                  >
                    <Icon name="trash" className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFile(e.dataTransfer.files?.[0]);
              }}
              className="grid aspect-[4/3] max-h-[340px] w-full place-items-center rounded-3xl border-2
                         border-dashed border-cream-300 bg-white text-ink-400 transition
                         hover:border-clay-300 hover:bg-clay-50 active:scale-[0.99]"
            >
              <span className="flex flex-col items-center gap-2">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cream-200 text-clay-500">
                  <Icon name="camera" className="h-5 w-5" />
                </span>
                <span className="text-[14px] font-semibold text-ink-600">{t('add.add_photo')}</span>
                <span className="text-[12px] text-ink-400">{t('add.photo_hint')}</span>
              </span>
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          {aiEnabled && !useUrl && (
            <div className="mt-3 rounded-2xl border border-clay-200 bg-clay-50 p-3">
              <div className="flex items-center gap-3">
                <Icon name="sparkle" className="h-5 w-5 shrink-0 text-clay-500" />
                <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-ink-600">
                  {file ? t('ai.hint_ready') : t('ai.hint_photo')}
                </p>
                <Button type="button" size="sm" onClick={suggestWithAi} loading={aiBusy} disabled={!file}>
                  {t('ai.button')}
                </Button>
              </div>
              {aiNote && <p className="mt-2 text-[12px] text-ink-500">{t('ai.price_note', { note: aiNote })}</p>}
              <p className="mt-1.5 text-[11px] text-ink-400">{t('ai.check')}</p>
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-3xl border border-cream-300 bg-white p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={enable360} onChange={(e) => setEnable360(e.target.checked)} className="mt-1" />
            <span>
              <span className="block text-[14.5px] font-semibold text-ink-800">{t('add.enable_360')}</span>
              <span className="block text-[12.5px] text-ink-500">{t('add.enable_360_hint')}</span>
            </span>
          </label>
          {enable360 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {VIEW_ANGLES.map((a) => (
                <label key={a.id} className="block cursor-pointer text-center">
                  <span className="relative grid aspect-square place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-cream-300 bg-cream-100 text-[12px] text-ink-400">
                    {views[a.id] ? (
                      <img src={URL.createObjectURL(views[a.id])} alt={t(`add.angle.${a.id}`)} className="h-full w-full object-cover" />
                    ) : existingViews[a.id] ? (
                      <img src={existingViews[a.id]} alt={t(`add.angle.${a.id}`)} className="h-full w-full object-cover" />
                    ) : (
                      t('add.plus_photo')
                    )}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                      onChange={(e) => handleView(a.id, e.target.files?.[0])} />
                  </span>
                  <span className="mt-1 block text-[12.5px] font-semibold text-ink-700">
                    {t(`add.angle.${a.id}`)}{a.required ? ' *' : ` (${t('common.optional')})`}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <Field label={t('add.model')} id="glb" hint={t('add.model_hint')}>
          <div className="flex items-center gap-2">
            <label className="cursor-pointer rounded-full border border-dashed border-cream-300 px-3 py-1.5 text-[12px] font-semibold text-clay-600">
              {glb ? t('add.replace_file') : t('add.add_glb')}
              <input id="glb" type="file" accept=".glb,model/gltf-binary" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (!f.name.toLowerCase().endsWith('.glb')) return toast.error(t('add.need_glb'));
                  if (f.size > MAX_VIDEO_BYTES) return toast.error(t('add.model_too_big'));
                  setGlb(f);
                }} />
            </label>
            {existingModel && !glb && (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-700">
                <span>{t('add.model_attached')}</span>
                <button type="button" aria-label="Remove model" onClick={() => setExistingModel(null)}>×</button>
              </span>
            )}
            {glb && (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-700">
                <span className="max-w-[12rem] truncate">{glb.name}</span>
                <button type="button" aria-label="Remove model" onClick={() => setGlb(null)}>×</button>
              </span>
            )}
          </div>
        </Field>

        <Field label={t('add.gallery')} id="extras" hint={t('add.gallery_hint', { n: extras.length, max: MAX_MEDIA })}>
          <div className="flex flex-wrap gap-2">
            {existingMedia.map((m, i) => (
              <span key={m.url} className="inline-flex items-center gap-1.5 rounded-full bg-cream-200 px-3 py-1.5 text-[12px] font-medium text-ink-700">
                {m.media_type === 'video' ? '🎬' : '🖼️'} {t(m.media_type === 'video' ? 'add.saved_video' : 'add.saved_image')}
                <button type="button" aria-label="Remove saved file" onClick={() => setExistingMedia((l) => l.filter((_, j) => j !== i))}>×</button>
              </span>
            ))}
            {extras.map((f, i) => (
              <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 rounded-full bg-cream-200 px-3 py-1.5 text-[12px] font-medium text-ink-700">
                {f.type.startsWith('video/') ? '🎬' : '🖼️'} <span className="max-w-[9rem] truncate">{f.name}</span>
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setExtras((l) => l.filter((_, j) => j !== i))}>×</button>
              </span>
            ))}
            <button type="button" onClick={() => extraRef.current?.click()}
              className="rounded-full border border-dashed border-cream-300 px-3 py-1.5 text-[12px] font-semibold text-clay-600">
              + {t('common.add')}
            </button>
          </div>
          <input ref={extraRef} id="extras" type="file" multiple className="hidden"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
            onChange={(e) => handleExtras(e.target.files)} />
        </Field>

        {/* ---------- Details ---------- */}
        {shops.length > 1 && !editing && (
          <Field label={t('add.shop')} id="shop_id">
            <select id="shop_id" className="field-input" value={form.shop_id} onChange={set('shop_id')}>
              {shops.map((s) => (
                <option key={s.shop_id} value={s.shop_id}>
                  {s.shop_name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label={t('add.name')} id="name">
          <Input id="name" placeholder="Handwoven cotton saree" value={form.name} onChange={set('name')} />
        </Field>

        <Field
          label={t('add.price')}
          id="price"
          hint={form.price !== '' && Number(form.price) >= 0 ? t('add.shown_as', { price: formatPrice(form.price) }) : t('add.in_rupees')}
        >
          <Input id="price" inputMode="decimal" placeholder="2499" value={form.price} onChange={set('price')} />
        </Field>

        <div>
          <Field label={t('add.category')} id="category" hint={t('add.category_hint')}>
            <Input id="category" placeholder="Textiles" value={form.category} onChange={set('category')} />
          </Field>
          {/* Chips sit outside <Field> so the hint stays directly under the input. */}
          <div className="-mx-5 mt-2.5 flex gap-2 overflow-x-auto scroll-clean px-5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm((f) => ({ ...f, category: f.category === c ? '' : c }))}
                className={`chip ${
                  form.category === c
                    ? 'border-clay-500 bg-clay-500 text-white'
                    : 'border-cream-300 bg-white text-ink-500 hover:border-clay-300'
                }`}
              >
                {tc(c)}
              </button>
            ))}
          </div>
        </div>

        <Field label={t('add.description')} id="description" hint={t('add.description_hint')}>
          <TextArea
            id="description"
            rows={3}
            placeholder="Pure cotton, natural indigo dye, six days on the loom."
            value={form.description}
            onChange={set('description')}
          />
        </Field>

        <Field label={t('add.quantity')} id="stock_quantity" hint={t('add.quantity_hint')}>
          <Input
            id="stock_quantity"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={form.stock_quantity}
            onChange={set('stock_quantity')}
          />
        </Field>

        {error && (
          <div className="flex items-start gap-2 rounded-2xl bg-clay-50 px-4 py-3 text-[13.5px] font-medium text-clay-700">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
            <span>{error}</span>
          </div>
        )}

          <Button type="submit" size="lg" loading={!!stage} className="w-full">
          {stage === 'uploading' ? t('add.uploading') : stage === 'saving' ? t('add.saving') : editing ? t('add.save') : t('add.publish')}
          </Button>
        </Container>
      </form>
    </div>
  );
}
