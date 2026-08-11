// Dubai Community Kids - LittleDistrict App Frontend Logic

const API_BASE = '/api';

// Global Auth & App State
let authToken = localStorage.getItem('ld_auth_token') || '';
let currentTab = 'feed';
let activeDistrict = 'All';
let activeInterest = 'All';
let searchQuery = '';
let places = [];
let meetups = [];
let myMeetups = [];
let profile = null;
let currentDetailMeetup = null;
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

// Toast helper
function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    if (!toast || !toastMsg) return;
    toastMsg.textContent = message;
    toast.classList.remove('opacity-0', 'translate-y-[-10px]', 'pointer-events-none');
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-[-10px]', 'pointer-events-none');
    }, 3000);
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

// API Calls
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

// Render Functions
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
                    <div class="absolute bottom-3 left-3 bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                        ${m.interest_tag}
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
                                <span class="text-xs font-medium text-on-surface line-clamp-1">Host: ${m.host_name}</span>
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

function renderMyMeetupsGrid() {
    const grid = document.getElementById('myMeetupsGrid');
    const emptyState = document.getElementById('emptyMyMeetupsState');
    if (!grid) return;

    if (myMeetups.length === 0) {
        grid.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    grid.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');

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
    document.getElementById('profileParentName').textContent = profile.name || 'Parent User';
    document.getElementById('profileDistrict').textContent = profile.district || 'Dubai Marina';
    document.getElementById('profileBio').textContent = profile.bio || 'Active community parent';
    document.getElementById('profileContactPref').textContent = profile.contact_preference || 'In-App Message';
    
    if (profile.avatar_url) {
        document.getElementById('profileAvatar').src = profile.avatar_url;
        document.getElementById('desktopUserAvatar').src = profile.avatar_url;
        document.getElementById('mobileUserAvatar').src = profile.avatar_url;
    }

    document.getElementById('editParentName').value = profile.name || '';
    document.getElementById('editDistrict').value = profile.district || 'Dubai Marina';
    document.getElementById('editContactPref').value = profile.contact_preference || 'In-App Message';
    document.getElementById('editBio').value = profile.bio || '';

    renderChildrenList();
}

function renderChildrenList() {
    const listContainer = document.getElementById('childrenList');
    if (!listContainer || !profile) return;

    const children = profile.children || [];
    if (children.length === 0) {
        listContainer.innerHTML = `<p class="text-xs text-on-surface-variant italic">No children registered yet.</p>`;
        return;
    }

    listContainer.innerHTML = children.map(c => `
        <div class="bg-surface-container-low p-4 rounded-xl border border-outline-variant/40 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-primary/10 text-primary font-display font-bold flex items-center justify-center text-sm">
                    ${c.nickname ? c.nickname.charAt(0).toUpperCase() : 'K'}
                </div>
                <div>
                    <h5 class="font-bold text-sm text-on-surface">${c.nickname} <span class="text-xs font-normal text-on-surface-variant">(${c.age} yrs)</span></h5>
                    <p class="text-xs text-on-surface-variant flex flex-wrap gap-1 mt-0.5">
                        ${(c.hobbies || []).map(h => `<span class="bg-surface-container px-2 py-0.5 rounded-md text-[10px] font-semibold text-primary">${h}</span>`).join('')}
                    </p>
                </div>
            </div>
        </div>
    `).join('');
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
    const rsvpBtn = document.getElementById('detailRsvpBtn');
    if (rsvpBtn) {
        rsvpBtn.textContent = isAttending ? '✓ Cancel RSVP' : 'RSVP / Join';
        rsvpBtn.className = isAttending 
            ? 'bg-outline-variant text-on-surface font-bold text-xs px-6 py-2.5 rounded-xl hover:bg-outline-variant/80 transition-all shadow-sm'
            : 'bg-primary text-white font-bold text-xs px-6 py-2.5 rounded-xl hover:bg-primary/90 transition-all shadow-sm';
    }

    renderComments(meetup.comments || []);
    modal.classList.remove('hidden');
}

function renderComments(comments) {
    const list = document.getElementById('detailCommentsList');
    if (!list) return;

    if (!comments || comments.length === 0) {
        list.innerHTML = `<p class="text-xs text-on-surface-variant italic py-2">No questions yet. Be the first parent to ask!</p>`;
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

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
    fetchPlaces();
    fetchFeed();
    if (authToken) fetchProfile();
    updateAuthUI();

    // Host & Place Action Triggers
    document.getElementById('sidebarHostBtn')?.addEventListener('click', openHostMeetupModal);
    document.getElementById('sidebarAddPlaceBtn')?.addEventListener('click', openAddPlaceModal);
    document.getElementById('mobileAddPlaceBtn')?.addEventListener('click', openAddPlaceModal);

    // Tab Navigation
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            if (targetTab === 'places') {
                openAddPlaceModal();
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
                if (isTarget) {
                    b.className = 'nav-tab w-full flex items-center gap-3 bg-secondary-container text-on-secondary-container rounded-xl px-4 py-3 font-semibold text-sm transition-all shadow-sm';
                } else {
                    b.className = 'nav-tab w-full flex items-center gap-3 text-on-surface-variant hover:bg-surface-container rounded-xl px-4 py-3 font-medium text-sm transition-colors';
                }
            });

            document.querySelectorAll('.tab-content').forEach(sec => {
                sec.classList.add('hidden');
            });
            const activeSec = document.getElementById(`tab-${targetTab}`);
            if (activeSec) activeSec.classList.remove('hidden');

            if (targetTab === 'feed') fetchFeed();
            if (targetTab === 'my-meetups') fetchMyMeetups();
            if (targetTab === 'profile') fetchProfile();
        });
    });

    // Auth Handlers
    const authModal = document.getElementById('authModal');
    const openAuthModalBtn = document.getElementById('openAuthModalBtn');
    const closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
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
    closeAuthModalBtn?.addEventListener('click', () => authModal?.classList.add('hidden'));

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

    document.getElementById('closeHostModalBtn')?.addEventListener('click', () => document.getElementById('hostMeetupModal').classList.add('hidden'));
    document.getElementById('cancelHostModalBtn')?.addEventListener('click', () => document.getElementById('hostMeetupModal').classList.add('hidden'));

    document.getElementById('closeDetailModalBtn')?.addEventListener('click', () => document.getElementById('meetupDetailModal').classList.add('hidden'));

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
                if (val === activeInterest) {
                    b.className = 'interest-chip bg-secondary-container text-on-secondary-container px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-sm border border-transparent';
                } else {
                    b.className = 'interest-chip bg-surface-container-lowest text-on-surface border border-outline-variant px-3.5 py-1.5 rounded-full text-xs font-medium hover:bg-surface-container transition-colors';
                }
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

    // Submit Host Meetup Form
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
                errEl.innerHTML = `<strong>Zod Validation Error:</strong><br>${json.details ? json.details.join('<br>') : json.error}`;
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
            
            document.getElementById('profileAvatar').src = dataUrl;
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
        const nickname = prompt("Enter child nickname:");
        if (!nickname || !nickname.trim()) return;
        const ageStr = prompt("Enter child age:");
        const age = parseInt(ageStr, 10) || 5;
        const hobbiesStr = prompt("Enter hobbies (comma separated):");
        const hobbies = hobbiesStr ? hobbiesStr.split(',').map(h => h.trim()).filter(Boolean) : [];

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
                body: JSON.stringify({ name, district, contact_preference, bio })
            });

            const json = await res.json();
            if (json.success) {
                profile = json.data;
                renderProfile();
                showToast("Profile saved!");
            }
        } catch (err) {
            console.error("Profile save error", err);
        }
    });
});
