// ==================== Global Variables ====================

const API_BASE_URL = 'http://localhost:5000';

let authToken = localStorage.getItem('token');

if (authToken === 'undefined' || authToken === 'null') {

    authToken = null;

    localStorage.removeItem('token');

}

let currentUser = null;

let charts = {};

let allRecentSessions = [];

let calDate = new Date();



// Cached data for pages

let cachedDashboard = null;

let cachedRecommendations = null;

let cachedProgress = null;

let cachedWeekly = null;



// ==================== Dark Mode ====================

function toggleDarkMode() {

    document.body.classList.toggle('dark-mode');

    const isDark = document.body.classList.contains('dark-mode');

    localStorage.setItem('darkMode', isDark);

    const icon = document.getElementById('darkModeIcon');

    const label = document.getElementById('darkModeLabel');

    if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';

    if (label) label.textContent = isDark ? 'Light Mode' : 'Dark Mode';

}



function loadDarkModePreference() {

    if (localStorage.getItem('darkMode') === 'true') {

        document.body.classList.add('dark-mode');

        const icon = document.getElementById('darkModeIcon');

        const label = document.getElementById('darkModeLabel');

        if (icon) icon.className = 'fas fa-sun';

        if (label) label.textContent = 'Light Mode';

    }

}



// ==================== Password Strength ====================

function updatePasswordStrength(password) {

    const container = document.getElementById('passwordStrengthContainer');

    const bar = document.getElementById('strengthBar');

    const text = document.getElementById('strengthText');

    if (!password) { container.style.display = 'none'; return; }

    container.style.display = 'block';

    let score = 0;

    if (password.length >= 6) score++;

    if (password.length >= 10) score++;

    if (/[A-Z]/.test(password)) score++;

    if (/[0-9]/.test(password)) score++;

    if (/[^A-Za-z0-9]/.test(password)) score++;

    const levels = [

        { width: '20%', color: '#dc2626', label: 'Very Weak' },

        { width: '40%', color: '#ea580c', label: 'Weak' },

        { width: '60%', color: '#d97706', label: 'Fair' },

        { width: '80%', color: '#16a34a', label: 'Strong' },

        { width: '100%', color: '#059669', label: 'Very Strong' }

    ];

    const level = levels[Math.min(score, 4)];

    bar.style.width = level.width;

    bar.style.backgroundColor = level.color;

    text.textContent = level.label;

    text.style.color = level.color;

}



// ==================== Animated Counter ====================

function animateCounter(element, target, suffix = '') {

    const duration = 800;

    const startTime = performance.now();

    function update(now) {

        const p = Math.min((now - startTime) / duration, 1);

        const eased = 1 - Math.pow(1 - p, 3);

        const val = target * eased;

        element.textContent = (Number.isInteger(target) ? Math.round(val) : val.toFixed(1)) + suffix;

        if (p < 1) requestAnimationFrame(update);

    }

    requestAnimationFrame(update);

}



// ==================== Calendar ====================

function renderCalendar() {

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    document.getElementById('calMonthYear').textContent = `${monthNames[calDate.getMonth()]} ${calDate.getFullYear()}`;

    const container = document.getElementById('calendarDays');

    container.innerHTML = '';

    const first = new Date(calDate.getFullYear(), calDate.getMonth(), 1);

    const lastDay = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 0).getDate();

    const startDay = first.getDay();

    const today = new Date();

    for (let i = 0; i < startDay; i++) {

        container.innerHTML += '<span class="cal-day empty"></span>';

    }

    for (let d = 1; d <= lastDay; d++) {

        const isToday = d === today.getDate() && calDate.getMonth() === today.getMonth() && calDate.getFullYear() === today.getFullYear();

        container.innerHTML += `<span class="cal-day${isToday ? ' today' : ''}">${d}</span>`;

    }

}



function changeMonth(delta) {

    calDate.setMonth(calDate.getMonth() + delta);

    renderCalendar();

}



// ==================== Page Navigation ====================

let currentPage = 'dashboard';



function switchPage(pageName) {

    currentPage = pageName;

    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));

    const target = document.getElementById('page-' + pageName);

    if (target) target.classList.add('active');

    document.querySelectorAll('.sidebar-link[data-page]').forEach(l => l.classList.remove('active'));

    const activeLink = document.querySelector(`.sidebar-link[data-page="${pageName}"]`);

    if (activeLink) activeLink.classList.add('active');



    if (pageName === 'sessions') renderAllSessionsPage();

    else if (pageName === 'recommendations') renderTipsPage();

    else if (pageName === 'progress') renderProgressPage();

    else if (pageName === 'schedule') renderSchedulePage();

    else if (pageName === 'timer') initTimerPage();

    else if (pageName === 'routine') initRoutinePage();

    else if (pageName === 'journal') initJournalPage();

    else if (pageName === 'notes') initNotesPage();

    else if (pageName === 'aitutor') initAITutorPage();

    else if (pageName === 'mocktest') initMockTestPage();

    else if (pageName === 'settings') initSettingsPage();

    else if (pageName === 'guide') { /* static page, no init needed */ }

    else if (pageName === 'aboutus') { /* static page, no init needed */ }

}



// ==================== Initialization ====================

document.addEventListener('DOMContentLoaded', () => {

    loadDarkModePreference();

    

    // Check if we're on the auth pages (index.html)

    const path = window.location.pathname;

    const isAuthPage = path.includes('index.html') || 

                       path === '/' ||

                       path.endsWith('/index.html');

    

    if (isAuthPage) {

        if (authToken) {

            // If already logged in, show dashboard directly

            showDashboard();

            // Auto-navigate if coming from homepage link

            const openPage = localStorage.getItem('openPage');

            if (openPage) {

                localStorage.removeItem('openPage');

                setTimeout(() => switchPage(openPage), 300);

            }

        } else {

            // Show login form

            showAuthSection();

        }

    }

    

    attachEventListeners();

});



function attachEventListeners() {

    const loginForm = document.getElementById('loginFormElement');

    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    const registerForm = document.getElementById('registerFormElement');

    if (registerForm) registerForm.addEventListener('submit', handleRegister);

    const addSessionForm = document.getElementById('addSessionForm');

    if (addSessionForm) addSessionForm.addEventListener('submit', handleAddSession);

    const editSessionForm = document.getElementById('editSessionForm');

    if (editSessionForm) editSessionForm.addEventListener('submit', handleEditSession);

    const sessionDate = document.getElementById('sessionDate');

    if (sessionDate) {

        const now = new Date();

        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

        sessionDate.value = now.toISOString().slice(0, 16);

    }

    

    // Attach sidebar link handlers

    document.querySelectorAll('.sidebar-link[data-page]').forEach(link => {

        link.addEventListener('click', (e) => {

            e.preventDefault();

            const page = link.getAttribute('data-page');

            switchPage(page);

        });

    });

}



// ==================== Authentication ====================

async function handleLogin(e) {

    e.preventDefault();

    const email = document.getElementById('loginEmail').value;

    const password = document.getElementById('loginPassword').value;

    try {

        const response = await fetch(`${API_BASE_URL}/login`, {

            method: 'POST',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify({ email, password })

        });

        const data = await response.json();

        if (response.ok) {

            authToken = data.token;

            currentUser = { name: data.name, id: data.user_id };

            localStorage.setItem('token', authToken);

            localStorage.setItem('user', JSON.stringify(currentUser));

            localStorage.setItem('user_id', data.user_id);

            showAlert('Login successful!', 'success');

            setTimeout(() => showDashboard(), 400);

        } else {

            showAlert(data.error || 'Login failed', 'danger');

        }

    } catch (error) {

        showAlert('Connection error: ' + error.message, 'danger');

    }

}



async function handleRegister(e) {

    e.preventDefault();

    const name = document.getElementById('registerName').value;

    const email = document.getElementById('registerEmail').value;

    const password = document.getElementById('registerPassword').value;

    try {

        const response = await fetch(`${API_BASE_URL}/register`, {

            method: 'POST',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify({ name, email, password })

        });

        const data = await response.json();

        if (response.ok) {

            authToken = data.token;

            currentUser = { name, id: data.user_id };

            localStorage.setItem('token', authToken);

            localStorage.setItem('user', JSON.stringify(currentUser));

            localStorage.setItem('user_id', data.user_id);

            showAlert('Welcome to StudyMate! 🎉', 'success');

            setTimeout(() => showDashboard(), 400);

        } else {

            showAlert(data.error || 'Registration failed', 'danger');

        }

    } catch (error) {

        showAlert('Connection error: ' + error.message, 'danger');

    }

}



function logout() {

    authToken = null;

    currentUser = null;

    localStorage.removeItem('token');

    localStorage.removeItem('user');

    showAlert('Logged out', 'info');

    setTimeout(() => window.location.href = '/', 300);

}



function toggleAuthForm() {

    const lf = document.getElementById('loginForm');

    const rf = document.getElementById('registerForm');

    lf.style.display = lf.style.display === 'none' ? 'block' : 'none';

    rf.style.display = rf.style.display === 'none' ? 'block' : 'none';

}



// ==================== UI Controllers ====================

function showAuthSection() {

    document.getElementById('authSection').style.display = 'flex';

    document.getElementById('dashboardSection').style.display = 'none';

}



function showDashboard() {

    document.getElementById('authSection').style.display = 'none';

    document.getElementById('dashboardSection').style.display = 'flex';

    const user = localStorage.getItem('user');

    if (user && user !== 'undefined') {

        try { currentUser = JSON.parse(user); } catch(e) { currentUser = null; }

    }

    if (!currentUser) currentUser = { name: 'Student' };

    const greeting = document.getElementById('greetingText');

    if (greeting) greeting.textContent = `Hello, ${currentUser?.name || 'Student'} 👋`;

    const profileName = document.getElementById('profileName');

    if (profileName) profileName.textContent = currentUser?.name || 'Student';

    initDashWelcome();

    renderCalendar();

    switchPage('dashboard');

    loadDashboard();

}



// ==================== Dashboard Welcome Banner ====================

function initDashWelcome() {

    const name = currentUser?.name || 'Student';

    const hour = new Date().getHours();

    let timeGreet = 'Good evening';

    if (hour < 12) timeGreet = 'Good morning';

    else if (hour < 17) timeGreet = 'Good afternoon';



    const el = document.getElementById('dashWelcomeGreeting');

    if (el) el.textContent = `${timeGreet}, ${name}! 🎓`;



    const dateEl = document.getElementById('dwDate');

    if (dateEl) {

        const now = new Date();

        dateEl.innerHTML = `<i class="fas fa-calendar-day me-1"></i>${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`;

    }



    const quotes = [

        '"The secret of getting ahead is getting started." — Mark Twain',

        '"It always seems impossible until it\'s done." — Nelson Mandela',

        '"Don\'t watch the clock; do what it does. Keep going." — Sam Levenson',

        '"Success is the sum of small efforts repeated day in and day out."',

        '"Study hard, stay positive, and get enough sleep."',

        '"The beautiful thing about learning is that no one can take it away."',

        '"Push yourself, because no one else is going to do it for you."',

        '"Dream big. Start small. Act now."',

        '"A little progress each day adds up to big results."',

        '"Believe in yourself and all that you are."'

    ];

    const motEl = document.getElementById('dwMotivation');

    if (motEl) motEl.textContent = quotes[Math.floor(Math.random() * quotes.length)];

}



// ==================== Dashboard ====================

async function loadDashboard() {

    try {

        showAlert('Loading dashboard...', 'info');

        const [dashboardData, recommendationsData, progressData, weeklyData] = await Promise.all([

            fetchWithAuth(`${API_BASE_URL}/dashboard`),

            fetchWithAuth(`${API_BASE_URL}/recommendations`),

            fetchWithAuth(`${API_BASE_URL}/progress`),

            fetchWithAuth(`${API_BASE_URL}/weekly-stats`)

        ]);

        console.log('Dashboard data:', dashboardData);

        console.log('Weekly data:', weeklyData);

        console.log('Progress data:', progressData);

        console.log('Chart.js available:', typeof Chart);

        if (dashboardData && recommendationsData && progressData && weeklyData) {

            cachedDashboard = dashboardData;

            cachedRecommendations = recommendationsData;

            cachedProgress = progressData;

            cachedWeekly = weeklyData;



            displayStatCards(dashboardData);

            displayWeakAreas(dashboardData.weak_areas);

            displayRecommendations(recommendationsData);

            displayRecentSessions(dashboardData.recent_sessions);

            displayWeeklyChart(weeklyData.weekly_stats, dashboardData);

            displayPerformanceChart(progressData.subjects, dashboardData.statistics);

            displayTrendChart(dashboardData.recent_sessions);

            showAlert('Dashboard loaded!', 'success');



            // Re-render active sub-page if not on dashboard

            if (currentPage === 'sessions') renderAllSessionsPage();

            if (currentPage === 'recommendations') renderTipsPage();

            if (currentPage === 'progress') renderProgressPage();

            if (currentPage === 'schedule') renderSchedulePage();

        }

    } catch (error) {

        showAlert('Error: ' + error.message, 'danger');

    }

}



// ==================== Stat Cards ====================

function displayStatCards(data) {

    const s = data.statistics;

    const u = data.user;

    const cards = [

        { label: 'Total Sessions', value: s.total_sessions, icon: 'fa-book-open', c: 'c1', b: 'b1', suffix: '' },

        { label: 'Study Hours', value: u.total_study_hours, icon: 'fa-clock', c: 'c2', b: 'b2', suffix: '' },

        { label: 'Average Score', value: s.average_score, icon: 'fa-trophy', c: 'c3', b: 'b3', suffix: '%' },

        { label: 'This Week', value: s.recent_sessions_7_days, icon: 'fa-calendar-check', c: 'c4', b: 'b4', suffix: '' }

    ];

    const container = document.getElementById('statsCardsContainer');

    container.innerHTML = cards.map(c => `

        <div class="stat-card-item ${c.b}">

            <div class="stat-icon ${c.c}"><i class="fas ${c.icon}"></i></div>

            <div>

                <div class="stat-label">${c.label}</div>

                <div class="stat-value" data-counter="${c.value}" data-suffix="${c.suffix}">0${c.suffix}</div>

            </div>

        </div>

    `).join('');

    // Animate

    container.querySelectorAll('[data-counter]').forEach(el => {

        animateCounter(el, parseFloat(el.dataset.counter), el.dataset.suffix);

    });

}



// ==================== Weak Areas ====================

function displayWeakAreas(weakAreas) {

    const container = document.getElementById('weakAreasContainer');

    if (!weakAreas || weakAreas.length === 0) {

        container.innerHTML = '<p class="empty-text" style="padding:.5rem 0">No data yet</p>';

        return;

    }

    container.innerHTML = weakAreas.map(a => {

        const cls = a.is_weak ? (a.average_score < 50 ? 'danger' : 'warning') : 'good';

        const label = a.is_weak ? `${a.average_score}% ↓` : `${a.average_score}% ✓`;

        return `<span class="weak-tag ${cls}"><i class="fas fa-circle" style="font-size:.4rem"></i> ${a.subject} ${label}</span>`;

    }).join('');

}



// ==================== Recommendations ====================

function displayRecommendations(data) {

    const container = document.getElementById('recommendationsContainer');

    if (!data.recommendations || data.recommendations.length === 0) {

        container.innerHTML = `<p class="empty-text" style="padding:.5rem 0">${data.message || 'No tips yet'}</p>`;

        return;

    }

    let html = '';

    data.recommendations.forEach(rec => {

        html += `<div class="rec-item"><i class="fas fa-check-circle"></i><span>${rec}</span></div>`;

    });

    if (data.study_schedule && data.study_schedule.length > 0) {

        data.study_schedule.forEach(s => {

            const color = s.priority === 'High' ? '#d97706' : '#2563eb';

            html += `<div class="rec-item"><i class="fas fa-clock" style="color:${color}"></i><span><strong>${s.subject}</strong> — ${s.recommended_hours_per_week}h/wk (${s.priority})</span></div>`;

        });

    }

    container.innerHTML = html;

}



// ==================== Recent Sessions ====================

function displayRecentSessions(sessions) {

    allRecentSessions = sessions;

    renderSessionsTable(sessions, 'recentSessionsContainer', false);

}



function renderSessionsTable(sessions, containerId, showNotes) {

    const container = document.getElementById(containerId);

    if (!container) return;

    if (!sessions || sessions.length === 0) {

        container.innerHTML = '<p class="empty-text">No study sessions recorded yet.</p>';

        return;

    }

    const iconClasses = ['si1','si2','si3','si4','si5','si6'];

    const subjectIcons = ['fa-calculator','fa-code','fa-flask','fa-paint-brush','fa-microchip','fa-book'];

    const subjectMap = {};

    let idx = 0;

    sessions.forEach(s => {

        if (!(s.subject in subjectMap)) { subjectMap[s.subject] = idx % 6; idx++; }

    });



    let html = `<table class="sessions-table">

        <thead><tr><th>#</th><th>SUBJECT</th><th>SCORE</th><th>DURATION</th><th>DATE</th>${showNotes ? '<th>NOTES</th>' : ''}<th>STATUS</th><th>ACTIONS</th></tr></thead>

        <tbody>`;

    sessions.forEach((s, i) => {

        const si = subjectMap[s.subject];

        const date = new Date(s.date).toLocaleDateString();

        const badgeCls = s.score >= 70 ? 'badge-good' : (s.score >= 50 ? 'badge-mid' : 'badge-weak');

        const statusText = s.score >= 70 ? 'Good' : (s.score >= 50 ? 'Needs Work' : 'Weak');

        const notesText = s.notes ? (s.notes.length > 40 ? s.notes.substring(0, 40) + '...' : s.notes) : '—';

        html += `<tr>

            <td>${i + 1}</td>

            <td><div class="subject-cell"><div class="subject-icon ${iconClasses[si]}"><i class="fas ${subjectIcons[si]}"></i></div> ${s.subject}</div></td>

            <td><span class="grade-text">${s.score}/100</span></td>

            <td>${s.duration} min</td>

            <td>${date}</td>

            ${showNotes ? `<td class="notes-cell" title="${(s.notes || '').replace(/"/g, '&quot;')}">${notesText}</td>` : ''}

            <td><span class="badge-status ${badgeCls}">${statusText}</span></td>

            <td class="actions-cell">

                <button class="btn-edit" onclick="openEditSession('${s.id}')" title="Edit"><i class="fas fa-pen"></i></button>

                <button class="btn-delete" onclick="deleteSession('${s.id}')" title="Delete"><i class="fas fa-trash-alt"></i></button>

            </td>

        </tr>`;

    });

    html += '</tbody></table>';

    container.innerHTML = html;

}



function filterSessions() {

    const q = document.getElementById('globalSearchInput')?.value?.toLowerCase() || '';

    const filtered = allRecentSessions.filter(s => s.subject.toLowerCase().includes(q));

    renderSessionsTable(filtered, 'recentSessionsContainer', false);

    if (document.getElementById('allSessionsContainer')) {

        renderSessionsTable(filtered, 'allSessionsContainer', true);

    }

}



// ==================== Universal Search ====================

const SEARCH_PAGES = [

    { name: 'Dashboard', page: 'dashboard', icon: 'fa-th-large', color: '#6366f1', keywords: 'dashboard overview stats charts home weekly hours performance' },

    { name: 'Study Sessions', page: 'sessions', icon: 'fa-book-open', color: '#22c55e', keywords: 'sessions study log history subject score add session record' },

    { name: 'Tips to Know', page: 'recommendations', icon: 'fa-lightbulb', color: '#f59e0b', keywords: 'tips recommendations advice ai tips weak areas suggestions study tips' },

    { name: 'Progress', page: 'progress', icon: 'fa-chart-line', color: '#ec4899', keywords: 'progress tracking scores average subject analysis improvement' },

    { name: 'Schedule', page: 'schedule', icon: 'fa-calendar-alt', color: '#3b82f6', keywords: 'schedule planner timetable weekly plan calendar study plan' },

    { name: 'Study Timer', page: 'timer', icon: 'fa-stopwatch', color: '#8b5cf6', keywords: 'timer pomodoro countdown stopwatch focus clock study time' },

    { name: 'Help & Guide', page: 'guide', icon: 'fa-question-circle', color: '#06b6d4', keywords: 'help guide how to use features tutorial instructions faq' },

    { name: 'My Routine', page: 'routine', icon: 'fa-user-clock', color: '#6366f1', keywords: 'routine timetable work hours free time busy personalized schedule' },

    { name: 'My Journal', page: 'journal', icon: 'fa-book-open', color: '#f97316', keywords: 'journal diary mood reflect feelings write entry memories' },

    { name: 'My Notes', page: 'notes', icon: 'fa-sticky-note', color: '#6366f1', keywords: 'notes save write memo subject study reference quick concepts' },

    { name: 'AI Tutor', page: 'aitutor', icon: 'fa-robot', color: '#8b5cf6', keywords: 'ai tutor guide stress focus concentration study tips advice help subject' },

    { name: 'Settings', page: 'settings', icon: 'fa-cog', color: '#64748b', keywords: 'settings profile account password preferences name email user id export data' },

    { name: 'Dark Mode', page: '__darkmode__', icon: 'fa-moon', color: '#475569', keywords: 'dark mode theme night light toggle appearance' },

];



function handleGlobalSearch() {

    const input = document.getElementById('globalSearchInput');

    const q = input.value.trim().toLowerCase();

    const dropdown = document.getElementById('searchDropdown');



    if (!q) {

        dropdown.classList.remove('visible');

        dropdown.innerHTML = '';

        return;

    }



    let results = [];



    // 1. Search pages

    SEARCH_PAGES.forEach(p => {

        const haystack = (p.name + ' ' + p.keywords).toLowerCase();

        if (haystack.includes(q)) {

            results.push({ type: 'page', label: p.name, icon: p.icon, color: p.color, page: p.page });

        }

    });



    // 2. Search sessions by subject

    if (allRecentSessions && allRecentSessions.length > 0) {

        const matchedSubjects = new Set();

        allRecentSessions.forEach(s => {

            if (s.subject.toLowerCase().includes(q) && !matchedSubjects.has(s.subject)) {

                matchedSubjects.add(s.subject);

                results.push({ type: 'subject', label: s.subject, icon: 'fa-book', color: '#22c55e', page: 'sessions' });

            }

        });

    }



    // 3. Search journal entries

    const journalEntries = JSON.parse(localStorage.getItem('journalEntries') || '[]');

    journalEntries.slice(0, 50).forEach(e => {

        if (e.text && e.text.toLowerCase().includes(q)) {

            const preview = e.text.substring(0, 40) + (e.text.length > 40 ? '…' : '');

            if (results.filter(r => r.type === 'journal').length < 3) {

                results.push({ type: 'journal', label: preview, icon: 'fa-feather-alt', color: '#f97316', page: 'journal' });

            }

        }

    });



    // Render dropdown

    if (results.length === 0) {

        dropdown.innerHTML = '<div class="sr-empty"><i class="fas fa-search"></i> No results for "' + q + '"</div>';

    } else {

        let html = '';

        let lastType = '';

        results.slice(0, 10).forEach(r => {

            if (r.type !== lastType) {

                const typeLabel = r.type === 'page' ? 'Pages' : r.type === 'subject' ? 'Subjects' : 'Journal Entries';

                html += '<div class="sr-section-label">' + typeLabel + '</div>';

                lastType = r.type;

            }

            html += `<button class="sr-item" onclick="searchResultClick('${r.page}', '${r.type}', '${r.label.replace(/'/g, "\\'")}')">

                <span class="sr-icon" style="background:${r.color}15;color:${r.color}"><i class="fas ${r.icon}"></i></span>

                <span class="sr-label">${r.label}</span>

                <span class="sr-type">${r.type === 'page' ? 'Go' : r.type === 'subject' ? 'Filter' : 'Open'}</span>

            </button>`;

        });

        dropdown.innerHTML = html;

    }

    dropdown.classList.add('visible');

}



function showSearchResults() {

    const q = document.getElementById('globalSearchInput').value.trim();

    if (q) handleGlobalSearch();

}



function searchResultClick(page, type, label) {

    const dropdown = document.getElementById('searchDropdown');

    const input = document.getElementById('globalSearchInput');

    dropdown.classList.remove('visible');



    if (page === '__darkmode__') {

        toggleDarkMode();

        input.value = '';

        return;

    }



    switchPage(page);



    // If it's a subject, filter sessions to that subject

    if (type === 'subject' && page === 'sessions') {

        setTimeout(() => {

            const searchInPage = document.getElementById('globalSearchInput');

            if (searchInPage) searchInPage.value = label;

            const filtered = allRecentSessions.filter(s => s.subject.toLowerCase().includes(label.toLowerCase()));

            if (document.getElementById('allSessionsContainer')) {

                renderSessionsTable(filtered, 'allSessionsContainer', true);

            }

        }, 100);

    }



    input.value = '';

}



// Close search dropdown when clicking outside

document.addEventListener('click', (e) => {

    const dropdown = document.getElementById('searchDropdown');

    const searchBox = e.target.closest('.search-box');

    if (!searchBox && dropdown) dropdown.classList.remove('visible');

});



// ==================== Edit Session ====================

function openEditSession(sessionId) {

    const session = allRecentSessions.find(s => s.id === sessionId);

    if (!session) { showAlert('Session not found', 'danger'); return; }



    document.getElementById('editSessionId').value = sessionId;

    document.getElementById('editSubject').value = session.subject;

    document.getElementById('editScore').value = session.score;

    document.getElementById('editDuration').value = session.duration;

    document.getElementById('editNotes').value = session.notes || '';



    try {

        const d = new Date(session.date);

        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());

        document.getElementById('editDate').value = d.toISOString().slice(0, 16);

    } catch(e) { document.getElementById('editDate').value = ''; }



    const modal = new bootstrap.Modal(document.getElementById('editSessionModal'));

    modal.show();

}



async function handleEditSession(e) {

    e.preventDefault();

    const sessionId = document.getElementById('editSessionId').value;

    const subject = document.getElementById('editSubject').value;

    const score = parseInt(document.getElementById('editScore').value);

    const duration = parseInt(document.getElementById('editDuration').value);

    const date = document.getElementById('editDate').value;

    const notes = document.getElementById('editNotes').value;



    if (score < 0 || score > 100) { showAlert('Score must be 0-100', 'danger'); return; }

    if (duration <= 0) { showAlert('Duration must be > 0', 'danger'); return; }



    try {

        const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {

            method: 'PUT',

            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },

            body: JSON.stringify({ subject, score, duration, date, notes })

        });

        const data = await response.json();

        if (response.ok) {

            showAlert('Session updated! ✅', 'success');

            const modal = bootstrap.Modal.getInstance(document.getElementById('editSessionModal'));

            modal.hide();

            setTimeout(() => loadDashboard(), 400);

        } else {

            showAlert(data.error || 'Update failed', 'danger');

        }

    } catch (error) {

        showAlert('Error: ' + error.message, 'danger');

    }

}



async function deleteSession(sessionId) {

    if (!confirm('Delete this session?')) return;

    try {

        const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {

            method: 'DELETE',

            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` }

        });

        const data = await response.json();

        if (response.ok) {

            showAlert('Session deleted', 'success');

            setTimeout(() => loadDashboard(), 400);

        } else {

            showAlert(data.error || 'Delete failed', 'danger');

        }

    } catch (error) {

        showAlert('Error: ' + error.message, 'danger');

    }

}



