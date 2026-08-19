// Dubai Community Kids Client Application Logic

let state = {
    currentTab: 'feed',
    user: null,
    token: localStorage.getItem('ld_token') || null,
    meetups: [],
    places: [],
    toys: [],
    lostFound: [],
    filters: {
        district: '',
        interest: '',
        search: ''
    },
    authMode: 'login'
};

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    setupEventListeners();
    if (state.token) {
        await checkCurrentUser();
    }
    await loadCurrentTabData();
}

function setupEventListeners() {
    const districtSelect = document.getElementById('districtFilter');
    if (districtSelect) {
        districtSelect.addEventListener('change', (e) => {
            state.filters.district = e.target.value;
            loadCurrentTabData();
        });
    }

    const mobileDistrictSelect = document.getElementById('mobileDistrictFilter');
    if (mobileDistrictSelect) {
        mobileDistrictSelect.addEventListener('change', (e) => {
            state.filters.district = e.target.value;
            loadCurrentTabData();
        });
    }

    const interestSelect = document.getElementById('interestFilter');
    if (interestSelect) {
        interestSelect.addEventListener('change', (e) => {
            state.filters.interest = e.target.value;
            renderCurrentTab();
        });
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.filters.search = e.target.value.toLowerCase().trim();
            renderCurrentTab();
        });
    }
}

// --- IMAGE UPLOAD HELPER ---
function handleImageFileSelect(event, previewId, inputId) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const dataUrl = e.target.result;
        const inputEl = document.getElementById(inputId);
        const previewEl = document.getElementById(previewId);
        
        if (inputEl) inputEl.value = dataUrl;
        if (previewEl) {
            previewEl.classList.remove('hidden');
            const img = previewEl.querySelector('img');
            if (img) img.src = dataUrl;
        }
    };
    reader.readAsDataURL(file);
}

async function checkCurrentUser() {
    try {
        const res = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const data = await res.json();
        if (data.success && data.user) {
            state.user = data.user;
            updateUserUI();
        } else {
            logout();
        }
    } catch (err) {
        console.error('Auth check failed:', err);
    }
}

function updateUserUI() {
    const section = document.getElementById('userAccountSection');
    if (!section) return;

    if (state.user) {
        section.innerHTML = `
            <div class="flex items-center gap-2">
                <img src="${state.user.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + state.user.name}" alt="${state.user.name}" class="w-8 h-8 rounded-full border-2 border-teal-500 object-cover">
                <div class="hidden sm:block text-left">
                    <span class="block text-xs font-bold text-slate-800 leading-none">${escapeHTML(state.user.name)}</span>
                    <span class="text-[10px] text-teal-700 font-semibold">${escapeHTML(state.user.district || 'Dubai')}</span>
                </div>
                <button onclick="logout()" class="p-1 text-slate-400 hover:text-rose-600 transition-colors" title="Log Out">
                    <span class="material-symbols-outlined text-lg">logout</span>
                </button>
            </div>
        `;
    } else {
        section.innerHTML = `
            <button onclick="openModal('authModal')" class="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-full text-xs font-bold transition-colors">
                <span class="material-symbols-outlined text-lg text-teal-600">account_circle</span>
                <span>Sign In</span>
            </button>
        `;
    }
}

function logout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('ld_token');
    updateUserUI();
    showToast('Logged out successfully');
}

