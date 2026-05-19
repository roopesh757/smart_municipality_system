// js/api.js - API Helper, Auth Utils, Toast Notifications

const API_BASE = 'http://localhost:5000/api';

// ─── Storage Helpers ──────────────────────────────────────────
const Storage = {
    set: (key, val) => localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val)),
    get: (key) => {
        const val = localStorage.getItem(key);
        try { return JSON.parse(val); } catch { return val; }
    },
    remove: (key) => localStorage.removeItem(key),
    clear: () => { ['token','user','role'].forEach(k => localStorage.removeItem(k)); }
};

// ─── Auth State ───────────────────────────────────────────────
const Auth = {
    getToken: () => Storage.get('token'),
    getUser: () => Storage.get('user'),
    getRole: () => Storage.get('role'),
    isLoggedIn: () => !!Storage.get('token'),
    login: (token, user, role) => {
        Storage.set('token', token);
        Storage.set('user', user);
        Storage.set('role', role);
    },
    logout: () => {
        Storage.clear();
        window.location.href = '/login.html';
    },
    requireAuth: (role) => {
        if (!Auth.isLoggedIn()) {
            window.location.href = '/login.html';
            return false;
        }
        if (role && Auth.getRole() !== role) {
            window.location.href = '/login.html';
            return false;
        }
        return true;
    }
};

// ─── HTTP Client ──────────────────────────────────────────────
const API = {
    _request: async (method, endpoint, body = null, isFormData = false) => {
        const headers = {};
        const token = Auth.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (!isFormData) headers['Content-Type'] = 'application/json';

        const options = { method, headers };
        if (body) options.body = isFormData ? body : JSON.stringify(body);

        try {
            const res = await fetch(`${API_BASE}${endpoint}`, options);
            const data = await res.json();
            if (!res.ok) throw { status: res.status, message: data.message || 'Request failed' };
            return data;
        } catch (err) {
            if (err.status === 401 && token) Auth.logout();
            throw err;
        }
    },

    get: (endpoint) => API._request('GET', endpoint),
    post: (endpoint, body) => API._request('POST', endpoint, body),
    put: (endpoint, body) => API._request('PUT', endpoint, body),
    delete: (endpoint, body) => API._request('DELETE', endpoint, body),
    postForm: (endpoint, formData) => API._request('POST', endpoint, formData, true),
};

// ─── Toast Notifications ──────────────────────────────────────
function ensureToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

function showToast(title, message, type = 'info', duration = 4000) {
    const container = ensureToastContainer();
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-body">
            <div class="toast-title">${title}</div>
            ${message ? `<div class="toast-msg">${message}</div>` : ''}
        </div>
        <button onclick="this.closest('.toast').remove()" style="background:none;border:none;font-size:1.1rem;cursor:pointer;color:#888;padding:0 0 0 8px;align-self:flex-start;">✕</button>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hiding');
        toast.addEventListener('animationend', () => toast.remove());
    }, duration);
}

// ─── Modal Helper ─────────────────────────────────────────────
function openModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
}
// Close modal on overlay click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('open');
        document.body.style.overflow = '';
    }
});

// ─── Helpers ──────────────────────────────────────────────────
function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

function getPriorityBadge(priority) {
    const map = { Low: 'low', Medium: 'medium', High: 'high', Urgent: 'urgent' };
    return `<span class="badge badge-${map[priority] || 'medium'}">● ${priority}</span>`;
}

function getStatusBadge(status) {
    const map = {
        'Submitted': 'submitted', 'Pending': 'pending',
        'In Progress': 'in-progress', 'Solved': 'solved', 'Rejected': 'rejected'
    };
    const icons = {
        'Submitted': '📋', 'Pending': '⏳', 'In Progress': '🔧', 'Solved': '✅', 'Rejected': '❌'
    };
    return `<span class="badge badge-${map[status] || 'submitted'}">${icons[status] || ''} ${status}</span>`;
}

function getPriorityColor(priority) {
    const map = { Low: '#22c55e', Medium: '#eab308', High: '#f97316', Urgent: '#ef4444' };
    return map[priority] || '#6366f1';
}

const PROBLEM_TYPES = [
    { type: 'Road damage / potholes', icon: '🛣️' },
    { type: 'Garbage issues', icon: '🗑️' },
    { type: 'Drainage/sewage overflow', icon: '🚿' },
    { type: 'Street light issues', icon: '💡' },
    { type: 'Public toilet issues', icon: '🚻' },
    { type: 'Damaged public property', icon: '🏚️' },
    { type: 'Blocked drains', icon: '🚫' },
    { type: 'Broken footpaths', icon: '🦶' },
    { type: 'Fallen trees', icon: '🌳' },
    { type: 'Water leakage / pipeline break', icon: '💧' }
];

function setLoading(btn, isLoading) {
    if (!btn) return;
    if (isLoading) {
        btn._origText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="loading-spinner"></span> Loading...`;
    } else {
        btn.disabled = false;
        btn.innerHTML = btn._origText || 'Submit';
    }
}

function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = orig, 2000);
    });
}