// ==================== Charts ====================



// Helper: empty state

function showChartPlaceholder(canvasId, icon, msg) {

    const canvas = document.getElementById(canvasId);

    if (!canvas) return;

    const parent = canvas.parentElement;

    const existing = parent.querySelector('.chart-empty-state');

    if (existing) existing.remove();

    canvas.style.display = 'none';

    const div = document.createElement('div');

    div.className = 'chart-empty-state';

    div.innerHTML = `<i class="fas ${icon}"></i><p>${msg}</p>`;

    parent.appendChild(div);

}



function clearChartPlaceholder(canvasId) {

    const canvas = document.getElementById(canvasId);

    if (!canvas) return;

    const parent = canvas.parentElement;

    const existing = parent.querySelector('.chart-empty-state');

    if (existing) existing.remove();

    canvas.style.display = 'block';

}



// Weekly Study Hours (bar chart) + side stats

function displayWeeklyChart(weeklyStats, dashData) {

    const ctx = document.getElementById('weeklyChart')?.getContext('2d');

    if (!ctx) { console.error('weeklyChart canvas not found'); return; }

    if (typeof Chart === 'undefined') { console.error('Chart.js not loaded'); return; }

    if (charts.weekly) charts.weekly.destroy();



    // Side stats

    const sideStats = document.getElementById('chartSideStats');

    const totalHours = dashData?.user?.total_study_hours || 0;

    const totalSessions = dashData?.statistics?.total_sessions || 0;

    const avgScore = dashData?.statistics?.average_score || 0;

    sideStats.innerHTML = `

        <div class="side-stat">

            <div><div class="side-stat-label">Time Spent</div>

            <div class="side-stat-value">${Math.round(totalHours)} <span class="side-stat-badge blue">hrs</span></div></div>

        </div>

        <div class="side-stat">

            <div><div class="side-stat-label">Sessions Done</div>

            <div class="side-stat-value">${totalSessions} <span class="side-stat-badge green">done</span></div></div>

        </div>

        <div class="side-stat">

            <div><div class="side-stat-label">Avg Score</div>

            <div class="side-stat-value">${avgScore} <span class="side-stat-badge orange">${avgScore >= 70 ? '✓' : '↓'}%</span></div></div>

        </div>

    `;



    if (!weeklyStats || weeklyStats.length === 0) {

        showChartPlaceholder('weeklyChart', 'fa-chart-bar', 'No weekly data yet. Add sessions to see your study hours chart.');

        return;

    }

    clearChartPlaceholder('weeklyChart');



    // Ensure we have at least a few labels for a nice looking chart

    let labels = weeklyStats.map(w => {

        const d = new Date(w.week);

        return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });

    });

    let hoursData = weeklyStats.map(w => w.hours);

    // Pad with empty weeks if only 1-2 data points so bar chart looks reasonable

    if (weeklyStats.length < 3) {

        const lastDate = new Date(weeklyStats[weeklyStats.length - 1].week);

        for (let i = weeklyStats.length; i < 4; i++) {

            const padDate = new Date(lastDate);

            padDate.setDate(padDate.getDate() + 7 * (i - weeklyStats.length + 1));

            labels.push(padDate.toLocaleDateString('en', { month: 'short', day: 'numeric' }));

            hoursData.push(0);

        }

    }



    charts.weekly = new Chart(ctx, {

        type: 'bar',

        data: {

            labels,

            datasets: [{

                label: 'Hours',

                data: hoursData,

                backgroundColor: '#818cf8',

                borderRadius: 8,

                borderSkipped: false,

                barThickness: 28,

            }]

        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            plugins: {

                legend: { display: false }

            },

            scales: {

                y: {

                    beginAtZero: true,

                    grid: { color: 'rgba(0,0,0,.05)' },

                    ticks: { font: { size: 11, weight: '500' }, color: '#94a3b8' }

                },

                x: {

                    grid: { display: false },

                    ticks: { font: { size: 11, weight: '600' }, color: '#64748b' }

                }

            }

        }

    });

}



// Performance (doughnut)

function displayPerformanceChart(subjects, stats) {

    const ctx = document.getElementById('performanceChart')?.getContext('2d');

    if (!ctx) { console.error('performanceChart canvas not found'); return; }

    if (typeof Chart === 'undefined') { console.error('Chart.js not loaded'); return; }

    if (charts.performance) charts.performance.destroy();



    const summary = document.getElementById('performanceSummary');

    const avg = stats?.average_score || 0;



    if (!subjects || subjects.length === 0) {

        showChartPlaceholder('performanceChart', 'fa-chart-pie', 'No performance data yet.');

        summary.innerHTML = '';

        return;

    }

    clearChartPlaceholder('performanceChart');



    // For single subject, add a "Remaining" slice so doughnut renders visually

    let chartLabels = subjects.map(s => s.subject);

    let chartData = subjects.map(s => s.average_score);

    if (subjects.length === 1) {

        chartLabels.push('Remaining');

        chartData.push(Math.max(0, 100 - subjects[0].average_score));

    }



    const colors = ['#818cf8','#f472b6','#34d399','#fbbf24','#60a5fa','#a78bfa','#fb923c'];



    charts.performance = new Chart(ctx, {

        type: 'doughnut',

        data: {

            labels: chartLabels,

            datasets: [{

                data: chartData,

                backgroundColor: chartLabels.map((l, i) => l === 'Remaining' ? '#e2e8f0' : colors[i % colors.length]),

                borderWidth: 0,

                cutout: '70%'

            }]

        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            plugins: {

                legend: {

                    position: 'bottom',

                    labels: { padding: 12, font: { size: 11, weight: '500' }, usePointStyle: true, pointStyleWidth: 8 }

                }

            }

        }

    });



    const comparison = avg >= 70 ? 'above target 🎉' : 'needs improvement';

    summary.innerHTML = `<div class="perf-percent">${avg}%</div><div class="perf-text">Overall average — ${comparison}</div>`;

}



// Score Trend (line)

function displayTrendChart(sessions) {

    const ctx = document.getElementById('trendChart')?.getContext('2d');

    if (!ctx) { console.error('trendChart canvas not found'); return; }

    if (typeof Chart === 'undefined') { console.error('Chart.js not loaded'); return; }

    if (charts.trend) charts.trend.destroy();



    if (!sessions || sessions.length === 0) {

        showChartPlaceholder('trendChart', 'fa-chart-line', 'Score trends will appear here over time.');

        return;

    }

    clearChartPlaceholder('trendChart');



    const sorted = [...sessions].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Even with 1 data point, show it nicely

    const labels = sorted.map(s => new Date(s.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }));

    const scores = sorted.map(s => s.score);

    const subjects = sorted.map(s => s.subject);

    const isSingle = scores.length === 1;



    const movingAvg = scores.map((_, i, arr) => {

        const start = Math.max(0, i - 2);

        const slice = arr.slice(start, i + 1);

        return Math.round(slice.reduce((a, b) => a + b, 0) / slice.length);

    });



    charts.trend = new Chart(ctx, {

        type: 'line',

        data: {

            labels,

            datasets: [

                {

                    label: 'Score',

                    data: scores,

                    borderColor: '#4f46e5',

                    backgroundColor: 'rgba(79,70,229,0.08)',

                    fill: true,

                    tension: .35,

                    pointBackgroundColor: scores.map(s => s >= 70 ? '#22c55e' : '#ef4444'),

                    pointBorderColor: '#fff',

                    pointBorderWidth: 2,

                    pointRadius: isSingle ? 8 : 5,

                    pointHoverRadius: isSingle ? 10 : 7,

                    borderWidth: 2.5

                },

                {

                    label: 'Moving Avg',

                    data: movingAvg,

                    borderColor: '#f59e0b',

                    borderDash: [6, 3],

                    borderWidth: 2,

                    pointRadius: isSingle ? 6 : 0,

                    fill: false,

                    tension: .4

                }

            ]

        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            plugins: {

                legend: {

                    labels: { font: { size: 11, weight: '600' }, usePointStyle: true, padding: 16 }

                },

                tooltip: {

                    callbacks: {

                        afterLabel: (ctx) => ctx.datasetIndex === 0 ? `Subject: ${subjects[ctx.dataIndex]}` : ''

                    }

                }

            },

            scales: {

                y: { min: 0, max: 100, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { size: 11 }, color: '#94a3b8' } },

                x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#64748b' } }

            }

        }

    });

}



// ==================== Add Session ====================

async function handleAddSession(e) {

    e.preventDefault();

    const subject = document.getElementById('sessionSubject').value;

    const score = parseInt(document.getElementById('sessionScore').value);

    const duration = parseInt(document.getElementById('sessionDuration').value);

    const date = document.getElementById('sessionDate').value;

    const notes = document.getElementById('sessionNotes').value;



    if (score < 0 || score > 100) { showAlert('Score must be 0-100', 'danger'); return; }

    if (duration <= 0) { showAlert('Duration must be > 0', 'danger'); return; }



    try {

        const response = await fetch(`${API_BASE_URL}/sessions`, {

            method: 'POST',

            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },

            body: JSON.stringify({ subject, score, duration, date, notes })

        });

        const data = await response.json();

        if (response.ok) {

            showAlert('Session added! 🎉', 'success');

            document.getElementById('addSessionForm').reset();

            const modal = bootstrap.Modal.getInstance(document.getElementById('addSessionModal'));

            modal.hide();

            setTimeout(() => loadDashboard(), 600);

        } else {

            showAlert(data.error || 'Failed to add session', 'danger');

        }

    } catch (error) {

        showAlert('Error: ' + error.message, 'danger');

    }

}



// ==================== API ====================

async function fetchWithAuth(url, options = {}) {

    try {

        const mergedHeaders = { 'Authorization': `Bearer ${authToken}` };
        if (!(options.body instanceof FormData)) {
            mergedHeaders['Content-Type'] = 'application/json';
        }
        Object.assign(mergedHeaders, options.headers || {});

        const response = await fetch(url, {

            method: options.method || 'GET',

            headers: mergedHeaders,

            ...(options.body ? { body: options.body } : {})

        });

        const data = await response.json();

        if (response.ok) return data;

        if (response.status === 401) logout();

        return data || null;

    } catch (error) {

        console.error('Fetch error:', error);

        return null;

    }

}



// ==================== Alerts ====================

function showAlert(message, type = 'info') {

    const container = document.getElementById('alertContainer');

    const id = 'alert-' + Date.now();

    const iconMap = { success: 'fa-check-circle', danger: 'fa-exclamation-circle', info: 'fa-info-circle' };

    const el = document.createElement('div');

    el.id = id;

    el.className = `alert-toast ${type}`;

    el.innerHTML = `<i class="fas ${iconMap[type] || 'fa-info-circle'}"></i><span>${message}</span><button class="alert-close" onclick="document.getElementById('${id}').remove()">&times;</button>`;

    container.appendChild(el);

    setTimeout(() => { const a = document.getElementById(id); if (a) a.remove(); }, 4000);

}



// ==================== PAGE: All Sessions ====================

function renderAllSessionsPage() {

    renderSessionsTable(allRecentSessions, 'allSessionsContainer', true);

}



// ==================== PAGE: AI Tips ====================

function renderTipsPage() {

    const container = document.getElementById('tipsPageContainer');

    if (!cachedRecommendations || !cachedDashboard) {

        container.innerHTML = '<p class="empty-text">Loading...</p>';

        return;

    }

    const data = cachedRecommendations;

    const weakAreas = cachedDashboard.weak_areas || [];

    let html = '';



    if (data.recommendations && data.recommendations.length > 0) {

        html += '<div class="tips-section"><h6 class="tips-section-title"><i class="fas fa-lightbulb me-2"></i>AI Recommendations</h6>';

        html += '<div class="tips-cards">';

        const icons = ['fa-bullseye', 'fa-clock', 'fa-calendar-day', 'fa-mug-hot', 'fa-redo'];

        data.recommendations.forEach((rec, i) => {

            html += `<div class="tip-card"><div class="tip-icon"><i class="fas ${icons[i % icons.length]}"></i></div><p>${rec}</p></div>`;

        });

        html += '</div></div>';

    } else {

        html += `<div class="tips-section"><div class="empty-state-box"><i class="fas fa-lightbulb"></i><p>${data.message || 'Add study sessions to get AI-powered tips!'}</p></div></div>`;

    }



    if (weakAreas.length > 0) {

        html += '<div class="tips-section"><h6 class="tips-section-title"><i class="fas fa-exclamation-triangle me-2"></i>Subject Analysis</h6>';

        html += '<div class="subject-analysis-grid">';

        weakAreas.forEach(a => {

            const cls = a.is_weak ? (a.average_score < 50 ? 'danger' : 'warning') : 'good';

            const statusText = a.is_weak ? (a.average_score < 50 ? 'Needs Urgent Attention' : 'Needs Improvement') : 'On Track';

            html += `<div class="analysis-card ${cls}">

                <div class="analysis-header"><h6>${a.subject}</h6><span class="badge-status badge-${cls}">${statusText}</span></div>

                <div class="analysis-stats"><div><span class="label">Average</span><span class="value">${a.average_score}%</span></div><div><span class="label">Sessions</span><span class="value">${a.session_count}</span></div></div>

                <div class="analysis-bar"><div class="analysis-bar-fill" style="width:${a.average_score}%;background:${a.is_weak ? (a.average_score < 50 ? '#ef4444' : '#f59e0b') : '#22c55e'}"></div></div>

            </div>`;

        });

        html += '</div></div>';

    }



    if (data.study_schedule && data.study_schedule.length > 0) {

        html += '<div class="tips-section"><h6 class="tips-section-title"><i class="fas fa-tasks me-2"></i>Recommended Focus Areas</h6>';

        html += '<div class="schedule-list">';

        data.study_schedule.forEach(s => {

            const pc = s.priority === 'High' ? '#ef4444' : '#f59e0b';

            html += `<div class="schedule-item"><div class="schedule-badge" style="background:${pc}20;color:${pc}">${s.priority}</div><div class="schedule-info"><strong>${s.subject}</strong><span>Current avg: ${s.current_average}% • ${s.sessions} sessions</span></div><div class="schedule-hours">${s.recommended_hours_per_week}h<small>/week</small></div></div>`;

        });

        if (data.total_recommended_hours) {

            html += `<div class="schedule-total">Total recommended: <strong>${data.total_recommended_hours} hours/week</strong></div>`;

        }

        html += '</div></div>';

    }

    container.innerHTML = html;

}



// ==================== PAGE: Progress ====================

function renderProgressPage() {

    const container = document.getElementById('progressPageContainer');

    if (!cachedProgress || !cachedDashboard) {

        container.innerHTML = '<p class="empty-text">Loading...</p>';

        return;

    }

    const progress = cachedProgress;

    const subjects = progress.subjects || [];



    if (subjects.length === 0) {

        container.innerHTML = '<div class="empty-state-box"><i class="fas fa-chart-line"></i><p>No progress data yet. Add study sessions to track your progress!</p></div>';

        return;

    }



    let html = '<div class="progress-summary-row">';

    html += `<div class="progress-summary-card"><div class="psc-icon c1"><i class="fas fa-book-open"></i></div><div><div class="psc-value">${progress.total_sessions}</div><div class="psc-label">Total Sessions</div></div></div>`;

    html += `<div class="progress-summary-card"><div class="psc-icon c2"><i class="fas fa-layer-group"></i></div><div><div class="psc-value">${subjects.length}</div><div class="psc-label">Subjects Studied</div></div></div>`;

    html += `<div class="progress-summary-card"><div class="psc-icon c3"><i class="fas fa-trophy"></i></div><div><div class="psc-value">${progress.overall_average}%</div><div class="psc-label">Overall Average</div></div></div>`;

    const totalHours = subjects.reduce((sum, s) => sum + s.total_hours, 0);

    html += `<div class="progress-summary-card"><div class="psc-icon c4"><i class="fas fa-clock"></i></div><div><div class="psc-value">${totalHours.toFixed(1)}h</div><div class="psc-label">Total Study Time</div></div></div>`;

    html += '</div>';



    html += '<div class="section-label" style="margin-top:1.5rem">Subject Progress</div>';

    html += '<div class="progress-cards-grid">';

    subjects.forEach(s => {

        const barColor = s.average_score >= 70 ? '#22c55e' : (s.average_score >= 50 ? '#f59e0b' : '#ef4444');

        const trendIcon = s.trend === 'improving' ? 'fa-arrow-up' : 'fa-minus';

        const trendColor = s.trend === 'improving' ? '#22c55e' : '#94a3b8';

        html += `<div class="progress-subject-card">

            <div class="ps-header"><h6>${s.subject}</h6><span class="ps-trend" style="color:${trendColor}"><i class="fas ${trendIcon}"></i> ${s.trend}</span></div>

            <div class="ps-score">${s.average_score}%</div>

            <div class="analysis-bar"><div class="analysis-bar-fill" style="width:${s.average_score}%;background:${barColor}"></div></div>

            <div class="ps-details"><span><i class="fas fa-book-open"></i> ${s.sessions} sessions</span><span><i class="fas fa-clock"></i> ${s.total_hours}h studied</span><span><i class="fas fa-star"></i> Latest: ${s.latest_score}%</span></div>

        </div>`;

    });

    html += '</div>';

    container.innerHTML = html;

}



// ==================== PAGE: Schedule ====================

function renderSchedulePage() {

    const container = document.getElementById('schedulePageContainer');

    if (!cachedRecommendations || !cachedDashboard) {

        container.innerHTML = '<p class="empty-text">Loading...</p>';

        return;

    }

    const data = cachedRecommendations;

    const weakAreas = cachedDashboard.weak_areas || [];

    const allSubjects = (cachedProgress && cachedProgress.subjects) ? cachedProgress.subjects : [];



    if (allSubjects.length === 0 && weakAreas.length === 0) {

        container.innerHTML = '<div class="empty-state-box"><i class="fas fa-calendar-check"></i><p>No study data yet. Add sessions to generate your smart weekly planner!</p></div>';

        return;

    }



    container.innerHTML = buildAdvancedSchedule(weakAreas, data, allSubjects);

    animateScheduleEntrance();

}



