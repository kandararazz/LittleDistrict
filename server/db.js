// Dual-mode Database Implementation (Supabase Cloud DB + SQLite Local Fallback)

import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file manually if process.env isn't populated
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [key, ...vals] = trimmed.split('=');
            const val = vals.join('=').trim();
            if (!process.env[key.trim()]) {
                process.env[key.trim()] = val;
            }
        }
    });
}

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = (process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

// Check if Supabase credentials are provided and non-placeholder
const isSupabaseConfigured = Boolean(
    SUPABASE_URL && 
    SUPABASE_KEY && 
    !SUPABASE_URL.includes('your-project-id') &&
    SUPABASE_URL.startsWith('http')
);

console.log(isSupabaseConfigured 
    ? `[DB] Connecting to Supabase Cloud Database at ${SUPABASE_URL}`
    : `[DB] Using Local SQLite Database`
);

// --- AUTH UTILS ---
function hashPassword(password) {
    return crypto.createHash('sha256').update(String(password)).digest('hex');
}

function generateToken(userId) {
    const payload = `${userId}:${Date.now()}`;
    return Buffer.from(payload).toString('base64');
}

function parseToken(token) {
    if (!token) return null;
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const [userId] = decoded.split(':');
        return userId || null;
    } catch {
        return null;
    }
}

