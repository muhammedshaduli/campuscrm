/**
 * CALVIZ CAMPUSCRM - CORE SCRIPT
 * Production-ready API Integration & Admissions Logic
 */

/* =========================================
   1. CONFIGURATION & STATE
   ========================================= */
const APP_NAME = 'Calviz CampusCRM';
const APP_TITLE = `${APP_NAME} | Admissions Management`;
const DEFAULT_SOURCE_OPTIONS = [
  { id: 'WEBSITE', name: 'Website' },
  { id: 'WALK_IN', name: 'Walk-in' },
  { id: 'WHATSAPP', name: 'WhatsApp' },
  { id: 'INSTAGRAM', name: 'Instagram' },
  { id: 'FACEBOOK_ADS', name: 'Facebook Ads' },
  { id: 'GOOGLE_ADS', name: 'Google Ads' },
  { id: 'REFERRAL', name: 'Referral' }
];

const resolveApiBaseUrl = () => {
  const configuredApiBaseUrl = document.querySelector('meta[name="api-base-url"]')?.content?.trim();
  if (configuredApiBaseUrl) {
    return configuredApiBaseUrl.replace(/\/$/, '');
  }

  const isLocal =
    window.location.protocol === 'file:' ||
    ['', 'localhost', '127.0.0.1'].includes(window.location.hostname);

  return isLocal
    ? 'http://127.0.0.1:5000/api'
    : 'https://api-campuscrm.nextgenvarietex.com/api';
};

const API_BASE_URL = resolveApiBaseUrl();

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'calviz_campuscrm_access_token',
  REFRESH_TOKEN: 'calviz_campuscrm_refresh_token',
  USER: 'calviz_campuscrm_user'
};

const getDefaultMastersState = () => ({
  states: [],
  districts: [],
  colleges: [],
  courses: [],
  counsellors: [],
  sources: DEFAULT_SOURCE_OPTIONS
});

let CURRENT_USER = null;
let MASTERS = getDefaultMastersState();
let LEADS_DATA = [];
let DASHBOARD_STATE = {
  stats: {},
  sourceSummary: [],
  recentActivity: [],
  pipeline: [],
  recentInquiries: [],
  reminders: [],
  counselorPerformance: [],
  topStates: []
};
let ACTIVE_MODAL_ID = null;
let currentLeadView = 'table';

const DEFAULT_AUTHENTICATED_PAGE = 'dashboard';
const LOGIN_PAGE_ID = 'login';
const MODAL_OPEN_CLASS = 'modal-open';
const SIDEBAR_OPEN_CLASS = 'sidebar-open';

const PIPELINE_TONE_COLORS = {
  navy: 'var(--navy)',
  indigo: 'var(--primary)',
  cyan: 'var(--secondary)',
  rose: 'var(--danger)',
  slate: '#64748b',
  emerald: 'var(--success)',
  amber: 'var(--accent)'
};

/* =========================================
   2. API & AUTH HELPERS
   ========================================= */