function buildAdvancedSchedule(weakAreas, recsData, allSubjects) {

    const schedule = recsData.study_schedule || [];

    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

    const dayShort = ['MON','TUE','WED','THU','FRI','SAT','SUN'];

    const dayEmoji = ['☕','🔥','⚡','⭐','🚀','📖','😴'];

    const todayIdx = (new Date().getDay() + 6) % 7; // 0=Mon..6=Sun



    // Build smart allocations: mix weak + strong subjects across the week

    const weakSubjects = schedule.map(s => ({

        ...s, type: 'weak',

        color: s.priority === 'High' ? '#ef4444' : '#f59e0b',

        bg: s.priority === 'High' ? '#fee2e2' : '#fef3c7'

    }));

    const strongSubjects = allSubjects

        .filter(s => s.average_score >= 70)

        .map(s => ({

            subject: s.subject, type: 'strong', priority: 'Maintain',

            recommended_hours_per_week: Math.max(1, Math.round(s.total_hours / Math.max(s.sessions, 1))),

            current_average: s.average_score, sessions: s.sessions,

            color: '#22c55e', bg: '#dcfce7'

        }));



    // Time slots

    const slots = [

        { label: 'Morning', time: '8:00 – 10:00', icon: 'fa-sun', accent: '#f59e0b' },

        { label: 'Afternoon', time: '2:00 – 4:00', icon: 'fa-cloud-sun', accent: '#3b82f6' },

        { label: 'Evening', time: '6:00 – 8:00', icon: 'fa-moon', accent: '#7c3aed' }

    ];



    // Distribute subjects across days intelligently

    const dayPlan = days.map((_, di) => {

        const tasks = [];

        if (di === 6) return tasks; // Sunday = rest



        // Weak subjects get more slots

        weakSubjects.forEach((ws, si) => {

            const daysPerWeek = ws.priority === 'High' ? 5 : 3;

            const freq = Math.floor(6 / daysPerWeek);

            if (di % freq === si % freq || (ws.priority === 'High' && di < 5)) {

                const dailyH = (ws.recommended_hours_per_week / daysPerWeek).toFixed(1);

                const slotIdx = tasks.length % slots.length;

                tasks.push({ ...ws, dailyHours: dailyH, slot: slots[slotIdx] });

            }

        });



        // Strong subjects get light review 1-2 times/week

        strongSubjects.forEach((ss, si) => {

            if ((di + si) % 3 === 0 && tasks.length < 3) {

                const slotIdx = tasks.length % slots.length;

                tasks.push({ ...ss, dailyHours: '0.5', slot: slots[slotIdx] });

            }

        });



        return tasks;

    });



    // Total planned hours

    const totalPlannedH = dayPlan.reduce((sum, tasks) => sum + tasks.reduce((s, t) => s + parseFloat(t.dailyHours), 0), 0);

    const totalWeakH = recsData.total_recommended_hours || 0;



    let html = '';



    // === Hero banner ===

    html += `<div class="sp-hero">

        <div class="sp-hero-content">

            <div class="sp-hero-icon"><i class="fas fa-brain"></i></div>

            <div>

                <h4>Your Smart Study Plan</h4>

                <p>AI-generated weekly planner based on your performance data</p>

            </div>

        </div>

        <div class="sp-hero-stats">

            <div class="sp-hero-stat"><span class="sp-hs-value">${totalPlannedH.toFixed(1)}</span><span class="sp-hs-label">hrs/week</span></div>

            <div class="sp-hero-divider"></div>

            <div class="sp-hero-stat"><span class="sp-hs-value">${weakSubjects.length + strongSubjects.length}</span><span class="sp-hs-label">subjects</span></div>

            <div class="sp-hero-divider"></div>

            <div class="sp-hero-stat"><span class="sp-hs-value">${weakSubjects.length}</span><span class="sp-hs-label">to fix</span></div>

        </div>

    </div>`;



    // === Subject priority cards ===

    if (weakSubjects.length > 0 || strongSubjects.length > 0) {

        html += '<div class="sp-priority-row">';

        [...weakSubjects, ...strongSubjects].forEach(s => {

            const scoreColor = s.type === 'weak' ? (s.current_average < 50 ? '#ef4444' : '#f59e0b') : '#22c55e';

            const priorityLabel = s.type === 'weak' ? s.priority : 'Maintain';

            const priorityBg = s.type === 'weak' ? (s.priority === 'High' ? '#fee2e2' : '#fef3c7') : '#dcfce7';

            const priorityTxt = s.type === 'weak' ? (s.priority === 'High' ? '#dc2626' : '#d97706') : '#16a34a';

            const hoursLabel = s.type === 'weak' ? `${s.recommended_hours_per_week}h/wk` : 'Review';

            html += `<div class="sp-subj-chip">

                <div class="sp-subj-bar" style="background:${scoreColor}"></div>

                <div class="sp-subj-info">

                    <strong>${s.subject}</strong>

                    <div class="sp-subj-meta">

                        <span class="sp-subj-score" style="color:${scoreColor}">${s.current_average}%</span>

                        <span class="sp-subj-badge" style="background:${priorityBg};color:${priorityTxt}">${priorityLabel}</span>

                        <span class="sp-subj-hours">${hoursLabel}</span>

                    </div>

                </div>

            </div>`;

        });

        html += '</div>';

    }



    // === Week timeline ===

    html += '<div class="sp-week-header">';

    days.forEach((d, i) => {

        const isToday = i === todayIdx;

        html += `<button class="sp-day-tab${isToday ? ' active' : ''}" onclick="selectScheduleDay(${i})" data-day="${i}">

            <span class="sp-dt-emoji">${dayEmoji[i]}</span>

            <span class="sp-dt-short">${dayShort[i]}</span>

            ${isToday ? '<span class="sp-dt-dot"></span>' : ''}

        </button>`;

    });

    html += '</div>';



    // === Day detail panels ===

    html += '<div class="sp-day-panels">';

    days.forEach((day, di) => {

        const isToday = di === todayIdx;

        const tasks = dayPlan[di];

        const dayH = tasks.reduce((s, t) => s + parseFloat(t.dailyHours), 0);



        html += `<div class="sp-day-panel${isToday ? ' active' : ''}" id="spDay${di}">`;

        html += `<div class="sp-dp-header">

            <div>

                <h5>${dayEmoji[di]} ${day}</h5>

                <span class="sp-dp-subtitle">${isToday ? "Today's Plan" : tasks.length > 0 ? `${tasks.length} session${tasks.length > 1 ? 's' : ''} planned` : 'Rest day'}</span>

            </div>

            <div class="sp-dp-hours">${dayH.toFixed(1)}<small>hrs</small></div>

        </div>`;



        if (di === 6 || tasks.length === 0) {

            html += `<div class="sp-rest-block">

                <div class="sp-rest-icon"><i class="fas ${di === 6 ? 'fa-couch' : 'fa-check-circle'}"></i></div>

                <h6>${di === 6 ? 'Rest & Recharge' : 'Free Day'}</h6>

                <p>${di === 6 ? 'Take a break! Review notes lightly and prepare for next week.' : 'No sessions planned. Use this time for light review or hobbies.'}</p>

            </div>`;

        } else {

            html += '<div class="sp-timeline">';

            tasks.forEach((t, ti) => {

                const isWeak = t.type === 'weak';

                html += `<div class="sp-tl-item">

                    <div class="sp-tl-line">

                        <div class="sp-tl-dot" style="background:${t.color}"></div>

                        ${ti < tasks.length - 1 ? '<div class="sp-tl-connector"></div>' : ''}

                    </div>

                    <div class="sp-tl-card">

                        <div class="sp-tl-slot">

                            <i class="fas ${t.slot.icon}" style="color:${t.slot.accent}"></i>

                            <span>${t.slot.label} · ${t.slot.time}</span>

                        </div>

                        <div class="sp-tl-main">

                            <div class="sp-tl-subject">${t.subject}</div>

                            <div class="sp-tl-detail">

                                <span class="sp-tl-dur"><i class="fas fa-clock"></i> ${t.dailyHours}h</span>

                                <span class="sp-tl-badge" style="background:${t.bg};color:${isWeak ? (t.priority === 'High' ? '#dc2626' : '#d97706') : '#16a34a'}">${isWeak ? (t.priority === 'High' ? '🔴 High Priority' : '🟡 Medium') : '🟢 Review'}</span>

                            </div>

                            ${isWeak ? `<div class="sp-tl-tip"><i class="fas fa-lightbulb"></i> ${getStudyTip(t.subject, t.current_average)}</div>` : ''}

                        </div>

                    </div>

                </div>`;

            });

            html += '</div>';

        }



        html += '</div>';

    });

    html += '</div>';



    // === Weekly summary bar chart ===

    html += '<div class="sp-summary-card">';

    html += '<h6><i class="fas fa-chart-bar me-2"></i>Weekly Hours Distribution</h6>';

    html += '<div class="sp-bar-chart">';

    const maxH = Math.max(...dayPlan.map(tasks => tasks.reduce((s, t) => s + parseFloat(t.dailyHours), 0)), 1);

    days.forEach((d, i) => {

        const h = dayPlan[i].reduce((s, t) => s + parseFloat(t.dailyHours), 0);

        const pct = Math.round((h / maxH) * 100);

        const isToday = i === todayIdx;

        html += `<div class="sp-bar-col${isToday ? ' today' : ''}">

            <div class="sp-bar-value">${h > 0 ? h.toFixed(1) + 'h' : '-'}</div>

            <div class="sp-bar-track"><div class="sp-bar-fill" style="height:${pct}%"></div></div>

            <div class="sp-bar-label">${dayShort[i]}</div>

        </div>`;

    });

    html += '</div></div>';



    // === Study strategy tips ===

    html += `<div class="sp-strategy-card">

        <h6><i class="fas fa-chess me-2"></i>Study Strategy</h6>

        <div class="sp-strat-grid">

            <div class="sp-strat-item">

                <div class="sp-strat-icon" style="background:#fef3c7;color:#f59e0b"><i class="fas fa-brain"></i></div>

                <div><strong>Active Recall</strong><p>Test yourself instead of re-reading. Close the book and try to recall key concepts from memory.</p></div>

            </div>

            <div class="sp-strat-item">

                <div class="sp-strat-icon" style="background:#dbeafe;color:#3b82f6"><i class="fas fa-redo"></i></div>

                <div><strong>Spaced Repetition</strong><p>Review weak subjects every 2-3 days. The schedule spaces them out for optimal retention.</p></div>

            </div>

            <div class="sp-strat-item">

                <div class="sp-strat-icon" style="background:#dcfce7;color:#22c55e"><i class="fas fa-stopwatch"></i></div>

                <div><strong>Pomodoro Technique</strong><p>Study 25 min, break 5 min. Use the Study Timer page to stay on track.</p></div>

            </div>

            <div class="sp-strat-item">

                <div class="sp-strat-icon" style="background:#fce7f3;color:#ec4899"><i class="fas fa-bed"></i></div>

                <div><strong>Rest & Sleep</strong><p>Take Sundays off. Sleep 7-8 hrs — your brain consolidates memory during sleep.</p></div>

            </div>

        </div>

    </div>`;



    return html;

}



function getStudyTip(subject, score) {

    const tips = [

        `Score is ${score}% — focus on fundamentals and practice problems`,

        `Try teaching ${subject} to someone else to reinforce understanding`,

        `Break ${subject} into smaller topics and tackle one at a time`,

        `Watch tutorial videos, then solve problems without looking at notes`,

        `Create flashcards for key formulas and definitions in ${subject}`,

        `Do past papers or quizzes to identify specific gaps in ${subject}`

    ];

    return tips[Math.floor(Math.abs(score * subject.length)) % tips.length];

}



function selectScheduleDay(dayIdx) {

    document.querySelectorAll('.sp-day-tab').forEach(t => t.classList.remove('active'));

    document.querySelector(`.sp-day-tab[data-day="${dayIdx}"]`)?.classList.add('active');

    document.querySelectorAll('.sp-day-panel').forEach(p => p.classList.remove('active'));

    document.getElementById('spDay' + dayIdx)?.classList.add('active');

}



function animateScheduleEntrance() {

    const items = document.querySelectorAll('.sp-tl-item, .sp-subj-chip, .sp-bar-col');

    items.forEach((el, i) => {

        el.style.opacity = '0';

        el.style.transform = 'translateY(12px)';

        setTimeout(() => {

            el.style.transition = 'all .35s ease';

            el.style.opacity = '1';

            el.style.transform = 'translateY(0)';

        }, 60 * i);

    });

}



// ==================== STUDY TIMER ====================

let timerInterval = null;
let timerSeconds = 0;
let timerTotalSeconds = 0;
let timerRunning = false;
let timerPaused = false;
let timerMode = 'pomodoro';
let pomodoroPhase = 'focus';
let pomodoroCount = 0;
let timerSessionStart = null;
let soundEnabled = true;
let focusModeActive = false;
let ambientNode = null;
let ambientType = null;
let ambientCtx = null;
let timerDailyGoalMin = 120;

let timerSettings = { focus: 25, shortBreak: 5, longBreak: 15, countdown: 30 };

const RING_CIRCUMFERENCE = 2 * Math.PI * 120; // ~754.0

let timerHistory = JSON.parse(localStorage.getItem('timerHistory') || '[]');

const BREAK_TIPS = [
    'Stretch your arms and back for 2 minutes 🧘',
    'Drink a glass of water 💧',
    'Look at something 20 feet away for 20 seconds 👀',
    'Take 5 deep breaths 🫁',
    'Walk around for a minute 🚶',
    'Rest your eyes — close them for 30 seconds 😌',
    'Grab a healthy snack 🍎',
    'Do 10 jumping jacks to boost energy ⚡',
];

function initTimerPage() {
    timerDailyGoalMin = parseInt(localStorage.getItem('timerDailyGoal') || '120');
    updateTimerSettingsUI();
    updateTimerDisplay();
    updatePomodoroDotsUI();
    renderTimerHistory();
    updateStatsRow();
    showTimerSettingsForMode();
    const gi = document.getElementById('goalInput');
    if (gi) gi.value = timerDailyGoalMin;
    updateGoalDisplay();
}

function switchTimerMode(mode) {
    if (timerRunning) return;
    timerMode = mode;
    pomodoroPhase = 'focus';
    pomodoroCount = 0;
    timerPaused = false;
    document.querySelectorAll('.timer-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.timer-tab[data-mode="${mode}"]`).classList.add('active');
    showTimerSettingsForMode();
    resetTimerState();
    updateTimerDisplay();
    updatePomodoroDotsUI();
    updateTimerButtons('idle');
    updateTimerStatus('Ready to focus');
    updatePhaseBadge();
}

function showTimerSettingsForMode() {
    const ids = ['settingFocus','settingShortBreak','settingLongBreak','settingCountdown','pomodoroDots','timerPresets'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    if (timerMode === 'pomodoro') {
        ['settingFocus','settingShortBreak','settingLongBreak','timerPresets'].forEach(id => {
            const el = document.getElementById(id); if (el) el.style.display = '';
        });
        const dots = document.getElementById('pomodoroDots');
        if (dots) dots.style.display = 'flex';
    } else if (timerMode === 'countdown') {
        const sc = document.getElementById('settingCountdown'); if (sc) sc.style.display = '';
        const pr = document.getElementById('timerPresets'); if (pr) pr.style.display = 'flex';
    }
}

function adjustSetting(key, delta) {
    if (timerRunning) return;
    timerSettings[key] = Math.max(1, timerSettings[key] + delta);
    updateTimerSettingsUI();
    resetTimerState();
    updateTimerDisplay();
}

function updateTimerSettingsUI() {
    document.getElementById('settingFocusVal').textContent = timerSettings.focus;
    document.getElementById('settingShortBreakVal').textContent = timerSettings.shortBreak;
    document.getElementById('settingLongBreakVal').textContent = timerSettings.longBreak;
    document.getElementById('settingCountdownVal').textContent = timerSettings.countdown;
}

function applyPreset(focus, brk) {
    if (timerRunning) return;
    timerSettings.focus = focus;
    timerSettings.shortBreak = brk;
    timerSettings.longBreak = Math.round(brk * 3);
    timerSettings.countdown = focus;
    updateTimerSettingsUI();
    resetTimerState();
    updateTimerDisplay();
}

function resetTimerState() {
    clearInterval(timerInterval);
    timerInterval = null;
    timerRunning = false;
    timerPaused = false;
    if (timerMode === 'pomodoro') {
        const map = { focus: timerSettings.focus, shortBreak: timerSettings.shortBreak, longBreak: timerSettings.longBreak };
        timerTotalSeconds = (map[pomodoroPhase] || timerSettings.focus) * 60;
        timerSeconds = timerTotalSeconds;
    } else if (timerMode === 'countdown') {
        timerTotalSeconds = timerSettings.countdown * 60;
        timerSeconds = timerTotalSeconds;
    } else {
        timerSeconds = 0;
        timerTotalSeconds = 0;
    }
}

function formatTime(totalSec) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    if (h > 0) return `${h}h ${mm}m ${ss}s`;
    return `${mm}m ${ss}s`;
}

function formatDuration(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${m}m ${String(s).padStart(2,'0')}s`;
    if (m > 0) return `${m}m ${String(s).padStart(2,'0')}s`;
    return `${s}s`;
}

function updateTimerDisplay() {
    const display = document.getElementById('timerDisplay');
    const ring = document.getElementById('timerRingProgress');
    if (!display || !ring) return;
    display.textContent = formatTime(timerSeconds);
    let progress = 0;
    if (timerMode === 'stopwatch') {
        progress = (timerSeconds % 3600) / 3600;
        ring.setAttribute('stroke', 'url(#ringGradStop)');
    } else {
        progress = timerTotalSeconds > 0 ? (timerTotalSeconds - timerSeconds) / timerTotalSeconds : 0;
        const isBreak = timerMode === 'pomodoro' && pomodoroPhase !== 'focus';
        ring.setAttribute('stroke', isBreak ? 'url(#ringGradBreak)' : 'url(#ringGradFocus)');
    }
    ring.style.strokeDasharray = RING_CIRCUMFERENCE;
    ring.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);
    if (focusModeActive) {
        const fd = document.getElementById('fmDisplay');
        if (fd) fd.textContent = formatTime(timerSeconds);
    }
}

function updateTimerStatus(text) {
    const el = document.getElementById('timerStatus');
    if (el) el.textContent = text;
    const fs = document.getElementById('fmStatus');
    if (fs) fs.textContent = text;
}

function updateTimerButtons(state) {
    const startBtn = document.getElementById('timerStartBtn');
    const pauseBtn = document.getElementById('timerPauseBtn');
    const resumeBtn = document.getElementById('timerResumeBtn');
    if (startBtn) startBtn.style.display = state === 'idle' ? '' : 'none';
    if (pauseBtn) pauseBtn.style.display = state === 'running' ? '' : 'none';
    if (resumeBtn) resumeBtn.style.display = state === 'paused' ? '' : 'none';
}

function updatePomodoroDotsUI() {
    for (let i = 1; i <= 4; i++) {
        const dot = document.getElementById('pomDot' + i);
        if (!dot) continue;
        dot.classList.remove('done', 'active');
        if (i <= pomodoroCount) dot.classList.add('done');
        else if (i === pomodoroCount + 1 && timerRunning && pomodoroPhase === 'focus') dot.classList.add('active');
    }
}

function updatePhaseBadge() {
    const badge = document.getElementById('timerPhaseBadge');
    if (!badge) return;
    const phaseLabels = { focus: 'Focus', shortBreak: 'Short Break', longBreak: 'Long Break' };
    const modeLabels = { countdown: 'Countdown', stopwatch: 'Stopwatch' };
    if (timerMode === 'pomodoro') {
        badge.textContent = phaseLabels[pomodoroPhase] || 'Focus';
        badge.className = 'timer-phase-badge ' + (pomodoroPhase === 'focus' ? 'badge-focus' : 'badge-break');
    } else {
        badge.textContent = modeLabels[timerMode] || '';
        badge.className = 'timer-phase-badge badge-neutral';
    }
}

function startTimer() {
    if (timerRunning) return;
    timerRunning = true;
    timerPaused = false;
    timerSessionStart = new Date();
    if (timerMode === 'pomodoro') {
        const map = { focus: timerSettings.focus, shortBreak: timerSettings.shortBreak, longBreak: timerSettings.longBreak };
        timerTotalSeconds = (map[pomodoroPhase] || timerSettings.focus) * 60;
        timerSeconds = timerTotalSeconds;
        updateTimerStatus(pomodoroPhase === 'focus' ? '🎯 Focusing...' : '☕ Break time!');
        hideBreakTip();
    } else if (timerMode === 'countdown') {
        timerTotalSeconds = timerSettings.countdown * 60;
        timerSeconds = timerTotalSeconds;
        updateTimerStatus('⏳ Counting down...');
    } else {
        timerSeconds = 0;
        updateTimerStatus('⏱️ Stopwatch running...');
    }
    updateTimerButtons('running');
    updatePomodoroDotsUI();
    updatePhaseBadge();
    updateFocusModeDisplay();
    timerInterval = setInterval(() => {
        if (timerMode === 'stopwatch') {
            timerSeconds++;
        } else {
            timerSeconds--;
            if (timerSeconds <= 0) {
                timerSeconds = 0;
                updateTimerDisplay();
                onTimerComplete();
                return;
            }
        }
        updateTimerDisplay();
    }, 1000);
    updateTimerDisplay();
}

function pauseTimer() {
    if (!timerRunning || timerPaused) return;
    timerPaused = true;
    clearInterval(timerInterval);
    updateTimerButtons('paused');
    updateTimerStatus('⏸️ Paused');
}

function resumeTimer() {
    if (!timerPaused) return;
    timerPaused = false;
    updateTimerButtons('running');
    const pomStatus = pomodoroPhase === 'focus' ? '🎯 Focusing...' : '☕ Break time!';
    const resumeStatus = { countdown: '⏳ Counting down...', stopwatch: '⏱️ Stopwatch running...' };
    updateTimerStatus(timerMode === 'pomodoro' ? pomStatus : resumeStatus[timerMode]);
    timerInterval = setInterval(() => {
        if (timerMode === 'stopwatch') {
            timerSeconds++;
        } else {
            timerSeconds--;
            if (timerSeconds <= 0) {
                timerSeconds = 0;
                updateTimerDisplay();
                onTimerComplete();
                return;
            }
        }
        updateTimerDisplay();
    }, 1000);
}

function resetTimer() {
    const elapsed = timerSessionStart ? Math.round((new Date() - timerSessionStart) / 1000) : 0;
    if (timerRunning && elapsed >= 30) saveTimerSession(elapsed);
    clearInterval(timerInterval);
    timerInterval = null;
    timerRunning = false;
    timerPaused = false;
    timerSessionStart = null;
    if (timerMode === 'pomodoro') { pomodoroPhase = 'focus'; pomodoroCount = 0; }
    resetTimerState();
    updateTimerDisplay();
    updateTimerButtons('idle');
    updateTimerStatus('Ready to focus');
    updatePomodoroDotsUI();
    updatePhaseBadge();
    hideBreakTip();
}

function onTimerComplete() {
    clearInterval(timerInterval);
    timerInterval = null;
    timerRunning = false;
    playCompletionSound();
    const elapsed = timerSessionStart ? Math.round((new Date() - timerSessionStart) / 1000) : timerTotalSeconds;
    if (timerMode === 'pomodoro') {
        if (pomodoroPhase === 'focus') {
            pomodoroCount++;
            saveTimerSession(elapsed);
            updatePomodoroDotsUI();
            if (pomodoroCount >= 4) {
                pomodoroPhase = 'longBreak';
                pomodoroCount = 0;
                updateTimerStatus('🎉 Long break time!');
                showAlert('4 pomodoros done! Take a well-earned long break 🎉', 'success');
            } else {
                pomodoroPhase = 'shortBreak';
                updateTimerStatus(`✅ Pomodoro #${pomodoroCount} done! Short break.`);
                showAlert(`Pomodoro #${pomodoroCount} complete! Short break time ☕`, 'info');
            }
            showBreakTip();
        } else {
            pomodoroPhase = 'focus';
            updateTimerStatus('💪 Break over — time to focus!');
            showAlert('Break is over! Ready to focus again 💪', 'info');
            hideBreakTip();
        }
        timerSessionStart = null;
        resetTimerState();
        updateTimerDisplay();
        updateTimerButtons('idle');
        updatePhaseBadge();
    } else if (timerMode === 'countdown') {
        saveTimerSession(elapsed);
        timerSessionStart = null;
        updateTimerDisplay();
        updateTimerButtons('idle');
        updateTimerStatus("⏰ Time's up!");
        showAlert('Countdown complete! Great study session ✅', 'success');
        showBreakTip();
    }
}

function saveTimerSession(durationSec) {
    const subject = document.getElementById('timerSubject').value.trim() || 'General Study';
    if (durationSec < 10) return;
    const session = {
        subject: subject.slice(0, 60),
        duration: durationSec,
        mode: timerMode,
        phase: pomodoroPhase,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toDateString()
    };
    timerHistory.unshift(session);
    if (timerHistory.length > 50) timerHistory = timerHistory.slice(0, 50);
    localStorage.setItem('timerHistory', JSON.stringify(timerHistory));
    renderTimerHistory();
    updateStatsRow();
}

function renderTimerHistory() {
    const container = document.getElementById('timerHistoryList');
    const totalEl = document.getElementById('timerTodayTotal');
    const today = new Date().toDateString();
    const todaySessions = timerHistory.filter(s => s.date === today);
    if (todaySessions.length === 0) {
        container.innerHTML = '<p class="empty-text">No sessions yet today. Start a timer!</p>';
        if (totalEl) totalEl.textContent = '';
        renderSubjectBreakdown([]);
        return;
    }
    let html = '';
    todaySessions.forEach(s => {
        const modeLabel = s.mode === 'pomodoro' ? '🍅' : s.mode === 'countdown' ? '⏳' : '⏱️';
        html += `<div class="timer-history-item">
            <span class="th-subject">${modeLabel} ${escapeHtml(s.subject)}</span>
            <span class="th-duration">${formatDuration(s.duration)}</span>
            <span class="th-time">${s.time}</span>
        </div>`;
    });
    container.innerHTML = html;
    const totalSec = todaySessions.reduce((sum, s) => sum + s.duration, 0);
    if (totalEl) totalEl.textContent = `Total today: ${formatDuration(totalSec)} of focused study`;
    renderSubjectBreakdown(todaySessions);
}

function clearTimerHistory() {
    if (!confirm('Clear all timer history?')) return;
    timerHistory = [];
    localStorage.removeItem('timerHistory');
    renderTimerHistory();
    updateStatsRow();
}

function renderSubjectBreakdown(sessions) {
    const list = document.getElementById('tsbList');
    if (!list) return;
    if (!sessions.length) {
        list.innerHTML = '<p class="empty-text" style="font-size:.78rem">No sessions yet</p>';
        return;
    }
    const map = {};
    sessions.forEach(s => { map[s.subject] = (map[s.subject] || 0) + s.duration; });
    const total = Object.values(map).reduce((a, b) => a + b, 0);
    const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];
    let html = '';
    Object.entries(map).sort((a, b) => b[1] - a[1]).forEach(([subj, sec], i) => {
        const pct = total > 0 ? Math.round(sec / total * 100) : 0;
        html += `<div class="tsb-item">
            <div class="tsb-subj-row">
                <span class="tsb-dot" style="background:${colors[i % colors.length]}"></span>
                <span class="tsb-subj">${escapeHtml(subj)}</span>
                <span class="tsb-pct">${pct}%</span>
            </div>
            <div class="tsb-bar-wrap"><div class="tsb-bar" style="width:${pct}%;background:${colors[i % colors.length]}"></div></div>
        </div>`;
    });
    list.innerHTML = html;
}

