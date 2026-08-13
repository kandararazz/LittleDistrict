// Dubai Community Kids - LittleDistrict App Frontend Logic

if (window.location.protocol === 'file:') {
    window.location.href = 'http://localhost:3000/';
}
const API_BASE = '/api';

// Global Auth & App State
let authToken = localStorage.getItem('ld_auth_token') || '';
let currentTab = 'feed';
let activeDistrict = 'All';
let activeInterest = 'All';
let activeV2Sub = 'uniforms';
let searchQuery = '';
let isSummerMode = true; // Dubai Summer Weather toggle state

let places = [];
let meetups = [];
let myMeetups = [];
let squads = [];
let events = [];
let v2Data = [];
let profile = null;
let currentDetailMeetup = null;
let currentChatRecipient = null;
let favorites = new Set();

// Helper for API calls with Authentication Header
function getAuthHeaders(extraHeaders = {}) {
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    return headers;
}

async function apiFetch(url, options = {}) {
    options.headers = getAuthHeaders(options.headers || {});
    return fetch(url, options);
}

// Auth Check Helper
function requireAuthOr(actionCallback) {
    if (!authToken) {
        window.location.href = '/login.html';
        return;
    }
    actionCallback();
}

function openHostMeetupModal() {
    requireAuthOr(() => {
        const modal = document.getElementById('hostMeetupModal');
        if (modal) modal.classList.remove('hidden');
    });
}

function openAddPlaceModal() {
    requireAuthOr(() => {
        const modal = document.getElementById('addPlaceModal');
        if (modal) modal.classList.remove('hidden');
    });
}

function openCreateSquadModal() {
    requireAuthOr(() => {
        const modal = document.getElementById('createSquadModal');
        if (modal) modal.classList.remove('hidden');
    });
}

// Toast helper
function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    if (!toast || !toastMsg) return;
    toastMsg.textContent = message;
    toast.classList.remove('opacity-0', 'translate-y-[-10px]', 'pointer-events-none');
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-[-10px]', 'pointer-events-none');
    }, 3200);
}

// Update Auth UI in Headers & Sidebar
function updateAuthUI() {
    const navParentName = document.getElementById('navParentName');
    const navDistrict = document.getElementById('navDistrict');
    const openAuthModalBtn = document.getElementById('openAuthModalBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    const desktopAvatar = document.getElementById('desktopUserAvatar');
    const mobileAvatar = document.getElementById('mobileUserAvatar');
    const sidebarSignInText = document.getElementById('sidebarSignInText');
    const sidebarSignInBtn = document.getElementById('sidebarSignInBtn');

    if (profile && profile.id) {
        if (navParentName) navParentName.textContent = profile.name || 'Parent User';
        if (navDistrict) navDistrict.textContent = profile.district || 'Dubai Marina';
        if (openAuthModalBtn) openAuthModalBtn.classList.add('hidden');
        if (signOutBtn) signOutBtn.classList.remove('hidden');
        if (sidebarSignInText) sidebarSignInText.textContent = profile.name || 'My Family Account';
        if (sidebarSignInBtn) sidebarSignInBtn.href = '#profile';

        if (profile.avatar_url) {
            if (desktopAvatar) desktopAvatar.src = profile.avatar_url;
            if (mobileAvatar) mobileAvatar.src = profile.avatar_url;
        }
    } else {
        if (navParentName) navParentName.textContent = 'Sign In';
        if (navDistrict) navDistrict.textContent = 'Connect across devices';
        if (openAuthModalBtn) openAuthModalBtn.classList.remove('hidden');
        if (signOutBtn) signOutBtn.classList.add('hidden');
        if (sidebarSignInText) sidebarSignInText.textContent = 'Sign In to Account';
        if (sidebarSignInBtn) sidebarSignInBtn.href = '/login.html';
    }
}

// --- API FETCHES ---
async function fetchPlaces() {
    try {
        const res = await apiFetch(`${API_BASE}/community/places`);
        const json = await res.json();
        if (json.success) {
            places = json.data;
            renderDistrictChips();
        }
    } catch (err) {
        console.error("Failed to fetch places", err);
    }
}

async function fetchFeed() {
    try {
        const params = new URLSearchParams();
        if (activeDistrict !== 'All') params.append('district', activeDistrict);
        if (activeInterest !== 'All') params.append('interest', activeInterest);
        if (searchQuery.trim()) params.append('search', searchQuery.trim());

        const res = await apiFetch(`${API_BASE}/community/feed?${params.toString()}`);
        const json = await res.json();
        if (json.success) {
            meetups = json.data;
            renderMeetupsGrid();
        }
    } catch (err) {
        console.error("Failed to fetch feed", err);
    }
}

async function fetchMyMeetups() {
    try {
        const res = await apiFetch(`${API_BASE}/my-meetups`);
        const json = await res.json();
        if (json.success) {
            myMeetups = json.data;
            renderMyMeetupsGrid();
        }
    } catch (err) {
        console.error("Failed to fetch my meetups", err);
    }
}

async function fetchSquads() {
    try {
        const params = new URLSearchParams();
        if (activeDistrict !== 'All') params.append('district', activeDistrict);
        const res = await apiFetch(`${API_BASE}/community/squads?${params.toString()}`);
        const json = await res.json();
        if (json.success) {
            squads = json.data;
            renderSquadsGrid();
        }
    } catch (err) {
        console.error("Failed to fetch squads", err);
    }
}

async function fetchEvents() {
    try {
        const params = new URLSearchParams();
        if (activeDistrict !== 'All') params.append('district', activeDistrict);
        const res = await apiFetch(`${API_BASE}/community/events?${params.toString()}`);
        const json = await res.json();
        if (json.success) {
            events = json.data;
            renderEventsGrid();
        }
    } catch (err) {
        console.error("Failed to fetch events", err);
    }
}

async function fetchV2Hub() {
    const container = document.getElementById('v2HubContainer');
    if (!container) return;

    try {
        const params = new URLSearchParams();
        if (activeDistrict !== 'All') params.append('district', activeDistrict);

        if (activeV2Sub === 'uniforms' || activeV2Sub === 'toys') {
            const res = await apiFetch(`${API_BASE}/v2/toys?${params.toString()}`);
            const json = await res.json();
            if (json.success) renderUniformBookSwap(json.data);
        } else if (activeV2Sub === 'lost-found') {
            const res = await apiFetch(`${API_BASE}/v2/lost-found?${params.toString()}`);
            const json = await res.json();
            if (json.success) renderLostFoundBoard(json.data);
        } else if (activeV2Sub === 'discounts') {
            const res = await apiFetch(`${API_BASE}/v2/discounts`);
            const json = await res.json();
            if (json.success) renderVenueDiscounts(json.data);
        } else if (activeV2Sub === 'carpool') {
            const res = await apiFetch(`${API_BASE}/v2/carpools?${params.toString()}`);
            const json = await res.json();
            if (json.success) renderCarpools(json.data);
        } else if (activeV2Sub === 'verification') {
            renderResidentVerification();
        }
    } catch (err) {
        console.error("Failed to fetch V2 Hub data", err);
    }
}

async function fetchProfile() {
    if (!authToken) return;
    try {
        const res = await apiFetch(`${API_BASE}/auth/me`);
        const json = await res.json();
        if (json.success && json.data) {
            profile = json.data;
            updateAuthUI();
            renderProfile();
        }
    } catch (err) {
        console.error("Failed to fetch profile", err);
    }
}

// --- RENDER ROUTINES ---

function updateWeatherWidgetUI() {
    const icon = document.getElementById('weatherIcon');
    const badge = document.getElementById('weatherTempBadge');
    const rec = document.getElementById('weatherRecommendation');
    const btn = document.getElementById('toggleWeatherModeBtn');

    if (!badge || !rec || !btn) return;

    if (isSummerMode) {
        if (icon) icon.innerHTML = `<span class="material-symbols-outlined text-3xl">wb_sunny</span>`;
        badge.className = 'bg-amber-600 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full';
        badge.textContent = '41°C Summer Heat';
        rec.textContent = '☀️ Summer Indoor Recommendation: Trampoline Parks, Indoor Soft Play & Air-Conditioned Clubs';
        btn.textContent = 'Switch to Cooler Season (24°C)';
    } else {
        if (icon) icon.innerHTML = `<span class="material-symbols-outlined text-3xl text-emerald-700">filter_hdr</span>`;
        badge.className = 'bg-emerald-600 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full';
        badge.textContent = '24°C Outdoor Season';
        rec.textContent = '⛅ Outdoor Weather Recommendation: Community Parks, Beach Playgrounds & Outdoor Courts';
        btn.textContent = 'Switch to Summer Heat (41°C)';
    }
}

function renderDistrictChips() {
    const container = document.getElementById('districtFilterContainer');
    if (!container) return;

    const customDistricts = Array.from(new Set(places.map(p => p.district)));
    const defaultDistricts = ['Dubai Hills', 'Arabian Ranches', 'JBR', 'Mirdif', 'Silicon Oasis', 'Downtown Dubai', 'Palm Jumeirah'];
    const allDistricts = Array.from(new Set([...defaultDistricts, ...customDistricts]));

    let html = `
        <button data-district="All" class="district-chip shrink-0 ${activeDistrict === 'All' ? 'bg-secondary-container text-on-secondary-container shadow-sm border border-transparent font-semibold' : 'bg-surface-container-lowest text-on-surface border border-outline-variant hover:bg-surface-container'} px-4 py-1.5 rounded-full text-xs transition-colors">
            All (${allDistricts.length} Neighborhoods)
        </button>
    `;

    allDistricts.forEach(dist => {
        const placeCount = places.filter(p => p.district === dist).length;
        const countBadge = placeCount > 0 ? ` (${placeCount} spots)` : '';
        const isActive = activeDistrict === dist;
        html += `
            <button data-district="${dist}" class="district-chip shrink-0 ${isActive ? 'bg-secondary-container text-on-secondary-container shadow-sm border border-transparent font-semibold' : 'bg-surface-container-lowest text-on-surface border border-outline-variant hover:bg-surface-container'} px-4 py-1.5 rounded-full text-xs transition-colors">
                ${dist}${countBadge}
            </button>
        `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.district-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            activeDistrict = btn.getAttribute('data-district');
            renderDistrictChips();
            fetchFeed();
            fetchSquads();
            fetchEvents();
            fetchV2Hub();
        });
    });
}

