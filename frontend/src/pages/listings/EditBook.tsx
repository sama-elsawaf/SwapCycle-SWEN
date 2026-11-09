import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import {
  deleteBook,
  deleteBookPhoto,
  getMyBook,
  MAX_PHOTOS_PER_COPY,
  relistBook,
  updateBook,
  uploadBookPhoto,
  withdrawBook,
} from '../../api/books';
import { assetUrl } from '../../api/client';
import BookForm, { toBookInput, type BookFormValues } from '../../components/books/BookForm';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { useAsync } from '../../hooks/useAsync';
import { useMeetingAreas } from '../../hooks/useMeetingAreas';
import type { BookListing } from '../../types';
import { errorMessage, isNotFound } from '../../utils/errors';
import { pluralize, statusLabel, statusTone } from '../../utils/format';
import { Alert, BackLink, EmptyState, LoadingState, PageHeading } from '../PageParts';

type Message = { tone: 'success' | 'error'; text: string };

function initialMessage(state: unknown): Message | undefined {
  const { created, failedPhotos = 0 } = (state as { created?: boolean; failedPhotos?: number } | null) ?? {};
  if (!created) return undefined;
  if (failedPhotos > 0) {
    return {
      tone: 'error',
      text: `Your book is listed, but ${pluralize(failedPhotos, 'photo')} could not be uploaded. Try adding them again below.`,
    };
  }
  return { tone: 'success', text: 'Your book is listed.' };
}

function formValues(listing: BookListing): Partial<BookFormValues> {
  return {
    title: listing.title,
    author: listing.author,
    edition: listing.edition,
    language: listing.language,
    genre: listing.genre,
    condition: listing.condition,
    conditionNotes: listing.conditionNotes,
    exchangeAreaId: listing.exchangeArea?.id ?? null,
  };
}

export default function EditBook() {
  const { copyId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { areas } = useMeetingAreas();
  const { data: listing, error, loading, setData } = useAsync(() => getMyBook(copyId), [copyId]);
  const [message, setMessage] = useState<Message | undefined>(() => initialMessage(location.state));
  const [serverError, setServerError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Remounts the form after a save so the picked photos are cleared.
  const [formVersion, setFormVersion] = useState(0);

  if (loading) return <LoadingState label="Loading your listing…" />;
  if (!listing) {
    return isNotFound(error) ? (
      <EmptyState title="Listing not found">It may have been deleted, or it belongs to someone else.</EmptyState>
    ) : (
      <Alert tone="error">{errorMessage(error)}</Alert>
    );
  }

  // Reserved or exchanged copies are locked: they are part of an exchange.
  const editable = listing.status === 'AVAILABLE' || listing.status === 'WITHDRAWN';
  const photoSlots = Math.max(0, MAX_PHOTOS_PER_COPY - listing.photos.length);

  async function run(action: () => Promise<void>, success?: string) {
    setBusy(true);
    setMessage(undefined);
    try {
      await action();
      if (success) setMessage({ tone: 'success', text: success });
    } catch (failure) {
      setMessage({ tone: 'error', text: errorMessage(failure) });
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(values: BookFormValues) {
    setServerError(undefined);
    setMessage(undefined);
    setSaving(true);
    try {
      await updateBook(copyId, toBookInput(values));
    } catch (failure) {
      setServerError(errorMessage(failure, 'We could not save your changes. Please try again.'));
      setSaving(false);
      return;
    }
    let failedPhotos = 0;
    for (const photo of values.photos) {
      try {
        await uploadBookPhoto(copyId, photo);
      } catch {
        failedPhotos += 1;
      }
    }
    try {
      setData(await getMyBook(copyId));
    } catch {
      // The save worked; a failed refresh only means stale details until reload.
    }
    setFormVersion((version) => version + 1);
    setSaving(false);
    setMessage(
      failedPhotos > 0
        ? { tone: 'error', text: `Changes saved, but ${pluralize(failedPhotos, 'photo')} could not be uploaded.` }
        : { tone: 'success', text: 'Changes saved.' },
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-3">
        <BackLink to="/my-books" label="Back to my books" />
        <PageHeading
          title="Edit listing"
          subtitle={listing.title}
          action={<Badge tone={statusTone(listing.status)}>{statusLabel(listing.status)}</Badge>}
        />
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        {!editable && (
          <Alert tone="info">This book is part of an exchange, so it cannot be changed right now.</Alert>
        )}
      </div>

      <section aria-labelledby="photos-title" className="rounded-card border border-soft bg-white p-5">
        <h2 id="photos-title" className="font-display text-xl font-semibold text-navy">
          Current photos
        </h2>
        {listing.photos.length === 0 ? (
          <p className="mt-2 text-sm text-slate">No photos yet. Add some below so readers can see the condition.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
            {listing.photos.map((photo, index) => (
              <li key={photo.id} className="relative">
                <img
                  src={assetUrl(photo.url)}
                  alt={`Photo ${index + 1} of ${listing.title}`}
                  className="aspect-square w-full rounded-card border border-soft object-cover"
                />
                {editable && (
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`Remove photo ${index + 1}`}
                    onClick={() =>
                      run(async () => {
                        await deleteBookPhoto(copyId, photo.id);
                        setData((current) =>
                          current ? { ...current, photos: current.photos.filter((p) => p.id !== photo.id) } : current,
                        );
                      }, 'Photo removed.')
                    }
                    className="absolute right-1 top-1 rounded-full bg-white px-2 text-sm font-semibold text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-deep"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {editable && (
        <section aria-labelledby="details-title">
          <h2 id="details-title" className="mb-4 font-display text-xl font-semibold text-navy">
            Details and new photos
          </h2>
          <BookForm
            key={formVersion}
            initial={formValues(listing)}
            areas={areas}
            submitLabel="Save changes"
            submitting={saving}
            serverError={serverError}
            minPhotos={0}
            maxPhotos={photoSlots}
            onSubmit={handleSave}
          />
        </section>
      )}

      {editable && (
        <section aria-labelledby="availability-title" className="rounded-card border border-soft bg-white p-5">
          <h2 id="availability-title" className="font-display text-xl font-semibold text-navy">
            Availability
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {listing.status === 'AVAILABLE' ? (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  run(async () => setData(await withdrawBook(copyId)), 'Withdrawn. Readers can no longer find this book.')
                }
              >
                Withdraw from exchange
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => run(async () => setData(await relistBook(copyId)), 'Listed again. Readers can find it.')}
              >
                Make available again
              </Button>
            )}

            {confirmingDelete ? (
              <div role="group" aria-label="Confirm delete" className="flex flex-wrap items-center gap-3">
                <span className="text-navy">Delete this listing?</span>
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await deleteBook(copyId);
                      navigate('/my-books', { replace: true });
                    })
                  }
                >
                  Yes, delete
                </Button>
                <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="danger" disabled={busy} onClick={() => setConfirmingDelete(true)}>
                Delete listing
              </Button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
