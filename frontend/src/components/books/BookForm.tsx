import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import type { BookCondition, BookInput, Genre, MeetingArea } from '../../types';
import { CONDITIONS, GENRES, LANGUAGES, LIMITS } from '../../utils/constants';
import { validateBookInput } from '../../utils/validation';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import Input from '../ui/Input';
import PhotoUploader from './PhotoUploader';

export interface BookFormValues {
  title: string;
  author: string;
  edition: string;
  language: string;
  genre: Genre;
  condition: BookCondition;
  conditionNotes: string;
  exchangeAreaId: number | null;
  photos: File[];
}

interface Props {
  initial?: Partial<BookFormValues>;
  /** General campus areas for the exchange-area dropdown. */
  areas?: MeetingArea[];
  submitLabel?: string;
  submitting?: boolean;
  serverError?: string | null;
  /** Photos required before submitting (1 when listing, 0 when editing). */
  minPhotos?: number;
  /** How many new photos may be added. */
  maxPhotos?: number;
  onSubmit: (values: BookFormValues) => void;
  /** Called after each change the reader makes (not on first render), e.g. to save a draft. */
  onValuesChange?: (values: BookFormValues) => void;
}

type Errors = Partial<Record<keyof BookFormValues, string>>;

const selectClass =
  'h-12 w-full rounded-card border border-soft bg-white px-3 text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-deep';

/** The listing fields as the API expects them (photos are uploaded separately). */
export function toBookInput(values: BookFormValues): BookInput {
  return {
    title: values.title.trim(),
    author: values.author.trim(),
    edition: values.edition.trim(),
    language: values.language,
    genre: values.genre,
    condition: values.condition,
    conditionNotes: values.conditionNotes.trim(),
    exchangeAreaId: values.exchangeAreaId,
  };
}

/** Client checks are for convenience only; the server validates everything again. */
function validate(values: BookFormValues, minPhotos: number): Errors {
  const errors: Errors = { ...validateBookInput(toBookInput(values)) };
  if (values.photos.length < minPhotos) errors.photos = 'Add at least one photo of your copy.';
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message)) as Errors;
}

export default function BookForm({
  initial,
  areas = [],
  submitLabel = 'Save book',
  submitting,
  serverError,
  minPhotos = 1,
  maxPhotos,
  onSubmit,
  onValuesChange,
}: Props) {
  const [values, setValues] = useState<BookFormValues>({
    title: '',
    author: '',
    edition: '',
    language: 'en',
    genre: 'FICTION',
    condition: 'GOOD',
    conditionNotes: '',
    exchangeAreaId: null,
    photos: [],
    ...initial,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [edited, setEdited] = useState(false);

  const set = <K extends keyof BookFormValues>(key: K, value: BookFormValues[K]) => {
    setEdited(true);
    setValues((v) => ({ ...v, [key]: value }));
  };

  useEffect(() => {
    // Only the values trigger a report; a new callback identity does not.
    if (edited) onValuesChange?.(values);
  }, [values, edited]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const found = validate(values, minPhotos);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {serverError && <Alert kind="error">{serverError}</Alert>}

      <Input label="Title" value={values.title} error={errors.title} maxLength={LIMITS.titleMax}
        onChange={(e) => set('title', e.target.value)} />
      <Input label="Author" value={values.author} error={errors.author} maxLength={LIMITS.authorMax}
        onChange={(e) => set('author', e.target.value)} />
      <Input label="Edition (optional)" value={values.edition} error={errors.edition} maxLength={LIMITS.editionMax}
        onChange={(e) => set('edition', e.target.value)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="book-language" className="mb-1 block text-sm font-medium text-navy">Language</label>
          <select id="book-language" className={selectClass} value={values.language}
            onChange={(e) => set('language', e.target.value)}>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="book-genre" className="mb-1 block text-sm font-medium text-navy">Genre</label>
          <select id="book-genre" className={selectClass} value={values.genre}
            onChange={(e) => set('genre', e.target.value as Genre)}>
            {GENRES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="book-condition" className="mb-1 block text-sm font-medium text-navy">Condition</label>
          <select id="book-condition" className={selectClass} value={values.condition}
            onChange={(e) => set('condition', e.target.value as BookCondition)}>
            {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}: {c.hint}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="book-area" className="mb-1 block text-sm font-medium text-navy">Exchange area</label>
          <select id="book-area" className={selectClass} value={values.exchangeAreaId ?? ''}
            onChange={(e) => set('exchangeAreaId', e.target.value ? Number(e.target.value) : null)}>
            <option value="">Not specified</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="book-notes" className="mb-1 block text-sm font-medium text-navy">
          Condition notes (optional)
        </label>
        <textarea id="book-notes" rows={3} maxLength={LIMITS.conditionNotesMax} value={values.conditionNotes}
          aria-invalid={errors.conditionNotes ? true : undefined}
          aria-describedby={errors.conditionNotes ? 'book-notes-error' : undefined}
          onChange={(e) => set('conditionNotes', e.target.value)}
          className={`w-full rounded-card border bg-white px-3 py-3 text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-deep ${errors.conditionNotes ? 'border-danger' : 'border-soft'}`} />
        {errors.conditionNotes && <p id="book-notes-error" className="mt-1 text-sm text-danger">{errors.conditionNotes}</p>}
      </div>

      {maxPhotos !== 0 && (
        <>
          <PhotoUploader files={values.photos} max={maxPhotos} onChange={(f) => set('photos', f)} />
          {errors.photos && <p role="alert" className="text-sm text-danger">{errors.photos}</p>}
        </>
      )}

      <Button type="submit" fullWidth loading={submitting}>{submitLabel}</Button>
    </form>
  );
}