function renderMeetupsGrid() {
    const grid = document.getElementById('meetupsGrid');
    const emptyState = document.getElementById('emptyFeedState');
    const countBadge = document.getElementById('meetupCountBadge');
    if (!grid) return;

    if (countBadge) countBadge.textContent = `${meetups.length} meetup${meetups.length === 1 ? '' : 's'}`;

    if (meetups.length === 0) {
        grid.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    grid.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');

    grid.innerHTML = meetups.map(m => {
        const isFav = favorites.has(m.id);
        const isAttending = profile && m.attendees && m.attendees.includes(profile.id);
        const isFull = m.attendees_count >= m.max_attendees;

        return `
            <div class="bg-surface-container-lowest rounded-2xl overflow-hidden card-shadow card-shadow-hover relative flex flex-col cursor-pointer border border-outline-variant/30" data-id="${m.id}">
                <div class="h-48 relative overflow-hidden">
                    <img class="w-full h-full object-cover transition-transform duration-500 hover:scale-105" src="${m.image_url || '/assets/football.png'}" alt="${m.title}">
                    <button class="fav-btn absolute top-3 right-3 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur transition-all" data-fav-id="${m.id}">
                        <span class="material-symbols-outlined text-lg ${isFav ? 'text-secondary' : 'text-white'}" style="${isFav ? "font-variation-settings: 'FILL' 1;" : ''}">favorite</span>
                    </button>
                    <div class="absolute bottom-3 left-3 bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                        <span>${m.interest_tag}</span>
                        ${isSummerMode && (m.interest_tag === 'Board Games' || m.interest_tag === 'Roblox' || m.interest_tag === 'Swimming') ? '<span class="bg-amber-700 text-white text-[9px] px-1.5 py-0.2 rounded">Indoor Spot</span>' : ''}
                    </div>
                </div>

                <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div class="space-y-2">
                        <div class="flex items-center gap-1.5 text-xs font-semibold text-primary">
                            <span class="material-symbols-outlined text-sm">location_on</span>
                            <span>${m.district} • ${m.public_location}</span>
                        </div>
                        <h3 class="font-display font-bold text-lg text-on-surface line-clamp-1">${m.title}</h3>
                    </div>

                    <div class="space-y-3 pt-2 border-t border-outline-variant/30 text-xs">
                        ${m.allergy_summary && m.allergy_summary.length > 0 ? `
                            <div class="bg-amber-50 border border-amber-200/80 text-amber-900 rounded-xl p-2 text-[11px] font-semibold flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-sm text-amber-700">warning</span>
                                <span>Snack Safety: ${m.allergy_summary.join(' • ')}</span>
                            </div>
                        ` : ''}

                        <div class="flex items-center justify-between text-on-surface-variant font-medium">
                            <span class="flex items-center gap-1">
                                <span class="material-symbols-outlined text-sm text-primary">child_care</span>
                                Ages ${m.min_age}-${m.max_age} yrs
                            </span>
                            <span class="flex items-center gap-1">
                                <span class="material-symbols-outlined text-sm text-primary">schedule</span>
                                ${new Date(m.date_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>

                        <div class="flex items-center justify-between pt-1">
                            <div class="flex items-center gap-2">
                                <img class="w-7 h-7 rounded-full object-cover border border-outline-variant" src="${m.host_avatar || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><rect width=\'100\' height=\'100\' fill=\'%23eef5f7\'/><circle cx=\'50\' cy=\'38\' r=\'20\' fill=\'%23006565\'/><path d=\'M20 90 c0-25 15-35 30-35 s30 10 30 35 Z\' fill=\'%23006565\'/></svg>'}" alt="${m.host_name}">
                                <div class="flex items-center gap-1">
                                    <span class="text-xs font-medium text-on-surface line-clamp-1">Host: ${m.host_name}</span>
                                    <span class="material-symbols-outlined text-xs text-emerald-600" title="Verified Resident">verified_user</span>
                                </div>
                            </div>

                            <span class="px-2.5 py-1 rounded-full text-xs font-bold ${isAttending ? 'bg-primary-container text-on-primary-container' : isFull ? 'bg-surface-container-high text-on-surface-variant' : 'bg-surface-container-high text-on-surface'}">
                                ${isAttending ? '✓ Joined' : isFull ? 'Full' : `${m.attendees_count}/${m.max_attendees} Joined`}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    grid.querySelectorAll('[data-id]').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.fav-btn')) return;
            const id = card.getAttribute('data-id');
            const m = meetups.find(item => item.id === id);
            if (m) openDetailModal(m);
        });
    });

    grid.querySelectorAll('.fav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-fav-id');
            if (favorites.has(id)) {
                favorites.delete(id);
                showToast("Removed from favorites.");
            } else {
                favorites.add(id);
                showToast("Added to saved meetups!");
            }
            renderMeetupsGrid();
        });
    });
}

function renderSquadsGrid() {
    const grid = document.getElementById('squadsGrid');
    if (!grid) return;

    if (squads.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-xs text-on-surface-variant italic">No activity squads in this district yet. Be the first parent to start one!</div>`;
        return;
    }

    grid.innerHTML = squads.map(sq => `
        <div class="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/40 shadow-sm flex flex-col justify-between space-y-4">
            <div class="space-y-2">
                <div class="flex justify-between items-center">
                    <span class="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">${sq.category}</span>
                    <span class="text-xs font-semibold text-on-surface-variant flex items-center gap-1">
                        <span class="material-symbols-outlined text-sm">group</span>
                        ${sq.members_count || 1} members
                    </span>
                </div>
                <h4 class="font-display font-bold text-lg text-on-surface">${sq.name}</h4>
                <p class="text-xs text-on-surface-variant leading-relaxed">${sq.description}</p>
            </div>
            <div class="flex items-center justify-between pt-3 border-t border-outline-variant/30 text-xs">
                <span class="text-outline font-medium flex items-center gap-1">
                    <span class="material-symbols-outlined text-sm">location_on</span>
                    ${sq.district}
                </span>
                <button class="join-squad-btn bg-secondary-container text-on-secondary-container font-bold px-4 py-2 rounded-xl hover:bg-secondary-container/90 transition-all shadow-sm">
                    Join Squad
                </button>
            </div>
        </div>
    `).join('');

    grid.querySelectorAll('.join-squad-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            requireAuthOr(() => showToast("Joined Activity Squad! You'll receive squad notifications."));
        });
    });
}