/**
 * Enhanced Fetch Wrapper for Backend Communication
 */
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    },
    signal: controller.signal
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    clearTimeout(timeoutId);
    
    // Handle Token Expiry (401)
    if (response.status === 401 && endpoint !== '/auth/login') {
      const refreshed = await handleTokenRefresh();
      if (refreshed) {
        return apiRequest(endpoint, options); // Retry with new token
      } else {
        handleLogout();
        throw new Error('Session expired. Please login again.');
      }
    }

    const contentType = response.headers.get('content-type');
    const result = (contentType && contentType.includes('application/json')) ? await response.json() : null;
    
    if (!response.ok) {
      throw new Error((result && result.message) ? result.message : `API request failed with status ${response.status}`);
    }

    return result;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`API Timeout [${endpoint}]`);
      showToast('Request timed out. Please check your connection.', 'error');
    } else {
      console.error(`API Error [${endpoint}]:`, error);
      showToast(error.message, 'error');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Handle JWT Refresh Flow
 */
async function handleTokenRefresh() {
  const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    if (response.ok) {
      const { data } = await response.json();
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Handle User Login
 */
async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const loginBtn = document.getElementById('login-btn');

  try {
    loginBtn.disabled = true;
    loginBtn.innerText = 'Signing in...';
    
    const result = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    const { user, accessToken, refreshToken } = result.data;
    
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    
    CURRENT_USER = user;
    showToast(`Welcome back, ${user.fullName}!`, 'success');
    showAuthenticatedState();
    syncBrowserRoute(DEFAULT_AUTHENTICATED_PAGE, { replace: true });
    await initApp(DEFAULT_AUTHENTICATED_PAGE);
  } catch (error) {
    // Error handled by apiRequest toast
  } finally {
    loginBtn.disabled = false;
    loginBtn.innerText = 'Sign In to Dashboard';
  }
}

/**
 * Handle User Logout
 */
function handleLogout() {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
  
  CURRENT_USER = null;
  MASTERS = getDefaultMastersState();
  LEADS_DATA = [];
  DASHBOARD_STATE = {
    stats: {},
    sourceSummary: [],
    recentActivity: [],
    pipeline: [],
    recentInquiries: [],
    reminders: [],
    counselorPerformance: [],
    topStates: []
  };
  showLoginState();
  syncBrowserRoute(LOGIN_PAGE_ID, { replace: true });
  showToast('Logged out successfully', 'info');
}

function updateUserProfile() {
  if (!CURRENT_USER) return;
  const initals = CURRENT_USER.fullName?.split(' ').map(n=>n[0]).join('') || 'U';
  
  // Sidebar
  const sidebarAvatar = document.getElementById('sidebar-avatar-initials');
  const sidebarName = document.getElementById('sidebar-user-name');
  const sidebarRole = document.getElementById('sidebar-user-role');
  if(sidebarAvatar) sidebarAvatar.innerText = initals;
  if(sidebarName) sidebarName.innerText = CURRENT_USER.fullName;
  if(sidebarRole) sidebarRole.innerText = CURRENT_USER.role;

  // Header
  const headerAvatar = document.getElementById('header-avatar-initials');
  const headerName = document.getElementById('header-user-name');
  if(headerAvatar) headerAvatar.innerText = initals;
  if(headerName) headerName.innerText = CURRENT_USER.fullName;

  // New Link Filtering
  const navUsers = document.getElementById('nav-users');
  if(navUsers) {
    if(['SUPER_ADMIN', 'ADMIN'].includes(CURRENT_USER.role)) {
      navUsers.style.display = 'flex';
    } else {
      navUsers.style.display = 'none';
    }
  }
}

function isHistoryRoutingEnabled() {
  return window.location.protocol !== 'file:';
}

function getKnownPageIds() {
  return Array.from(document.querySelectorAll('.page-content[id]')).map((page) => page.id);
}

function getRoutePageId(pathname = window.location.pathname) {
  if (!isHistoryRoutingEnabled()) {
    return DEFAULT_AUTHENTICATED_PAGE;
  }

  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const slug = normalizedPath.split('/').filter(Boolean).pop() || DEFAULT_AUTHENTICATED_PAGE;
  if (slug === LOGIN_PAGE_ID) {
    return LOGIN_PAGE_ID;
  }

  return getKnownPageIds().includes(slug) ? slug : DEFAULT_AUTHENTICATED_PAGE;
}

function getRoutePathForPage(pageId) {
  if (pageId === LOGIN_PAGE_ID) {
    return '/login';
  }

  return pageId === DEFAULT_AUTHENTICATED_PAGE ? '/dashboard' : `/${pageId}`;
}

function syncBrowserRoute(pageId, { replace = false } = {}) {
  if (!isHistoryRoutingEnabled()) {
    return;
  }

  const targetPath = getRoutePathForPage(pageId);
  if (window.location.pathname === targetPath) {
    return;
  }

  const method = replace ? 'replaceState' : 'pushState';
  window.history[method]({ pageId }, '', targetPath);
}

function showLoginState() {
  document.body.classList.remove(MODAL_OPEN_CLASS, SIDEBAR_OPEN_CLASS);
  document.getElementById('login-overlay').style.display = 'flex';
  document.getElementById('main-app').style.display = 'none';
  closeMobileSidebar();
  closeAllModals();
}

function showAuthenticatedState() {
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('main-app').style.display = 'flex';
}

function getStoredAuthState() {
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const userData = localStorage.getItem(STORAGE_KEYS.USER);

  if (!token || !userData) {
    return null;
  }

  try {
    return {
      token,
      user: JSON.parse(userData)
    };
  } catch (error) {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    return null;
  }
}

function handleRouteChange() {
  const routePage = getRoutePageId();
  const authState = getStoredAuthState();

  if (!authState) {
    CURRENT_USER = null;
    showLoginState();
    syncBrowserRoute(LOGIN_PAGE_ID, { replace: routePage !== LOGIN_PAGE_ID });
    return;
  }

  CURRENT_USER = authState.user;
  showAuthenticatedState();

  const targetPage = routePage === LOGIN_PAGE_ID ? DEFAULT_AUTHENTICATED_PAGE : routePage;
  showPage(targetPage, null, { updateRoute: routePage !== targetPage, replaceRoute: routePage === LOGIN_PAGE_ID });
}

/* =========================================
   3. UI & FEEDBACK UTILS
   ========================================= */

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

function toggleLoader(show) {
  document.getElementById('global-loader').style.display = show ? 'flex' : 'none';
}

/* =========================================
   4. APP INITIALIZATION
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  document.title = APP_TITLE;
  const loginFooter = document.querySelector('.login-footer p');
  if (loginFooter) {
    loginFooter.innerText = '© 2026 Calviz CampusCRM. All rights reserved.';
  }

  bindGlobalUiInteractions();
  window.addEventListener('popstate', handleRouteChange);

  const authState = getStoredAuthState();
  const routePage = getRoutePageId();

  if (authState) {
    CURRENT_USER = authState.user;
    showAuthenticatedState();
    const initialPage = routePage === LOGIN_PAGE_ID ? DEFAULT_AUTHENTICATED_PAGE : routePage;
    syncBrowserRoute(initialPage, { replace: routePage !== initialPage });
    initApp(initialPage);
  } else {
    showLoginState();
    syncBrowserRoute(LOGIN_PAGE_ID, { replace: routePage !== LOGIN_PAGE_ID });
  }
});

async function initApp(targetPage = DEFAULT_AUTHENTICATED_PAGE) {
  toggleLoader(true);
  try {
    updateUserProfile();
    await Promise.all([
      loadMasterData(),
      fetchDashboardData(),
      fetchLeads({ limit: 100 })
    ]);
    populateFormDropdowns();
    showPage(targetPage, null, { updateRoute: false });
  } catch (error) {
    console.error('Failed to initialize app data:', error);
  } finally {
    toggleLoader(false);
  }
}
/* =========================================
   5. DATA FETCHING (API)
   ========================================= */

/**
 * Load Initial Master Data for Dropdowns
 */
async function loadMasterData() {
  try {
    const [statesRes, collegesRes, coursesRes, counsellorsRes] = await Promise.all([
      apiRequest('/masters/states'),
      apiRequest('/masters/colleges'),
      apiRequest('/masters/courses'),
      apiRequest('/masters/counselors')
    ]);

    MASTERS.states = statesRes.data;
    MASTERS.colleges = collegesRes.data;
    MASTERS.courses = coursesRes.data;
    MASTERS.counsellors = counsellorsRes.data;
    
    console.log('✅ Master data loaded');
  } catch (error) {
    console.error('Failed to load masters:', error);
  }
}

/**
 * Fetch and Render Dashboard KPIs
 */
async function fetchDashboardData() {
  try {
    const result = await apiRequest('/dashboard/overview');
    DASHBOARD_STATE = {
      stats: result.data?.stats || {},
      sourceSummary: result.data?.sourceSummary || [],
      recentActivity: result.data?.recentActivity || [],
      pipeline: result.data?.pipeline || [],
      recentInquiries: result.data?.recentInquiries || [],
      reminders: result.data?.reminders || [],
      counselorPerformance: result.data?.counselorPerformance || [],
      topStates: result.data?.topStates || []
    };

    renderDashboard();
  } catch (error) {
    console.error('Dashboard sync failed');
  }
}

function renderDashboard() {
  renderDashboardStats(DASHBOARD_STATE.stats || {});
  renderDashboardPipeline(DASHBOARD_STATE.pipeline || []);
  renderRecentInquiries(DASHBOARD_STATE.recentInquiries || []);
  renderDashboardReminders(DASHBOARD_STATE.reminders || []);
  renderRecentActivity(DASHBOARD_STATE.recentActivity || []);
  renderSourceSummary(DASHBOARD_STATE.sourceSummary || []);
  renderCounselorPerformance(DASHBOARD_STATE.counselorPerformance || []);
  renderTopStates(DASHBOARD_STATE.topStates || []);
}

function renderDashboardStats(stats = {}) {
  const updateKpi = (key, value) => {
    const el = document.querySelector(`.kpi-card[data-kpi="${key}"] .kpi-value`);
    if (el) el.innerText = value ?? 0;
  };

  updateKpi('totalLeads', stats.totalLeads);
  updateKpi('todayLeads', stats.todayLeads);
  updateKpi('confirmedAdmissions', stats.confirmedAdmissions ?? stats.admissionConfirmed);
  updateKpi('notAttendedToday', stats.notAttendedToday ?? stats.todayNotAttended);
  updateKpi('newEnquiries', stats.newEnquiries ?? stats.newEnquiry);
  updateKpi('inCounseling', stats.inCounseling ?? stats.counseling);
  updateKpi('interested', stats.interested);
  updateKpi('notInterested', stats.notInterested);
  
  // Update nav badges using robust attribute selection if possible, otherwise keep selectors
  const invoicesBadge = document.querySelector('.nav-item[onclick*="invoices"] .nav-badge');
  if (invoicesBadge) invoicesBadge.innerText = stats.pendingInvoices || 0;
  
  const admissionsBadge = document.querySelector('.nav-item[onclick*="admissions"] .nav-badge');
  if (admissionsBadge) admissionsBadge.innerText = stats.confirmedAdmissions || 0;
}

function renderEmptyCardState(message) {
  return `<div class="text-sm text-muted empty-state-copy">${message}</div>`;
}

function renderDashboardPipeline(stages) {
  const container = document.getElementById('dashboard-pipeline');
  if (!container) return;

  if (!stages || stages.length === 0) {
    container.innerHTML = renderEmptyCardState('No pipeline data available yet.');
    return;
  }

  container.innerHTML = stages.map((stage) => `
    <div class="pipeline-stage">
      <div class="stage-bar" style="background:${PIPELINE_TONE_COLORS[stage.tone] || 'var(--primary)'};">${stage.count ?? 0}</div>
      <div class="stage-name">${stage.label || formatEnumLabel(stage.status)}</div>
    </div>
  `).join('');
}

function renderRecentInquiries(leads) {
  const tableBody = document.getElementById('recent-leads-body');
  if (!tableBody) return;

  if (!leads || leads.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="7" class="text-center p-20 text-muted">No recent inquiry data to display yet.</td></tr>';
    return;
  }

  tableBody.innerHTML = leads.map((lead) => {
    const studentName = lead.studentName || 'Unknown Student';
    const initials = studentName.split(' ').map((part) => part[0]).join('') || 'S';
    const counsellor = lead.assignedCounsellor?.fullName || 'Unassigned';
    const statusClass = getStatusBadgeClass(lead.status);
    const statusLabel = formatEnumLabel(lead.status) || 'Pending';
    const priorityClass = getPriorityBadgeClass(lead.priority);

    return `
      <tr>
        <td data-label="Student Name"><div class="student-cell"><div class="avatar-sm" style="background:var(--primary)">${initials}</div><div><strong>${studentName}</strong><div class="text-xs text-muted">${lead.leadCode || 'N/A'}</div></div></div></td>
        <td data-label="Counsellor">${counsellor}</td>
        <td data-label="Pref. State">${lead.state?.name || 'N/A'}</td>
        <td data-label="Interested Course"><span class="badge badge-blue" style="font-size:0.6rem">${lead.preferredCourse?.name || 'N/A'}</span></td>
        <td data-label="Status"><span class="badge ${statusClass}">${statusLabel}</span></td>
        <td data-label="Priority"><span class="badge ${priorityClass}">${formatEnumLabel(lead.priority) || 'Medium'}</span></td>
        <td data-label="Actions"><button class="text-primary font-600" onclick="renderProfile('${lead.id}')">View</button></td>
      </tr>
    `;
  }).join('');
}

function renderDashboardReminders(reminders) {
  const remindersList = document.getElementById('dash-reminders');
  if (!remindersList) return;

  if (!reminders || reminders.length === 0) {
    remindersList.innerHTML = renderEmptyCardState('No pending follow-up reminders.');
    return;
  }

  remindersList.innerHTML = reminders.map((reminder) => {
    const dueDate = reminder.dueDate ? new Date(reminder.dueDate) : null;
    const dueLabel = dueDate
      ? dueDate.toLocaleDateString([], { day: '2-digit', month: 'short' })
      : 'TBD';
    const isOverdue = dueDate ? dueDate.getTime() < Date.now() : false;
    const phone = reminder.lead?.phone || 'No phone';

    return `
      <div class="reminder-item ${isOverdue ? 'overdue' : ''}" style="border-left:3px solid ${isOverdue ? 'var(--danger)' : 'var(--primary)'};">
        <div class="rem-date">${dueLabel}</div>
        <div class="rem-text">
          <strong>${reminder.title || `Call ${reminder.lead?.studentName || 'Student'}`}</strong>
          <div class="text-xs text-muted">${reminder.lead?.studentName || 'General reminder'}${reminder.lead?.leadCode ? ` • ${reminder.lead.leadCode}` : ''}</div>
          <div class="text-xs text-muted">${phone}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderRecentActivity(activities) {
  const activityList = document.getElementById('dash-activity-list');
  if (!activityList) return;
  
  if (!activities || activities.length === 0) {
    activityList.innerHTML = renderEmptyCardState('No recent activity found.');
    return;
  }
  
  activityList.innerHTML = activities.map(act => {
    const studentName = act.lead?.studentName || act.message || 'System Activity';
    const timestamp = act.createdAt ? new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
    const actionLabel = (act.action || act.type) ? (act.action || act.type).replace(/_/g, ' ') : 'Interaction';
    
    return `
      <div class="reminder-item" style="border-left:3px solid var(--secondary);">
        <div class="rem-date">${timestamp}</div>
        <div class="rem-text">
          <strong>${actionLabel}</strong>: ${studentName}
          <div class="text-xs text-muted">${act.notes || act.message || ''}</div>
        </div>
      </div>
    `;
  }).join('');
}

function formatEnumLabel(value) {
  return value
    ? String(value)
        .toLowerCase()
        .split('_')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    : '';
}

function renderSourceSummary(sources) {
  const container = document.getElementById('dash-sources');
  if (!container) return;
  
  if (!sources || sources.length === 0) {
    container.innerHTML = renderEmptyCardState('No source data available.');
    return;
  }
  
  const totalLeadCount = sources.reduce((sum, source) => (
    sum + ((typeof source._count === 'number' ? source._count : source._count?.source) || 0)
  ), 0);
  const denominator = totalLeadCount || 1;
  
  const sourceData = sources.map(s => ({
    n: formatEnumLabel(s.source) || 'Direct',
    v: Math.round((((typeof s._count === 'number' ? s._count : s._count?.source) || 0) / denominator) * 100),
    c: 'var(--primary)'
  })).sort((a,b) => b.v - a.v);

  container.innerHTML = sourceData.map(d => `
    <div class="mb-10">
      <div class="flex-between text-xs mb-5"><span>${d.n}</span> <span>${d.v}%</span></div>
      <div class="report-bar-wrap"><div class="report-bar" style="width:${d.v}%; background:${d.c};"></div></div>
    </div>
  `).join('');
}

function renderCounselorPerformance(counselors) {
  const container = document.getElementById('dash-counselors');
  if (!container) return;

  if (!counselors || counselors.length === 0) {
    container.innerHTML = renderEmptyCardState('No counselor activity available yet.');
    return;
  }

  const topLeadCount = counselors[0]?.leadCount || 1;

  container.innerHTML = counselors.map((counselor) => {
    const percentage = Math.max(8, Math.round((counselor.leadCount / topLeadCount) * 100));
    return `
      <div class="mb-10">
        <div class="flex-between text-xs mb-5"><span>${counselor.fullName}</span><span>${counselor.leadCount}</span></div>
        <div class="report-bar-wrap"><div class="report-bar" style="width:${percentage}%; background:var(--secondary);"></div></div>
      </div>
    `;
  }).join('');
}

function renderTopStates(states) {
  const container = document.getElementById('dash-countries');
  if (!container) return;

  if (!states || states.length === 0) {
    container.innerHTML = renderEmptyCardState('No state preference data available yet.');
    return;
  }

  const topStateCount = states[0]?.leadCount || 1;

  container.innerHTML = states.map((state) => {
    const percentage = Math.max(8, Math.round((state.leadCount / topStateCount) * 100));
    return `
      <div class="mb-10">
        <div class="flex-between text-xs mb-5"><span>${state.name}</span><span>${state.leadCount}</span></div>
        <div class="report-bar-wrap"><div class="report-bar" style="width:${percentage}%; background:var(--accent);"></div></div>
      </div>
    `;
  }).join('');
}

/**
 * Fetch and Render Leads List
 */
async function fetchLeads(params = {}) {
  try {
    const query = new URLSearchParams({ limit: '100', ...params }).toString();
    const result = await apiRequest(`/leads?${query}`);
    LEADS_DATA = result.data.leads;
    
    // Update total count badges in UI if needed
    const badges = document.querySelectorAll('.nav-badge');
    if (badges[0]) badges[0].innerText = result.data.pagination.total;

    populateLeads(); // Trigger UI render
    populateFormDropdowns(); // Update student/invoice dropdowns
  } catch (error) {
    console.error('Leads fetch failed');
  }
}

/* =========================================
   6. DROPDOWN POPULATION
   ========================================= */

function populateFormDropdowns() {
  const stateSelects = document.querySelectorAll('#lead-state, #filter-state');
  const courseSelects = document.querySelectorAll('#lead-course, #filter-course');
  const collegeSelects = document.querySelectorAll('#lead-college, #filter-college, #inv-college-select');
  const counselorSelects = document.querySelectorAll('#lead-counselor');
  const sourceSelects = document.querySelectorAll('#lead-source, #filter-source');
  const studentSelects = document.querySelectorAll('#inv-student-select, #pay-invoice-select');
  const statusSelects = document.querySelectorAll('#lead-status, #status-update-select, #filter-status');

  const populate = (selects, data, placeholder, labelKey = 'name', valKey = 'id') => {
    selects.forEach(s => {
      s.innerHTML = `<option value="">-- ${placeholder} --</option>` + 
        data.map(item => {
          const label = typeof item === 'string' ? item : item[labelKey];
          const val = typeof item === 'string' ? item : item[valKey];
          return `<option value="${val}">${label}</option>`;
        }).join('');
    });
  };

  populate(stateSelects, MASTERS.states, 'Select State');
  populate(courseSelects, MASTERS.courses, 'Select Course');
  populate(collegeSelects, MASTERS.colleges, 'Select College');
  populate(counselorSelects, MASTERS.counsellors, 'Select Counselor', 'fullName');
  populate(sourceSelects, MASTERS.sources, 'Select Source');
  populate(studentSelects, LEADS_DATA, 'Select Student', 'studentName');
  
  // Custom status population for better labels
  const statuses = [
    {id:'NEW_ENQUIRY', name:'New Enquiry'},
    {id:'COUNSELING', name:'Counseling'},
    {id:'INTERESTED', name:'Interested'},
    {id:'NOT_INTERESTED', name:'Not Interested'},
    {id:'ADMISSION_CONFIRMED', name:'Admission Confirmed'},
    {id:'NOT_ATTENDED', name:'Not Attended'}
  ];
  populate(statusSelects, statuses, 'Select Status');

  // Add change listener for districts
  stateSelects.forEach(s => {
    s.onchange = (e) => loadDistrictsForState(e.target.value, s.id === 'lead-state' ? 'lead-district' : 'filter-district');
  });
}

/**
 * Load Districts dynamically based on state selection
 */
async function loadDistrictsForState(stateId, targetSelectId) {
  const districtSelect = document.getElementById(targetSelectId);
  if (!districtSelect) return;

  if (!stateId) {
    districtSelect.innerHTML = '<option value="">-- Select District --</option>';
    return;
  }

  try {
    districtSelect.innerHTML = '<option value="">Loading...</option>';
    const result = await apiRequest(`/masters/districts/${stateId}`);
    districtSelect.innerHTML = '<option value="">-- Select District --</option>' + 
      result.data.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  } catch (error) {
    districtSelect.innerHTML = '<option value="">Error loading districts</option>';
    console.error('Failed to load districts');
  }
}


/* =========================================
   NAVIGATION & UI LOGIC
   ========================================= */

function showPage(pageId, navElement, options = {}) {
  const {
    updateRoute = true,
    replaceRoute = false
  } = options;

  if (pageId === 'users' && (!CURRENT_USER || !['SUPER_ADMIN', 'ADMIN'].includes(CURRENT_USER.role))) {
    showToast('Unauthorized access', 'danger');
    return;
  }

  const activeNavItem = navElement || document.querySelector(`.nav-item[data-page="${pageId}"]`);
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  if (activeNavItem) {
    activeNavItem.classList.add('active');
  }

  document.querySelectorAll('.page-content').forEach(page => {
    page.classList.remove('active');
    page.style.display = 'none';
  });

  const selectedPage = document.getElementById(pageId);
  if (selectedPage) {
    selectedPage.classList.add('active');
    selectedPage.style.display = 'flex';
  }

  populateModalSelectors();
  closeMobileSidebar();

  if (updateRoute) {
    syncBrowserRoute(pageId, { replace: replaceRoute });
  }

  switch(pageId) {
    case 'dashboard': populateDashboard(); break;
    case 'leads': populateLeads(); break;
    case 'students': populateStudents(); break;
    case 'applications': populateApplications(); break;
    case 'invoices': populateInvoices(); break;
    case 'admissions': populateAdmissionsBoard(); break;
    case 'colleges': populateColleges(); break;
    case 'courses': populateCourses(); break;
    case 'kanban': populateKanban(); break;
    case 'documents': populateDocuments(); break;
    case 'payments': populatePayments(); break;
    case 'reports': populateReports(); break;
    case 'users': fetchUsers(); break;
  }
}

function openModal(id) {
  const modal = document.getElementById(id || 'leadModal');
  if (!modal) {
    return;
  }

  ACTIVE_MODAL_ID = modal.id;
  modal.style.display = '';
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add(MODAL_OPEN_CLASS);

  const dialog = modal.querySelector('.modal');
  if (dialog) {
    requestAnimationFrame(() => {
      const focusTarget = dialog.querySelector('input, select, textarea, button');
      if (focusTarget) {
        focusTarget.focus();
      }
    });
  }
}

function closeModal(id) {
  const modal = document.getElementById(id || 'leadModal');
  if (!modal) {
    return;
  }

  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  ACTIVE_MODAL_ID = null;

  if (!document.querySelector('.modal-overlay.active')) {
    document.body.classList.remove(MODAL_OPEN_CLASS);
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay.active').forEach((modal) => {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  });
  ACTIVE_MODAL_ID = null;
  document.body.classList.remove(MODAL_OPEN_CLASS);
}

function resetLeadForm() {
  const form = document.getElementById('lead-form');
  if (form) {
    form.reset();
  }

  const districtSelect = document.getElementById('lead-district');
  if (districtSelect) {
    districtSelect.innerHTML = '<option value="">-- Select District --</option>';
  }

  populateFormDropdowns();
}

function discardLeadForm() {
  resetLeadForm();
  closeModal('leadModal');
}

function openMobileSidebar() {
  document.getElementById('sidebar')?.classList.add('active');
  document.body.classList.add(SIDEBAR_OPEN_CLASS);
}

function closeMobileSidebar() {
  document.getElementById('sidebar')?.classList.remove('active');
  document.body.classList.remove(SIDEBAR_OPEN_CLASS);
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const mainArea = document.getElementById('mainArea');
  if (!sidebar || !mainArea || window.innerWidth <= 1024) {
    return;
  }

  sidebar.classList.toggle('collapsed');
  mainArea.classList.toggle('expanded');
}

function bindGlobalUiInteractions() {
  document.addEventListener('click', (event) => {
    const overlay = event.target.closest('.modal-overlay');
    if (overlay && event.target === overlay) {
      closeModal(overlay.id);
      return;
    }

    if (
      document.body.classList.contains(SIDEBAR_OPEN_CLASS) &&
      !event.target.closest('#sidebar') &&
      !event.target.closest('.mobile-menu-btn')
    ) {
      closeMobileSidebar();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (ACTIVE_MODAL_ID) {
        closeModal(ACTIVE_MODAL_ID);
        return;
      }

      if (document.body.classList.contains(SIDEBAR_OPEN_CLASS)) {
        closeMobileSidebar();
      }
    }
  });
}

function populateModalSelectors() {
  const collegeSelects = document.querySelectorAll('#inv-college-select, #lead-college');
  const courseSelects = document.querySelectorAll('#lead-course-select, #lead-course');

  collegeSelects.forEach(s => {
    if (s && s.children.length <= 1) {
      s.innerHTML = '<option value="">-- Select College --</option>' + 
        MASTERS.colleges.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
  });

  courseSelects.forEach(s => {
    if (s && s.children.length <= 1) {
       s.innerHTML = '<option value="">-- Select Course --</option>' +
        MASTERS.courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
  });
}

function openStatusModal(id) {
  const lead = LEADS_DATA.find(l => l.id === id);
  if (!lead) return;

  document.getElementById('status-update-id').value = id;
  document.getElementById('status-update-name').innerText = lead.studentName;
  document.getElementById('status-update-select').value = lead.status;
  document.getElementById('status-update-note').value = '';
  
  openModal('statusUpdateModal');
}

async function updateLeadStatus() {
  const id = document.getElementById('status-update-id').value;
  const newStatus = document.getElementById('status-update-select').value;
  const note = document.getElementById('status-update-note').value;
  
  toggleLoader(true);
  try {
    await apiRequest(`/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus, notes: note })
    });
    
    showToast('Status updated successfully', 'success');
    closeModal('statusUpdateModal');
    
    // Refresh data
    await Promise.all([fetchDashboardData(), fetchLeads()]);
  } catch (error) {
    showToast('Failed to update status', 'danger');
  } finally {
    toggleLoader(false);
  }
}

