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
    authMode: 'login',
    theme: localStorage.getItem('ld_theme') || 'light'
};

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    initTheme();
    setupEventListeners();
    if (state.token) {
        await checkCurrentUser();
    }
    await loadCurrentTabData();
}

function initTheme() {
    setTheme(state.theme);
}

function toggleTheme() {
    const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    setTheme(newTheme);
}

function setTheme(theme) {
    state.theme = theme;
    const icon = document.getElementById('themeIcon');
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        if (icon) icon.textContent = 'light_mode';
        localStorage.setItem('ld_theme', 'dark');
    } else {
        document.documentElement.classList.remove('dark');
        if (icon) icon.textContent = 'dark_mode';
        localStorage.setItem('ld_theme', 'light');
    }
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
                <img src="${state.user.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(state.user.name)}" alt="${escapeHTML(state.user.name)}" class="w-8 h-8 rounded-full border-2 border-teal-500 object-cover cursor-pointer" onclick="openAccountSettings()">
                <div class="hidden sm:block text-left cursor-pointer" onclick="openAccountSettings()">
                    <span class="block text-xs font-bold leading-none">${escapeHTML(state.user.name)}</span>
                    <span class="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">${escapeHTML(state.user.district || 'Dubai')}</span>
                </div>
                <button onclick="openAccountSettings()" class="p-1 text-slate-500 hover:text-teal-600 transition-colors" title="Account Settings">
                    <span class="material-symbols-outlined text-lg">settings</span>
                </button>
                <button onclick="logout()" class="p-1 text-slate-400 hover:text-rose-600 transition-colors" title="Log Out">
                    <span class="material-symbols-outlined text-lg">logout</span>
                </button>
            </div>
        `;
    } else {
        section.innerHTML = `
            <button onclick="openModal('authModal')" class="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-xs font-bold transition-colors">
                <span class="material-symbols-outlined text-lg text-teal-600">account_circle</span>
                <span class="hidden sm:inline">Sign In</span>
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
    const phoneField = document.getElementById('phoneField');
    const districtField = document.getElementById('districtAuthField');
    const submitBtn = document.getElementById('authSubmitBtn');
    const toggleBtn = document.getElementById('authToggleBtn');

    if (state.authMode === 'register') {
        if (nameField) nameField.classList.remove('hidden');
        if (phoneField) phoneField.classList.remove('hidden');
        if (districtField) districtField.classList.remove('hidden');
        if (submitBtn) submitBtn.textContent = 'Create Parent Account';
        if (toggleBtn) toggleBtn.textContent = 'Already have an account? Sign In';
    } else {
        if (nameField) nameField.classList.add('hidden');
        if (phoneField) phoneField.classList.add('hidden');
        if (districtField) districtField.classList.add('hidden');
        if (submitBtn) submitBtn.textContent = 'Sign In';
        if (toggleBtn) toggleBtn.textContent = 'Need an account? Register here';
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
        payload.phone = document.getElementById('authPhone').value;
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
            msgEl.textContent = 'Server error. Please check network connection and try again.';
            alertEl.classList.remove('hidden');
        } else {
            alert('Server error. Please try again.');
        }
    }
}

// --- ACCOUNT SETTINGS PROFILE ---
function openAccountSettings(requirePhone = false) {
    if (!state.user) {
        openModal('authModal');
        return;
    }
    const phoneAlert = document.getElementById('phoneRequireAlert');
    if (phoneAlert) {
        if (requirePhone) phoneAlert.classList.remove('hidden');
        else phoneAlert.classList.add('hidden');
    }
    const nameIn = document.getElementById('profileName');
    const phoneIn = document.getElementById('profilePhone');
    const distIn = document.getElementById('profileDistrict');
    const bioIn = document.getElementById('profileBio');
    const avatarIn = document.getElementById('profileAvatarUrl');

    if (nameIn) nameIn.value = state.user.name || '';
    if (phoneIn) phoneIn.value = state.user.phone || '';
    if (distIn) distIn.value = state.user.district || 'Dubai Hills';
    if (bioIn) bioIn.value = state.user.bio || '';
    if (avatarIn) avatarIn.value = state.user.avatar_url || '';

    const previewEl = document.getElementById('profileAvatarPreview');
    if (previewEl && state.user.avatar_url) {
        previewEl.classList.remove('hidden');
        const img = previewEl.querySelector('img');
        if (img) img.src = state.user.avatar_url;
    }

    const modal = document.getElementById('accountSettingsModal');
    if (modal) modal.classList.remove('hidden');
}

