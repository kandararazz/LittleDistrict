// Dubai Community Kids Backend HTTP Server & Static File Server

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import { validateMeetup, validatePlace } from './validation.js';

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
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(data));
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (err) {
                reject(err);
            }
        });
    });
}

const server = http.createServer(async (req, res) => {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = urlObj.pathname;
    const method = req.method;

    // Enable CORS preflight
    if (method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    console.log(`[${new Date().toLocaleTimeString()}] ${method} ${pathname}`);

    // --- API ROUTES ---

    // GET /api/community/feed
    if (pathname === '/api/community/feed' && method === 'GET') {
        const district = urlObj.searchParams.get('district');
        const interest = urlObj.searchParams.get('interest');
        const minAge = urlObj.searchParams.get('minAge');
        const maxAge = urlObj.searchParams.get('maxAge');
        const search = urlObj.searchParams.get('search');

        const feed = db.getMeetups({
            district: district || undefined,
            interest: interest || undefined,
            minAge: minAge ? parseInt(minAge, 10) : undefined,
            maxAge: maxAge ? parseInt(maxAge, 10) : undefined,
            search: search || undefined
        });

        return sendJSON(res, 200, { success: true, count: feed.length, data: feed });
    }

    // GET /api/community/places
    if (pathname === '/api/community/places' && method === 'GET') {
        const places = db.getPlaces();
        return sendJSON(res, 200, { success: true, count: places.length, data: places });
    }

    // POST /api/community/places - Add dynamic place ("let make us add it")
    if (pathname === '/api/community/places' && method === 'POST') {
        try {
            const body = await parseBody(req);
            const validation = validatePlace(body);

            if (!validation.success) {
                return sendJSON(res, 400, {
                    success: false,
                    error: "Validation error",
                    details: validation.errors
                });
            }

            const newPlace = db.addPlace(validation.data);
            return sendJSON(res, 201, {
                success: true,
                message: `Successfully added ${newPlace.name} in ${newPlace.district}!`,
                data: newPlace
            });
        } catch (err) {
            return sendJSON(res, 400, { success: false, error: "Invalid JSON body" });
        }
    }

    // POST /api/community/meetups - Zod validated meetup creation with public spot enforcement
    if (pathname === '/api/community/meetups' && method === 'POST') {
        try {
            const body = await parseBody(req);
            const validation = validateMeetup(body);

            if (!validation.success) {
                return sendJSON(res, 422, {
                    success: false,
                    error: "Zod Public Location Validation Failed",
                    details: validation.errors
                });
            }

            const currentUser = db.getUserById('user_1');
            const meetupData = {
                ...validation.data,
                host_id: currentUser.id,
                host_name: currentUser.name,
                host_avatar: currentUser.avatar_url,
                image_url: body.image_url || '/assets/football.png'
            };

            const createdMeetup = db.addMeetup(meetupData);
            return sendJSON(res, 201, {
                success: true,
                message: "Community meetup scheduled successfully!",
                data: createdMeetup
            });
        } catch (err) {
            return sendJSON(res, 400, { success: false, error: "Invalid JSON body" });
        }
    }

    // POST /api/community/rsvp
    if (pathname === '/api/community/rsvp' && method === 'POST') {
        try {
            const body = await parseBody(req);
            const { meetup_id } = body;
            if (!meetup_id) {
                return sendJSON(res, 400, { success: false, error: "meetup_id is required" });
            }

            const currentUser = db.getUserById('user_1');
            const result = db.toggleRsvp(meetup_id, currentUser.id, currentUser.name, currentUser.avatar_url);

            if (!result) {
                return sendJSON(res, 404, { success: false, error: "Meetup not found" });
            }

            return sendJSON(res, 200, {
                success: true,
                message: result.userStatus === 'attending' ? "Successfully joined meetup!" : "RSVP cancelled.",
                userStatus: result.userStatus,
                data: result.meetup
            });
        } catch (err) {
            return sendJSON(res, 400, { success: false, error: "Invalid JSON body" });
        }
    }

    // POST /api/community/meetups/:id/comments
    if (pathname.startsWith('/api/community/meetups/') && pathname.endsWith('/comments') && method === 'POST') {
        try {
            const meetupId = pathname.split('/')[4];
            const body = await parseBody(req);
            if (!body.content || !body.content.trim()) {
                return sendJSON(res, 400, { success: false, error: "Comment content is required" });
            }

            const currentUser = db.getUserById('user_1');
            const comment = db.addComment(meetupId, currentUser.id, currentUser.name, currentUser.avatar_url, body.content.trim());

            if (!comment) {
                return sendJSON(res, 404, { success: false, error: "Meetup not found" });
            }

            return sendJSON(res, 201, { success: true, data: comment });
        } catch (err) {
            return sendJSON(res, 400, { success: false, error: "Invalid JSON body" });
        }
    }

    // GET /api/profile
    if (pathname === '/api/profile' && method === 'GET') {
        const currentUser = db.getUserById('user_1');
        return sendJSON(res, 200, { success: true, data: currentUser });
    }

    // PUT /api/profile
    if (pathname === '/api/profile' && method === 'PUT') {
        try {
            const body = await parseBody(req);
            const currentUser = db.getUserById('user_1');
            const updated = db.updateProfile({ ...currentUser, ...body });
            return sendJSON(res, 200, { success: true, data: updated });
        } catch (err) {
            return sendJSON(res, 400, { success: false, error: "Invalid JSON body" });
        }
    }

    // GET /api/my-meetups
    if (pathname === '/api/my-meetups' && method === 'GET') {
        const currentUser = db.getUserById('user_1');
        const myMeetups = db.getRsvpsForUser(currentUser.id);
        return sendJSON(res, 200, { success: true, count: myMeetups.length, data: myMeetups });
    }

    // --- STATIC FILE SERVING ---
    let filePath = path.join(ROOT_DIR, pathname === '/' ? 'index.html' : pathname);

    // Prevent directory traversal
    if (!filePath.startsWith(ROOT_DIR)) {
        res.writeHead(403);
        res.end('403 Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            // Fallback to index.html for SPA behavior
            filePath = path.join(ROOT_DIR, 'index.html');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(filePath, (readErr, content) => {
            if (readErr) {
                res.writeHead(500);
                res.end('Server Error');
            } else {
                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Cache-Control': 'no-cache'
                });
                res.end(content, 'utf-8');
            }
        });
    });
});

server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  Dubai Community Kids (LittleDistrict) Server`);
    console.log(`  Running at: http://localhost:${PORT}`);
    console.log(`  Design system: Arabian Sea Teal & Sun Orange`);
    console.log(`====================================================`);
});
