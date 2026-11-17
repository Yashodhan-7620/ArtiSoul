import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import TopBar from '../components/TopBar';
import { Container } from '../components/AppShell';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import { notificationText } from '../lib/notificationText';
import { useAuth } from '../context/AuthContext';
import { useBadges } from '../context/BadgesContext';
import { useT } from '../i18n';

export default function Notifications() {
  const { token } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const { setUnread } = useBadges();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [permission, setPermission] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'));

  const load = useCallback(async () => {
    try {
      const { data } = await api.notifications.list(token);
      setItems(data.items);
      setUnread(data.unread);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [token, setUnread]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]);

  const markAll = async () => {
    await api.notifications.markRead([], token).catch(() => {});
    load();
  };

  const open = async (n) => {
    if (!n.is_read) {
      await api.notifications.markRead([n.notification_id], token).catch(() => {});
    }
    if (n.link) navigate(n.link);
    else load();
  };

  const enableBrowser = async () => {
    if (!('Notification' in window)) return;
    setPermission(await Notification.requestPermission());
  };

  const unread = items?.filter((n) => !n.is_read).length ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar
        title={t('notif.title')}
        subtitle={unread ? t('notif.unread', { count: unread }) : undefined}
        action={
          unread > 0 && (
            <Button size="sm" variant="secondary" onClick={markAll}>
              {t('notif.mark_all')}
            </Button>
          )
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto scroll-clean px-5 pb-8 pt-5 md:px-8 md:pt-7">
        <Container size="form" className="space-y-3">
          {permission === 'default' && (
            <div className="flex items-center gap-3 rounded-2xl border border-cream-300 bg-white px-4 py-3">
              <Icon name="bell" className="h-5 w-5 shrink-0 text-clay-500" />
              <p className="flex-1 text-[13px] text-ink-600">{t('notif.enable_body')}</p>
              <Button size="sm" onClick={enableBrowser}>{t('notif.enable')}</Button>
            </div>
          )}

          {error ? (
            <EmptyState icon="alert" title={t('common.load_error')} message={error} />
          ) : !items ? (
            <div className="space-y-2">
              <div className="skeleton h-16 w-full rounded-2xl" />
              <div className="skeleton h-16 w-full rounded-2xl" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState icon="bell" title={t('notif.empty_title')} message={t('notif.empty_body')} />
          ) : (
            <ul className="space-y-2">
              {items.map((n) => {
                const text = notificationText(n, t);
                return (
                  <li key={n.notification_id}>
                    <button
                      onClick={() => open(n)}
                      className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition hover:border-clay-200 ${
                        n.is_read ? 'border-cream-300 bg-white' : 'border-clay-200 bg-clay-50'
                      }`}
                    >
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${n.is_read ? 'bg-cream-200 text-ink-500' : 'bg-clay-500 text-white'}`}>
                        <Icon name={text.icon} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="text-[14px] font-semibold text-ink-800">{text.title}</span>
                          <span className="shrink-0 text-[11px] text-ink-400">{timeAgo(n.created_at, t)}</span>
                        </span>
                        {text.body && <span className="mt-0.5 block text-[13px] leading-snug text-ink-500">{text.body}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Container>
      </div>
    </div>
  );
}