function updateStatsRow() {
    const today = new Date().toDateString();
    const todaySessions = timerHistory.filter(s => s.date === today && s.mode !== 'stopwatch');
    const totalSec = todaySessions.reduce((sum, s) => sum + s.duration, 0);
    const goalSec = timerDailyGoalMin * 60;
    const pct = goalSec > 0 ? Math.min(100, Math.round(totalSec / goalSec * 100)) : 0;
    const statSes = document.getElementById('statTodaySessions');
    const statTime = document.getElementById('statTodayTime');
    const statGoal = document.getElementById('statGoalPct');
    if (statSes) statSes.textContent = todaySessions.length;
    const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60);
    if (statTime) statTime.textContent = h > 0 ? `${h}h ${m}m` : `${m}m`;
    if (statGoal) statGoal.textContent = `${pct}%`;
    const bar = document.getElementById('goalProgressBar');
    if (bar) bar.style.width = `${pct}%`;
    const label = document.getElementById('goalProgressLabel');
    const remaining = Math.max(0, goalSec - totalSec);
    if (label) label.textContent = `${pct}% complete — ${formatDuration(remaining)} remaining`;
    const streak = document.getElementById('statStreak');
    if (streak) streak.textContent = calcStreak();
}

function calcStreak() {
    const days = new Set(timerHistory.filter(s => s.duration >= 60).map(s => s.date));
    let streak = 0;
    const d = new Date();
    while (days.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }
    return streak;
}

function updateGoalDisplay() {
    const h = Math.floor(timerDailyGoalMin / 60), m = timerDailyGoalMin % 60;
    const el = document.getElementById('goalDisplay');
    if (el) el.textContent = h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function openGoalModal() {
    const gi = document.getElementById('goalInput');
    if (gi) gi.value = timerDailyGoalMin;
    const mo = document.getElementById('goalModalOverlay');
    if (mo) mo.style.display = 'flex';
}

function closeGoalModal(e) {
    if (e && e.target !== document.getElementById('goalModalOverlay')) return;
    const mo = document.getElementById('goalModalOverlay');
    if (mo) mo.style.display = 'none';
}

function saveGoal() {
    const val = parseInt(document.getElementById('goalInput').value);
    if (!isNaN(val) && val >= 10) {
        timerDailyGoalMin = val;
        localStorage.setItem('timerDailyGoal', val);
        updateGoalDisplay();
        updateStatsRow();
    }
    const mo = document.getElementById('goalModalOverlay');
    if (mo) mo.style.display = 'none';
}

function setSubject(name) {
    const el = document.getElementById('timerSubject');
    if (el) el.value = name;
}

function showBreakTip() {
    const tip = BREAK_TIPS[Math.floor(Math.random() * BREAK_TIPS.length)];
    const el = document.getElementById('timerBreakTip');
    const txt = document.getElementById('timerBreakTipText');
    if (txt) txt.textContent = tip;
    if (el) el.style.display = 'flex';
}

function hideBreakTip() {
    const el = document.getElementById('timerBreakTip');
    if (el) el.style.display = 'none';
}

function toggleSoundNotif() {
    soundEnabled = !soundEnabled;
    const icon = document.getElementById('soundIcon');
    if (icon) icon.className = soundEnabled ? 'fas fa-bell' : 'fas fa-bell-slash';
}

function playCompletionSound() {
    if (!soundEnabled) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [[880,0],[1100,200],[880,400],[1320,600]].forEach(([freq, delay]) => {
            const osc = ctx.createOscillator(), gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.25, ctx.currentTime + delay/1000);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay/1000 + 0.3);
            osc.start(ctx.currentTime + delay/1000);
            osc.stop(ctx.currentTime + delay/1000 + 0.35);
        });
        setTimeout(() => ctx.close(), 1200);
    } catch(e) {}
}

function toggleFocusMode() {
    focusModeActive = !focusModeActive;
    const overlay = document.getElementById('focusModeOverlay');
    if (overlay) overlay.style.display = focusModeActive ? 'flex' : 'none';
    updateFocusModeDisplay();
    if (!focusModeActive) stopAmbient();
}

function updateFocusModeDisplay() {
    if (!focusModeActive) return;
    const subj = (document.getElementById('timerSubject').value.trim() || 'Focus Session');
    const fmSubj = document.getElementById('fmSubject');
    const fmDisp = document.getElementById('fmDisplay');
    if (fmSubj) fmSubj.textContent = subj;
    if (fmDisp) fmDisp.textContent = formatTime(timerSeconds);
}

function toggleAmbient(type) {
    if (ambientType === type) { stopAmbient(); return; }
    stopAmbient();
    ambientType = type;
    document.querySelectorAll('.fm-amb-btn').forEach(b => b.classList.remove('active'));
    const id = 'amb' + type.charAt(0).toUpperCase() + type.slice(1);
    const btn = document.getElementById(id);
    if (btn) btn.classList.add('active');
    try {
        ambientCtx = new (window.AudioContext || window.webkitAudioContext)();
        const rate = ambientCtx.sampleRate;
        const bufLen = rate * 2;
        const buf = ambientCtx.createBuffer(1, bufLen, rate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
        const src = ambientCtx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const gain = ambientCtx.createGain();
        if (type === 'white') {
            gain.gain.value = 0.05;
        } else if (type === 'rain') {
            const filter = ambientCtx.createBiquadFilter();
            filter.type = 'lowpass'; filter.frequency.value = 400;
            src.connect(filter); filter.connect(gain);
            gain.gain.value = 0.12;
            gain.connect(ambientCtx.destination);
            src.start();
            ambientNode = src;
            return;
        } else {
            gain.gain.value = 0.06;
        }
        src.connect(gain); gain.connect(ambientCtx.destination);
        src.start();
        ambientNode = src;
    } catch(e) {}
}

function stopAmbient() {
    if (ambientNode) { try { ambientNode.stop(); } catch(e) {} ambientNode = null; }
    if (ambientCtx) { try { ambientCtx.close(); } catch(e) {} ambientCtx = null; }
    ambientType = null;
    document.querySelectorAll('.fm-amb-btn').forEach(b => b.classList.remove('active'));
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}


/*
    if (timerRunning) return; // don't switch while running

    timerMode = mode;

    pomodoroPhase = 'focus';

    pomodoroCount = 0;

    timerPaused = false;

    document.querySelectorAll('.timer-tab').forEach(t => t.classList.remove('active'));

    document.querySelector(`.timer-tab[data-mode="${mode}"]`).classList.add('active');

    showTimerSettingsForMode();

    resetTimerState();

    updateTimerDisplay();

    updatePomodoroDotsUI();

    updateTimerButtons('idle');

    updateTimerStatus('Ready to focus');

}



function showTimerSettingsForMode() {

    const sf = document.getElementById('settingFocus');

    const ssb = document.getElementById('settingShortBreak');

    const slb = document.getElementById('settingLongBreak');

    const sc = document.getElementById('settingCountdown');

    const dots = document.getElementById('pomodoroDots');



    sf.style.display = 'none';

    ssb.style.display = 'none';

    slb.style.display = 'none';

    sc.style.display = 'none';

    dots.style.display = 'none';



    if (timerMode === 'pomodoro') {

        sf.style.display = '';

        ssb.style.display = '';

        slb.style.display = '';

        dots.style.display = 'flex';

    } else if (timerMode === 'countdown') {

        sc.style.display = '';

    }

    // stopwatch: no settings needed

}



function adjustSetting(key, delta) {

    if (timerRunning) return;

    timerSettings[key] = Math.max(1, timerSettings[key] + delta);

    updateTimerSettingsUI();

    resetTimerState();

    updateTimerDisplay();

}



function updateTimerSettingsUI() {

    document.getElementById('settingFocusVal').textContent = timerSettings.focus;

    document.getElementById('settingShortBreakVal').textContent = timerSettings.shortBreak;

    document.getElementById('settingLongBreakVal').textContent = timerSettings.longBreak;

    document.getElementById('settingCountdownVal').textContent = timerSettings.countdown;

}



/* duplicate resetTimerState removed — original at line 2771
function resetTimerState() {

    clearInterval(timerInterval);

    timerInterval = null;

    timerRunning = false;

    timerPaused = false;



    if (timerMode === 'pomodoro') {

        timerTotalSeconds = timerSettings.focus * 60;

        timerSeconds = timerTotalSeconds;

    } else if (timerMode === 'countdown') {

        timerTotalSeconds = timerSettings.countdown * 60;

        timerSeconds = timerTotalSeconds;

    } else {

        timerSeconds = 0;

        timerTotalSeconds = 0;

    }

}
*/

/*  ===== DUPLICATE BLOCK REMOVED (was overwriting working timer functions) =====

function formatDuration(sec) {

    const h = Math.floor(sec / 3600);

    const m = Math.floor((sec % 3600) / 60);

    const s = sec % 60;

    if (h > 0) return `${h}h ${m}m ${String(s).padStart(2,'0')}s`;

    if (m > 0) return `${m}m ${String(s).padStart(2,'0')}s`;

    return `${s}s`;

}



function updateTimerDisplay() {

    const display = document.getElementById('timerDisplay');

    const ring = document.getElementById('timerRingProgress');



    if (timerMode === 'stopwatch') {

        display.textContent = formatTime(timerSeconds);

        // For stopwatch, fill ring based on minutes elapsed (1 full loop = 60 min)

        const progress = (timerSeconds % 3600) / 3600;

        ring.style.strokeDasharray = RING_CIRCUMFERENCE;

        ring.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);

        ring.classList.remove('break');

        ring.classList.add('stopwatch');

    } else {

        display.textContent = formatTime(timerSeconds);

        const progress = timerTotalSeconds > 0 ? (timerTotalSeconds - timerSeconds) / timerTotalSeconds : 0;

        ring.style.strokeDasharray = RING_CIRCUMFERENCE;

        ring.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);

        ring.classList.remove('stopwatch');

        if (pomodoroPhase !== 'focus' && timerMode === 'pomodoro') {

            ring.classList.add('break');

        } else {

            ring.classList.remove('break');

        }

    }

}



function updateTimerStatus(text) {

    document.getElementById('timerStatus').textContent = text;

}



function updateTimerButtons(state) {

    const startBtn = document.getElementById('timerStartBtn');

    const pauseBtn = document.getElementById('timerPauseBtn');

    const resumeBtn = document.getElementById('timerResumeBtn');



    startBtn.style.display = state === 'idle' ? '' : 'none';

    pauseBtn.style.display = state === 'running' ? '' : 'none';

    resumeBtn.style.display = state === 'paused' ? '' : 'none';

}



function updatePomodoroDotsUI() {

    for (let i = 1; i <= 4; i++) {

        const dot = document.getElementById('pomDot' + i);

        dot.classList.remove('done', 'active');

        if (i <= pomodoroCount) {

            dot.classList.add('done');

        } else if (i === pomodoroCount + 1 && timerRunning && pomodoroPhase === 'focus') {

            dot.classList.add('active');

        }

    }

}



function startTimer() {

    if (timerRunning) return;

    timerRunning = true;

    timerPaused = false;

    timerSessionStart = new Date();



    if (timerMode === 'pomodoro') {

        if (pomodoroPhase === 'focus') {

            timerTotalSeconds = timerSettings.focus * 60;

        } else if (pomodoroPhase === 'shortBreak') {

            timerTotalSeconds = timerSettings.shortBreak * 60;

        } else {

            timerTotalSeconds = timerSettings.longBreak * 60;

        }

        timerSeconds = timerTotalSeconds;

        updateTimerStatus(pomodoroPhase === 'focus' ? 'Focusing...' : 'Break time!');

    } else if (timerMode === 'countdown') {

        timerTotalSeconds = timerSettings.countdown * 60;

        timerSeconds = timerTotalSeconds;

        updateTimerStatus('Counting down...');

    } else {

        timerSeconds = 0;

        updateTimerStatus('Stopwatch running...');

    }



    updateTimerButtons('running');

    updatePomodoroDotsUI();



    timerInterval = setInterval(() => {

        if (timerMode === 'stopwatch') {

            timerSeconds++;

        } else {

            timerSeconds--;

            if (timerSeconds <= 0) {

                timerSeconds = 0;

                onTimerComplete();

                return;

            }

        }

        updateTimerDisplay();

    }, 1000);

    updateTimerDisplay();

}



function pauseTimer() {

    if (!timerRunning || timerPaused) return;

    timerPaused = true;

    clearInterval(timerInterval);

    updateTimerButtons('paused');

    updateTimerStatus('Paused');

}



function resumeTimer() {

    if (!timerPaused) return;

    timerPaused = false;

    updateTimerButtons('running');

    const statusText = timerMode === 'stopwatch' ? 'Stopwatch running...' :

                       timerMode === 'pomodoro' ? (pomodoroPhase === 'focus' ? 'Focusing...' : 'Break time!') :

                       'Counting down...';

    updateTimerStatus(statusText);



    timerInterval = setInterval(() => {

        if (timerMode === 'stopwatch') {

            timerSeconds++;

        } else {

            timerSeconds--;

            if (timerSeconds <= 0) {

                timerSeconds = 0;

                onTimerComplete();

                return;

            }

        }

        updateTimerDisplay();

    }, 1000);

}



function resetTimer() {

    const elapsed = timerSessionStart ? Math.round((new Date() - timerSessionStart) / 1000) : 0;

    if (timerRunning && elapsed > 30) {

        // Save partial session if user studied more than 30 seconds

        saveTimerSession(elapsed);

    }

    clearInterval(timerInterval);

    timerInterval = null;

    timerRunning = false;

    timerPaused = false;

    timerSessionStart = null;



    if (timerMode === 'pomodoro') {

        pomodoroPhase = 'focus';

        pomodoroCount = 0;

    }

    resetTimerState();

    updateTimerDisplay();

    updateTimerButtons('idle');

    updateTimerStatus('Ready to focus');

    updatePomodoroDotsUI();

}



function onTimerComplete() {

    clearInterval(timerInterval);

    timerInterval = null;

    timerRunning = false;



    // Play notification sound

    try {

        const ctx = new (window.AudioContext || window.webkitAudioContext)();

        const osc = ctx.createOscillator();

        const gain = ctx.createGain();

        osc.connect(gain);

        gain.connect(ctx.destination);

        osc.frequency.value = 800;

        gain.gain.value = 0.3;

        osc.start();

        setTimeout(() => { osc.frequency.value = 1000; }, 200);

        setTimeout(() => { osc.frequency.value = 800; }, 400);

        setTimeout(() => { osc.stop(); ctx.close(); }, 600);

    } catch(e) {}



    const elapsed = timerSessionStart ? Math.round((new Date() - timerSessionStart) / 1000) : timerTotalSeconds;



    if (timerMode === 'pomodoro') {

        if (pomodoroPhase === 'focus') {

            pomodoroCount++;

            saveTimerSession(elapsed);

            updatePomodoroDotsUI();



            if (pomodoroCount >= 4) {

                pomodoroPhase = 'longBreak';

                pomodoroCount = 0;

                updateTimerStatus('Great work! Take a long break.');

                showAlert('4 pomodoros done! Time for a long break 🎉', 'success');

            } else {

                pomodoroPhase = 'shortBreak';

                updateTimerStatus(`Pomodoro #${pomodoroCount} done! Short break.`);

                showAlert(`Pomodoro #${pomodoroCount} complete! Short break time ☕`, 'info');

            }

        } else {

            // break finished

            pomodoroPhase = 'focus';

            updateTimerStatus('Break over — time to focus!');

            showAlert('Break is over! Ready to focus again 💪', 'info');

        }

        timerSessionStart = null;

        resetTimerState();

        updateTimerDisplay();

        updateTimerButtons('idle');

    } else if (timerMode === 'countdown') {

        saveTimerSession(elapsed);

        timerSessionStart = null;

        updateTimerDisplay();

        updateTimerButtons('idle');

        updateTimerStatus('Time\'s up!');

        showAlert('Countdown complete! Great study session ✅', 'success');

    }

}



function saveTimerSession(durationSec) {

    const subject = document.getElementById('timerSubject').value.trim() || 'General Study';

    if (durationSec < 10) return;



    const session = {

        subject,

        duration: durationSec,

        mode: timerMode,

        phase: pomodoroPhase,

        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),

        date: new Date().toDateString()

    };



    timerHistory.unshift(session);

    // Keep only last 50 entries

    if (timerHistory.length > 50) timerHistory = timerHistory.slice(0, 50);

    localStorage.setItem('timerHistory', JSON.stringify(timerHistory));

    renderTimerHistory();

}



function renderTimerHistory() {

    const container = document.getElementById('timerHistoryList');

    const totalEl = document.getElementById('timerTodayTotal');

    const today = new Date().toDateString();

    const todaySessions = timerHistory.filter(s => s.date === today);



    if (todaySessions.length === 0) {

        container.innerHTML = '<p class="empty-text">No sessions yet today. Start a timer!</p>';

        totalEl.textContent = '';

        return;

    }



    let html = '';

    todaySessions.forEach(s => {

        const modeLabel = s.mode === 'pomodoro' ? '🍅' : s.mode === 'countdown' ? '⏳' : '⏱️';

        html += `<div class="timer-history-item">

            <span class="th-subject">${modeLabel} ${s.subject}</span>

            <span class="th-duration">${formatDuration(s.duration)}</span>

            <span class="th-time">${s.time}</span>

        </div>`;

    });

    container.innerHTML = html;



    const totalSec = todaySessions.reduce((sum, s) => sum + s.duration, 0);

    totalEl.textContent = `Total today: ${formatDuration(totalSec)} of focused study`;

}
*/


// ==================== MY ROUTINE (Personalized Timetable) ====================

let routinePrefs = JSON.parse(localStorage.getItem('routinePrefs') || 'null') || {

    maxHours: 4,

    sessionLen: 45,

    breakLen: 15,

    daysOff: 1

};

let busySlots = JSON.parse(localStorage.getItem('busySlots') || 'null') || [

    { label: 'Work / School', startH: 9, startM: 0, endH: 17, endM: 0, days: [1,2,3,4,5] }

];



const STUDY_WINDOWS = [

    { id: 'early-morning', label: 'Early Morning', start: 5, end: 8, icon: 'fa-cloud-sun', accent: '#f97316' },

    { id: 'morning', label: 'Morning', start: 8, end: 12, icon: 'fa-sun', accent: '#eab308' },

    { id: 'afternoon', label: 'Afternoon', start: 12, end: 16, icon: 'fa-cloud', accent: '#3b82f6' },

    { id: 'evening', label: 'Evening', start: 16, end: 20, icon: 'fa-moon', accent: '#7c3aed' },

    { id: 'night', label: 'Night', start: 20, end: 23, icon: 'fa-star', accent: '#6366f1' }

];



function initRoutinePage() {

    renderBusySlots();

    updateRoutinePrefsUI();

    // Restore checkboxes

    const saved = JSON.parse(localStorage.getItem('routineStudyPrefs') || '["morning","evening"]');

    document.querySelectorAll('.rt-pref-option input[type=checkbox]').forEach(cb => {

        cb.checked = saved.includes(cb.value);

    });

    // Restore previously generated timetable

    const savedTT = localStorage.getItem('routineTimetable');

    if (savedTT) document.getElementById('rtTimetableOutput').innerHTML = savedTT;

}



function renderBusySlots() {

    const container = document.getElementById('rtBusySlots');

    if (busySlots.length === 0) {

        container.innerHTML = '<p class="empty-text" style="margin:.5rem 0">No busy blocks added. Click "Add Time Block" to define your schedule.</p>';

        return;

    }

    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    let html = '';

    busySlots.forEach((slot, idx) => {

        const daysStr = slot.days.map(d => dayNames[d]).join(', ');

        const startStr = formatTimeAMPM(slot.startH, slot.startM);

        const endStr = formatTimeAMPM(slot.endH, slot.endM);

        html += `<div class="rt-busy-slot">

            <div class="rt-bs-color"></div>

            <div class="rt-bs-info">

                <input type="text" class="rt-bs-label" value="${slot.label}" onchange="updateBusySlotLabel(${idx}, this.value)" placeholder="Work, School, etc.">

                <div class="rt-bs-time">

                    <input type="time" value="${pad2(slot.startH)}:${pad2(slot.startM)}" onchange="updateBusySlotTime(${idx}, 'start', this.value)">

                    <span>to</span>

                    <input type="time" value="${pad2(slot.endH)}:${pad2(slot.endM)}" onchange="updateBusySlotTime(${idx}, 'end', this.value)">

                </div>

                <div class="rt-bs-days">

                    ${[0,1,2,3,4,5,6].map(d => `<button class="rt-day-btn${slot.days.includes(d) ? ' active' : ''}" onclick="toggleBusyDay(${idx},${d})">${dayNames[d][0]}</button>`).join('')}

                </div>

            </div>

            <button class="rt-bs-del" onclick="removeBusySlot(${idx})"><i class="fas fa-trash-alt"></i></button>

        </div>`;

    });

    container.innerHTML = html;

}



function pad2(n) { return String(n).padStart(2, '0'); }

function formatTimeAMPM(h, m) {

    const ampm = h >= 12 ? 'PM' : 'AM';

    const h12 = h % 12 || 12;

    return `${h12}:${pad2(m)} ${ampm}`;

}



function addBusySlot() {

    busySlots.push({ label: 'New Block', startH: 9, startM: 0, endH: 17, endM: 0, days: [1,2,3,4,5] });

    saveBusySlots();

    renderBusySlots();

}



function removeBusySlot(idx) {

    busySlots.splice(idx, 1);

    saveBusySlots();

    renderBusySlots();

}



function updateBusySlotLabel(idx, val) {

    busySlots[idx].label = val;

    saveBusySlots();

}



function updateBusySlotTime(idx, which, val) {

    const [h, m] = val.split(':').map(Number);

    if (which === 'start') { busySlots[idx].startH = h; busySlots[idx].startM = m; }

    else { busySlots[idx].endH = h; busySlots[idx].endM = m; }

    saveBusySlots();

}



function toggleBusyDay(idx, day) {

    const arr = busySlots[idx].days;

    const i = arr.indexOf(day);

    if (i >= 0) arr.splice(i, 1); else arr.push(day);

    saveBusySlots();

    renderBusySlots();

}



function saveBusySlots() {

    localStorage.setItem('busySlots', JSON.stringify(busySlots));

}



function adjustRoutinePref(key, delta) {

    const limits = { maxHours: [1, 12], sessionLen: [15, 120], breakLen: [5, 60], daysOff: [0, 4] };

    routinePrefs[key] = Math.max(limits[key][0], Math.min(limits[key][1], routinePrefs[key] + delta));

    localStorage.setItem('routinePrefs', JSON.stringify(routinePrefs));

    updateRoutinePrefsUI();

}



function updateRoutinePrefsUI() {

    document.getElementById('rtMaxHours').textContent = routinePrefs.maxHours;

    document.getElementById('rtSessionLen').textContent = routinePrefs.sessionLen;

    document.getElementById('rtBreakLen').textContent = routinePrefs.breakLen;

    document.getElementById('rtDaysOff').textContent = routinePrefs.daysOff;

}



function generateRoutineTimetable() {

    // Gather preferences

    const selectedPrefs = [];

    document.querySelectorAll('.rt-pref-option input:checked').forEach(cb => selectedPrefs.push(cb.value));

    localStorage.setItem('routineStudyPrefs', JSON.stringify(selectedPrefs));



    if (selectedPrefs.length === 0) {

        showAlert('Please select at least one preferred study time.', 'danger');

        return;

    }



    // Get subjects from cached data

    const allSubjects = (cachedProgress && cachedProgress.subjects) ? cachedProgress.subjects : [];

    const weakSched = (cachedRecommendations && cachedRecommendations.study_schedule) ? cachedRecommendations.study_schedule : [];



    // Build subject list with priorities

    const subjects = [];

    weakSched.forEach(ws => {

        subjects.push({ name: ws.subject, priority: ws.priority === 'High' ? 3 : 2, hoursNeeded: ws.recommended_hours_per_week, type: 'weak', score: ws.current_average });

    });

    allSubjects.filter(s => s.average_score >= 70).forEach(ss => {

        subjects.push({ name: ss.subject, priority: 1, hoursNeeded: 2, type: 'strong', score: ss.average_score });

    });



    if (subjects.length === 0) {

        document.getElementById('rtTimetableOutput').innerHTML = '<div class="empty-state-box"><i class="fas fa-book-open"></i><p>No subjects found. Add some study sessions first, then come back to generate your timetable.</p></div>';

        return;

    }



    // Available study windows (filtered by user preference and not overlapping busy)

    const availableWindows = STUDY_WINDOWS.filter(w => selectedPrefs.includes(w.id));



    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

    const dayShort = ['SUN','MON','TUE','WED','THU','FRI','SAT'];



    // Determine off days (default: last N days of the week)

    const offDays = [];

    for (let i = 0; i < routinePrefs.daysOff; i++) offDays.push(i); // Sunday=0 first



    // Build timetable for each day

    const timetable = [];

    for (let d = 0; d < 7; d++) {

        if (offDays.includes(d)) {

            timetable.push({ day: d, isOff: true, slots: [] });

            continue;

        }



        // Find free windows: preferred windows minus busy overlap

        const dayBusy = busySlots.filter(bs => bs.days.includes(d));

        const freeSlots = [];



        availableWindows.forEach(win => {

            let winStart = win.start;

            let winEnd = win.end;

            let blocked = false;



            dayBusy.forEach(bs => {

                const bStart = bs.startH + bs.startM / 60;

                const bEnd = bs.endH + bs.endM / 60;

                // If busy completely covers window

                if (bStart <= winStart && bEnd >= winEnd) blocked = true;

                // If busy partially overlaps, shrink window

                else if (bStart > winStart && bStart < winEnd) winEnd = bStart;

                else if (bEnd > winStart && bEnd < winEnd) winStart = bEnd;

            });



            if (!blocked && winEnd - winStart >= 0.5) {

                freeSlots.push({ ...win, availStart: winStart, availEnd: winEnd, availHours: winEnd - winStart });

            }

        });



        // Assign subjects to free slots, respecting maxHours

        const daySlots = [];

        let hoursUsed = 0;

        const sessionH = routinePrefs.sessionLen / 60;

        const breakH = routinePrefs.breakLen / 60;



        // Sort subjects: highest priority first

        const sortedSubjects = [...subjects].sort((a, b) => b.priority - a.priority);



        freeSlots.forEach(slot => {

            let slotTime = slot.availStart;

            const slotEnd = slot.availEnd;



            sortedSubjects.forEach(subj => {

                if (hoursUsed >= routinePrefs.maxHours) return;

                if (slotTime + sessionH > slotEnd) return;



                // Check if this subject already has enough slots this week (rough heuristic)

                const existingInDay = daySlots.filter(ds => ds.subject === subj.name).length;

                if (existingInDay >= 1) return;



                daySlots.push({

                    subject: subj.name,

                    type: subj.type,

                    priority: subj.priority,

                    score: subj.score,

                    startTime: slotTime,

                    endTime: Math.min(slotTime + sessionH, slotEnd),

                    window: slot

                });

                slotTime += sessionH + breakH;

                hoursUsed += sessionH;

            });

        });



        timetable.push({ day: d, isOff: false, slots: daySlots });

    }



    // Render timetable

    const output = document.getElementById('rtTimetableOutput');

    const todayD = new Date().getDay();



    let html = `<div class="rt-result-header">

        <div class="rt-result-icon"><i class="fas fa-calendar-check"></i></div>

        <div>

            <h5>Your Personalized Timetable</h5>

            <p>Based on your routine, here's when you should study each day.</p>

        </div>

    </div>`;



    // Week overview mini cards

    html += '<div class="rt-week-overview">';

    timetable.forEach(td => {

        const isToday = td.day === todayD;

        const totalH = td.slots.reduce((s, sl) => s + (sl.endTime - sl.startTime), 0);

        html += `<div class="rt-wo-card${isToday ? ' today' : ''}${td.isOff ? ' off' : ''}">

            <span class="rt-wo-day">${dayShort[td.day]}</span>

            <span class="rt-wo-hrs">${td.isOff ? '—' : totalH.toFixed(1) + 'h'}</span>

            ${td.isOff ? '<span class="rt-wo-off">OFF</span>' : '<span class="rt-wo-count">' + td.slots.length + ' sessions</span>'}

            ${isToday ? '<span class="rt-wo-today-dot"></span>' : ''}

        </div>`;

    });

    html += '</div>';



    // Detailed day cards

    html += '<div class="rt-day-cards">';

    timetable.forEach(td => {

        const isToday = td.day === todayD;

        html += `<div class="rt-day-card${isToday ? ' highlight' : ''}">`;

        html += `<div class="rt-dc-header">

            <h6>${isToday ? '📍 ' : ''}${dayNames[td.day]}</h6>

            <div class="rt-dc-header-right">

                ${td.isOff ? '' : `<span class="rt-dc-summary">${td.slots.length} session${td.slots.length !== 1 ? 's' : ''} · ${td.slots.reduce((a, s) => a + Math.round((s.endTime - s.startTime) * 60), 0)} min</span>`}

                ${isToday ? '<span class="rt-today-tag">Today</span>' : ''}

            </div>

        </div>`;



        if (td.isOff) {

            html += `<div class="rt-dc-off"><i class="fas fa-couch"></i><span>Day Off — Rest, recharge, and light review only</span></div>`;

        } else if (td.slots.length === 0) {

            html += `<div class="rt-dc-off"><i class="fas fa-exclamation-circle"></i><span>No free study windows found for this day. Try adjusting your busy hours or preferred times.</span></div>`;

        } else {

            html += '<div class="rt-dc-slots">';

            td.slots.forEach((sl, si) => {

                const startH = Math.floor(sl.startTime);

                const startM = Math.round((sl.startTime % 1) * 60);

                const endH = Math.floor(sl.endTime);

                const endM = Math.round((sl.endTime % 1) * 60);

                const startStr = formatTimeAMPM(startH, startM);

                const endStr = formatTimeAMPM(endH, endM);

                const dur = Math.round((sl.endTime - sl.startTime) * 60);

                const typeColor = sl.type === 'weak' ? (sl.priority >= 3 ? '#ef4444' : '#f59e0b') : '#22c55e';

                const typeLabel = sl.type === 'weak' ? (sl.priority >= 3 ? 'Focus' : 'Improve') : 'Review';

                const typeBg = sl.type === 'weak' ? (sl.priority >= 3 ? '#fee2e2' : '#fef3c7') : '#dcfce7';

                const borderLeft = `border-left-color: ${typeColor}`;



                html += `<div class="rt-slot-item">

                    <div class="rt-slot-time">

                        <i class="fas ${sl.window.icon}" style="color:${sl.window.accent};border-color:${sl.window.accent}"></i>

                        <strong>${startStr}</strong>

                        <small>${endStr}</small>

                    </div>

                    <div class="rt-slot-info" style="${borderLeft}">

                        <div class="rt-slot-subj">${sl.subject}</div>

                        <div class="rt-slot-meta">

                            <span class="rt-slot-dur"><i class="fas fa-clock"></i> ${dur} min</span>

                            <span class="rt-slot-badge" style="background:${typeBg};color:${typeColor}">${typeLabel} · ${sl.score}%</span>

                            <span class="rt-slot-dur"><i class="fas fa-${sl.window.icon}"></i> ${sl.window.label}</span>

                        </div>

                    </div>

                    <div class="rt-slot-dot" style="background:${typeColor}"></div>

                </div>`;

            });

            html += '</div>';

        }

        html += '</div>';

    });

    html += '</div>';



    // Suggestion Tips

    html += `<div class="rt-tips-card">

        <h6><i class="fas fa-lightbulb me-2"></i>Optimization Tips</h6>

        <ul>

            <li>🧠 Study your hardest subjects during your peak energy window (usually morning)</li>

            <li>⏰ ${routinePrefs.sessionLen} min focus + ${routinePrefs.breakLen} min break is your optimal rhythm</li>

            <li>📊 You have ${subjects.filter(s=>s.type==='weak').length} weak subject(s) — they get priority in your schedule</li>

            <li>🔄 Come back and regenerate when your work schedule or free time changes</li>

            <li>✅ After each study session, log it in Sessions to track your improvement</li>

        </ul>

    </div>`;



    output.innerHTML = html;

    localStorage.setItem('routineTimetable', html);

    showAlert('Timetable generated! 🎉', 'success');



    // Animate

    document.querySelectorAll('.rt-slot-item, .rt-wo-card').forEach((el, i) => {

        el.style.opacity = '0';

        el.style.transform = 'translateY(10px)';

        setTimeout(() => {

            el.style.transition = 'all .3s ease';

            el.style.opacity = '1';

            el.style.transform = 'translateY(0)';

        }, 50 * i);

    });

}



// ==================== MY JOURNAL ====================

let selectedJournalMood = null;



const MOOD_DATA = {

    happy:     { emoji: '😊', color: '#22c55e', bg: '#dcfce7', label: 'Happy',     score: 5 },

    confident: { emoji: '💪', color: '#6366f1', bg: '#e0e7ff', label: 'Confident', score: 5 },

    calm:      { emoji: '😌', color: '#06b6d4', bg: '#cffafe', label: 'Calm',      score: 4 },

    motivated: { emoji: '🔥', color: '#f97316', bg: '#ffedd5', label: 'Motivated', score: 5 },

    tired:     { emoji: '😴', color: '#8b5cf6', bg: '#ede9fe', label: 'Tired',     score: 2 },

    stressed:  { emoji: '😰', color: '#ef4444', bg: '#fee2e2', label: 'Stressed',  score: 1 },

    sad:       { emoji: '😢', color: '#3b82f6', bg: '#dbeafe', label: 'Sad',       score: 1 },

    anxious:   { emoji: '😟', color: '#eab308', bg: '#fef9c3', label: 'Anxious',   score: 2 }

};



const MOOD_TIPS = {

    happy: [

        "Ride this wave! Tackle a challenging topic while you're feeling great.",

        "Share your positive energy — help a classmate who's struggling.",

        "Write down 3 things that made today great so you can revisit them.",

        "Use this momentum to plan tomorrow's goals."

    ],

    confident: [

        "Perfect time to attempt practice tests or past exam papers!",

        "Challenge yourself with harder problems today.",

        "Teach someone else a concept — it solidifies your understanding.",

        "Set a stretch goal for the week while confidence is high."

    ],

    calm: [

        "Great state for deep reading and absorbing new concepts.",

        "Try meditation or mindful study — you'll retain more.",

        "Review notes calmly and organize them for future use.",

        "This is a perfect time for creative problem-solving."

    ],

    motivated: [

        "Channel this energy into your most important subject!",

        "Set a clear 2-hour deep work session right now.",

        "Write down your goals — motivation fades, but written plans persist.",

        "Start that project or assignment you've been putting off."

    ],

    tired: [

        "It's okay to rest. A 20-min power nap can boost memory consolidation.",

        "Do light review instead of heavy studying — flashcards work great.",

        "Stay hydrated and take a short walk outside.",

        "Go to bed early tonight — sleep is when your brain processes learning."

    ],

    stressed: [

        "Take 5 slow deep breaths — in for 4, hold for 4, out for 6.",

        "Break your tasks into small, manageable pieces. One step at a time.",

        "Write down what's stressing you — it helps to get it out of your head.",

        "Remember: progress, not perfection. You're doing better than you think."

    ],

    sad: [

        "It's okay to feel this way. Be gentle with yourself today.",

        "Talk to someone you trust — connection helps.",

        "Do something small that brings you joy before studying.",

        "Tomorrow is a fresh start. One bad day doesn't define your journey."

    ],

    anxious: [

        "Ground yourself: name 5 things you can see, 4 you can touch, 3 you can hear.",

        "Break your study plan into 15-min chunks — small wins reduce anxiety.",

        "Write down your worries, then set them aside for 30 minutes.",

        "Remember: you've overcome challenges before, and you will again."

    ]

};



function getJournalEntries() {

    return JSON.parse(localStorage.getItem('journalEntries') || '[]');

}

function saveJournalEntries(entries) {

    localStorage.setItem('journalEntries', JSON.stringify(entries));

}



function initJournalPage() {

    selectedJournalMood = null;

    document.querySelectorAll('.jnl-mood-btn').forEach(b => b.classList.remove('active'));

    document.getElementById('jnlMoodTip').style.display = 'none';

    document.getElementById('jnlText').value = '';

    document.querySelectorAll('.jnl-tag').forEach(t => t.classList.remove('active'));

    renderJournalEntries();

    renderMoodTrend();

}



function selectJournalMood(mood) {

    selectedJournalMood = mood;

    document.querySelectorAll('.jnl-mood-btn').forEach(b => {

        b.classList.toggle('active', b.dataset.mood === mood);

    });

    // Show tip

    const tips = MOOD_TIPS[mood];

    const tip = tips[Math.floor(Math.random() * tips.length)];

    const md = MOOD_DATA[mood];

    const tipEl = document.getElementById('jnlMoodTip');

    tipEl.style.display = 'flex';

    tipEl.style.background = md.bg;

    tipEl.style.borderLeftColor = md.color;

    tipEl.innerHTML = `<div class="jnl-tip-icon" style="color:${md.color}"><i class="fas fa-lightbulb"></i></div>

        <div><strong style="color:${md.color}">Tip for when you're feeling ${md.label.toLowerCase()}:</strong><br>${tip}</div>`;

}



function toggleJournalTag(btn) {

    btn.classList.toggle('active');

}



function saveJournalEntry() {

    const text = document.getElementById('jnlText').value.trim();

    if (!selectedJournalMood) {

        showAlert('Please select your mood first.', 'danger');

        return;

    }

    if (!text) {

        showAlert('Please write something about your day.', 'danger');

        return;

    }

    const tags = [];

    document.querySelectorAll('.jnl-tag.active').forEach(t => tags.push(t.dataset.tag));



    const entry = {

        id: Date.now(),

        mood: selectedJournalMood,

        text: text,

        tags: tags,

        date: new Date().toISOString()

    };



    const entries = getJournalEntries();

    entries.unshift(entry);

    saveJournalEntries(entries);



    // Reset form

    selectedJournalMood = null;

    document.querySelectorAll('.jnl-mood-btn').forEach(b => b.classList.remove('active'));

    document.getElementById('jnlMoodTip').style.display = 'none';

    document.getElementById('jnlText').value = '';

    document.querySelectorAll('.jnl-tag').forEach(t => t.classList.remove('active'));



    renderJournalEntries();

    renderMoodTrend();

    showAlert('Journal entry saved! ✨', 'success');

}



function renderJournalEntries() {

    const container = document.getElementById('jnlEntries');

    let entries = getJournalEntries();

    const filterMood = document.getElementById('jnlFilterMood').value;

    if (filterMood !== 'all') entries = entries.filter(e => e.mood === filterMood);



    if (entries.length === 0) {

        container.innerHTML = `<div class="jnl-empty"><i class="fas fa-journal-whills"></i><p>${filterMood !== 'all' ? 'No entries with this mood.' : 'No journal entries yet. Start writing above!'}</p></div>`;

        return;

    }



    let html = '';

    entries.forEach((entry, idx) => {

        const md = MOOD_DATA[entry.mood] || MOOD_DATA.calm;

        const d = new Date(entry.date);

        const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

        const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const tagsHtml = (entry.tags || []).map(t => `<span class="jnl-entry-tag">${t}</span>`).join('');

        const preview = entry.text.length > 200 ? entry.text.slice(0, 200) + '…' : entry.text;



        html += `<div class="jnl-entry" style="--accent:${md.color};--accent-bg:${md.bg}; animation-delay:${idx * 0.05}s">

            <div class="jnl-entry-header">

                <div class="jnl-entry-mood" style="background:${md.bg};color:${md.color}">

                    <span class="jnl-entry-emoji">${md.emoji}</span>

                    <span>${md.label}</span>

                </div>

                <div class="jnl-entry-date">

                    <span>${dateStr}</span>

                    <small>${timeStr}</small>

                </div>

            </div>

            <p class="jnl-entry-text">${preview.replace(/\n/g, '<br>')}</p>

            ${tagsHtml ? '<div class="jnl-entry-tags">' + tagsHtml + '</div>' : ''}

            <div class="jnl-entry-actions">

                <button class="jnl-action-btn" onclick="expandJournalEntry(${entry.id})" title="Read full"><i class="fas fa-expand-alt"></i></button>

                <button class="jnl-action-btn danger" onclick="deleteJournalEntry(${entry.id})" title="Delete"><i class="fas fa-trash-alt"></i></button>

            </div>

        </div>`;

    });

    container.innerHTML = html;

}



function expandJournalEntry(id) {

    const entries = getJournalEntries();

    const entry = entries.find(e => e.id === id);

    if (!entry) return;

    const md = MOOD_DATA[entry.mood] || MOOD_DATA.calm;

    const d = new Date(entry.date);

    const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const tagsHtml = (entry.tags || []).map(t => `<span class="jnl-entry-tag">${t}</span>`).join('');



    // Create modal overlay

    const overlay = document.createElement('div');

    overlay.className = 'jnl-overlay';

    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `<div class="jnl-expand-card">

        <button class="jnl-expand-close" onclick="this.closest('.jnl-overlay').remove()"><i class="fas fa-times"></i></button>

        <div class="jnl-expand-mood" style="background:${md.bg};color:${md.color}">

            <span style="font-size:2.5rem">${md.emoji}</span>

            <div>

                <strong style="font-size:1.1rem">${md.label}</strong>

                <p style="margin:0;font-size:.82rem;opacity:.7">${dateStr} at ${timeStr}</p>

            </div>

        </div>

        <div class="jnl-expand-body">

            <p>${entry.text.replace(/\n/g, '<br>')}</p>

            ${tagsHtml ? '<div class="jnl-entry-tags" style="margin-top:1rem">' + tagsHtml + '</div>' : ''}

        </div>

    </div>`;

    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('visible'));

}



