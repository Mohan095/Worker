/**
 * WORK CONNECT - WORKS CONTROLLER
 * 24-Hour Expiry Engine, Available Work Feed, Search, Live Countdown,
 * Work Posting, Owner Management, and Direct Reposting.
 */

import {
  auth,
  db,
  isDemoMode,
  mockStore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from "./firebase-config.js";
import { listenToAuth, showToast, confirmDialog, icons, getUserProfile } from "./common.js";
import { isValidMobile } from "./profile.js";

/**
 * Extract authoritative JavaScript Date from Firestore Timestamp or String
 */
export function getExpiryDate(work) {
  if (!work || !work.expiresAt) return null;
  if (typeof work.expiresAt.toDate === "function") {
    return work.expiresAt.toDate();
  }
  const d = new Date(work.expiresAt);
  return isNaN(d.getTime()) ? null : d;
}

export function getCreatedDate(work) {
  if (!work || !work.createdAt) return new Date();
  if (typeof work.createdAt.toDate === "function") {
    return work.createdAt.toDate();
  }
  const d = new Date(work.createdAt);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Determine if a work is currently active and within its 24-hour expiry window
 */
export function isWorkAvailable(work) {
  if (!work || work.status !== "active") return false;
  const expDate = getExpiryDate(work);
  if (!expDate) return false;
  return expDate.getTime() > Date.now();
}

/**
 * Format remaining time for live countdown
 */
export function formatRemainingTime(expiresAt) {
  if (!expiresAt) return "Expired";
  const expDate = typeof expiresAt.toDate === "function" ? expiresAt.toDate() : new Date(expiresAt);
  const diffMs = expDate.getTime() - Date.now();
  if (diffMs <= 0) return "Expired";

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
}

/**
 * Format relative posted time (e.g. "2 hours ago")
 */
export function formatPostedTime(createdAt) {
  if (!createdAt) return "Recently";
  const date = typeof createdAt.toDate === "function" ? createdAt.toDate() : new Date(createdAt);
  if (isNaN(date.getTime())) return "Recently";

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Initialize Available Work Feed (home.html)
 * Displays ONLY currently available posts (status == "active" and current time < expiresAt)
 */
export function initHomeWorksFeed() {
  const container = document.getElementById("works-grid-container");
  const searchInput = document.getElementById("search-works-input");
  const categoryChips = document.querySelectorAll(".chip-btn");
  if (!container) return;

  let allWorks = [];
  let selectedCategory = "all";
  let searchQuery = "";
  let countdownTimer = null;

  function renderWorks() {
    const now = Date.now();

    // 1. Strict Filter: Only status == "active" AND current time < expiresAt
    const activeWorks = allWorks.filter((w) => {
      const expDate = getExpiryDate(w);
      if (!expDate) return false;
      return w.status === "active" && expDate.getTime() > now;
    });

    // 2. Filter by Category
    const categoryFiltered = activeWorks.filter((w) => {
      if (selectedCategory === "all") return true;
      return (w.category || "").toLowerCase() === selectedCategory.toLowerCase();
    });

    // 3. Search Filter: search ONLY active, non-expired works
    // Search fields: Worker Owner Name, Work City, Work State, Category, Address, Detailed Work
    const finalWorks = categoryFiltered.filter((w) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const ownerMatch = (w.ownerName || "").toLowerCase().includes(q);
      const cityMatch = (w.workCity || "").toLowerCase().includes(q);
      const stateMatch = (w.workState || "").toLowerCase().includes(q);
      const catMatch = (w.category || "").toLowerCase().includes(q);
      const addrMatch = (w.workAddress || "").toLowerCase().includes(q);
      const detailsMatch = (w.details || "").toLowerCase().includes(q);
      return ownerMatch || cityMatch || stateMatch || catMatch || addrMatch || detailsMatch;
    });

    // Empty State (Requirement 21)
    if (finalWorks.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">⏳</div>
          <h3 class="empty-state-title">NO AVAILABLE WORK</h3>
          <p class="empty-state-desc">There are currently no active work posts.</p>
          <div style="display: flex; gap: 0.75rem; justify-content: center; margin-top: 1.25rem;">
            <button class="btn btn-secondary" id="btn-empty-refresh">REFRESH</button>
            <a href="add-work.html" class="btn btn-primary">POST NEW WORK</a>
          </div>
        </div>
      `;

      const refreshBtn = document.getElementById("btn-empty-refresh");
      if (refreshBtn) {
        refreshBtn.onclick = () => window.location.reload();
      }
      return;
    }

    container.innerHTML = finalWorks
      .map((work) => {
        const workId = work.workId || work.id;
        const applicantCount = work.applicantsCount || 0;
        const remainingStr = formatRemainingTime(work.expiresAt);
        const postedStr = formatPostedTime(work.createdAt);
        const locationText = [work.workCity, work.workState].filter(Boolean).join(", ") || "Location not specified";

        return `
          <div class="work-card" id="card-${workId}" data-work-id="${workId}">
            <div>
              <div class="work-card-header">
                <span class="badge badge-primary" style="font-size: 0.85rem; padding: 0.35rem 0.85rem;">
                  ${escapeHtml(work.category || "General")}
                </span>
                <span class="countdown-badge" id="countdown-${workId}" title="Remaining 24-hour time">
                  ⏱ Available for: <strong class="time-text">${remainingStr}</strong>
                </span>
              </div>

              <div style="margin-bottom: 0.85rem;">
                <h3 class="work-card-title">${escapeHtml(work.category || "General")} Work</h3>
                <div style="font-size: 0.95rem; color: var(--text-main); margin-top: 4px;">
                  Owner: <strong>${escapeHtml(work.ownerName || "Employer")}</strong>
                </div>
              </div>

              <div class="work-meta-list">
                <div class="work-meta-item">
                  ${icons.mapPin}
                  <span>Location: <strong>${escapeHtml(locationText)}</strong></span>
                </div>
                <div class="work-meta-item">
                  ${icons.briefcase}
                  <span>Address: ${escapeHtml(work.workAddress || "Address provided upon contact")}</span>
                </div>
                <div class="work-meta-item">
                  ${icons.clock}
                  <span>Posted: ${postedStr}</span>
                </div>
              </div>

              <div class="work-card-desc">
                <strong>Details:</strong> ${escapeHtml(work.details || "No additional description provided.")}
              </div>
            </div>

            <div class="work-card-footer">
              <div class="work-posted-by">
                👥 ${applicantCount} applicant${applicantCount === 1 ? '' : 's'}
              </div>

              <div class="work-card-actions">
                <a href="work-details.html?id=${workId}" class="btn btn-secondary btn-sm" id="btn-view-${workId}">
                  VIEW DETAILS
                </a>
                <a href="work-details.html?id=${workId}&apply=true" class="btn btn-primary btn-sm" id="btn-apply-${workId}">
                  APPLY
                </a>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // Live Countdown Timer (Requirement 7)
  // Updates remaining time continuously. When it reaches zero, immediately hides/removes card and disables Apply.
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    let hasExpiredAny = false;
    const now = Date.now();

    for (let i = allWorks.length - 1; i >= 0; i--) {
      const w = allWorks[i];
      const expDate = getExpiryDate(w);
      if (!expDate) continue;

      const diffMs = expDate.getTime() - now;
      const workId = w.workId || w.id;
      const cardEl = document.getElementById(`card-${workId}`);

      if (diffMs <= 0) {
        // Expiry reached! Remove card immediately from Available Work
        if (cardEl) {
          cardEl.style.transition = "opacity 0.3s ease, transform 0.3s ease";
          cardEl.style.opacity = "0";
          cardEl.style.transform = "scale(0.95)";
          setTimeout(() => cardEl.remove(), 300);
        }
        allWorks.splice(i, 1);
        hasExpiredAny = true;
      } else {
        // Update live countdown display
        const badge = document.getElementById(`countdown-${workId}`);
        if (badge) {
          const timeText = badge.querySelector(".time-text");
          if (timeText) {
            timeText.textContent = formatRemainingTime(w.expiresAt);
          }
        }
      }
    }

    if (hasExpiredAny) {
      renderWorks();
    }
  }, 1000);

  // Firestore or Mock store live subscription
  if (!isDemoMode && db) {
    const q = query(
      collection(db, "works"),
      where("status", "==", "active"),
      orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {
      allWorks = [];
      const now = Date.now();

      snapshot.forEach((d) => {
        const item = { id: d.id, workId: d.id, ...d.data() };
        const expDate = getExpiryDate(item);
        // Only load active and non-expired works
        if (expDate && expDate.getTime() > now) {
          allWorks.push(item);
        }
      });
      renderWorks();
    }, (err) => {
      // Fallback query if composite index is deploying
      const fallbackQ = query(collection(db, "works"));
      onSnapshot(fallbackQ, (s) => {
        allWorks = [];
        const now = Date.now();
        s.forEach((d) => {
          const item = { id: d.id, workId: d.id, ...d.data() };
          const expDate = getExpiryDate(item);
          if (item.status === "active" && expDate && expDate.getTime() > now) {
            allWorks.push(item);
          }
        });
        allWorks.sort((a, b) => {
          const tA = getCreatedDate(a).getTime();
          const tB = getCreatedDate(b).getTime();
          return tB - tA;
        });
        renderWorks();
      });
    });
  } else {
    // Mock Store Real-time listener
    const updateFromMock = (data) => {
      const worksObj = data.works || {};
      const now = Date.now();
      allWorks = Object.values(worksObj)
        .filter((w) => {
          const expDate = getExpiryDate(w);
          return w.status === "active" && expDate && expDate.getTime() > now;
        })
        .sort((a, b) => getCreatedDate(b).getTime() - getCreatedDate(a).getTime());
      renderWorks();
    };
    updateFromMock(mockStore.getData());
    mockStore.subscribe(updateFromMock);
  }

  // Search input handler
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      renderWorks();
    });
  }

  // Category chips
  categoryChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      categoryChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      selectedCategory = chip.getAttribute("data-category") || "all";
      renderWorks();
    });
  });
}

