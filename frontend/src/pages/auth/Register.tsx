import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { errorMessage } from '../../utils/errors';
import { validateDisplayName, validateEmail, validatePassword } from '../../utils/validation';
import { Alert, BackLink, linkClass } from '../PageParts';
import { EyeIcon, Leaf, LockIcon, MailIcon, UserIcon } from './AuthDecor';

interface RegisterErrors {
  displayName?: string;
  email?: string;
  password?: string;
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<RegisterErrors>({});
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const errors: RegisterErrors = {
      displayName: validateDisplayName(displayName),
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setFieldErrors(errors);
    setFormError(undefined);
    if (errors.displayName || errors.email || errors.password) return;

    setSubmitting(true);
    try {
      await register({ displayName: displayName.trim(), email: email.trim(), password });
      navigate('/onboarding', { replace: true });
    } catch (error) {
      setFormError(errorMessage(error, 'We could not create your account. Please try again.'));
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-blush px-6 py-6">
      <div aria-hidden="true" className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-pink-light" />
      <Leaf className="absolute -right-4 top-4 h-40 w-auto rotate-[30deg]" />

      <div className="relative mx-auto w-full max-w-md">
        <BackLink to="/" label="Back to welcome" />

        <h1 className="mt-10 font-display text-5xl font-bold text-navy">Join SwapCycle</h1>
        <p className="mt-3 text-lg text-navy">Swap the books you have read for ones you want to read.</p>

        <form noValidate onSubmit={handleSubmit} className="mt-8 space-y-4">
          {formError && <Alert tone="error">{formError}</Alert>}
          <Input
            label="Display name"
            name="displayName"
            autoComplete="nickname"
            placeholder="How other readers see you"
            icon={<UserIcon />}
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
              setFieldErrors((current) => ({ ...current, displayName: undefined }));
            }}
            error={fieldErrors.displayName}
            maxLength={40}
          />
          <Input
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@university.edu"
            icon={<MailIcon />}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldErrors((current) => ({ ...current, email: undefined }));
            }}
            error={fieldErrors.email}
            hint="Only you can see your email."
          />
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            name="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            icon={<LockIcon />}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setFieldErrors((current) => ({ ...current, password: undefined }));
            }}
            error={fieldErrors.password}
            maxLength={128}
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
          <Button type="submit" variant="primary" fullWidth loading={submitting} disabled={submitting}>
            Sign Up
          </Button>
        </form>

        <p className="mt-8 text-center text-navy">
          Already have an account?{' '}
          <Link to="/login" className={linkClass}>
            Log In
          </Link>
        </p>
      </div>
    </main>
  );
}