async function handleSaveProfile(e) {
    e.preventDefault();
    if (!state.user) return;

    const payload = {
        name: document.getElementById('profileName').value,
        phone: document.getElementById('profilePhone').value,
        district: document.getElementById('profileDistrict').value,
        avatar_url: document.getElementById('profileAvatarUrl').value || state.user.avatar_url,
        bio: document.getElementById('profileBio').value
    };

    try {
        const res = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success && data.user) {
            state.user = data.user;
            updateUserUI();
            closeModal('accountSettingsModal');
            showToast('Account profile updated successfully!');
            await loadCurrentTabData();
        } else {
            alert(data.error || 'Failed to update profile');
        }
    } catch (err) {
        alert('Error saving profile');
    }
}

function switchTab(tabName) {
    state.currentTab = tabName;

    // Desktop nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        const isSelected = btn.dataset.tab === tabName;
        if (isSelected) {
            btn.className = 'nav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-teal-800 bg-teal-50 shadow-sm border border-teal-100/60 transition-all';
            const icon = btn.querySelector('.material-symbols-outlined');
            if (icon) icon.className = 'material-symbols-outlined text-xl text-teal-600';
        } else {
            btn.className = 'nav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all';
            const icon = btn.querySelector('.material-symbols-outlined');
            if (icon) icon.className = 'material-symbols-outlined text-xl text-slate-400';
        }
    });

    // Mobile bottom nav buttons
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        const isSelected = btn.dataset.tab === tabName;
        if (isSelected) {
            btn.className = 'mobile-nav-btn flex flex-col items-center gap-1 text-[11px] font-extrabold text-teal-700 dark:text-teal-400 transition-all scale-105';
        } else {
            btn.className = 'mobile-nav-btn flex flex-col items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-teal-700 transition-all';
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
            <div class="col-span-full py-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                <span class="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">event_busy</span>
                <p class="text-sm font-bold text-slate-600 dark:text-slate-300 mt-2">No playdates found matching filters</p>
                <button onclick="clearFilters()" class="mt-3 text-xs font-bold text-teal-700 dark:text-teal-400 hover:underline">+ Clear Search Filters</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(m => {
        const rsvps = m.rsvps || [];
        const isAttending = state.user && rsvps.some(r => r.user_id === state.user.id);
        const hasCustomImg = Boolean(m.image_url && m.image_url.trim() !== '' && !m.image_url.includes('logo-full.png'));

        return `
            <div class="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-700 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                    ${hasCustomImg ? `
                        <!-- Card Cover Photo -->
                        <div class="h-44 sm:h-48 bg-slate-900 relative overflow-hidden">
                            <img src="${m.image_url}" alt="${escapeHTML(m.title)}" class="w-full h-full object-cover opacity-95 hover:scale-105 transition-transform duration-500">
                            <span class="absolute top-3 left-3 bg-teal-900/90 backdrop-blur-md text-white text-[10px] sm:text-[11px] font-bold px-2.5 py-1 rounded-full shadow">
                                📍 ${escapeHTML(m.district)}
                            </span>
                            <span class="absolute top-3 right-3 bg-amber-500 text-slate-900 text-[10px] sm:text-[11px] font-extrabold px-2.5 py-1 rounded-full shadow">
                                ${escapeHTML(m.interest_tag || 'Activity')}
                            </span>
                        </div>
                    ` : ''}

                    <!-- Card Body -->
                    <div class="p-4 sm:p-5 space-y-3">
                        ${!hasCustomImg ? `
                            <div class="flex items-center justify-between gap-2">
                                <span class="bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 text-[10px] sm:text-[11px] font-bold px-2.5 py-1 rounded-full">
                                    📍 ${escapeHTML(m.district)}
                                </span>
                                <span class="bg-amber-500 text-slate-900 text-[10px] sm:text-[11px] font-extrabold px-2.5 py-1 rounded-full">
                                    ${escapeHTML(m.interest_tag || 'Activity')}
                                </span>
                            </div>
                        ` : ''}

                        <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                            <img src="${m.host_avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(m.host_name || 'Parent')}" class="w-6 h-6 rounded-full border border-teal-500 object-cover shrink-0">
                            <span class="truncate">Hosted by <strong class="text-slate-700 dark:text-slate-200">${escapeHTML(m.host_name || 'Parent')}</strong></span>
                        </div>

                        <h3 class="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-slate-100 leading-snug hover:text-teal-700 transition-colors cursor-pointer" onclick="toggleComments('${m.id}')">
                            ${escapeHTML(m.title)}
                        </h3>

                        <div class="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-teal-600 dark:text-teal-400 text-base sm:text-lg">calendar_month</span>
                                <span>${escapeHTML(m.date_time)}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-teal-600 dark:text-teal-400 text-base sm:text-lg">location_on</span>
                                <span class="truncate">${escapeHTML(m.public_location)}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-amber-500 text-base sm:text-lg">face</span>
                                <span>Ages: ${m.min_age || 0} - ${m.max_age || 16} years</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer & RSVP -->
                <div class="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div class="flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-teal-600 dark:text-teal-400 text-base">group</span>
                        <span class="text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300">${rsvps.length} / ${m.max_attendees || 10} Attending</span>
                    </div>

                    <div class="flex items-center gap-2">
                        <button onclick="toggleComments('${m.id}')" class="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition-colors" title="Comments">
                            <span class="material-symbols-outlined text-lg">chat</span>
                        </button>
                        <button onclick="handleRSVP('${m.id}')" class="${isAttending ? 'bg-amber-500 text-slate-900' : 'bg-teal-700 hover:bg-teal-800 text-white'} text-xs font-bold px-3.5 sm:px-4 py-2 rounded-xl transition-all shadow-sm">
                            ${isAttending ? '✓ Attending' : '+ Join RSVP'}
                        </button>
                    </div>
                </div>

                <!-- Comments Drawer -->
                <div id="comments-${m.id}" class="hidden p-4 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 space-y-3">
                    <h4 class="font-display font-bold text-xs text-slate-700 dark:text-slate-300">Discussion & Parent Q&A</h4>
                    <div class="space-y-2 max-h-40 overflow-y-auto pr-1 text-xs">
                        ${(m.comments || []).length > 0 ? (m.comments || []).map(c => `
                            <div class="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                <span class="font-bold text-teal-800 dark:text-teal-400">${escapeHTML(c.user_name)}:</span>
                                <span class="text-slate-700 dark:text-slate-300">${escapeHTML(c.content)}</span>
                            </div>
                        `).join('') : '<p class="text-[11px] text-slate-400 italic">No comments yet. Ask a question below!</p>'}
                    </div>

                    <form onsubmit="handleAddComment(event, '${m.id}')" class="flex gap-2 pt-1">
                        <input type="text" placeholder="Type a message..." required class="flex-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-teal-500">
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
        <div class="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-700 shadow-xs space-y-3 hover:shadow-md transition-all">
            <div class="flex items-start justify-between">
                <span class="bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 text-[11px] font-bold px-2.5 py-1 rounded-full border border-teal-100 dark:border-teal-900">
                    📍 ${escapeHTML(p.district)}
                </span>
                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">${escapeHTML(p.public_spot_type || 'Park')}</span>
            </div>
            <h3 class="font-display font-bold text-base text-slate-900 dark:text-slate-100">${escapeHTML(p.name)}</h3>
            <p class="text-xs text-slate-600 dark:text-slate-300 line-clamp-3">${escapeHTML(p.description || 'Verified local community spot.')}</p>
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
        const hasCustomImg = Boolean(t.image_url && t.image_url.trim() !== '');

        return `
            <div class="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs space-y-3 hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                    ${hasCustomImg ? `
                        <!-- Item Photo -->
                        <div class="h-44 bg-slate-900 relative overflow-hidden">
                            <img src="${t.image_url}" alt="${escapeHTML(t.title)}" class="w-full h-full object-cover hover:scale-105 transition-transform duration-500">
                            <span class="absolute top-3 left-3 bg-amber-500 text-slate-900 text-[11px] font-extrabold px-2.5 py-1 rounded-full shadow">
                                ${escapeHTML(t.category || 'Exchange')}
                            </span>
                            <span class="absolute top-3 right-3 bg-teal-800 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow">
                                📍 ${escapeHTML(t.district)}
                            </span>
                        </div>
                    ` : ''}

                    <div class="p-4 space-y-2">
                        ${!hasCustomImg ? `
                            <div class="flex items-center justify-between gap-2">
                                <span class="bg-amber-500 text-slate-900 text-[11px] font-extrabold px-2.5 py-1 rounded-full">
                                    ${escapeHTML(t.category || 'Exchange')}
                                </span>
                                <span class="bg-teal-800 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                                    📍 ${escapeHTML(t.district)}
                                </span>
                            </div>
                        ` : ''}

                        <div class="flex items-center justify-between pt-1">
                            <span class="text-[11px] font-extrabold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded-md border border-teal-100 dark:border-teal-900">
                                ${escapeHTML(t.condition || 'Gently Used')}
                            </span>
                            ${t.school_name ? `<span class="text-[11px] font-bold text-slate-500 dark:text-slate-400">🏫 ${escapeHTML(t.school_name)}</span>` : ''}
                        </div>

                        <h3 class="font-display font-bold text-base text-slate-900 dark:text-slate-100 leading-snug">${escapeHTML(t.title)}</h3>
                        <p class="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">${escapeHTML(t.description || 'Pass-along item for neighborhood families.')}</p>
                    </div>
                </div>

                <div class="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div class="flex flex-col text-xs font-medium text-slate-500 dark:text-slate-400">
                        <span>Listed by <strong>${escapeHTML(t.user_name || 'Local Parent')}</strong></span>
                        <span class="text-teal-700 dark:text-teal-400 font-bold text-[11px]">📱 ${escapeHTML(t.user_phone || t.user_contact || 'Number required')}</span>
                    </div>
                    <a href="tel:${t.user_phone || t.user_contact || ''}" class="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all inline-flex items-center gap-1 shadow-xs">
                        <span class="material-symbols-outlined text-sm">call</span>
                        <span>${escapeHTML(t.user_phone || t.user_contact || 'Contact Poster')}</span>
                    </a>
                </div>
            </div>
        `;
    }).join('');
}

