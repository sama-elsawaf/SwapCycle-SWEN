import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { errorMessage } from '../../utils/errors';
import { homeFor, safeRedirectPath } from '../../utils/navigation';
import { validateEmail } from '../../utils/validation';
import { Alert, BackLink, linkClass } from '../PageParts';
import { EyeIcon, Leaf, LockIcon, MailIcon } from './AuthDecor';

// Social sign-in is planned for later; the buttons are shown (as in the
// design) but disabled until the backend supports it.
const SOCIAL_PROVIDERS = ['Google', 'Apple', 'Microsoft'] as const;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const errors = { email: validateEmail(email), password: password ? undefined : 'Enter your password.' };
    setFieldErrors(errors);
    setFormError(undefined);
    if (errors.email || errors.password) return;

    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      const from = (location.state as { from?: unknown } | null)?.from;
      navigate(user.onboardingCompleted ? safeRedirectPath(from) : homeFor(user), { replace: true });
    } catch (error) {
      setFormError(errorMessage(error, 'We could not log you in. Please try again.'));
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-blush px-6 py-6">
      <div aria-hidden="true" className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-pink-light" />
      <div aria-hidden="true" className="absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-pink-light" />
      <Leaf className="absolute -right-4 top-4 h-40 w-auto rotate-[30deg]" />
      <Leaf className="absolute -left-4 bottom-0 h-36 w-auto -rotate-12" />

      <div className="relative mx-auto w-full max-w-md">
        <BackLink to="/" label="Back to welcome" />

        <h1 className="mt-10 font-display text-5xl font-bold text-navy">Welcome Back</h1>
        <p className="mt-3 text-lg text-navy">Log in to continue your book exchange journey.</p>

        <form noValidate onSubmit={handleSubmit} className="mt-8 space-y-4" aria-describedby={formError ? 'login-error' : undefined}>
          {formError && (
            <div id="login-error">
              <Alert tone="error">{formError}</Alert>
            </div>
          )}
          <Input
            label="Email"
            hideLabel
            type="email"
            name="email"
            autoComplete="email"
            placeholder="Email"
            icon={<MailIcon />}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldErrors((current) => ({ ...current, email: undefined }));
            }}
            error={fieldErrors.email}
          />
          <Input
            label="Password"
            hideLabel
            type={showPassword ? 'text' : 'password'}
            name="password"
            autoComplete="current-password"
            placeholder="Password"
            icon={<LockIcon />}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setFieldErrors((current) => ({ ...current, password: undefined }));
            }}
            error={fieldErrors.password}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="rounded p-1 text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-deep"
              >
                <EyeIcon crossed={showPassword} />
              </button>
            }
          />
          <p className="text-right">
            <Link to="/reset-password" className={linkClass}>
              Forgot Password?
            </Link>
          </p>
          <Button type="submit" variant="primary" fullWidth loading={submitting} disabled={submitting}>
            Log In
          </Button>
        </form>

        <div className="my-6 flex items-center gap-4 text-sm text-navy" aria-hidden="true">
          <span className="h-px flex-1 bg-soft" />
          OR
          <span className="h-px flex-1 bg-soft" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {SOCIAL_PROVIDERS.map((provider) => (
            <button
              key={provider}
              type="button"
              disabled
              title="Coming soon"
              aria-label={`Continue with ${provider} (coming soon)`}
              className="h-14 cursor-not-allowed rounded-card border border-soft bg-white text-sm font-medium text-slate"
            >
              {provider}
            </button>
          ))}
        </div>

        <p className="mt-8 text-center text-navy">
          Don&apos;t have an account?{' '}
          <Link to="/register" className={linkClass}>
            Sign Up
          </Link>
        </p>
      </div>
    </main>
  );
}
