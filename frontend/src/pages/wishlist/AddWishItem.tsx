import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { addWishItem } from '../../api/wishlist';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import type { BookCondition, Genre, WishItemInput, WishItemKind } from '../../types';
import { CONDITIONS, GENRES, LANGUAGES, LIMITS } from '../../utils/constants';
import { errorMessage } from '../../utils/errors';
import { hasErrors, validateWishItem, type WishItemErrors } from '../../utils/validation';
import { Alert, BackLink, PageHeading, SelectField } from '../PageParts';

/** Only the fields that belong to the chosen kind are sent. Call after validation. */
function toInput(kind: WishItemKind, form: FormState): WishItemInput {
  const shared = { language: form.language || null, minCondition: form.minCondition || null };
  return kind === 'TITLE'
    ? { kind, title: form.title.trim(), author: form.author.trim() || undefined, ...shared }
    : { kind, genre: form.genre as Genre, ...shared };
}

interface FormState {
  title: string;
  author: string;
  genre: Genre | '';
  language: string;
  minCondition: BookCondition | '';
}

export default function AddWishItem() {
  const navigate = useNavigate();
  const [kind, setKind] = useState<WishItemKind>('TITLE');
  const [form, setForm] = useState<FormState>({ title: '', author: '', genre: '', language: '', minCondition: '' });
  const [errors, setErrors] = useState<WishItemErrors>({});
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next = validateWishItem({ kind, ...form });
    setErrors(next);
    setFormError(undefined);
    if (hasErrors(next)) return;
    const input = toInput(kind, form);

    setSubmitting(true);
    try {
      await addWishItem(input);
      navigate('/wishlist', { replace: true, state: { added: true } });
    } catch (failure) {
      setFormError(errorMessage(failure, 'We could not add this to your wish list. Please try again.'));
      setSubmitting(false);
    }
  }

  const kindButton = (value: WishItemKind, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={kind === value}
      onClick={() => setKind(value)}
      className={
        'flex-1 rounded-full px-4 py-2 font-medium focus-visible:outline focus-visible:outline-2 ' +
        'focus-visible:outline-offset-2 focus-visible:outline-rose-deep ' +
        (kind === value ? 'bg-navy text-white' : 'text-navy')
      }
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-xl">
      <BackLink to="/wishlist" label="Back to wish list" />
      <PageHeading title="Add to wish list" subtitle="Ask for a specific book, or a genre you enjoy." />

      <form noValidate onSubmit={handleSubmit} className="space-y-5 rounded-card border border-soft bg-white p-5 sm:p-6">
        {formError && <Alert tone="error">{formError}</Alert>}

        <div role="radiogroup" aria-label="What are you looking for?" className="flex gap-2 rounded-full bg-pink-light p-1">
          {kindButton('TITLE', 'A specific book')}
          {kindButton('INTEREST', 'A genre')}
        </div>

        {kind === 'TITLE' ? (
          <>
            <Input
              label="Title"
              value={form.title}
              maxLength={LIMITS.titleMax}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              error={errors.title}
            />
            <Input
              label="Author (optional)"
              value={form.author}
              maxLength={LIMITS.authorMax}
              onChange={(event) => setForm({ ...form, author: event.target.value })}
              error={errors.author}
            />
          </>
        ) : (
          <SelectField
            label="Genre"
            value={form.genre}
            onChange={(event) => setForm({ ...form, genre: event.target.value as Genre | '' })}
            error={errors.genre}
          >
            <option value="">Choose a genre</option>
            {GENRES.map((genre) => (
              <option key={genre.value} value={genre.value}>
                {genre.label}
              </option>
            ))}
          </SelectField>
        )}

        <SelectField
          label="Language"
          value={form.language}
          onChange={(event) => setForm({ ...form, language: event.target.value })}
          error={errors.language}
        >
          <option value="">Any language</option>
          {LANGUAGES.map((language) => (
            <option key={language.code} value={language.code}>
              {language.label}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Minimum condition"
          value={form.minCondition}
          onChange={(event) => setForm({ ...form, minCondition: event.target.value as BookCondition | '' })}
        >
          <option value="">Any condition</option>
          {CONDITIONS.map((condition) => (
            <option key={condition.value} value={condition.value}>
              {condition.label} or better
            </option>
          ))}
        </SelectField>

        <Button type="submit" variant="primary" fullWidth loading={submitting} disabled={submitting}>
          Add to wish list
        </Button>
      </form>
    </div>
  );
}