function deleteJournalEntry(id) {

    if (!confirm('Delete this journal entry? This cannot be undone.')) return;

    let entries = getJournalEntries();

    entries = entries.filter(e => e.id !== id);

    saveJournalEntries(entries);

    renderJournalEntries();

    renderMoodTrend();

    showAlert('Entry deleted.', 'info');

}



function clearJournalFilter() {

    document.getElementById('jnlFilterMood').value = 'all';

    renderJournalEntries();

}



function renderMoodTrend() {

    const container = document.getElementById('jnlMoodTrend');

    const entries = getJournalEntries();

    if (entries.length === 0) {

        container.innerHTML = '<p style="text-align:center;color:var(--text-secondary,#94a3b8);font-size:.85rem">Add journal entries to see your mood trend.</p>';

        return;

    }



    // Group by day (last 7 days)

    const today = new Date();

    const days = [];

    for (let i = 6; i >= 0; i--) {

        const d = new Date(today);

        d.setDate(d.getDate() - i);

        const key = d.toISOString().slice(0, 10);

        const dayEntries = entries.filter(e => e.date.slice(0, 10) === key);

        const avgScore = dayEntries.length > 0

            ? dayEntries.reduce((s, e) => s + (MOOD_DATA[e.mood]?.score || 3), 0) / dayEntries.length

            : null;

        const dominantMood = dayEntries.length > 0 ? dayEntries[0].mood : null;

        days.push({

            label: d.toLocaleDateString('en-US', { weekday: 'short' }),

            date: key,

            score: avgScore,

            mood: dominantMood,

            count: dayEntries.length

        });

    }



    const maxScore = 5;

    let html = '<div class="jnl-trend-chart">';

    days.forEach(day => {

        const pct = day.score !== null ? (day.score / maxScore) * 100 : 0;

        const md = day.mood ? MOOD_DATA[day.mood] : null;

        const barColor = md ? md.color : '#e5e7eb';

        const emoji = md ? md.emoji : '';



        html += `<div class="jnl-trend-bar-wrap">

            <div class="jnl-trend-emoji">${emoji}</div>

            <div class="jnl-trend-bar-bg">

                <div class="jnl-trend-bar" style="height:${pct}%;background:${barColor}"></div>

            </div>

            <span class="jnl-trend-label">${day.label}</span>

            ${day.count > 0 ? '<small class="jnl-trend-count">' + day.count + '</small>' : ''}

        </div>`;

    });

    html += '</div>';

    container.innerHTML = html;

}



// ==================== MY NOTES ====================

let notesCache = [];
let selectedNoteColor = '#6366f1';

function isSaveNotesEnabled() {
    return localStorage.getItem('saveNotesEnabled') !== 'false';
}

function toggleSaveNotes(enabled) {
    localStorage.setItem('saveNotesEnabled', enabled);
    if (enabled) {
        showAlert('Notes will be saved to your account', 'success');
        // Sync any local notes to cloud
        syncLocalNotesToCloud();
    } else {
        showAlert('Notes will only be saved locally', 'info');
    }
}

async function initNotesPage() {
    await loadNotes();
    populateNotesSubjectFilter();
}

