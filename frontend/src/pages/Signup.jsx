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

function evaluatePassword(password) {
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isAlphanumeric = (hasUpper || hasLower) && hasNumber;

  const rules = [
    { key: 'minLength', label: 'At least 8 characters', valid: hasMinLength },
    { key: 'alphanumeric', label: 'Alphanumeric combination (letters & numbers)', valid: isAlphanumeric },
    { key: 'upper', label: 'At least one uppercase letter (A–Z)', valid: hasUpper },
    { key: 'lower', label: 'At least one lowercase letter (a–z)', valid: hasLower },
    { key: 'number', label: 'At least one number (0–9)', valid: hasNumber },
    { key: 'special', label: 'At least one special character (!@#$%^&*)', valid: hasSpecial },
  ];

  const passedCount = [hasMinLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
  const isAllValid = passedCount === 5;

  let level = '';
  let colorClass = '';
  let message = '';

  if (!password) {
    level = '';
  } else if (passedCount <= 2 || !hasMinLength) {
    level = 'Weak';
    colorClass = 'text-red-600'; // Red warning for weak password
    message = 'Weak password — must be 8+ chars with uppercase, lowercase, number & special character.';
  } else if (passedCount < 5) {
    level = 'Moderate';
    colorClass = 'text-lime-600'; // Greenish-yellow for moderate password
    message = 'Moderate password — add the remaining requirements to make it strong.';
  } else {
    level = 'Strong';
    colorClass = 'text-green-600'; // Green for strong password
    message = 'Strong password — meets all security requirements!';
  }

  return { rules, isAllValid, level, colorClass, message };
}

// Mirrors the backend's own validation so the user hears about a bad
// phone number or weak password before a round trip, not after.
function validate({ name, phone, password }) {
  const errors = {};
  if (!name.trim()) errors.name = 'Please enter your name';
  if (!/^[0-9]{10,15}$/.test(phone.trim())) errors.phone = 'Enter 10–15 digits, no spaces';

  const { isAllValid } = evaluatePassword(password);
  if (!isAllValid) {
    errors.password =
      'Password must be at least 8 characters and include uppercase, lowercase, number, and special character';
  }
  return errors;
}

export default function Signup() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState('customer');
  const [form, setForm] = useState({ name: '', phone: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const pwdEval = evaluatePassword(form.password);

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

        <Field
          label="Password"
          id="password"
          error={errors.password}
          hint={!form.password ? 'At least 8 chars with uppercase, lowercase, number & symbol' : undefined}
        >
          <div className="relative flex items-center">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              value={form.password}
              onChange={set('password')}
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 grid h-8 w-8 place-items-center rounded-full text-ink-400 transition hover:bg-cream-200 hover:text-ink-700"
            >
              {showPassword ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          {/* Dynamic Password Strength Warning & Checklist */}
          {form.password.length > 0 && (
            <div className="mt-2 space-y-1.5 text-[12.5px]">
              <p className={`font-semibold ${pwdEval.colorClass}`}>
                Password strength: {pwdEval.level} — {pwdEval.message}
              </p>
              <ul className="grid grid-cols-1 gap-1 text-[12px]">
                {pwdEval.rules.map((r) => (
                  <li
                    key={r.key}
                    className={`flex items-center gap-1.5 ${
                      r.valid ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    <span>{r.valid ? '✓' : '✗'}</span>
                    <span>{r.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
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