function renderEventsGrid() {
    const grid = document.getElementById('eventsGrid');
    if (!grid) return;

    if (events.length === 0) {
        grid.innerHTML = `<div class="py-12 text-center text-xs text-on-surface-variant italic">No upcoming calendar events for this district.</div>`;
        return;
    }

    grid.innerHTML = events.map(ev => `
        <div class="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/40 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div class="flex items-start gap-4">
                <div class="w-14 h-14 rounded-2xl bg-secondary-container text-on-secondary-container flex flex-col items-center justify-center shrink-0">
                    <span class="text-xs font-bold uppercase">${new Date(ev.event_date || Date.now()).toLocaleDateString('en-US', { month: 'short' })}</span>
                    <span class="text-lg font-extrabold">${new Date(ev.event_date || Date.now()).getDate()}</span>
                </div>
                <div class="space-y-1">
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">${ev.category}</span>
                        <span class="text-xs text-on-surface-variant font-medium">${ev.district}</span>
                    </div>
                    <h4 class="font-display font-bold text-base text-on-surface">${ev.title}</h4>
                    <p class="text-xs text-on-surface-variant">${ev.description}</p>
                    <p class="text-xs font-semibold text-primary flex items-center gap-1 pt-1">
                        <span class="material-symbols-outlined text-sm">location_on</span>
                        ${ev.location}
                    </p>
                </div>
            </div>
            <button class="bg-primary text-white font-bold text-xs px-5 py-2.5 rounded-xl hover:bg-primary/90 transition-all shadow-sm shrink-0">
                Add to Calendar
            </button>
        </div>
    `).join('');
}