async function loadNotes() {
    if (isSaveNotesEnabled()) {
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/notes`);
            if (res && res.notes) {
                notesCache = res.notes;
                // Also keep a local backup
                localStorage.setItem('savedNotes', JSON.stringify(notesCache));
            }
        } catch (e) {
            console.error('Failed to load notes from server, using local:', e);
            notesCache = JSON.parse(localStorage.getItem('savedNotes') || '[]');
        }
    } else {
        notesCache = JSON.parse(localStorage.getItem('savedNotes') || '[]');
    }
    renderNotes();
}

function renderNotes() {
    const grid = document.getElementById('notesGrid');
    if (!grid) return;

    const searchTerm = (document.getElementById('notesSearchInput')?.value || '').toLowerCase();
    const filterSubject = document.getElementById('notesFilterSubject')?.value || 'all';

    let filtered = notesCache.filter(n => {
        const matchSearch = !searchTerm ||
            n.title.toLowerCase().includes(searchTerm) ||
            (n.content || '').toLowerCase().includes(searchTerm) ||
            (n.subject || '').toLowerCase().includes(searchTerm);
        const matchSubject = filterSubject === 'all' || n.subject === filterSubject;
        return matchSearch && matchSubject;
    });

    // Sort: pinned first, then by updated_at
    filtered.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.updated_at) - new Date(a.updated_at);
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="notes-empty"><i class="fas fa-sticky-note"></i><p>${searchTerm || filterSubject !== 'all' ? 'No notes match your filter.' : 'No notes yet. Click "New Note" to get started!'}</p></div>`;
        return;
    }

    grid.innerHTML = filtered.map(note => {
        const date = new Date(note.updated_at || note.created_at);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const noteId = note._id || note.id;
        return `
        <div class="note-card" style="border-left-color: ${note.color || '#6366f1'}">
            <div class="note-card-header">
                <h6 class="note-card-title">${escapeHtml(note.title)}${note.source === 'pdf' ? '<span class="note-pdf-badge"><i class="fas fa-file-pdf"></i> PDF</span>' : ''}</h6>
                <button class="note-card-pin ${note.pinned ? 'pinned' : ''}" onclick="togglePinNote('${noteId}')" title="${note.pinned ? 'Unpin' : 'Pin'}">
                    <i class="fas fa-thumbtack"></i>
                </button>
            </div>
            ${note.subject ? `<span class="note-card-subject">${escapeHtml(note.subject)}</span>` : ''}
            <div class="note-card-body">${escapeHtml(note.content || '')}</div>
            <div class="note-card-footer">
                <span class="note-card-date"><i class="fas fa-clock me-1"></i>${dateStr}</span>
                <div class="note-card-actions">
                    <button onclick="editNote('${noteId}')" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="danger" onclick="deleteNoteConfirm('${noteId}')" title="Delete"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function populateNotesSubjectFilter() {
    const select = document.getElementById('notesFilterSubject');
    if (!select) return;
    const subjects = [...new Set(notesCache.map(n => n.subject).filter(Boolean))];
    select.innerHTML = '<option value="all">All Subjects</option>' +
        subjects.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
}

function filterNotes() {
    renderNotes();
}

function selectNoteColor(btn) {
    document.querySelectorAll('.note-color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedNoteColor = btn.dataset.color;
}

function openNoteEditor(noteId) {
    document.getElementById('noteEditId').value = '';
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteSubject').value = '';
    document.getElementById('noteContent').value = '';
    selectedNoteColor = '#6366f1';
    document.querySelectorAll('.note-color-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.color === '#6366f1');
    });
    document.getElementById('noteEditorTitle').innerHTML = '<i class="fas fa-pen me-2"></i>New Note';
    new bootstrap.Modal(document.getElementById('noteEditorModal')).show();
}

function editNote(noteId) {
    const note = notesCache.find(n => (n._id || n.id) === noteId);
    if (!note) return;

    document.getElementById('noteEditId').value = noteId;
    document.getElementById('noteTitle').value = note.title;
    document.getElementById('noteSubject').value = note.subject || '';
    document.getElementById('noteContent').value = note.content || '';
    selectedNoteColor = note.color || '#6366f1';
    document.querySelectorAll('.note-color-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.color === selectedNoteColor);
    });
    document.getElementById('noteEditorTitle').innerHTML = '<i class="fas fa-edit me-2"></i>Edit Note';
    new bootstrap.Modal(document.getElementById('noteEditorModal')).show();
}

async function saveNote() {
    const editId = document.getElementById('noteEditId').value;
    const title = document.getElementById('noteTitle').value.trim();
    const subject = document.getElementById('noteSubject').value.trim();
    const content = document.getElementById('noteContent').value.trim();

    if (!title) {
        showAlert('Please enter a title for your note', 'warning');
        return;
    }

    const noteData = { title, subject, content, color: selectedNoteColor };

    if (isSaveNotesEnabled()) {
        try {
            if (editId) {
                await fetchWithAuth(`${API_BASE_URL}/notes/${editId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(noteData)
                });
            } else {
                await fetchWithAuth(`${API_BASE_URL}/notes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(noteData)
                });
            }
        } catch (e) {
            console.error('Failed to save note to server:', e);
            saveNoteLocally(editId, noteData);
            showAlert('Saved locally (server unavailable)', 'warning');
            bootstrap.Modal.getInstance(document.getElementById('noteEditorModal'))?.hide();
            await loadNotes();
            populateNotesSubjectFilter();
            return;
        }
    } else {
        saveNoteLocally(editId, noteData);
    }

    bootstrap.Modal.getInstance(document.getElementById('noteEditorModal'))?.hide();
    showAlert(editId ? 'Note updated!' : 'Note saved!', 'success');
    await loadNotes();
    populateNotesSubjectFilter();
}

function saveNoteLocally(editId, noteData) {
    let notes = JSON.parse(localStorage.getItem('savedNotes') || '[]');
    if (editId) {
        const idx = notes.findIndex(n => (n._id || n.id) === editId);
        if (idx !== -1) {
            notes[idx] = { ...notes[idx], ...noteData, updated_at: new Date().toISOString() };
        }
    } else {
        notes.push({
            id: 'local_' + Date.now(),
            ...noteData,
            pinned: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
    }
    localStorage.setItem('savedNotes', JSON.stringify(notes));
    notesCache = notes;
}

async function togglePinNote(noteId) {
    const note = notesCache.find(n => (n._id || n.id) === noteId);
    if (!note) return;

    const newPinned = !note.pinned;

    if (isSaveNotesEnabled() && note._id) {
        try {
            await fetchWithAuth(`${API_BASE_URL}/notes/${noteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pinned: newPinned })
            });
        } catch (e) { console.error('Pin toggle failed:', e); }
    }

    note.pinned = newPinned;
    localStorage.setItem('savedNotes', JSON.stringify(notesCache));
    renderNotes();
}

async function deleteNoteConfirm(noteId) {
    if (!confirm('Delete this note? This cannot be undone.')) return;

    if (isSaveNotesEnabled()) {
        try {
            await fetchWithAuth(`${API_BASE_URL}/notes/${noteId}`, { method: 'DELETE' });
        } catch (e) { console.error('Delete failed on server:', e); }
    }

    // Also remove locally
    let notes = JSON.parse(localStorage.getItem('savedNotes') || '[]');
    notes = notes.filter(n => (n._id || n.id) !== noteId);
    localStorage.setItem('savedNotes', JSON.stringify(notes));

    notesCache = notesCache.filter(n => (n._id || n.id) !== noteId);
    renderNotes();
    populateNotesSubjectFilter();
    showAlert('Note deleted', 'success');
}

