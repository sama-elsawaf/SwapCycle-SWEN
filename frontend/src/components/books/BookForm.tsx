import { useState } from 'react';
import type { FormEvent } from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import PhotoUploader from './PhotoUploader';
import { CONDITION_LABELS, GENRES } from '../../types';
import type { BookCondition } from '../../types';

export interface BookFormValues {
  title: string;
  author: string;
  edition: string;
  language: string;
  genre: string;
  condition: BookCondition;
  conditionNotes: string;
  photos: File[];
}

interface Props {
  initial?: Partial<BookFormValues>;
  submitLabel?: string;
  submitting?: boolean;
  serverError?: string | null;
  onSubmit: (values: BookFormValues) => void;
}

type Errors = Partial<Record<keyof BookFormValues, string>>;

const selectClass =
  'w-full rounded-xl border border-line bg-white px-3 py-3 text-navy';

/** Client checks are for convenience only; the server validates everything again. */
function validate(v: BookFormValues): Errors {
  const e: Errors = {};
  if (!v.title.trim()) e.title = 'Enter the book title.';
  else if (v.title.length > 200) e.title = 'Title must be 200 characters or fewer.';
  if (!v.author.trim()) e.author = 'Enter the author.';
  if (!v.language.trim()) e.language = 'Enter the language.';
  if (v.conditionNotes.length > 500) e.conditionNotes = 'Notes must be 500 characters or fewer.';
  if (v.photos.length === 0) e.photos = 'Add at least one photo of your copy.';
  return e;
}

export default function BookForm({ initial, submitLabel = 'Save book', submitting, serverError, onSubmit }: Props) {
  const [values, setValues] = useState<BookFormValues>({
    title: '', author: '', edition: '', language: 'English', genre: GENRES[0],
    condition: 'GOOD', conditionNotes: '', photos: [], ...initial,
  });
  const [errors, setErrors] = useState<Errors>({});

  const set = <K extends keyof BookFormValues>(key: K, value: BookFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {serverError && <Alert kind="error">{serverError}</Alert>}

      <Input label="Title" value={values.title} error={errors.title} maxLength={200}
        onChange={(e) => set('title', e.target.value)} />
      <Input label="Author" value={values.author} error={errors.author}
        onChange={(e) => set('author', e.target.value)} />
      <Input label="Edition (optional)" value={values.edition}
        onChange={(e) => set('edition', e.target.value)} />
      <Input label="Language" value={values.language} error={errors.language}
        onChange={(e) => set('language', e.target.value)} />

      <div>
        <label htmlFor="book-genre" className="block text-sm font-medium mb-1">Genre</label>
        <select id="book-genre" className={selectClass} value={values.genre}
          onChange={(e) => set('genre', e.target.value)}>
          {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="book-condition" className="block text-sm font-medium mb-1">Condition</label>
        <select id="book-condition" className={selectClass} value={values.condition}
          onChange={(e) => set('condition', e.target.value as BookCondition)}>
          {(Object.keys(CONDITION_LABELS) as BookCondition[]).map((c) => (
            <option key={c} value={c}>{CONDITION_LABELS[c]}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="book-notes" className="block text-sm font-medium mb-1">
          Condition notes (optional)
        </label>
        <textarea id="book-notes" rows={3} maxLength={500} value={values.conditionNotes}
          aria-invalid={errors.conditionNotes ? true : undefined}
          onChange={(e) => set('conditionNotes', e.target.value)}
          className={`${selectClass} ${errors.conditionNotes ? 'border-danger' : ''}`} />
        {errors.conditionNotes && <p role="alert" className="mt-1 text-sm text-danger">{errors.conditionNotes}</p>}
      </div>

      <PhotoUploader files={values.photos} onChange={(f) => set('photos', f)} />
      {errors.photos && <p role="alert" className="text-sm text-danger">{errors.photos}</p>}

      <Button type="submit" loading={submitting}>{submitLabel}</Button>
    </form>
  );
}
