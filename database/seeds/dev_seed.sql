-- Development seed data. NEVER run this against a real deployment: every
-- account below shares the published password "password123".
--
--   docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < database/seeds/dev_seed.sql
--
-- Safe to run more than once (fixed ids, ON CONFLICT DO NOTHING).
--
-- The data reproduces the README example so matching can be tried by hand:
--   * three-way cycle: Sara offers a mystery and wants Ali's travel book,
--     Ali wants Noor's biography, Noor wants Sara's mystery;
--   * direct swap: Ali also wants Sara's copy of Dune.
-- Plus one moderator account for the dispute and moderation screens.
--
-- Meeting areas are created by migration 001.

BEGIN;

-- argon2id hash of "password123" (libsodium crypto_pwhash_str, interactive limits).
INSERT INTO users (id, email, password_hash, display_name, meeting_area_id, role, onboarding_completed) VALUES
    ('00000000-0000-4000-8000-00000000a001', 'sara@example.com',
     '$argon2id$v=19$m=65536,t=2,p=1$3mXq4VxlClIYjICJi013Vw$q8Qbw2admAxCvTpkWzFnbgZ9O6V+2UB+6DavAAgRbVc',
     'Sara', 1, 'READER', TRUE),
    ('00000000-0000-4000-8000-00000000a002', 'ali@example.com',
     '$argon2id$v=19$m=65536,t=2,p=1$3mXq4VxlClIYjICJi013Vw$q8Qbw2admAxCvTpkWzFnbgZ9O6V+2UB+6DavAAgRbVc',
     'Ali', 2, 'READER', TRUE),
    ('00000000-0000-4000-8000-00000000a003', 'noor@example.com',
     '$argon2id$v=19$m=65536,t=2,p=1$3mXq4VxlClIYjICJi013Vw$q8Qbw2admAxCvTpkWzFnbgZ9O6V+2UB+6DavAAgRbVc',
     'Noor', 1, 'READER', TRUE),
    ('00000000-0000-4000-8000-00000000a004', 'moderator@example.com',
     '$argon2id$v=19$m=65536,t=2,p=1$3mXq4VxlClIYjICJi013Vw$q8Qbw2admAxCvTpkWzFnbgZ9O6V+2UB+6DavAAgRbVc',
     'Mona (moderator)', 3, 'MODERATOR', TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO user_interests (user_id, category) VALUES
    ('00000000-0000-4000-8000-00000000a001', 'FICTION'),
    ('00000000-0000-4000-8000-00000000a002', 'NON_FICTION'),
    ('00000000-0000-4000-8000-00000000a003', 'FICTION'),
    ('00000000-0000-4000-8000-00000000a003', 'SCIENCE')
ON CONFLICT DO NOTHING;

INSERT INTO book_descriptions (id, title, author, edition, language, genre) VALUES
    ('00000000-0000-4000-8000-00000000b001', 'The Hound of the Baskervilles', 'Arthur Conan Doyle', '', 'en', 'MYSTERY'),
    ('00000000-0000-4000-8000-00000000b002', 'In Patagonia', 'Bruce Chatwin', '', 'en', 'TRAVEL'),
    ('00000000-0000-4000-8000-00000000b003', 'Long Walk to Freedom', 'Nelson Mandela', '', 'en', 'BIOGRAPHY'),
    ('00000000-0000-4000-8000-00000000b004', 'Dune', 'Frank Herbert', '', 'en', 'SCIENCE_FICTION'),
    ('00000000-0000-4000-8000-00000000b005', 'A Brief History of Time', 'Stephen Hawking', '10th anniversary', 'en', 'SCIENCE')
ON CONFLICT DO NOTHING;

INSERT INTO book_copies (id, description_id, owner_id, condition, condition_notes, exchange_area_id) VALUES
    ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000b001',
     '00000000-0000-4000-8000-00000000a001', 'GOOD', 'Spine creased, no notes inside.', 1),
    ('00000000-0000-4000-8000-00000000c002', '00000000-0000-4000-8000-00000000b002',
     '00000000-0000-4000-8000-00000000a002', 'LIKE_NEW', '', 2),
    ('00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-00000000b003',
     '00000000-0000-4000-8000-00000000a003', 'FAIR', 'Cover slightly torn at the corner.', 1),
    ('00000000-0000-4000-8000-00000000c004', '00000000-0000-4000-8000-00000000b004',
     '00000000-0000-4000-8000-00000000a001', 'GOOD', '', 1),
    ('00000000-0000-4000-8000-00000000c005', '00000000-0000-4000-8000-00000000b005',
     '00000000-0000-4000-8000-00000000a003', 'NEW', 'Unread gift.', 3)
ON CONFLICT DO NOTHING;

INSERT INTO wish_items (id, user_id, kind, title, author, genre, language, min_condition) VALUES
    -- Sara wants Ali's travel book.
    ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000a001',
     'TITLE', 'In Patagonia', 'Bruce Chatwin', NULL, 'en', 'GOOD'),
    -- Ali wants Noor's biography, and Sara's Dune (direct swap with Sara).
    ('00000000-0000-4000-8000-00000000d002', '00000000-0000-4000-8000-00000000a002',
     'INTEREST', NULL, NULL, 'BIOGRAPHY', NULL, 'FAIR'),
    ('00000000-0000-4000-8000-00000000d003', '00000000-0000-4000-8000-00000000a002',
     'TITLE', 'Dune', NULL, NULL, NULL, NULL),
    -- Noor wants Sara's mystery.
    ('00000000-0000-4000-8000-00000000d004', '00000000-0000-4000-8000-00000000a003',
     'TITLE', 'The Hound of the Baskervilles', 'Arthur Conan Doyle', NULL, 'en', NULL)
ON CONFLICT DO NOTHING;

COMMIT;
