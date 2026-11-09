import { useId, useState } from 'react';

import { checkPhotoFile, MAX_PHOTOS_PER_COPY } from '../../api/books';
import Alert from '../ui/Alert';

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
  /** How many photos may still be added (e.g. 5 minus photos already uploaded). */
  max?: number;
  disabled?: boolean;
}

/** Picks photos to upload. Client-side checks only; the server re-validates (magic bytes, size, count). */
export default function PhotoUploader({ files, onChange, max = MAX_PHOTOS_PER_COPY, disabled = false }: Props) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);

  const handle = (picked: FileList | null) => {
    if (!picked) return;
    const next = [...files];
    for (const file of Array.from(picked)) {
      const problem = checkPhotoFile(file);
      if (problem) return setError(problem);
      next.push(file);
    }
    if (next.length > max) return setError(`You can add up to ${max} more ${max === 1 ? 'photo' : 'photos'}.`);
    setError(null);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <label htmlFor={id} className="block text-sm font-medium text-navy">
        Photos (JPEG or PNG, up to 5 MB each)
      </label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png"
        multiple
        disabled={disabled || max <= 0}
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = '';
        }}
        className="block w-full text-sm text-navy file:mr-3 file:rounded-full file:border-0 file:bg-navy file:px-4 file:py-2 file:font-semibold file:text-white disabled:opacity-60"
      />
      {error && <Alert kind="error">{error}</Alert>}
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Photos to upload">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-2 rounded-full border border-soft bg-white px-3 py-1 text-xs text-navy"
            >
              <span className="max-w-[10rem] truncate">{file.name}</span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="rounded-full px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-deep"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