/**
 * Initialize Add Work Page (add-work.html)
 * Form: Worker Owner Name, Work City, Work State, Work Address,
 * Mobile Number 1, Mobile Number 2, Category, Detailed Work.
 * Expiry: Exactly 24 hours from creation.
 */
export function initAddWorkPage() {
  const form = document.getElementById("add-work-form");
  const submitBtn = document.getElementById("btn-submit-work");
  const formSection = document.getElementById("post-work-section");
  const successSection = document.getElementById("post-success-section");
  const successViewBtn = document.getElementById("btn-success-view-work");
  if (!form || !submitBtn) return;

  const urlParams = new URLSearchParams(window.location.search);
  const repostId = urlParams.get("repost");

  listenToAuth(async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    const profile = await getUserProfile(user.uid);
    const ownerNameInput = document.getElementById("input-owner-name");
    const mob1Input = document.getElementById("input-mobile-1");

    // Auto-fill from profile
    if (ownerNameInput && !ownerNameInput.value) {
      ownerNameInput.value = profile?.name || user.displayName || "";
    }
    if (mob1Input && !mob1Input.value && profile?.mobile) {
      mob1Input.value = profile.mobile;
    }

    // Pre-fill if reposting an existing work
    if (repostId) {
      let previousWork = null;
      if (!isDemoMode && db) {
        try {
          const snap = await getDoc(doc(db, "works", repostId));
          if (snap.exists()) previousWork = snap.data();
        } catch (e) { /* silent */ }
      } else {
        const d = mockStore.getData();
        previousWork = d.works ? d.works[repostId] : null;
      }

      if (previousWork) {
        if (ownerNameInput) ownerNameInput.value = previousWork.ownerName || "";
        const cityIn = document.getElementById("input-work-city");
        const stateIn = document.getElementById("input-work-state");
        const addrIn = document.getElementById("input-work-address");
        const mob2In = document.getElementById("input-mobile-2");
        const catIn = document.getElementById("select-category");
        const detailsIn = document.getElementById("input-work-details");

        if (cityIn) cityIn.value = previousWork.workCity || "";
        if (stateIn) stateIn.value = previousWork.workState || "";
        if (addrIn) addrIn.value = previousWork.workAddress || "";
        if (mob1Input) mob1Input.value = previousWork.mobile1 || "";
        if (mob2In) mob2In.value = previousWork.mobile2 || "";
        if (catIn) catIn.value = previousWork.category || "";
        if (detailsIn) detailsIn.value = previousWork.details || "";
      }
    }

    form.onsubmit = async (e) => {
      e.preventDefault();

      const ownerName = document.getElementById("input-owner-name").value.trim();
      const workCity = document.getElementById("input-work-city").value.trim();
      const workState = document.getElementById("input-work-state").value.trim();
      const workAddress = document.getElementById("input-work-address").value.trim();
      const mobile1 = document.getElementById("input-mobile-1").value.trim();
      const mobile2 = document.getElementById("input-mobile-2").value.trim();
      const category = document.getElementById("select-category").value;
      const details = document.getElementById("input-work-details").value.trim();

      // Field Validation (Requirement 2)
      if (!ownerName) {
        showToast("Please enter Worker Owner Name.", "error");
        document.getElementById("input-owner-name").focus();
        return;
      }
      if (!workCity) {
        showToast("Please enter Work City.", "error");
        document.getElementById("input-work-city").focus();
        return;
      }
      if (!workState) {
        showToast("Please enter Work State.", "error");
        document.getElementById("input-work-state").focus();
        return;
      }
      if (!workAddress) {
        showToast("Please enter Work Address.", "error");
        document.getElementById("input-work-address").focus();
        return;
      }
      if (!mobile1) {
        showToast("Please enter Mobile Number 1.", "error");
        document.getElementById("input-mobile-1").focus();
        return;
      }
      if (!isValidMobile(mobile1)) {
        showToast("Mobile Number 1 must be a valid 10-digit Indian mobile number.", "error");
        document.getElementById("input-mobile-1").focus();
        return;
      }
      if (mobile2 && !isValidMobile(mobile2)) {
        showToast("Mobile Number 2 must be a valid 10-digit Indian mobile number.", "error");
        document.getElementById("input-mobile-2").focus();
        return;
      }
      if (!category) {
        showToast("Please select a Category from the dropdown.", "error");
        document.getElementById("select-category").focus();
        return;
      }
      if (!details) {
        showToast("Please provide Detailed Work description.", "error");
        document.getElementById("input-work-details").focus();
        return;
      }

      // Prevent duplicate submit clicks
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner spinner-sm"></span> Posting Work...`;

      try {
        // Expiry calculation: exactly 24 hours from creation (Requirement 4 & 5)
        const expiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const workData = {
          ownerId: user.uid,
          ownerName,
          workCity,
          workState,
          workAddress,
          mobile1,
          mobile2: mobile2 || "",
          category,
          details,
          status: "active",
          applicantsCount: 0,
          createdAt: isDemoMode ? new Date().toISOString() : serverTimestamp(),
          expiresAt: isDemoMode ? expiryDate.toISOString() : Timestamp.fromDate(expiryDate)
        };

        let newWorkId = "";

        if (!isDemoMode && db) {
          const docRef = await addDoc(collection(db, "works"), workData);
          newWorkId = docRef.id;
          await updateDoc(docRef, { workId: newWorkId });
        } else {
          newWorkId = "work-" + Date.now();
          workData.workId = newWorkId;
          workData.id = newWorkId;
          const currentData = mockStore.getData();
          if (!currentData.works) currentData.works = {};
          currentData.works[newWorkId] = workData;
          mockStore.saveData(currentData);
        }

        // Show Success Confirmation View (Requirement 22)
        showToast("Work posted successfully! Available for 24 hours.", "success");

        if (formSection && successSection) {
          formSection.style.display = "none";
          successSection.style.display = "block";
          if (successViewBtn) {
            successViewBtn.href = `work-details.html?id=${newWorkId}`;
          }
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          setTimeout(() => {
            window.location.href = `work-details.html?id=${newWorkId}`;
          }, 800);
        }
      } catch (err) {
        showToast("Failed to post work. Please try again.", "error");
        submitBtn.disabled = false;
        submitBtn.innerHTML = "POST WORK";
      }
    };
  });
}

