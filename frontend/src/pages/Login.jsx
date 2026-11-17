import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { Field, Input } from '../components/Field';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useT();

  const [form, setForm] = useState({ phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await login(form.phone.trim(), form.password);
      const fallback = { artisan: '/artisan', admin: '/admin' }[data.user.role] || '/feed';
      navigate(location.state?.from || fallback, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <Link
        to="/"
        aria-label={t('common.back')}
        className="-ml-2 grid h-9 w-9 place-items-center rounded-full text-ink-500 transition hover:bg-cream-200"
      >
        <Icon name="back" />
      </Link>

      <div className="mt-6 animate-fade-up">
        <h1 className="font-display text-[32px] font-semibold leading-tight text-ink-800">
          {t('auth.welcome_back')}
        </h1>
        <p className="mt-1.5 text-[14.5px] text-ink-400">{t('auth.login_hint')}</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label={t('auth.phone')} id="phone">
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="9876543210"
            value={form.phone}
            onChange={set('phone')}
            required
          />
        </Field>

        <Field label={t('auth.password')} id="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={form.password}
            onChange={set('password')}
            required
          />
        </Field>

        {error && (
          <div className="flex items-start gap-2 rounded-2xl bg-clay-50 px-4 py-3 text-[13.5px] font-medium text-clay-700">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
            <span>{error}</span>
          </div>
        )}

        <Button type="submit" size="lg" loading={busy} className="w-full !mt-6">
          {t('auth.login')}
        </Button>
      </form>

      <p className="mt-6 text-center text-[13.5px] text-ink-400">
        {t('auth.new_here')}{' '}
        <Link to="/signup" className="font-semibold text-clay-600 underline-offset-4 hover:underline">
          {t('auth.create_account')}
        </Link>
      </p>
    </AuthLayout>
  );
}
