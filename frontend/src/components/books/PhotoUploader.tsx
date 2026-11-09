import { useId, useState } from 'react';
import Alert from '../ui/Alert';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 5;
const ALLOWED = ['image/jpeg', 'image/png'];

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
}

/** Client-side convenience checks only. The server re-validates (magic bytes, size, count). */
export default function PhotoUploader({ files, onChange }: Props) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);

  const handle = (picked: FileList | null) => {
    if (!picked) return;
    const next = [...files];
    for (const f of Array.from(picked)) {
      if (!ALLOWED.includes(f.type)) return setError('Only JPEG and PNG photos are allowed.');
      if (f.size > MAX_BYTES) return setError('Each photo must be 5 MB or smaller.');
      next.push(f);
    }
    if (next.length > MAX_FILES) return setError(`You can add up to ${MAX_FILES} photos.`);
    setError(null);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <label htmlFor={id} className="block text-sm font-medium">Photos (JPEG or PNG, up to 5 MB each)</label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png"
        multiple
        onChange={(e) => { handle(e.target.files); e.target.value = ''; }}
        className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-rose-deep file:px-4 file:py-2 file:font-semibold file:text-white"
      />
      {error && <Alert kind="error">{error}</Alert>}
      <ul className="flex flex-wrap gap-2">
        {files.map((f, i) => (
          <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs">
            <span className="max-w-[10rem] truncate">{f.name}</span>
            <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))}>✕</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
