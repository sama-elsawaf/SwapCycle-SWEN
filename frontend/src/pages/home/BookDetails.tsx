import { Link, useParams } from 'react-router-dom';

import { assetUrl } from '../../api/client';
import Badge from '../../components/ui/Badge';
import { useAuth } from '../../hooks/useAuth';
import { useBook } from '../../hooks/useBooks';
import { errorMessage, isNotFound } from '../../utils/errors';
import { conditionLabel, formatDate, genreLabel, languageName, statusLabel, statusTone } from '../../utils/format';
import { Alert, BackLink, EmptyState, LoadingState, linkClass } from '../PageParts';

export default function BookDetails() {
  const { copyId } = useParams();
  const { user } = useAuth();
  const { data: book, error, loading } = useBook(copyId);

  if (loading) return <LoadingState label="Loading book…" />;
  if (error !== undefined || !book) {
    return isNotFound(error) ? (
      <EmptyState title="This book is no longer listed">
        It may have been withdrawn or exchanged. <Link to="/search" className={linkClass}>Find another book</Link>
      </EmptyState>
    ) : (
      <Alert tone="error">{errorMessage(error)}</Alert>
    );
  }

  const isOwner = user?.id === book.owner.id;

  return (
    <article className="space-y-6">
      <BackLink label="Back to results" />

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-label="Photos">
          {book.photos.length === 0 ? (
            <div className="flex aspect-[4/3] items-center justify-center rounded-card bg-pink-light text-slate">
              No photos yet
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3">
              {book.photos.map((photo, index) => (
                <li key={photo.id} className={index === 0 ? 'col-span-2' : ''}>
                  <img
                    src={assetUrl(photo.url)}
                    alt={`Photo ${index + 1} of ${book.photos.length} of ${book.title}`}
                    loading="lazy"
                    className="aspect-[4/3] w-full rounded-card border border-soft object-cover"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-5">
          <div>
            <Badge tone={statusTone(book.status)}>{statusLabel(book.status)}</Badge>
            <h1 className="mt-3 font-display text-4xl font-bold text-navy">{book.title}</h1>
            <p className="mt-1 text-lg text-navy">by {book.author}</p>
          </div>

          <dl className="grid grid-cols-2 gap-4 rounded-card bg-pink-light p-5 text-navy">
            <Detail term="Genre" value={genreLabel(book.genre)} />
            <Detail term="Language" value={languageName(book.language)} />
            <Detail term="Edition" value={book.edition || 'Not specified'} />
            <Detail term="Condition" value={conditionLabel(book.condition)} />
            <Detail term="Exchange area" value={book.exchangeArea?.name ?? 'Not specified'} />
            <Detail term="Listed" value={formatDate(book.createdAt)} />
          </dl>

          {book.conditionNotes && (
            <div>
              <h2 className="font-semibold text-navy">Condition notes</h2>
              {/* Rendered as text, never as HTML. */}
              <p className="mt-1 whitespace-pre-line text-navy">{book.conditionNotes}</p>
            </div>
          )}

          <p className="text-navy">
            Offered by{' '}
            {user ? (
              <Link to={`/users/${book.owner.id}`} className={linkClass}>
                {book.owner.displayName}
              </Link>
            ) : (
              <span className="font-semibold">{book.owner.displayName}</span>
            )}
          </p>

          {isOwner ? (
            <Link to={`/books/${book.id}/edit`} className={linkClass}>
              Edit your listing
            </Link>
          ) : (
            <p className="rounded-card border border-soft bg-white p-4 text-sm text-slate">
              {user ? (
                'Exchange offers are coming soon. Add books to your wish list and SwapCycle will match you.'
              ) : (
                <>
                  <Link to="/login" className={linkClass}>
                    Log in
                  </Link>{' '}
                  to swap books with other readers.
                </>
              )}
            </p>
          )}
        </section>
      </div>
    </article>
  );
}

function Detail({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-slate">{term}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
