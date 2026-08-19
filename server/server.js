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
            const user = await getUserFromReq(req);
            if (!user) return sendJSON(res, 401, { success: false, error: 'Unauthorized' });
            return sendJSON(res, 200, { success: true, user });
        }

        if (pathname === '/api/auth/profile' && req.method === 'PUT') {
            const user = await getUserFromReq(req);
            if (!user) return sendJSON(res, 401, { success: false, error: 'Unauthorized' });
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
            if (!user) return sendJSON(res, 401, { success: false, error: 'Please log in to RSVP' });
            const updated = await db.toggleRsvp(meetupId, user.id, user.name, user.avatar_url);
            return sendJSON(res, 200, { success: true, data: updated });
        }

        if (pathname.match(/^\/api\/meetups\/([^/]+)\/comments$/) && req.method === 'POST') {
            const meetupId = pathname.split('/')[3];
            const user = await getUserFromReq(req);
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

        // DISTRICTBOT AI CHAT
        if (pathname === '/api/bot/chat' && req.method === 'POST') {
            const body = await parseBody(req);
            const userMessage = (body.message || '').trim();
            const reply = generateDistrictBotReply(userMessage);
            return sendJSON(res, 200, { success: true, reply });
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
        return sendJSON(res, 500, { success: false, error: err.message || 'Internal Server Error' });
    }
});

function generateDistrictBotReply(msg) {
    const lower = (msg || '').toLowerCase();

    if (lower.includes('who are you') || lower.includes('what are you') || lower.includes('what is districtbot') || lower.includes('who is districtbot') || lower.includes('purpose') || lower.includes('about yourself')) {
        return "I am DistrictBot, an intelligent, friendly AI assistant built inside the Little District web platform! My purpose is to help community members organize activities, find local events, answer questions about the platform, and connect neighbors across Dubai. Keep asking me anything!";
    }

    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
        return "Hello! 👋 Welcome to LittleDistrict! I'm DistrictBot, your neighborhood AI assistant. How can I help you and your family today?";
    }

    if (lower.includes('park') || lower.includes('spot') || lower.includes('playground') || lower.includes('venue')) {
        return "Dubai features fantastic kid spots! Explore Dubai Hills Central Park, Arabian Ranches 2 Splash Pad, JBR Public Beach, or Mushrif Park. Browse or share neighborhood spots in our 'Spots' tab!";
    }

    if (lower.includes('exchange') || lower.includes('uniform') || lower.includes('toy') || lower.includes('book')) {
        return "Our Pass-Along Exchange lets neighborhood parents share gently used school uniforms (DESS, DESC, Kings), books, strollers, and toys. Visit the 'Exchange' tab to browse listings or offer an item!";
    }

    if (lower.includes('playdate') || lower.includes('meetup') || lower.includes('activity')) {
        return "Joining playdates is effortless! Browse upcoming activities on the Playdates feed, click '+ Join RSVP' to attend, or click '+ Playdate' to host park cycling, swimming, or sports games for local kids!";
    }

    if (lower.includes('lost') || lower.includes('found')) {
        return "Lost a jacket or scooter at the park? Head over to the 'Lost & Found' tab to view reported items or post a lost item alert for neighbors!";
    }

    if (lower.includes('phone') || lower.includes('contact') || lower.includes('number') || lower.includes('profile')) {
        return "To keep our parent community safe, a verified phone number is required before posting playdates or exchange items. You can easily manage your phone number in Account Settings!";
    }

    return "Thanks for reaching out! As DistrictBot, I'm here to assist with Dubai playdates, kid-friendly spots, uniform exchanges, and platform navigation. How can I assist you further?";
}

server.listen(PORT, () => {
    console.log(`\n====================================================`);
    console.log(`  Dubai Community Kids (LittleDistrict) Server`);
    console.log(`  Running at: http://localhost:${PORT}`);
    console.log(`====================================================\n`);
});
