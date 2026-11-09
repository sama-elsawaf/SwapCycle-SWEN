import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { createBook, uploadBookPhoto } from '../../api/books';
import BookForm, { toBookInput, type BookFormValues } from '../../components/books/BookForm';
import { useAuth } from '../../hooks/useAuth';
import { useMeetingAreas } from '../../hooks/useMeetingAreas';
import { errorMessage } from '../../utils/errors';
import { BackLink, PageHeading } from '../PageParts';

export default function AddBook() {
  const { user } = useAuth();
  const { areas } = useMeetingAreas();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink to="/my-books" label="Back to my books" />
      <PageHeading title="List a book" subtitle="Describe the copy you are offering and add a few photos." />
      <BookForm
        initial={{ exchangeAreaId: user?.meetingArea?.id ?? null }}
        areas={areas}
        submitLabel="List book"
        submitting={submitting}
        serverError={serverError}
        minPhotos={1}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
