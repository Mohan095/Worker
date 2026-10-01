/**
 * WORK CONNECT - COMMON APPLICATION UTILITIES & CONTROLLER
 * Routing protection, Navigation rendering, Toasts, Confirmation Dialogs, and Auth Bridges.
 */

import { auth, isDemoMode, mockStore, signOut as fbSignOut, onAuthStateChanged } from "./firebase-config.js";
import { getAppLanguage, setAppLanguage, t, applyPageTranslations } from "./translations.js";

// Common SVG Icons map
export const icons = {
  briefcase: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`,
  search: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
  mapPin: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
  phone: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`,
  plus: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
  user: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
  menu: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`,
  logout: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
  check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
  edit: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
  clock: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
  home: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
  globe: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`
};

/**
 * Universal Auth State Listener
 */
export function listenToAuth(callback) {
  if (auth && !isDemoMode) {
    return onAuthStateChanged(auth, callback);
  } else {
    // Demo Mode listener
    const notifyCurrent = () => {
      const u = mockStore.getCurrentUser();
      callback(u);
    };
    notifyCurrent();
    const handler = (e) => callback(e.detail);
    window.addEventListener("work_connect_auth_change", handler);
    return () => window.removeEventListener("work_connect_auth_change", handler);
  }
}

/**
 * Perform Universal Logout
 */
export async function logoutUser() {
  try {
    if (auth && !isDemoMode) {
      await fbSignOut(auth);
    } else {
      mockStore.setCurrentUser(null);
    }
    showToast("Logged out successfully.", "info");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 500);
  } catch (err) {
    console.error("Logout error:", err);
    showToast(t("err_network"), "error");
  }
}

/**
 * Page protection and auth guard
 */
export function protectPage({ requireAuth = true, pageName = "" }) {
  listenToAuth(async (user) => {
    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    if (!user) {
      if (requireAuth && currentPage !== "login.html" && currentPage !== "index.html") {
        window.location.href = "login.html";
      }
    } else {
      // User is authenticated
      if (currentPage === "login.html") {
        // Check if user has profile setup
        const hasProfile = await checkUserProfileExists(user.uid);
        if (hasProfile) {
          window.location.href = "home.html";
        } else {
          window.location.href = "profile-setup.html";
        }
      }
    }
  });
}

/**
 * Check if user profile document exists in Firestore or MockStore
 */
export async function checkUserProfileExists(uid) {
  if (auth && !isDemoMode) {
    try {
      const { doc, getDoc } = await import("./firebase-config.js");
      const { db } = await import("./firebase-config.js");
      const snap = await getDoc(doc(db, "users", uid));
      return snap.exists();
    } catch (e) {
      return false;
    }
  } else {
    const data = mockStore.getData();
    return !!(data.users && data.users[uid] && data.users[uid].name);
  }
}

/**
 * Get user profile document
 */
export async function getUserProfile(uid) {
  if (auth && !isDemoMode) {
    try {
      const { doc, getDoc } = await import("./firebase-config.js");
      const { db } = await import("./firebase-config.js");
      const snap = await getDoc(doc(db, "users", uid));
      return snap.exists() ? snap.data() : null;
    } catch (e) {
      console.error(e);
      return null;
    }
  } else {
    const data = mockStore.getData();
    return data.users ? data.users[uid] : null;
  }
}

/**
 * Render standard Header Navigation
 */
