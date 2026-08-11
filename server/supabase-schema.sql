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

-- 5. RSVPS TABLE
CREATE TABLE IF NOT EXISTS public.rsvps (
    id TEXT PRIMARY KEY,
    meetup_id TEXT NOT NULL REFERENCES public.meetups(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_avatar TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'attending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_meetup_user UNIQUE (meetup_id, user_id)
);

-- 6. COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.comments (
    id TEXT PRIMARY KEY,
    meetup_id TEXT NOT NULL REFERENCES public.meetups(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_avatar TEXT DEFAULT '',
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) and allow public read/write
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public full access on users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access on children" ON public.children FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access on places" ON public.places FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access on meetups" ON public.meetups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access on rsvps" ON public.rsvps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access on comments" ON public.comments FOR ALL USING (true) WITH CHECK (true);

-- WIPE ALL MOCK SAMPLE DATA (CLEAN SLATE)
TRUNCATE TABLE public.comments, public.rsvps, public.meetups, public.places, public.children, public.users CASCADE;
