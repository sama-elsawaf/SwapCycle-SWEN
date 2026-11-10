import { useCallback, useState } from 'react';

import { clearDraft, loadDraft, saveDraft } from '../utils/drafts';
import type { StorageKey } from '../utils/storage';

interface DraftOptions<T> {
  /** Checks and cleans whatever was stored; returns undefined to ignore it. */
  sanitize: (values: unknown) => T | undefined;
  /** Whether the current values are worth keeping; empty forms clear the draft. */
  hasContent: (values: T) => boolean;
}

/**
 * Loads a saved draft for the logged-in reader once, and returns helpers to
 * keep it up to date. Without an owner (not logged in) nothing is stored.
 */
export function useDraft<T>(key: StorageKey, owner: string | undefined, options: DraftOptions<T>) {
  const { sanitize, hasContent } = options;
  const [restored, setRestored] = useState<T | undefined>(() =>
    owner ? loadDraft(key, owner, sanitize) : undefined,
  );

  const save = useCallback(
    (values: T) => {
      if (!owner) return;
      if (hasContent(values)) saveDraft(key, owner, values);
      else clearDraft(key);
    },
    [key, owner, hasContent],
  );

  const discard = useCallback(() => {
    clearDraft(key);
    setRestored(undefined);
  }, [key]);

  return { restored, save, discard };
}