export function renderHeader(activePage = "") {
  const container = document.getElementById("app-header-container");
  if (!container) return;

  const currentLang = getAppLanguage();

  container.innerHTML = `
    <header class="app-header">
      <div class="container header-inner">
        <!-- Logo -->
        <a href="home.html" class="brand-link" title="Work Connect Home">
          <img src="assets/logo.svg" alt="Work Connect Logo" />
        </a>

        <!-- Desktop Navigation -->
        <ul class="nav-links" id="main-nav-links">
          <li>
            <a href="home.html" class="nav-link ${activePage === 'home' ? 'active' : ''}">
              ${icons.home}
              <span data-i18n="nav_home">${t("nav_home")}</span>
            </a>
          </li>
          <li>
            <a href="my-works.html" class="nav-link ${activePage === 'my-works' ? 'active' : ''}">
              ${icons.briefcase}
              <span data-i18n="nav_my_works">${t("nav_my_works")}</span>
            </a>
          </li>
          <li>
            <a href="my-applications.html" class="nav-link ${activePage === 'my-applications' ? 'active' : ''}">
              ${icons.check}
              <span data-i18n="nav_my_applications">${t("nav_my_applications")}</span>
            </a>
          </li>
          <li>
            <a href="profile.html" class="nav-link ${activePage === 'profile' ? 'active' : ''}">
              ${icons.user}
              <span data-i18n="nav_profile">${t("nav_profile")}</span>
            </a>
          </li>
        </ul>

        <!-- Right Actions -->
        <div class="nav-actions">
          <!-- Add Work Button -->
          <a href="add-work.html" class="btn-add-work-header">
            ${icons.plus}
            <span class="btn-text" data-i18n="nav_add_work">${t("nav_add_work")}</span>
          </a>

          <!-- User Avatar / Profile pill -->
          <div id="nav-user-profile-badge" class="user-profile-badge" title="Account">
            <div id="nav-user-avatar" class="avatar-initials">U</div>
          </div>

          <!-- Mobile Hamburger Toggle -->
          <button class="mobile-menu-btn" id="mobile-menu-toggle" aria-label="Toggle navigation">
            ${icons.menu}
          </button>
        </div>
      </div>
    </header>
  `;

  // Mobile menu toggle
  const toggleBtn = document.getElementById("mobile-menu-toggle");
  const navLinks = document.getElementById("main-nav-links");
  if (toggleBtn && navLinks) {
    toggleBtn.addEventListener("click", () => {
      navLinks.classList.toggle("open");
    });
  }

  // Populate user avatar
  listenToAuth((user) => {
    const avatarContainer = document.getElementById("nav-user-avatar");
    const profileBadge = document.getElementById("nav-user-profile-badge");
    if (!avatarContainer) return;

    if (user) {
      if (user.photoURL || user.photoUrl) {
        avatarContainer.outerHTML = `<img src="${user.photoURL || user.photoUrl}" class="user-avatar-img" alt="${user.displayName || 'User'}" />`;
      } else {
        const initials = (user.displayName || user.name || "User").charAt(0).toUpperCase();
        avatarContainer.textContent = initials;
      }

      if (profileBadge) {
        profileBadge.onclick = () => { window.location.href = "profile.html"; };
      }
    }
  });
}

/**
 * Render mobile bottom bar
 */
export function renderMobileBottomBar(activePage = "") {
  let bottomBar = document.querySelector(".mobile-bottom-bar");
  if (!bottomBar) {
    bottomBar = document.createElement("nav");
    bottomBar.className = "mobile-bottom-bar";
    document.body.appendChild(bottomBar);
  }

  bottomBar.innerHTML = `
    <a href="home.html" class="bottom-bar-item ${activePage === 'home' ? 'active' : ''}">
      ${icons.home}
      <span data-i18n="nav_home">${t("nav_home")}</span>
    </a>
    <a href="my-works.html" class="bottom-bar-item ${activePage === 'my-works' ? 'active' : ''}">
      ${icons.briefcase}
      <span data-i18n="nav_my_works">${t("nav_my_works")}</span>
    </a>
    <a href="add-work.html" class="bottom-bar-item bottom-bar-add" title="${t("nav_add_work")}">
      ${icons.plus}
    </a>
    <a href="my-applications.html" class="bottom-bar-item ${activePage === 'my-applications' ? 'active' : ''}">
      ${icons.check}
      <span data-i18n="nav_my_applications">${t("nav_my_applications")}</span>
    </a>
    <a href="profile.html" class="bottom-bar-item ${activePage === 'profile' ? 'active' : ''}">
      ${icons.user}
      <span data-i18n="nav_profile">${t("nav_profile")}</span>
    </a>
  `;
}

