// Dubai Community Kids Backend HTTP & API Server
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function sendJSON(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id'
    });
    res.end(JSON.stringify(data));
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
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
        req.on('error', reject);
    });
}

function getUserFromReq(req) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    return db.getUserByToken(token);
}

const server = http.createServer(async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id'
        });
        return res.end();
    }

    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;
    const queryParams = Object.fromEntries(reqUrl.searchParams);

    try {
        // --- API ROUTES ---

        // AUTH
        if (pathname === '/api/auth/register' && req.method === 'POST') {
            const body = await parseBody(req);
            const result = await db.registerUser(body);
            return sendJSON(res, 201, { success: true, ...result });
        }

        if (pathname === '/api/auth/login' && req.method === 'POST') {
            const body = await parseBody(req);
            const result = await db.loginUser(body);
            return sendJSON(res, 200, { success: true, ...result });
        }

        if (pathname === '/api/auth/me' && req.method === 'GET') {
            const user = await getUserFromReq(req);
            if (!user) return sendJSON(res, 401, { error: 'Unauthorized' });
            return sendJSON(res, 200, { success: true, user });
        }

        if (pathname === '/api/auth/profile' && req.method === 'PUT') {
            const user = await getUserFromReq(req);
            if (!user) return sendJSON(res, 401, { error: 'Unauthorized' });
            const body = await parseBody(req);
            const updated = await db.updateProfile({ ...body, id: user.id });
            return sendJSON(res, 200, { success: true, user: updated });
        }

        // MEETUPS / FEED
        if ((pathname === '/api/meetups' || pathname === '/api/community/feed') && req.method === 'GET') {
            const meetups = await db.getMeetups(queryParams);
            return sendJSON(res, 200, { success: true, data: meetups });
        }

        if (pathname === '/api/meetups' && req.method === 'POST') {
            const user = await getUserFromReq(req);
            const body = await parseBody(req);
            const created = await db.addMeetup(body, user || {});
            return sendJSON(res, 201, { success: true, data: created });
        }

        if (pathname.match(/^\/api\/meetups\/([^/]+)\/rsvp$/) && req.method === 'POST') {
            const meetupId = pathname.split('/')[3];
            const user = await getUserFromReq(req);
            if (!user) return sendJSON(res, 401, { error: 'Please log in to RSVP' });
            const updated = await db.toggleRsvp(meetupId, user.id, user.name, user.avatar_url);
            return sendJSON(res, 200, { success: true, data: updated });
        }

        if (pathname.match(/^\/api\/meetups\/([^/]+)\/comments$/) && req.method === 'POST') {
            const meetupId = pathname.split('/')[3];
            const user = await getUserFromReq(req);
            if (!user) return sendJSON(res, 401, { error: 'Please log in to comment' });
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
            const user = await getUserFromReq(req);
            const body = await parseBody(req);
            const created = await db.addPlace(body, user || {});
            return sendJSON(res, 201, { success: true, data: created });
        }

        // TOY EXCHANGE
        if ((pathname === '/api/toys' || pathname === '/api/v2/toys') && req.method === 'GET') {
            const toys = await db.getToyItems(queryParams.district);
            return sendJSON(res, 200, { success: true, data: toys });
        }

        if (pathname === '/api/toys' && req.method === 'POST') {
            const user = await getUserFromReq(req);
            const body = await parseBody(req);
            const created = await db.addToyItem(body, user || {});
            return sendJSON(res, 201, { success: true, data: created });
        }

        // CARPOOLS
        if (pathname === '/api/carpools' && req.method === 'GET') {
            const rides = await db.getCarpoolRides(queryParams.district);
            return sendJSON(res, 200, { success: true, data: rides });
        }

        if (pathname === '/api/carpools' && req.method === 'POST') {
            const user = await getUserFromReq(req);
            const body = await parseBody(req);
            const created = await db.addCarpoolRide(body, user || {});
            return sendJSON(res, 201, { success: true, data: created });
        }

        // LOST & FOUND
        if (pathname === '/api/lost-found' && req.method === 'GET') {
            const items = await db.getLostFoundItems(queryParams.district);
            return sendJSON(res, 200, { success: true, data: items });
        }

        if (pathname === '/api/lost-found' && req.method === 'POST') {
            const user = await getUserFromReq(req);
            const body = await parseBody(req);
            const created = await db.addLostFoundItem(body, user || {});
            return sendJSON(res, 201, { success: true, data: created });
        }

        if (pathname.match(/^\/api\/lost-found\/([^/]+)\/found$/) && req.method === 'PUT') {
            const itemId = pathname.split('/')[3];
            const updated = await db.markLostFoundAsFound(itemId);
            return sendJSON(res, 200, { success: true, data: updated });
        }

        // DISCOUNTS & SQUADS
        if (pathname === '/api/discounts' && req.method === 'GET') {
            const discounts = await db.getVenueDiscounts();
            return sendJSON(res, 200, { success: true, data: discounts });
        }

        if (pathname === '/api/squads' && req.method === 'GET') {
            const squads = await db.getSquads(queryParams.district);
            return sendJSON(res, 200, { success: true, data: squads });
        }

        // --- STATIC FILE SERVING ---
        let filePath = path.join(ROOT_DIR, pathname === '/' ? 'index.html' : pathname);
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
            filePath = path.join(ROOT_DIR, 'index.html');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                return res.end('File Not Found');
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });

    } catch (err) {
        console.error('[Server Error]', err);
        return sendJSON(res, 500, { error: err.message || 'Internal Server Error' });
    }
});

server.listen(PORT, () => {
    console.log(`\n====================================================`);
    console.log(`  Dubai Community Kids (LittleDistrict) Server`);
    console.log(`  Running at: http://localhost:${PORT}`);
    console.log(`====================================================\n`);
});
