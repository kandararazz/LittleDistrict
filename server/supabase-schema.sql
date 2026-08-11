-- ==========================================
-- Supabase SQL Schema for LittleDistrict App
-- Execute this script in your Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> Run
-- ==========================================

-- 1. USERS TABLE (with password_hash for multi-device auth)
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
    added_by_user_id TEXT DEFAULT 'user_1',
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
    host_id TEXT NOT NULL DEFAULT 'user_1',
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

-- ==========================================
-- SEED INITIAL DATA WITH PASSWORDS (default password: password123)
-- SHA256 of "password123": ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f
-- ==========================================

INSERT INTO public.users (id, name, email, password_hash, district, contact_preference, avatar_url, bio)
VALUES 
('user_1', 'Sarah Jenkins', 'sarah.jenkins@example.com', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'Dubai Marina', 'WhatsApp', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', 'Mother of two energetic boys (Leo, 6 & Noah, 3). Passionate about outdoor activities, beach playdates, and organizing community sports!'),
('user_2', 'Aisha Al Mansoori', 'aisha.m@example.com', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'Palm Jumeirah', 'In-App Message', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150', 'Mother of Maya (4) & Tariq (7). Love hosting park playdates and creative STEM activities!'),
('user_3', 'David Miller', 'david.m@example.com', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'Dubai Hills', 'Email', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 'Father of Oliver (5). Outdoor enthusiast and kids soccer coach.')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  district = EXCLUDED.district,
  contact_preference = EXCLUDED.contact_preference,
  avatar_url = EXCLUDED.avatar_url,
  bio = EXCLUDED.bio;

INSERT INTO public.children (id, user_id, nickname, age, hobbies)
VALUES 
('child_1', 'user_1', 'Leo', 6, '["Football", "Lego building", "Swimming"]'::jsonb),
('child_2', 'user_1', 'Noah', 3, '["Coloring", "Sandbox", "Cycling"]'::jsonb),
('child_3', 'user_2', 'Maya', 4, '["Painting", "Dancing", "Storytelling"]'::jsonb),
('child_4', 'user_2', 'Tariq', 7, '["Robotics", "Chess", "Basketball"]'::jsonb),
('child_5', 'user_3', 'Oliver', 5, '["Soccer", "Camping", "Dinosaur Toys"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.places (id, name, district, public_spot_type, description, added_by_user_id)
VALUES 
('place_1', 'Marina Promenade Playground', 'Dubai Marina', 'Playground', 'Fenced playground with soft padding, slides, swings, and ocean views. Shade covers provided.', 'user_1'),
('place_2', 'Al Ittihad Park Play Zone', 'Palm Jumeirah', 'Park', '3.2km padded walking track surrounded by native trees with dedicated kids play zones.', 'user_2'),
('place_3', 'Dubai Hills Park Splash & Play', 'Dubai Hills', 'Recreation Center', 'Spacious green park with splash pad, skate park, outdoor gym, and family picnic lawns.', 'user_3'),
('place_4', 'Arabian Ranches Community Park', 'Arabian Ranches', 'Park', 'Quiet community park with swing sets, climbing frames, shaded benches, and open grassy areas.', 'user_1'),
('place_5', 'JBR Beachside Play Area', 'JBR', 'Playground', 'Beachfront playground right on the sand with soft climbing towers, toddler swings, and ice cream parlors.', 'user_1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.meetups (id, title, district, public_location, place_id, date_time, interest_tag, min_age, max_age, host_id, host_name, host_avatar, max_attendees, image_url)
VALUES
('meetup_1', 'Weekend Football & Relay Games', 'Dubai Marina', 'Marina Promenade Playground', 'place_1', '2026-08-16T16:00', 'Sports', 4, 8, 'user_1', 'Sarah Jenkins', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', 10, '/assets/football.png'),
('meetup_2', 'Toddler Splash & Storytime', 'Palm Jumeirah', 'Al Ittihad Park Play Zone', 'place_2', '2026-08-17T10:00', 'Arts & Crafts', 1, 4, 'user_2', 'Aisha Al Mansoori', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150', 8, '/assets/football.png'),
('meetup_3', 'Outdoor Lego & Creative Building', 'Dubai Hills', 'Dubai Hills Park Splash & Play', 'place_3', '2026-08-18T17:30', 'STEM', 5, 10, 'user_3', 'David Miller', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 12, '/assets/football.png')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.rsvps (id, meetup_id, user_id, user_name, user_avatar, status)
VALUES
('rsvp_1', 'meetup_1', 'user_1', 'Sarah Jenkins', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', 'attending'),
('rsvp_2', 'meetup_1', 'user_2', 'Aisha Al Mansoori', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150', 'attending'),
('rsvp_3', 'meetup_1', 'user_3', 'David Miller', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 'attending'),
('rsvp_4', 'meetup_2', 'user_2', 'Aisha Al Mansoori', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150', 'attending'),
('rsvp_5', 'meetup_2', 'user_1', 'Sarah Jenkins', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', 'attending'),
('rsvp_6', 'meetup_3', 'user_3', 'David Miller', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 'attending'),
('rsvp_7', 'meetup_3', 'user_1', 'Sarah Jenkins', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', 'attending')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.comments (id, meetup_id, user_id, user_name, user_avatar, content)
VALUES
('comment_1', 'meetup_1', 'user_1', 'Sarah Jenkins', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', 'Super excited for this! Will bring extra mini footballs and water bottles for the kids.'),
('comment_2', 'meetup_1', 'user_2', 'Aisha Al Mansoori', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150', 'Sounds great! My 7yo Tariq is looking forward to the relay games.'),
('comment_3', 'meetup_2', 'user_2', 'Aisha Al Mansoori', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150', 'Remember to bring splash towels and hats for the little ones!'),
('comment_4', 'meetup_3', 'user_3', 'David Miller', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 'I will bring 3 storage boxes of Lego bricks! See everyone near the grass lawn.')
ON CONFLICT (id) DO NOTHING;
