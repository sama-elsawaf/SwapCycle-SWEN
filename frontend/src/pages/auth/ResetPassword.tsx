import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { confirmPasswordReset, requestPasswordReset } from '../../api/auth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { errorMessage } from '../../utils/errors';
import { validateEmail, validatePassword } from '../../utils/validation';
import { Alert, BackLink, linkClass } from '../PageParts';
import { LockIcon, MailIcon } from './AuthDecor';

/**
 * Without a token: ask for a reset link. With ?token=…: choose a new password.
 * The token is moved out of the address bar straight away so it is not kept
 * in history or sent onward in a Referer header.
 */
export default function ResetPassword() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [token] = useState(() => searchParams.get('token') ?? '');

  useEffect(() => {
    if (searchParams.has('token')) setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  return (
    <main className="min-h-screen bg-blush px-6 py-6">
      <div className="mx-auto w-full max-w-md">
        <BackLink to="/login" label="Back to log in" />
        {token ? <ChooseNewPassword token={token} /> : <RequestLink />}
      </div>
    </main>
  );
}

function RequestLink() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const invalid = validateEmail(email);
    setFieldError(invalid);
    setFormError(undefined);
    if (invalid) return;

    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="mt-10 font-display text-4xl font-bold text-navy">Forgot your password?</h1>
      <p className="mt-3 text-navy">Enter your email and we will send you a link to choose a new one.</p>
      {sent ? (
        <div className="mt-8">
          {/* Same message whether or not the account exists. */}
          <Alert tone="success">
            If an account exists for that email, a reset link is on its way. The link works once, for 30 minutes.
          </Alert>
        </div>
      ) : (
        <form noValidate onSubmit={handleSubmit} className="mt-8 space-y-4">
          {formError && <Alert tone="error">{formError}</Alert>}
          <Input
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            icon={<MailIcon />}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldError}
          />
          <Button type="submit" variant="primary" fullWidth loading={submitting} disabled={submitting}>
            Send reset link
          </Button>
        </form>
      )}
    </>
  );
}

function ChooseNewPassword({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string>();
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next = {
      password: validatePassword(password),
      confirm: password === confirm ? undefined : 'The passwords do not match.',
    };
    setErrors(next);
    setFormError(undefined);
    if (next.password || next.confirm) return;

    setSubmitting(true);
    try {
      await confirmPasswordReset({ token, newPassword: password });
      setDone(true);
    } catch (error) {
      setFormError(errorMessage(error, 'This reset link is invalid or has expired.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mt-10 space-y-6">
        <h1 className="font-display text-4xl font-bold text-navy">Password changed</h1>
        <Alert tone="success">Your password has been changed. You can now log in with it.</Alert>
        <p>
          <Link to="/login" className={linkClass}>
            Go to log in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <h1 className="mt-10 font-display text-4xl font-bold text-navy">Choose a new password</h1>
      <form noValidate onSubmit={handleSubmit} className="mt-8 space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        <Input
          label="New password"
          type="password"
          name="newPassword"
          autoComplete="new-password"
          icon={<LockIcon />}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          hint="At least 8 characters."
          maxLength={128}
        />
        <Input
          label="Confirm new password"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          icon={<LockIcon />}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          error={errors.confirm}
          maxLength={128}
        />
        <Button type="submit" variant="primary" fullWidth loading={submitting} disabled={submitting}>
          Change password
        </Button>
      </form>
    </>
  );
}