function renderLostFound() {
    const grid = document.getElementById('lostFoundGrid');
    if (!grid) return;

    grid.innerHTML = state.lostFound.map(lf => {
        const hasCustomImg = Boolean(lf.image_url && lf.image_url.trim() !== '');

        return `
            <div class="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs space-y-3 hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                    ${hasCustomImg ? `
                        <div class="h-44 bg-slate-900 relative overflow-hidden">
                            <img src="${lf.image_url}" alt="${escapeHTML(lf.title || lf.item_name)}" class="w-full h-full object-cover">
                            <span class="absolute top-3 left-3 bg-rose-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow">
                                ${escapeHTML(lf.status || 'Lost')}
                            </span>
                            <span class="absolute top-3 right-3 bg-teal-800 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow">
                                📍 ${escapeHTML(lf.district)}
                            </span>
                        </div>
                    ` : ''}

                    <div class="p-4 space-y-2">
                        ${!hasCustomImg ? `
                            <div class="flex items-center justify-between">
                                <span class="bg-rose-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                                    ${escapeHTML(lf.status || 'Lost')}
                                </span>
                                <span class="bg-teal-800 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                                    📍 ${escapeHTML(lf.district)}
                                </span>
                            </div>
                        ` : ''}
                        <h3 class="font-display font-bold text-base text-slate-900 dark:text-slate-100">${escapeHTML(lf.title || lf.item_name)}</h3>
                        <p class="text-xs text-slate-600 dark:text-slate-300">${escapeHTML(lf.location_detail || lf.location || lf.district)}</p>
                    </div>
                </div>

                <div class="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div class="flex flex-col text-xs font-medium text-slate-500 dark:text-slate-400">
                        <span>Reported by <strong>${escapeHTML(lf.reported_by || 'Resident')}</strong></span>
                        <span class="text-teal-700 dark:text-teal-400 font-bold text-[11px]">📱 ${escapeHTML(lf.user_phone || lf.user_contact || 'Number required')}</span>
                    </div>
                    <a href="tel:${lf.user_phone || lf.user_contact || ''}" class="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all inline-flex items-center gap-1 shadow-xs">
                        <span class="material-symbols-outlined text-sm">call</span>
                        <span>Call Poster</span>
                    </a>
                </div>
            </div>
        `;
    }).join('');
}