function toggleLeadView(view) {
  currentLeadView = view;
  const tableView = document.getElementById('leads-table-view');
  const gridView = document.getElementById('leads-grid-view');
  const buttons = document.querySelectorAll('.view-btn');
  
  buttons.forEach(btn => btn.classList.remove('active'));
  if (view === 'table') {
    tableView.style.display = 'block';
    gridView.style.display = 'none';
    buttons[0].classList.add('active');
  } else {
    tableView.style.display = 'none';
    gridView.style.display = 'block';
    buttons[1].classList.add('active');
  }
  populateLeads();
}

/* =========================================
   PAGE POPULATION FUNCTIONS
   ========================================= */

function populateDashboard() {
  renderDashboard();
  fetchDashboardData();
}

function populateLeads() {
  const tableBody = document.getElementById('all-leads-body');
  const gridCont = document.getElementById('all-leads-grid');
  if (!tableBody && !gridCont) return;

  if (!LEADS_DATA || LEADS_DATA.length === 0) {
    const emptyMsg = '<div class="text-center p-40 p-relative" style="grid-column: 1 / -1;"><div class="text-muted mb-10" style="font-size:3rem; opacity:0.3;">📂</div><h3 class="text-muted">No matching leads found</h3><p class="text-xs text-muted">Try adjusting your filters or search query.</p></div>';
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="8" class="text-center p-40">No lead database entries found matching the criteria.</td></tr>';
    if (gridCont) gridCont.innerHTML = emptyMsg;
    return;
  }

  if (currentLeadView === 'table' && tableBody) {
    tableBody.innerHTML = LEADS_DATA.map(lead => {
      const studentName = lead.studentName || 'Unknown Student';
      const initials = studentName.split(' ').map(n=>n[0]).join('') || 'L';
      const nextCall = lead.nextCallDate ? new Date(lead.nextCallDate).toLocaleDateString() : 'N/A';
      const lastCall = lead.lastCallDate ? new Date(lead.lastCallDate).toLocaleDateString() : 'Never';
      
      return `
        <tr>
          <td data-label="Lead">
            <div class="student-cell">
              <div class="avatar-sm" style="background:var(--primary)">${initials}</div>
              <div>
                <strong>${studentName}</strong>
                <div class="text-xs text-muted">${lead.leadCode || 'CCRM-XXXX'} | Area: ${lead.area || 'N/A'}</div>
              </div>
            </div>
          </td>
          <td data-label="Contact">
            <div class="text-sm">P: ${lead.phone || 'N/A'}</div>
            <div class="text-sm text-success">W: ${lead.whatsappNumber || lead.phone || 'N/A'}</div>
            <div class="text-xs text-muted">${lead.email || ''}</div>
          </td>
          <td data-label="Location">
            <div class="text-sm"><strong>${lead.area || 'N/A'}</strong></div>
            <div class="text-xs text-muted">${lead.district?.name || 'N/A'}, ${lead.state?.name || 'N/A'}</div>
          </td>
          <td data-label="Course">
            <div class="text-sm font-600">${lead.preferredCourse?.name || 'N/A'}</div>
            <div class="text-xs text-muted">${lead.college?.name || 'N/A'}</div>
          </td>
          <td data-label="Source">
            <div class="text-sm">${lead.source || 'Direct'}</div>
            <div class="text-xs text-muted">Agt: ${lead.assignedCounsellor?.fullName || 'N/A'}</div>
          </td>
          <td data-label="Call Tracking">
            <div class="call-tracking-cell">
              <div class="text-xs">Next: <strong>${nextCall}</strong></div>
              <div class="text-xs">Last: ${lastCall}</div>
              ${lead.notAttended ? '<span class="badge badge-danger" style="font-size:0.5rem; padding:1px 4px;">NOT ATTENDED</span>' : ''}
            </div>
          </td>
          <td data-label="Status">
            <div class="flex-between" style="gap:8px;">
              <span class="badge ${getStatusBadgeClass(lead.status)}">${lead.status ? lead.status.replace(/_/g, ' ') : 'NEW'}</span>
              <button class="action-btn btn-sm" title="Change Status" onclick="openStatusModal('${lead.id}')"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            </div>
          </td>
           <td data-label="Actions">
            <div style="display:flex; gap:6px;">
              <button class="action-btn" title="Call" onclick="alert('Calling ${lead.phone || '...'}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></button>
              <button class="action-btn" title="View Profile" onclick="renderProfile('${lead.id}')" style="background:var(--primary-soft); color:var(--primary);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } else if (gridCont) {
    gridCont.innerHTML = LEADS_DATA.map(lead => {
      const studentName = lead.studentName || 'Unknown Student';
      const initials = studentName.split(' ').map(n=>n[0]).join('') || 'G';
      const nextCall = lead.nextCallDate ? new Date(lead.nextCallDate).toLocaleDateString() : 'N/A';
      
      return `
        <div class="card lead-card ${lead.notAttended ? 'border-danger' : ''}" style="padding: 16px; position: relative;">
          <span class="badge ${getStatusBadgeClass(lead.status)}" style="position:absolute; top:12px; right:12px;">${lead.status ? lead.status.replace(/_/g, ' ') : 'NEW'}</span>
          <div class="student-cell" style="margin-bottom:12px;">
             <div class="avatar-sm" style="background:var(--primary); width:40px; height:40px; font-size:1rem;">${initials}</div>
             <div>
                <strong style="font-size:1rem">${studentName}</strong>
                <div class="text-xs text-muted">${lead.area || lead.district?.name || 'Unknown Area'}</div>
             </div>
          </div>
          <div style="font-size:0.8rem; padding:10px; background:var(--bg-soft); border-radius:8px; margin-bottom:12px;">
             <div class="flex-between"><span>Course:</span> <strong>${lead.preferredCourse?.name || 'N/A'}</strong></div>
             <div class="flex-between"><span>College:</span> <span>${lead.college?.name || 'N/A'}</span></div>
             <div class="flex-between mt-5" style="border-top:1px solid var(--border-light); padding-top:5px;">
                <span>Next Call:</span> <strong>${nextCall}</strong>
             </div>
          </div>
          <div class="flex-between">
             <div class="call-attempts text-xs text-muted">Attempts: ${lead.callAttempts || 0}</div>
             <div style="display:flex; gap:6px;">
                <button class="action-btn btn-sm" onclick="alert('Call ${lead.phone || '...'}')" title="Call"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></button>
                <button class="action-btn btn-sm" style="color:var(--primary)" onclick="openStatusModal('${lead.id}')" title="Change Status"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                <button class="btn-primary" style="padding:4px 10px; font-size:0.65rem;" onclick="renderProfile('${lead.id}')">Profile</button>
             </div>
          </div>
        </div>
      `;
    }).join('');
  }
}

function populateStudents() {
  const body = document.getElementById('students-body');
  if (!body) return;
  
  const admitted = LEADS_DATA ? LEADS_DATA.filter(l => l.status === 'ADMISSION_CONFIRMED') : [];
  if (admitted.length === 0) {
    body.innerHTML = '<tr><td colspan="6" class="text-center p-40 text-muted">No confirmed student admissions found yet.</td></tr>';
    return;
  }

  body.innerHTML = admitted.map(s => {
    const studentName = s.studentName || 'Unknown Student';
    const initials = studentName.split(' ').map(n=>n[0]).join('') || 'S';
    return `
      <tr>
        <td><div class="student-cell"><div class="avatar-sm" style="background:var(--primary)">${initials}</div><div><strong>${studentName}</strong><div class="text-xs text-muted">${s.leadCode || 'CCRM-XXXX'}</div></div></div></td>
        <td>${s.phone || 'N/A'}</td>
        <td>${s.preferredCourse?.name || 'N/A'}</td>
        <td>${s.college?.name || 'N/A'}</td>
        <td><span class="badge badge-green">Enrolled</span></td>
        <td><button class="text-primary font-600" onclick="renderProfile('${s.id}')">Profile</button></td>
      </tr>
    `;
  }).join('');
}

function populateApplications() {
  const body = document.getElementById('applications-body');
  if (!body) return;
  
  const applicants = LEADS_DATA ? LEADS_DATA.filter(l => ['COUNSELING', 'INTERESTED', 'ADMISSION_CONFIRMED'].includes(l.status)) : [];
  if (applicants.length === 0) {
    body.innerHTML = '<tr><td colspan="6" class="text-center p-40 text-muted">No active applications currently in the pipeline.</td></tr>';
    return;
  }

  body.innerHTML = applicants.map(a => {
    const studentName = a.studentName || 'Unknown Applicant';
    const course = a.preferredCourse?.name || 'N/A';
    const statusClass = getStatusBadgeClass(a.status);
    const statusLabel = a.status ? a.status.replace(/_/g, ' ') : 'IN REVIEW';
    
    return `
      <tr>
        <td><strong>${a.leadCode || 'CCRM-XXXX'}</strong></td>
        <td>${studentName}</td>
        <td>${course}</td>
        <td><span class="badge ${statusClass}">${statusLabel}</span></td>
        <td>75% Complete</td>
        <td><button class="text-primary font-600" onclick="renderProfile('${a.id}')">Details</button></td>
      </tr>
    `;
  }).join('');
}

function populateDocuments() {
  const grid = document.getElementById('documents-grid');
  if (!grid) return;
  
  const relevantLeads = LEADS_DATA ? LEADS_DATA.slice(0, 4) : [];
  if (relevantLeads.length === 0) {
    grid.innerHTML = '<div class="text-center p-40 width-full text-muted">No document batches found.</div>';
    return;
  }

  grid.innerHTML = relevantLeads.map(l => {
    const studentName = l.studentName || 'Student';
    return `
      <div class="card p-15">
        <div class="flex-between mb-10">
           <div class="text-sm"><strong>${studentName}'s Docs</strong></div>
           <span class="badge badge-gold">2 Pending</span>
        </div>
        <div class="text-xs text-muted">Aadhar, 10th & 12th Marks (Verified)</div>
      </div>
    `;
  }).join('');
}

async function populateInvoices() {
  const grid = document.getElementById('invoices-grid');
  if (!grid) return;
  
  toggleLoader(true);
  try {
    const res = await apiRequest('/finance/invoices');
    const invoices = res.data;
    
    grid.innerHTML = invoices.map(inv => {
      const studentName = inv.lead?.studentName || 'Unknown Student';
      const collegeName = inv.lead?.college?.name || 'N/A';
      const billDate = inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : 'N/A';
      const dueDate = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'N/A';
      const statusClass = getStatusBadgeClass(inv.status);
      const paid = inv.paidAmount || 0;
      const total = inv.totalAmount || 0;
      
      return `
        <div class="invoice-card ${inv.status ? inv.status.toLowerCase() : 'pending'}">
           <div class="invoice-header">
              <div class="invoice-no">${inv.invoiceNo || 'INV-XXXX'}</div>
              <span class="badge ${statusClass}">${inv.status || 'PENDING'}</span>
           </div>
           <div class="invoice-body">
              <div><div class="inv-label">Student</div><div class="inv-value">${studentName}</div></div>
              <div><div class="inv-label">College</div><div class="inv-value">${collegeName}</div></div>
              <div><div class="inv-label">Bill Date</div><div class="inv-value">${billDate}</div></div>
              <div><div class="inv-label">Due Date</div><div class="inv-value">${dueDate}</div></div>
           </div>
           <div class="invoice-footer">
              <div class="text-xs text-muted">Paid: ₹${paid.toLocaleString('en-IN')}</div>
              <div class="invoice-total">₹${total.toLocaleString('en-IN')}</div>
           </div>
        </div>
      `;
    }).join('') || '<div class="text-center p-40 width-full text-muted">No invoices found matching the profile.</div>';
  } catch (error) {
    showToast('Failed to load invoices', 'danger');
  } finally {
    toggleLoader(false);
  }
}

async function populatePayments() {
  const body = document.getElementById('payments-body');
  if (!body) return;
  
  toggleLoader(true);
  try {
    const res = await apiRequest('/finance/payments');
    const payments = res.data;
    
    body.innerHTML = payments.map(p => {
      const studentName = p.invoice?.lead?.studentName || 'N/A';
      const amount = p.amount || 0;
      const refId = p.id ? p.id.slice(-6).toUpperCase() : 'XXXXXX';
      
      return `
        <tr>
          <td><strong>${refId}</strong></td>
          <td>${studentName}</td>
          <td>${p.paymentType || 'Installment'}</td>
          <td><strong class="text-success">₹${amount.toLocaleString('en-IN')}</strong></td>
          <td>${p.paymentMethod || 'Online'}</td>
          <td><span class="badge badge-green">Success</span></td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="6" class="text-center p-40 text-muted">No payment transactions recorded yet.</td></tr>';
  } catch (error) {
    showToast('Failed to load payments', 'danger');
  } finally {
    toggleLoader(false);
  }
}

function populateColleges() {
  const grid = document.getElementById('colleges-grid');
  if (!grid) return;
  
  if (!MASTERS.colleges || MASTERS.colleges.length === 0) {
    grid.innerHTML = '<div class="text-center p-40 width-full text-muted">No partner colleges configured.</div>';
    return;
  }

  grid.innerHTML = MASTERS.colleges.map(c => `
    <div class="card overflow-hidden">
      <div class="card-body" style="padding:15px;">
         <div class="flex-between">
            <span class="badge badge-blue">Registered</span>
            <span class="text-warning font-700">★ 4.5</span>
         </div>
         <h4 class="card-title mt-10">${c.name || 'Unnamed Institution'}</h4>
         <div class="stat-row" style="padding:5px 0; font-size:0.75rem;"><span class="text-muted">Type:</span> <strong>Private</strong></div>
         <div class="flex-between text-xs font-600 mt-15" style="border-top:1px solid var(--border-light); padding-top:10px;">
            <button class="text-primary">Details →</button>
         </div>
      </div>
    </div>
  `).join('');
}

function populateCourses() {
  const grid = document.getElementById('courses-grid');
  if (!grid) return;
  
  if (!MASTERS.courses || MASTERS.courses.length === 0) {
    grid.innerHTML = '<div class="text-center p-40 width-full text-muted">No course programs available.</div>';
    return;
  }

  grid.innerHTML = MASTERS.courses.map(c => `
    <div class="card" style="padding:20px;">
      <h4 class="card-title">${c.name || 'Unnamed Course'}</h4>
      <div class="text-xs text-muted mt-5">Admissions open for 2026-27 session.</div>
      <div class="flex-between mt-20">
         <button class="btn-primary" style="width:100%; justify-content:center;">Inquire Course</button>
      </div>
    </div>
  `).join('');
}

async function populateReports() {
  try {
    const [leaderboardRes, trendsRes] = await Promise.all([
      apiRequest('/reports/counselor-leaderboard'),
      apiRequest('/reports/course-trends')
    ]);

    const leaderboard = document.getElementById('counselor-leaderboard');
    if (leaderboard) {
      leaderboard.innerHTML = leaderboardRes.data.map(l => `
        <div class="stat-row">
          <span class="stat-name">${l.fullName}</span> 
          <span class="stat-val">${l._count.leads} Admissions</span>
        </div>
      `).join('');
    }

    const trends = document.getElementById('course-trends');
    if (trends) {
      trends.innerHTML = trendsRes.data.map(t => `
        <div class="mb-10">
          <div class="flex-between text-xs mb-5"><span>${t.name}</span> <span>${t._count.leads} Active</span></div>
          <div class="report-bar-wrap"><div class="report-bar" style="width:${Math.min(100, t._count.leads * 10)}%; background:var(--primary);"></div></div>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Failed to load reports');
  }
}

function renderProfile(id) {
  const lead = LEADS_DATA ? LEADS_DATA.find(l => l.id === id) : null;
  if (!lead) {
    showToast('Student profile not found in current cache.', 'warning');
    return;
  }

  showPage('profile');
  const studentName = lead.studentName || 'Unknown Student';
  const initials = studentName.split(' ').map(n=>n[0]).join('') || 'U';

  const updateEl = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.innerText = text || 'N/A';
  };

  updateEl('profile-name', studentName);
  updateEl('profile-id', `ID: ${lead.leadCode || 'N/A'}`);
  updateEl('profile-phone', lead.phone);
  updateEl('profile-parent', `${lead.area ? lead.area + ', ' : ''}${lead.district?.name || 'N/A'}`);
  updateEl('profile-status', lead.status ? lead.status.replace(/_/g, ' ') : 'NEW');
  updateEl('profile-avatar', initials);
  
  const tagsCont = document.getElementById('profile-tags');
  if (tagsCont) {
    tagsCont.innerHTML = `
      <span class="badge badge-blue">${lead.preferredCourse?.name || 'N/A'}</span>
      <span class="badge ${getStatusBadgeClass(lead.status)}">${lead.status ? lead.status.replace(/_/g, ' ') : 'NEW'}</span>
      <span class="badge badge-indigo">${lead.state?.name || 'N/A'}</span>
      <span class="badge badge-navy">${lead.source || 'Direct'}</span>
    `;
  }
}

// Legacy renderReport, renderKPIDistribution removed. Using centralized populate functions.

const KANBAN_STAGES = [
  { id: 'NEW_ENQUIRY', name: 'New Enquiry', color: 'var(--navy)' },
  { id: 'COUNSELING', name: 'Counseling', color: 'var(--primary)' },
  { id: 'INTERESTED', name: 'Interested', color: 'var(--secondary)' },
  { id: 'ADMISSION_CONFIRMED', name: 'Admission Confirmed', color: 'var(--success)' }
];

function populateAdmissionsBoard() {
  const grid = document.getElementById('admissions-grid');
  if (!grid) return;
  
  const admittedLeads = LEADS_DATA ? LEADS_DATA.filter(l => l.status === 'ADMISSION_CONFIRMED') : [];
  
  grid.innerHTML = admittedLeads.map(v => `
    <div class="card" style="border-left: 5px solid var(--success)">
      <div class="card-header">
         <span class="card-title" style="font-size: 0.95rem;">${v.studentName || 'Unknown Student'}</span>
         <span class="badge badge-green">Admitted</span>
      </div>
      <div class="card-body" style="padding: 15px;">
         <div class="form-group" style="gap: 8px; font-size: 0.8rem;">
            <div class="flex-between"><span>State:</span> <span class="font-600">${v.state?.name || 'N/A'}</span></div>
            <div class="flex-between"><span>Course:</span> <span class="text-muted">${v.preferredCourse?.name || 'N/A'}</span></div>
            <div class="flex-between"><span>College:</span> <strong class="text-primary">${v.college?.name || 'Exploring'}</strong></div>
         </div>
      </div>
    </div>
  `).join('') || '<div class="text-center p-40 width-full">No confirmed admissions yet.</div>';
}

function populateKanban() {
  const board = document.getElementById('kanbanBoard');
  if (!board) return;
  
  if (!LEADS_DATA || LEADS_DATA.length === 0) {
    board.innerHTML = '<div class="text-center p-40 width-full text-muted">No leads available to display in pipeline.</div>';
    return;
  }

  board.innerHTML = KANBAN_STAGES.map(stage => {
    const stageLeads = LEADS_DATA.filter(l => l.status === stage.id);
    return `
      <div class="kanban-column">
        <div class="column-header">
          <div class="column-title"><div class="column-dot" style="background:${stage.color}"></div>${stage.name}</div>
          <span class="column-count">${stageLeads.length}</span>
        </div>
        <div class="kanban-cards">
          ${stageLeads.map(l => {
            const studentName = l.studentName || 'Unknown Student';
            const nextCall = l.nextCallDate ? new Date(l.nextCallDate).toLocaleDateString() : 'N/A';
            return `
              <div class="kanban-card" onclick="renderProfile('${l.id}')">
                <div class="kc-name">${studentName}</div>
                <div class="kc-info">${l.preferredCourse?.name || 'N/A'}</div>
                <div class="kc-footer">
                  <span class="badge badge-blue" style="font-size:0.55rem">${l.district?.name || 'N/A'}</span>
                  <span class="text-muted text-xs">${nextCall}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

async function createNewLead(event) {
  if (event) {
    event.preventDefault();
  }

  const studentName = document.getElementById('lead-name').value;
  const phone = document.getElementById('lead-phone').value;
  
  if (!studentName || !phone) {
    showToast('Student Name and Phone are required', 'warning');
    return;
  }

  const payload = {
    studentName,
    phone,
    whatsappNumber: document.getElementById('lead-whatsapp').value,
    email: document.getElementById('lead-email').value,
    dob: document.getElementById('lead-dob').value,
    area: document.getElementById('lead-area').value,
    stateId: document.getElementById('lead-state').value,
    districtId: document.getElementById('lead-district').value,
    preferredCourseId: document.getElementById('lead-course').value,
    collegeId: document.getElementById('lead-college').value,
    source: document.getElementById('lead-source').value,
    assignedCounsellorId: document.getElementById('lead-counselor').value,
    lastCallDate: document.getElementById('lead-last-call').value,
    nextCallDate: document.getElementById('lead-next-call').value,
    callAttempts: document.getElementById('lead-attempts').value,
    notes: document.getElementById('lead-notes').value,
    status: document.getElementById('lead-status').value || 'NEW_ENQUIRY'
  };

  toggleLoader(true);
  try {
    await apiRequest('/leads', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    showToast('Lead created successfully!', 'success');
    resetLeadForm();
    closeModal('leadModal');
    
    // Refresh data
    await Promise.all([fetchDashboardData(), fetchLeads()]);
  } catch (error) {
    showToast('Failed to create lead', 'danger');
  } finally {
    toggleLoader(false);
  }
}

function filterLeads(query) {
  // Simple local search on current LEADS_DATA for better UX
  const tableBody = document.getElementById('all-leads-body');
  if (!tableBody) return;
  
  const q = query.toLowerCase();
  const filtered = LEADS_DATA ? LEADS_DATA.filter(l => 
    (l.studentName || '').toLowerCase().includes(q) || 
    (l.phone || '').includes(query) ||
    (l.leadCode || '').toLowerCase().includes(q)
  ) : [];

  tableBody.innerHTML = filtered.map(lead => `
    <tr>
      <td>
        <div class="student-cell">
           <div class="avatar-sm" style="background:var(--primary)">${lead.studentName?.split(' ').map(n=>n[0]).join('') || 'F'}</div>
           <div><strong>${lead.studentName}</strong><div class="text-xs text-muted">${lead.leadCode}</div></div>
        </div>
      </td>
      <td>${lead.phone}</td>
      <td>${lead.district?.name || 'N/A'}</td>
      <td><span class="badge badge-blue" style="font-size:0.6rem">${lead.preferredCourse?.name || 'N/A'}</span></td>
      <td>${lead.assignedCounsellor?.fullName || 'N/A'}</td>
      <td><span class="badge ${getStatusBadgeClass(lead.status)}">${lead.status.replace(/_/g, ' ')}</span></td>
      <td><div class="text-xs">Next: ${lead.nextCallDate ? new Date(lead.nextCallDate).toLocaleDateString() : 'N/A'}</div></td>
      <td><button class="text-primary font-600" onclick="renderProfile('${lead.id}')">View</button></td>
    </tr>
  `).join('');
}

// Event Listeners for Search
document.addEventListener('input', (e) => {
  if (e.target.id === 'global-search' || e.target.id === 'leads-search') {
    filterLeads(e.target.value);
  }
});

function getStatusBadgeClass(status) {
  const s = status ? status.toUpperCase() : '';
  switch (s) {
    case 'ADMISSION_CONFIRMED': return 'badge-green';
    case 'INTERESTED': return 'badge-blue';
    case 'COUNSELING': return 'badge-indigo';
    case 'NEW_ENQUIRY': return 'badge-navy';
    case 'NOT_INTERESTED': return 'badge-slate';
    case 'NOT_ATTENDED': return 'badge-danger';
    case 'JOINED_OTHER': return 'badge-gold';
    default: return 'badge-primary';
  }
}

function getPriorityBadgeClass(priority) {
  switch (priority) {
    case 'High': return 'badge-danger';
    case 'Medium': return 'badge-warning';
    case 'Low': return 'badge-success';
    default: return 'badge-primary';
  }
}

window.onload = () => { 
  // Initial Population logic moved to initApp
  // Keeping window.onload only for strictly aesthetic non-data tasks if needed
};

/* =========================================
   USER MANAGEMENT LOGIC
   ========================================= */
let SYSTEM_USERS = [];

async function fetchUsers() {
  try {
    const result = await apiRequest('/users');
    SYSTEM_USERS = result.data;
    renderUsersTable(SYSTEM_USERS);
    updateUserStats();
  } catch (err) {
    console.error('Failed to fetch users');
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  users.forEach(u => {
    const row = document.createElement('tr');
    const lastLogin = u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never';
    const statusClass = u.isActive ? 'badge-green' : 'badge-danger';
    
    row.innerHTML = `
      <td data-label="User Info">
        <div style="font-weight:600;">${u.fullName}</div>
        <div style="font-size:0.8rem; color:#666;">${u.email} | ${u.userCode || 'No Code'}</div>
      </td>
      <td data-label="Role"><span class="badge badge-indigo">${u.role}</span></td>
      <td data-label="Branch / Dept">${u.department?.name || 'Main Branch'}</td>
      <td data-label="Status"><span class="badge ${statusClass}">${u.isActive ? 'Active' : 'Inactive'}</span></td>
      <td data-label="Last Login" style="font-size:0.8rem;">${lastLogin}</td>
      <td data-label="Actions">
        <div class="table-actions">
          <button class="action-btn" title="Edit User" onclick="openUserModal('${u.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
          <button class="action-btn" title="Permissions" onclick="openPermissionModal('${u.id}', '${u.fullName}')" style="color:var(--indigo);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
          <button class="action-btn" title="Toggle Status" onclick="toggleUserStatus('${u.id}')" style="color:var(--danger);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function updateUserStats() {
  const tot = document.getElementById('total-users-count');
  const act = document.getElementById('active-users-count');
  const sus = document.getElementById('suspended-users-count');
  if(tot) tot.innerText = SYSTEM_USERS.length;
  if(act) act.innerText = SYSTEM_USERS.filter(u => u.isActive).length;
  if(sus) sus.innerText = SYSTEM_USERS.filter(u => u.isSuspended).length;
}

function openUserModal(userId = null) {
  const modal = document.getElementById('userModal');
  const modalTitle = document.getElementById('user-modal-title');
  const passGroup = document.getElementById('password-group');
  const form = document.getElementById('user-form');
  
  form.reset();
  document.getElementById('edit-user-id').value = userId || '';

  if (userId) {
    const user = SYSTEM_USERS.find(u => u.id === userId);
    modalTitle.innerText = 'Edit System User';
    if(passGroup) passGroup.style.display = 'none';
    document.getElementById('user-fullname').value = user.fullName;
    document.getElementById('user-email').value = user.email;
    document.getElementById('user-phone').value = user.phone || '';
    document.getElementById('user-role').value = user.role;
    document.getElementById('user-code').value = user.userCode || '';
    document.getElementById('user-status').value = user.isActive.toString();
  } else {
    modalTitle.innerText = 'Add New System User';
    if(passGroup) passGroup.style.display = 'block';
  }
  
  openModal('userModal');
}

async function saveUser() {
  const userId = document.getElementById('edit-user-id').value;
  const payload = {
    fullName: document.getElementById('user-fullname').value,
    email: document.getElementById('user-email').value,
    phone: document.getElementById('user-phone').value,
    role: document.getElementById('user-role').value,
    userCode: document.getElementById('user-code').value,
    isActive: document.getElementById('user-status').value === 'true'
  };

  if (!userId) {
    payload.password = document.getElementById('user-password').value;
  }

  toggleLoader(true);
  try {
    const endpoint = userId ? `/users/${userId}` : '/users';
    const method = userId ? 'PUT' : 'POST';
    
    await apiRequest(endpoint, {
      method,
      body: JSON.stringify(payload)
    });

    showToast(`User ${userId ? 'updated' : 'created'} successfully`, 'success');
    closeModal('userModal');
    fetchUsers();
  } catch (err) {
    console.error('Save user failed');
  } finally {
    toggleLoader(false);
  }
}

async function toggleUserStatus(userId) {
  if (!confirm("Are you sure you want to toggle this user's status?")) return;
  
  try {
    await apiRequest(`/users/${userId}/toggle-activation`, { method: 'PATCH' });
    showToast('Status updated', 'success');
    fetchUsers();
  } catch (err) {
    console.error('Toggle status failed');
  }
}

function filterUsersTable() {
  const query = document.getElementById('user-search')?.value.toLowerCase() || '';
  const role = document.getElementById('user-role-filter')?.value || '';
  
  const filtered = SYSTEM_USERS.filter(u => {
    const matchesQuery = u.fullName.toLowerCase().includes(query) || u.email.toLowerCase().includes(query);
    const matchesRole = role === '' || u.role === role;
    return matchesQuery && matchesRole;
  });
  
  renderUsersTable(filtered);
}

const MODULES_LIST = ['DASHBOARD', 'LEADS', 'STUDENTS', 'FINANCE', 'REPORTS', 'USERS', 'MASTERS'];
const ACTIONS_LIST = ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT'];

function openPermissionModal(userId, userName) {
  document.getElementById('perm-user-id').value = userId;
  document.getElementById('perm-user-name').innerText = userName;
  
  const tbody = document.getElementById('permission-matrix-body');
  if(!tbody) return;
  tbody.innerHTML = '';

  MODULES_LIST.forEach(mod => {
    const row = document.createElement('tr');
    row.innerHTML = `<td style="font-weight:600;">${mod}</td>`;
    
    ACTIONS_LIST.forEach(act => {
      row.innerHTML += `
        <td style="text-align:center;">
          <input type="checkbox" class="perm-check" data-module="${mod}" data-action="${act}">
        </td>
      `;
    });
    tbody.appendChild(row);
  });

  openModal('permissionModal');
}

async function savePermissions() {
  showToast('Permissions updated (Overrides simulated)', 'success');
  closeModal('permissionModal');
}
