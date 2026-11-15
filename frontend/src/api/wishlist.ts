// Wish list: specific titles or broader interests.
import { api, seg } from './client';
import type { WishItem, WishItemInput, WishItemUpdate } from './types';

/** Your wish list: still wanted first (by priority, then newest), then found entries. */
export function listWishItems(signal?: AbortSignal): Promise<WishItem[]> {
  return api.get<WishItem[]>('/wishlist', { signal });
}

/**
 * Add a title (kind TITLE) or a broader interest (kind INTEREST).
 * The server enforces the 100-entry limit and rejects duplicates with 409.
 */
export function addWishItem(input: WishItemInput, signal?: AbortSignal): Promise<WishItem> {
  return api.post<WishItem>('/wishlist', { body: input, signal });
}

/** Remove one of your wish list entries. */
export function removeWishItem(wishItemId: string, signal?: AbortSignal): Promise<void> {
  return api.delete<void>(`/wishlist/${seg(wishItemId)}`, { signal });
}

/** Change an entry's priority and/or mark it found ("Got it") or still wanted. */
export function updateWishItem(wishItemId: string, update: WishItemUpdate, signal?: AbortSignal): Promise<WishItem> {
  return api.patch<WishItem>(`/wishlist/${seg(wishItemId)}`, { body: update, signal });
}
