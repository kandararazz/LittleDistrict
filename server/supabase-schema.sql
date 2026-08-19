-- ==========================================
-- Supabase SQL Schema for LittleDistrict App
-- Execute this script in your Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> Run
-- Wipes sample data & creates clean tables ready for multi-device sync!
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
    is_developer BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PLACES TABLE
CREATE TABLE IF NOT EXISTS public.places (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    district TEXT NOT NULL,
    public_spot_type TEXT NOT NULL,
    description TEXT DEFAULT '',
    added_by_user_id TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. MEETUPS / FEED TABLE
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
    image_url TEXT DEFAULT '/assets/logo-full.png',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RSVPS TABLE
CREATE TABLE IF NOT EXISTS public.rsvps (
    id TEXT PRIMARY KEY,
    meetup_id TEXT NOT NULL REFERENCES public.meetups(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL DEFAULT 'Parent',
    user_avatar TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'attending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(meetup_id, user_id)
);

-- 5. COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.comments (
    id TEXT PRIMARY KEY,
    meetup_id TEXT NOT NULL REFERENCES public.meetups(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL DEFAULT 'Parent',
    user_avatar TEXT DEFAULT '',
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TOYS / EXCHANGE TABLE
CREATE TABLE IF NOT EXISTS public.toys (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'Exchange',
    school_name TEXT DEFAULT '',
    grade_level TEXT DEFAULT '',
    district TEXT NOT NULL,
    condition TEXT DEFAULT 'Gently Used',
    swap_type TEXT DEFAULT 'Free Donation',
    user_id TEXT DEFAULT '',
    user_name TEXT DEFAULT 'Parent',
    user_contact TEXT DEFAULT '',
    user_phone TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    status TEXT DEFAULT 'available',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. LOST & FOUND TABLE
CREATE TABLE IF NOT EXISTS public.lost_found (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'Item',
    status TEXT DEFAULT 'Lost',
    district TEXT NOT NULL,
    location_detail TEXT DEFAULT '',
    reported_by TEXT DEFAULT 'Parent Resident',
    image_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);