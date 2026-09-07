import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { Field, Input } from '../components/Field';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
      const fallback = data.user.role === 'artisan' ? '/artisan' : '/feed';
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
        aria-label="Back"
        className="-ml-2 grid h-9 w-9 place-items-center rounded-full text-ink-500 transition hover:bg-cream-200"
      >
        <Icon name="back" />
      </Link>

      <div className="mt-6 animate-fade-up">
        <h1 className="font-display text-[32px] font-semibold leading-tight text-ink-800">
          Welcome back
        </h1>
        <p className="mt-1.5 text-[14.5px] text-ink-400">
          Log in with the phone number you signed up with.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label="Phone number" id="phone">
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

        <Field label="Password" id="password">
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
          Log in
        </Button>
      </form>

      <p className="mt-6 text-center text-[13.5px] text-ink-400">
        New to ArtiSoul?{' '}
        <Link to="/signup" className="font-semibold text-clay-600 underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
