// Vercel Serverless Function Entry Point for LittleDistrict REST API
import { db } from '../server/db.js';

function parseBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            if (!body) return resolve({});
            try {
                resolve(JSON.parse(body));
            } catch (err) {
                resolve({});
            }
        });
        req.on('error', () => resolve({}));
    });
}

function sendJSON(res, status, data) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(status).json(data);
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(204).end();
    }

    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;
    const queryParams = Object.fromEntries(reqUrl.searchParams);

    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    const user = token ? await db.getUserByToken(token) : null;

    try {
        // AUTH
        if (pathname === '/api/auth/register' && req.method === 'POST') {
            const body = await parseBody(req);
            try {
                const result = await db.registerUser(body);
                return sendJSON(res, 201, { success: true, ...result });
            } catch (err) {
                return sendJSON(res, 400, { success: false, error: err.message });
            }
        }

        if (pathname === '/api/auth/login' && req.method === 'POST') {
            const body = await parseBody(req);
            try {
                const result = await db.loginUser(body);
                return sendJSON(res, 200, { success: true, ...result });
            } catch (err) {
                return sendJSON(res, 400, { success: false, error: err.message });
            }
        }

        if (pathname === '/api/auth/me' && req.method === 'GET') {
            if (!user) return sendJSON(res, 401, { success: false, error: 'Unauthorized' });
            return sendJSON(res, 200, { success: true, user });
        }

        // MEETUPS / FEED
        if ((pathname === '/api/meetups' || pathname === '/api/community/feed') && req.method === 'GET') {
            const meetups = await db.getMeetups(queryParams);
            return sendJSON(res, 200, { success: true, data: meetups });
        }

        if (pathname === '/api/meetups' && req.method === 'POST') {
            const body = await parseBody(req);
            const created = await db.addMeetup(body, user || {});
            return sendJSON(res, 201, { success: true, data: created });
        }

        if (pathname.match(/^\/api\/meetups\/([^/]+)\/rsvp$/) && req.method === 'POST') {
            const meetupId = pathname.split('/')[3];
            if (!user) return sendJSON(res, 401, { success: false, error: 'Please log in to RSVP' });
            const updated = await db.toggleRsvp(meetupId, user.id, user.name, user.avatar_url);
            return sendJSON(res, 200, { success: true, data: updated });
        }

        if (pathname.match(/^\/api\/meetups\/([^/]+)\/comments$/) && req.method === 'POST') {
            const meetupId = pathname.split('/')[3];
            if (!user) return sendJSON(res, 401, { success: false, error: 'Please log in to comment' });
            const body = await parseBody(req);
            const updated = await db.addComment(meetupId, user.id, user.name, user.avatar_url, body.content);
            return sendJSON(res, 200, { success: true, data: updated });
        }

        // PLACES
        if (pathname === '/api/places' && req.method === 'GET') {
            const places = await db.getPlaces(queryParams.district);
            return sendJSON(res, 200, { success: true, data: places });
        }

        if (pathname === '/api/places' && req.method === 'POST') {
            const body = await parseBody(req);
            const created = await db.addPlace(body, user || {});
            return sendJSON(res, 201, { success: true, data: created });
        }

        // EXCHANGE
        if ((pathname === '/api/toys' || pathname === '/api/v2/toys') && req.method === 'GET') {
            const toys = await db.getToyItems(queryParams.district);
            return sendJSON(res, 200, { success: true, data: toys });
        }

        if (pathname === '/api/toys' && req.method === 'POST') {
            const body = await parseBody(req);
            const created = await db.addToyItem(body, user || {});
            return sendJSON(res, 201, { success: true, data: created });
        }

        // LOST & FOUND
        if (pathname === '/api/lost-found' && req.method === 'GET') {
            const items = await db.getLostFoundItems(queryParams.district);
            return sendJSON(res, 200, { success: true, data: items });
        }

        if (pathname === '/api/lost-found' && req.method === 'POST') {
            const body = await parseBody(req);
            const created = await db.addLostFoundItem(body, user || {});
            return sendJSON(res, 201, { success: true, data: created });
        }

        return sendJSON(res, 404, { success: false, error: 'API Route Not Found' });
    } catch (err) {
        return sendJSON(res, 500, { success: false, error: err.message || 'Internal Server Error' });
    }
}
