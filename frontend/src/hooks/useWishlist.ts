import { useCallback } from 'react';

import { addWishItem, listWishItems, removeWishItem, updateWishItem } from '../api/wishlist';
import type { WishItem, WishItemInput, WishItemUpdate } from '../types';
import { sortWishItems } from '../utils/format';
import { useAsync } from './useAsync';

export function useWishlist() {
  const { data, error, loading, reload, setData } = useAsync(listWishItems, []);
  const items = data ?? [];

  const add = useCallback(
    async (input: WishItemInput): Promise<WishItem> => {
      const item = await addWishItem(input);
      setData((current) => sortWishItems([item, ...(current ?? [])]));
      return item;
    },
    [setData],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      await removeWishItem(id);
      setData((current) => (current ?? []).filter((item) => item.id !== id));
    },
    [setData],
  );

  /** Change priority or "Got it"; the list is re-sorted the way the server sorts it. */
  const update = useCallback(
    async (id: string, change: WishItemUpdate): Promise<WishItem> => {
      const updated = await updateWishItem(id, change);
      setData((current) => sortWishItems((current ?? []).map((item) => (item.id === id ? updated : item))));
      return updated;
    },
    [setData],
  );

  return { items, error, loading, reload, add, remove, update };
}
