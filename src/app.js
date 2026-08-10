// Dubai Community Kids - LittleDistrict App Frontend Logic

const API_BASE = '/api';

// Global state
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

// API Calls
async function fetchPlaces() {
    try {
        const res = await fetch(`${API_BASE}/community/places`);
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

        const res = await fetch(`${API_BASE}/community/feed?${params.toString()}`);
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
        const res = await fetch(`${API_BASE}/my-meetups`);
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
    try {
        const res = await fetch(`${API_BASE}/profile`);
        const json = await res.json();
        if (json.success) {
            profile = json.data;
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

    // Collect unique districts from added places or defaults
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

    // Attach click events
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
                    <img src="${m.image_url || '/assets/football.png'}" alt="${m.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                    <button class="fav-btn absolute top-3 right-3 bg-surface-container-lowest/80 backdrop-blur p-2 rounded-full text-on-surface-variant hover:text-red-500 shadow-sm z-10 transition-colors" data-id="${m.id}">
                        <span class="material-symbols-outlined text-lg ${isFav ? 'text-red-500 fill-current' : ''}">favorite</span>
                    </button>
                    <div class="absolute bottom-3 left-3 bg-secondary-container text-on-secondary-container px-3 py-1 rounded-lg text-xs font-bold shadow-sm">
                        ${m.interest_tag}
                    </div>
                </div>
                <div class="p-5 flex flex-col flex-1 space-y-3">
                    <div>
                        <h4 class="font-display font-bold text-lg text-on-surface leading-snug hover:text-primary transition-colors">${m.title}</h4>
                        <div class="flex items-center gap-1 text-on-surface-variant text-xs mt-1">
                            <span class="material-symbols-outlined text-base text-primary">location_on</span>
                            <span class="truncate font-medium">${m.public_location}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 flex-wrap text-xs">
                        <span class="inline-flex items-center gap-1 bg-surface-container-high px-2.5 py-1 rounded-lg text-on-surface font-semibold">
                            <span class="material-symbols-outlined text-sm text-primary">child_care</span> ${m.min_age}-${m.max_age} yrs
                        </span>
                        <span class="inline-flex items-center gap-1 bg-surface-container-high px-2.5 py-1 rounded-lg text-on-surface font-semibold">
                            <span class="material-symbols-outlined text-sm text-primary">schedule</span> ${m.date_time}
                        </span>
                    </div>
                    <div class="mt-auto flex items-center justify-between border-t border-outline-variant/30 pt-3.5">
                        <div class="flex items-center gap-2">
                            <img src="${m.host_avatar || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><rect width=\'100\' height=\'100\' fill=\'%23eef5f7\'/><circle cx=\'50\' cy=\'38\' r=\'20\' fill=\'%23006565\'/><path d=\'M20 90 c0-25 15-35 30-35 s30 10 30 35 Z\' fill=\'%23006565\'/></svg>'}" class="w-6 h-6 rounded-full object-cover" alt="Host">
                            <span class="text-xs font-semibold text-on-surface-variant">${m.host_name.split(' ')[0]} (Host)</span>
                        </div>
                        <span class="text-xs font-bold ${isFull ? 'text-secondary' : 'text-primary'} bg-primary/10 px-2.5 py-1 rounded-full">
                            ${isAttending ? '✓ Attending' : isFull ? 'Full' : `${m.attendees_count}/${m.max_attendees} attending`}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Attach card click handlers
    grid.querySelectorAll('[data-id]').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.fav-btn')) {
                e.stopPropagation();
                const meetupId = card.getAttribute('data-id');
                if (favorites.has(meetupId)) {
                    favorites.delete(meetupId);
                    showToast("Removed from favorites");
                } else {
                    favorites.add(meetupId);
                    showToast("Added to saved favorites!");
                }
                renderMeetupsGrid();
                return;
            }
            const meetupId = card.getAttribute('data-id');
            const meetup = meetups.find(m => m.id === meetupId);
            if (meetup) openDetailModal(meetup);
        });
    });
}