function toggleAuthMode() {
    state.authMode = state.authMode === 'login' ? 'register' : 'login';
    const nameField = document.getElementById('nameField');
    const districtField = document.getElementById('districtAuthField');
    const submitBtn = document.getElementById('authSubmitBtn');
    const toggleBtn = document.getElementById('authToggleBtn');

    if (state.authMode === 'register') {
        nameField.classList.remove('hidden');
        districtField.classList.remove('hidden');
        submitBtn.textContent = 'Create Parent Account';
        toggleBtn.textContent = 'Already have an account? Sign In';
    } else {
        nameField.classList.add('hidden');
        districtField.classList.add('hidden');
        submitBtn.textContent = 'Sign In';
        toggleBtn.textContent = 'Need an account? Register here';
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const alertEl = document.getElementById('authErrorAlert');
    const msgEl = document.getElementById('authErrorMsg');
    if (alertEl) alertEl.classList.add('hidden');

    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const endpoint = state.authMode === 'register' ? '/api/auth/register' : '/api/auth/login';

    const payload = { email, password };
    if (state.authMode === 'register') {
        payload.name = document.getElementById('authName').value;
        payload.district = document.getElementById('authDistrict').value;
    }

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success && data.token) {
            state.token = data.token;
            state.user = data.user;
            localStorage.setItem('ld_token', data.token);
            updateUserUI();
            closeModal('authModal');
            showToast(`Welcome ${data.user.name}!`);
        } else {
            if (alertEl && msgEl) {
                msgEl.textContent = data.error || 'Authentication failed. Please check details or click Register.';
                alertEl.classList.remove('hidden');
            } else {
                alert(data.error || 'Authentication failed');
            }
        }
    } catch (err) {
        if (alertEl && msgEl) {
            msgEl.textContent = 'Server error. Please check your network connection and try again.';
            alertEl.classList.remove('hidden');
        } else {
            alert('Server error. Please try again.');
        }
    }
}

function switchTab(tabName) {
    state.currentTab = tabName;

    document.querySelectorAll('.nav-btn').forEach(btn => {
        const isSelected = btn.dataset.tab === tabName;
        if (isSelected) {
            btn.className = 'nav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-teal-800 bg-teal-50 shadow-sm border border-teal-100/60 transition-all';
            btn.querySelector('.material-symbols-outlined').className = 'material-symbols-outlined text-xl text-teal-600';
        } else {
            btn.className = 'nav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all';
            btn.querySelector('.material-symbols-outlined').className = 'material-symbols-outlined text-xl text-slate-400';
        }
    });

    ['feed', 'places', 'toys', 'lostFound'].forEach(t => {
        const sec = document.getElementById(`tab-${t}`);
        if (sec) sec.classList.add('hidden');
    });

    const activeSec = document.getElementById(`tab-${tabName}`);
    if (activeSec) activeSec.classList.remove('hidden');

    loadCurrentTabData();
}

async function loadCurrentTabData() {
    const districtQuery = state.filters.district ? `?district=${encodeURIComponent(state.filters.district)}` : '';

    if (state.currentTab === 'feed') {
        try {
            const res = await fetch(`/api/meetups${districtQuery}`);
            const data = await res.json();
            if (data.success) {
                state.meetups = data.data || [];
                renderMeetups();
            }
        } catch (err) {
            console.error('Failed to load meetups:', err);
        }
    } else if (state.currentTab === 'places') {
        try {
            const res = await fetch(`/api/places${districtQuery}`);
            const data = await res.json();
            if (data.success) {
                state.places = data.data || [];
                renderPlaces();
            }
        } catch (err) {
            console.error('Failed to load places:', err);
        }
    } else if (state.currentTab === 'toys') {
        try {
            const res = await fetch(`/api/toys${districtQuery}`);
            const data = await res.json();
            if (data.success) {
                state.toys = data.data || [];
                renderToys();
            }
        } catch (err) {
            console.error('Failed to load toys:', err);
        }
    } else if (state.currentTab === 'lostFound') {
        try {
            const res = await fetch(`/api/lost-found${districtQuery}`);
            const data = await res.json();
            if (data.success) {
                state.lostFound = data.data || [];
                renderLostFound();
            }
        } catch (err) {
            console.error('Failed to load lost found items:', err);
        }
    }
}

function renderCurrentTab() {
    if (state.currentTab === 'feed') renderMeetups();
    else if (state.currentTab === 'places') renderPlaces();
    else if (state.currentTab === 'toys') renderToys();
    else if (state.currentTab === 'lostFound') renderLostFound();
}

