import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import TopBar from '../components/TopBar';
import { Container } from '../components/AppShell';
import { api } from '../lib/api';
import { formatDateTime, formatPrice, formatTime } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { useT } from '../i18n';

const ACTIVITIES = ['exhibit', 'sell', 'resale', 'popup_shop', 'meetup', 'inspire', 'workshop'];
const STATUS_PILL = {
  open: 'bg-amber-100 text-amber-700',
  pending_approval: 'bg-violet-100 text-violet-700',
  approved: 'bg-sage-100 text-sage-600',
};

// "Sat, 5 Dec 2026, 10:00 am – 9:00 pm"
function when(start, end) {
  return `${formatDateTime(start)} – ${formatTime(end)}`;
}

const mapsLink = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

// The serious-commitment warning, shown before any artisan commits.
function SeriousWarning({ t, compact = false }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-clay-300 bg-clay-50 px-4 py-3">
      <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-clay-600" strokeWidth={2} />
      <div className="text-[13px] leading-relaxed text-clay-800">
        <p className="font-semibold">{t('events.serious_title')}</p>
        {!compact && <p className="mt-0.5">{t('events.serious_body')}</p>}
      </div>
    </div>
  );
}

function ActivityPicker({ value, onChange, allowed = ACTIVITIES, t }) {
  return (
    <div className="flex flex-wrap gap-2">
      {allowed.map((a) => {
        const on = value.includes(a);
        return (
          <button
            key={a}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== a) : [...value, a])}
            className={`chip ${on ? 'border-clay-500 bg-clay-500 text-white' : 'border-cream-300 bg-white text-ink-600 hover:border-clay-300'}`}
          >
            {t(`events.act.${a}`)}
          </button>
        );
      })}
    </div>
  );
}

// Modal used both to start a call (from a venue date) and to say yes to one.
function CommitDialog({ title, subtitle, allowed, withDetails, onSubmit, onClose, t }) {
  const [form, setForm] = useState({ title: '', description: '', activities: [] });
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (withDetails && form.title.trim().length < 3) return setError(t('events.need_title'));
    if (!form.activities.length) return setError(t('events.need_activity'));
    if (!ack) return setError(t('events.need_ack'));
    setBusy(true);
    setError('');
    try {
      await onSubmit({ ...form, title: form.title.trim(), description: form.description.trim(), acknowledged: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <form onSubmit={submit} className="max-h-[92dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-3xl bg-cream-50 p-5 shadow-lift sm:rounded-3xl">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[20px] font-semibold text-ink-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-ink-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.cancel')} className="rounded-lg p-1.5 text-ink-400 hover:bg-cream-200">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        {withDetails && (
          <>
            <label className="block">
              <span className="field-label">{t('events.title_label')}</span>
              <input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('events.title_placeholder')} className="field-input" />
            </label>
            <label className="block">
              <span className="field-label">{t('events.description_label')}</span>
              <textarea value={form.description} maxLength={1000} rows={3} onChange={(e) => setForm({ ...form, description: e.target.value })} className="field-input" />
            </label>
          </>
        )}

        <div>
          <span className="field-label">{withDetails ? t('events.activities_label') : t('events.my_activities_label')}</span>
          <ActivityPicker value={form.activities} onChange={(activities) => setForm({ ...form, activities })} allowed={allowed} t={t} />
        </div>

        <SeriousWarning t={t} />
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-saffron-400 bg-saffron-100 px-4 py-3">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-clay-500" />
          <span className="text-[13px] leading-relaxed text-ink-700">{t('events.ack')}</span>
        </label>

        {error && <p className="text-[13px] font-medium text-clay-600">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!ack}>
          {withDetails ? t('events.start_call') : t('events.commit')}
        </Button>
      </form>
    </div>
  );
}