async function handleCreateMeetup(e) {
    e.preventDefault();
    if (!state.user) {
        openModal('authModal');
        showToast('Please sign in to post playdates');
        return;
    }
    if (!state.user.phone || !state.user.phone.trim()) {
        openAccountSettings(true);
        showToast('Phone number required before posting playdates');
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
        image_url: document.getElementById('meetupImageUrl').value || ''
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
    if (!state.user.phone || !state.user.phone.trim()) {
        openAccountSettings(true);
        showToast('Phone number required before listing exchange items');
        return;
    }

    const payload = {
        title: document.getElementById('toyTitle').value,
        category: document.getElementById('toyCategory').value,
        district: document.getElementById('toyDistrict').value,
        school_name: document.getElementById('toySchoolName').value || '',
        condition: document.getElementById('toyCondition').value,
        description: document.getElementById('toyDescription').value || '',
        image_url: document.getElementById('toyImageUrl').value || ''
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
    if (!state.user) {
        openModal('authModal');
        return;
    }
    if (!state.user.phone || !state.user.phone.trim()) {
        openAccountSettings(true);
        showToast('Phone number required before sharing spots');
        return;
    }

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
    const postingModals = ['createMeetupModal', 'createToyModal', 'createPlaceModal', 'createLostFoundModal'];
    if (postingModals.includes(id)) {
        if (!state.user) {
            openModal('authModal');
            showToast('Please sign in to publish posts');
            return;
        }
        if (!state.user.phone || !state.user.phone.trim()) {
            openAccountSettings(true);
            showToast('Phone number required before publishing posts');
            return;
        }
    }
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

// --- DISTRICTBOT AI ASSISTANT CLIENT HANDLERS ---
function openDistrictBotModal() {
    openModal('districtBotModal');
}

function sendDistrictBotPrompt(promptText) {
    const input = document.getElementById('districtBotInput');
    if (input) {
        input.value = promptText;
        handleDistrictBotSubmit(new Event('submit', { cancelable: true, bubbles: true }));
    }
}

async function handleDistrictBotSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById('districtBotInput');
    const msgContainer = document.getElementById('districtBotMessages');
    if (!input || !msgContainer) return;

    const userText = input.value.trim();
    if (!userText) return;

    // Append user message
    msgContainer.innerHTML += `
        <div class="flex items-start justify-end gap-2 text-xs">
            <div class="bg-teal-700 text-white p-3 rounded-2xl max-w-[85%] leading-relaxed">
                ${escapeHTML(userText)}
            </div>
        </div>
    `;
    input.value = '';
    msgContainer.scrollTop = msgContainer.scrollHeight;

    // Typing indicator
    const typingId = 'typing_' + Date.now();
    msgContainer.innerHTML += `
        <div id="${typingId}" class="flex items-start gap-2 text-xs">
            <div class="w-7 h-7 rounded-full bg-teal-700 flex items-center justify-center text-amber-300 shrink-0 text-sm">
                <span class="material-symbols-outlined text-base animate-spin">progress_activity</span>
            </div>
            <div class="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-2xl text-slate-500 text-xs italic">
                DistrictBot is thinking...
            </div>
        </div>
    `;
    msgContainer.scrollTop = msgContainer.scrollHeight;

    try {
        const res = await fetch('/api/bot/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userText })
        });
        const data = await res.json();
        const indicator = document.getElementById(typingId);
        if (indicator) indicator.remove();

        const botReply = data.reply || "I am DistrictBot, your friendly LittleDistrict AI assistant!";
        msgContainer.innerHTML += `
            <div class="flex items-start gap-2.5 text-xs">
                <div class="w-7 h-7 rounded-full bg-teal-700 flex items-center justify-center text-amber-300 shrink-0 text-sm">
                    <span class="material-symbols-outlined text-base">smart_toy</span>
                </div>
                <div class="bg-teal-50 dark:bg-teal-950/60 p-3 rounded-2xl border border-teal-100 dark:border-teal-900 text-slate-800 dark:text-slate-200 leading-relaxed max-w-[85%]">
                    ${escapeHTML(botReply)}
                </div>
            </div>
        `;
        msgContainer.scrollTop = msgContainer.scrollHeight;
    } catch (err) {
        const indicator = document.getElementById(typingId);
        if (indicator) indicator.remove();
        msgContainer.innerHTML += `
            <div class="flex items-start gap-2.5 text-xs">
                <div class="w-7 h-7 rounded-full bg-teal-700 flex items-center justify-center text-amber-300 shrink-0 text-sm">
                    <span class="material-symbols-outlined text-base">smart_toy</span>
                </div>
                <div class="bg-rose-50 dark:bg-rose-950 p-3 rounded-2xl text-rose-800 dark:text-rose-200 leading-relaxed max-w-[85%]">
                    DistrictBot is temporarily offline. Please try asking again in a moment!
                </div>
            </div>
        `;
        msgContainer.scrollTop = msgContainer.scrollHeight;
    }
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
    toast.className = 'fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-slate-700 animate-bounce';
    toast.innerHTML = `<span class="material-symbols-outlined text-amber-400 text-base">info</span> <span>${escapeHTML(msg)}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

