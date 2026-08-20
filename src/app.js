async function handleDeletePost(type, id) {
    if (!state.user) {
        showToast('Please sign in to remove posts');
        return;
    }

    if (!confirm('Are you sure you want to remove this post?')) return;

    let endpoint = '';
    if (type === 'lostFound') endpoint = `/api/lost-found/${id}`;
    else if (type === 'meetup') endpoint = `/api/meetups/${id}`;
    else if (type === 'toy') endpoint = `/api/toys/${id}`;
    else if (type === 'place') endpoint = `/api/places/${id}`;
    else return;

    try {
        const res = await fetch(endpoint, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${state.token}`
            }
        });
        const data = await res.json();
        if (data.success) {
            showToast('Post removed successfully!');
            await loadCurrentTabData();
        } else {
            alert(data.error || 'Failed to remove post');
        }
    } catch (err) {
        console.error('Error removing post:', err);
        alert('Error removing post');
    }
}


// Dubai Community Kids Client Application Logic

let state = {
    currentTab: 'feed',
    user: (() => {
        try {
            const cached = localStorage.getItem('ld_user');
            return cached ? JSON.parse(cached) : null;
        } catch (e) {
            return null;
        }
    })(),
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
    updateUserUI(); // Render user session immediately from localStorage
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

function handleMobileSearch(e) {
    state.filters.search = e.target.value.toLowerCase().trim();
    renderCurrentTab();
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

function removeImagePreview(previewId, inputId, fileInputId) {
    const inputEl = document.getElementById(inputId);
    const previewEl = document.getElementById(previewId);
    const fileEl = document.getElementById(fileInputId);
    
    if (inputEl) inputEl.value = '';
    if (fileEl) fileEl.value = '';
    if (previewEl) {
        previewEl.classList.add('hidden');
        const img = previewEl.querySelector('img');
        if (img) img.src = '';
    }
}

function saveUserSession(token, user) {
    if (token) {
        state.token = token;
        localStorage.setItem('ld_token', token);
    }
    if (user) {
        // Merge with existing state.user so user name, district, avatar, and credentials are never lost
        state.user = { ...(state.user || {}), ...user };
        localStorage.setItem('ld_user', JSON.stringify(state.user));
    }
    updateUserUI();
}

async function checkCurrentUser() {
    try {
        const res = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const data = await res.json();
        if (data.success && data.user) {
            saveUserSession(null, data.user);
        }
    } catch (err) {
        console.error('Auth check background sync failed:', err);
    }
}

function updateUserUI() {
    const section = document.getElementById('userAccountSection');
    if (!section) return;

    if (state.user) {
        const isVerified = state.user.is_verified;
        const isDev = state.user.is_developer;
        section.innerHTML = `
            <div class="flex items-center gap-2">
                <div class="relative cursor-pointer" onclick="openAccountSettings()">
                    <img src="${state.user.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(state.user.name)}" alt="${escapeHTML(state.user.name)}" class="w-8 h-8 rounded-full border-2 ${isDev ? 'border-teal-900' : isVerified ? 'border-emerald-500' : 'border-teal-500'} object-cover">
                    ${isDev ? `<span class="absolute -bottom-1 -right-1 bg-slate-900 text-teal-400 rounded-full p-0.5 shadow-xs" title="Official Developer"><span class="material-symbols-outlined text-[10px] leading-none block">code</span></span>` : isVerified ? `<span class="absolute -bottom-1 -right-1 bg-emerald-600 text-white rounded-full p-0.5 shadow-xs"><span class="material-symbols-outlined text-[10px] leading-none block">verified</span></span>` : ''}
                </div>
                <div class="hidden sm:block text-left cursor-pointer" onclick="openAccountSettings()">
                    <div class="flex items-center gap-1">
                        <span class="block text-xs font-bold leading-none text-slate-800">${escapeHTML(state.user.name)}</span>
                        ${isDev ? `<span class="bg-slate-900 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border border-teal-700 flex items-center gap-0.5" title="Official Developer Badge"><span class="material-symbols-outlined text-[10px] text-teal-400">code</span> Dev</span>` : isVerified ? `<span class="material-symbols-outlined text-xs text-emerald-600" title="Verified Neighbor">verified</span>` : ''}
                    </div>
                    <span class="text-[10px] text-teal-600 font-semibold">${escapeHTML(state.user.district || 'Dubai')}</span>
                </div>
                <button onclick="openModal('developerAssistantModal')" class="p-1 text-teal-700 hover:text-teal-900 transition-colors" title="Developer Badge Assistant">
                    <span class="material-symbols-outlined text-lg">code</span>
                </button>
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
            <button onclick="openModal('authModal')" class="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-full text-xs font-bold transition-colors">
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
    localStorage.removeItem('ld_user');
    updateUserUI();
    showToast('Logged out successfully');
}

function toggleAuthMode() {
    state.authMode = state.authMode === 'login' ? 'register' : 'login';
    const nameField = document.getElementById('nameField');
    const phoneField = document.getElementById('phoneField');
    const districtField = document.getElementById('districtAuthField');
    const avatarField = document.getElementById('authAvatarSection');
    const submitBtn = document.getElementById('authSubmitBtn');
    const toggleBtn = document.getElementById('authToggleBtn');

    if (state.authMode === 'register') {
        if (nameField) nameField.classList.remove('hidden');
        if (phoneField) phoneField.classList.remove('hidden');
        if (districtField) districtField.classList.remove('hidden');
        if (avatarField) avatarField.classList.remove('hidden');
        if (submitBtn) submitBtn.textContent = 'Create Parent Account';
        if (toggleBtn) toggleBtn.textContent = 'Already have an account? Sign In';
    } else {
        if (nameField) nameField.classList.add('hidden');
        if (phoneField) phoneField.classList.add('hidden');
        if (districtField) districtField.classList.add('hidden');
        if (avatarField) avatarField.classList.add('hidden');
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
        payload.avatar_url = document.getElementById('authAvatarUrl')?.value || '';
    }

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success && data.token) {
            saveUserSession(data.token, data.user);
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

// --- RESIDENCY VERIFICATION SYSTEM ---
function toggleVerifyMethodFields(methodVal) {
    const docSec = document.getElementById('verifyDocSection');
    const codeSec = document.getElementById('verifyCodeSection');
    if (methodVal === 'Neighborhood Code') {
        if (docSec) docSec.classList.add('hidden');
        if (codeSec) codeSec.classList.remove('hidden');
    } else {
        if (docSec) docSec.classList.remove('hidden');
        if (codeSec) codeSec.classList.add('hidden');
    }
}

async function handleSubmitVerification(e) {
    e.preventDefault();
    if (!state.user) {
        openModal('authModal');
        return;
    }

    const alertEl = document.getElementById('verifyErrorAlert');
    const msgEl = document.getElementById('verifyErrorMsg');
    if (alertEl) alertEl.classList.add('hidden');

    const method = document.getElementById('verifyMethod')?.value || 'Ejari Lease Contract';
    const docUrl = document.getElementById('verifyDocUrl')?.value || '';
    const codeVal = document.getElementById('verifyCodeInput')?.value?.trim() || '';

    if (method === 'Neighborhood Code') {
        if (!codeVal || codeVal.length < 4) {
            if (alertEl && msgEl) {
                msgEl.textContent = 'Please enter a valid 6-digit Neighborhood Verification Code.';
                alertEl.classList.remove('hidden');
            } else {
                alert('Please enter a valid Neighborhood Verification Code.');
            }
            return;
        }
    } else {
        if (!docUrl || docUrl.trim() === '') {
            if (alertEl && msgEl) {
                msgEl.textContent = 'Photo upload required! Please attach a photo of your Ejari lease contract or DEWA bill to complete verification.';
                alertEl.classList.remove('hidden');
            } else {
                alert('Photo upload required! Please attach a photo of your Ejari lease contract or DEWA bill.');
            }
            return;
        }
    }

    try {
        const res = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({
                verification_method: method,
                verification_document: docUrl
            })
        });
        const data = await res.json();
        if (data.success && data.user) {
            saveUserSession(null, data.user);
            closeModal('verificationModal');
            showToast('🛡️ Congratulations! You are now a Verified Resident Neighbor!');
            await loadCurrentTabData();
        } else {
            if (alertEl && msgEl) {
                msgEl.textContent = data.error || 'Verification failed. Please upload a photo of your document.';
                alertEl.classList.remove('hidden');
            } else {
                alert(data.error || 'Verification failed');
            }
        }
    } catch (err) {
        alert('Error completing verification');
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

    // Residency status box update
    const statusBox = document.getElementById('verificationStatusBox');
    if (statusBox) {
        if (state.user.is_verified) {
            statusBox.className = 'p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/80 flex items-center justify-between gap-3 text-xs';
            statusBox.innerHTML = `
                <div class="flex items-center gap-2.5 text-emerald-900">
                    <span class="material-symbols-outlined text-2xl text-emerald-600">verified</span>
                    <div>
                        <span class="font-extrabold block text-sm leading-tight text-emerald-950">Verified Neighbor ✅</span>
                        <span class="text-[11px] text-emerald-700 font-medium">Confirmed via ${escapeHTML(state.user.verification_method || 'Ejari Contract')}</span>
                    </div>
                </div>
                <span class="bg-emerald-600 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-2xs">Verified</span>
            `;
        } else {
            statusBox.className = 'p-3.5 rounded-2xl border border-amber-200 bg-amber-50/70 flex items-center justify-between gap-3 text-xs';
            statusBox.innerHTML = `
                <div class="flex items-center gap-2.5 text-amber-950">
                    <span class="material-symbols-outlined text-2xl text-amber-600">shield</span>
                    <div>
                        <span class="font-bold block leading-tight">Unverified Resident</span>
                        <span class="text-[11px] text-amber-800 font-medium">Verify Ejari or DEWA to earn badge</span>
                    </div>
                </div>
                <button type="button" onclick="closeModal('accountSettingsModal'); openModal('verificationModal');" class="bg-[#006654] hover:bg-[#005243] text-white text-[11px] font-bold px-3.5 py-1.5 rounded-full transition-all shadow-xs shrink-0">
                    Verify Now 🛡️
                </button>
            `;
        }
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
            saveUserSession(null, data.user);
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
    updateDynamicFilterOptions();
}

function updateDynamicFilterOptions() {
    const defaultDistricts = ['Dubai Hills', 'Arabian Ranches', 'JBR & Marina', 'Mirdif', 'Silicon Oasis', 'Downtown Dubai', 'Palm Jumeirah', 'Damac Hills', 'Business Bay', 'Jumeirah Village Circle (JVC)', 'Abu Dhabi', 'Sharjah'];
    const customDistricts = new Set(defaultDistricts);

    [...state.meetups, ...state.places, ...state.toys, ...state.lostFound].forEach(item => {
        if (item.district && item.district.trim()) {
            customDistricts.add(item.district.trim());
        }
    });

    const allDistricts = Array.from(customDistricts).sort();

    const districtDatalist = document.getElementById('districtSuggestions');
    if (districtDatalist) {
        districtDatalist.innerHTML = allDistricts.map(d => `<option value="${escapeHTML(d)}">`).join('');
    }

    ['districtFilter', 'mobileDistrictFilter'].forEach(id => {
        const sel = document.getElementById(id);
        if (sel) {
            const currentVal = sel.value;
            sel.innerHTML = `<option value="">All Districts & Cities</option>` +
                allDistricts.map(d => `<option value="${escapeHTML(d)}">${escapeHTML(d)}</option>`).join('');
            sel.value = currentVal;
        }
    });

    const defaultActivities = ['Cycling', 'Swimming', 'Park Play', 'Roblox & Gaming', 'Football', 'Basketball', 'Tennis / Padel', 'Board Games', 'School Uniform', 'Books', 'Toys & Games', 'Baby Gear'];
    const customActivities = new Set(defaultActivities);

    state.meetups.forEach(m => { if (m.interest_tag) customActivities.add(m.interest_tag); });
    state.toys.forEach(t => { if (t.category) customActivities.add(t.category); });
    state.places.forEach(p => { if (p.public_spot_type) customActivities.add(p.public_spot_type); });
    state.lostFound.forEach(lf => { if (lf.category) customActivities.add(lf.category); });

    const allActivities = Array.from(customActivities).sort();

    const activityDatalist = document.getElementById('activitySuggestions');
    if (activityDatalist) {
        activityDatalist.innerHTML = allActivities.map(a => `<option value="${escapeHTML(a)}">`).join('');
    }

    const interestSel = document.getElementById('interestFilter');
    if (interestSel) {
        const currentVal = interestSel.value;
        interestSel.innerHTML = `<option value="">All Categories & Activities</option>` +
            allActivities.map(a => `<option value="${escapeHTML(a)}">${escapeHTML(a)}</option>`).join('');
        interestSel.value = currentVal;
    }
}

function renderCurrentTab() {
    if (state.currentTab === 'feed') renderMeetups();
    else if (state.currentTab === 'places') renderPlaces();
    else if (state.currentTab === 'toys') renderToys();
    else if (state.currentTab === 'lostFound') renderLostFound();
}

function togglePasswordVisibility(inputId, iconEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        iconEl.textContent = 'visibility_off';
    } else {
        input.type = 'password';
        iconEl.textContent = 'visibility';
    }
}

function openPlaydateDetail(id) {
    const meetup = state.meetups.find(m => m.id === id) || state.meetups[0];
    if (!meetup) return;

    state.activePlaydateId = meetup.id;

    // Hide all tabs
    ['feed', 'places', 'toys', 'lostFound'].forEach(t => {
        const sec = document.getElementById(`tab-${t}`);
        if (sec) sec.classList.add('hidden');
    });

    const detailSec = document.getElementById('tab-playdateDetail');
    if (detailSec) detailSec.classList.remove('hidden');

    renderPlaydateDetail(meetup);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderPlaydateDetail(m) {
    const isDevDetail = Boolean(state.user && (state.user.is_developer || state.user.role === 'admin'));
    const isOwnerDetail = Boolean(state.user && ((state.user.id && state.user.id === m.host_id) || (state.user.name && state.user.name === m.host_name)));
    const canDeleteDetail = isDevDetail || isOwnerDetail;
    const container = document.getElementById('playdateDetailContainer');
    if (!container) return;

    const rsvps = m.rsvps || [];
    const isAttending = state.user && rsvps.some(r => r.user_id === state.user.id);
    const comments = m.comments || [];

    container.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <!-- Left Main Content Column -->
            <div class="lg:col-span-2 space-y-6">
                
                <!-- Hero Header Card -->
                <div class="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6">
                    <div class="flex items-center gap-2.5 flex-wrap">
                        <span class="inline-flex items-center gap-1 bg-sky-100/80 text-sky-800 text-xs font-bold px-3 py-1 rounded-full">
                            <span class="material-symbols-outlined text-sm">location_on</span>
                            <span>${escapeHTML(m.district || 'Dubai Marina')}</span>
                        </span>
                        <span class="bg-amber-500 text-slate-900 text-xs font-extrabold px-3 py-1 rounded-full">
                            ${escapeHTML(m.interest_tag || 'Sports')}
                        </span>
                    </div>

                    <h1 class="font-serif text-2xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
                        ${escapeHTML(m.title)}
                    </h1>

                    <div class="border-t border-slate-100 pt-5 flex items-center justify-between flex-wrap gap-4">
                        <div class="flex items-center gap-3">
                            <img src="${m.host_avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(m.host_name || 'Razax')}" class="w-11 h-11 rounded-full border-2 border-teal-500 object-cover">
                            <div>
                                <span class="block text-xs text-slate-400 font-medium">Hosted by</span>
                                <span class="text-sm font-bold text-slate-800">${escapeHTML(m.host_name || 'Razax')}</span>
                            </div>
                        </div>

                        <div class="flex items-center gap-3">
                            ${canDeleteDetail ? `
                                <button onclick="handleDeletePost('meetup', '${m.id}')" title="${isDevDetail && !isOwnerDetail ? 'Developer Override: Delete Playdate' : 'Remove your playdate'}" class="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-5 py-3 rounded-full transition-all inline-flex items-center gap-1 shadow-xs">
                                    <span class="material-symbols-outlined text-sm">delete</span>
                                    <span>${isDevDetail && !isOwnerDetail ? 'Dev Delete' : 'Delete'}</span>
                                </button>
                            ` : ''}
                            <button onclick="handleRSVP('${m.id}')" class="${isAttending ? 'bg-amber-500 text-slate-900' : 'bg-[#006654] hover:bg-[#005243] text-white'} text-xs font-bold px-6 py-3 rounded-full transition-all shadow-xs">
                                ${isAttending ? '✓ Attending' : '+ Join RSVP'}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 2-Column Info Grid (Date/Time & Age) -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="bg-white rounded-2xl border border-slate-200/90 p-5 flex items-center gap-4 shadow-xs">
                        <div class="w-12 h-12 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined text-2xl">calendar_month</span>
                        </div>
                        <div>
                            <span class="block text-xs font-bold text-slate-800">Date & Time</span>
                            <span class="block text-xs font-medium text-slate-600 mt-0.5">${escapeHTML(m.date_time)}</span>
                        </div>
                    </div>

                    <div class="bg-white rounded-2xl border border-slate-200/90 p-5 flex items-center gap-4 shadow-xs">
                        <div class="w-12 h-12 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined text-2xl">face</span>
                        </div>
                        <div>
                            <span class="block text-xs font-bold text-slate-800">Age Group</span>
                            <span class="block text-xs font-medium text-slate-600 mt-0.5">${m.min_age || 4} - ${m.max_age || 8} years</span>
                        </div>
                    </div>
                </div>

                <!-- About this playdate Card -->
                <div class="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-4">
                    <h2 class="font-serif font-bold text-xl text-slate-900">About this playdate</h2>
                    <div class="text-xs sm:text-sm text-slate-600 leading-relaxed space-y-3 font-normal">
                        <p>${escapeHTML(m.description || `Join us for a fun and friendly kids' activity at ${m.public_location}! This is a casual meetup aimed at getting the kids active, teaching them basic teamwork, and mostly just having a great time running around.`)}</p>
                        <p>We'll provide water, pop-up goals, and light snacks. Parents are encouraged to bring water bottles, light snacks, and a picnic blanket to sit on while watching.</p>
                        <p>No prior experience needed, just enthusiasm! Please make sure kids are wearing comfortable sports shoes.</p>
                    </div>
                </div>

                <!-- Attending Section -->
                <div class="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-5">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined text-xl text-[#006654]">groups</span>
                            <h2 class="font-serif font-bold text-xl text-slate-900">Attending</h2>
                        </div>
                        <span class="text-xs font-bold text-slate-500">${rsvps.length} / ${m.max_attendees || 10} Spots Filled</span>
                    </div>

                    ${rsvps.length > 0 ? `
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            ${rsvps.map(r => `
                                <div class="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl flex items-center gap-2.5">
                                    <img src="${r.user_avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(r.user_name || 'Parent')}" class="w-8 h-8 rounded-full border border-teal-500 object-cover">
                                    <span class="text-xs font-bold text-slate-800 truncate">${escapeHTML(r.user_name || 'Neighbor')}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-2">
                            <span class="material-symbols-outlined text-3xl text-slate-300">person_add</span>
                            <p class="text-xs font-semibold text-slate-500">Be the first to join this playdate!</p>
                        </div>
                    `}
                </div>

            </div>

            <!-- Right Sidebar Column -->
            <div class="space-y-6">
                
                <!-- Location & Map Card -->
                <div class="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs space-y-4 p-5 sm:p-6">
                    <div class="flex items-start gap-3">
                        <span class="material-symbols-outlined text-2xl text-[#006654]">location_on</span>
                        <div>
                            <h3 class="font-bold text-sm text-slate-900">${escapeHTML(m.public_location)}</h3>
                            <p class="text-xs text-slate-500">${escapeHTML(m.district)} District</p>
                        </div>
                    </div>

                    <!-- Map Stylized Graphic Box -->
                    <div class="relative w-full h-44 rounded-2xl overflow-hidden border border-slate-200 bg-sky-50">
                        <iframe width="100%" height="100%" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="https://maps.google.com/maps?q=${encodeURIComponent(m.public_location + ', ' + m.district + ', Dubai')}&t=&z=14&ie=UTF8&iwloc=&output=embed" class="w-full h-full border-0"></iframe>
                    </div>

                    <a href="https://maps.google.com/?q=${encodeURIComponent(m.public_location + ', ' + m.district + ', Dubai')}" target="_blank" class="inline-flex items-center gap-1.5 text-xs font-bold text-[#006654] hover:underline pt-1">
                        <span>Get Directions</span>
                        <span class="material-symbols-outlined text-sm">open_in_new</span>
                    </a>
                </div>

                <!-- Discussion Card -->
                <div class="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between min-h-[440px]">
                    <div class="space-y-4">
                        <div class="flex items-center gap-2 border-b border-slate-100 pb-3">
                            <span class="material-symbols-outlined text-xl text-[#006654]">chat</span>
                            <h3 class="font-serif font-bold text-lg text-slate-900">Discussion</h3>
                        </div>

                        <div class="space-y-3 max-h-72 overflow-y-auto pr-1">
                            ${comments.length > 0 ? comments.map(c => `
                                <div class="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-1">
                                    <span class="block text-xs font-bold text-[#006654]">${escapeHTML(c.user_name)}:</span>
                                    <p class="text-xs text-slate-700 leading-relaxed">${escapeHTML(c.content)}</p>
                                </div>
                            `).join('') : `
                                <div class="py-12 text-center space-y-2">
                                    <span class="material-symbols-outlined text-4xl text-slate-300">chat_bubble_outline</span>
                                    <p class="text-xs font-semibold text-slate-500">No comments yet.<br>Got a question for the host?</p>
                                </div>
                            `}
                        </div>
                    </div>

                    <!-- Comment Bar -->
                    <form onsubmit="handleAddDetailComment(event, '${m.id}')" class="flex items-center gap-2 pt-4 border-t border-slate-100">
                        <img src="${state.user ? (state.user.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(state.user.name)) : 'https://api.dicebear.com/7.x/bottts/svg?seed=Guest'}" class="w-8 h-8 rounded-full border border-teal-500 object-cover shrink-0">
                        <div class="relative flex-1">
                            <input type="text" id="detailCommentInput" placeholder="Add a comment..." required class="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-xs outline-none focus:ring-2 focus:ring-[#006654]">
                            <button type="submit" class="absolute right-2 top-2 text-[#006654] hover:text-teal-900 p-1">
                                <span class="material-symbols-outlined text-lg">send</span>
                            </button>
                        </div>
                    </form>
                </div>

            </div>
        </div>
    `;
}

async function handleAddDetailComment(e, meetupId) {
    e.preventDefault();
    if (!state.user) {
        openModal('authModal');
        return;
    }

    const input = document.getElementById('detailCommentInput');
    if (!input || !input.value.trim()) return;

    try {
        const res = await fetch(`/api/meetups/${meetupId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify({ content: input.value.trim() })
        });
        const data = await res.json();
        if (data.success) {
            input.value = '';
            const mRes = await fetch('/api/meetups');
            const mData = await mRes.json();
            if (mData.success) {
                state.meetups = mData.data || [];
                const updated = state.meetups.find(m => m.id === meetupId);
                if (updated) renderPlaydateDetail(updated);
            }
        }
    } catch (err) {
        console.error('Failed to post comment:', err);
    }
}

function renderMeetups() {
    const grid = document.getElementById('meetupsGrid');
    if (!grid) return;

    // Deduplicate state.meetups before filtering and rendering
    const seenM = new Set();
    const uniqueMeetups = [];
    (state.meetups || []).forEach(m => {
        const key = m.id || `${m.title}-${m.date_time}-${m.host_id}`;
        if (!seenM.has(key)) {
            seenM.add(key);
            uniqueMeetups.push(m);
        }
    });

    let filtered = uniqueMeetups;
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
            <div class="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <span class="material-symbols-outlined text-4xl text-slate-300">event_busy</span>
                <p class="text-sm font-bold text-slate-600">No playdates found matching filters</p>
                <button onclick="clearFilters()" class="text-xs font-bold text-teal-700 hover:underline">+ Reset Search Filters</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(m => {
        const rsvps = m.rsvps || [];
        const isAttending = state.user && rsvps.some(r => r.user_id === state.user.id);
        const hasCustomImg = Boolean(m.image_url && m.image_url.trim() !== '' && !m.image_url.includes('/assets/') && !m.image_url.includes('logo') && !m.image_url.includes('unsplash.com'));

        const isDev = Boolean(state.user && (state.user.is_developer || state.user.role === 'admin'));
        const isOwner = Boolean(state.user && ((state.user.id && state.user.id === m.host_id) || (state.user.name && state.user.name === m.host_name)));
        const canDelete = isDev || isOwner;

        return `
            <div class="bg-white rounded-3xl overflow-hidden border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group" onclick="openPlaydateDetail('${m.id}')">
                <div>
                    ${hasCustomImg ? `
                        <!-- Card Cover Photo -->
                        <div class="card-cover-box h-48 sm:h-52 bg-slate-900 relative overflow-hidden">
                            <img src="${m.image_url}" alt="${escapeHTML(m.title)}" onerror="this.closest('.card-cover-box').remove()" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                            <span class="absolute top-3.5 left-3.5 bg-teal-900/90 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-xs">
                                📍 ${escapeHTML(m.district)}
                            </span>
                            <span class="absolute top-3.5 right-3.5 bg-amber-500 text-slate-900 text-[11px] font-extrabold px-3 py-1 rounded-full shadow-xs">
                                ${escapeHTML(m.interest_tag || 'Activity')}
                            </span>
                        </div>
                    ` : ''}

                    <!-- Card Body -->
                    <div class="p-5 sm:p-6 space-y-3.5">
                        ${!hasCustomImg ? `
                            <div class="flex items-center justify-between gap-2">
                                <span class="bg-teal-50 text-teal-800 text-[11px] font-bold px-3 py-1 rounded-full border border-teal-100">
                                    📍 ${escapeHTML(m.district)}
                                </span>
                                <span class="bg-amber-500 text-slate-900 text-[11px] font-extrabold px-3 py-1 rounded-full">
                                    ${escapeHTML(m.interest_tag || 'Activity')}
                                </span>
                            </div>
                        ` : ''}

                        <div class="flex items-center gap-2.5 text-xs text-slate-500 font-medium">
                            <img src="${m.host_avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(m.host_name || 'Parent')}" class="w-7 h-7 rounded-full border border-teal-500 object-cover shrink-0">
                            <span class="truncate">Hosted by <strong class="text-slate-800">${escapeHTML(m.host_name || 'Parent')}</strong></span>
                        </div>

                        <h3 class="font-display font-bold text-base sm:text-lg text-slate-900 leading-snug group-hover:text-teal-700 transition-colors">
                            ${escapeHTML(m.title)}
                        </h3>

                        <div class="space-y-2 text-xs font-semibold text-slate-600">
                            <div class="flex items-center gap-2.5">
                                <span class="material-symbols-outlined text-teal-600 text-lg">calendar_month</span>
                                <span>${escapeHTML(m.date_time)}</span>
                            </div>
                            <div class="flex items-center gap-2.5">
                                <span class="material-symbols-outlined text-teal-600 text-lg">location_on</span>
                                <span class="truncate">${escapeHTML(m.public_location)}</span>
                            </div>
                            <div class="flex items-center gap-2.5">
                                <span class="material-symbols-outlined text-amber-500 text-lg">face</span>
                                <span>Ages: ${m.min_age || 0} - ${m.max_age || 16} years</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer & RSVP -->
                <div class="px-5 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between" onclick="event.stopPropagation()">
                    <div class="flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-teal-600 text-lg">group</span>
                        <span class="text-xs font-bold text-slate-700">${rsvps.length} / ${m.max_attendees || 10} Attending</span>
                    </div>

                    <div class="flex items-center gap-2">
                        ${canDelete ? `
                            <button onclick="handleDeletePost('meetup', '${m.id}')" title="${isDev && !isOwner ? 'Developer Override: Delete post' : 'Remove your playdate'}" class="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all inline-flex items-center gap-1 shadow-xs">
                                <span class="material-symbols-outlined text-sm">delete</span>
                                <span>${isDev && !isOwner ? 'Dev Delete' : 'Delete'}</span>
                            </button>
                        ` : ''}
                        <button onclick="openPlaydateDetail('${m.id}')" class="p-2 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors" title="View Detail">
                            <span class="material-symbols-outlined text-lg">visibility</span>
                        </button>
                        <button onclick="handleRSVP('${m.id}')" class="${isAttending ? 'bg-amber-500 text-slate-900' : 'bg-[#006654] hover:bg-[#005243] text-white'} text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs">
                            ${isAttending ? '✓ Attending' : '+ Join RSVP'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderPlaces() {
    const grid = document.getElementById('placesGrid');
    if (!grid) return;

    grid.innerHTML = (state.places || []).map(p => {
        const isDev = Boolean(state.user && (state.user.is_developer || state.user.role === 'admin'));
        const isOwner = Boolean(state.user && ((state.user.id && state.user.id === p.added_by_user_id)));
        const canDelete = isDev || isOwner;

        const hasCustomImg = Boolean(p.image_url && p.image_url.trim() !== '' && !p.image_url.includes('/assets/') && !p.image_url.includes('logo') && !p.image_url.includes('unsplash.com'));

        return `
            <div class="bg-white rounded-3xl overflow-hidden border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                    ${hasCustomImg ? `
                        <div class="card-cover-box h-48 bg-slate-900 relative overflow-hidden">
                            <img src="${p.image_url}" alt="${escapeHTML(p.name)}" onerror="this.closest('.card-cover-box').remove()" class="w-full h-full object-cover">
                            <span class="absolute top-3.5 left-3.5 bg-teal-800 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-xs">
                                📍 ${escapeHTML(p.district)}
                            </span>
                        </div>
                    ` : ''}
                    <div class="p-5 space-y-3">
                        <div class="flex items-start justify-between">
                            ${!hasCustomImg ? `
                                <span class="bg-teal-50 text-teal-700 text-[11px] font-bold px-3 py-1 rounded-full border border-teal-100">
                                    📍 ${escapeHTML(p.district)}
                                </span>
                            ` : ''}
                            <span class="text-xs font-semibold text-slate-500">${escapeHTML(p.public_spot_type || 'Park')}</span>
                        </div>
                        <h3 class="font-display font-bold text-base text-slate-900">${escapeHTML(p.name)}</h3>
                        <p class="text-xs text-slate-600 leading-relaxed line-clamp-3">${escapeHTML(p.description || 'Verified local community spot.')}</p>
                    </div>
                </div>
                ${canDelete ? `
                    <div class="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
                        <button onclick="handleDeletePost('place', '${p.id}')" title="${isDev && !isOwner ? 'Developer Override: Delete spot' : 'Remove your spot'}" class="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all inline-flex items-center gap-1 shadow-xs">
                            <span class="material-symbols-outlined text-sm">delete</span>
                            <span>${isDev && !isOwner ? 'Dev Delete' : 'Delete'}</span>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function renderToys() {
    const grid = document.getElementById('toysGrid');
    if (!grid) return;

    let filtered = state.toys || [];
    if (state.filters.interest) {
        filtered = filtered.filter(t => (t.category || '').toLowerCase().includes(state.filters.interest.toLowerCase()));
    }

    grid.innerHTML = filtered.map(t => {
        const isDev = Boolean(state.user && (state.user.is_developer || state.user.role === 'admin'));
        const isOwner = Boolean(state.user && (state.user.name === t.user_name || state.user.id === t.user_id));
        const canDelete = isDev || isOwner;

        const hasCustomImg = Boolean(t.image_url && t.image_url.trim() !== '' && !t.image_url.includes('/assets/') && !t.image_url.includes('logo') && !t.image_url.includes('unsplash.com'));
        const isSale = t.swap_type === 'For Sale' || (t.price && Number(t.price) > 0);
        const priceLabel = isSale ? `🏷️ AED ${t.price}` : (t.swap_type || '🎁 Free Pass-Along');
        const priceBadgeClass = isSale ? 'bg-amber-100 text-amber-950 border border-amber-300' : 'bg-emerald-100 text-emerald-950 border border-emerald-300';

        return `
            <div class="bg-white rounded-3xl overflow-hidden border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                    ${hasCustomImg ? `
                        <!-- Item Photo -->
                        <div class="card-cover-box h-48 bg-slate-900 relative overflow-hidden">
                            <img src="${t.image_url}" alt="${escapeHTML(t.title)}" onerror="this.closest('.card-cover-box').remove()" class="w-full h-full object-cover hover:scale-105 transition-transform duration-500">
                            <span class="absolute top-3.5 left-3.5 bg-amber-500 text-slate-900 text-[11px] font-extrabold px-3 py-1 rounded-full shadow-xs">
                                ${escapeHTML(t.category || 'Exchange')}
                            </span>
                            <span class="absolute top-3.5 right-3.5 bg-teal-800 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-xs">
                                📍 ${escapeHTML(t.district)}
                            </span>
                        </div>
                    ` : ''}

                    <div class="p-5 space-y-3">
                        ${!hasCustomImg ? `
                            <div class="flex items-center justify-between gap-2">
                                <span class="bg-amber-500 text-slate-900 text-[11px] font-extrabold px-3 py-1 rounded-full">
                                    ${escapeHTML(t.category || 'Exchange')}
                                </span>
                                <span class="bg-teal-800 text-white text-[11px] font-bold px-3 py-1 rounded-full">
                                    📍 ${escapeHTML(t.district)}
                                </span>
                            </div>
                        ` : ''}

                        <div class="flex items-center justify-between pt-1">
                            <span class="text-[11px] font-extrabold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-md border border-teal-100">
                                ${escapeHTML(t.condition || 'Gently Used')}
                            </span>
                            <span class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-md ${priceBadgeClass}">
                                ${escapeHTML(priceLabel)}
                            </span>
                        </div>

                        <h3 class="font-display font-bold text-base text-slate-900 leading-snug">${escapeHTML(t.title)}</h3>
                        ${t.school_name ? `<p class="text-xs font-bold text-slate-500">🏫 ${escapeHTML(t.school_name)}</p>` : ''}
                        <p class="text-xs text-slate-600 leading-relaxed line-clamp-2">${escapeHTML(t.description || 'Pass-along item for neighborhood families.')}</p>
                    </div>
                </div>

                <div class="px-5 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                    <div class="flex flex-col text-xs font-medium text-slate-500">
                        <span>Listed by <strong>${escapeHTML(t.user_name || 'Local Parent')}</strong></span>
                        <span class="text-teal-700 font-bold text-[11px]">📱 ${escapeHTML(t.user_phone || t.user_contact || 'Number required')}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        ${canDelete ? `
                            <button onclick="handleDeletePost('toy', '${t.id}')" title="Remove Item (Developer/Owner Power)" class="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all inline-flex items-center gap-1 shadow-xs">
                                <span class="material-symbols-outlined text-sm">delete</span>
                                <span>Delete</span>
                            </button>
                        ` : ''}
                        <a href="tel:${t.user_phone || t.user_contact || ''}" class="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all inline-flex items-center gap-1 shadow-xs">
                            <span class="material-symbols-outlined text-sm">call</span>
                            <span>Call</span>
                        </a>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderLostFound() {
    const grid = document.getElementById('lostFoundGrid');
    if (!grid) return;

    // Deduplicate items before rendering
    const seen = new Set();
    const uniqueList = [];
    (state.lostFound || []).forEach(lf => {
        const key = lf.id || `${lf.title}-${lf.location_detail}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueList.push(lf);
        }
    });

    if (uniqueList.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-12 text-center bg-slate-50/80 rounded-3xl border border-dashed border-slate-200">
                <span class="material-symbols-outlined text-4xl text-slate-400 mb-2">find_in_page</span>
                <p class="font-display font-bold text-slate-700">No lost or found reports yet</p>
                <p class="text-xs text-slate-500 mt-1">Be the first parent to post a lost item!</p>
            </div>`;
        return;
    }

    grid.innerHTML = uniqueList.map(lf => {
        const isDev = Boolean(state.user && (state.user.is_developer || state.user.role === 'admin'));
        const isOwner = Boolean(state.user && (state.user.name === lf.reported_by || state.user.id === lf.user_id));
        const canDelete = isDev || isOwner;

        const hasCustomImg = Boolean(lf.image_url && lf.image_url.trim() !== '' && !lf.image_url.includes('/assets/') && !lf.image_url.includes('logo') && !lf.image_url.includes('unsplash.com'));

        return `
            <div class="bg-white rounded-3xl overflow-hidden border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative group">
                <div>
                    ${hasCustomImg ? `
                        <div class="card-cover-box h-48 bg-slate-900 relative overflow-hidden">
                            <img src="${lf.image_url}" alt="${escapeHTML(lf.title || lf.item_name)}" onerror="this.closest('.card-cover-box').remove()" class="w-full h-full object-cover">
                            <span class="absolute top-3.5 left-3.5 bg-rose-600 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-xs">
                                ${escapeHTML(lf.status || 'Lost')}
                            </span>
                            <span class="absolute top-3.5 right-3.5 bg-teal-800 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-xs">
                                📍 ${escapeHTML(lf.district)}
                            </span>
                        </div>
                    ` : ''}

                    <div class="p-5 space-y-3">
                        ${!hasCustomImg ? `
                            <div class="flex items-center justify-between">
                                <span class="bg-rose-600 text-white text-[11px] font-bold px-3 py-1 rounded-full">
                                    ${escapeHTML(lf.status || 'Lost')}
                                </span>
                                <span class="bg-teal-800 text-white text-[11px] font-bold px-3 py-1 rounded-full">
                                    📍 ${escapeHTML(lf.district)}
                                </span>
                            </div>
                        ` : ''}
                        <h3 class="font-display font-bold text-base text-slate-900">${escapeHTML(lf.title || lf.item_name)}</h3>
                        <p class="text-xs text-slate-600 leading-relaxed">${escapeHTML(lf.location_detail || lf.location || lf.district)}</p>
                    </div>
                </div>

                <div class="px-5 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                    <div class="flex flex-col text-xs font-medium text-slate-500">
                        <span>Reported by <strong>${escapeHTML(lf.reported_by || 'Resident')}</strong></span>
                        <span class="text-teal-700 font-bold text-[11px]">📱 ${escapeHTML(lf.user_phone || lf.user_contact || 'Number required')}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        ${canDelete ? `
                            <button onclick="handleDeletePost('lostFound', '${lf.id}')" title="${isDev && !isOwner ? 'Developer Override: Delete any post' : 'Remove your post'}" class="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all inline-flex items-center gap-1 shadow-xs">
                                <span class="material-symbols-outlined text-sm">delete</span>
                                <span>${isDev && !isOwner ? 'Dev Delete' : 'Delete'}</span>
                            </button>
                        ` : ''}
                        <a href="tel:${lf.user_phone || lf.user_contact || ''}" class="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all inline-flex items-center gap-1 shadow-xs">
                            <span class="material-symbols-outlined text-sm">call</span>
                            <span>Call</span>
                        </a>
                    </div>
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

    const form = e.target;
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    if (submitBtn) {
        if (submitBtn.disabled) return;
        submitBtn.disabled = true;
        submitBtn.dataset.origText = submitBtn.innerText;
        submitBtn.innerText = 'Publishing...';
    }

    const phoneVal = document.getElementById('meetupPhone')?.value;
    if (phoneVal && (!state.user.phone || state.user.phone !== phoneVal)) {
        state.user.phone = phoneVal;
    }

    const payload = {
        title: document.getElementById('meetupTitle').value,
        district: document.getElementById('meetupDistrict').value,
        interest_tag: document.getElementById('meetupInterest').value,
        public_location: document.getElementById('meetupLocation').value,
        date_time: document.getElementById('meetupDateTime').value,
        max_attendees: 10,
        min_age: 0,
        max_age: 18,
        image_url: document.getElementById('meetupImageUrl')?.value || ''
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
            if (form) form.reset();
            const imgInput = document.getElementById('meetupImageUrl');
            if (imgInput) imgInput.value = '';
            const preview = document.getElementById('meetupPhotoPreview');
            if (preview) preview.classList.add('hidden');
            closeModal('createMeetupModal');
            showToast('Playdate created successfully!');
            await loadCurrentTabData();
        } else {
            alert(data.error || 'Failed to create playdate');
        }
    } catch (err) {
        alert('Error publishing playdate');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = submitBtn.dataset.origText || 'Publish Playdate';
        }
    }
}

async function handleCreateToy(e) {
    e.preventDefault();
    if (!state.user) {
        openModal('authModal');
        showToast('Please sign in to list exchange items');
        return;
    }

    const phoneVal = document.getElementById('toyPhone')?.value;
    if (phoneVal && (!state.user.phone || state.user.phone !== phoneVal)) {
        state.user.phone = phoneVal;
    }

    const priceVal = parseFloat(document.getElementById('toyPrice')?.value || '0') || 0;
    const swapTypeVal = document.getElementById('toySwapType')?.value || (priceVal > 0 ? 'For Sale' : 'Free Pass-Along');

    const payload = {
        title: document.getElementById('toyTitle').value,
        category: document.getElementById('toyCategory').value,
        district: document.getElementById('toyDistrict').value,
        school_name: document.getElementById('toySchoolName').value || '',
        condition: document.getElementById('toyCondition').value,
        description: document.getElementById('toyDescription').value || '',
        image_url: document.getElementById('toyImageUrl')?.value || '',
        price: priceVal,
        swap_type: swapTypeVal
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

async function handleCreateLostFound(e) {
    e.preventDefault();
    if (!state.user) {
        openModal('authModal');
        showToast('Please sign in to report lost or found items');
        return;
    }

    const form = e.target;
    const submitBtn = form ? form.querySelector('button[type=submit]') : null;
    if (submitBtn) {
        if (submitBtn.disabled) return;
        submitBtn.disabled = true;
        submitBtn.dataset.origText = submitBtn.innerText;
        submitBtn.innerText = 'Publishing...';
    }

    const phoneVal = document.getElementById('lostFoundPhone')?.value;
    if (phoneVal && (!state.user.phone || state.user.phone !== phoneVal)) {
        state.user.phone = phoneVal;
    }

    const payload = {
        title: document.getElementById('lostFoundTitle').value,
        status: document.getElementById('lostFoundStatus').value,
        category: document.getElementById('lostFoundCategory').value,
        district: document.getElementById('lostFoundDistrict').value,
        location_detail: document.getElementById('lostFoundLocation').value,
        user_phone: phoneVal || state.user.phone || '+971 50 123 4567',
        image_url: document.getElementById('lostFoundImageUrl')?.value || ''
    };

    try {
        const res = await fetch('/api/lost-found', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            if (form) form.reset();
            const imgInput = document.getElementById('lostFoundImageUrl');
            if (imgInput) imgInput.value = '';
            const preview = document.getElementById('lostFoundPhotoPreview');
            if (preview) preview.classList.add('hidden');
            closeModal('createLostFoundModal');
            showToast('Lost & Found item reported!');
            switchTab('lostFound');
        } else {
            alert(data.error || 'Failed to report item');
        }
    } catch (err) {
        alert('Error reporting item');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = submitBtn.dataset.origText || 'Publish Report';
        }
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
    }
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('hidden');
        if (state.user) {
            const phoneIn = el.querySelector('input[type="tel"]');
            if (phoneIn && state.user.phone && !phoneIn.value) {
                phoneIn.value = state.user.phone;
            }
        }
    }
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
    toast.className = 'fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-slate-700 animate-bounce';
    toast.innerHTML = `<span class="material-symbols-outlined text-amber-400 text-base">info</span> <span>${escapeHTML(msg)}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

