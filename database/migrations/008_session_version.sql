-- 008_session_version
-- Makes session tokens revocable. Every session token carries the user's
-- session_version; AuthFilter rejects a token whose version no longer matches.
-- Raising the version therefore ends every session the user has open.
--
-- The application raises it on logout and on a password reset. The trigger
-- below also raises it whenever a user's role changes, including changes made
-- directly in SQL, so a demoted moderator cannot keep using an old token.

ALTER TABLE users ADD COLUMN session_version INT NOT NULL DEFAULT 1 CHECK (session_version >= 1);

CREATE FUNCTION users_bump_session_version_on_role_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        NEW.session_version := OLD.session_version + 1;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER users_role_change_ends_sessions
    BEFORE UPDATE OF role ON users
    FOR EACH ROW
    EXECUTE FUNCTION users_bump_session_version_on_role_change();
