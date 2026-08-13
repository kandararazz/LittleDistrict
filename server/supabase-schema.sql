-- ==========================================
-- Supabase SQL Schema for LittleDistrict App
-- Execute this script in your Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> Run
-- Wipes all sample data & sets up clean tables ready for real users!
-- ==========================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT DEFAULT '',
    district TEXT DEFAULT '',
    contact_preference TEXT DEFAULT 'In-App Message',
    avatar_url TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure password_hash column exists if table was created previously
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT '';

-- 2. CHILDREN TABLE
CREATE TABLE IF NOT EXISTS public.children (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    age INTEGER NOT NULL,
    hobbies JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PLACES TABLE
CREATE TABLE IF NOT EXISTS public.places (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    district TEXT NOT NULL,
    public_spot_type TEXT NOT NULL,
    description TEXT DEFAULT '',
    added_by_user_id TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MEETUPS TABLE
CREATE TABLE IF NOT EXISTS public.meetups (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    district TEXT NOT NULL,
    public_location TEXT NOT NULL,
    place_id TEXT DEFAULT '',
    date_time TEXT NOT NULL,
    interest_tag TEXT NOT NULL,
    min_age INTEGER NOT NULL DEFAULT 0,
    max_age INTEGER NOT NULL DEFAULT 18,
    host_id TEXT NOT NULL,
    host_name TEXT NOT NULL DEFAULT 'Parent',
    host_avatar TEXT DEFAULT '',
    max_attendees INTEGER DEFAULT 10,
    image_url TEXT DEFAULT '/assets/football.png',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure is_developer column exists on public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_developer BOOLEAN DEFAULT FALSE;

-- ==========================================
-- 5. DEVELOPER BADGE CLAIM RPC PROCEDURE
-- ==========================================
CREATE OR REPLACE FUNCTION public.claim_dev_badge(input_passkey TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_email TEXT;
    current_uid UUID;
BEGIN
    current_uid := auth.uid();
    
    IF current_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Retrieve logged-in user email from auth.users
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = current_uid;

    -- Strict email and passkey validation
    IF LOWER(user_email) = 'your_email@example.com' AND input_passkey = 'your_secret_passkey' THEN
        UPDATE public.users
        SET is_developer = TRUE
        WHERE id = current_uid::text OR email = user_email;

        RETURN TRUE;
    ELSE
        RAISE EXCEPTION 'Invalid email or developer passkey.';
    END IF;
END;
$$;