function renderPlacesGrid() {
    const grid = document.getElementById('placesGrid');
    const emptyState = document.getElementById('emptyPlacesState');
    const badge = document.getElementById('placesCountBadge');
    if (!grid) return;

    let filtered = places;
    if (activeDistrict && activeDistrict !== 'All') {
        filtered = places.filter(p => p.district.toLowerCase() === activeDistrict.toLowerCase());
    }

    if (badge) badge.textContent = `${filtered.length} spot${filtered.length === 1 ? '' : 's'}`;

    if (filtered.length === 0) {
        grid.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    grid.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');

    grid.innerHTML = filtered.map(p => {
        const amenitiesList = (p.amenities || 'Playground, Shaded Seating, Restrooms')
            .split(',')
            .map(a => a.trim())
            .filter(Boolean);

        const typeColorMap = {
            'Park': 'bg-emerald-600 text-white',
            'Playground': 'bg-teal-600 text-white',
            'Clubhouse': 'bg-purple-600 text-white',
            'Beach': 'bg-cyan-600 text-white',
            'Pool': 'bg-blue-600 text-white',
            'Sports Court': 'bg-amber-600 text-white'
        };
        const badgeStyle = typeColorMap[p.public_spot_type] || 'bg-primary text-white';

        return `
            <div class="bg-surface-container-lowest rounded-2xl overflow-hidden card-shadow card-shadow-hover relative flex flex-col border border-outline-variant/30">
                <div class="h-44 relative overflow-hidden">
                    <img class="w-full h-full object-cover transition-transform duration-500 hover:scale-105" src="${p.image_url || 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=600'}" alt="${p.name}">
                    <div class="absolute top-3 left-3 ${badgeStyle} px-3 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                        <span class="material-symbols-outlined text-sm">park</span>
                        <span>${p.public_spot_type}</span>
                    </div>
                    <div class="absolute top-3 right-3 bg-black/60 text-white px-2.5 py-0.5 rounded-full text-[11px] font-semibold backdrop-blur">
                        ${p.district}
                    </div>
                </div>

                <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div class="space-y-2">
                        <h3 class="font-display font-bold text-lg text-on-surface line-clamp-1">${p.name}</h3>
                        <p class="text-xs text-on-surface-variant line-clamp-2">${p.description || 'Public neighborhood community spot for family playdates.'}</p>
                    </div>

                    <div class="space-y-3 pt-2 border-t border-outline-variant/30">
                        <div class="flex flex-wrap gap-1">
                            ${amenitiesList.map(am => `
                                <span class="bg-surface-container text-on-surface-variant text-[10px] font-medium px-2 py-0.5 rounded-md border border-outline-variant/20">✓ ${am}</span>
                            `).join('')}
                        </div>

                        <div class="flex items-center gap-2 pt-1">
                            <button class="host-here-btn flex-1 bg-primary text-white font-bold text-xs py-2.5 rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-1 shadow-sm" data-place-name="${p.name}" data-place-district="${p.district}">
                                <span class="material-symbols-outlined text-sm">add_circle</span>
                                Host Meetup Here
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    grid.querySelectorAll('.host-here-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const placeName = btn.getAttribute('data-place-name');
            const placeDistrict = btn.getAttribute('data-place-district');
            openHostMeetupModal();
            const locationInput = document.getElementById('meetupLocationInput');
            const districtInput = document.getElementById('meetupDistrictInput');
            if (locationInput) locationInput.value = placeName;
            if (districtInput) districtInput.value = placeDistrict;
        });
    });

    document.getElementById('placesAddBtn')?.addEventListener('click', openAddPlaceModal);
    document.getElementById('emptyPlacesAddBtn')?.addEventListener('click', openAddPlaceModal);
}

function renderUniformBookSwap(items) {
    const container = document.getElementById('v2HubContainer');
    if (!container) return;

    let itemsHtml = items.map(item => `
        <div class="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/40 shadow-sm flex flex-col justify-between space-y-3">
            <div class="relative h-40 overflow-hidden rounded-xl">
                <img src="${item.image_url}" class="w-full h-full object-cover">
                <span class="absolute top-2 left-2 bg-primary text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-sm">${item.school_name || 'General'}</span>
                <span class="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur">${item.swap_type}</span>
            </div>
            <div class="space-y-1.5">
                <div class="flex justify-between items-center text-xs">
                    <span class="font-bold text-secondary bg-secondary-container/40 px-2 py-0.5 rounded-md">${item.category}</span>
                    <span class="text-on-surface-variant font-medium">${item.grade_level || 'All Ages'}</span>
                </div>
                <h4 class="font-display font-bold text-sm text-on-surface line-clamp-2">${item.title}</h4>
                <div class="flex items-center justify-between text-xs text-on-surface-variant pt-1 border-t border-outline-variant/30">
                    <span class="flex items-center gap-1">
                        <span class="material-symbols-outlined text-sm text-emerald-600">verified_user</span>
                        ${item.user_name}
                    </span>
                    <span class="text-outline">${item.district}</span>
                </div>
            </div>
            <button class="w-full bg-primary text-white font-bold text-xs py-2.5 rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-1">
                <span class="material-symbols-outlined text-sm">chat</span>
                Message Parent for Swap
            </button>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="space-y-4">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-surface-container-low/70 p-4 rounded-2xl border border-outline-variant/30">
                <div>
                    <h4 class="font-display font-bold text-base text-on-surface flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary text-xl">checkroom</span>
                        School Uniform & Grade-Level Book Swap
                    </h4>
                    <p class="text-xs text-on-surface-variant">Donate or swap uniforms (DESC, DC, Horizon, GEMS) & readers within your compound</p>
                </div>
                <button id="listUniformBtn" class="bg-primary text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-primary/90 shadow-sm flex items-center gap-1 shrink-0">
                    <span class="material-symbols-outlined text-base">add</span>
                    + List Uniform / Book
                </button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                ${itemsHtml}
            </div>
        </div>
    `;

    document.getElementById('listUniformBtn')?.addEventListener('click', () => {
        requireAuthOr(() => {
            const modal = document.getElementById('listUniformBookModal');
            if (modal) modal.classList.remove('hidden');
        });
    });
}

function renderLostFoundBoard(items) {
    const container = document.getElementById('v2HubContainer');
    if (!container) return;

    let itemsHtml = items.map(item => {
        const isLost = item.status === 'Lost';
        return `
            <div class="bg-surface-container-lowest p-4 rounded-2xl border ${isLost ? 'border-amber-300' : 'border-emerald-300'} shadow-sm flex flex-col justify-between space-y-3">
                <div class="relative h-36 overflow-hidden rounded-xl">
                    <img src="${item.image_url}" class="w-full h-full object-cover">
                    <span class="absolute top-2 left-2 ${isLost ? 'bg-amber-600' : 'bg-emerald-600'} text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-sm">${item.status.toUpperCase()}</span>
                    <span class="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur">${item.category}</span>
                </div>
                <div class="space-y-1.5">
                    <h4 class="font-display font-bold text-sm text-on-surface line-clamp-1">${item.title}</h4>
                    <p class="text-xs text-on-surface-variant flex items-center gap-1">
                        <span class="material-symbols-outlined text-sm text-amber-700">near_me</span>
                        <span>${item.location_detail}</span>
                    </p>
                    <div class="flex items-center justify-between text-xs text-on-surface-variant pt-1 border-t border-outline-variant/30">
                        <span class="font-medium text-on-surface">Reported by: ${item.reported_by}</span>
                        <span class="text-outline">${item.district}</span>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button class="contact-lost-btn flex-1 bg-surface-container border border-outline text-on-surface font-bold text-xs py-2 rounded-xl hover:bg-surface-container-high transition-all">
                        Contact Resident
                    </button>
                    ${isLost ? `
                        <button class="mark-found-btn bg-emerald-600 text-white font-bold text-xs px-3 py-2 rounded-xl hover:bg-emerald-700 transition-all" data-id="${item.id}">
                            Mark Found
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="space-y-4">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-amber-50 border border-amber-200 p-4 rounded-2xl">
                <div>
                    <h4 class="font-display font-bold text-base text-amber-950 flex items-center gap-2">
                        <span class="material-symbols-outlined text-amber-700 text-xl">search_hands_free</span>
                        Lost & Found Pet / Item Board
                    </h4>
                    <p class="text-xs text-amber-900/90">Instant alert board for lost scooters, bikes, plush toys, or pets dropped along walking paths</p>
                </div>
                <button id="reportLostBtn" class="bg-amber-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-amber-700 shadow-sm flex items-center gap-1 shrink-0">
                    <span class="material-symbols-outlined text-base">add_alert</span>
                    + Report Lost Item / Pet
                </button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                ${itemsHtml}
            </div>
        </div>
    `;

    document.getElementById('reportLostBtn')?.addEventListener('click', () => {
        requireAuthOr(() => {
            const modal = document.getElementById('reportLostModal');
            if (modal) modal.classList.remove('hidden');
        });
    });

    container.querySelectorAll('.mark-found-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            try {
                await apiFetch(`${API_BASE}/v2/lost-found/${id}/found`, { method: 'POST' });
                showToast("Item marked as Found!");
                fetchV2Hub();
            } catch (e) {}
        });
    });
}

function renderVenueDiscounts(discounts) {
    const container = document.getElementById('v2HubContainer');
    if (!container) return;

    let html = discounts.map(d => `
        <div class="bg-surface-container-lowest p-5 rounded-2xl border border-secondary/30 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div class="space-y-1">
                <span class="text-[10px] font-extrabold bg-secondary-container text-on-secondary-container px-2.5 py-0.5 rounded-full">${d.category}</span>
                <h4 class="font-display font-bold text-lg text-on-surface">${d.venue_name}</h4>
                <p class="text-sm font-bold text-secondary">${d.discount_title}</p>
                <p class="text-xs text-on-surface-variant">Location: ${d.district} • Valid until ${d.valid_until}</p>
            </div>
            <div class="flex items-center gap-3">
                <div class="bg-slate-100 border border-dashed border-slate-300 px-4 py-2 rounded-xl text-xs font-mono font-bold text-slate-800">
                    ${d.promo_code}
                </div>
                <button class="bg-primary text-white font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-all shadow-sm" onclick="alert('Voucher Code Copied: ${d.promo_code}')">
                    Claim Discount
                </button>
            </div>
        </div>
    `).join('');

    container.innerHTML = `<div class="space-y-4"><h4 class="font-display font-bold text-base text-on-surface">Verified Local Dubai Partner Discounts</h4><div class="space-y-3">${html}</div></div>`;
}