function renderMyMeetupsGrid() {
    const grid = document.getElementById('myMeetupsGrid');
    if (!grid) return;

    if (myMeetups.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12 bg-surface-container-lowest border border-dashed border-outline-variant rounded-2xl p-8">
                <p class="text-sm text-on-surface-variant font-medium">You haven't joined or hosted any meetups yet.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = myMeetups.map(m => `
        <div class="bg-surface-container-lowest rounded-2xl overflow-hidden card-shadow p-5 border border-outline-variant/40 space-y-3">
            <div class="flex justify-between items-start">
                <div>
                    <span class="text-xs font-bold text-secondary bg-secondary/10 px-2.5 py-1 rounded-full">${m.interest_tag}</span>
                    <h4 class="font-display font-bold text-lg text-on-surface mt-2">${m.title}</h4>
                </div>
                <span class="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">✓ Joined</span>
            </div>
            <p class="text-xs text-on-surface-variant flex items-center gap-1">
                <span class="material-symbols-outlined text-sm text-primary">location_on</span> ${m.public_location} (${m.district})
            </p>
            <p class="text-xs text-on-surface-variant flex items-center gap-1">
                <span class="material-symbols-outlined text-sm text-primary">schedule</span> ${m.date_time}
            </p>
        </div>
    `).join('');
}

function renderProfile() {
    if (!profile) return;
    document.getElementById('navParentName').textContent = profile.name || 'Your Name';
    document.getElementById('navDistrict').textContent = profile.district || 'District';
    document.getElementById('profileParentName').textContent = profile.name || 'Your Name';
    document.getElementById('profileDistrictBadge').textContent = profile.district ? `${profile.district} Resident` : 'Neighborhood Resident';
    document.getElementById('editParentName').value = profile.name || '';
    document.getElementById('editDistrict').value = profile.district || '';
    document.getElementById('editContactPref').value = profile.contact_preference || 'In-App Message';
    document.getElementById('editBio').value = profile.bio || '';

    if (profile.avatar_url) {
        document.getElementById('profileAvatar').src = profile.avatar_url;
        document.getElementById('desktopUserAvatar').src = profile.avatar_url;
        document.getElementById('mobileUserAvatar').src = profile.avatar_url;
    }

    renderChildrenList();
}

function renderChildrenList() {
    const container = document.getElementById('childrenContainer');
    if (!container) return;
    const children = (profile && profile.children) || [];

    if (children.length === 0) {
        container.innerHTML = `<p class="text-xs text-on-surface-variant italic">No children added yet. Click '+ Add Child' to add your kids' profiles!</p>`;
        return;
    }

    container.innerHTML = children.map((c, i) => `
        <div class="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/40 flex justify-between items-center text-xs">
            <div>
                <span class="font-bold text-sm text-on-surface">${c.nickname}</span>
                <span class="text-on-surface-variant font-medium ml-2">Age ${c.age}</span>
            </div>
            <div class="flex items-center gap-2">
                <div class="flex gap-1.5">
                    ${(c.hobbies || []).map(h => `<span class="bg-surface-container-lowest px-2 py-0.5 rounded border border-outline-variant text-[11px] font-medium">${h}</span>`).join('')}
                </div>
                <button type="button" data-remove-child="${i}" class="text-red-500 hover:text-red-700 p-1">
                    <span class="material-symbols-outlined text-sm">delete</span>
                </button>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('[data-remove-child]').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-remove-child'), 10);
            if (profile && profile.children) {
                profile.children.splice(idx, 1);
                renderChildrenList();
            }
        });
    });
}

// Modal logic
function openDetailModal(meetup) {
    currentDetailMeetup = meetup;
    document.getElementById('detailTitle').textContent = meetup.title;
    document.getElementById('detailLocation').textContent = meetup.public_location;
    document.getElementById('detailTag').textContent = meetup.interest_tag;
    document.getElementById('detailAge').textContent = `${meetup.min_age}-${meetup.max_age} years`;
    document.getElementById('detailTime').textContent = meetup.date_time;
    document.getElementById('detailAttendeesCount').textContent = `${meetup.attendees_count}/${meetup.max_attendees} attending`;
    document.getElementById('detailHostName').textContent = `${meetup.host_name} (Host)`;
    document.getElementById('detailImage').src = meetup.image_url || '/assets/football.png';

    const rsvpBtn = document.getElementById('detailRsvpBtn');
    const isAttending = profile && meetup.attendees && meetup.attendees.includes(profile.id);
    if (isAttending) {
        rsvpBtn.textContent = '✓ Cancel RSVP';
        rsvpBtn.className = 'bg-surface-container text-on-surface border border-outline font-bold text-xs px-6 py-2.5 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all';
    } else {
        rsvpBtn.textContent = 'RSVP / Join Playdate';
        rsvpBtn.className = 'bg-primary text-white font-bold text-xs px-6 py-2.5 rounded-xl hover:bg-primary/90 transition-all shadow-sm';
    }

    renderComments(meetup.comments || []);

    document.getElementById('meetupDetailModal').classList.remove('hidden');
}

function renderComments(comments) {
    const list = document.getElementById('detailCommentsList');
    if (!list) return;
    if (comments.length === 0) {
        list.innerHTML = `<p class="text-xs text-on-surface-variant italic">No questions yet. Be the first to ask!</p>`;
        return;
    }
    list.innerHTML = comments.map(c => `
        <div class="p-3 bg-surface-container-low rounded-xl text-xs space-y-1">
            <div class="flex items-center justify-between">
                <span class="font-bold text-on-surface">${c.user_name}</span>
                <span class="text-[10px] text-on-surface-variant">${new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p class="text-on-surface-variant">${c.content}</p>
        </div>
    `).join('');
}

// Tab Switching
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-tab').forEach(el => {
        if (el.getAttribute('data-tab') === tab) {
            el.className = 'nav-tab w-full flex items-center gap-3 bg-secondary-container text-on-secondary-container rounded-xl px-4 py-3 font-semibold text-sm transition-all shadow-sm';
        } else {
            el.className = 'nav-tab w-full flex items-center gap-3 text-on-surface-variant hover:bg-surface-container rounded-xl px-4 py-3 font-medium text-sm transition-colors';
        }
    });

    const pageTitle = document.getElementById('pageTitle');
    const target = document.getElementById(`tab-${tab}`);
    if (target) target.classList.remove('hidden');

    if (tab === 'feed') {
        if (pageTitle) pageTitle.textContent = 'Explore Community';
        fetchFeed();
    } else if (tab === 'my-meetups') {
        if (pageTitle) pageTitle.textContent = 'My Meetups & Activity';
        fetchMyMeetups();
    } else if (tab === 'profile') {
        if (pageTitle) pageTitle.textContent = 'Family Profile';
        fetchProfile();
    } else if (tab === 'places') {
        document.getElementById('addPlaceModal').classList.remove('hidden');
    } else if (tab === 'create-meetup') {
        document.getElementById('hostMeetupModal').classList.remove('hidden');
    }
}

// Event Listeners Initialization
document.addEventListener('DOMContentLoaded', () => {
    fetchPlaces();
    fetchFeed();
    fetchProfile();

    // Nav Tab Buttons
    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
    });

    // Sidebar & Header Buttons
    document.getElementById('sidebarAddPlaceBtn')?.addEventListener('click', () => document.getElementById('addPlaceModal').classList.remove('hidden'));
    document.getElementById('mobileAddPlaceBtn')?.addEventListener('click', () => document.getElementById('addPlaceModal').classList.remove('hidden'));
    document.getElementById('mobileAddPlaceNavBtn')?.addEventListener('click', () => document.getElementById('addPlaceModal').classList.remove('hidden'));
    document.getElementById('addPlaceChipBtn')?.addEventListener('click', () => document.getElementById('addPlaceModal').classList.remove('hidden'));
    document.getElementById('emptyAddPlaceBtn')?.addEventListener('click', () => document.getElementById('addPlaceModal').classList.remove('hidden'));

    document.getElementById('sidebarHostBtn')?.addEventListener('click', () => document.getElementById('hostMeetupModal').classList.remove('hidden'));
    document.getElementById('mobileHostFab')?.addEventListener('click', () => document.getElementById('hostMeetupModal').classList.remove('hidden'));
    document.getElementById('emptyHostBtn')?.addEventListener('click', () => document.getElementById('hostMeetupModal').classList.remove('hidden'));

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

    // Submit Add Place Form ("dont add any places let make us add it")
    document.getElementById('addPlaceForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = document.getElementById('addPlaceError');
        errEl.classList.add('hidden');

        const name = document.getElementById('placeNameInput').value;
        const district = document.getElementById('placeDistrictInput').value;
        const public_spot_type = document.getElementById('placeTypeInput').value;
        const description = document.getElementById('placeDescInput').value;

        try {
            const res = await fetch(`${API_BASE}/community/places`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

            // Refresh places & filter chips
            fetchPlaces();
        } catch (err) {
            errEl.textContent = "Server connection error.";
            errEl.classList.remove('hidden');
        }
    });

    // Submit Host Meetup Form (with Zod Public Location Validation)
    document.getElementById('hostMeetupForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
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

        // Map interest to image asset
        let image_url = '/assets/football.png';
        if (interest_tag === 'Board Games') image_url = '/assets/board_games.png';
        if (interest_tag === 'Swimming') image_url = '/assets/swimming.png';

        try {
            const res = await fetch(`${API_BASE}/community/meetups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
        if (!currentDetailMeetup) return;
        try {
            const res = await fetch(`${API_BASE}/community/rsvp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
        if (!currentDetailMeetup) return;
        const input = document.getElementById('commentInput');
        const content = input.value.trim();
        if (!content) return;

        try {
            const res = await fetch(`${API_BASE}/community/meetups/${currentDetailMeetup.id}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            
            // Update UI preview immediately
            document.getElementById('profileAvatar').src = dataUrl;
            document.getElementById('desktopUserAvatar').src = dataUrl;
            document.getElementById('mobileUserAvatar').src = dataUrl;

            // Save to backend
            try {
                const res = await fetch(`${API_BASE}/profile`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
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
            const res = await fetch(`${API_BASE}/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
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
