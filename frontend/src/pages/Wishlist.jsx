import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import TopBar from '../components/TopBar';
import { Container } from '../components/AppShell';
import { api } from '../lib/api';
import { formatPrice } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useBadges } from '../context/BadgesContext';
import { useToast } from '../components/Toast';
import { useT } from '../i18n';

// Up to two named wishlists ("sections"), each with its saved pieces.
export default function Wishlist() {
  const { token } = useAuth();
  const { t } = useT();
  const toast = useToast();
  const { refreshCart } = useBadges();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(null); // { id, name }

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.wishlists.list(token);
      setData(d);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn, okMessage) => {
    try {
      await fn();
      await load();
      if (okMessage) toast.success(okMessage);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const create = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    run(() => api.wishlists.create(name, token), t('wish.created', { name })).then(() => setNewName(''));
  };

  const saveRename = (e) => {
    e.preventDefault();
    run(() => api.wishlists.rename(renaming.id, renaming.name.trim(), token)).then(() => setRenaming(null));
  };

  const remove = (list) => {
    if (!window.confirm(t('wish.delete_confirm', { name: list.name }))) return;
    run(() => api.wishlists.remove(list.wishlist_id, token));
  };

  const toCart = (item) =>
    run(async () => {
      await api.cart.add(item.product_id, 1, token);
      refreshCart();
    }, t('product.added_to_cart'));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar title={t('wish.title')} subtitle={data ? t('wish.subtitle', { count: data.lists.length, max: data.max }) : undefined} back />
      <div className="min-h-0 flex-1 overflow-y-auto scroll-clean px-5 pb-8 pt-5 md:px-8 md:pt-7">
        <Container size="form" className="space-y-6">
          {error ? (
            <EmptyState icon="alert" title={t('common.load_error')} message={error} />
          ) : !data ? (
            <div className="skeleton h-40 w-full rounded-3xl" />
          ) : (
            <>
              {data.lists.length === 0 && (
                <EmptyState icon="heart" title={t('wish.empty_title')} message={t('wish.empty_body')} />
              )}

              {data.lists.map((list) => (
                <section key={list.wishlist_id} className="rounded-3xl border border-cream-300 bg-white p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Icon name="heart" className="h-4 w-4 text-clay-500" />
                    {renaming?.id === list.wishlist_id ? (
                      <form onSubmit={saveRename} className="flex flex-1 gap-1.5">
                        <input
                          autoFocus
                          value={renaming.name}
                          maxLength={40}
                          onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                          className="field-input !rounded-xl !px-3 !py-1.5 !text-[14px]"
                        />
                        <Button size="sm" type="submit" disabled={!renaming.name.trim()}>{t('common.save')}</Button>
                        <Button size="sm" variant="ghost" type="button" onClick={() => setRenaming(null)}>{t('common.cancel')}</Button>
                      </form>
                    ) : (
                      <>
                        <h2 className="flex-1 truncate font-display text-[18px] font-semibold text-ink-800">{list.name}</h2>
                        <span className="text-[12px] text-ink-400">{t('wish.count', { count: list.items.length })}</span>
                        <button onClick={() => setRenaming({ id: list.wishlist_id, name: list.name })} className="text-[12px] font-semibold text-ink-500 hover:text-clay-600">
                          {t('common.rename')}
                        </button>
                        <button onClick={() => remove(list)} className="text-[12px] font-semibold text-clay-600 hover:underline">
                          {t('common.delete')}
                        </button>
                      </>
                    )}
                  </div>

                  {list.items.length === 0 ? (
                    <p className="rounded-2xl bg-cream-100 px-4 py-5 text-center text-[13px] text-ink-400">{t('wish.list_empty')}</p>
                  ) : (
                    <div className="space-y-2">
                      {list.items.map((item) => {
                        const soldOut = item.stock_status === 'out_of_stock' || item.stock_quantity < 1;
                        return (
                          <div key={item.product_id} className="flex items-center gap-3 rounded-2xl bg-cream-50 p-2">
                            <Link to={`/product/${item.product_id}`} className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-clay-100 to-cream-300">
                              {item.image_url && <img src={item.image_url} alt="" className="h-full w-full object-cover" />}
                            </Link>
                            <Link to={`/product/${item.product_id}`} className="min-w-0 flex-1">
                              <p className="truncate text-[14px] font-semibold text-ink-800">{item.name}</p>
                              <p className="text-[12.5px] text-ink-400">
                                {formatPrice(item.price)} ·{' '}
                                {soldOut ? t('product.sold_out') : item.stock_quantity <= 3 ? t('cart.only_left', { count: item.stock_quantity }) : item.shop_name}
                              </p>
                            </Link>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <button
                                disabled={soldOut}
                                onClick={() => toCart(item)}
                                className="rounded-full bg-clay-500 px-3 py-1 text-[12px] font-semibold text-white hover:bg-clay-600 disabled:opacity-40"
                              >
                                {t('product.add_to_cart_short')}
                              </button>
                              <button
                                onClick={() => run(() => api.wishlists.removeItem(list.wishlist_id, item.product_id, token))}
                                className="text-[11.5px] font-semibold text-ink-400 hover:text-clay-600"
                              >
                                {t('common.remove')}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}

              {data.lists.length < data.max ? (
                <form onSubmit={create} className="rounded-3xl border border-dashed border-cream-300 bg-white p-4">
                  <p className="text-[14px] font-semibold text-ink-700">{t('wish.new_title')}</p>
                  <p className="mt-0.5 text-[12.5px] text-ink-400">{t('wish.new_hint', { max: data.max })}</p>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      maxLength={40}
                      placeholder={t('wish.new_placeholder')}
                      className="field-input"
                    />
                    <Button type="submit" disabled={!newName.trim()}>{t('common.create')}</Button>
                  </div>
                </form>
              ) : (
                <p className="text-center text-[12.5px] text-ink-400">{t('wish.max', { max: data.max })}</p>
              )}
            </>
          )}
        </Container>
      </div>
    </div>
  );
}
