-- Dubai Community Kids Database Schema (PostgreSQL / SQLite compatible)

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    district TEXT NOT NULL,
    contact_preference TEXT NOT NULL DEFAULT 'In-App Message', -- 'WhatsApp', 'In-App Message', 'Email'
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS children (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    nickname TEXT NOT NULL,
    age INTEGER NOT NULL,
    hobbies TEXT NOT NULL, -- JSON array of strings
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS places (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    district TEXT NOT NULL,
    public_spot_type TEXT NOT NULL, -- 'Park', 'Playground', 'Clubhouse', 'Recreation Center', 'Pool', 'Sports Court'
    description TEXT,
    added_by_user_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meetups (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    district TEXT NOT NULL,
    public_location TEXT NOT NULL,
    place_id TEXT,
    date_time TEXT NOT NULL,
    interest_tag TEXT NOT NULL,
    min_age INTEGER NOT NULL DEFAULT 0,
    max_age INTEGER NOT NULL DEFAULT 18,
    host_id TEXT NOT NULL,
    host_name TEXT NOT NULL,
    host_avatar TEXT,
    max_attendees INTEGER DEFAULT 10,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (host_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS rsvps (
    id TEXT PRIMARY KEY,
    meetup_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_avatar TEXT,
    status TEXT NOT NULL DEFAULT 'attending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(meetup_id, user_id),
    FOREIGN KEY (meetup_id) REFERENCES meetups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    meetup_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_avatar TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meetup_id) REFERENCES meetups(id) ON DELETE CASCADE
);
