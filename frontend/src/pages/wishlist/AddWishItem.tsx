import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { addWishItem } from '../../api/wishlist';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { useDraft } from '../../hooks/useDraft';
import type { BookCondition, Genre, WishItemInput, WishItemKind } from '../../types';
import { CONDITIONS, GENRES, LANGUAGES, LIMITS } from '../../utils/constants';
import { sanitizeWishDraft, wishDraftHasContent } from '../../utils/drafts';
import { errorMessage } from '../../utils/errors';
import { STORAGE_KEYS } from '../../utils/storage';
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

const EMPTY_FORM: FormState = { title: '', author: '', genre: '', language: '', minCondition: '' };
const draftOptions = { sanitize: sanitizeWishDraft, hasContent: wishDraftHasContent };

export default function AddWishItem() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const draft = useDraft(STORAGE_KEYS.wishDraft, user?.id, draftOptions);
  const [kind, setKind] = useState<WishItemKind>(() => draft.restored?.kind ?? 'TITLE');
  const [form, setForm] = useState<FormState>(() => {
    if (!draft.restored) return EMPTY_FORM;
    const { kind: _kind, ...fields } = draft.restored;
    return fields;
  });
  const [edited, setEdited] = useState(false);
  const [errors, setErrors] = useState<WishItemErrors>({});
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const { save: saveDraft } = draft;

  // Keep what the reader has typed so far, but only once they change something.
  useEffect(() => {
    if (edited) saveDraft({ kind, ...form });
  }, [edited, kind, form, saveDraft]);

  function update(next: Partial<FormState>) {
    setEdited(true);
    setForm((current) => ({ ...current, ...next }));
  }

  function chooseKind(next: WishItemKind) {
    setEdited(true);
    setKind(next);
  }

  function discardDraft() {
    draft.discard();
    setEdited(false);
    setKind('TITLE');
    setForm(EMPTY_FORM);
  }

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
      draft.discard();
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
      onClick={() => chooseKind(value)}
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
        {draft.restored && (
          <div className="space-y-2">
            <Alert tone="info">We kept what you started earlier.</Alert>
            <Button variant="ghost" onClick={discardDraft}>
              Start again
            </Button>
          </div>
        )}

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
              onChange={(event) => update({ title: event.target.value })}
              error={errors.title}
            />
            <Input
              label="Author (optional)"
              value={form.author}
              maxLength={LIMITS.authorMax}
              onChange={(event) => update({ author: event.target.value })}
              error={errors.author}
            />
          </>
        ) : (
          <SelectField
            label="Genre"
            value={form.genre}
            onChange={(event) => update({ genre: event.target.value as Genre | '' })}
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
          onChange={(event) => update({ language: event.target.value })}
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
          onChange={(event) => update({ minCondition: event.target.value as BookCondition | '' })}
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