// --- SUPABASE REST HTTP CLIENT (ZERO EXTERNAL DEPENDENCY) ---
class SupabaseRestClient {
    constructor(url, key) {
        this.baseUrl = url.replace(/\/$/, '') + '/rest/v1';
        this.key = key;
        this.headers = {
            'apikey': this.key,
            'Authorization': `Bearer ${this.key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };
    }

    async fetch(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = { ...this.headers, ...(options.headers || {}) };
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Supabase API error (${response.status}): ${errText}`);
        }
        if (response.status === 204) return null;
        return response.json();
    }

    async select(table, params = {}) {
        let query = `/${table}?select=*`;
        if (params.order) query += `&order=${params.order}`;
        if (params.eq) {
            for (const [k, v] of Object.entries(params.eq)) {
                query += `&${k}=eq.${encodeURIComponent(v)}`;
            }
        }
        if (params.gte) {
            for (const [k, v] of Object.entries(params.gte)) {
                query += `&${k}=gte.${encodeURIComponent(v)}`;
            }
        }
        if (params.lte) {
            for (const [k, v] of Object.entries(params.lte)) {
                query += `&${k}=lte.${encodeURIComponent(v)}`;
            }
        }
        if (params.ilike) {
            for (const [k, v] of Object.entries(params.ilike)) {
                query += `&${k}=ilike.*${encodeURIComponent(v)}*`;
            }
        }
        return this.fetch(query, { method: 'GET' });
    }

    async insert(table, data) {
        return this.fetch(`/${table}`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async upsert(table, data) {
        return this.fetch(`/${table}`, {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
            body: JSON.stringify(data)
        });
    }

    async delete(table, eqParams) {
        let query = `/${table}?`;
        const conditions = Object.entries(eqParams)
            .map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`)
            .join('&');
        query += conditions;
        return this.fetch(query, { method: 'DELETE' });
    }
}

const supabase = isSupabaseConfigured ? new SupabaseRestClient(SUPABASE_URL, SUPABASE_KEY) : null;

// --- SQLITE BACKUP IMPLEMENTATION ---
const DB_PATH = path.join(__dirname, 'database.sqlite');
const sqlite = new DatabaseSync(DB_PATH);
sqlite.exec(`PRAGMA journal_mode = WAL;`);

sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        email TEXT DEFAULT '',
        password_hash TEXT DEFAULT '',
        district TEXT DEFAULT '',
        contact_preference TEXT DEFAULT 'In-App Message',
        avatar_url TEXT DEFAULT '',
        bio TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS children (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        nickname TEXT NOT NULL,
        age INTEGER NOT NULL,
        hobbies TEXT NOT NULL DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS places (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        district TEXT NOT NULL,
        public_spot_type TEXT NOT NULL,
        description TEXT DEFAULT '',
        added_by_user_id TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meetups (
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
        host_name TEXT NOT NULL,
        host_avatar TEXT DEFAULT '',
        max_attendees INTEGER DEFAULT 10,
        image_url TEXT DEFAULT '/assets/football.png',
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rsvps (
        id TEXT PRIMARY KEY,
        meetup_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        user_avatar TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'attending',
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(meetup_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        meetup_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        user_avatar TEXT DEFAULT '',
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    );
`);

// Seed Initial Data with Full User & Community Details if empty
const userCountStmt = sqlite.prepare(`SELECT count(*) as count FROM users`);
if (userCountStmt.get().count === 0) {
    const defaultPasswordHash = hashPassword('password123');
    sqlite.exec(`
        INSERT INTO users (id, name, email, password_hash, district, contact_preference, avatar_url, bio) VALUES
        ('user_1', 'Sarah Jenkins', 'sarah.jenkins@example.com', '${defaultPasswordHash}', 'Dubai Marina', 'WhatsApp', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', 'Mother of two energetic boys (Leo, 6 & Noah, 3). Passionate about outdoor activities, beach playdates, and organizing community sports!'),
        ('user_2', 'Aisha Al Mansoori', 'aisha.m@example.com', '${defaultPasswordHash}', 'Palm Jumeirah', 'In-App Message', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150', 'Mother of Maya (4) & Tariq (7). Love hosting park playdates and creative STEM activities!'),
        ('user_3', 'David Miller', 'david.m@example.com', '${defaultPasswordHash}', 'Dubai Hills', 'Email', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 'Father of Oliver (5). Outdoor enthusiast and kids soccer coach.');

        INSERT INTO children (id, user_id, nickname, age, hobbies) VALUES
        ('child_1', 'user_1', 'Leo', 6, '["Football", "Lego building", "Swimming"]'),
        ('child_2', 'user_1', 'Noah', 3, '["Coloring", "Sandbox", "Cycling"]'),
        ('child_3', 'user_2', 'Maya', 4, '["Painting", "Dancing", "Storytelling"]'),
        ('child_4', 'user_2', 'Tariq', 7, '["Robotics", "Chess", "Basketball"]'),
        ('child_5', 'user_3', 'Oliver', 5, '["Soccer", "Camping", "Dinosaur Toys"]');

        INSERT INTO places (id, name, district, public_spot_type, description, added_by_user_id) VALUES
        ('place_1', 'Marina Promenade Playground', 'Dubai Marina', 'Playground', 'Fenced playground with soft padding, slides, swings, and ocean views. Shade covers provided.', 'user_1'),
        ('place_2', 'Al Ittihad Park Play Zone', 'Palm Jumeirah', 'Park', '3.2km padded walking track surrounded by native trees with dedicated kids play zones.', 'user_2'),
        ('place_3', 'Dubai Hills Park Splash & Play', 'Dubai Hills', 'Recreation Center', 'Spacious green park with splash pad, skate park, outdoor gym, and family picnic lawns.', 'user_3'),
        ('place_4', 'Arabian Ranches Community Park', 'Arabian Ranches', 'Park', 'Quiet community park with swing sets, climbing frames, shaded benches, and open grassy areas.', 'user_1'),
        ('place_5', 'JBR Beachside Play Area', 'JBR', 'Playground', 'Beachfront playground right on the sand with soft climbing towers, toddler swings, and ice cream parlors.', 'user_1');

        INSERT INTO meetups (id, title, district, public_location, place_id, date_time, interest_tag, min_age, max_age, host_id, host_name, host_avatar, max_attendees, image_url) VALUES
        ('meetup_1', 'Weekend Football & Relay Games', 'Dubai Marina', 'Marina Promenade Playground', 'place_1', '2026-08-16T16:00', 'Sports', 4, 8, 'user_1', 'Sarah Jenkins', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', 10, '/assets/football.png'),
        ('meetup_2', 'Toddler Splash & Storytime', 'Palm Jumeirah', 'Al Ittihad Park Play Zone', 'place_2', '2026-08-17T10:00', 'Arts & Crafts', 1, 4, 'user_2', 'Aisha Al Mansoori', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150', 8, '/assets/football.png'),
        ('meetup_3', 'Outdoor Lego & Creative Building', 'Dubai Hills', 'Dubai Hills Park Splash & Play', 'place_3', '2026-08-18T17:30', 'STEM', 5, 10, 'user_3', 'David Miller', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 12, '/assets/football.png');

        INSERT INTO rsvps (id, meetup_id, user_id, user_name, user_avatar, status) VALUES
        ('rsvp_1', 'meetup_1', 'user_1', 'Sarah Jenkins', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', 'attending'),
        ('rsvp_2', 'meetup_1', 'user_2', 'Aisha Al Mansoori', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150', 'attending'),
        ('rsvp_3', 'meetup_1', 'user_3', 'David Miller', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 'attending'),
        ('rsvp_4', 'meetup_2', 'user_2', 'Aisha Al Mansoori', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150', 'attending'),
        ('rsvp_5', 'meetup_2', 'user_1', 'Sarah Jenkins', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', 'attending'),
        ('rsvp_6', 'meetup_3', 'user_3', 'David Miller', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 'attending'),
        ('rsvp_7', 'meetup_3', 'user_1', 'Sarah Jenkins', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', 'attending');

        INSERT INTO comments (id, meetup_id, user_id, user_name, user_avatar, content) VALUES
        ('comment_1', 'meetup_1', 'user_1', 'Sarah Jenkins', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', 'Super excited for this! Will bring extra mini footballs and water bottles for the kids.'),
        ('comment_2', 'meetup_1', 'user_2', 'Aisha Al Mansoori', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150', 'Sounds great! My 7yo Tariq is looking forward to the relay games.'),
        ('comment_3', 'meetup_2', 'user_2', 'Aisha Al Mansoori', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150', 'Remember to bring splash towels and hats for the little ones!'),
        ('comment_4', 'meetup_3', 'user_3', 'David Miller', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 'I will bring 3 storage boxes of Lego bricks! See everyone near the grass lawn.');
    `);
}

// --- DUAL MODE DB ADAPTER API ---
export const db = {
    isSupabase: isSupabaseConfigured,

    // Authentication Methods
    registerUser: async ({ name, email, password, district }) => {
        const cleanEmail = (email || '').trim().toLowerCase();
        if (!cleanEmail || !password) throw new Error('Email and password are required.');

        const existingUser = await db.getUserByEmail(cleanEmail);
        if (existingUser) throw new Error('An account with this email already exists.');

        const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        const passwordHash = hashPassword(password);
        const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name || 'Parent')}`;

        const userObj = {
            id: userId,
            name: name || 'Parent User',
            email: cleanEmail,
            password_hash: passwordHash,
            district: district || 'Dubai Marina',
            contact_preference: 'In-App Message',
            avatar_url: avatarUrl,
            bio: 'Active community parent'
        };

        if (isSupabaseConfigured) {
            try {
                await supabase.insert('users', [userObj]);
                const token = generateToken(userId);
                return { token, user: { ...userObj, children: [] } };
            } catch (err) {
                console.error('[Supabase Error] registerUser fallback to SQLite:', err.message);
            }
        }

        sqlite.prepare(`
            INSERT INTO users (id, name, email, password_hash, district, contact_preference, avatar_url, bio)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(userId, userObj.name, userObj.email, userObj.password_hash, userObj.district, userObj.contact_preference, userObj.avatar_url, userObj.bio);

        const token = generateToken(userId);
        return { token, user: { ...userObj, children: [] } };
    },

    loginUser: async ({ email, password }) => {
        const cleanEmail = (email || '').trim().toLowerCase();
        const user = await db.getUserByEmail(cleanEmail);
        if (!user) throw new Error('Invalid email or password.');

        const expectedHash = hashPassword(password);
        if (user.password_hash && user.password_hash !== expectedHash) {
            throw new Error('Invalid email or password.');
        }

        const token = generateToken(user.id);
        const fullUser = await db.getUserById(user.id);
        return { token, user: fullUser };
    },

    getUserByEmail: async (email) => {
        const cleanEmail = (email || '').trim().toLowerCase();
        if (isSupabaseConfigured) {
            try {
                const users = await supabase.select('users', { eq: { email: cleanEmail } });
                if (users && users[0]) return users[0];
            } catch (err) {
                console.error('[Supabase Error] getUserByEmail fallback to SQLite:', err.message);
            }
        }
        return sqlite.prepare(`SELECT * FROM users WHERE LOWER(email) = LOWER(?)`).get(cleanEmail) || null;
    },

    getUserByToken: async (token) => {
        if (!token) return null;
        const userId = parseToken(token);
        if (!userId) return null;
        return await db.getUserById(userId);
    },

    // Users & Profile
    getUsers: async () => {
        if (isSupabaseConfigured) {
            try {
                return await supabase.select('users');
            } catch (err) {
                console.error('[Supabase Error] getUsers fallback to SQLite:', err.message);
            }
        }
        return sqlite.prepare(`SELECT * FROM users`).all();
    },

    getUserById: async (id) => {
        if (isSupabaseConfigured) {
            try {
                const users = await supabase.select('users', { eq: { id } });
                const user = users && users[0] ? users[0] : null;
                if (!user) return null;

                const childrenRows = await supabase.select('children', { eq: { user_id: id } });
                const children = (childrenRows || []).map(c => ({
                    ...c,
                    hobbies: typeof c.hobbies === 'string' ? JSON.parse(c.hobbies || '[]') : (c.hobbies || [])
                }));

                return { ...user, children };
            } catch (err) {
                console.error('[Supabase Error] getUserById fallback to SQLite:', err.message);
            }
        }

        const user = sqlite.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
        if (!user) return null;
        const childrenRows = sqlite.prepare(`SELECT * FROM children WHERE user_id = ?`).all(id);
        const children = childrenRows.map(c => ({
            ...c,
            hobbies: JSON.parse(c.hobbies || '[]')
        }));
        return { ...user, children };
    },

    updateProfile: async (updatedData) => {
        const userId = updatedData.id || 'user_1';

        if (isSupabaseConfigured) {
            try {
                const userObj = {
                    id: userId,
                    name: updatedData.name ?? '',
                    email: updatedData.email ?? '',
                    district: updatedData.district ?? '',
                    contact_preference: updatedData.contact_preference ?? 'In-App Message',
                    avatar_url: updatedData.avatar_url ?? '',
                    bio: updatedData.bio ?? ''
                };
                await supabase.upsert('users', [userObj]);

                if (Array.isArray(updatedData.children)) {
                    await supabase.delete('children', { user_id: userId });
                    const childrenRows = updatedData.children.map(c => ({
                        id: c.id || 'child_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                        user_id: userId,
                        nickname: c.nickname,
                        age: c.age,
                        hobbies: Array.isArray(c.hobbies) ? c.hobbies : []
                    }));
                    if (childrenRows.length > 0) {
                        await supabase.insert('children', childrenRows);
                    }
                }
                return await db.getUserById(userId);
            } catch (err) {
                console.error('[Supabase Error] updateProfile fallback to SQLite:', err.message);
            }
        }

        sqlite.prepare(`
            INSERT INTO users (id, name, email, district, contact_preference, avatar_url, bio)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = COALESCE(excluded.name, users.name),
                email = COALESCE(excluded.email, users.email),
                district = COALESCE(excluded.district, users.district),
                contact_preference = COALESCE(excluded.contact_preference, users.contact_preference),
                avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
                bio = COALESCE(excluded.bio, users.bio)
        `).run(
            userId,
            updatedData.name ?? '',
            updatedData.email ?? '',
            updatedData.district ?? '',
            updatedData.contact_preference ?? 'In-App Message',
            updatedData.avatar_url ?? '',
            updatedData.bio ?? ''
        );

        if (Array.isArray(updatedData.children)) {
            sqlite.prepare(`DELETE FROM children WHERE user_id = ?`).run(userId);
            const insertChildStmt = sqlite.prepare(`
                INSERT INTO children (id, user_id, nickname, age, hobbies)
                VALUES (?, ?, ?, ?, ?)
            `);
            updatedData.children.forEach(c => {
                const childId = c.id || 'child_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
                insertChildStmt.run(
                    childId,
                    userId,
                    c.nickname,
                    c.age,
                    JSON.stringify(c.hobbies || [])
                );
            });
        }

        return db.getUserById(userId);
    },

    // Places
    getPlaces: async () => {
        if (isSupabaseConfigured) {
            try {
                return await supabase.select('places', { order: 'created_at.desc' });
            } catch (err) {
                console.error('[Supabase Error] getPlaces fallback to SQLite:', err.message);
            }
        }
        return sqlite.prepare(`SELECT * FROM places ORDER BY created_at DESC`).all();
    },

    addPlace: async (place, userObj = {}) => {
        const id = 'place_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        const placeObj = {
            id,
            name: place.name,
            district: place.district,
            public_spot_type: place.public_spot_type,
            description: place.description || '',
            added_by_user_id: userObj.id || place.added_by_user_id || 'user_1'
        };

        if (isSupabaseConfigured) {
            try {
                const res = await supabase.insert('places', [placeObj]);
                return res && res[0] ? res[0] : placeObj;
            } catch (err) {
                console.error('[Supabase Error] addPlace fallback to SQLite:', err.message);
            }
        }

        sqlite.prepare(`
            INSERT INTO places (id, name, district, public_spot_type, description, added_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            id,
            place.name,
            place.district,
            place.public_spot_type,
            place.description || '',
            placeObj.added_by_user_id
        );

        return sqlite.prepare(`SELECT * FROM places WHERE id = ?`).get(id);
    },

    // Meetups
    getMeetups: async ({ district, interest, minAge, maxAge, search } = {}) => {
        if (isSupabaseConfigured) {
            try {
                let meetups = await supabase.select('meetups', { order: 'created_at.desc' });
                if (!Array.isArray(meetups)) meetups = [];

                if (district && district !== 'All') {
                    meetups = meetups.filter(m => m.district.toLowerCase() === district.toLowerCase());
                }
                if (interest && interest !== 'All') {
                    meetups = meetups.filter(m => m.interest_tag.toLowerCase() === interest.toLowerCase());
                }
                if (minAge !== undefined && !isNaN(minAge)) {
                    meetups = meetups.filter(m => m.max_age >= minAge);
                }
                if (maxAge !== undefined && !isNaN(maxAge)) {
                    meetups = meetups.filter(m => m.min_age <= maxAge);
                }
                if (search && search.trim()) {
                    const q = search.trim().toLowerCase();
                    meetups = meetups.filter(m => 
                        (m.title && m.title.toLowerCase().includes(q)) ||
                        (m.public_location && m.public_location.toLowerCase().includes(q)) ||
                        (m.district && m.district.toLowerCase().includes(q)) ||
                        (m.interest_tag && m.interest_tag.toLowerCase().includes(q))
                    );
                }

                // Attach attendees & comments
                const allRsvps = await supabase.select('rsvps', { eq: { status: 'attending' } });
                const allComments = await supabase.select('comments', { order: 'created_at.asc' });

                return meetups.map(m => {
                    const meetupRsvps = (allRsvps || []).filter(r => r.meetup_id === m.id);
                    const meetupComments = (allComments || []).filter(c => c.meetup_id === m.id);
                    return {
                        ...m,
                        attendees_count: meetupRsvps.length,
                        attendees: meetupRsvps.map(r => r.user_id),
                        comments: meetupComments
                    };
                });
            } catch (err) {
                console.error('[Supabase Error] getMeetups fallback to SQLite:', err.message);
            }
        }

        let sql = `SELECT * FROM meetups WHERE 1=1`;
        const params = [];

        if (district && district !== 'All') {
            sql += ` AND LOWER(district) = LOWER(?)`;
            params.push(district);
        }

        if (interest && interest !== 'All') {
            sql += ` AND LOWER(interest_tag) = LOWER(?)`;
            params.push(interest);
        }

        if (minAge !== undefined && !isNaN(minAge)) {
            sql += ` AND max_age >= ?`;
            params.push(minAge);
        }

        if (maxAge !== undefined && !isNaN(maxAge)) {
            sql += ` AND min_age <= ?`;
            params.push(maxAge);
        }

        if (search && search.trim()) {
            sql += ` AND (LOWER(title) LIKE ? OR LOWER(public_location) LIKE ? OR LOWER(district) LIKE ? OR LOWER(interest_tag) LIKE ?)`;
            const q = `%${search.trim().toLowerCase()}%`;
            params.push(q, q, q, q);
        }

        sql += ` ORDER BY created_at DESC`;

        const meetups = sqlite.prepare(sql).all(...params);

        return meetups.map(m => {
            const rsvps = sqlite.prepare(`SELECT user_id FROM rsvps WHERE meetup_id = ? AND status = 'attending'`).all(m.id);
            const attendees = rsvps.map(r => r.user_id);
            const comments = sqlite.prepare(`SELECT * FROM comments WHERE meetup_id = ? ORDER BY created_at ASC`).all(m.id);

            return {
                ...m,
                attendees_count: attendees.length,
                attendees,
                comments
            };
        });
    },

    getMeetupById: async (id) => {
        if (isSupabaseConfigured) {
            try {
                const meetups = await supabase.select('meetups', { eq: { id } });
                const m = meetups && meetups[0] ? meetups[0] : null;
                if (!m) return null;

                const rsvps = await supabase.select('rsvps', { eq: { meetup_id: id, status: 'attending' } });
                const comments = await supabase.select('comments', { eq: { meetup_id: id }, order: 'created_at.asc' });

                return {
                    ...m,
                    attendees_count: (rsvps || []).length,
                    attendees: (rsvps || []).map(r => r.user_id),
                    comments: comments || []
                };
            } catch (err) {
                console.error('[Supabase Error] getMeetupById fallback to SQLite:', err.message);
            }
        }

        const m = sqlite.prepare(`SELECT * FROM meetups WHERE id = ?`).get(id);
        if (!m) return null;

        const rsvps = sqlite.prepare(`SELECT user_id FROM rsvps WHERE meetup_id = ? AND status = 'attending'`).all(m.id);
        const attendees = rsvps.map(r => r.user_id);
        const comments = sqlite.prepare(`SELECT * FROM comments WHERE meetup_id = ? ORDER BY created_at ASC`).all(m.id);

        return {
            ...m,
            attendees_count: attendees.length,
            attendees,
            comments
        };
    },

    addMeetup: async (meetup, userObj = {}) => {
        const id = 'meetup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        const hostId = userObj.id || meetup.host_id || 'user_1';
        const hostName = userObj.name || meetup.host_name || 'Parent';
        const hostAvatar = userObj.avatar_url || meetup.host_avatar || '';

        const meetupObj = {
            id,
            title: meetup.title,
            district: meetup.district,
            public_location: meetup.public_location,
            place_id: meetup.place_id || '',
            date_time: meetup.date_time,
            interest_tag: meetup.interest_tag,
            min_age: meetup.min_age || 0,
            max_age: meetup.max_age || 18,
            host_id: hostId,
            host_name: hostName,
            host_avatar: hostAvatar,
            max_attendees: meetup.max_attendees || 10,
            image_url: meetup.image_url || '/assets/football.png'
        };

        if (isSupabaseConfigured) {
            try {
                await supabase.insert('meetups', [meetupObj]);
                await supabase.insert('rsvps', [{
                    id: 'rsvp_' + Date.now(),
                    meetup_id: id,
                    user_id: hostId,
                    user_name: hostName,
                    user_avatar: hostAvatar,
                    status: 'attending'
                }]);
                return await db.getMeetupById(id);
            } catch (err) {
                console.error('[Supabase Error] addMeetup fallback to SQLite:', err.message);
            }
        }

        sqlite.prepare(`
            INSERT INTO meetups (id, title, district, public_location, place_id, date_time, interest_tag, min_age, max_age, host_id, host_name, host_avatar, max_attendees, image_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            meetup.title,
            meetup.district,
            meetup.public_location,
            meetup.place_id || '',
            meetup.date_time,
            meetup.interest_tag,
            meetup.min_age || 0,
            meetup.max_age || 18,
            hostId,
            hostName,
            hostAvatar,
            meetup.max_attendees || 10,
            meetup.image_url || '/assets/football.png'
        );

        sqlite.prepare(`
            INSERT INTO rsvps (id, meetup_id, user_id, user_name, user_avatar, status)
            VALUES (?, ?, ?, ?, ?, 'attending')
        `).run(
            'rsvp_' + Date.now(),
            id,
            hostId,
            hostName,
            hostAvatar,
        );

        return db.getMeetupById(id);
    },

    toggleRsvp: async (meetupId, userId, userName, userAvatar) => {
        const meetup = await db.getMeetupById(meetupId);
        if (!meetup) return null;

        if (isSupabaseConfigured) {
            try {
                const existing = await supabase.select('rsvps', { eq: { meetup_id: meetupId, user_id: userId } });
                let userStatus = 'attending';
                if (existing && existing.length > 0) {
                    await supabase.delete('rsvps', { meetup_id: meetupId, user_id: userId });
                    userStatus = 'cancelled';
                } else {
                    await supabase.insert('rsvps', [{
                        id: 'rsvp_' + Date.now(),
                        meetup_id: meetupId,
                        user_id: userId,
                        user_name: userName || 'Parent',
                        user_avatar: userAvatar || '',
                        status: 'attending'
                    }]);
                }
                const updatedMeetup = await db.getMeetupById(meetupId);
                return { meetup: updatedMeetup, userStatus };
            } catch (err) {
                console.error('[Supabase Error] toggleRsvp fallback to SQLite:', err.message);
            }
        }

        const existingRsvp = sqlite.prepare(`SELECT * FROM rsvps WHERE meetup_id = ? AND user_id = ?`).get(meetupId, userId);
        let userStatus = 'attending';

        if (existingRsvp) {
            sqlite.prepare(`DELETE FROM rsvps WHERE meetup_id = ? AND user_id = ?`).run(meetupId, userId);
            userStatus = 'cancelled';
        } else {
            sqlite.prepare(`
                INSERT INTO rsvps (id, meetup_id, user_id, user_name, user_avatar, status)
                VALUES (?, ?, ?, ?, ?, 'attending')
            `).run(
                'rsvp_' + Date.now(),
                meetupId,
                userId,
                userName || 'Parent',
                userAvatar || ''
            );
        }

        const updatedMeetup = await db.getMeetupById(meetupId);
        return { meetup: updatedMeetup, userStatus };
    },

    addComment: async (meetupId, userId, userName, userAvatar, content) => {
        const id = 'comment_' + Date.now();
        const commentObj = {
            id,
            meetup_id: meetupId,
            user_id: userId,
            user_name: userName || 'Parent',
            user_avatar: userAvatar || '',
            content
        };

        if (isSupabaseConfigured) {
            try {
                const res = await supabase.insert('comments', [commentObj]);
                return res && res[0] ? res[0] : commentObj;
            } catch (err) {
                console.error('[Supabase Error] addComment fallback to SQLite:', err.message);
            }
        }

        sqlite.prepare(`
            INSERT INTO comments (id, meetup_id, user_id, user_name, user_avatar, content)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            id,
            meetupId,
            userId,
            userName || 'Parent',
            userAvatar || '',
            content
        );

        return sqlite.prepare(`SELECT * FROM comments WHERE id = ?`).get(id);
    },

    getRsvpsForUser: async (userId) => {
        if (isSupabaseConfigured) {
            try {
                const allMeetups = await db.getMeetups();
                return allMeetups.filter(m => m.host_id === userId || (m.attendees && m.attendees.includes(userId)));
            } catch (err) {
                console.error('[Supabase Error] getRsvpsForUser fallback to SQLite:', err.message);
            }
        }

        const rows = sqlite.prepare(`
            SELECT DISTINCT m.* FROM meetups m
            LEFT JOIN rsvps r ON m.id = r.meetup_id
            WHERE r.user_id = ? OR m.host_id = ?
            ORDER BY m.created_at DESC
        `).all(userId, userId);

        return rows.map(m => db.getMeetupById(m.id));
    }
};
