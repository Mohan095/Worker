/**
 * WORK CONNECT - APPLICATIONS CONTROLLER
 * Work Details View, Real-Time 24-Hour Expiry Verification,
 * Duplicate-Safe Apply, Mobile/Desktop Contact Calling, and My Applications Tracker.
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
  query,
  where,
  increment,
  serverTimestamp
} from "./firebase-config.js";
import { listenToAuth, showToast, icons, getUserProfile } from "./common.js";
import { getExpiryDate, getCreatedDate, formatRemainingTime, escapeHtml } from "./works.js";

/**
 * Initialize Work Details Page (work-details.html)
 */
export function initWorkDetailsPage() {
  const container = document.getElementById("work-details-content");
  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const workId = urlParams.get("id");
  const autoApply = urlParams.get("apply") === "true";

  if (!workId) {
    container.innerHTML = `
      <div class="empty-state">
        <h3 class="empty-state-title">Invalid Request</h3>
        <p class="empty-state-desc">No work ID was specified in the link.</p>
        <a href="home.html" class="btn btn-primary">BACK TO AVAILABLE WORK</a>
      </div>
    `;
    return;
  }

  listenToAuth(async (user) => {
    let currentWork = null;

    // Load work data from Firestore or Mock Store
    if (!isDemoMode && db) {
      try {
        const snap = await getDoc(doc(db, "works", workId));
        if (snap.exists()) {
          currentWork = { id: snap.id, workId: snap.id, ...snap.data() };
        }
      } catch (e) {
        // Fallback search
        try {
          const allSnap = await getDocs(collection(db, "works"));
          allSnap.forEach((d) => {
            if (d.id === workId) currentWork = { id: d.id, workId: d.id, ...d.data() };
          });
        } catch (err) { /* silent */ }
      }
    } else {
      const data = mockStore.getData();
      currentWork = data.works ? data.works[workId] : null;
    }

    if (!currentWork) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3 class="empty-state-title">Work Not Found</h3>
          <p class="empty-state-desc">This work posting does not exist or may have been permanently removed.</p>
          <a href="home.html" class="btn btn-primary">BACK TO AVAILABLE WORK</a>
        </div>
      `;
      return;
    }

    // Check authoritative 24-hour expiry (Requirement 5, 9, 18)
    const expDate = getExpiryDate(currentWork);
    const createdDate = getCreatedDate(currentWork);
    const now = Date.now();
    const isExpired = currentWork.status !== "active" || !expDate || (expDate.getTime() <= now);

    // Check if the current logged-in user already applied
    let hasApplied = false;
    let existingApp = null;
    if (user) {
      if (!isDemoMode && db) {
        try {
          const q = query(
            collection(db, "applications"),
            where("workId", "==", workId),
            where("applicantId", "==", user.uid)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            hasApplied = true;
            existingApp = snap.docs[0].data();
          }
        } catch (e) {
          // Fallback check
          try {
            const snap = await getDocs(collection(db, "applications"));
            snap.forEach((d) => {
              const data = d.data();
              if (data.workId === workId && data.applicantId === user.uid) {
                hasApplied = true;
                existingApp = data;
              }
            });
          } catch (err) { /* silent */ }
        }
      } else {
        const data = mockStore.getData();
        const apps = Object.values(data.applications || {});
        existingApp = apps.find((a) => a.workId === workId && a.applicantId === user.uid);
        if (existingApp) hasApplied = true;
      }
    }

    const isOwner = user && user.uid === currentWork.ownerId;
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    const locationText = [currentWork.workCity, currentWork.workState].filter(Boolean).join(", ");
    const postedDateStr = createdDate.toLocaleString(undefined, {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
    const expiryDateStr = expDate ? expDate.toLocaleString(undefined, {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    }) : "Within 24 hours";

    // Render Work Details Page (Requirement 9 & 15)
    container.innerHTML = `
      <div class="work-details-header-card">
        <!-- Top Status & Expiry Bar -->
        <div class="work-details-top-bar">
          <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            <span class="badge badge-primary" style="font-size: 0.95rem; padding: 0.4rem 1rem;">
              ${escapeHtml(currentWork.category || "General")}
            </span>
            ${isExpired ? `
              <span class="badge badge-danger" style="font-size: 0.9rem; padding: 0.4rem 0.9rem; font-weight: 800;">
                WORK EXPIRED
              </span>
            ` : `
              <span class="badge badge-success" style="font-size: 0.9rem; padding: 0.4rem 0.9rem;">
                ACTIVE
              </span>
              <span class="countdown-badge" id="details-countdown-badge" style="font-size: 0.85rem;">
                ⏱ Available for: <strong id="details-time-remaining">${formatRemainingTime(currentWork.expiresAt)}</strong>
              </span>
            `}
          </div>

          <div style="font-size: 0.9rem; color: var(--text-muted);">
            👥 ${currentWork.applicantsCount || 0} applicant${currentWork.applicantsCount === 1 ? '' : 's'}
          </div>
        </div>

        <h1 class="work-details-title">
          ${escapeHtml(currentWork.category || "General")} Work
        </h1>

        <!-- Details Meta Grid -->
        <div class="work-details-meta-grid">
          <div class="detail-meta-box">
            <div class="meta-icon">${icons.user}</div>
            <div>
              <div class="meta-label">Worker Owner Name</div>
              <div class="meta-value">${escapeHtml(currentWork.ownerName || "Employer")}</div>
            </div>
          </div>

          <div class="detail-meta-box">
            <div class="meta-icon">${icons.briefcase}</div>
            <div>
              <div class="meta-label">Category</div>
              <div class="meta-value">${escapeHtml(currentWork.category || "General")}</div>
            </div>
          </div>

          <div class="detail-meta-box">
            <div class="meta-icon">${icons.mapPin}</div>
            <div>
              <div class="meta-label">Location (City, State)</div>
              <div class="meta-value">${escapeHtml(locationText || "Not specified")}</div>
            </div>
          </div>

          <div class="detail-meta-box">
            <div class="meta-icon">${icons.mapPin}</div>
            <div>
              <div class="meta-label">Work Address</div>
              <div class="meta-value">${escapeHtml(currentWork.workAddress || "Provided upon contact")}</div>
            </div>
          </div>

          <div class="detail-meta-box">
            <div class="meta-icon">${icons.clock}</div>
            <div>
              <div class="meta-label">Posted Date / Time</div>
              <div class="meta-value" style="font-size: 0.95rem;">${postedDateStr}</div>
            </div>
          </div>

          <div class="detail-meta-box">
            <div class="meta-icon">${icons.clock}</div>
            <div>
              <div class="meta-label">Expiry Date / Time</div>
              <div class="meta-value" style="font-size: 0.95rem; color: ${isExpired ? 'var(--danger)' : 'var(--text-main)'};">
                ${expiryDateStr}
              </div>
            </div>
          </div>
        </div>

        <!-- Detailed Work Section -->
        <div class="work-details-section">
          <h3>Detailed Work</h3>
          <div class="work-details-body-text">${escapeHtml(currentWork.details || "No additional details provided.")}</div>
        </div>

        <!-- Expired Notice Banner if expired -->
        ${isExpired ? `
          <div style="margin-top: 1.5rem; padding: 1.25rem; background: var(--danger-light); border: 1.5px solid #fecaca; border-radius: var(--radius-md); display: flex; align-items: center; gap: 0.85rem;">
            <span style="font-size: 1.5rem;">⚠️</span>
            <div>
              <div style="font-weight: 800; color: var(--danger-text); font-size: 1.05rem;">WORK EXPIRED</div>
              <div style="color: var(--danger-text); font-size: 0.95rem;">This work is no longer available. The 24-hour availability period has ended.</div>
            </div>
          </div>
        ` : ""}

        <!-- Direct Contact Box with Mobile 1 and Optional Mobile 2 (Requirement 15) -->
        <div class="work-contact-box">
          <div class="contact-info-list">
            <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
              Contact Employer
            </span>
            <div class="contact-phone-item">
              ${icons.phone}
              <span>Mobile 1: <strong>${currentWork.mobile1}</strong></span>
            </div>
            ${currentWork.mobile2 ? `
              <div class="contact-phone-item" style="font-size: 0.95rem;">
                ${icons.phone}
                <span>Mobile 2: <strong>${currentWork.mobile2}</strong></span>
              </div>
            ` : ""}
          </div>

          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <button id="btn-call-mobile-1" class="btn btn-secondary">
              ${icons.phone} ${isMobileDevice ? `CALL MOBILE 1` : `COPY MOBILE 1`}
            </button>
            ${currentWork.mobile2 ? `
              <button id="btn-call-mobile-2" class="btn btn-secondary">
                ${icons.phone} ${isMobileDevice ? `CALL MOBILE 2` : `COPY MOBILE 2`}
              </button>
            ` : ""}
          </div>
        </div>

        <!-- Already Applied Banner -->
        ${hasApplied ? `
          <div style="margin-top: 1.5rem; padding: 1rem 1.25rem; background: var(--success-light); border: 1.5px solid #a7f3d0; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
            <div style="color: var(--success-text); font-weight: 700;">
              ✓ You have already applied for this work.
            </div>
            <span class="badge ${existingApp?.status === 'accepted' ? 'badge-success' : existingApp?.status === 'rejected' ? 'badge-danger' : 'badge-warning'}">
              Status: ${(existingApp?.status || 'pending').toUpperCase()}
            </span>
          </div>
        ` : ""}

        <!-- Action Bar: Back, Apply -->
        <div class="work-details-action-bar">
          <a href="home.html" class="btn btn-secondary">
            ← BACK
          </a>

          ${!isOwner ? `
            <button
              id="btn-apply-action"
              class="btn btn-primary btn-lg"
              ${(isExpired || hasApplied) ? "disabled" : ""}
              style="${isExpired ? 'opacity: 0.6; cursor: not-allowed;' : ''}"
            >
              ${hasApplied ? "ALREADY APPLIED" : isExpired ? "WORK EXPIRED" : "APPLY"}
            </button>
          ` : `
            <a href="my-works.html" class="btn btn-outline-primary btn-lg">
              Manage in My Works
            </a>
          `}
        </div>
      </div>
    `;

    // Live countdown ticker on details page if still active
    if (!isExpired && expDate) {
      const detailsTimer = setInterval(() => {
        const remainingMs = expDate.getTime() - Date.now();
        const timeEl = document.getElementById("details-time-remaining");
        const applyBtnEl = document.getElementById("btn-apply-action");

        if (remainingMs <= 0) {
          clearInterval(detailsTimer);
          if (timeEl) timeEl.textContent = "Expired";
          if (applyBtnEl) {
            applyBtnEl.disabled = true;
            applyBtnEl.textContent = "WORK EXPIRED";
            applyBtnEl.style.opacity = "0.6";
            applyBtnEl.style.cursor = "not-allowed";
          }
          const badge = document.getElementById("details-countdown-badge");
          if (badge) {
            badge.className = "badge badge-danger";
            badge.textContent = "WORK EXPIRED";
          }
        } else {
          if (timeEl) timeEl.textContent = formatRemainingTime(currentWork.expiresAt);
        }
      }, 1000);
    }

    // Contact button handlers (Requirement 15)
    // Mobile: tel:PHONE_NUMBER
    // Desktop: Copy to clipboard with instant feedback
    function setupContactButton(btnId, phoneNumber, label) {
      const btn = document.getElementById(btnId);
      if (!btn || !phoneNumber) return;

      btn.addEventListener("click", () => {
        if (isMobileDevice) {
          window.location.href = `tel:${phoneNumber}`;
        } else {
          navigator.clipboard.writeText(phoneNumber).then(() => {
            const orig = btn.innerHTML;
            btn.innerHTML = `✓ Copied: ${phoneNumber}`;
            showToast(`Copied ${label}: ${phoneNumber}`, "success");
            setTimeout(() => { btn.innerHTML = orig; }, 2000);
          }).catch(() => {
            showToast(`${label}: ${phoneNumber}`, "info");
          });
        }
      });
    }

    setupContactButton("btn-call-mobile-1", currentWork.mobile1, "Mobile 1");
    if (currentWork.mobile2) {
      setupContactButton("btn-call-mobile-2", currentWork.mobile2, "Mobile 2");
    }

    // Apply System (Requirement 10 & 18)
    // Verification:
    // 1. User is logged in.
    // 2. Work exists.
    // 3. Work status is active.
    // 4. Current time is before expiresAt.
    // 5. Current user has not already applied.
    const applyBtn = document.getElementById("btn-apply-action");
    if (applyBtn && !isExpired && !hasApplied && !isOwner) {
      const executeApply = async () => {
        // Condition 1: User is logged in
        if (!user) {
          showToast("Please log in to apply for this work.", "info");
          setTimeout(() => {
            window.location.href = "login.html";
          }, 600);
          return;
        }

        // Re-verify Expiry at execution time (Requirement 18: backend and client time verification)
        const latestExp = getExpiryDate(currentWork);
        if (!latestExp || Date.now() >= latestExp.getTime() || currentWork.status !== "active") {
          showToast("This work is no longer available.", "error");
          applyBtn.disabled = true;
          applyBtn.textContent = "WORK EXPIRED";
          return;
        }

        // Condition 5: Double check duplicate applications
        if (hasApplied) {
          showToast("You have already applied for this work.", "error");
          return;
        }

        applyBtn.disabled = true;
        applyBtn.innerHTML = `<span class="spinner spinner-sm"></span> Submitting Application...`;

        try {
          const profile = await getUserProfile(user.uid);
          const applicationData = {
            workId: workId,
            applicantId: user.uid,
            applicantName: profile?.name || user.displayName || "Applicant",
            applicantMobile: profile?.mobile || "Not provided",
            appliedAt: isDemoMode ? new Date().toISOString() : serverTimestamp(),
            status: "pending"
          };

          if (!isDemoMode && db) {
            // Check in Firestore before writing to guarantee duplicate prevention
            const dupQuery = query(
              collection(db, "applications"),
              where("workId", "==", workId),
              where("applicantId", "==", user.uid)
            );
            const dupSnap = await getDocs(dupQuery);
            if (!dupSnap.empty) {
              showToast("You have already applied for this work.", "error");
              applyBtn.disabled = true;
              applyBtn.textContent = "ALREADY APPLIED";
              return;
            }

            // Save Application
            const appRef = await addDoc(collection(db, "applications"), applicationData);
            await updateDoc(appRef, { applicationId: appRef.id });

            // Increment applicant count on work post
            await updateDoc(doc(db, "works", workId), {
              applicantsCount: increment(1)
            });
          } else {
            // Mock Store
            const genAppId = "app-" + Date.now();
            applicationData.applicationId = genAppId;
            applicationData.id = genAppId;

            const dbData = mockStore.getData();
            if (!dbData.applications) dbData.applications = {};
            dbData.applications[genAppId] = applicationData;

            if (dbData.works && dbData.works[workId]) {
              dbData.works[workId].applicantsCount = (dbData.works[workId].applicantsCount || 0) + 1;
            }
            mockStore.saveData(dbData);
          }

          showToast("Application submitted successfully!", "success");
          hasApplied = true;
          applyBtn.textContent = "ALREADY APPLIED";

          setTimeout(() => {
            window.location.reload();
          }, 800);
        } catch (err) {
          showToast("Failed to submit application. Work may have expired or is unavailable.", "error");
          applyBtn.disabled = false;
          applyBtn.textContent = "APPLY";
        }
      };

      applyBtn.addEventListener("click", executeApply);

      // Trigger if user navigated with ?apply=true
      if (autoApply) {
        executeApply();
      }
    }
  });
}

/**
 * Initialize My Applications Page (my-applications.html)
 */
export function initMyApplicationsPage() {
  const container = document.getElementById("my-applications-container");
  if (!container) return;

  listenToAuth(async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    let myApps = [];
    let worksMap = {};

    if (!isDemoMode && db) {
      try {
        const q = query(
          collection(db, "applications"),
          where("applicantId", "==", user.uid)
        );
        const snap = await getDocs(q);
        snap.forEach((d) => {
          myApps.push({ id: d.id, applicationId: d.id, ...d.data() });
        });

        // Fetch corresponding works
        for (const app of myApps) {
          if (app.workId && !worksMap[app.workId]) {
            try {
              const wSnap = await getDoc(doc(db, "works", app.workId));
              if (wSnap.exists()) worksMap[app.workId] = wSnap.data();
            } catch (e) { /* silent */ }
          }
        }
      } catch (err) {
        // Fallback
        try {
          const snap = await getDocs(collection(db, "applications"));
          snap.forEach((d) => {
            const data = d.data();
            if (data.applicantId === user.uid) myApps.push({ id: d.id, applicationId: d.id, ...data });
          });
        } catch (e) { /* silent */ }
      }
    } else {
      const data = mockStore.getData();
      const allApps = Object.values(data.applications || {});
      myApps = allApps.filter((a) => a.applicantId === user.uid);
      worksMap = data.works || {};
    }

    // Sort latest applied first
    myApps.sort((a, b) => getCreatedDate({ createdAt: b.appliedAt }).getTime() - getCreatedDate({ createdAt: a.appliedAt }).getTime());

    if (myApps.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📄</div>
          <h3 class="empty-state-title">No Applications Submitted</h3>
          <p class="empty-state-desc">You haven't submitted any applications for 24-hour works yet.</p>
          <a href="home.html" class="btn btn-primary">EXPLORE AVAILABLE WORK</a>
        </div>
      `;
      return;
    }

    container.innerHTML = myApps
      .map((app) => {
        const work = worksMap[app.workId] || {};
        const status = app.status || "pending";
        const dateStr = formatRemainingTime ? formatRemainingTime(work.expiresAt) : "";
        const locationText = [work.workCity, work.workState].filter(Boolean).join(", ") || "Location";

        return `
          <div class="application-card">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                <span class="badge badge-primary">${escapeHtml(work.category || "General")}</span>
                <span class="badge ${work.status === 'active' ? 'badge-success' : 'badge-warning'}">
                  ${work.status === 'active' ? 'Active Work' : 'Closed Work'}
                </span>
              </div>
              <h3 class="app-work-title">${escapeHtml(work.category || "General")} Work - ${escapeHtml(work.ownerName || "Employer")}</h3>
              <div class="app-meta-text">
                ${icons.mapPin} ${escapeHtml(locationText)} • ${escapeHtml(work.workAddress || "")}
              </div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.4rem;">
                ${icons.clock} Applied: ${app.appliedAt ? new Date(app.appliedAt?.toDate ? app.appliedAt.toDate() : app.appliedAt).toLocaleDateString() : 'Recently'}
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span class="badge ${status === 'accepted' ? 'badge-success' : status === 'rejected' ? 'badge-danger' : 'badge-warning'}" style="font-size: 0.85rem; padding: 0.4rem 0.85rem;">
                STATUS: ${status.toUpperCase()}
              </span>

              <a href="work-details.html?id=${app.workId}" class="btn btn-secondary btn-sm">
                VIEW WORK
              </a>
            </div>
          </div>
        `;
      })
      .join("");
  });
}
