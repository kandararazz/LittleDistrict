// Vercel Serverless Function Entry Point for LittleDistrict REST API
import { db } from '../server/db.js';

function parseBody(req) {
    if (req.body && typeof req.body === 'object') {
        return Promise.resolve(req.body);
    }
    if (typeof req.body === 'string') {
        try {
            return Promise.resolve(JSON.parse(req.body));
        } catch (e) {
            return Promise.resolve({});
        }
    }
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');

    if (typeof res.status === 'function') {
        if (typeof res.json === 'function') {
            return res.status(status).json(data);
        }
        res.statusCode = status;
    } else {
        res.statusCode = status;
    }
    res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');
        return res.status ? res.status(204).end() : (res.statusCode = 204, res.end());
    }

    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname.replace(/\/$/, '') || '/';
    const queryParams = Object.fromEntries(reqUrl.searchParams);

    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    const user = token ? await db.getUserByToken(token).catch(() => null) : null;

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

        if (pathname === '/api/auth/profile' && req.method === 'PUT') {
            if (!user) return sendJSON(res, 401, { success: false, error: 'Unauthorized' });
            const body = await parseBody(req);
            const updated = await db.updateProfile({ ...body, id: user.id });
            return sendJSON(res, 200, { success: true, user: updated });
        }

        if (pathname === '/api/auth/verify' && req.method === 'POST') {
            if (!user) return sendJSON(res, 401, { success: false, error: 'Unauthorized' });
            const body = await parseBody(req);
            const method = body.verification_method || 'Ejari Lease Contract';
            const doc = body.verification_document || '';

            if (method !== 'Neighborhood Code' && (!doc || !doc.trim())) {
                return sendJSON(res, 400, { success: false, error: 'Photo of Ejari contract or DEWA bill is required for residency verification.' });
            }

            const updated = await db.updateProfile({
                id: user.id,
                is_verified: true,
                verification_method: method,
                verification_document: doc
            });
            return sendJSON(res, 200, { success: true, user: updated, message: 'Residency verified successfully!' });
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

        // DIRECT MESSAGES (DOUBLE-OPT-IN)
        if (pathname.match(/^\/api\/meetups\/([^/]+)\/messages$/)) {
            const meetupId = pathname.split('/')[3];
            if (!user) return sendJSON(res, 401, { success: false, error: 'Unauthorized' });

            if (req.method === 'GET') {
                const recipientId = queryParams.withUserId;
                if (!recipientId) return sendJSON(res, 400, { success: false, error: 'Recipient ID required' });
                const result = await db.getDirectMessages(meetupId, user.id, recipientId);
                return sendJSON(res, 200, { success: true, ...result });
            }

            if (req.method === 'POST') {
                const body = await parseBody(req);
                try {
                    const msg = await db.sendDirectMessage({
                        meetupId,
                        sender: user,
                        recipientId: body.recipientId,
                        recipientName: body.recipientName,
                        content: body.content
                    });
                    return sendJSON(res, 201, { success: true, data: msg });
                } catch (err) {
                    return sendJSON(res, 403, { success: false, error: err.message });
                }
            }
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

        // EXCHANGE / TOYS
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

        if (pathname.match(/^\/api\/lost-found\/([^/]+)\/found$/) && req.method === 'PUT') {
            const itemId = pathname.split('/')[3];
            const updated = await db.markLostFoundAsFound(itemId);
            return sendJSON(res, 200, { success: true, data: updated });
        }

        // DISCOUNTS, SQUADS, EVENTS, CARPOOLS
        if (pathname === '/api/discounts' && req.method === 'GET') {
            const discounts = await db.getVenueDiscounts();
            return sendJSON(res, 200, { success: true, data: discounts });
        }

        if (pathname === '/api/squads' && req.method === 'GET') {
            const squads = await db.getSquads(queryParams.district);
            return sendJSON(res, 200, { success: true, data: squads });
        }

        if (pathname === '/api/squads' && req.method === 'POST') {
            if (!user) return sendJSON(res, 401, { success: false, error: 'Unauthorized' });
            const body = await parseBody(req);
            const squad = await db.createSquad(body, user);
            return sendJSON(res, 201, { success: true, data: squad });
        }

        if (pathname === '/api/events' && req.method === 'GET') {
            const events = await db.getEvents(queryParams.district);
            return sendJSON(res, 200, { success: true, data: events });
        }

        if (pathname === '/api/carpools' && req.method === 'GET') {
            const rides = await db.getCarpoolRides(queryParams.district);
            return sendJSON(res, 200, { success: true, data: rides });
        }

        if (pathname === '/api/carpools' && req.method === 'POST') {
            if (!user) return sendJSON(res, 401, { success: false, error: 'Unauthorized' });
            const body = await parseBody(req);
            const ride = await db.addCarpoolRide(body, user);
            return sendJSON(res, 201, { success: true, data: ride });
        }

        return sendJSON(res, 404, { success: false, error: 'API Route Not Found' });
    } catch (err) {
        console.error('[Vercel API Error]', err);
        return sendJSON(res, 500, { success: false, error: err.message || 'Internal Server Error' });
    }
}
