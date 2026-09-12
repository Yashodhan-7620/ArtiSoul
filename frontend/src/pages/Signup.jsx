import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { Field, Input } from '../components/Field';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  {
    value: 'customer',
    title: 'I want to buy',
    blurb: 'Browse makers near you',
    icon: 'compass',
  },
  {
    value: 'artisan',
    title: 'I want to sell',
    blurb: 'Open a shop, list your craft',
    icon: 'store',
  },
];

// Mirrors the backend's own validation so the user hears about a bad
// phone number before a round trip, not after.
function validate({ name, phone, password }) {
  const errors = {};
  if (!name.trim()) errors.name = 'Please enter your name';
  if (!/^[0-9]{10,15}$/.test(phone.trim())) errors.phone = 'Enter 10–15 digits, no spaces';
  if (password.length < 6) errors.password = 'At least 6 characters';
  return errors;
}

export default function Signup() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState('customer');
  const [form, setForm] = useState({ name: '', phone: '', password: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setApiError('');

    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      await register({
        role,
        name: form.name.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      // A brand-new artisan has no shop yet, so send them to set one up.
      navigate(role === 'artisan' ? '/artisan/shop' : '/feed', { replace: true });
    } catch (err) {
      setApiError(err.message);
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
          Create your account
        </h1>
        <p className="mt-1.5 text-[14.5px] text-ink-400">Takes about thirty seconds.</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        <fieldset>
          <legend className="field-label">I'm here to…</legend>
          <div className="grid grid-cols-2 gap-2.5">
            {ROLES.map((r) => {
              const active = role === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  aria-pressed={active}
                  className={`rounded-2xl border p-3.5 text-left transition active:scale-[0.98]
                    ${
                      active
                        ? 'border-clay-400 bg-clay-50 ring-4 ring-clay-500/10'
                        : 'border-cream-300 bg-white hover:border-clay-200'
                    }`}
                >
                  <Icon
                    name={r.icon}
                    className={`h-5 w-5 ${active ? 'text-clay-600' : 'text-ink-400'}`}
                    strokeWidth={active ? 2 : 1.75}
                  />
                  <p
                    className={`mt-2 text-[14px] font-semibold ${
                      active ? 'text-clay-700' : 'text-ink-700'
                    }`}
                  >
                    {r.title}
                  </p>
                  <p className="mt-0.5 text-[11.5px] leading-tight text-ink-400">{r.blurb}</p>
                </button>
              );
            })}
          </div>
        </fieldset>

        <Field label="Full name" id="name" error={errors.name}>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            placeholder="Meera Kulkarni"
            value={form.name}
            onChange={set('name')}
          />
        </Field>

        <Field label="Phone number" id="phone" error={errors.phone} hint="This is also your login ID">
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="9876543210"
            value={form.phone}
            onChange={set('phone')}
          />
        </Field>

        <Field label="Password" id="password" error={errors.password} hint="At least 6 characters">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={form.password}
            onChange={set('password')}
          />
        </Field>

        {apiError && (
          <div className="flex items-start gap-2 rounded-2xl bg-clay-50 px-4 py-3 text-[13.5px] font-medium text-clay-700">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
            <span>{apiError}</span>
          </div>
        )}

        <Button type="submit" size="lg" loading={busy} className="w-full !mt-6">
          {role === 'artisan' ? 'Create shop account' : 'Start browsing'}
        </Button>
      </form>

      <p className="mt-6 text-center text-[13.5px] text-ink-400">
        Already registered?{' '}
        <Link to="/login" className="font-semibold text-clay-600 underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
