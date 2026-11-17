import { useState } from 'react';
import Button from './Button';
import Icon from './Icon';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { useT } from '../i18n';

function Party({ label, done, t }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${done ? 'bg-sage-100 text-sage-600' : 'bg-cream-200 text-ink-500'}`}>
      <Icon name={done ? 'check' : 'clock'} className="h-3.5 w-3.5" strokeWidth={done ? 2.4 : 1.75} />
      {label}: {done ? t('cod.confirmed') : t('cod.waiting')}
    </span>
  );
}

// Cash on delivery, after delivery: the buyer confirms "I paid the cash" and
// the artisan confirms "I received the cash". Both -> payment becomes Paid.
// `side` is 'buyer' or 'artisan' (whoever is looking at the order).
export default function CodPaymentBox({ order, side, onUpdated }) {
  const { token } = useAuth();
  const { t } = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (order.payment_method !== 'COD' || order.status !== 'Delivered') return null;

  if (order.payment_status === 'Paid') {
    return (
      <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-sage-100 px-3 py-2 text-[12.5px] font-semibold text-sage-600">
        <Icon name="check" className="h-4 w-4" strokeWidth={2.4} />
        {t('cod.paid')}
      </p>
    );
  }

  const mine = side === 'buyer' ? order.cod_buyer_confirmed_at : order.cod_artisan_confirmed_at;

  const confirm = async () => {
    if (!window.confirm(t(side === 'buyer' ? 'cod.confirm_buyer' : 'cod.confirm_artisan'))) return;
    setBusy(true);
    try {
      const { data } = await api.orders.confirmCod(order.order_id, token);
      onUpdated?.(order.order_id, data);
      toast.success(data.payment_status === 'Paid' ? t('cod.paid') : t('cod.saved'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-[12.5px] font-semibold text-amber-900">{t('cod.title')}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Party t={t} label={t('role.customer')} done={Boolean(order.cod_buyer_confirmed_at)} />
        <Party t={t} label={t('role.artisan')} done={Boolean(order.cod_artisan_confirmed_at)} />
      </div>
      {mine ? (
        <p className="mt-2 text-[12px] text-amber-800">
          {t(side === 'buyer' ? 'cod.waiting_artisan' : 'cod.waiting_buyer')}
        </p>
      ) : (
        <Button size="sm" className="mt-2.5" onClick={confirm} loading={busy}>
          <Icon name="check" className="h-4 w-4" strokeWidth={2.2} />
          {t(side === 'buyer' ? 'cod.button_buyer' : 'cod.button_artisan')}
        </Button>
      )}
    </div>
  );
}