function renderMeetups() {
    const grid = document.getElementById('meetupsGrid');
    if (!grid) return;

    let filtered = state.meetups;
    if (state.filters.interest) {
        filtered = filtered.filter(m => m.interest_tag === state.filters.interest);
    }
    if (state.filters.search) {
        filtered = filtered.filter(m => 
            (m.title && m.title.toLowerCase().includes(state.filters.search)) ||
            (m.public_location && m.public_location.toLowerCase().includes(state.filters.search)) ||
            (m.district && m.district.toLowerCase().includes(state.filters.search))
        );
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200">
                <span class="material-symbols-outlined text-4xl text-slate-300">event_busy</span>
                <p class="text-sm font-bold text-slate-600 mt-2">No playdates found matching filters</p>
                <button onclick="clearFilters()" class="mt-3 text-xs font-bold text-teal-700 hover:underline">+ Clear Search Filters</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(m => {
        const rsvps = m.rsvps || [];
        const isAttending = state.user && rsvps.some(r => r.user_id === state.user.id);
        const coverImg = m.image_url || '/assets/logo-full.png';

        return `
            <div class="bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                    <!-- Card Cover Photo -->
                    <div class="h-48 bg-teal-950 relative overflow-hidden">
                        <img src="${coverImg}" alt="${escapeHTML(m.title)}" class="w-full h-full object-cover opacity-90 hover:scale-105 transition-transform duration-500" onerror="this.src='/assets/logo-full.png'">
                        <span class="absolute top-3 left-3 bg-teal-800/90 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow">
                            📍 ${escapeHTML(m.district)}
                        </span>
                        <span class="absolute top-3 right-3 bg-amber-500 text-slate-900 text-[11px] font-extrabold px-2.5 py-1 rounded-full shadow">
                            ${escapeHTML(m.interest_tag || 'Activity')}
                        </span>
                    </div>

                    <!-- Card Body -->
                    <div class="p-5 space-y-3">
                        <div class="flex items-center gap-2.5 text-xs text-slate-500 font-medium">
                            <img src="${m.host_avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (m.host_name || 'Parent')}" class="w-6 h-6 rounded-full border border-teal-500 object-cover">
                            <span>Hosted by <strong class="text-slate-700">${escapeHTML(m.host_name || 'Parent')}</strong></span>
                        </div>

                        <h3 class="font-display font-bold text-lg text-slate-900 leading-snug hover:text-teal-700 transition-colors cursor-pointer" onclick="toggleComments('${m.id}')">
                            ${escapeHTML(m.title)}
                        </h3>

                        <div class="space-y-1.5 text-xs font-semibold text-slate-600">
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-teal-600 text-lg">calendar_month</span>
                                <span>${escapeHTML(m.date_time)}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-teal-600 text-lg">location_on</span>
                                <span class="truncate">${escapeHTML(m.public_location)}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-amber-500 text-lg">face</span>
                                <span>Ages: ${m.min_age || 0} - ${m.max_age || 16} years</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer & RSVP -->
                <div class="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <div class="flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-teal-600 text-base">group</span>
                        <span class="text-xs font-bold text-slate-700">${rsvps.length} / ${m.max_attendees || 10} Attending</span>
                    </div>

                    <div class="flex items-center gap-2">
                        <button onclick="toggleComments('${m.id}')" class="p-2 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors" title="Comments">
                            <span class="material-symbols-outlined text-lg">chat</span>
                        </button>
                        <button onclick="handleRSVP('${m.id}')" class="${isAttending ? 'bg-amber-500 text-slate-900' : 'bg-teal-700 hover:bg-teal-800 text-white'} text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm">
                            ${isAttending ? '✓ Attending' : '+ Join RSVP'}
                        </button>
                    </div>
                </div>

                <!-- Comments Drawer -->
                <div id="comments-${m.id}" class="hidden p-4 bg-slate-100 border-t border-slate-200 space-y-3">
                    <h4 class="font-display font-bold text-xs text-slate-700">Discussion & Parent Q&A</h4>
                    <div class="space-y-2 max-h-40 overflow-y-auto pr-1 text-xs">
                        ${(m.comments || []).length > 0 ? (m.comments || []).map(c => `
                            <div class="bg-white p-2.5 rounded-xl border border-slate-200">
                                <span class="font-bold text-teal-800">${escapeHTML(c.user_name)}:</span>
                                <span class="text-slate-700">${escapeHTML(c.content)}</span>
                            </div>
                        `).join('') : '<p class="text-[11px] text-slate-400 italic">No comments yet. Ask a question below!</p>'}
                    </div>

                    <form onsubmit="handleAddComment(event, '${m.id}')" class="flex gap-2 pt-1">
                        <input type="text" placeholder="Type a message..." required class="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-teal-500">
                        <button type="submit" class="bg-teal-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs hover:bg-teal-800">Send</button>
                    </form>
                </div>
            </div>
        `;
    }).join('');
}

function renderPlaces() {
    const grid = document.getElementById('placesGrid');
    if (!grid) return;

    grid.innerHTML = state.places.map(p => `
        <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3 hover:shadow-md transition-all">
            <div class="flex items-start justify-between">
                <span class="bg-teal-50 text-teal-700 text-[11px] font-bold px-2.5 py-1 rounded-full border border-teal-100">
                    📍 ${escapeHTML(p.district)}
                </span>
                <span class="text-xs font-semibold text-slate-500">${escapeHTML(p.public_spot_type || 'Park')}</span>
            </div>
            <h3 class="font-display font-bold text-base text-slate-900">${escapeHTML(p.name)}</h3>
            <p class="text-xs text-slate-600 line-clamp-3">${escapeHTML(p.description || 'Verified local community spot.')}</p>
        </div>
    `).join('');
}

function renderToys() {
    const grid = document.getElementById('toysGrid');
    if (!grid) return;

    let filtered = state.toys;
    if (state.filters.interest) {
        filtered = filtered.filter(t => (t.category || '').toLowerCase().includes(state.filters.interest.toLowerCase()));
    }

    grid.innerHTML = filtered.map(t => {
        const itemImg = t.image_url || 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400';
        return `
            <div class="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm space-y-3 hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                    <!-- Item Photo -->
                    <div class="h-44 bg-slate-100 relative overflow-hidden">
                        <img src="${itemImg}" alt="${escapeHTML(t.title)}" class="w-full h-full object-cover hover:scale-105 transition-transform duration-500" onerror="this.src='https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400'">
                        <span class="absolute top-3 left-3 bg-amber-500 text-slate-900 text-[11px] font-extrabold px-2.5 py-1 rounded-full shadow">
                            ${escapeHTML(t.category || 'Exchange')}
                        </span>
                        <span class="absolute top-3 right-3 bg-teal-800 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow">
                            📍 ${escapeHTML(t.district)}
                        </span>
                    </div>

                    <div class="p-4 space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-[11px] font-extrabold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                                ${escapeHTML(t.condition || 'Gently Used')}
                            </span>
                            ${t.school_name ? `<span class="text-[11px] font-bold text-slate-500">🏫 ${escapeHTML(t.school_name)}</span>` : ''}
                        </div>

                        <h3 class="font-display font-bold text-base text-slate-900 leading-snug">${escapeHTML(t.title)}</h3>
                        <p class="text-xs text-slate-600 line-clamp-2">${escapeHTML(t.description || 'Pass-along item for neighborhood families.')}</p>
                    </div>
                </div>

                <div class="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <span class="text-xs font-medium text-slate-500">Listed by <strong>${escapeHTML(t.user_name || 'Local Parent')}</strong></span>
                    <a href="tel:${t.user_phone || ''}" class="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all inline-flex items-center gap-1">
                        <span class="material-symbols-outlined text-sm">chat</span>
                        <span>Contact</span>
                    </a>
                </div>
            </div>
        `;
    }).join('');
}

function renderLostFound() {
    const grid = document.getElementById('lostFoundGrid');
    if (!grid) return;

    grid.innerHTML = state.lostFound.map(lf => `
        <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
            <span class="inline-block bg-rose-100 text-rose-700 text-[11px] font-bold px-2.5 py-1 rounded-full">${escapeHTML(lf.status || 'Lost')}</span>
            <h3 class="font-display font-bold text-base text-slate-900">${escapeHTML(lf.item_name || lf.title)}</h3>
            <p class="text-xs text-slate-600">${escapeHTML(lf.location || lf.district)}</p>
        </div>
    `).join('');
}

async function handleCreateMeetup(e) {
    e.preventDefault();
    if (!state.user) {
        openModal('authModal');
        showToast('Please sign in to post playdates');
        return;
    }

    const payload = {
        title: document.getElementById('meetupTitle').value,
        district: document.getElementById('meetupDistrict').value,
        interest_tag: document.getElementById('meetupInterest').value,
        public_location: document.getElementById('meetupLocation').value,
        date_time: document.getElementById('meetupDateTime').value,
        max_attendees: parseInt(document.getElementById('meetupMaxAttendees').value) || 10,
        min_age: 0,
        max_age: 18,
        image_url: document.getElementById('meetupImageUrl').value || '/assets/logo-full.png'
    };

    try {
        const res = await fetch('/api/meetups', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            closeModal('createMeetupModal');
            showToast('Playdate created successfully!');
            await loadCurrentTabData();
        } else {
            alert(data.error || 'Failed to create playdate');
        }
    } catch (err) {
        alert('Error publishing playdate');
    }
}

async function handleCreateToy(e) {
    e.preventDefault();
    if (!state.user) {
        openModal('authModal');
        showToast('Please sign in to list exchange items');
        return;
    }

    const payload = {
        title: document.getElementById('toyTitle').value,
        category: document.getElementById('toyCategory').value,
        district: document.getElementById('toyDistrict').value,
        school_name: document.getElementById('toySchoolName').value || '',
        condition: document.getElementById('toyCondition').value,
        description: document.getElementById('toyDescription').value || '',
        image_url: document.getElementById('toyImageUrl').value || 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400'
    };

    try {
        const res = await fetch('/api/toys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            closeModal('createToyModal');
            showToast('Item listed for Exchange!');
            switchTab('toys');
            await loadCurrentTabData();
        } else {
            alert(data.error || 'Failed to list item');
        }
    } catch (err) {
        alert('Error listing exchange item');
    }
}

async function handleCreatePlace(e) {
    e.preventDefault();
    const payload = {
        name: document.getElementById('placeName').value,
        district: document.getElementById('placeDistrict').value,
        public_spot_type: document.getElementById('placeSpotType').value,
        description: document.getElementById('placeDescription').value
    };

    try {
        const res = await fetch('/api/places', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            closeModal('createPlaceModal');
            showToast('Spot saved!');
            await loadCurrentTabData();
        }
    } catch (err) {
        alert('Error saving spot');
    }
}

async function handleRSVP(meetupId) {
    if (!state.user) {
        openModal('authModal');
        showToast('Please sign in to join playdates');
        return;
    }

    try {
        const res = await fetch(`/api/meetups/${meetupId}/rsvp`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const data = await res.json();
        if (data.success) {
            showToast('RSVP updated!');
            await loadCurrentTabData();
        }
    } catch (err) {
        alert('Error updating RSVP');
    }
}

async function handleAddComment(e, meetupId) {
    e.preventDefault();
    if (!state.user) {
        openModal('authModal');
        return;
    }
    const input = e.target.querySelector('input');
    const content = input.value.trim();
    if (!content) return;

    try {
        const res = await fetch(`/api/meetups/${meetupId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({ content })
        });
        const data = await res.json();
        if (data.success) {
            input.value = '';
            await loadCurrentTabData();
        }
    } catch (err) {
        alert('Error adding comment');
    }
}

function toggleComments(meetupId) {
    const drawer = document.getElementById(`comments-${meetupId}`);
    if (drawer) drawer.classList.toggle('hidden');
}

function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

function clearFilters() {
    state.filters.district = '';
    state.filters.interest = '';
    state.filters.search = '';
    const d1 = document.getElementById('districtFilter');
    const i1 = document.getElementById('interestFilter');
    const s1 = document.getElementById('searchInput');
    if (d1) d1.value = '';
    if (i1) i1.value = '';
    if (s1) s1.value = '';
    renderCurrentTab();
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-slate-700 animate-bounce';
    toast.innerHTML = `<span class="material-symbols-outlined text-amber-400 text-base">info</span> <span>${escapeHTML(msg)}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
