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

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_MEDIA = 8;
const VIEW_ANGLES = [
  { id: 'front', label: 'Front', required: true },
  { id: 'right', label: 'Right side', required: true },
  { id: 'back', label: 'Back', required: true },
  { id: 'left', label: 'Left side', required: true },
  { id: 'top', label: 'Top', required: false },
  { id: 'bottom', label: 'Bottom', required: false },
];
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

export default function AddProduct() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const editing = Boolean(editId);
  const toast = useToast();
  const fileRef = useRef(null);
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
      toast.error('That file is not an image');
      return;
    }
    if (picked.size > MAX_BYTES) {
      toast.error('Image must be under 5 MB');
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
        toast.error(`${f.name} is not an image or video`);
        continue;
      }
      if (f.size > (isVideo ? MAX_VIDEO_BYTES : MAX_BYTES)) {
        toast.error(`${f.name} is too large (${isVideo ? '30' : '5'} MB max)`);
        continue;
      }
      if (next.length + existingMedia.length >= MAX_MEDIA) {
        toast.error(`Up to ${MAX_MEDIA} extra files`);
        break;
      }
      next.push(f);
    }
    setExtras(next);
    if (extraRef.current) extraRef.current.value = '';
  }

  function handleView(angle, picked) {
    if (!picked) return;
    if (!picked.type.startsWith('image/')) return toast.error('That file is not an image');
    if (picked.size > MAX_BYTES) return toast.error('Image must be under 5 MB');
    setViews((v) => ({ ...v, [angle]: picked }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.shop_id) return setError('Pick which shop this belongs to');
    if (!form.name.trim()) return setError('Give the piece a name');
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) return setError('Enter a valid price');
    const stock_quantity = Number(form.stock_quantity);
    if (!Number.isInteger(stock_quantity) || stock_quantity < 0) {
      return setError('Quantity must be a whole number, 0 or more');
    }
    if (enable360 && !VIEW_ANGLES.filter((a) => a.required).every((a) => views[a.id] || existingViews[a.id])) {
      return setError('360° view needs the front, right, back and left photos');
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

      toast.success(editing ? `"${form.name.trim()}" updated` : `"${form.name.trim()}" is now listed`);
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
        <TopBar title="List a piece" />
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
        <TopBar title="List a piece" />
        <EmptyState
          icon="store"
          title="You need a shop first"
          message="Products live inside a shop, and the shop is what gives them a place on the map."
          action={<Button onClick={() => navigate('/artisan/shop')}>Open my shop</Button>}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar title={editing ? 'Edit listing' : 'List a piece'} subtitle={editing ? 'Update details and stock' : 'A photo and a price is enough'} />

      <form
        onSubmit={handleSubmit}
        className="min-h-0 flex-1 overflow-y-auto scroll-clean px-5 pb-8 pt-5 md:px-8 md:pt-7"
      >
        <Container size="form" className="space-y-5">
        {/* ---------- Photo ---------- */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="field-label !mb-0">Photo</span>
            <button
              type="button"
              onClick={() => {
                setUseUrl((v) => !v);
                clearPhoto();
              }}
              className="text-[12.5px] font-semibold text-clay-600 underline-offset-4 hover:underline"
            >
              {useUrl ? 'Upload a file instead' : 'Paste a link instead'}
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
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={clearPhoto}
                    aria-label="Remove photo"
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
                <span className="text-[14px] font-semibold text-ink-600">Add a photo</span>
                <span className="text-[12px] text-ink-400">JPG, PNG or WEBP · up to 5 MB</span>
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
        </div>

        <div className="space-y-3 rounded-3xl border border-cream-300 bg-white p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={enable360} onChange={(e) => setEnable360(e.target.checked)} className="mt-1" />
            <span>
              <span className="block text-[14.5px] font-semibold text-ink-800">Enable 360° view</span>
              <span className="block text-[12.5px] text-ink-500">
                Customers can drag to rotate the product. Photograph it from each side.
              </span>
            </span>
          </label>
          {enable360 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {VIEW_ANGLES.map((a) => (
                <label key={a.id} className="block cursor-pointer text-center">
                  <span className="relative grid aspect-square place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-cream-300 bg-cream-100 text-[12px] text-ink-400">
                    {views[a.id] ? (
                      <img src={URL.createObjectURL(views[a.id])} alt={a.label} className="h-full w-full object-cover" />
                    ) : existingViews[a.id] ? (
                      <img src={existingViews[a.id]} alt={a.label} className="h-full w-full object-cover" />
                    ) : (
                      '+ Add photo'
                    )}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                      onChange={(e) => handleView(a.id, e.target.files?.[0])} />
                  </span>
                  <span className="mt-1 block text-[12.5px] font-semibold text-ink-700">
                    {a.label}{a.required ? ' *' : ' (optional)'}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <Field label="3D model (.glb)" id="glb" hint="Optional — customers can rotate and zoom it. Max 30 MB.">
          <div className="flex items-center gap-2">
            <label className="cursor-pointer rounded-full border border-dashed border-cream-300 px-3 py-1.5 text-[12px] font-semibold text-clay-600">
              {glb ? 'Replace file' : '+ Add .glb file'}
              <input id="glb" type="file" accept=".glb,model/gltf-binary" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (!f.name.toLowerCase().endsWith('.glb')) return toast.error('Please choose a .glb file');
                  if (f.size > MAX_VIDEO_BYTES) return toast.error('Model must be under 30 MB');
                  setGlb(f);
                }} />
            </label>
            {existingModel && !glb && (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-700">
                <span>Current model attached</span>
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

        <Field label="Preview gallery" id="extras" hint={`Optional — more photos or a short video (MP4/WEBM, up to 30 MB). ${extras.length}/${MAX_MEDIA} added`}>
          <div className="flex flex-wrap gap-2">
            {existingMedia.map((m, i) => (
              <span key={m.url} className="inline-flex items-center gap-1.5 rounded-full bg-cream-200 px-3 py-1.5 text-[12px] font-medium text-ink-700">
                {m.media_type === 'video' ? '🎬' : '🖼️'} Saved {m.media_type}
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
              + Add
            </button>
          </div>
          <input ref={extraRef} id="extras" type="file" multiple className="hidden"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
            onChange={(e) => handleExtras(e.target.files)} />
        </Field>

        {/* ---------- Details ---------- */}
        {shops.length > 1 && !editing && (
          <Field label="Shop" id="shop_id">
            <select id="shop_id" className="field-input" value={form.shop_id} onChange={set('shop_id')}>
              {shops.map((s) => (
                <option key={s.shop_id} value={s.shop_id}>
                  {s.shop_name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Name" id="name">
          <Input id="name" placeholder="Handwoven cotton saree" value={form.name} onChange={set('name')} />
        </Field>

        <Field
          label="Price"
          id="price"
          hint={form.price !== '' && Number(form.price) >= 0 ? `Shown as ${formatPrice(form.price)}` : 'In rupees'}
        >
          <Input id="price" inputMode="decimal" placeholder="2499" value={form.price} onChange={set('price')} />
        </Field>

        <div>
          <Field label="Category" id="category" hint="Tap a suggestion, or type your own">
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
                {c}
              </button>
            ))}
          </div>
        </div>

        <Field label="Description" id="description" hint="Optional — materials, size, how long it took">
          <TextArea
            id="description"
            rows={3}
            placeholder="Pure cotton, natural indigo dye, six days on the loom."
            value={form.description}
            onChange={set('description')}
          />
        </Field>

        <Field label="Quantity in stock" id="stock_quantity" hint="How many units are available. Set 0 to mark it sold out.">
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
          {stage === 'uploading' ? 'Uploading files…' : stage === 'saving' ? 'Saving…' : editing ? 'Save changes' : 'Publish listing'}
          </Button>
        </Container>
      </form>
    </div>
  );
}