async function syncLocalNotesToCloud() {
    const localNotes = JSON.parse(localStorage.getItem('savedNotes') || '[]');
    const localOnly = localNotes.filter(n => (n.id || '').startsWith('local_'));
    for (const note of localOnly) {
        try {
            await fetchWithAuth(`${API_BASE_URL}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: note.title,
                    content: note.content,
                    subject: note.subject,
                    color: note.color
                })
            });
        } catch (e) { console.error('Sync failed for note:', note.title, e); }
    }
    if (localOnly.length > 0) {
        await loadNotes();
        populateNotesSubjectFilter();
    }
}

async function handlePdfUpload(input) {
    const file = input.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
        showAlert('Please select a PDF file', 'warning');
        input.value = '';
        return;
    }

    // Show progress bar
    const progressEl = document.getElementById('pdfUploadProgress');
    const statusEl = document.getElementById('pdfUploadStatus');
    const fillEl = document.getElementById('pdfProgressFill');
    progressEl.style.display = 'block';
    statusEl.textContent = `Uploading "${file.name}"...`;
    fillEl.style.width = '30%';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('subject', '');
    formData.append('color', '#3b82f6');

    try {
        fillEl.style.width = '60%';
        statusEl.textContent = 'Extracting text from PDF...';

        // Use direct fetch for file uploads (no Content-Type header so browser sets multipart boundary)
        const response = await fetch(`${API_BASE_URL}/notes/upload-pdf`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData
        });

        const res = await response.json();
        fillEl.style.width = '100%';

        if (response.ok && res.note_id) {
            statusEl.innerHTML = `<i class="fas fa-check-circle me-2" style="color:#10b981"></i>${res.message}`;
            showAlert(res.message, 'success');
            await loadNotes();
            populateNotesSubjectFilter();
            setTimeout(() => { progressEl.style.display = 'none'; }, 3000);
        } else {
            const errMsg = res?.error || 'Failed to upload PDF';
            statusEl.innerHTML = `<i class="fas fa-times-circle me-2" style="color:#ef4444"></i>${errMsg}`;
            showAlert(errMsg, 'danger');
            setTimeout(() => { progressEl.style.display = 'none'; }, 4000);
        }
    } catch (e) {
        console.error('PDF upload error:', e);
        fillEl.style.width = '100%';
        statusEl.innerHTML = '<i class="fas fa-times-circle me-2" style="color:#ef4444"></i>Upload failed. Server may be unavailable.';
        showAlert('PDF upload failed. Check if the server is running.', 'danger');
        setTimeout(() => { progressEl.style.display = 'none'; }, 4000);
    }

    input.value = '';
}

// ==================== AI TUTOR ====================



function initAITutorPage() {

    const picker = document.getElementById('aitSubjectPicker');

    if (!picker) return;



    // Build subject list from cached data

    let subjects = [];

    if (cachedProgress && cachedProgress.subjects) {

        subjects = cachedProgress.subjects.map(s => ({

            name: s.subject,

            score: s.average_score || 0,

            sessions: s.total_sessions || 0

        }));

    } else if (cachedDashboard && cachedDashboard.recent_sessions) {

        const map = {};

        cachedDashboard.recent_sessions.forEach(s => {

            if (!map[s.subject]) map[s.subject] = { total: 0, count: 0 };

            map[s.subject].total += (s.score || 0);

            map[s.subject].count++;

        });

        subjects = Object.entries(map).map(([name, d]) => ({

            name, score: Math.round(d.total / d.count), sessions: d.count

        }));

    }



    if (subjects.length === 0) {

        picker.innerHTML = '<p class="empty-text">No subjects yet. Add study sessions first, or type a subject below!</p>';

    } else {

        picker.innerHTML = subjects.map(s =>

            `<button class="ait-subj-btn" onclick="getAITutorAdvice('${s.name}')">

                <i class="fas fa-book"></i>

                ${s.name}

                <span class="ait-score">(${s.score}%)</span>

            </button>`

        ).join('');

    }

}



function _showAitLoading(label) {

    const responseCard = document.getElementById('aitResponseCard');

    const responseBody = document.getElementById('aitResponseBody');

    responseCard.style.display = 'block';

    responseBody.innerHTML = `<div class="ait-loading">

        <div class="ait-loading-dots"><span></span><span></span><span></span></div>

        ${label}

    </div>`;

    responseCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

}



function _renderSectionsResponse(data) {

    const responseTitle = document.getElementById('aitResponseTitle');

    const responseSub = document.getElementById('aitResponseSub');

    const responseBody = document.getElementById('aitResponseBody');



    responseTitle.innerHTML = `<i class="fas fa-robot me-2"></i>${data.title || 'AI Tutor'}`;

    responseSub.textContent = 'Powered by AI — personalized for you';



    let html = '';

    if (data.sections && data.sections.length > 0) {

        data.sections.forEach(section => {

            html += `<div class="ait-section">

                <div class="ait-section-title"><i class="fas ${section.icon || 'fa-check-circle'}"></i> ${section.heading || section.title || ''}</div>

                <ul class="ait-tip-list">

                    ${(section.tips || []).map(t => `<li>${t}</li>`).join('')}

                </ul>

            </div>`;

        });

    }

    if (data.highlight) {

        html += `<div class="ait-highlight-box"><i class="fas fa-star"></i><span>${data.highlight}</span></div>`;

    }

    responseBody.innerHTML = html || '<p>No data received.</p>';

}



function _renderQuestionResponse(data) {

    const responseTitle = document.getElementById('aitResponseTitle');

    const responseSub = document.getElementById('aitResponseSub');

    const responseBody = document.getElementById('aitResponseBody');



    responseTitle.innerHTML = `<i class="fas fa-lightbulb me-2"></i>${data.title || 'AI Answer'}`;

    responseSub.textContent = data.difficulty ? `Difficulty: ${data.difficulty}` : 'AI-powered explanation';



    let html = '';

    if (data.explanation) {

        html += `<div class="ait-section">

            <div class="ait-section-title"><i class="fas fa-align-left"></i> Explanation</div>

            <div class="ait-explanation">${data.explanation}</div>

        </div>`;

    }

    if (data.key_points && data.key_points.length > 0) {

        html += `<div class="ait-section">

            <div class="ait-section-title"><i class="fas fa-list-check"></i> Key Points</div>

            <ul class="ait-tip-list">

                ${data.key_points.map(p => `<li>${p}</li>`).join('')}

            </ul>

        </div>`;

    }

    if (data.example) {

        html += `<div class="ait-section">

            <div class="ait-section-title"><i class="fas fa-code"></i> Example</div>

            <div class="ait-example">${data.example}</div>

        </div>`;

    }

    if (data.common_mistakes && data.common_mistakes.length > 0) {

        html += `<div class="ait-section">

            <div class="ait-section-title"><i class="fas fa-exclamation-triangle"></i> Common Mistakes</div>

            <ul class="ait-tip-list ait-mistakes">

                ${data.common_mistakes.map(m => `<li>${m}</li>`).join('')}

            </ul>

        </div>`;

    }

    if (data.practice_tip) {

        html += `<div class="ait-highlight-box"><i class="fas fa-dumbbell"></i><span><strong>Practice Tip:</strong> ${data.practice_tip}</span></div>`;

    }

    responseBody.innerHTML = html || '<p>No data received.</p>';

}



async function askAITutor() {

    const input = document.getElementById('aitAskInput');

    const subjectSelect = document.getElementById('aitAskSubject');

    const askBtn = document.getElementById('aitAskBtn');

    const question = input.value.trim();



    if (!question) {

        showAlert('Please type a question!', 'warning');

        return;

    }



    const subject = subjectSelect.value;

    _showAitLoading(`Thinking about <strong>${question.substring(0, 60)}${question.length > 60 ? '...' : ''}</strong>...`);

    askBtn.disabled = true;

    askBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Thinking...';



    try {

        const token = localStorage.getItem('token');

        const res = await fetch(`${API_BASE_URL}/api/ai/tutor`, {

            method: 'POST',

            headers: {

                'Content-Type': 'application/json',

                'Authorization': `Bearer ${token}`

            },

            body: JSON.stringify({

                subject: subject,

                question: question,

                mode: 'question',

                study_level: 'intermediate'

            })

        });

        const json = await res.json();

        if (json.success && json.data) {

            _renderQuestionResponse(json.data);

        } else {

            throw new Error(json.error || 'Failed to get response');

        }

    } catch (err) {

        console.error('AI Tutor ask error:', err);

        // Show a helpful fallback

        _renderQuestionResponse({

            title: question.substring(0, 80),

            explanation: `I couldn't reach the AI service right now, but here's some general guidance: Break your question into smaller parts, review the fundamentals of ${subject}, and try working through a simpler example first.`,

            key_points: [

                'Break complex problems into smaller parts',

                'Review fundamental concepts thoroughly',

                'Practice with progressively harder examples'

            ],

            practice_tip: `Search online for "${subject} ${question.substring(0, 30)}" tutorials and practice problems.`,

            difficulty: 'Intermediate'

        });

    } finally {

        askBtn.disabled = false;

        askBtn.innerHTML = '<i class="fas fa-paper-plane me-1"></i>Ask';

        input.value = '';

    }

}



async function getAITutorAdvice(subject) {

    if (!subject || !subject.trim()) {

        showAlert('Please select or type a subject!', 'warning');

        return;

    }

    subject = subject.trim();



    _showAitLoading(`Generating personalized advice for <strong>${subject}</strong>...`);



    // Highlight selected subject button

    document.querySelectorAll('.ait-subj-btn').forEach(btn => {

        btn.classList.toggle('active', btn.textContent.toLowerCase().includes(subject.toLowerCase()));

    });



    try {

        const token = localStorage.getItem('token');

        const res = await fetch(`${API_BASE_URL}/api/ai/tutor`, {

            method: 'POST',

            headers: {

                'Content-Type': 'application/json',

                'Authorization': `Bearer ${token}`

            },

            body: JSON.stringify({

                subject: subject,

                question: `Study advice for ${subject}`,

                mode: 'subject_advice',

                study_level: 'intermediate'

            })

        });

        const json = await res.json();

        if (json.success && json.data) {

            _renderSectionsResponse(json.data);

            // Append score-based commentary if available

            _appendScoreInfo(subject);

        } else {

            throw new Error(json.error || 'Failed to get advice');

        }

    } catch (err) {

        console.error('AI Tutor advice error:', err);

        // Fallback — show generic tips

        _renderSectionsResponse({

            title: `Study Guide: ${subject}`,

            sections: [

                { heading: 'Stress Management', icon: 'fa-brain', tips: [

                    `Break ${subject} study into 25-min focused sessions with 5-min breaks`,

                    'Practice deep breathing before tackling difficult topics',

                    'Keep a progress journal to track what you\'ve mastered'

                ]},

                { heading: 'Focus Techniques', icon: 'fa-crosshairs', tips: [

                    'Remove phone and social media distractions while studying',

                    `Start with the most challenging ${subject} topics when your energy is highest`,

                    'Use active recall — close the book and explain concepts aloud'

                ]},

                { heading: 'Study Strategy', icon: 'fa-chess', tips: [

                    'Use spaced repetition: review after 1 day, 3 days, 1 week',

                    `Create mind maps connecting key ${subject} concepts`,

                    'Teach concepts to a friend to find gaps in understanding'

                ]}

            ],

            highlight: `Consistency beats intensity — 30 minutes daily of ${subject} is better than 5 hours once a week!`

        });

        _appendScoreInfo(subject);

    }

}



function _appendScoreInfo(subject) {

    const key = subject.toLowerCase();

    let scoreInfo = '';

    if (cachedProgress && cachedProgress.subjects) {

        const subj = cachedProgress.subjects.find(s => s.subject.toLowerCase() === key);

        if (subj) {

            if (subj.average_score < 50) {

                scoreInfo = `Your average in ${subject} is <strong>${subj.average_score}%</strong> — this needs focused attention. Prioritize this subject daily.`;

            } else if (subj.average_score < 75) {

                scoreInfo = `Your average in ${subject} is <strong>${subj.average_score}%</strong> — good progress! Focus on weak areas to push into the 80+ zone.`;

            } else {

                scoreInfo = `Your average in ${subject} is <strong>${subj.average_score}%</strong> — excellent work! Maintain with regular review.`;

            }

        }

    }

    if (scoreInfo) {

        const responseBody = document.getElementById('aitResponseBody');

        responseBody.innerHTML += `<div class="ait-highlight-box"><i class="fas fa-chart-line"></i><span>${scoreInfo}</span></div>`;

    }

}



async function getAITutorTopic(topicName) {

    _showAitLoading(`Preparing guidance on <strong>${topicName}</strong>...`);



    try {

        const token = localStorage.getItem('token');

        const res = await fetch(`${API_BASE_URL}/api/ai/tutor`, {

            method: 'POST',

            headers: {

                'Content-Type': 'application/json',

                'Authorization': `Bearer ${token}`

            },

            body: JSON.stringify({

                subject: 'Study Wellness',

                question: topicName,

                mode: 'topic',

                study_level: 'intermediate'

            })

        });

        const json = await res.json();

        if (json.success && json.data) {

            _renderSectionsResponse(json.data);

        } else {

            throw new Error(json.error || 'Failed to get topic info');

        }

    } catch (err) {

        console.error('AI Tutor topic error:', err);

        _renderSectionsResponse({

            title: topicName,

            sections: [

                { heading: 'Quick Techniques', icon: 'fa-bolt', tips: [

                    'Practice 4-7-8 breathing: inhale 4s, hold 7s, exhale 8s',

                    'Use the Pomodoro Technique: 25 min work, 5 min rest',

                    'Write down worries before studying to clear your mind'

                ]},

                { heading: 'Long-term Habits', icon: 'fa-calendar', tips: [

                    'Maintain a consistent sleep schedule of 7-8 hours',

                    'Exercise for at least 20 minutes daily',

                    'Practice mindfulness or meditation for 10 minutes each morning'

                ]}

            ],

            highlight: 'Small daily habits compound into big results over time!'

        });

    }

}



// ==================== SETTINGS PAGE ====================

function initSettingsPage() {

    const user = cachedDashboard?.user;

    // Get user_id: try localStorage first, then currentUser, then parsed stored user

    let userId = localStorage.getItem('user_id');

    if (!userId) {

        userId = currentUser?.id;

    }

    if (!userId) {

        try { userId = JSON.parse(localStorage.getItem('user') || '{}').id; } catch(e) {}

    }

    userId = userId || 'N/A';



    document.getElementById('setName').value = user?.name || currentUser?.name || '';

    document.getElementById('setEmail').value = user?.email || '';

    document.getElementById('setUserId').value = userId;

    document.getElementById('setBannerName').textContent = user?.name || currentUser?.name || 'Student';

    document.getElementById('setBannerEmail').textContent = user?.email || '';



    // Member Since: from dashboard created_at

    const joinDate = user?.created_at;

    if (joinDate) {

        try {

            const d = new Date(joinDate);

            if (!isNaN(d.getTime())) {

                document.getElementById('setJoinDate').value = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

            } else {

                document.getElementById('setJoinDate').value = joinDate;

            }

        } catch(e) { document.getElementById('setJoinDate').value = 'N/A'; }

    } else {

        document.getElementById('setJoinDate').value = 'N/A';

    }



    document.getElementById('setDarkToggle').checked = document.body.classList.contains('dark-mode');

    document.getElementById('setSoundToggle').checked = localStorage.getItem('soundEnabled') !== 'false';

    document.getElementById('setNotifToggle').checked = localStorage.getItem('notificationsEnabled') === 'true';

    document.getElementById('setSaveNotesToggle').checked = localStorage.getItem('saveNotesEnabled') !== 'false';

    calcStorageUsed();

}



async function updateProfile(field) {

    if (field === 'name') {

        const newName = document.getElementById('setName').value.trim();

        if (!newName) { showAlert('Name cannot be empty!', 'warning'); return; }

        try {

            const res = await fetchWithAuth(`${API_BASE_URL}/update-profile`, {

                method: 'PUT',

                headers: { 'Content-Type': 'application/json' },

                body: JSON.stringify({ name: newName })

            });

            if (res && !res.error) {

                showAlert('Name updated successfully!', 'success');

                document.getElementById('setBannerName').textContent = newName;

                document.getElementById('profileName').textContent = newName;

                document.getElementById('greetingText').textContent = `Hello, ${newName} \ud83d\udc4b`;

                if (cachedDashboard) cachedDashboard.user.name = newName;

            } else {

                showAlert(res?.error || 'Failed to update name', 'error');

            }

        } catch (e) { showAlert('Error updating profile: ' + e.message, 'error'); }

    }

}



async function handleChangePassword(e) {

    e.preventDefault();

    const current = document.getElementById('setCurrPassword').value;

    const newPass = document.getElementById('setNewPassword').value;

    const confirm = document.getElementById('setConfirmPassword').value;



    if (newPass.length < 6) { showAlert('New password must be at least 6 characters!', 'warning'); return; }

    if (newPass !== confirm) { showAlert('New passwords do not match!', 'warning'); return; }

    if (current === newPass) { showAlert('New password must be different from current!', 'warning'); return; }



    try {

        const res = await fetchWithAuth(`${API_BASE_URL}/change-password`, {

            method: 'PUT',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify({ current_password: current, new_password: newPass })

        });

        if (res && !res.error) {

            showAlert('Password changed successfully!', 'success');

            document.getElementById('changePasswordForm').reset();

        } else {

            showAlert(res?.error || 'Failed to change password', 'error');

        }

    } catch (e) { showAlert('Error: ' + e.message, 'error'); }

}



function togglePasswordVis(inputId, btn) {

    const input = document.getElementById(inputId);

    const icon = btn.querySelector('i');

    if (input.type === 'password') {

        input.type = 'text';

        icon.classList.replace('fa-eye', 'fa-eye-slash');

    } else {

        input.type = 'password';

        icon.classList.replace('fa-eye-slash', 'fa-eye');

    }

}



function copyUserId() {

    const userId = document.getElementById('setUserId').value;

    navigator.clipboard.writeText(userId).then(() => {

        showAlert('User ID copied to clipboard!', 'success');

    }).catch(() => {

        const input = document.getElementById('setUserId');

        input.removeAttribute('disabled');

        input.select();

        document.execCommand('copy');

        input.setAttribute('disabled', '');

        showAlert('User ID copied!', 'success');

    });

}



function toggleSetting(key, value) {

    localStorage.setItem(key + 'Enabled', value);

    showAlert(`${key === 'sound' ? 'Sound effects' : key} ${value ? 'enabled' : 'disabled'}`, 'success');

}



function toggleNotifications(enabled) {

    if (enabled && 'Notification' in window) {

        Notification.requestPermission().then(perm => {

            if (perm === 'granted') {

                localStorage.setItem('notificationsEnabled', 'true');

                showAlert('Desktop notifications enabled!', 'success');

            } else {

                document.getElementById('setNotifToggle').checked = false;

                localStorage.setItem('notificationsEnabled', 'false');

                showAlert('Notification permission denied by browser.', 'warning');

            }

        });

    } else {

        localStorage.setItem('notificationsEnabled', 'false');

        showAlert('Desktop notifications disabled.', 'success');

    }

}



function calcStorageUsed() {

    let total = 0;

    for (let key in localStorage) {

        if (localStorage.hasOwnProperty(key)) {

            total += (localStorage[key].length + key.length) * 2;

        }

    }

    const kb = (total / 1024).toFixed(1);

    const el = document.getElementById('setStorageUsed');

    if (el) el.textContent = `${kb} KB used in local storage`;

}



function clearLocalData() {

    if (!confirm('Clear all cached data? Your account and sessions are safe on the server.')) return;

    const token = localStorage.getItem('token');

    const userId = localStorage.getItem('user_id');

    const dark = localStorage.getItem('darkMode');

    localStorage.clear();

    if (token) localStorage.setItem('token', token);

    if (userId) localStorage.setItem('user_id', userId);

    if (dark) localStorage.setItem('darkMode', dark);

    cachedDashboard = null;

    cachedProgress = null;

    cachedRecommendations = null;

    cachedWeekly = null;

    showAlert('Cache cleared! Refreshing data...', 'success');

    calcStorageUsed();

    loadAllData();

}



async function exportUserData() {

    try {

        showAlert('Preparing export...', 'success');

        const sessions = await fetchWithAuth(`${API_BASE_URL}/sessions`);

        const data = {

            exported_at: new Date().toISOString(),

            user: cachedDashboard?.user || {},

            sessions: sessions?.sessions || [],

            settings: {

                darkMode: localStorage.getItem('darkMode'),

                soundEnabled: localStorage.getItem('soundEnabled'),

                notificationsEnabled: localStorage.getItem('notificationsEnabled'),

            }

        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });

        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');

        a.href = url;

        a.download = `studymate-export-${new Date().toISOString().slice(0, 10)}.json`;

        document.body.appendChild(a);

        a.click();

        document.body.removeChild(a);

        URL.revokeObjectURL(url);

        showAlert('Data exported successfully!', 'success');

    } catch (e) { showAlert('Export failed: ' + e.message, 'error'); }

}



async function deleteAllSessions() {

    if (!confirm('Are you sure? This will permanently delete ALL your study sessions. This cannot be undone!')) return;

    if (!confirm('Really delete everything?')) return;

    try {

        const res = await fetchWithAuth(`${API_BASE_URL}/sessions/all`, { method: 'DELETE' });

        if (res && !res.error) {

            showAlert('All sessions deleted.', 'success');

            cachedDashboard = null;

            cachedProgress = null;

            cachedWeekly = null;

            loadAllData();

        } else {

            showAlert(res?.error || 'Failed to delete sessions', 'error');

        }

    } catch (e) { showAlert('Error: ' + e.message, 'error'); }

}





// ==================== MOCK TEST MODULE ====================



// Preloaded MCQ questions for each subject (25 each)

const PRELOADED_QUESTIONS = {

    "Database Systems": [

        { text: "What does DBMS stand for?", type: "mcq", options: ["Data Backup Management System", "Database Management System", "Data Build Management System", "Database Method System"], correct: 1, unit: "DBMS Basics", subtopic: "Data models" },

        { text: "Which language is used to query databases?", type: "mcq", options: ["HTML", "SQL", "Python", "Java"], correct: 1, unit: "SQL", subtopic: "DDL (CREATE, ALTER, DROP)" },

        { text: "Which of the following is NOT a type of database model?", type: "mcq", options: ["Hierarchical", "Network", "Relational", "Linear"], correct: 3, unit: "DBMS Basics", subtopic: "Data models" },

        { text: "What is a primary key?", type: "mcq", options: ["A key used to open the database", "A unique identifier for each record in a table", "A key used for security", "A duplicate value field"], correct: 1, unit: "Relational Model", subtopic: "Primary key" },

        { text: "Which command is used to retrieve data from a database?", type: "mcq", options: ["INSERT", "DELETE", "SELECT", "UPDATE"], correct: 2, unit: "SQL", subtopic: "DML (SELECT, INSERT, UPDATE, DELETE)" },

        { text: "Which of the following is a DDL command?", type: "mcq", options: ["SELECT", "INSERT", "CREATE", "UPDATE"], correct: 2, unit: "SQL", subtopic: "DDL (CREATE, ALTER, DROP)" },

        { text: "What does SQL stand for?", type: "mcq", options: ["Structured Query Language", "Standard Query Logic", "Sequential Query Language", "System Query Language"], correct: 0, unit: "SQL", subtopic: "DDL (CREATE, ALTER, DROP)" },

        { text: "A table in a relational database is also known as:", type: "mcq", options: ["Entity", "Relation", "Attribute", "Record"], correct: 1, unit: "Relational Model", subtopic: "Tables" },

        { text: "Rows in a table are called:", type: "mcq", options: ["Fields", "Attributes", "Tuples", "Columns"], correct: 2, unit: "Relational Model", subtopic: "Tables" },

        { text: "Columns in a table are called:", type: "mcq", options: ["Records", "Tuples", "Attributes", "Relations"], correct: 2, unit: "Relational Model", subtopic: "Keys" },

        { text: "Which command is used to remove a table?", type: "mcq", options: ["DELETE", "DROP", "REMOVE", "CLEAR"], correct: 1, unit: "SQL", subtopic: "DDL (CREATE, ALTER, DROP)" },

        { text: "Which normal form removes partial dependency?", type: "mcq", options: ["1NF", "2NF", "3NF", "BCNF"], correct: 1, unit: "Normalization", subtopic: "2NF" },

        { text: "Which normal form removes transitive dependency?", type: "mcq", options: ["1NF", "2NF", "3NF", "4NF"], correct: 2, unit: "Normalization", subtopic: "3NF" },

        { text: "Which clause is used to filter records?", type: "mcq", options: ["WHERE", "ORDER BY", "GROUP BY", "HAVING"], correct: 0, unit: "SQL", subtopic: "DML (SELECT, INSERT, UPDATE, DELETE)" },

        { text: "Which SQL command is used to add data to a table?", type: "mcq", options: ["ADD", "INSERT", "CREATE", "PUT"], correct: 1, unit: "SQL", subtopic: "DML (SELECT, INSERT, UPDATE, DELETE)" },

        { text: "What is normalization?", type: "mcq", options: ["Increasing redundancy", "Organizing data to reduce redundancy", "Deleting unnecessary tables", "Adding duplicate data"], correct: 1, unit: "Normalization", subtopic: "1NF" },

        { text: "A foreign key is used to:", type: "mcq", options: ["Identify unique records", "Link two tables", "Delete records", "Sort records"], correct: 1, unit: "Relational Model", subtopic: "Foreign key" },

        { text: "Which operation combines rows from two tables?", type: "mcq", options: ["JOIN", "UNION", "SELECT", "MERGE"], correct: 0, unit: "SQL", subtopic: "DML (SELECT, INSERT, UPDATE, DELETE)" },

        { text: "Which clause is used to sort results?", type: "mcq", options: ["GROUP BY", "ORDER BY", "HAVING", "WHERE"], correct: 1, unit: "SQL", subtopic: "DML (SELECT, INSERT, UPDATE, DELETE)" },

        { text: "Which type of join returns matching records from both tables?", type: "mcq", options: ["LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "FULL JOIN"], correct: 2, unit: "SQL", subtopic: "DML (SELECT, INSERT, UPDATE, DELETE)" },

        { text: "What does ACID stand for in DBMS transactions?", type: "mcq", options: ["Accuracy, Consistency, Isolation, Durability", "Atomicity, Consistency, Isolation, Durability", "Atomicity, Clarity, Integrity, Durability", "Accuracy, Clarity, Isolation, Data"], correct: 1, unit: "Transactions", subtopic: "ACID properties" },

        { text: "Which command is used to modify existing data?", type: "mcq", options: ["UPDATE", "ALTER", "CHANGE", "MODIFY"], correct: 0, unit: "SQL", subtopic: "DML (SELECT, INSERT, UPDATE, DELETE)" },

        { text: "Which key uniquely identifies each row in a table?", type: "mcq", options: ["Foreign Key", "Candidate Key", "Primary Key", "Composite Key"], correct: 2, unit: "Relational Model", subtopic: "Primary key" },

        { text: "Which command is used to delete records from a table?", type: "mcq", options: ["REMOVE", "DROP", "DELETE", "ERASE"], correct: 2, unit: "SQL", subtopic: "DML (SELECT, INSERT, UPDATE, DELETE)" },

        { text: "Which type of database is most commonly used today?", type: "mcq", options: ["Hierarchical Database", "Network Database", "Relational Database", "Object Database"], correct: 2, unit: "DBMS Basics", subtopic: "Data models" }

    ],

    "Data Structures": [

        { text: "What is a data structure?", type: "mcq", options: ["A method of storing data", "A way to organize and manage data efficiently", "A programming language", "A type of database"], correct: 1, unit: "Basics", subtopic: "Arrays" },

        { text: "Which data structure works on LIFO principle?", type: "mcq", options: ["Queue", "Stack", "Linked List", "Tree"], correct: 1, unit: "Stack", subtopic: "Implementation" },

        { text: "Which data structure works on FIFO principle?", type: "mcq", options: ["Stack", "Queue", "Tree", "Graph"], correct: 1, unit: "Queue", subtopic: "Simple queue" },

        { text: "Which operation adds an element to a stack?", type: "mcq", options: ["Pop", "Push", "Insert", "Add"], correct: 1, unit: "Stack", subtopic: "Implementation" },

        { text: "Which operation removes an element from a stack?", type: "mcq", options: ["Push", "Pop", "Delete", "Remove"], correct: 1, unit: "Stack", subtopic: "Applications" },

        { text: "In an array, elements are stored in:", type: "mcq", options: ["Random locations", "Linked memory", "Contiguous memory locations", "Separate files"], correct: 2, unit: "Basics", subtopic: "Arrays" },

        { text: "Which data structure uses nodes connected by pointers?", type: "mcq", options: ["Array", "Linked List", "Stack", "Queue"], correct: 1, unit: "Linked Lists", subtopic: "Singly linked list" },

        { text: "What is the first node in a linked list called?", type: "mcq", options: ["Root", "Start", "Head", "Pointer"], correct: 2, unit: "Linked Lists", subtopic: "Singly linked list" },

        { text: "What is the time complexity of accessing an element in an array?", type: "mcq", options: ["O(1)", "O(n)", "O(log n)", "O(n\u00B2)"], correct: 0, unit: "Basics", subtopic: "Time complexity" },

        { text: "Which data structure is used in recursion?", type: "mcq", options: ["Queue", "Stack", "Array", "Graph"], correct: 1, unit: "Stack", subtopic: "Applications" },

        { text: "Which traversal method is used in binary trees?", type: "mcq", options: ["Inorder", "Preorder", "Postorder", "All of the above"], correct: 3, unit: "Trees", subtopic: "Binary tree" },

        { text: "In a Binary Tree, each node can have a maximum of:", type: "mcq", options: ["1 child", "2 children", "3 children", "Unlimited children"], correct: 1, unit: "Trees", subtopic: "Binary tree" },

        { text: "A Binary Search Tree (BST) follows which rule?", type: "mcq", options: ["Left child > Parent", "Right child < Parent", "Left child < Parent < Right child", "All nodes equal"], correct: 2, unit: "Trees", subtopic: "Binary search tree" },

        { text: "Which data structure is best for priority scheduling?", type: "mcq", options: ["Queue", "Stack", "Heap", "Array"], correct: 2, unit: "Trees", subtopic: "Heap" },

        { text: "Which data structure represents relationships between objects?", type: "mcq", options: ["Tree", "Graph", "Array", "Stack"], correct: 1, unit: "Graphs", subtopic: "Graph representation" },

        { text: "Which search algorithm works only on sorted arrays?", type: "mcq", options: ["Linear Search", "Binary Search", "Depth First Search", "Breadth First Search"], correct: 1, unit: "Basics", subtopic: "Big-O notation" },

        { text: "What is the time complexity of binary search?", type: "mcq", options: ["O(n)", "O(n\u00B2)", "O(log n)", "O(1)"], correct: 2, unit: "Basics", subtopic: "Time complexity" },

        { text: "Which sorting algorithm has the best average performance?", type: "mcq", options: ["Bubble Sort", "Quick Sort", "Selection Sort", "Insertion Sort"], correct: 1, unit: "Basics", subtopic: "Big-O notation" },

        { text: "Which data structure is used for Breadth First Search (BFS)?", type: "mcq", options: ["Stack", "Queue", "Array", "Linked List"], correct: 1, unit: "Graphs", subtopic: "BFS" },

        { text: "Which data structure is used for Depth First Search (DFS)?", type: "mcq", options: ["Queue", "Stack", "Tree", "Array"], correct: 1, unit: "Graphs", subtopic: "DFS" },

        { text: "What is the worst-case time complexity of Bubble Sort?", type: "mcq", options: ["O(n log n)", "O(n)", "O(n\u00B2)", "O(log n)"], correct: 2, unit: "Basics", subtopic: "Time complexity" },

        { text: "Which data structure allows insertion and deletion from both ends?", type: "mcq", options: ["Queue", "Stack", "Deque", "Array"], correct: 2, unit: "Queue", subtopic: "Deque" },

        { text: "What is a circular queue?", type: "mcq", options: ["Queue with circular memory", "Queue where last element connects to first", "Queue with two ends", "Queue with unlimited size"], correct: 1, unit: "Queue", subtopic: "Circular queue" },

        { text: "Which tree is used in database indexing?", type: "mcq", options: ["Binary Tree", "AVL Tree", "B-Tree", "Heap"], correct: 2, unit: "Trees", subtopic: "AVL tree" },

        { text: "Which sorting algorithm repeatedly selects the smallest element?", type: "mcq", options: ["Bubble Sort", "Selection Sort", "Quick Sort", "Merge Sort"], correct: 1, unit: "Basics", subtopic: "Big-O notation" }

    ],

    "Computer Organization": [

        { text: "Computer organization deals with:", type: "mcq", options: ["Physical components of computer", "Logical structure and functional behavior of a computer", "Programming languages", "Software development"], correct: 1, unit: "CPU Architecture", subtopic: "Control unit" },

        { text: "The brain of the computer is:", type: "mcq", options: ["RAM", "CPU", "Hard Disk", "Monitor"], correct: 1, unit: "CPU Architecture", subtopic: "ALU" },

        { text: "CPU stands for:", type: "mcq", options: ["Central Processing Unit", "Computer Processing Unit", "Central Program Unit", "Control Processing Unit"], correct: 0, unit: "CPU Architecture", subtopic: "ALU" },

        { text: "The CPU consists of:", type: "mcq", options: ["ALU and Control Unit", "RAM and ROM", "Hard Disk and Cache", "Input and Output"], correct: 0, unit: "CPU Architecture", subtopic: "ALU" },

        { text: "ALU stands for:", type: "mcq", options: ["Arithmetic Logic Unit", "Algorithm Logic Unit", "Arithmetic Linear Unit", "Automatic Logic Unit"], correct: 0, unit: "CPU Architecture", subtopic: "ALU" },

        { text: "Which memory is volatile?", type: "mcq", options: ["ROM", "Hard Disk", "RAM", "CD-ROM"], correct: 2, unit: "Memory", subtopic: "RAM" },

        { text: "Which memory is non-volatile?", type: "mcq", options: ["RAM", "Cache", "ROM", "Register"], correct: 2, unit: "Memory", subtopic: "RAM" },

        { text: "The fastest memory in a computer is:", type: "mcq", options: ["Cache", "RAM", "Register", "Hard Disk"], correct: 2, unit: "Memory", subtopic: "Cache" },

        { text: "Cache memory is used to:", type: "mcq", options: ["Store permanent data", "Increase CPU speed", "Replace RAM", "Store programs"], correct: 1, unit: "Memory", subtopic: "Cache" },

        { text: "Which register holds the address of the next instruction?", type: "mcq", options: ["MAR", "PC (Program Counter)", "IR", "ACC"], correct: 1, unit: "CPU Architecture", subtopic: "Registers" },

        { text: "Which register stores the instruction currently being executed?", type: "mcq", options: ["IR (Instruction Register)", "PC", "MAR", "MDR"], correct: 0, unit: "CPU Architecture", subtopic: "Registers" },

        { text: "Which bus carries data between components?", type: "mcq", options: ["Address Bus", "Data Bus", "Control Bus", "Memory Bus"], correct: 1, unit: "I/O Systems", subtopic: "DMA" },

        { text: "Which bus carries memory addresses?", type: "mcq", options: ["Data Bus", "Control Bus", "Address Bus", "Instruction Bus"], correct: 2, unit: "I/O Systems", subtopic: "Interrupts" },

        { text: "The Control Unit is responsible for:", type: "mcq", options: ["Performing calculations", "Storing data", "Controlling operations of the CPU", "Displaying output"], correct: 2, unit: "CPU Architecture", subtopic: "Control unit" },

        { text: "The Fetch-Decode-Execute cycle is also called:", type: "mcq", options: ["Instruction Cycle", "Data Cycle", "Memory Cycle", "Bus Cycle"], correct: 0, unit: "Instruction Set", subtopic: "Instruction cycle" },

        { text: "Which memory is closest to the CPU?", type: "mcq", options: ["Cache", "RAM", "Hard Disk", "Optical Disk"], correct: 0, unit: "Memory", subtopic: "Cache" },

        { text: "Secondary memory is also called:", type: "mcq", options: ["Main memory", "Primary memory", "Auxiliary memory", "Cache memory"], correct: 2, unit: "Memory", subtopic: "Virtual memory" },

        { text: "Which device is an input device?", type: "mcq", options: ["Printer", "Monitor", "Keyboard", "Speaker"], correct: 2, unit: "I/O Systems", subtopic: "Interrupts" },

        { text: "Which device is an output device?", type: "mcq", options: ["Mouse", "Keyboard", "Monitor", "Scanner"], correct: 2, unit: "I/O Systems", subtopic: "Interrupts" },

        { text: "Which memory type is used for permanent storage?", type: "mcq", options: ["RAM", "Cache", "Hard Disk", "Register"], correct: 2, unit: "Memory", subtopic: "Virtual memory" },

        { text: "Which number system is used internally by computers?", type: "mcq", options: ["Decimal", "Binary", "Octal", "Hexadecimal"], correct: 1, unit: "Number Systems", subtopic: "Binary" },

        { text: "One byte equals:", type: "mcq", options: ["4 bits", "6 bits", "8 bits", "16 bits"], correct: 2, unit: "Number Systems", subtopic: "Binary" },

        { text: "A bit stands for:", type: "mcq", options: ["Binary digit", "Binary unit", "Basic input terminal", "Byte information transfer"], correct: 0, unit: "Number Systems", subtopic: "Binary" },

        { text: "Which memory is used during program execution?", type: "mcq", options: ["RAM", "ROM", "Hard Disk", "DVD"], correct: 0, unit: "Memory", subtopic: "RAM" },

        { text: "The set of instructions that a CPU can execute is called:", type: "mcq", options: ["Instruction Set", "Program Code", "Control Word", "Memory Set"], correct: 0, unit: "Instruction Set", subtopic: "Addressing modes" }

    ],

    "Machine Learning": [

        { text: "What is Machine Learning?", type: "mcq", options: ["A type of hardware", "A subset of Artificial Intelligence that allows systems to learn from data", "A database system", "A programming language"], correct: 1, unit: "ML Basics", subtopic: "Definition and types" },

        { text: "Machine Learning is a subset of:", type: "mcq", options: ["Data Science", "Artificial Intelligence", "Cloud Computing", "Networking"], correct: 1, unit: "ML Basics", subtopic: "Definition and types" },

        { text: "Which type of learning uses labeled data?", type: "mcq", options: ["Unsupervised Learning", "Reinforcement Learning", "Supervised Learning", "Semi Learning"], correct: 2, unit: "Supervised Learning", subtopic: "Classification" },

        { text: "Which type of learning uses unlabeled data?", type: "mcq", options: ["Supervised Learning", "Unsupervised Learning", "Reinforcement Learning", "Deep Learning"], correct: 1, unit: "Unsupervised Learning", subtopic: "Clustering" },

        { text: "Which algorithm is commonly used for classification?", type: "mcq", options: ["Linear Regression", "K-Nearest Neighbors", "PCA", "K-Means"], correct: 1, unit: "Supervised Learning", subtopic: "Classification" },

        { text: "Which algorithm is used for clustering?", type: "mcq", options: ["Logistic Regression", "Decision Tree", "K-Means", "Naive Bayes"], correct: 2, unit: "Unsupervised Learning", subtopic: "Clustering" },

        { text: "What is the purpose of training data?", type: "mcq", options: ["To evaluate the model", "To train the machine learning model", "To delete data", "To store data"], correct: 1, unit: "ML Basics", subtopic: "Training and testing" },

        { text: "Which algorithm is used for regression?", type: "mcq", options: ["Linear Regression", "K-Means", "Apriori", "DBSCAN"], correct: 0, unit: "Supervised Learning", subtopic: "Regression" },

        { text: "What is overfitting?", type: "mcq", options: ["Model performs well on training data but poorly on new data", "Model performs poorly on training data", "Model ignores data", "Model has fewer parameters"], correct: 0, unit: "Model Evaluation", subtopic: "Overfitting and underfitting" },

        { text: "What is underfitting?", type: "mcq", options: ["Model fits data perfectly", "Model fails to capture patterns in the data", "Model uses too much data", "Model trains too slowly"], correct: 1, unit: "Model Evaluation", subtopic: "Overfitting and underfitting" },

        { text: "Which algorithm is based on probability?", type: "mcq", options: ["Naive Bayes", "K-Means", "Decision Tree", "KNN"], correct: 0, unit: "Supervised Learning", subtopic: "Classification" },

        { text: "Which algorithm uses distance calculation?", type: "mcq", options: ["KNN", "Decision Tree", "Logistic Regression", "SVM"], correct: 0, unit: "Supervised Learning", subtopic: "Classification" },

        { text: "Which algorithm creates a tree-like structure?", type: "mcq", options: ["KNN", "Decision Tree", "Linear Regression", "K-Means"], correct: 1, unit: "Supervised Learning", subtopic: "Classification" },

        { text: "Which technique reduces the number of features?", type: "mcq", options: ["Clustering", "Dimensionality Reduction", "Classification", "Regression"], correct: 1, unit: "Unsupervised Learning", subtopic: "Dimensionality reduction" },

        { text: "Which algorithm is used for dimensionality reduction?", type: "mcq", options: ["PCA", "KNN", "K-Means", "Decision Tree"], correct: 0, unit: "Unsupervised Learning", subtopic: "Dimensionality reduction" },

        { text: "Which learning type involves reward and punishment?", type: "mcq", options: ["Supervised Learning", "Unsupervised Learning", "Reinforcement Learning", "Deep Learning"], correct: 2, unit: "Deep Learning & Reinforcement", subtopic: "Reinforcement learning" },

        { text: "Which metric is used for classification accuracy?", type: "mcq", options: ["Mean Squared Error", "Accuracy", "RMSE", "Variance"], correct: 1, unit: "Model Evaluation", subtopic: "Metrics" },

        { text: "What is a feature in machine learning?", type: "mcq", options: ["Output value", "Input variable", "Algorithm", "Model type"], correct: 1, unit: "ML Basics", subtopic: "Features and labels" },

        { text: "What is a label?", type: "mcq", options: ["Input data", "Output value", "Algorithm", "Feature"], correct: 1, unit: "ML Basics", subtopic: "Features and labels" },

        { text: "Which algorithm separates classes using a hyperplane?", type: "mcq", options: ["Decision Tree", "K-Means", "Support Vector Machine", "Naive Bayes"], correct: 2, unit: "Supervised Learning", subtopic: "Classification" },

        { text: "What does ML model evaluation measure?", type: "mcq", options: ["Hardware speed", "Model performance", "Data storage", "Network traffic"], correct: 1, unit: "Model Evaluation", subtopic: "Metrics" },

        { text: "Which of the following is a deep learning model?", type: "mcq", options: ["Decision Tree", "Neural Network", "KNN", "Linear Regression"], correct: 1, unit: "Deep Learning & Reinforcement", subtopic: "Neural networks" },

        { text: "Which library is commonly used for machine learning in Python?", type: "mcq", options: ["NumPy", "Scikit-learn", "TensorFlow", "All of the above"], correct: 3, unit: "ML Basics", subtopic: "Training and testing" },

        { text: "What does dataset splitting involve?", type: "mcq", options: ["Dividing data into training and testing sets", "Deleting data", "Compressing data", "Encrypting data"], correct: 0, unit: "Model Evaluation", subtopic: "Overfitting and underfitting" },

        { text: "Which model predicts continuous values?", type: "mcq", options: ["Classification model", "Regression model", "Clustering model", "Reinforcement model"], correct: 1, unit: "Supervised Learning", subtopic: "Regression" }

    ]

};



let mtQuestions = [];

let mtAnswers = {};

let mtCurrentIndex = 0;

let mtTimerInterval = null;

let mtTimeLeft = 0;

let mtStartTime = null;

let mtConfig = {};

let mtSelectedSubject = '';

let mtMarkedForReview = new Set();

let mtUploadedQuestions = null;

let mtUploadedSubject = '';

let mtSelectedFile = null;



// Navigate from dashboard subject cards to mock test with pre-selected subject

function goToMockTest(subject) {

    switchPage('mocktest');

    // Auto-select the subject card

    setTimeout(() => {

        document.querySelectorAll('.mt-subject-card').forEach(c => c.classList.remove('selected'));

        const targetCard = document.querySelector(`.mt-subject-card[data-subject="${subject}"]`);

        if (targetCard) {

            targetCard.classList.add('selected');

            mtSelectedSubject = subject;

            const configBar = document.getElementById('mtConfigBar');

            configBar.style.display = '';

            document.getElementById('mtSelectedSubjectName').textContent = subject;

            configBar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        }

    }, 100);

}



function initMockTestPage() {

    // Subject card click handlers

    document.querySelectorAll('.mt-subject-card').forEach(card => {

        card.addEventListener('click', () => {

            document.querySelectorAll('.mt-subject-card').forEach(c => c.classList.remove('selected'));

            card.classList.add('selected');

            mtSelectedSubject = card.getAttribute('data-subject');

            mtUploadedQuestions = null; // Clear any uploaded questions

            const configBar = document.getElementById('mtConfigBar');

            configBar.style.display = '';

            document.getElementById('mtSelectedSubjectName').textContent = mtSelectedSubject;

            configBar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        });

    });

    // Setup drag-and-drop

    mtInitDragDrop();

    // Reset to setup view

    mtShowPanel('setup');

}



// ==================== TAB SWITCHING ====================

function mtSwitchTab(tab) {

    document.querySelectorAll('.mt-tab').forEach(t => t.classList.remove('active'));

    document.querySelector(`.mt-tab[data-tab="${tab}"]`).classList.add('active');

    document.getElementById('mtTabSubjects').style.display = tab === 'subjects' ? 'block' : 'none';

    document.getElementById('mtTabUpload').style.display = tab === 'upload' ? 'block' : 'none';

}



// ==================== DRAG & DROP + FILE HANDLING ====================

function mtInitDragDrop() {

    const zone = document.getElementById('mtDropZone');

    if (!zone) return;

    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });

    zone.addEventListener('dragleave', () => { zone.classList.remove('dragover'); });

    zone.addEventListener('drop', (e) => {

        e.preventDefault();

        zone.classList.remove('dragover');

        const file = e.dataTransfer.files[0];

        if (file) mtProcessFile(file);

    });

}



function mtHandleFileSelect(event) {

    const file = event.target.files[0];

    if (file) mtProcessFile(file);

}



function mtProcessFile(file) {

    const allowed = ['pdf', 'docx', 'txt'];

    const ext = file.name.split('.').pop().toLowerCase();

    if (!allowed.includes(ext)) {

        showAlert('Invalid file type. Please upload PDF, DOCX, or TXT.', 'danger');

        return;

    }

    if (file.size > 10 * 1024 * 1024) {

        showAlert('File too large. Maximum size is 10MB.', 'danger');

        return;

    }

    mtSelectedFile = file;

    document.getElementById('mtFileName').textContent = file.name;

    document.getElementById('mtFileSize').textContent = (file.size / 1024).toFixed(1) + ' KB';

    document.getElementById('mtFileInfo').style.display = 'flex';

    document.querySelector('.mt-upload-zone-inner').style.display = 'none';

    // Clear text area since file is selected

    document.getElementById('mtSyllabusText').value = '';

}



function mtRemoveFile() {

    mtSelectedFile = null;

    document.getElementById('mtFileInput').value = '';

    document.getElementById('mtFileInfo').style.display = 'none';

    document.querySelector('.mt-upload-zone-inner').style.display = '';

}



// ==================== SUBMIT SYLLABUS ====================

async function mtSubmitSyllabus() {

    const textContent = document.getElementById('mtSyllabusText').value.trim();

    if (!mtSelectedFile && !textContent) {
        showAlert('Please upload a file or paste your syllabus text.', 'danger');
        return;
    }

    if (!mtSelectedFile && textContent.length < 20) {
        showAlert('Syllabus text is too short. Please provide at least 20 characters.', 'danger');
        return;
    }



    // Show loading

    const statusEl = document.getElementById('mtUploadStatus');

    const btn = document.getElementById('mtGenerateBtn');

    statusEl.style.display = 'flex';

    btn.disabled = true;

    document.getElementById('mtUploadStatusText').textContent = 'Analyzing syllabus and generating questions...';



    try {

        const token = localStorage.getItem('token');

        let res;



        if (mtSelectedFile) {

            // File upload via FormData

            const formData = new FormData();

            formData.append('file', mtSelectedFile);

            res = await fetch(`${API_BASE_URL}/api/mock-test/upload-syllabus`, {

                method: 'POST',

                headers: { 'Authorization': `Bearer ${token}` },

                body: formData

            });

        } else {

            // Text paste via JSON

            res = await fetch(`${API_BASE_URL}/api/mock-test/upload-syllabus`, {

                method: 'POST',

                headers: {

                    'Content-Type': 'application/json',

                    'Authorization': `Bearer ${token}`

                },

                body: JSON.stringify({ text: textContent })

            });

        }



        const data = await res.json();



        if (!res.ok) {

            showAlert(data.error || 'Failed to generate questions.', 'danger');

            statusEl.style.display = 'none';

            btn.disabled = false;

            return;

        }



        // Store the uploaded questions and start test

        mtUploadedQuestions = data.questions;

        mtUploadedSubject = data.subject || 'Custom Subject';

        mtSelectedSubject = mtUploadedSubject;



        statusEl.style.display = 'none';

        btn.disabled = false;



        showAlert(`Generated ${data.questions.length} questions for "${mtUploadedSubject}". Starting test...`, 'success');



        // Start test with uploaded questions after a brief delay

        const timeLimit = parseInt(document.getElementById('mtUploadTimeLimit').value) || 60;

        setTimeout(() => startMockTest(timeLimit), 800);



    } catch (e) {

        showAlert('Network error. Please try again.', 'danger');

        statusEl.style.display = 'none';

        btn.disabled = false;

    }

}



function mtShowPanel(panel) {

    document.getElementById('mtSetup').style.display = panel === 'setup' ? 'block' : 'none';

    document.getElementById('mtQuiz').style.display = panel === 'quiz' ? 'block' : 'none';

    document.getElementById('mtResults').style.display = panel === 'results' ? 'block' : 'none';

}



async function startMockTest(overrideTimeLimit) {

    if (!mtSelectedSubject) {

        showAlert('Please select a subject.', 'danger');

        return;

    }



    let questionsToUse;



    if (mtUploadedQuestions && mtUploadedQuestions.length > 0) {

        // Use questions generated from uploaded syllabus

        questionsToUse = mtUploadedQuestions;

    } else {

        // Use preloaded questions

        const preloaded = PRELOADED_QUESTIONS[mtSelectedSubject];

        if (!preloaded || preloaded.length === 0) {

            showAlert('No questions available for this subject.', 'danger');

            return;

        }

        questionsToUse = preloaded;

    }



    const timeLimit = overrideTimeLimit || parseInt(document.getElementById('mtTimeLimit').value) || 60;

    mtConfig = { subject: mtSelectedSubject, count: questionsToUse.length, timeLimit };



    // Shuffle questions for variety (Fisher-Yates)

    const shuffled = [...questionsToUse];

    for (let i = shuffled.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];

    }



    mtQuestions = shuffled;

    mtAnswers = {};

    mtCurrentIndex = 0;

    mtStartTime = Date.now();

    mtMarkedForReview = new Set();



    // Setup quiz UI

    document.getElementById('mtQuizSubject').textContent = mtSelectedSubject;

    mtShowPanel('quiz');

    renderMockTestQuestion();

    buildQuestionList();

    startMockTestTimer(timeLimit);

}



function buildQuestionList() {

    const listContainer = document.getElementById('mtQuestionList');

    listContainer.innerHTML = '';

    mtQuestions.forEach((_, idx) => {

        const btn = document.createElement('button');

        btn.className = 'mt-ql-btn';

        btn.textContent = idx + 1;

        btn.onclick = () => mtNavigateTo(idx);

        listContainer.appendChild(btn);

    });

    updateQuestionListState();

}



function updateQuestionListState() {

    const btns = document.querySelectorAll('#mtQuestionList .mt-ql-btn');

    btns.forEach((btn, idx) => {

        btn.classList.remove('current', 'answered', 'review');

        if (idx === mtCurrentIndex) btn.classList.add('current');

        else if (mtMarkedForReview.has(idx)) btn.classList.add('review');

        else if (mtAnswers[idx] !== undefined) btn.classList.add('answered');

    });

    // Update Mark for Review button text

    const reviewBtn = document.getElementById('mtMarkReviewBtn');

    if (reviewBtn) {

        if (mtMarkedForReview.has(mtCurrentIndex)) {

            reviewBtn.innerHTML = '<i class="fas fa-flag me-1"></i> Unmark Review';

            reviewBtn.classList.add('active');

        } else {

            reviewBtn.innerHTML = '<i class="fas fa-flag me-1"></i> Mark for Review';

            reviewBtn.classList.remove('active');

        }

    }

}



function renderMockTestQuestion() {

    const q = mtQuestions[mtCurrentIndex];

    if (!q) return;



    document.getElementById('mtQuestionNum').textContent = `Question ${mtCurrentIndex + 1}`;

    document.getElementById('mtQuestionPoints').textContent = `${q.unit || ''}`;

    document.getElementById('mtQuestionText').textContent = q.text;



    // Render MCQ options

    const optionsContainer = document.getElementById('mtOptions');

    optionsContainer.innerHTML = '';

    const labels = ['A', 'B', 'C', 'D'];

    q.options.forEach((opt, idx) => {

        const btn = document.createElement('div');

        btn.className = 'mt-option' + (mtAnswers[mtCurrentIndex] === idx ? ' selected' : '');

        const optText = opt.replace(/^[A-D]\)\s*/, '');

        btn.innerHTML = `<input type="radio" name="mtOpt" value="${idx}" ${mtAnswers[mtCurrentIndex] === idx ? 'checked' : ''}> <span><strong>${labels[idx]})</strong> ${optText}</span>`;

        btn.onclick = () => {

            mtAnswers[mtCurrentIndex] = idx;

            renderMockTestQuestion();

            updateQuestionListState();

        };

        optionsContainer.appendChild(btn);

    });



    // Progress

    document.getElementById('mtCounter').textContent = `Question ${mtCurrentIndex + 1} of ${mtQuestions.length}`;

    document.getElementById('mtProgressFill').style.width = `${((mtCurrentIndex + 1) / mtQuestions.length) * 100}%`;



    updateQuestionListState();

}



function mtNavigate(dir) {

    if (!mtQuestions.length) return;

    mtCurrentIndex += dir;

    if (mtCurrentIndex < 0) mtCurrentIndex = 0;

    if (mtCurrentIndex >= mtQuestions.length) mtCurrentIndex = mtQuestions.length - 1;

    renderMockTestQuestion();

}



function mtNavigateTo(idx) {

    if (idx >= 0 && idx < mtQuestions.length) {

        mtCurrentIndex = idx;

        renderMockTestQuestion();

    }

}



function mtSaveAndNext() {

    // Save current answer (already saved on click) and go to next

    if (mtCurrentIndex < mtQuestions.length - 1) {

        mtCurrentIndex++;

        renderMockTestQuestion();

    } else {

        // On last question, wrap to first unanswered or stay

        renderMockTestQuestion();

    }

}



function mtMarkForReview() {

    if (mtMarkedForReview.has(mtCurrentIndex)) {

        mtMarkedForReview.delete(mtCurrentIndex);

    } else {

        mtMarkedForReview.add(mtCurrentIndex);

    }

    // Move to next question

    if (mtCurrentIndex < mtQuestions.length - 1) {

        mtCurrentIndex++;

    }

    renderMockTestQuestion();

}



function startMockTestTimer(minutes) {

    mtTimeLeft = minutes * 60; // seconds

    updateMockTestTimerDisplay();

    if (mtTimerInterval) clearInterval(mtTimerInterval);

    mtTimerInterval = setInterval(() => {

        mtTimeLeft--;

        updateMockTestTimerDisplay();

        if (mtTimeLeft <= 0) {

            clearInterval(mtTimerInterval);

            submitMockTest();

        }

    }, 1000);

}



function updateMockTestTimerDisplay() {

    const mins = Math.floor(mtTimeLeft / 60);

    const secs = mtTimeLeft % 60;

    document.getElementById('mtTimeRemaining').textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

}



async function submitMockTest() {

    clearInterval(mtTimerInterval);



    const timeTaken = mtStartTime ? Math.round((Date.now() - mtStartTime) / 60000) : 0;



    // Build answers map

    const answersMap = {};

    for (const [idx, val] of Object.entries(mtAnswers)) {

        answersMap[String(idx)] = val;

    }



    // Show loading

    mtShowPanel('results');

    document.getElementById('mtResults').innerHTML = '<div class="mt-loading"><div class="mt-loading-spinner"></div><p>Analyzing your results...</p></div>';



    try {

        const token = localStorage.getItem('token');

        const res = await fetch(`${API_BASE_URL}/api/mock-test/submit`, {

            method: 'POST',

            headers: {

                'Content-Type': 'application/json',

                'Authorization': `Bearer ${token}`

            },

            body: JSON.stringify({

                subject: mtConfig.subject,

                answers: answersMap,

                questions: mtQuestions,

                time_taken: timeTaken

            })

        });

        const data = await res.json();



        if (!res.ok) {

            showAlert(data.error || 'Failed to submit test.', 'danger');

            mtShowPanel('setup');

            return;

        }



        renderMockTestResults(data, timeTaken);



        // Async fetch AI tips

        fetchAITips(data);



    } catch (e) {

        showAlert('Network error submitting test.', 'danger');

        mtShowPanel('setup');

    }

}



function renderMockTestResults(data, timeTaken) {

    const { percentage, student_level, score, total, per_unit_breakdown, roadmap } = data;



    // Build results HTML

    const levelClass = `level-${student_level.toLowerCase()}`;

    const weakCount = (per_unit_breakdown || []).filter(u => u.status === 'weak' || u.status === 'needs-work').length;



    // Level descriptions

    const levelDescriptions = {

        'Expert': 'Outstanding! You have mastered this subject!',

        'Advanced': 'Great job! You have strong understanding.',

        'Intermediate': 'Good foundation! Some areas need more attention.',

        'Beginner': 'Keep going! Focus on the roadmap below.',

        'Critical': 'Don\'t worry! Everyone starts somewhere. Follow the roadmap.'

    };



    let html = `

        <!-- Result Hero -->

        <div class="mt-result-hero" id="mtResultHero">

            <div class="mt-score-circle">

                <div class="mt-score-value" id="mtScoreValue">${Math.round(percentage)}%</div>

            </div>

            <div class="mt-level-badge ${levelClass}" id="mtLevelBadge">

                <i class="fas fa-medal"></i>

                <span id="mtLevelText">${student_level}</span>

            </div>

            <h3 id="mtResultTitle">${data.subject} - Test Complete!</h3>

            <p id="mtResultSubtitle">${levelDescriptions[student_level] || 'Test submitted successfully.'}</p>

        </div>



        <!-- Stats Row -->

        <div class="mt-result-stats">

            <div class="mt-stat-item">

                <div class="mt-stat-icon">✅</div>

                <div class="mt-stat-value" id="mtStatCorrect">${score}</div>

                <div class="mt-stat-label">Correct</div>

            </div>

            <div class="mt-stat-item">

                <div class="mt-stat-icon">📝</div>

                <div class="mt-stat-value" id="mtStatTotal">${total}</div>

                <div class="mt-stat-label">Total Questions</div>

            </div>

            <div class="mt-stat-item">

                <div class="mt-stat-icon">⚠️</div>

                <div class="mt-stat-value" id="mtStatWeak">${weakCount}</div>

                <div class="mt-stat-label">Weak Units</div>

            </div>

            <div class="mt-stat-item">

                <div class="mt-stat-icon">⏱️</div>

                <div class="mt-stat-value" id="mtStatTime">${timeTaken} min</div>

                <div class="mt-stat-label">Time Taken</div>

            </div>

        </div>

    `;



    // Per-Unit Breakdown

    if (per_unit_breakdown && per_unit_breakdown.length > 0) {

        html += `

            <div class="mt-analysis-section" id="mtUnitBreakdownSection">

                <h4><i class="fas fa-chart-bar me-2"></i>Unit-wise Performance</h4>

                <div class="mt-unit-breakdown" id="mtUnitBreakdown">

        `;

        per_unit_breakdown.forEach(unit => {

            const barClass = `bar-${unit.status}`;

            const accClass = `acc-${unit.status}`;

            const badgeClass = `badge-${unit.status}`;

            const statusLabel = unit.status === 'needs-work' ? 'Needs Work' : unit.status.charAt(0).toUpperCase() + unit.status.slice(1);

            html += `

                <div class="mt-unit-card status-${unit.status}">

                    <div class="mt-unit-info">

                        <div class="mt-unit-name">${unit.unit}</div>

                        <div class="mt-unit-stats">${unit.correct}/${unit.total} correct</div>

                    </div>

                    <div class="mt-unit-bar-wrap">

                        <div class="mt-unit-bar-fill ${barClass}" style="width: ${unit.accuracy}%"></div>

                    </div>

                    <div class="mt-unit-accuracy ${accClass}">${unit.accuracy}%</div>

                    <span class="mt-unit-status-badge ${badgeClass}">${statusLabel}</span>

                </div>

            `;

        });

        html += `</div></div>`;

    }



    // Personalized Roadmap

    if (roadmap && roadmap.length > 0) {

        html += `

            <div class="mt-roadmap-section" id="mtRoadmapSection">

                <h4><i class="fas fa-map me-2"></i>Your Personalized Learning Roadmap</h4>

                <p class="mt-roadmap-subtitle">Topics are ordered by priority. Focus on <span style="color:#ef4444;">weak</span> areas first, then <span style="color:#f59e0b;">needs work</span>, then <span style="color:#94a3b8;">untested</span>.</p>

                <div class="mt-roadmap-content" id="mtRoadmapContent">

        `;

        roadmap.forEach((unit, idx) => {

            const statusIcons = { 'weak': 'âŒ', 'needs-work': '⚠️', 'mastered': '✅', 'untested': '⬜' };

            const subtopicIcons = { 'mastered': 'fas fa-check-circle', 'needs-work': 'fas fa-exclamation-circle', 'weak': 'fas fa-times-circle', 'untested': 'far fa-circle' };

            const subtopicIconClasses = { 'mastered': 'icon-mastered', 'needs-work': 'icon-needs-work', 'weak': 'icon-weak', 'untested': 'icon-untested' };



            let subtopicsHtml = '';

            if (unit.subtopics && unit.subtopics.length > 0) {

                subtopicsHtml = '<ul class="mt-subtopic-list">';

                unit.subtopics.forEach(st => {

                    const iconClass = subtopicIcons[st.status] || 'far fa-circle';

                    const colorClass = subtopicIconClasses[st.status] || 'icon-untested';

                    subtopicsHtml += `

                        <li class="mt-subtopic-item">

                            <i class="${iconClass} mt-subtopic-icon ${colorClass}"></i>

                            <span>${st.name}</span>

                        </li>

                    `;

                });

                subtopicsHtml += '</ul>';

            }



            const statusLabel = unit.status === 'needs-work' ? 'Needs Work' : unit.status.charAt(0).toUpperCase() + unit.status.slice(1);

            const accText = unit.accuracy > 0 ? `${unit.accuracy}% accuracy` : 'Not tested';



            html += `

                <div class="mt-roadmap-unit" data-unit-idx="${idx}">

                    <div class="mt-roadmap-unit-header" onclick="toggleRoadmapUnit(${idx})">

                        <span class="mt-roadmap-unit-step step-${unit.status}">${idx + 1}</span>

                        <div class="mt-roadmap-unit-info">

                            <div class="mt-roadmap-unit-name">${statusIcons[unit.status] || ''} ${unit.unit}</div>

                            <div class="mt-roadmap-unit-meta">

                                <span class="mt-roadmap-unit-hours">${unit.recommended_hours} hrs recommended</span>

                                <span class="mt-roadmap-unit-accuracy">${accText}</span>

                            </div>

                        </div>

                        <span class="mt-unit-status-badge badge-${unit.status}">${statusLabel}</span>

                        <i class="fas fa-chevron-down mt-roadmap-unit-toggle"></i>

                    </div>

                    <div class="mt-roadmap-unit-body">

                        ${subtopicsHtml}

                        <div class="mt-roadmap-unit-tip" id="mtTip_${idx}">

                            💡 ${unit.status === 'mastered' ? 'Great work! Review occasionally to maintain mastery.' : `Focus on understanding core concepts in ${unit.unit}. Practice with examples daily.`}

                        </div>

                    </div>

                </div>

            `;

        });

        html += `</div></div>`;

    }



    // AI Tips placeholder

    html += `<div class="mt-tips-section" id="mtTipsSection" style="display:none;"><h4><i class="fas fa-lightbulb me-2"></i>AI Study Tips</h4><div class="mt-tips-content" id="mtTipsContent"></div></div>`;



    // Actions

    html += `

        <div class="mt-result-actions">

            <button class="btn btn-primary" onclick="retakeMockTest()">

                <i class="fas fa-redo"></i> Retake Test

            </button>

            <button class="btn btn-secondary" onclick="backToMockTestSetup()">

                <i class="fas fa-home"></i> Back to Subjects

            </button>

        </div>

    `;



    document.getElementById('mtResults').innerHTML = html;

}



function toggleRoadmapUnit(idx) {

    const unit = document.querySelector(`.mt-roadmap-unit[data-unit-idx="${idx}"]`);

    if (unit) unit.classList.toggle('open');

}



async function fetchAITips(data) {

    try {

        const token = localStorage.getItem('token');

        const res = await fetch(`${API_BASE_URL}/api/mock-test/roadmap`, {

            method: 'POST',

            headers: {

                'Content-Type': 'application/json',

                'Authorization': `Bearer ${token}`

            },

            body: JSON.stringify({

                subject: data.subject,

                student_level: data.student_level,

                per_unit_breakdown: data.per_unit_breakdown

            })

        });

        const tips = await res.json();



        if (tips.success && tips.tips) {

            const tipsSection = document.getElementById('mtTipsSection');

            const tipsContent = document.getElementById('mtTipsContent');

            if (tipsSection && tipsContent) {

                let tipsHtml = '';

                if (tips.motivation) {

                    tipsHtml += `<div class="mt-tip-card"><div class="mt-tip-icon">🎯</div><div><div class="mt-tip-title">Motivation</div><div class="mt-tip-text">${tips.motivation}</div></div></div>`;

                }

                for (const [unitName, tip] of Object.entries(tips.tips)) {

                    tipsHtml += `<div class="mt-tip-card"><div class="mt-tip-icon">📖</div><div><div class="mt-tip-title">${unitName}</div><div class="mt-tip-text">${tip}</div></div></div>`;

                    // Also inject into roadmap unit tip

                    const roadmapUnits = document.querySelectorAll('.mt-roadmap-unit');

                    roadmapUnits.forEach(ru => {

                        const nameEl = ru.querySelector('.mt-roadmap-unit-name');

                        if (nameEl && nameEl.textContent.includes(unitName)) {

                            const tipEl = ru.querySelector('.mt-roadmap-unit-tip');

                            if (tipEl) tipEl.innerHTML = `💡 ${tip}`;

                        }

                    });

                }

                tipsContent.innerHTML = tipsHtml;

                tipsSection.style.display = '';

            }

        }

    } catch (e) {

        // Silent fail - tips are optional enhancement

    }

}



function retakeMockTest() {

    mtShowPanel('setup');

    // Restore results container HTML structure

    document.getElementById('mtResults').innerHTML = '<div class="mt-loading"><p>Loading...</p></div>';

}



function backToMockTestSetup() {

    clearInterval(mtTimerInterval);

    mtUploadedQuestions = null;

    mtSelectedFile = null;

    mtShowPanel('setup');

    document.getElementById('mtResults').innerHTML = '<div class="mt-loading"><p>Loading...</p></div>';

}



function quitMockTest() {

    clearInterval(mtTimerInterval);

    mtShowPanel('setup');

}



// Initialize Mock Test page when loaded

if (document.getElementById('page-mocktest')) {

    initMockTestPage();

}