/**
 * Initialize My Works Manager (my-works.html)
 * Displays two sections: ACTIVE WORKS and EXPIRED WORKS
 * Supports: View, Edit, Applicants, Deactivate, Post Again (brand new 24h work)
 */
export function initMyWorksPage() {
  const activeList = document.getElementById("my-active-works-list");
  const expiredList = document.getElementById("my-expired-works-list");
  const activeCountBadge = document.getElementById("active-works-count");
  const expiredCountBadge = document.getElementById("expired-works-count");
  const editModal = document.getElementById("edit-work-modal");
  const editForm = document.getElementById("edit-work-form");
  if (!activeList || !expiredList) return;

  listenToAuth(async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    async function loadAndRender() {
      let myWorks = [];

      if (!isDemoMode && db) {
        try {
          const q = query(
            collection(db, "works"),
            where("ownerId", "==", user.uid)
          );
          const snap = await getDocs(q);
          snap.forEach((d) => {
            myWorks.push({ id: d.id, workId: d.id, ...d.data() });
          });
        } catch (e) {
          // Fallback if index not ready
          try {
            const snap = await getDocs(collection(db, "works"));
            snap.forEach((d) => {
              const data = d.data();
              if (data.ownerId === user.uid) {
                myWorks.push({ id: d.id, workId: d.id, ...data });
              }
            });
          } catch (err) { /* silent */ }
        }
      } else {
        const data = mockStore.getData();
        const all = Object.values(data.works || {});
        myWorks = all.filter((w) => w.ownerId === user.uid);
      }

      // Sort latest created first
      myWorks.sort((a, b) => getCreatedDate(b).getTime() - getCreatedDate(a).getTime());

      const now = Date.now();
      const activeWorks = [];
      const expiredWorks = [];

      // Separation of Active and Expired (Requirement 12)
      for (const w of myWorks) {
        const expDate = getExpiryDate(w);
        const isPastExpiry = expDate && expDate.getTime() <= now;

        if (w.status === "active" && !isPastExpiry) {
          activeWorks.push(w);
        } else {
          // It is expired or inactive
          expiredWorks.push(w);
          // Passive Database Cleanup: Mark expired in DB if still marked "active"
          if (w.status === "active" && isPastExpiry) {
            markWorkAsExpiredInDb(w.workId || w.id);
            w.status = "expired";
          }
        }
      }

      if (activeCountBadge) activeCountBadge.textContent = activeWorks.length;
      if (expiredCountBadge) expiredCountBadge.textContent = expiredWorks.length;

      // 1. Render Active Works
      if (activeWorks.length === 0) {
        activeList.innerHTML = `
          <div class="empty-state" style="padding: 2rem 1rem;">
            <p style="color: var(--text-muted); margin-bottom: 1rem;">No active works right now.</p>
            <a href="add-work.html" class="btn btn-primary btn-sm">${icons.plus} Post New Work</a>
          </div>
        `;
      } else {
        activeList.innerHTML = activeWorks
          .map((work) => {
            const workId = work.workId || work.id;
            const remainingStr = formatRemainingTime(work.expiresAt);
            const locationText = [work.workCity, work.workState].filter(Boolean).join(", ");

            return `
              <div class="my-work-card" id="my-work-${workId}">
                <div class="my-work-top-row">
                  <div class="my-work-title-group">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                      <span class="badge badge-primary">${escapeHtml(work.category || "General")}</span>
                      <span class="badge badge-success">Active</span>
                      <span class="countdown-badge" style="font-size: 0.785rem;">⏱ ${remainingStr}</span>
                    </div>
                    <h3>${escapeHtml(work.category || "General")} Work - ${escapeHtml(work.ownerName || "")}</h3>
                    <div class="my-work-location">
                      ${icons.mapPin} ${escapeHtml(locationText)} • ${escapeHtml(work.workAddress || "")}
                    </div>
                  </div>
                  <div class="badge badge-primary">
                    👥 ${work.applicantsCount || 0} applicants
                  </div>
                </div>

                <div style="font-size: 0.85rem; color: var(--text-muted);">
                  ${icons.clock} Posted: ${formatPostedTime(work.createdAt)}
                </div>

                <div class="my-work-action-toolbar">
                  <a href="work-details.html?id=${workId}" class="btn btn-secondary btn-sm">
                    ${icons.briefcase} VIEW
                  </a>
                  <button class="btn btn-secondary btn-sm btn-edit-work" data-id="${workId}">
                    ${icons.edit} EDIT
                  </button>
                  <button class="btn btn-outline-primary btn-sm btn-view-applicants" data-id="${workId}" data-title="${escapeHtml(work.category)} Work">
                    👥 APPLICANTS (${work.applicantsCount || 0})
                  </button>
                  <button class="btn btn-secondary btn-sm btn-deactivate-work" data-id="${workId}">
                    DEACTIVATE
                  </button>
                </div>
              </div>
            `;
          })
          .join("");
      }

      // 2. Render Expired Works
      if (expiredWorks.length === 0) {
        expiredList.innerHTML = `
          <div class="empty-state" style="padding: 2rem 1rem;">
            <p style="color: var(--text-muted);">No expired works.</p>
          </div>
        `;
      } else {
        expiredList.innerHTML = expiredWorks
          .map((work) => {
            const workId = work.workId || work.id;
            const locationText = [work.workCity, work.workState].filter(Boolean).join(", ");

            return `
              <div class="my-work-card status-inactive" id="my-work-${workId}">
                <div class="my-work-top-row">
                  <div class="my-work-title-group">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                      <span class="badge badge-primary">${escapeHtml(work.category || "General")}</span>
                      <span class="badge badge-danger">EXPIRED</span>
                    </div>
                    <h3 style="color: var(--text-muted);">${escapeHtml(work.category || "General")} Work - ${escapeHtml(work.ownerName || "")}</h3>
                    <div class="my-work-location">
                      ${icons.mapPin} ${escapeHtml(locationText)} • ${escapeHtml(work.workAddress || "")}
                    </div>
                  </div>
                  <div class="badge badge-secondary">
                    👥 ${work.applicantsCount || 0} applicants
                  </div>
                </div>

                <div style="font-size: 0.85rem; color: var(--text-muted);">
                  ${icons.clock} Closed after 24 hours
                </div>

                <div class="my-work-action-toolbar">
                  <a href="work-details.html?id=${workId}" class="btn btn-secondary btn-sm">
                    ${icons.briefcase} VIEW
                  </a>
                  <button class="btn btn-primary btn-sm btn-post-again" data-id="${workId}">
                    ⏱ POST AGAIN
                  </button>
                  <button class="btn btn-outline-danger btn-sm btn-delete-work" data-id="${workId}">
                    ${icons.trash} DELETE
                  </button>
                </div>
              </div>
            `;
          })
          .join("");
      }

      // Attach Event Handlers

      // 1. EDIT WORK
      document.querySelectorAll(".btn-edit-work").forEach((b) => {
        b.addEventListener("click", () => {
          const id = b.getAttribute("data-id");
          const target = myWorks.find((w) => (w.workId || w.id) === id);
          if (!target) return;

          document.getElementById("edit-work-id").value = id;
          document.getElementById("edit-owner-name").value = target.ownerName || "";
          document.getElementById("edit-work-city").value = target.workCity || "";
          document.getElementById("edit-work-state").value = target.workState || "";
          document.getElementById("edit-work-address").value = target.workAddress || "";
          document.getElementById("edit-mobile-1").value = target.mobile1 || "";
          document.getElementById("edit-mobile-2").value = target.mobile2 || "";
          document.getElementById("edit-category").value = target.category || "Other";
          document.getElementById("edit-work-details").value = target.details || "";

          editModal.classList.add("active");
        });
      });

      // 2. DEACTIVATE WORK
      document.querySelectorAll(".btn-deactivate-work").forEach((b) => {
        b.addEventListener("click", () => {
          const id = b.getAttribute("data-id");
          confirmDialog({
            title: "Deactivate Work",
            message: "Are you sure you want to deactivate this work post? It will immediately stop accepting applications and move to expired.",
            confirmText: "Deactivate",
            isDanger: true,
            onConfirm: async () => {
              await toggleWorkStatus(id, "inactive");
              loadAndRender();
            }
          });
        });
      });

      // 3. POST AGAIN (Requirement 12)
      // "POST AGAIN must create a NEW work document with a NEW 24-hour expiry period."
      document.querySelectorAll(".btn-post-again").forEach((b) => {
        b.addEventListener("click", () => {
          const id = b.getAttribute("data-id");
          const target = myWorks.find((w) => (w.workId || w.id) === id);
          if (!target) return;

          confirmDialog({
            title: "POST AGAIN",
            message: "Do you want to post this work again? A brand new work post with a new 24-hour expiry period will be published.",
            confirmText: "Post for 24 Hours",
            onConfirm: async () => {
              b.disabled = true;
              b.innerHTML = `<span class="spinner spinner-sm"></span> Posting...`;
              await repostWorkAsNew(target);
              loadAndRender();
            }
          });
        });
      });

      // 4. DELETE WORK
      document.querySelectorAll(".btn-delete-work").forEach((b) => {
        b.addEventListener("click", () => {
          const id = b.getAttribute("data-id");
          confirmDialog({
            title: "Delete Work",
            message: "Permanently delete this work post and remove its record?",
            confirmText: "Delete",
            isDanger: true,
            onConfirm: async () => {
              await deleteWorkPost(id);
              loadAndRender();
            }
          });
        });
      });

      // 5. APPLICANTS REVIEW
      document.querySelectorAll(".btn-view-applicants").forEach((b) => {
        b.addEventListener("click", () => {
          const id = b.getAttribute("data-id");
          const title = b.getAttribute("data-title");
          openApplicantsModal(id, title);
        });
      });
    }

    loadAndRender();

    // Close edit modal
    const closeEdit = () => editModal.classList.remove("active");
    const closeBtn = document.getElementById("btn-close-edit-work");
    const cancelBtn = document.getElementById("btn-cancel-edit-work");
    if (closeBtn) closeBtn.onclick = closeEdit;
    if (cancelBtn) cancelBtn.onclick = closeEdit;

    // Handle Edit Submit
    if (editForm) {
      editForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById("edit-work-id").value;
        const ownerName = document.getElementById("edit-owner-name").value.trim();
        const workCity = document.getElementById("edit-work-city").value.trim();
        const workState = document.getElementById("edit-work-state").value.trim();
        const workAddress = document.getElementById("edit-work-address").value.trim();
        const mobile1 = document.getElementById("edit-mobile-1").value.trim();
        const mobile2 = document.getElementById("edit-mobile-2").value.trim();
        const category = document.getElementById("edit-category").value;
        const details = document.getElementById("edit-work-details").value.trim();

        if (!ownerName || !workCity || !workState || !workAddress || !mobile1 || !details) {
          showToast("Please fill in all required fields.", "error");
          return;
        }

        if (!isValidMobile(mobile1)) {
          showToast("Mobile Number 1 must be 10 digits.", "error");
          return;
        }

        if (mobile2 && !isValidMobile(mobile2)) {
          showToast("Mobile Number 2 must be 10 digits.", "error");
          return;
        }

        const saveBtn = document.getElementById("btn-save-edit-work");
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span class="spinner spinner-sm"></span> Saving...`;

        try {
          const updates = {
            ownerName,
            workCity,
            workState,
            workAddress,
            mobile1,
            mobile2: mobile2 || "",
            category,
            details,
            updatedAt: isDemoMode ? new Date().toISOString() : serverTimestamp()
          };

          if (!isDemoMode && db) {
            await updateDoc(doc(db, "works", id), updates);
          } else {
            const data = mockStore.getData();
            if (data.works && data.works[id]) {
              Object.assign(data.works[id], updates);
              mockStore.saveData(data);
            }
          }

          showToast("Work updated successfully.", "success");
          closeEdit();
          saveBtn.disabled = false;
          saveBtn.innerHTML = "Save Changes";
          loadAndRender();
        } catch (err) {
          showToast("Failed to save changes.", "error");
          saveBtn.disabled = false;
          saveBtn.innerHTML = "Save Changes";
        }
      };
    }
  });
}

/**
 * Creates a NEW work document with a NEW 24-hour expiry period (Requirement 12)
 */
async function repostWorkAsNew(originalWork) {
  try {
    const expiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const newWorkData = {
      ownerId: originalWork.ownerId,
      ownerName: originalWork.ownerName || "",
      workCity: originalWork.workCity || "",
      workState: originalWork.workState || "",
      workAddress: originalWork.workAddress || "",
      mobile1: originalWork.mobile1 || "",
      mobile2: originalWork.mobile2 || "",
      category: originalWork.category || "Other",
      details: originalWork.details || "",
      status: "active",
      applicantsCount: 0,
      createdAt: isDemoMode ? new Date().toISOString() : serverTimestamp(),
      expiresAt: isDemoMode ? expiryDate.toISOString() : Timestamp.fromDate(expiryDate)
    };

    if (!isDemoMode && db) {
      const docRef = await addDoc(collection(db, "works"), newWorkData);
      await updateDoc(docRef, { workId: docRef.id });
    } else {
      const genId = "work-" + Date.now();
      newWorkData.workId = genId;
      newWorkData.id = genId;
      const d = mockStore.getData();
      if (!d.works) d.works = {};
      d.works[genId] = newWorkData;
      mockStore.saveData(d);
    }

    showToast("Work posted again with a fresh 24-hour timer!", "success");
  } catch (err) {
    showToast("Could not repost work.", "error");
  }
}

/**
 * Toggle status of a work
 */
async function toggleWorkStatus(workId, newStatus) {
  try {
    if (!isDemoMode && db) {
      await updateDoc(doc(db, "works", workId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } else {
      const d = mockStore.getData();
      if (d.works && d.works[workId]) {
        d.works[workId].status = newStatus;
        mockStore.saveData(d);
      }
    }
    showToast(`Work status updated to ${newStatus}.`, "info");
  } catch (e) {
    showToast("Could not update status.", "error");
  }
}

/**
 * Mark work as expired in DB
 */
async function markWorkAsExpiredInDb(workId) {
  try {
    if (!isDemoMode && db) {
      await updateDoc(doc(db, "works", workId), { status: "expired" });
    } else {
      const d = mockStore.getData();
      if (d.works && d.works[workId]) {
        d.works[workId].status = "expired";
        mockStore.saveData(d);
      }
    }
  } catch (e) { /* silent passive */ }
}

/**
 * Delete a work post
 */
async function deleteWorkPost(workId) {
  try {
    if (!isDemoMode && db) {
      await deleteDoc(doc(db, "works", workId));
    } else {
      const d = mockStore.getData();
      if (d.works && d.works[workId]) {
        delete d.works[workId];
        mockStore.saveData(d);
      }
    }
    showToast("Work post deleted.", "info");
  } catch (e) {
    showToast("Could not delete work.", "error");
  }
}

/**
 * Open Applicants review modal (Requirement 14)
 * Shows: Applicant Name, Applicant Mobile, Applied Date, Status (pending, accepted, rejected)
 * Actions: [ ACCEPT ], [ REJECT ] (Only owner can change statuses)
 */
export async function openApplicantsModal(workId, workTitle) {
  const modal = document.getElementById("applicants-modal");
  const modalTitle = document.getElementById("applicants-modal-title");
  const listContainer = document.getElementById("applicants-modal-list");
  if (!modal || !listContainer) return;

  modalTitle.textContent = `APPLICANTS - ${workTitle || 'Work'}`;
  listContainer.innerHTML = `<div class="loading-container"><span class="spinner"></span></div>`;
  modal.classList.add("active");

  const closeBtn = document.getElementById("btn-close-applicants-modal");
  if (closeBtn) closeBtn.onclick = () => modal.classList.remove("active");

  let apps = [];
  if (!isDemoMode && db) {
    try {
      const q = query(
        collection(db, "applications"),
        where("workId", "==", workId)
      );
      const snap = await getDocs(q);
      snap.forEach((d) => apps.push({ id: d.id, applicationId: d.id, ...d.data() }));
    } catch (e) {
      // Fallback query
      try {
        const snap = await getDocs(collection(db, "applications"));
        snap.forEach((d) => {
          const item = d.data();
          if (item.workId === workId) apps.push({ id: d.id, applicationId: d.id, ...item });
        });
      } catch (err) { /* silent */ }
    }
  } else {
    const data = mockStore.getData();
    apps = Object.values(data.applications || {}).filter((a) => a.workId === workId);
  }

  // Sort latest applied first
  apps.sort((a, b) => getCreatedDate({ createdAt: b.appliedAt }).getTime() - getCreatedDate({ createdAt: a.appliedAt }).getTime());

  if (apps.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state" style="padding: 2.5rem 1rem;">
        <div class="empty-state-icon">👥</div>
        <h4 style="color: var(--text-main); margin-bottom: 0.5rem;">No Applicants Yet</h4>
        <p style="color: var(--text-muted); font-size: 0.9rem;">Applications submitted by workers will appear here.</p>
      </div>
    `;
    return;
  }

  function renderApplicantCards() {
    listContainer.innerHTML = apps
      .map((app) => {
        const appId = app.applicationId || app.id;
        const status = app.status || "pending";
        const dateStr = formatPostedTime(app.appliedAt);

        return `
          <div class="applicant-card" id="app-card-${appId}">
            <div class="applicant-profile">
              <div class="applicant-avatar">${(app.applicantName || "W").charAt(0).toUpperCase()}</div>
              <div class="applicant-details">
                <h4>${escapeHtml(app.applicantName || "Anonymous Worker")}</h4>
                <div class="applicant-contact-details">
                  <span>${icons.phone} <a href="tel:${app.applicantMobile}">${app.applicantMobile || "N/A"}</a></span>
                  <span>${icons.clock} Applied: ${dateStr}</span>
                </div>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span class="badge ${status === 'accepted' ? 'badge-success' : status === 'rejected' ? 'badge-danger' : 'badge-warning'}">
                ${status.toUpperCase()}
              </span>

              <div class="applicant-actions">
                ${status !== 'accepted' ? `
                  <button class="btn btn-success btn-sm btn-applicant-action" data-id="${appId}" data-status="accepted">
                    ACCEPT
                  </button>
                ` : ""}
                ${status !== 'rejected' ? `
                  <button class="btn btn-outline-danger btn-sm btn-applicant-action" data-id="${appId}" data-status="rejected">
                    REJECT
                  </button>
                ` : ""}
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    listContainer.querySelectorAll(".btn-applicant-action").forEach((b) => {
      b.addEventListener("click", async () => {
        const appId = b.getAttribute("data-id");
        const newStatus = b.getAttribute("data-status");
        await updateApplicationStatus(appId, newStatus);
        const target = apps.find((a) => (a.applicationId || a.id) === appId);
        if (target) target.status = newStatus;
        renderApplicantCards();
      });
    });
  }

  renderApplicantCards();
}

/**
 * Update application status by owner (Accept / Reject)
 */
async function updateApplicationStatus(applicationId, newStatus) {
  try {
    if (!isDemoMode && db) {
      await updateDoc(doc(db, "applications", applicationId), {
        status: newStatus
      });
    } else {
      const data = mockStore.getData();
      if (data.applications && data.applications[applicationId]) {
        data.applications[applicationId].status = newStatus;
        mockStore.saveData(data);
      }
    }
    showToast(`Application ${newStatus}.`, "success");
  } catch (err) {
    showToast("Failed to update application status.", "error");
  }
}

export function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