function renderCarpools(rides) {
    const container = document.getElementById('v2HubContainer');
    if (!container) return;

    let html = rides.map(r => `
        <div class="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/40 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div class="space-y-1">
                <div class="flex items-center gap-2">
                    <span class="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">${r.district}</span>
                    <span class="text-xs text-on-surface-variant">${r.available_seats} booster seats open</span>
                </div>
                <h4 class="font-display font-bold text-base text-on-surface">Destination: ${r.destination}</h4>
                <p class="text-xs text-on-surface-variant">Parent Driver: ${r.parent_name} • Schedule: ${r.ride_date}</p>
                <p class="text-xs italic text-outline">${r.notes}</p>
            </div>
            <button class="bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl hover:bg-emerald-800 transition-all shadow-sm">
                Request Ride Share
            </button>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="space-y-4">
            <div class="flex justify-between items-center">
                <h4 class="font-display font-bold text-base text-on-surface">Parent-to-Parent Carpool Coordination</h4>
                <button id="addCarpoolBtn" class="bg-primary text-white text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-primary/90">+ Post Carpool Ride</button>
            </div>
            <div class="space-y-3">${html}</div>
        </div>
    `;

    document.getElementById('addCarpoolBtn')?.addEventListener('click', () => {
        requireAuthOr(() => {
            const dest = prompt("Enter Destination (e.g. Football Academy Sports City):");
            if (!dest) return;
            showToast("Carpool ride posted to neighborhood network!");
            fetchV2Hub();
        });
    });
}

function renderResidentVerification() {
    const container = document.getElementById('v2HubContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="bg-surface-container-lowest p-6 rounded-2xl border border-emerald-200 shadow-sm space-y-4 max-w-xl">
            <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-2xl font-bold">
                    <span class="material-symbols-outlined text-3xl">verified_user</span>
                </div>
                <div>
                    <h4 class="font-display font-bold text-lg text-on-surface">Optional Verified Resident Badge</h4>
                    <p class="text-xs text-on-surface-variant">Verify your community address via UAE Pass or Ejari to earn a Verified Resident badge and boost trust among neighbors.</p>
                </div>
            </div>
            <div class="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-xs text-emerald-900 space-y-2">
                <p class="font-bold flex items-center gap-1"><span class="material-symbols-outlined text-base">shield</span> Privacy Guaranteed</p>
                <p>Your full address is never published or shared. Only a verified checkmark badge will be attached to your parent profile.</p>
            </div>
            <button id="verifyResidentBtn" class="w-full bg-emerald-700 text-white font-bold text-xs py-3 rounded-xl hover:bg-emerald-800 transition-all shadow-sm">
                Verify Address with UAE Pass / Ejari
            </button>
        </div>
    `;

    document.getElementById('verifyResidentBtn')?.addEventListener('click', () => {
        requireAuthOr(() => {
            showToast("🎉 Verified Resident status confirmed via UAE Pass!");
            if (profile) profile.verified = true;
        });
    });
}

function renderMyMeetupsGrid() {
    const grid = document.getElementById('myMeetupsGrid');
    if (!grid) return;

    if (myMeetups.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-xs text-on-surface-variant italic">No active meetups or RSVPs yet. Browse the Feed to join!</div>`;
        return;
    }

    grid.innerHTML = myMeetups.map(m => `
        <div class="bg-surface-container-lowest rounded-2xl overflow-hidden card-shadow p-5 border border-outline-variant/30 flex justify-between items-center cursor-pointer" data-id="${m.id}">
            <div class="flex items-center gap-4">
                <img class="w-16 h-16 rounded-xl object-cover" src="${m.image_url || '/assets/football.png'}">
                <div class="space-y-1">
                    <span class="text-xs font-bold text-secondary uppercase tracking-wider">${m.interest_tag}</span>
                    <h4 class="font-display font-bold text-base text-on-surface">${m.title}</h4>
                    <p class="text-xs text-on-surface-variant flex items-center gap-1">
                        <span class="material-symbols-outlined text-sm text-primary">location_on</span>
                        ${m.public_location} (${m.district})
                    </p>
                </div>
            </div>
            <button class="bg-surface-container hover:bg-surface-container-high text-on-surface px-4 py-2 rounded-xl text-xs font-bold transition-colors">
                View Details
            </button>
        </div>
    `).join('');

    grid.querySelectorAll('[data-id]').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.getAttribute('data-id');
            const m = myMeetups.find(item => item.id === id);
            if (m) openDetailModal(m);
        });
    });
}

function renderProfile() {
    if (!profile) return;
    const pName = document.getElementById('profileParentName');
    const pBadge = document.getElementById('profileDistrictBadge');
    if (pName) pName.textContent = profile.name || 'Parent User';
    if (pBadge) pBadge.textContent = `${profile.district || 'Dubai Hills'} Resident`;

    if (profile.avatar_url) {
        const avatar = document.getElementById('profileAvatar');
        if (avatar) avatar.src = profile.avatar_url;
    }

    const editName = document.getElementById('editParentName');
    const editDistrict = document.getElementById('editDistrict');
    const editContact = document.getElementById('editContactPref');
    const editBio = document.getElementById('editBio');

    if (editName) editName.value = profile.name || '';
    if (editDistrict) editDistrict.value = profile.district || 'Dubai Hills';
    if (editContact) editContact.value = profile.contact_preference || 'In-App Message';
    if (editBio) editBio.value = profile.bio || '';

    renderChildrenList();
}

