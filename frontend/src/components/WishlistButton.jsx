import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { useT } from '../i18n';

// Heart button with a small menu: tick the wishlist(s) this piece belongs
// in, or start a new one (a buyer can have at most two).
export default function WishlistButton({ productId }) {
  const { user, token } = useAuth();
  const { t } = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState(null);
  const [max, setMax] = useState(2);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const box = useRef(null);

  const load = async () => {
    const { data } = await api.wishlists.list(token);
    setLists(data.lists);
    setMax(data.max);
  };

  useEffect(() => {
    if (user?.role === 'customer') load().catch(() => setLists([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  if (user && user.role !== 'customer') return null;

  const saved = (lists || []).some((l) => l.items.some((i) => i.product_id === productId));

  const toggle = async (list) => {
    const has = list.items.some((i) => i.product_id === productId);
    setBusy(true);
    try {
      if (has) await api.wishlists.removeItem(list.wishlist_id, productId, token);
      else await api.wishlists.addItem(list.wishlist_id, productId, token);
      await load();
      toast.success(has ? t('wish.removed', { name: list.name }) : t('wish.added', { name: list.name }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.wishlists.create(newName.trim(), token);
      await api.wishlists.addItem(data.wishlist_id, productId, token);
      setNewName('');
      await load();
      toast.success(t('wish.added', { name: data.name }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => (user ? setOpen((o) => !o) : navigate('/login', { state: { from: `/product/${productId}` } }))}
        aria-expanded={open}
        aria-label={saved ? t('wish.saved') : t('wish.save')}
        className={`flex h-[52px] items-center gap-2 rounded-2xl border px-4 text-[14px] font-semibold transition active:scale-[0.98] ${
          saved ? 'border-clay-300 bg-clay-50 text-clay-700' : 'border-cream-300 bg-white text-ink-700 hover:border-clay-300'
        }`}
      >
        <Icon name="heart" className="h-5 w-5" fill={saved ? 'currentColor' : 'none'} />
        <span className="hidden sm:inline">{saved ? t('wish.saved') : t('wish.save')}</span>
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-30 mb-2 w-64 rounded-2xl border border-cream-300 bg-white p-3 shadow-lift">
          <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-ink-400">{t('wish.save_to')}</p>
          {lists === null ? (
            <div className="skeleton h-9 w-full rounded-xl" />
          ) : (
            <div className="space-y-1">
              {lists.map((l) => {
                const has = l.items.some((i) => i.product_id === productId);
                return (
                  <label key={l.wishlist_id} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-cream-100">
                    <input type="checkbox" checked={has} disabled={busy} onChange={() => toggle(l)} className="accent-clay-500" />
                    <span className="flex-1 truncate text-[14px] text-ink-700">{l.name}</span>
                    <span className="text-[11.5px] text-ink-400">{l.items.length}</span>
                  </label>
                );
              })}
            </div>
          )}
          {lists && lists.length < max ? (
            <form onSubmit={create} className="mt-2 flex gap-1.5 border-t border-cream-200 pt-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={40}
                placeholder={t('wish.new_placeholder')}
                className="field-input !rounded-xl !px-3 !py-1.5 !text-[13px]"
              />
              <button type="submit" disabled={busy || !newName.trim()} className="shrink-0 rounded-xl bg-clay-500 px-3 text-[13px] font-semibold text-white disabled:opacity-40">
                {t('common.add')}
              </button>
            </form>
          ) : (
            lists && <p className="mt-2 border-t border-cream-200 pt-2 text-[11.5px] text-ink-400">{t('wish.max', { max })}</p>
          )}
        </div>
      )}
    </div>
  );
}