/**
 * Global Toast Notifications
 */
export function showToast(message, type = "info", duration = 3500) {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button class="toast-close" aria-label="Close notification">&times;</button>
  `;

  container.appendChild(toast);

  const removeToast = () => {
    toast.style.animation = "fadeOutToast 0.25s ease forwards";
    setTimeout(() => toast.remove(), 250);
  };

  toast.querySelector(".toast-close").addEventListener("click", removeToast);
  setTimeout(removeToast, duration);
}

/**
 * Universal Confirmation Dialog
 */
export function confirmDialog({ title, message, confirmText = "Confirm", cancelText = "Cancel", onConfirm, isDanger = false }) {
  let backdrop = document.getElementById("global-confirm-modal");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "global-confirm-modal";
    backdrop.className = "modal-backdrop";
    document.body.appendChild(backdrop);
  }

  backdrop.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close-btn" id="modal-btn-cancel-top">&times;</button>
      </div>
      <div class="modal-body">
        <p style="color: var(--text-body); font-size: 1rem; line-height: 1.5;">${message}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="modal-btn-cancel">${cancelText}</button>
        <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" id="modal-btn-ok">${confirmText}</button>
      </div>
    </div>
  `;

  const close = () => {
    backdrop.classList.remove("active");
  };

  backdrop.querySelector("#modal-btn-cancel").onclick = close;
  backdrop.querySelector("#modal-btn-cancel-top").onclick = close;
  backdrop.querySelector("#modal-btn-ok").onclick = () => {
    close();
    if (typeof onConfirm === "function") onConfirm();
  };

  requestAnimationFrame(() => backdrop.classList.add("active"));
}

/**
 * Optional Modal to easily input or paste Firebase Configuration
 */
export function showFirebaseConfigModal() {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop active";
  backdrop.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3 class="modal-title">Firebase Web Configuration</h3>
        <button class="modal-close-btn" id="close-cfg-modal">&times;</button>
      </div>
      <div class="modal-body">
        <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">
          You can paste your Firebase configuration object below. This saves it to your browser and connects directly to your live Firebase Cloud Firestore & Auth!
        </p>
        <div class="form-group">
          <label class="form-label">Firebase Config JSON / JS Object:</label>
          <textarea id="cfg-json-input" class="form-control" rows="7" placeholder='{\n  "apiKey": "AIzaSy...",\n  "authDomain": "...",\n  "projectId": "..."\n}'></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="cancel-cfg-modal">Cancel</button>
        <button class="btn btn-primary" id="save-cfg-btn">Save & Reload</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.querySelector("#close-cfg-modal").onclick = close;
  backdrop.querySelector("#cancel-cfg-modal").onclick = close;

  backdrop.querySelector("#save-cfg-btn").onclick = () => {
    const raw = backdrop.querySelector("#cfg-json-input").value.trim();
    if (!raw) return;
    try {
      // Clean up js object notation to json if needed
      const clean = raw.replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":');
      const parsed = JSON.parse(clean);
      if (!parsed.apiKey || !parsed.projectId) {
        alert("Please include at least apiKey and projectId.");
        return;
      }
      localStorage.setItem("work_connect_firebase_config", JSON.stringify(parsed));
      window.location.reload();
    } catch (e) {
      alert("Invalid JSON format. Please paste a valid JSON object.");
    }
  };
}

/**
 * Format timestamp nicely into relative or local date
 */
export function formatDate(timestamp) {
  if (!timestamp) return "Recently";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date.getTime())) return "Recently";

  const diffHours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${Math.floor(diffHours)} hours ago`;
  if (diffHours < 48) return "Yesterday";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// Auto-translate page elements when DOM loads
document.addEventListener("DOMContentLoaded", () => {
  applyPageTranslations();
});