function EventCard({ ev, meta, role, onRespond, onDecline, onApprove, onReject, t }) {
  const share = Math.round(Number(ev.price) / Math.max(1, ev.yes_count));
  const insider = role === 'artisan' || role === 'admin';
  const pct = Math.min(100, Math.round((ev.yes_count / Math.max(1, meta.needed)) * 100));
  const mine = ev.my_response;

  return (
    <article className="rounded-3xl border border-cream-300 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-[18px] font-semibold leading-snug text-ink-900">{ev.title}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-600">
            <Icon name="pin" className="h-3.5 w-3.5 shrink-0 text-clay-500" strokeWidth={2} />
            <a href={mapsLink(ev.latitude, ev.longitude)} target="_blank" rel="noreferrer noopener" className="hover:underline">
              {ev.venue_name}, {ev.area}
            </a>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-600">
            <Icon name="calendar" className="h-3.5 w-3.5 shrink-0 text-clay-500" />
            {when(ev.starts_at, ev.ends_at)}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_PILL[ev.status] || 'bg-cream-200 text-ink-500'}`}>
          {t(`events.status.${ev.status}`)}
        </span>
      </div>

      {ev.description && <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-600">{ev.description}</p>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {ev.activities.map((a) => (
          <span key={a} className="rounded-full bg-cream-200 px-2.5 py-1 text-[11.5px] font-semibold text-ink-600">
            {t(`events.act.${a}`)}
          </span>
        ))}
      </div>

      {insider && (
        <div className="mt-3 rounded-2xl bg-cream-100 p-3">
          <div className="flex items-baseline justify-between text-[12.5px]">
            <span className="font-semibold text-ink-700">{t('events.progress', { yes: ev.yes_count, needed: meta.needed, total: meta.total_artisans })}</span>
            <span className="text-ink-400">{t('events.cost', { price: formatPrice(ev.price) })}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-cream-300" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full rounded-full ${pct >= 100 ? 'bg-sage-500' : 'bg-clay-500'}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-[11.5px] text-ink-400">{t('events.share', { share: formatPrice(share) })}</p>
        </div>
      )}

      {ev.participants.length > 0 && (
        <div className="mt-3">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-400">{t('events.participants', { count: ev.participants.length })}</p>
          <ul className="mt-1 space-y-0.5 text-[13px] text-ink-700">
            {ev.participants.map((p, i) => (
              <li key={i} className="truncate">
                <Icon name="store" className="mr-1 inline h-3.5 w-3.5 text-clay-500" />
                {p.shops || t('events.unnamed_shop')}
                {p.activities.length > 0 && <span className="text-ink-400"> · {p.activities.map((a) => t(`events.act.${a}`)).join(', ')}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {ev.created_by_name && insider && <p className="mt-2 text-[11.5px] text-ink-400">{t('events.called_by', { name: ev.created_by_name })}</p>}

      {role === 'artisan' && ev.status !== 'approved' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {mine?.response === 'yes' ? (
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-sage-600">
              <Icon name="check" className="h-4 w-4" strokeWidth={2.4} />
              {t('events.you_committed')}
            </p>
          ) : (
            <>
              <Button size="sm" onClick={() => onRespond(ev)}>{t('events.participate')}</Button>
              {mine?.response !== 'no' && (
                <Button size="sm" variant="ghost" onClick={() => onDecline(ev)}>{t('events.not_this_time')}</Button>
              )}
              {mine?.response === 'no' && <span className="text-[12px] text-ink-400">{t('events.you_declined')}</span>}
            </>
          )}
        </div>
      )}
      {role === 'artisan' && ev.status === 'approved' && mine?.response === 'yes' && (
        <p className="mt-3 rounded-xl bg-sage-100 px-3 py-2 text-[13px] font-semibold text-sage-600">{t('events.booked_you')}</p>
      )}

      {role === 'admin' && ['open', 'pending_approval'].includes(ev.status) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {ev.status === 'pending_approval' && (
            <Button size="sm" onClick={() => onApprove(ev)}>
              <Icon name="check" className="h-4 w-4" strokeWidth={2.2} />
              {t('events.approve')}
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => onReject(ev)}>{t('events.reject')}</Button>
          {ev.status === 'open' && <span className="self-center text-[12px] text-ink-400">{t('events.wait_threshold')}</span>}
        </div>
      )}
    </article>
  );
}

function VenueCard({ venue, canCall, onCall, t }) {
  const upcoming = venue.slots;
  return (
    <article className="rounded-3xl border border-cream-300 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-clay-50 text-clay-600">
          <Icon name="pin" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[17px] font-semibold text-ink-900">{venue.name}</h3>
          <p className="text-[12.5px] text-ink-500">
            {venue.area}, {venue.city} · {t('events.stalls', { count: venue.capacity_stalls })}
          </p>
          {venue.description && <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">{venue.description}</p>}
          <a href={mapsLink(venue.latitude, venue.longitude)} target="_blank" rel="noreferrer noopener" className="mt-1 inline-block text-[12px] font-semibold text-clay-600 hover:underline">
            {t('product.open_maps')}
          </a>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {upcoming.length === 0 && <li className="text-[12.5px] text-ink-400">{t('events.no_dates')}</li>}
        {upcoming.map((s) => {
          const taken = s.status === 'booked' || s.event_id;
          return (
            <li key={s.slot_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-cream-100 px-3 py-2">
              <span className="min-w-0 flex-1 text-[13px] text-ink-700">
                {when(s.starts_at, s.ends_at)}
                <span className="block text-[12px] font-semibold text-ink-800">{t('events.price_day', { price: formatPrice(s.price) })}</span>
              </span>
              {s.status === 'booked' ? (
                <span className="rounded-full bg-cream-300 px-2.5 py-1 text-[11px] font-semibold text-ink-500">{t('events.booked')}</span>
              ) : s.event_id ? (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">{t('events.call_open')}</span>
              ) : canCall ? (
                <Button size="sm" variant="secondary" disabled={taken} onClick={() => onCall(venue, s)}>
                  {t('events.call_artisans')}
                </Button>
              ) : (
                <span className="rounded-full bg-sage-100 px-2.5 py-1 text-[11px] font-semibold text-sage-600">{t('events.available')}</span>
              )}
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export default function Events() {
  const { user, token } = useAuth();
  const { t } = useT();
  const toast = useToast();
  const role = user?.role;
  const insider = role === 'artisan' || role === 'admin';
  const [tab, setTab] = useState('events');
  const [data, setData] = useState(null);
  const [venues, setVenues] = useState(null);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null); // { kind: 'call', venue, slot } | { kind: 'respond', ev }

  const load = useCallback(async () => {
    try {
      const [ev, vn] = await Promise.all([api.events.list(token), api.events.venues()]);
      setData(ev.data);
      setVenues(vn.data);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn, okMessage) => {
    try {
      await fn();
      toast.success(okMessage);
      setDialog(null);
      await load();
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  const decline = (ev) => {
    if (!window.confirm(t('events.decline_confirm'))) return;
    act(() => api.events.respond(ev.event_id, { response: 'no' }, token), t('events.declined_ok')).catch(() => {});
  };
  const approve = (ev) => {
    if (!window.confirm(t('events.approve_confirm', { venue: ev.venue_name, price: formatPrice(ev.price) }))) return;
    act(() => api.events.approve(ev.event_id, '', token), t('events.approved_ok')).catch(() => {});
  };
  const reject = (ev) => {
    const note = window.prompt(t('events.reject_reason'));
    if (!note?.trim()) return;
    act(() => api.events.reject(ev.event_id, note.trim(), token), t('events.rejected_ok')).catch(() => {});
  };

  const events = data?.events ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar title={t('events.title')} subtitle={t('events.subtitle')} />
      <div className="shrink-0 border-b border-cream-300/70 bg-cream-100 px-5 md:px-8">
        <div className="mx-auto flex max-w-6xl gap-1 py-2">
          {['events', 'venues'].map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${tab === k ? 'bg-ink-800 text-cream-100' : 'text-ink-500 hover:bg-cream-200'}`}
            >
              {t(`events.tab.${k}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-clean px-5 pb-8 pt-5 md:px-8">
        <Container className="space-y-4">
          {insider && <SeriousWarning t={t} />}
          {role === 'artisan' || role === 'admin' ? (
            <p className="text-[13px] leading-relaxed text-ink-500">{t('events.how_insider', { percent: Math.round((data?.threshold ?? 0.3) * 100) })}</p>
          ) : (
            <p className="text-[13px] leading-relaxed text-ink-500">
              {t('events.how_public')}{' '}
              <Link to="/how-it-works" className="font-semibold text-clay-600 hover:underline">{t('nav.help')}</Link>
            </p>
          )}

          {error ? (
            <EmptyState icon="alert" title={t('common.load_error')} message={error} action={<Button variant="secondary" onClick={load}>{t('common.retry')}</Button>} />
          ) : !data || !venues ? (
            <div className="space-y-3">
              <div className="skeleton h-40 w-full rounded-3xl" />
              <div className="skeleton h-40 w-full rounded-3xl" />
            </div>
          ) : tab === 'events' ? (
            events.length === 0 ? (
              <EmptyState
                icon="calendar"
                title={t('events.empty_title')}
                message={insider ? t('events.empty_insider') : t('events.empty_public')}
                action={insider && <Button onClick={() => setTab('venues')}>{t('events.see_venues')}</Button>}
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {events.map((ev) => (
                  <EventCard
                    key={ev.event_id}
                    ev={ev}
                    meta={data}
                    role={role}
                    t={t}
                    onRespond={(e) => setDialog({ kind: 'respond', ev: e })}
                    onDecline={decline}
                    onApprove={approve}
                    onReject={reject}
                  />
                ))}
              </div>
            )
          ) : (
            <>
              <p className="rounded-2xl bg-cream-200/60 px-4 py-3 text-[12.5px] leading-relaxed text-ink-500">{t('events.price_note')}</p>
              <div className="grid gap-4 lg:grid-cols-2">
                {venues.map((v) => (
                  <VenueCard key={v.venue_id} venue={v} canCall={insider} t={t} onCall={(venue, slot) => setDialog({ kind: 'call', venue, slot })} />
                ))}
              </div>
            </>
          )}
        </Container>
      </div>

      {dialog?.kind === 'call' && (
        <CommitDialog
          t={t}
          withDetails
          title={t('events.call_title')}
          subtitle={`${dialog.venue.name} · ${when(dialog.slot.starts_at, dialog.slot.ends_at)} · ${formatPrice(dialog.slot.price)}`}
          onClose={() => setDialog(null)}
          onSubmit={(f) =>
            act(() => api.events.create({ slot_id: dialog.slot.slot_id, ...f }, token), t('events.call_ok')).then(() => setTab('events'))
          }
        />
      )}
      {dialog?.kind === 'respond' && (
        <CommitDialog
          t={t}
          title={dialog.ev.title}
          subtitle={`${dialog.ev.venue_name} · ${when(dialog.ev.starts_at, dialog.ev.ends_at)}`}
          allowed={dialog.ev.activities}
          onClose={() => setDialog(null)}
          onSubmit={(f) =>
            act(() => api.events.respond(dialog.ev.event_id, { response: 'yes', activities: f.activities, acknowledged: true }, token), t('events.commit_ok'))
          }
        />
      )}
    </div>
  );
}
