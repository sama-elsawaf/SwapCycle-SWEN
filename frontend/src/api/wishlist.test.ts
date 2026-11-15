import { afterEach, describe, expect, it, vi } from 'vitest';
import { addWishItem, listWishItems, removeWishItem, updateWishItem } from './wishlist';
import { callAt, errorBody, jsonResponse, mockFetch } from './testUtils';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('wishlist', () => {
  it('lists entries', async () => {
    const fetchMock = mockFetch(jsonResponse(200, { data: [{ id: 'w1' }] }));
    await expect(listWishItems()).resolves.toEqual([{ id: 'w1' }]);
    expect(callAt(fetchMock).url).toBe('/api/wishlist');
  });

  it('adds a title entry', async () => {
    const fetchMock = mockFetch(jsonResponse(201, { data: { id: 'w1' } }));
    await addWishItem({ kind: 'TITLE', title: 'Dune', language: 'en', minCondition: 'GOOD' });
    const { init } = callAt(fetchMock);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      kind: 'TITLE',
      title: 'Dune',
      language: 'en',
      minCondition: 'GOOD',
    });
  });

  it('adds an interest entry', async () => {
    const fetchMock = mockFetch(jsonResponse(201, { data: { id: 'w2' } }));
    await addWishItem({ kind: 'INTEREST', genre: 'SCIENCE_FICTION' });
    expect(JSON.parse(callAt(fetchMock).init.body as string)).toEqual({
      kind: 'INTEREST',
      genre: 'SCIENCE_FICTION',
    });
  });

  it('a duplicate entry surfaces as CONFLICT', async () => {
    mockFetch(jsonResponse(409, errorBody('CONFLICT', 'Already on your wish list')));
    await expect(addWishItem({ kind: 'INTEREST', genre: 'FANTASY' })).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
    });
  });

  it('removes an entry', async () => {
    const fetchMock = mockFetch(jsonResponse(204));
    await expect(removeWishItem('w1')).resolves.toBeUndefined();
    const { url, init } = callAt(fetchMock);
    expect(url).toBe('/api/wishlist/w1');
    expect(init.method).toBe('DELETE');
  });

  it('changes priority and marks an entry found', async () => {
    const fetchMock = mockFetch(jsonResponse(200, { data: { id: 'w1', priority: 'HIGH', fulfilled: true } }));
    await expect(updateWishItem('w1', { priority: 'HIGH', fulfilled: true })).resolves.toMatchObject({
      fulfilled: true,
    });
    const { url, init } = callAt(fetchMock);
    expect(url).toBe('/api/wishlist/w1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ priority: 'HIGH', fulfilled: true });
  });
});
