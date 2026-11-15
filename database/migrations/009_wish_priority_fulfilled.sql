-- 009_wish_priority_fulfilled
-- Lets readers rank their wish list and tick off books they have found.
--
-- priority      HIGH, MEDIUM or LOW. Existing entries become MEDIUM. The list
--               is shown open entries first, then by priority, then newest.
-- fulfilled_at  When the reader marked the entry "Got it"; NULL while they are
--               still looking. Unticking sets it back to NULL. Matching should
--               only use entries where fulfilled_at IS NULL.

ALTER TABLE wish_items
    ADD COLUMN priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
    ADD COLUMN fulfilled_at TIMESTAMPTZ;
-- A reader has at most 100 entries, so idx_wish_items_user (migration 003) is
-- enough for sorting; no extra index is needed.
