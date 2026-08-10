// Real persistent SQLite Database implementation using node:sqlite built-in module

import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'database.sqlite');

// Open or create SQLite database file on disk
const sqlite = new DatabaseSync(DB_PATH);

// Enable WAL mode for high performance & reliability
sqlite.exec(`PRAGMA journal_mode = WAL;`);

// Create SQL Tables
sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        email TEXT DEFAULT '',
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

// Seed default user row if table is empty
const userCountStmt = sqlite.prepare(`SELECT count(*) as count FROM users`);
const userCount = userCountStmt.get().count;
if (userCount === 0) {
    sqlite.prepare(`
        INSERT INTO users (id, name, email, district, contact_preference, avatar_url, bio)
        VALUES ('user_1', '', '', '', 'In-App Message', '', '')
    `).run();
}

export const db = {
    // Users & Profile
    getUsers: () => {
        return sqlite.prepare(`SELECT * FROM users`).all();
    },

    getUserById: (id) => {
        const user = sqlite.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
        if (!user) return null;
        
        // Fetch children
        const childrenRows = sqlite.prepare(`SELECT * FROM children WHERE user_id = ?`).all(id);
        const children = childrenRows.map(c => ({
            ...c,
            hobbies: JSON.parse(c.hobbies || '[]')
        }));

        return { ...user, children };
    },

    updateProfile: (updatedData) => {
        const userId = updatedData.id || 'user_1';

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

        // Replace children list if provided
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
    getPlaces: () => {
        return sqlite.prepare(`SELECT * FROM places ORDER BY created_at DESC`).all();
    },

    addPlace: (place) => {
        const id = 'place_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        sqlite.prepare(`
            INSERT INTO places (id, name, district, public_spot_type, description, added_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            id,
            place.name,
            place.district,
            place.public_spot_type,
            place.description || '',
            place.added_by_user_id || 'user_1'
        );

        return sqlite.prepare(`SELECT * FROM places WHERE id = ?`).get(id);
    },

    // Meetups
    getMeetups: ({ district, interest, minAge, maxAge, search } = {}) => {
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

        // Attach attendees & comments to each meetup
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

    getMeetupById: (id) => {
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

    addMeetup: (meetup) => {
        const id = 'meetup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        const hostId = meetup.host_id || 'user_1';
        const user = db.getUserById(hostId) || {};

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
            user.name || meetup.host_name || 'Parent',
            user.avatar_url || meetup.host_avatar || '',
            meetup.max_attendees || 10,
            meetup.image_url || '/assets/football.png'
        );

        // Add RSVP for host
        sqlite.prepare(`
            INSERT INTO rsvps (id, meetup_id, user_id, user_name, user_avatar, status)
            VALUES (?, ?, ?, ?, ?, 'attending')
        `).run(
            'rsvp_' + Date.now(),
            id,
            hostId,
            user.name || 'Parent',
            user.avatar_url || '',
        );

        return db.getMeetupById(id);
    },

    toggleRsvp: (meetupId, userId, userName, userAvatar) => {
        const meetup = db.getMeetupById(meetupId);
        if (!meetup) return null;

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

        const updatedMeetup = db.getMeetupById(meetupId);
        return {
            meetup: updatedMeetup,
            userStatus
        };
    },

    addComment: (meetupId, userId, userName, userAvatar, content) => {
        const id = 'comment_' + Date.now();
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

    getRsvpsForUser: (userId) => {
        const rows = sqlite.prepare(`
            SELECT DISTINCT m.* FROM meetups m
            LEFT JOIN rsvps r ON m.id = r.meetup_id
            WHERE r.user_id = ? OR m.host_id = ?
            ORDER BY m.created_at DESC
        `).all(userId, userId);

        return rows.map(m => db.getMeetupById(m.id));
    }
};
