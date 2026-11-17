import { formatDateTime } from './format';

// Turns a stored notification (type + data) into text in the reader's language.
export function notificationText(n, t) {
  const d = n.data || {};
  const v = { product: d.product_name || '', order: d.order_id, left: d.left, quantity: d.quantity, rating: d.rating };
  switch (n.type) {
    case 'new_order':
      return { icon: 'cart', title: t('notif.new_order.title'), body: t('notif.new_order.body', v) };
    case 'order_status':
      return {
        icon: d.status === 'Shipped' ? 'truck' : d.status === 'Cancelled' ? 'alert' : 'check',
        title: t(`notif.status.${d.status}`, v),
        body: t('notif.status.body', v),
      };
    case 'live_scheduled':
      return { icon: 'clock', title: t('notif.live_scheduled.title'), body: t('notif.live_scheduled.body', { ...v, when: d.at ? formatDateTime(d.at) : '' }) };
    case 'live_now':
      return { icon: 'video', title: t('notif.live_now.title'), body: t('notif.live_now.body', v) };
    case 'new_review':
      return { icon: 'star', title: t('notif.new_review.title'), body: t('notif.new_review.body', v) };
    case 'low_stock':
      return { icon: 'alert', title: t('notif.low_stock.title'), body: t('notif.low_stock.body', v) };
    case 'sold_out':
      return { icon: 'alert', title: t('notif.sold_out.title'), body: t('notif.sold_out.body', v) };
    case 'low_stock_buyer':
      return { icon: 'heart', title: t('notif.low_stock_buyer.title'), body: t('notif.low_stock_buyer.body', v) };
    case 'sold_out_buyer':
      return { icon: 'heart', title: t('notif.sold_out_buyer.title'), body: t('notif.sold_out_buyer.body', v) };
    case 'review_removed':
      return { icon: 'shield', title: t('notif.review_removed.title'), body: t('notif.review_removed.body', { ...v, reason: d.reason || '' }) };
    case 'cod_buyer_confirmed':
      return { icon: 'check', title: t('notif.cod_buyer_confirmed.title'), body: t('notif.cod_buyer_confirmed.body', v) };
    case 'cod_artisan_confirmed':
      return { icon: 'check', title: t('notif.cod_artisan_confirmed.title'), body: t('notif.cod_artisan_confirmed.body', v) };
    case 'event_call':
      return { icon: 'calendar', title: t('notif.event_call.title'), body: t('notif.event_call.body', { title: d.title || '', venue: d.venue || '', when: d.at ? formatDateTime(d.at) : '' }) };
    case 'event_needs_approval':
      return { icon: 'shield', title: t('notif.event_needs_approval.title'), body: t('notif.event_needs_approval.body', { title: d.title || '', yes: d.yes, total: d.total }) };
    case 'event_approved':
      return { icon: 'check', title: t('notif.event_approved.title'), body: t('notif.event_approved.body', { title: d.title || '' }) };
    case 'event_rejected':
      return { icon: 'alert', title: t('notif.event_rejected.title'), body: t('notif.event_rejected.body', { title: d.title || '', reason: d.reason || '' }) };
    case 'cod_paid':
      return { icon: 'check', title: t('notif.cod_paid.title'), body: t('notif.cod_paid.body', v) };
    default:
      return { icon: 'bell', title: t('notif.generic'), body: '' };
  }
}
