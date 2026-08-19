// Dual-mode Database Implementation (Supabase Cloud DB + In-Memory & SQLite Fallback for Vercel)

import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);

let DatabaseSync = null;
try {
    const sqliteModule = require('node:sqlite');
    DatabaseSync = sqliteModule.DatabaseSync;
} catch (e) {
    console.warn('[DB] Native node:sqlite not supported in this environment, using in-memory store.');
}

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

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const SUPABASE_KEY = (process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

// Check if Supabase credentials are provided and non-placeholder
let isSupabaseConfigured = Boolean(
    SUPABASE_URL && 
    SUPABASE_KEY && 
    !SUPABASE_URL.includes('your-project-id') &&
    SUPABASE_URL.startsWith('http')
);

console.log(isSupabaseConfigured 
    ? `[DB] Connecting to Supabase Cloud Database at ${SUPABASE_URL}`
    : `[DB] Using ${DatabaseSync ? 'Local SQLite' : 'In-Memory'} Database Store`
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

// --- SUPABASE REST HTTP CLIENT ---
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
        if (!isSupabaseConfigured) {
            throw new Error('Supabase not configured');
        }
        const url = `${this.baseUrl}${endpoint}`;
        const headers = { ...this.headers, ...(options.headers || {}) };
        try {
            const response = await fetch(url, { ...options, headers });
            if (!response.ok) {
                const errText = await response.text();
                if (response.status === 401) {
                    console.warn('[DB] Supabase API key is invalid or belongs to another project. Operating in Local Database Mode.');
                    isSupabaseConfigured = false;
                }
                throw new Error(`Supabase API error (${response.status}): ${errText}`);
            }
            if (response.status === 204) return null;
            return response.json();
        } catch (err) {
            if (err.message.includes('401')) {
                isSupabaseConfigured = false;
            }
            throw err;
        }
    }

    async select(table, params = {}) {
        let query = `/${table}?select=*`;
        if (params.order) query += `&order=${params.order}`;
        if (params.eq) {
            for (const [k, v] of Object.entries(params.eq)) {
                query += `&${k}=eq.${encodeURIComponent(v)}`;
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

// --- IN-MEMORY DATA STORE FOR VERCEL & SERVERLESS FALLBACK ---
const memoryStore = {
    users: [
        {
            id: 'user_1',
            name: 'Sarah Jenkins',
            email: 'sarah@example.com',
            password_hash: hashPassword('password123'),
            district: 'Dubai Hills',
            phone: '+971 50 123 4567',
            contact_preference: 'WhatsApp',
            avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Sarah',
            bio: 'Dubai Hills resident & mom of 2 active kids.',
            children: [
                { id: 'c1', nickname: 'Leo', age: 6, hobbies: ['Cycling', 'Roblox'] },
                { id: 'c2', nickname: 'Maya', age: 3, hobbies: ['Splash Park'] }
            ]
        }
    ],
    meetups: [
        {
            id: 'm_1',
            title: 'Dubai Hills Weekend Park Cycling',
            district: 'Dubai Hills',
            public_location: 'Dubai Hills Central Park Playground',
            place_id: 'place_1',
            date_time: '2026-08-22T09:00',
            interest_tag: 'Cycling',
            min_age: 4,
            max_age: 10,
            host_id: 'user_1',
            host_name: 'Sarah Jenkins',
            host_avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Sarah',
            max_attendees: 8,
            image_url: '',
            created_at: new Date().toISOString()
        },
        {
            id: 'm_2',
            title: 'JBR Beach Splash & Sandcastles',
            district: 'JBR',
            public_location: 'JBR Public Beach Splash Pad',
            place_id: 'place_3',
            date_time: '2026-08-23T16:30',
            interest_tag: 'Swimming',
            min_age: 2,
            max_age: 7,
            host_id: 'user_1',
            host_name: 'Sarah Jenkins',
            host_avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Sarah',
            max_attendees: 10,
            image_url: '',
            created_at: new Date().toISOString()
        }
    ],
    rsvps: [
        { id: 'r_1', meetup_id: 'm_1', user_id: 'user_1', user_name: 'Sarah Jenkins', user_avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Sarah', status: 'attending' },
        { id: 'r_2', meetup_id: 'm_2', user_id: 'user_1', user_name: 'Sarah Jenkins', user_avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Sarah', status: 'attending' }
    ],
    comments: [
        { id: 'comm_1', meetup_id: 'm_1', user_id: 'user_1', user_name: 'Sarah Jenkins', user_avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Sarah', content: 'Looking forward to meeting neighbor kids near the splash area!', created_at: new Date().toISOString() }
    ],
    direct_messages: [],
    places: []
};

// --- SQLITE BACKUP IMPLEMENTATION ---
let sqlite = null;
if (DatabaseSync) {
    try {
        const DB_PATH = process.env.VERCEL ? '/tmp/database.sqlite' : path.join(__dirname, 'database.sqlite');
        sqlite = new DatabaseSync(DB_PATH);
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

            CREATE TABLE IF NOT EXISTS direct_messages (
                id TEXT PRIMARY KEY,
                meetup_id TEXT NOT NULL,
                sender_id TEXT NOT NULL,
                sender_name TEXT NOT NULL,
                sender_avatar TEXT DEFAULT '',
                recipient_id TEXT NOT NULL,
                recipient_name TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            );
        `);
    } catch (sqliteErr) {
        console.warn('[DB Warning] SQLite fallback disabled:', sqliteErr.message);
        sqlite = null;
    }
}

// --- DUAL MODE DB ADAPTER API ---
export const db = {
    isSupabase: isSupabaseConfigured,

    // Authentication Methods
    registerUser: async ({ name, email, password, district, phone }) => {
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
            phone: phone || '+971 50 123 4567',
            contact_preference: 'WhatsApp',
            avatar_url: avatarUrl,
            bio: 'Active community parent'
        };

        if (isSupabaseConfigured) {
            try {
                await supabase.insert('users', [userObj]);
            } catch (err) {
                console.error('[Supabase Error] registerUser fallback:', err.message);
            }
        }

        if (sqlite) {
            try {
                sqlite.prepare(`
                    INSERT INTO users (id, name, email, password_hash, district, contact_preference, avatar_url, bio)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(userId, userObj.name, userObj.email, userObj.password_hash, userObj.district, userObj.contact_preference, userObj.avatar_url, userObj.bio);
            } catch (e) {}
        }

        memoryStore.users.push({ ...userObj, children: [] });
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
                console.error('[Supabase Error] getUserByEmail fallback:', err.message);
            }
        }
        if (sqlite) {
            try {
                const u = sqlite.prepare(`SELECT * FROM users WHERE LOWER(email) = LOWER(?)`).get(cleanEmail);
                if (u) return u;
            } catch (e) {}
        }
        return memoryStore.users.find(u => u.email.toLowerCase() === cleanEmail) || null;
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
            } catch (err) {}
        }
        if (sqlite) {
            try {
                return sqlite.prepare(`SELECT * FROM users`).all();
            } catch (e) {}
        }
        return memoryStore.users;
    },

    getUserById: async (id) => {
        if (isSupabaseConfigured) {
            try {
                const users = await supabase.select('users', { eq: { id } });
                const user = users && users[0] ? users[0] : null;
                if (user) {
                    const childrenRows = await supabase.select('children', { eq: { user_id: id } });
                    const children = (childrenRows || []).map(c => ({
                        ...c,
                        hobbies: typeof c.hobbies === 'string' ? JSON.parse(c.hobbies || '[]') : (c.hobbies || [])
                    }));
                    return { ...user, children };
                }
            } catch (err) {}
        }

        if (sqlite) {
            try {
                const user = sqlite.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
                if (user) {
                    const childrenRows = sqlite.prepare(`SELECT * FROM children WHERE user_id = ?`).all(id);
                    const children = childrenRows.map(c => ({
                        ...c,
                        hobbies: JSON.parse(c.hobbies || '[]')
                    }));
                    return { ...user, children };
                }
            } catch (e) {}
        }

        const memUser = memoryStore.users.find(u => u.id === id);
        if (memUser) return { ...memUser, children: memUser.children || [] };
        return null;
    },

    updateProfile: async (updatedData) => {
        const userId = updatedData.id || 'user_1';

        let u = memoryStore.users.find(x => x.id === userId);
        if (!u) {
            u = { id: userId, name: '', email: '', district: '', contact_preference: 'In-App Message', avatar_url: '', bio: '', is_verified: false, verification_method: '', children: [] };
            memoryStore.users.push(u);
        }
        Object.assign(u, updatedData);

        if (isSupabaseConfigured) {
            try {
                await supabase.upsert('users', [u]);
            } catch (err) {}
        }

        return u;
    },

    // Places
    getPlaces: async (district) => {
        const defaultPlaces = [
            {
                id: 'place_1',
                name: 'Dubai Hills Central Park',
                district: 'Dubai Hills',
                public_spot_type: 'Park',
                description: 'Expansive green lawn, splash park, adventure playground, and shaded seating area.',
                image_url: '',
                amenities: 'Playground, Splash Pad, Shaded Seating, Restrooms, Parking',
                added_by_user_id: 'system',
                created_at: new Date().toISOString()
            },
            {
                id: 'place_2',
                name: 'Arabian Ranches Community Clubhouse & Pool',
                district: 'Arabian Ranches',
                public_spot_type: 'Clubhouse',
                description: 'Community pool, kids paddling pool, shaded bbq pavilions, and tennis court.',
                image_url: '',
                amenities: 'Community Pool, Shaded Pavilion, Tennis Court, Restrooms',
                added_by_user_id: 'system',
                created_at: new Date().toISOString()
            },
            {
                id: 'place_3',
                name: 'JBR Beach & Splash Park',
                district: 'JBR',
                public_spot_type: 'Beach',
                description: 'Public beach promenade with kids splash pads, outdoor playground, and beach volleyball.',
                image_url: '',
                amenities: 'Public Beach, Outdoor Gym, Splash Park, Restrooms',
                added_by_user_id: 'system',
                created_at: new Date().toISOString()
            }
        ];

        let dynamicPlaces = [...memoryStore.places];
        if (isSupabaseConfigured) {
            try {
                const res = await supabase.select('places', { order: 'created_at.desc' });
                if (res && res.length > 0) dynamicPlaces = res;
            } catch (err) {}
        } else if (sqlite) {
            try {
                const res = sqlite.prepare(`SELECT * FROM places ORDER BY created_at DESC`).all();
                if (res && res.length > 0) dynamicPlaces = res;
            } catch (e) {}
        }

        const combinedMap = new Map();
        defaultPlaces.forEach(p => combinedMap.set(p.name.toLowerCase(), p));
        dynamicPlaces.forEach(p => combinedMap.set(p.name.toLowerCase(), p));

        let result = Array.from(combinedMap.values());
        if (district && district !== 'All') {
            result = result.filter(p => p.district.toLowerCase() === district.toLowerCase());
        }

        return result;
    },

    addPlace: async (place, userObj = {}) => {
        const id = 'place_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        const placeObj = {
            id,
            name: place.name,
            district: place.district,
            public_spot_type: place.public_spot_type,
            description: place.description || '',
            image_url: place.image_url || 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=600',
            amenities: place.amenities || 'Playground, Shaded Seating, Restrooms',
            added_by_user_id: userObj.id || place.added_by_user_id || 'user_1',
            created_at: new Date().toISOString()
        };

        if (isSupabaseConfigured) {
            try {
                const res = await supabase.insert('places', [placeObj]);
                return res && res[0] ? res[0] : placeObj;
            } catch (err) {}
        }

        if (sqlite) {
            try {
                sqlite.prepare(`
                    INSERT INTO places (id, name, district, public_spot_type, description, image_url, amenities, added_by_user_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(id, placeObj.name, placeObj.district, placeObj.public_spot_type, placeObj.description, placeObj.image_url, placeObj.amenities, placeObj.added_by_user_id);
            } catch (e) {}
        }

        memoryStore.places.unshift(placeObj);
        return placeObj;
    },

    // Meetups
    getMeetups: async ({ district, interest, minAge, maxAge, search } = {}) => {
        let meetups = [];

        if (isSupabaseConfigured) {
            try {
                meetups = await supabase.select('meetups', { order: 'created_at.desc' });
            } catch (err) {}
        }

        if (meetups.length === 0 && sqlite) {
            try {
                let sql = `SELECT * FROM meetups WHERE 1=1`;
                const params = [];
                if (district && district !== 'All') { sql += ` AND LOWER(district) = LOWER(?)`; params.push(district); }
                if (interest && interest !== 'All') { sql += ` AND LOWER(interest_tag) = LOWER(?)`; params.push(interest); }
                sql += ` ORDER BY created_at DESC`;
                meetups = sqlite.prepare(sql).all(...params);
            } catch (e) {}
        }

        if (meetups.length === 0) {
            meetups = [...memoryStore.meetups];
        }

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

        return meetups.map(m => {
            let meetupRsvps = [];
            let meetupComments = [];
            if (sqlite) {
                try {
                    const rsvps = sqlite.prepare(`SELECT user_id FROM rsvps WHERE meetup_id = ? AND status = 'attending'`).all(m.id);
                    meetupRsvps = rsvps.map(r => r.user_id);
                    meetupComments = sqlite.prepare(`SELECT * FROM comments WHERE meetup_id = ? ORDER BY created_at ASC`).all(m.id);
                } catch (e) {}
            }
            if (meetupRsvps.length === 0) {
                meetupRsvps = memoryStore.rsvps.filter(r => r.meetup_id === m.id && r.status === 'attending').map(r => r.user_id);
            }
            if (meetupComments.length === 0) {
                meetupComments = memoryStore.comments.filter(c => c.meetup_id === m.id);
            }

            let allergy_summary = [];
            if (m.title.toLowerCase().includes('sports') || m.title.toLowerCase().includes('park') || m.id === 'm_1') {
                allergy_summary = ['Peanut Allergy (1 child)', 'Dairy Sensitivity (1 child)'];
            } else if (m.title.toLowerCase().includes('pool') || m.title.toLowerCase().includes('swim')) {
                allergy_summary = ['Gluten Intolerant (1 child)'];
            }

            return {
                ...m,
                attendees_count: meetupRsvps.length,
                attendees: meetupRsvps,
                comments: meetupComments,
                allergy_summary
            };
        });
    },

    getMeetupById: async (id) => {
        const meetups = await db.getMeetups();
        return meetups.find(m => m.id === id) || null;
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
            image_url: meetup.image_url || '',
            created_at: new Date().toISOString()
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
            } catch (err) {}
        }

        if (sqlite) {
            try {
                sqlite.prepare(`
                    INSERT INTO meetups (id, title, district, public_location, place_id, date_time, interest_tag, min_age, max_age, host_id, host_name, host_avatar, max_attendees, image_url)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(id, meetup.title, meetup.district, meetup.public_location, meetup.place_id || '', meetup.date_time, meetup.interest_tag, meetup.min_age || 0, meetup.max_age || 18, hostId, hostName, hostAvatar, meetup.max_attendees || 10, meetup.image_url || '/assets/football.png');

                sqlite.prepare(`
                    INSERT INTO rsvps (id, meetup_id, user_id, user_name, user_avatar, status)
                    VALUES (?, ?, ?, ?, ?, 'attending')
                `).run('rsvp_' + Date.now(), id, hostId, hostName, hostAvatar);
            } catch (e) {}
        }

        memoryStore.meetups.unshift(meetupObj);
        memoryStore.rsvps.push({ id: 'rsvp_' + Date.now(), meetup_id: id, user_id: hostId, user_name: hostName, user_avatar: hostAvatar, status: 'attending' });

        return db.getMeetupById(id);
    },

    toggleRsvp: async (meetupId, userId, userName, userAvatar) => {
        const meetup = await db.getMeetupById(meetupId);
        if (!meetup) return null;

        let userStatus = 'attending';
        if (isSupabaseConfigured) {
            try {
                const existing = await supabase.select('rsvps', { eq: { meetup_id: meetupId, user_id: userId } });
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
            } catch (err) {}
        }

        if (sqlite) {
            try {
                const existingRsvp = sqlite.prepare(`SELECT * FROM rsvps WHERE meetup_id = ? AND user_id = ?`).get(meetupId, userId);
                if (existingRsvp) {
                    sqlite.prepare(`DELETE FROM rsvps WHERE meetup_id = ? AND user_id = ?`).run(meetupId, userId);
                    userStatus = 'cancelled';
                } else {
                    sqlite.prepare(`
                        INSERT INTO rsvps (id, meetup_id, user_id, user_name, user_avatar, status)
                        VALUES (?, ?, ?, ?, ?, 'attending')
                    `).run('rsvp_' + Date.now(), meetupId, userId, userName || 'Parent', userAvatar || '');
                }
            } catch (e) {}
        }

        const idx = memoryStore.rsvps.findIndex(r => r.meetup_id === meetupId && r.user_id === userId);
        if (idx !== -1) {
            memoryStore.rsvps.splice(idx, 1);
            userStatus = 'cancelled';
        } else {
            memoryStore.rsvps.push({ id: 'rsvp_' + Date.now(), meetup_id: meetupId, user_id: userId, user_name: userName || 'Parent', user_avatar: userAvatar || '', status: 'attending' });
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
            content,
            created_at: new Date().toISOString()
        };

        if (isSupabaseConfigured) {
            try {
                const res = await supabase.insert('comments', [commentObj]);
                return res && res[0] ? res[0] : commentObj;
            } catch (err) {}
        }

        if (sqlite) {
            try {
                sqlite.prepare(`
                    INSERT INTO comments (id, meetup_id, user_id, user_name, user_avatar, content)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(id, meetupId, userId, userName || 'Parent', userAvatar || '', content);
            } catch (e) {}
        }

        memoryStore.comments.push(commentObj);
        return commentObj;
    },

    getRsvpsForUser: async (userId) => {
        const allMeetups = await db.getMeetups();
        return allMeetups.filter(m => m.host_id === userId || (m.attendees && m.attendees.includes(userId)));
    },

    checkDoubleOptIn: async (userId1, userId2, meetupId) => {
        const meetup = await db.getMeetupById(meetupId);
        if (!meetup) return false;
        const participants = new Set([meetup.host_id, ...(meetup.attendees || [])]);
        return participants.has(userId1) && participants.has(userId2);
    },

    getDirectMessages: async (meetupId, userId1, userId2) => {
        const isOptedIn = await db.checkDoubleOptIn(userId1, userId2, meetupId);
        if (!isOptedIn) {
            return {
                allowed: false,
                reason: "Double-Opt-In Locked: Direct messaging unlocks only after both parents agree to join the meetup.",
                messages: []
            };
        }

        if (isSupabaseConfigured) {
            try {
                const msgs = await supabase.select('direct_messages', { eq: { meetup_id: meetupId } });
                const filtered = (msgs || []).filter(m => 
                    (m.sender_id === userId1 && m.recipient_id === userId2) ||
                    (m.sender_id === userId2 && m.recipient_id === userId1)
                );
                return { allowed: true, messages: filtered };
            } catch (err) {}
        }

        if (sqlite) {
            try {
                const messages = sqlite.prepare(`
                    SELECT * FROM direct_messages 
                    WHERE meetup_id = ? AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
                    ORDER BY created_at ASC
                `).all(meetupId, userId1, userId2, userId2, userId1);
                if (messages && messages.length > 0) return { allowed: true, messages };
            } catch (e) {}
        }

        const filtered = memoryStore.direct_messages.filter(m => 
            m.meetup_id === meetupId &&
            ((m.sender_id === userId1 && m.recipient_id === userId2) || (m.sender_id === userId2 && m.recipient_id === userId1))
        );
        return { allowed: true, messages: filtered };
    },

    sendDirectMessage: async ({ meetupId, sender, recipientId, recipientName, content }) => {
        const isOptedIn = await db.checkDoubleOptIn(sender.id, recipientId, meetupId);
        if (!isOptedIn) {
            throw new Error("Double-Opt-In Protection: Both parents must RSVP to the same meetup before sending direct messages.");
        }

        const msgObj = {
            id: 'dm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            meetup_id: meetupId,
            sender_id: sender.id,
            sender_name: sender.name || 'Parent',
            sender_avatar: sender.avatar_url || '',
            recipient_id: recipientId,
            recipient_name: recipientName || 'Parent',
            content,
            created_at: new Date().toISOString()
        };

        if (isSupabaseConfigured) {
            try {
                await supabase.insert('direct_messages', [msgObj]);
                return msgObj;
            } catch (err) {}
        }

        if (sqlite) {
            try {
                sqlite.prepare(`
                    INSERT INTO direct_messages (id, meetup_id, sender_id, sender_name, sender_avatar, recipient_id, recipient_name, content, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(msgObj.id, msgObj.meetup_id, msgObj.sender_id, msgObj.sender_name, msgObj.sender_avatar, msgObj.recipient_id, msgObj.recipient_name, msgObj.content, msgObj.created_at);
            } catch (e) {}
        }

        memoryStore.direct_messages.push(msgObj);
        return msgObj;
    },

    // Activity Squads Methods
    getSquads: async (district) => {
        const defaultSquads = [
            { id: 'sq_1', name: 'Springs 3 Weekend Cycling Club', district: 'Arabian Ranches', category: 'Cycling', description: 'Weekly Saturday morning bike rides for kids ages 6-12 around community park tracks.', members_count: 14, created_by_user_id: 'user_1' },
            { id: 'sq_2', name: 'Dubai Hills Roblox Gaming Squad', district: 'Dubai Hills', category: 'Roblox / Gaming', description: 'Supervised weekend online building sessions & local strategy meetups for tweens.', members_count: 22, created_by_user_id: 'user_2' },
            { id: 'sq_3', name: 'Palm Jumeirah Toddler Swim Stars', district: 'Palm Jumeirah', category: 'Swimming', description: 'Fun splash dates & beginner swim confidence games for toddlers and parents.', members_count: 9, created_by_user_id: 'user_3' },
            { id: 'sq_4', name: 'Mirdif Park Football Juniors', district: 'Mirdif', category: 'Football', description: 'Casual 5-v-5 football matches for kids 5-10 at Mushrif Park pitch.', members_count: 18, created_by_user_id: 'user_4' }
        ];

        let result = defaultSquads;
        if (district && district !== 'All') {
            result = result.filter(s => s.district.toLowerCase() === district.toLowerCase());
        }
        return result;
    },

    createSquad: async (squadData, user) => {
        const id = 'sq_' + Date.now();
        return {
            id,
            name: squadData.name,
            district: squadData.district || user.district || 'Dubai Hills',
            category: squadData.category || 'Park Play',
            description: squadData.description || '',
            created_by_user_id: user.id,
            members_count: 1
        };
    },

    // Community Events Methods
    getEvents: async (district) => {
        const defaultEvents = [
            { id: 'ev_1', title: 'Dubai Hills Community Sports & Family Fun Day', district: 'Dubai Hills', event_date: '2026-08-20 17:00', location: 'Dubai Hills Central Park', category: 'Sports Day', description: 'Relay races, obstacle courses, and healthy snacks for neighborhood families.' },
            { id: 'ev_2', title: 'Springs 3 Summer Splash & Ice Cream Party', district: 'Arabian Ranches', event_date: '2026-08-22 16:30', location: 'Arabian Ranches Clubhouse Pool', category: 'Holiday Party', description: 'Cool off with pool games and artisan gelato station!' },
            { id: 'ev_3', title: 'JBR Beach Clean-up & Junior Eco Explorers', district: 'JBR', event_date: '2026-08-28 08:30', location: 'JBR Public Beach', category: 'Eco Community', description: 'Teach kids marine conservation while gathering seashells and beach treasures.' }
        ];

        let result = defaultEvents;
        if (district && district !== 'All') {
            result = result.filter(e => e.district.toLowerCase() === district.toLowerCase());
        }
        return result;
    },

    getToyItems: async (district) => {
        if (isSupabaseConfigured) {
            try {
                const query = district && district !== 'All' ? { district: `eq.${district}` } : {};
                const data = await supabase.select('toys', query);
                if (data && Array.isArray(data) && data.length > 0) return data;
            } catch (err) {
                console.error('[Supabase Error] getToyItems:', err.message);
            }
        }

        const defaultToys = [
            {
                id: 'item_1',
                title: 'DESC / DESS PE Kit & Sports Hoodie Set (Size 32 / Year 5-6)',
                category: 'School Uniform',
                school_name: 'DESC / DESS',
                grade_level: 'Year 5 - Year 6',
                district: 'Dubai Hills',
                condition: 'Gently Used',
                swap_type: 'Swap or Free Donation',
                user_id: 'user_1',
                user_name: 'Rachel S. (DESS Parent)',
                user_contact: '+971 50 492 8172',
                user_phone: '+971 50 492 8172',
                status: 'available',
                image_url: ''
            }
        ];

        let result = memoryStore.toys && memoryStore.toys.length > 0 ? memoryStore.toys : defaultToys;
        if (district && district !== 'All') {
            result = result.filter(t => t.district.toLowerCase() === district.toLowerCase());
        }
        return result;
    },

    addToyItem: async (toyData, user) => {
        const itemObj = {
            id: 'item_' + Date.now(),
            title: toyData.title,
            category: toyData.category || 'School Uniform',
            school_name: toyData.school_name || 'General',
            grade_level: toyData.grade_level || 'All Ages',
            district: toyData.district || user.district || 'Dubai Hills',
            condition: toyData.condition || 'Gently Used',
            swap_type: toyData.swap_type || (toyData.price > 0 ? 'For Sale' : 'Free Pass-Along'),
            price: toyData.price || 0,
            user_id: user.id || 'user_1',
            user_name: user.name || 'Parent',
            user_contact: user.phone || toyData.user_phone || '+971 50 123 4567',
            user_phone: user.phone || toyData.user_phone || '+971 50 123 4567',
            image_url: toyData.image_url || '',
            description: toyData.description || '',
            status: 'available',
            created_at: new Date().toISOString()
        };

        if (isSupabaseConfigured) {
            try {
                await supabase.insert('toys', [itemObj]);
            } catch (err) {
                console.error('[Supabase Error] addToyItem:', err.message);
            }
        }

        if (!memoryStore.toys) memoryStore.toys = [];
        memoryStore.toys.unshift(itemObj);
        return itemObj;
    },

    getVenueDiscounts: async () => {
        return [
            { id: 'disc_1', venue_name: 'OliOli Children’s Play Museum', district: 'Al Quoz / Dubai Hills', discount_title: '20% OFF Family Pass', promo_code: 'LITTLE20', valid_until: '2026-12-31', category: 'Indoor Play' }
        ];
    },

    getCarpoolRides: async (district) => {
        const defaultRides = [
            { id: 'carpool_1', parent_id: 'user_1', parent_name: 'Aisha M.', district: 'Dubai Hills', destination: 'Dubai Football Academy (Sports City)', ride_date: 'Mon & Wed @ 16:30', available_seats: 2, notes: 'Fits 2 boosters safely.' }
        ];

        let result = defaultRides;
        if (district && district !== 'All') {
            result = result.filter(r => r.district.toLowerCase() === district.toLowerCase());
        }
        return result;
    },

    addCarpoolRide: async (rideData, user) => {
        return {
            id: 'carpool_' + Date.now(),
            parent_id: user.id,
            parent_name: user.name || 'Parent',
            district: rideData.district || user.district || 'Dubai Hills',
            destination: rideData.destination,
            ride_date: rideData.ride_date,
            available_seats: Number(rideData.available_seats || 2),
            notes: rideData.notes || '',
            created_at: new Date().toISOString()
        };
    },

    getLostFoundItems: async (district) => {
        if (isSupabaseConfigured) {
            try {
                const query = district && district !== 'All' ? { district: `eq.${district}` } : {};
                const data = await supabase.select('lost_found', query);
                if (data && Array.isArray(data) && data.length > 0) return data;
            } catch (err) {
                console.error('[Supabase Error] getLostFoundItems:', err.message);
            }
        }

        if (!global._lostFoundStore) {
            global._lostFoundStore = [
                {
                    id: 'lost_1',
                    title: 'Micro Maxi Scooter (Red, named "Leo")',
                    category: 'Scooter / Bike',
                    status: 'Lost',
                    district: 'Dubai Hills',
                    location_detail: 'Dropped along Central Park splash area walking track',
                    reported_by: 'Sarah J. (050-XXXXXXX)',
                    image_url: '',
                    created_at: '2026-08-13T10:00:00.000Z'
                }
            ];
        }

        let result = global._lostFoundStore;
        if (district && district !== 'All') {
            result = result.filter(item => item.district.toLowerCase() === district.toLowerCase());
        }
        return result;
    },

    addLostFoundItem: async (itemData, user) => {
        const itemObj = {
            id: 'lf_' + Date.now(),
            title: itemData.title,
            category: itemData.category || 'Item',
            status: itemData.status || 'Lost',
            district: itemData.district || user.district || 'Dubai Hills',
            location_detail: itemData.location_detail || 'Neighborhood path',
            reported_by: user.name || 'Parent Resident',
            image_url: itemData.image_url || '',
            created_at: new Date().toISOString()
        };

        if (isSupabaseConfigured) {
            try {
                await supabase.insert('lost_found', [itemObj]);
            } catch (err) {
                console.error('[Supabase Error] addLostFoundItem:', err.message);
            }
        }

        if (!global._lostFoundStore) await db.getLostFoundItems();
        global._lostFoundStore.unshift(itemObj);
        return itemObj;
    },

    markLostFoundAsFound: async (id) => {
        if (isSupabaseConfigured) {
            try {
                await supabase.update('lost_found', { status: 'Found' }, id);
            } catch (err) {
                console.error('[Supabase Error] markLostFoundAsFound:', err.message);
            }
        }

        if (!global._lostFoundStore) await db.getLostFoundItems();
        const item = global._lostFoundStore.find(i => i.id === id);
        if (item) item.status = 'Found';
        return item;
    }
};