function renderChildrenList() {
    const listContainer = document.getElementById('childrenContainer');
    if (!listContainer || !profile) return;

    const children = profile.children || [];
    if (children.length === 0) {
        listContainer.innerHTML = `
            <div class="bg-emerald-50/70 border border-emerald-100 p-4 rounded-xl space-y-1">
                <p class="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-base">shield_person</span>
                    Child Privacy-First Shield Active
                </p>
                <p class="text-[11px] text-emerald-800">Only nickname, age group, and interest badges will be shown. Full names & personal contact info are strictly hidden.</p>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = children.map(c => {
        const ageGroup = c.age <= 3 ? '0-3 Toddler' : c.age <= 7 ? '4-7 Young Kid' : c.age <= 12 ? '8-12 Tween' : '13+ Teen';
        return `
            <div class="bg-surface-container-low p-4 rounded-xl border border-outline-variant/40 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-primary/10 text-primary font-display font-bold flex items-center justify-center text-sm">
                        ${c.nickname ? c.nickname.charAt(0).toUpperCase() : 'K'}
                    </div>
                    <div>
                        <h5 class="font-bold text-sm text-on-surface">${c.nickname} <span class="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full ml-1">${ageGroup}</span></h5>
                        <p class="text-xs text-on-surface-variant flex flex-wrap gap-1 mt-1">
                            ${(c.hobbies || []).map(h => `<span class="bg-surface-container-lowest border border-outline-variant px-2 py-0.5 rounded-md text-[10px] font-semibold text-primary">${h}</span>`).join('')}
                        </p>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function openDetailModal(meetup) {
    currentDetailMeetup = meetup;
    const modal = document.getElementById('meetupDetailModal');
    if (!modal) return;

    document.getElementById('detailTitle').textContent = meetup.title;
    document.getElementById('detailLocation').textContent = `${meetup.public_location} (${meetup.district})`;
    document.getElementById('detailTag').textContent = meetup.interest_tag;
    document.getElementById('detailImage').src = meetup.image_url || '/assets/football.png';
    document.getElementById('detailAge').textContent = `Ages ${meetup.min_age}-${meetup.max_age}`;
    document.getElementById('detailTime').textContent = new Date(meetup.date_time).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    document.getElementById('detailAttendeesCount').textContent = `${meetup.attendees_count || 0} attending`;
    document.getElementById('detailHostName').textContent = meetup.host_name || 'Parent';
    if (meetup.host_avatar) {
        document.getElementById('detailHostAvatar').src = meetup.host_avatar;
    }

    const isAttending = profile && meetup.attendees && meetup.attendees.includes(profile.id);
    const isHost = profile && meetup.host_id === profile.id;
    const rsvpBtn = document.getElementById('detailRsvpBtn');
    if (rsvpBtn) {
        rsvpBtn.textContent = isAttending ? '✓ Cancel RSVP' : 'RSVP / Join';
        rsvpBtn.className = isAttending 
            ? 'bg-outline-variant text-on-surface font-bold text-xs px-6 py-2.5 rounded-xl hover:bg-outline-variant/80 transition-all shadow-sm'
            : 'bg-primary text-white font-bold text-xs px-6 py-2.5 rounded-xl hover:bg-primary/90 transition-all shadow-sm';
    }

    // Double-Opt-In Direct Chat button visibility
    const directChatBtn = document.getElementById('openDirectChatBtn');
    if (directChatBtn) {
        // Direct chat is unlocked if user is host and there are attendees, or if user is an attendee and host is present
        if (profile && (isAttending || isHost)) {
            directChatBtn.classList.remove('hidden');
            currentChatRecipient = isHost ? { id: meetup.attendees[0] || 'user_2', name: 'Confirmed Parent' } : { id: meetup.host_id, name: meetup.host_name };
        } else {
            directChatBtn.classList.add('hidden');
        }
    }

    renderComments(meetup.comments || []);
    modal.classList.remove('hidden');
}

function renderComments(comments) {
    const list = document.getElementById('detailCommentsList');
    if (!list) return;

    if (!comments || comments.length === 0) {
        list.innerHTML = `<p class="text-xs text-on-surface-variant italic py-2">No public questions yet. Be the first parent to ask!</p>`;
        return;
    }

    list.innerHTML = comments.map(c => `
        <div class="bg-surface p-3 rounded-xl border border-outline-variant/30 flex gap-3">
            <img class="w-7 h-7 rounded-full object-cover border border-outline-variant" src="${c.user_avatar || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><rect width=\'100\' height=\'100\' fill=\'%23eef5f7\'/><circle cx=\'50\' cy=\'38\' r=\'20\' fill=\'%23006565\'/><path d=\'M20 90 c0-25 15-35 30-35 s30 10 30 35 Z\' fill=\'%23006565\'/></svg>'}">
            <div class="flex-1 space-y-0.5">
                <div class="flex justify-between items-center">
                    <span class="font-bold text-xs text-on-surface">${c.user_name}</span>
                    <span class="text-[10px] text-outline">${new Date(c.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p class="text-xs text-on-surface-variant">${c.content}</p>
            </div>
        </div>
    `).join('');
}

// Direct Chat Drawer Logic
async function openDirectChatModal() {
    if (!authToken || !profile) {
        window.location.href = '/login.html';
        return;
    }
    if (!currentDetailMeetup || !currentChatRecipient) return;

    const modal = document.getElementById('directChatModal');
    const recipientSub = document.getElementById('chatRecipientSub');
    if (recipientSub) recipientSub.textContent = `Private messaging with ${currentChatRecipient.name} (Meetup: ${currentDetailMeetup.title})`;

    await fetchDirectMessages();
    if (modal) modal.classList.remove('hidden');
}

async function fetchDirectMessages() {
    if (!currentDetailMeetup || !currentChatRecipient) return;
    try {
        const res = await apiFetch(`${API_BASE}/chat/direct?meetupId=${currentDetailMeetup.id}&recipientId=${currentChatRecipient.id}`);
        const json = await res.json();
        const container = document.getElementById('directChatMessages');
        if (!container) return;

        if (!json.allowed) {
            container.innerHTML = `<div class="p-4 bg-red-50 text-red-700 rounded-xl text-xs font-semibold text-center">${json.reason}</div>`;
            return;
        }

        const msgs = json.messages || [];
        if (msgs.length === 0) {
            container.innerHTML = `<p class="text-xs text-on-surface-variant italic text-center py-8">Double-Opt-In Chat Unlocked! Say hi to your fellow parent.</p>`;
            return;
        }

        container.innerHTML = msgs.map(m => {
            const isMe = m.sender_id === profile.id;
            return `
                <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
                    <div class="max-w-[80%] px-3.5 py-2 rounded-2xl text-xs ${isMe ? 'bg-emerald-700 text-white rounded-br-none' : 'bg-surface-container-lowest text-on-surface border border-outline-variant/40 rounded-bl-none'}">
                        <p>${m.content}</p>
                    </div>
                    <span class="text-[9px] text-outline px-1 mt-0.5">${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            `;
        }).join('');
        container.scrollTop = container.scrollHeight;
    } catch (err) {
        console.error("Failed to fetch direct messages", err);
    }
}

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
    fetchPlaces();
    fetchFeed();
    fetchSquads();
    fetchEvents();
    if (authToken) fetchProfile();
    updateAuthUI();
    updateWeatherWidgetUI();

    // Weather Toggle Listener
    document.getElementById('toggleWeatherModeBtn')?.addEventListener('click', () => {
        isSummerMode = !isSummerMode;
        updateWeatherWidgetUI();
        renderMeetupsGrid();
        showToast(isSummerMode ? "Switched to Summer Season recommendations." : "Switched to Outdoor Season recommendations.");
    });

    // Action Triggers
    document.getElementById('sidebarHostBtn')?.addEventListener('click', openHostMeetupModal);
    document.getElementById('sidebarAddPlaceBtn')?.addEventListener('click', openAddPlaceModal);
    document.getElementById('mobileAddPlaceBtn')?.addEventListener('click', openAddPlaceModal);
    document.getElementById('mobileHostFab')?.addEventListener('click', openHostMeetupModal);
    document.getElementById('addPlaceChipBtn')?.addEventListener('click', openAddPlaceModal);
    document.getElementById('emptyAddPlaceBtn')?.addEventListener('click', openAddPlaceModal);
    document.getElementById('emptyHostBtn')?.addEventListener('click', openHostMeetupModal);
    document.getElementById('createSquadBtn')?.addEventListener('click', openCreateSquadModal);

    // Direct Chat Trigger
    document.getElementById('openDirectChatBtn')?.addEventListener('click', openDirectChatModal);

    // Tab Navigation
    const navButtons = document.querySelectorAll('.nav-tab, .mobile-nav-btn[data-tab]');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            if (!targetTab) return;

            if (targetTab === 'places') {
                currentTab = 'places';
                document.querySelectorAll('.nav-tab').forEach(b => {
                    const isTarget = b.getAttribute('data-tab') === 'places';
                    b.className = isTarget 
                        ? 'nav-tab w-full flex items-center gap-3 bg-secondary-container text-on-secondary-container rounded-xl px-4 py-2.5 font-semibold text-sm transition-all shadow-sm'
                        : 'nav-tab w-full flex items-center gap-3 text-on-surface-variant hover:bg-surface-container rounded-xl px-4 py-2.5 font-medium text-sm transition-colors';
                });
                document.querySelectorAll('.tab-content').forEach(sec => sec.classList.add('hidden'));
                const activeSec = document.getElementById('tab-places');
                if (activeSec) activeSec.classList.remove('hidden');
                document.getElementById('pageTitle').textContent = 'Neighborhood Places Explorer';
                fetchPlaces();
                return;
            }
            if (targetTab === 'create-meetup') {
                openHostMeetupModal();
                return;
            }
            if ((targetTab === 'my-meetups' || targetTab === 'profile') && !authToken) {
                window.location.href = '/login.html';
                return;
            }

            currentTab = targetTab;

            document.querySelectorAll('.nav-tab').forEach(b => {
                const isTarget = b.getAttribute('data-tab') === targetTab;
                b.className = isTarget 
                    ? 'nav-tab w-full flex items-center gap-3 bg-secondary-container text-on-secondary-container rounded-xl px-4 py-2.5 font-semibold text-sm transition-all shadow-sm'
                    : 'nav-tab w-full flex items-center gap-3 text-on-surface-variant hover:bg-surface-container rounded-xl px-4 py-2.5 font-medium text-sm transition-colors';
            });

            document.querySelectorAll('.mobile-nav-btn[data-tab]').forEach(b => {
                const isTarget = b.getAttribute('data-tab') === targetTab;
                b.className = isTarget 
                    ? 'mobile-nav-btn flex flex-col items-center justify-center text-primary font-bold'
                    : 'mobile-nav-btn flex flex-col items-center justify-center text-on-surface-variant hover:text-primary';
            });

            document.querySelectorAll('.tab-content').forEach(sec => sec.classList.add('hidden'));
            const activeSec = document.getElementById(`tab-${targetTab}`);
            if (activeSec) activeSec.classList.remove('hidden');

            if (targetTab === 'feed') fetchFeed();
            if (targetTab === 'places') fetchPlaces();
            if (targetTab === 'squads') fetchSquads();
            if (targetTab === 'calendar') fetchEvents();
            if (targetTab === 'v2-hub') fetchV2Hub();
            if (targetTab === 'my-meetups') fetchMyMeetups();
            if (targetTab === 'profile') fetchProfile();
        });
    });

    // V2 Sub-tab Navigation
    document.querySelectorAll('.v2-sub-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            activeV2Sub = btn.getAttribute('data-v2-sub');
            document.querySelectorAll('.v2-sub-tab').forEach(b => {
                const isTarget = b.getAttribute('data-v2-sub') === activeV2Sub;
                b.className = isTarget
                    ? 'v2-sub-tab px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white shadow-sm flex items-center gap-1.5 shrink-0'
                    : 'v2-sub-tab px-4 py-2 rounded-xl text-xs font-medium bg-surface-container-lowest text-on-surface hover:bg-surface-container flex items-center gap-1.5 shrink-0 border border-outline-variant';
            });
            fetchV2Hub();
        });
    });

    // Auth Handlers
    const openAuthModalBtn = document.getElementById('openAuthModalBtn');
    const signOutBtn = document.getElementById('signOutBtn');

    openAuthModalBtn?.addEventListener('click', (e) => {
        if (!authToken) {
            e.preventDefault();
            window.location.href = '/login.html';
        }
    });

    document.getElementById('desktopUserAvatar')?.addEventListener('click', () => {
        if (!authToken) window.location.href = '/login.html';
    });
    document.getElementById('mobileUserAvatar')?.addEventListener('click', () => {
        if (!authToken) window.location.href = '/login.html';
    });

    signOutBtn?.addEventListener('click', () => {
        authToken = '';
        localStorage.removeItem('ld_auth_token');
        profile = null;
        updateAuthUI();
        showToast("Signed out successfully.");
        fetchFeed();
    });

    // Modal Close Buttons
    document.getElementById('closeAddPlaceModalBtn')?.addEventListener('click', () => document.getElementById('addPlaceModal').classList.add('hidden'));
    document.getElementById('cancelAddPlaceBtn')?.addEventListener('click', () => document.getElementById('addPlaceModal').classList.add('hidden'));

    document.getElementById('closeReportLostModalBtn')?.addEventListener('click', () => document.getElementById('reportLostModal').classList.add('hidden'));
    document.getElementById('cancelReportLostBtn')?.addEventListener('click', () => document.getElementById('reportLostModal').classList.add('hidden'));

    document.getElementById('closeListUniformModalBtn')?.addEventListener('click', () => document.getElementById('listUniformBookModal').classList.add('hidden'));
    document.getElementById('cancelListUniformBtn')?.addEventListener('click', () => document.getElementById('listUniformBookModal').classList.add('hidden'));

    document.getElementById('closeHostModalBtn')?.addEventListener('click', () => document.getElementById('hostMeetupModal').classList.add('hidden'));
    document.getElementById('cancelHostModalBtn')?.addEventListener('click', () => document.getElementById('hostMeetupModal').classList.add('hidden'));

    document.getElementById('closeDetailModalBtn')?.addEventListener('click', () => document.getElementById('meetupDetailModal').classList.add('hidden'));
    document.getElementById('closeDirectChatBtn')?.addEventListener('click', () => document.getElementById('directChatModal').classList.add('hidden'));

    document.getElementById('closeCreateSquadModalBtn')?.addEventListener('click', () => document.getElementById('createSquadModal').classList.add('hidden'));
    document.getElementById('cancelSquadModalBtn')?.addEventListener('click', () => document.getElementById('createSquadModal').classList.add('hidden'));

    // Submit Report Lost Form
    document.getElementById('reportLostForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!authToken) {
            window.location.href = '/login.html';
            return;
        }

        const title = document.getElementById('lostTitleInput').value;
        const category = document.getElementById('lostCategoryInput').value;
        const status = document.getElementById('lostStatusInput').value;
        const location_detail = document.getElementById('lostLocationInput').value;
        const district = document.getElementById('lostDistrictInput').value;

        try {
            const res = await apiFetch(`${API_BASE}/v2/lost-found`, {
                method: 'POST',
                body: JSON.stringify({ title, category, status, location_detail, district })
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                showToast(json.error || "Failed to publish alert");
                return;
            }

            showToast("Lost & Found alert published!");
            document.getElementById('reportLostModal').classList.add('hidden');
            document.getElementById('reportLostForm').reset();
            fetchV2Hub();
        } catch (err) {
            showToast("Server connection error.");
        }
    });

    // Submit List Uniform or Book Form
    document.getElementById('listUniformBookForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!authToken) {
            window.location.href = '/login.html';
            return;
        }

        const title = document.getElementById('ubTitleInput').value;
        const category = document.getElementById('ubCategoryInput').value;
        const school_name = document.getElementById('ubSchoolInput').value;
        const grade_level = document.getElementById('ubGradeInput').value;
        const swap_type = document.getElementById('ubSwapTypeInput').value;

        try {
            const res = await apiFetch(`${API_BASE}/v2/toys`, {
                method: 'POST',
                body: JSON.stringify({ title, category, school_name, grade_level, swap_type })
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                showToast(json.error || "Failed to list item");
                return;
            }

            showToast("Item listed on Swap Marketplace!");
            document.getElementById('listUniformBookModal').classList.add('hidden');
            document.getElementById('listUniformBookForm').reset();
            fetchV2Hub();
        } catch (err) {
            showToast("Server connection error.");
        }
    });

    // Search Input
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        fetchFeed();
    });

    // Interest Chips Filter
    document.querySelectorAll('.interest-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            activeInterest = btn.getAttribute('data-interest');
            document.querySelectorAll('.interest-chip').forEach(b => {
                const val = b.getAttribute('data-interest');
                b.className = val === activeInterest 
                    ? 'interest-chip bg-secondary-container text-on-secondary-container px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-sm border border-transparent'
                    : 'interest-chip bg-surface-container-lowest text-on-surface border border-outline-variant px-3.5 py-1.5 rounded-full text-xs font-medium hover:bg-surface-container transition-colors';
            });
            fetchFeed();
        });
    });

    // Submit Add Place Form
    document.getElementById('addPlaceForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!authToken) {
            window.location.href = '/login.html';
            return;
        }

        const errEl = document.getElementById('addPlaceError');
        errEl.classList.add('hidden');

        const name = document.getElementById('placeNameInput').value;
        const district = document.getElementById('placeDistrictInput').value;
        const public_spot_type = document.getElementById('placeTypeInput').value;
        const description = document.getElementById('placeDescInput').value;

        try {
            const res = await apiFetch(`${API_BASE}/community/places`, {
                method: 'POST',
                body: JSON.stringify({ name, district, public_spot_type, description })
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                errEl.textContent = json.details ? json.details.join(', ') : json.error;
                errEl.classList.remove('hidden');
                return;
            }

            showToast(json.message);
            document.getElementById('addPlaceModal').classList.add('hidden');
            document.getElementById('addPlaceForm').reset();
            fetchPlaces();
        } catch (err) {
            errEl.textContent = "Server connection error.";
            errEl.classList.remove('hidden');
        }
    });

    // Submit Host Meetup Form with Public Location Guard
    document.getElementById('hostMeetupForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!authToken) {
            window.location.href = '/login.html';
            return;
        }

        const errEl = document.getElementById('hostMeetupError');
        errEl.classList.add('hidden');

        const title = document.getElementById('meetupTitleInput').value;
        const district = document.getElementById('meetupDistrictInput').value;
        const interest_tag = document.getElementById('meetupInterestInput').value;
        const public_location = document.getElementById('meetupLocationInput').value;
        const date_time = document.getElementById('meetupDateTimeInput').value;
        const min_age = parseInt(document.getElementById('meetupMinAgeInput').value, 10);
        const max_age = parseInt(document.getElementById('meetupMaxAgeInput').value, 10);
        const max_attendees = parseInt(document.getElementById('meetupMaxAttendeesInput').value, 10);

        let image_url = '/assets/football.png';
        if (interest_tag === 'Board Games') image_url = '/assets/board_games.png';
        if (interest_tag === 'Swimming') image_url = '/assets/swimming.png';

        try {
            const res = await apiFetch(`${API_BASE}/community/meetups`, {
                method: 'POST',
                body: JSON.stringify({
                    title, district, interest_tag, public_location, date_time, min_age, max_age, max_attendees, image_url
                })
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                errEl.innerHTML = `<strong>Validation Error / Location Guard:</strong><br>${json.details ? json.details.join('<br>') : json.error}`;
                errEl.classList.remove('hidden');
                return;
            }

            showToast("Playdate created successfully!");
            document.getElementById('hostMeetupModal').classList.add('hidden');
            document.getElementById('hostMeetupForm').reset();
            fetchFeed();
        } catch (err) {
            errEl.textContent = "Server connection error.";
            errEl.classList.remove('hidden');
        }
    });

    // Create Squad Form Handler
    document.getElementById('createSquadForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('squadNameInput').value;
        const district = document.getElementById('squadDistrictInput').value;
        const category = document.getElementById('squadCategoryInput').value;
        const description = document.getElementById('squadDescInput').value;

        try {
            const res = await apiFetch(`${API_BASE}/community/squads`, {
                method: 'POST',
                body: JSON.stringify({ name, district, category, description })
            });

            const json = await res.json();
            if (json.success) {
                showToast("Activity Squad launched!");
                document.getElementById('createSquadModal').classList.add('hidden');
                document.getElementById('createSquadForm').reset();
                fetchSquads();
            }
        } catch (err) {
            console.error("Create squad error", err);
        }
    });

    // Direct Chat Message Form Submit
    document.getElementById('directChatForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentDetailMeetup || !currentChatRecipient) return;

        const input = document.getElementById('directChatInput');
        const content = input.value.trim();
        if (!content) return;

        try {
            const res = await apiFetch(`${API_BASE}/chat/direct`, {
                method: 'POST',
                body: JSON.stringify({
                    meetupId: currentDetailMeetup.id,
                    recipientId: currentChatRecipient.id,
                    recipientName: currentChatRecipient.name,
                    content
                })
            });

            const json = await res.json();
            if (json.success) {
                input.value = '';
                if (json.moderated) {
                    showToast(`Message moderated: ${json.moderationReason}`);
                }
                fetchDirectMessages();
            } else {
                showToast(json.error || "Failed to send direct message.");
            }
        } catch (err) {
            console.error("Direct chat send error", err);
        }
    });

    // RSVP Button in Detail Modal
    document.getElementById('detailRsvpBtn')?.addEventListener('click', async () => {
        if (!authToken) {
            window.location.href = '/login.html';
            return;
        }
        if (!currentDetailMeetup) return;
        try {
            const res = await apiFetch(`${API_BASE}/community/rsvp`, {
                method: 'POST',
                body: JSON.stringify({ meetup_id: currentDetailMeetup.id })
            });

            const json = await res.json();
            if (json.success) {
                showToast(json.message);
                currentDetailMeetup = json.data;
                openDetailModal(currentDetailMeetup);
                fetchFeed();
            }
        } catch (err) {
            console.error("RSVP error", err);
        }
    });

    // Send Comment in Detail Modal
    document.getElementById('sendCommentBtn')?.addEventListener('click', async () => {
        if (!authToken) {
            window.location.href = '/login.html';
            return;
        }
        if (!currentDetailMeetup) return;
        const input = document.getElementById('commentInput');
        const content = input.value.trim();
        if (!content) return;

        try {
            const res = await apiFetch(`${API_BASE}/community/meetups/${currentDetailMeetup.id}/comments`, {
                method: 'POST',
                body: JSON.stringify({ content })
            });

            const json = await res.json();
            if (json.success) {
                input.value = '';
                if (!currentDetailMeetup.comments) currentDetailMeetup.comments = [];
                currentDetailMeetup.comments.push(json.data);
                renderComments(currentDetailMeetup.comments);
                showToast("Question posted!");
            }
        } catch (err) {
            console.error("Comment error", err);
        }
    });

    // Profile Photo File Upload
    document.getElementById('avatarFileInput')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const dataUrl = event.target.result;
            
            const pAvatar = document.getElementById('profileAvatar');
            if (pAvatar) pAvatar.src = dataUrl;
            document.getElementById('desktopUserAvatar').src = dataUrl;
            document.getElementById('mobileUserAvatar').src = dataUrl;

            try {
                const res = await apiFetch(`${API_BASE}/profile`, {
                    method: 'PUT',
                    body: JSON.stringify({ avatar_url: dataUrl })
                });
                const json = await res.json();
                if (json.success) {
                    profile = json.data;
                    showToast("Profile photo updated successfully!");
                }
            } catch (err) {
                console.error("Failed to upload avatar", err);
            }
        };
        reader.readAsDataURL(file);
    });

    // Add Child button handler
    document.getElementById('addChildBtn')?.addEventListener('click', () => {
        const nickname = prompt("Enter child nickname (Privacy Protection: Nicknames only!):");
        if (!nickname || !nickname.trim()) return;
        const ageStr = prompt("Enter child age:");
        const age = parseInt(ageStr, 10) || 5;
        const hobbiesStr = prompt("Enter hobbies/interests (comma separated, e.g. Swimming, Roblox, Cycling):");
        const hobbies = hobbiesStr ? hobbiesStr.split(',').map(h => h.trim()).filter(Boolean) : ['Park Play'];

        if (!profile) profile = {};
        if (!profile.children) profile.children = [];
        profile.children.push({ nickname: nickname.trim(), age, hobbies });
        renderChildrenList();
    });

    // Profile Form Save
    document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('editParentName').value;
        const district = document.getElementById('editDistrict').value;
        const contact_preference = document.getElementById('editContactPref').value;
        const bio = document.getElementById('editBio').value;

        try {
            const res = await apiFetch(`${API_BASE}/profile`, {
                method: 'PUT',
                body: JSON.stringify({ name, district, contact_preference, bio, children: profile?.children || [] })
            });

            const json = await res.json();
            if (json.success) {
                profile = json.data;
                renderProfile();
                showToast("Profile saved successfully!");
            }
        } catch (err) {
            console.error("Profile save error", err);
        }
    });
});

