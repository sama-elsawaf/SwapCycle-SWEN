import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { createBook, uploadBookPhoto } from '../../api/books';
import BookForm, { toBookInput, type BookFormValues } from '../../components/books/BookForm';
import Button from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { useDraft } from '../../hooks/useDraft';
import { useMeetingAreas } from '../../hooks/useMeetingAreas';
import { bookDraftHasContent, sanitizeBookDraft, type BookDraft } from '../../utils/drafts';
import { errorMessage } from '../../utils/errors';
import { STORAGE_KEYS } from '../../utils/storage';
import { Alert, BackLink, PageHeading } from '../PageParts';

const draftOptions = { sanitize: sanitizeBookDraft, hasContent: bookDraftHasContent };

/** The form values that can be kept on this device (photos cannot). */
function toDraft({ photos: _photos, ...rest }: BookFormValues): Partial<BookDraft> {
  return rest;
}

export default function AddBook() {
  const { user } = useAuth();
  const { areas } = useMeetingAreas();
  const navigate = useNavigate();
  const draft = useDraft(STORAGE_KEYS.bookDraft, user?.id, draftOptions);
  const [serverError, setServerError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  // Remounts the form with empty fields when the reader discards the draft.
  const [formVersion, setFormVersion] = useState(0);

  async function handleSubmit(values: BookFormValues) {
    setServerError(undefined);
    setSubmitting(true);
    let listingId: string;
    try {
      listingId = (await createBook(toBookInput(values))).id;
    } catch (error) {
      setServerError(errorMessage(error, 'We could not list your book. Please try again.'));
      setSubmitting(false);
      return;
    }
    draft.discard();

    // Photos need the new copy's id. One at a time keeps the order the reader chose.
    let failedPhotos = 0;
    for (const photo of values.photos) {
      try {
        await uploadBookPhoto(listingId, photo);
      } catch {
        failedPhotos += 1;
      }
    }
    navigate(`/books/${listingId}/edit`, { replace: true, state: { created: true, failedPhotos } });
  }

  function discardDraft() {
    draft.discard();
    setFormVersion((version) => version + 1);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink to="/my-books" label="Back to my books" />
      <PageHeading title="List a book" subtitle="Describe the copy you are offering and add a few photos." />
      {draft.restored && (
        <div className="mb-4 space-y-2">
          <Alert tone="info">We kept the details you started earlier. Photos need to be added again.</Alert>
          <Button variant="ghost" onClick={discardDraft}>
            Start again
          </Button>
        </div>
      )}
      <BookForm
        key={formVersion}
        initial={draft.restored ?? { exchangeAreaId: user?.meetingArea?.id ?? null }}
        areas={areas}
        submitLabel="List book"
        submitting={submitting}
        serverError={serverError}
        minPhotos={1}
        onSubmit={handleSubmit}
        onValuesChange={(values) => draft.save(toDraft(values))}
      />
    </div>
  );
}
