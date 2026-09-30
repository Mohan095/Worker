/**
 * WORK CONNECT - APPLICATIONS CONTROLLER
 * Work Details view, Direct Calling/Copy, Duplicate-safe Apply logic, and My Applications view.
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
import { listenToAuth, showToast, formatDate, icons, getUserProfile } from "./common.js";
import { t } from "./translations.js";

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
        <a href="home.html" class="btn btn-primary">${t("btn_back")}</a>
      </div>
    `;
    return;
  }

  listenToAuth(async (user) => {
    let currentWork = null;

    // Load work data
    if (!isDemoMode && db) {
      try {
        const snap = await getDoc(doc(db, "works", workId));
        if (snap.exists()) {
          currentWork = { id: snap.id, workId: snap.id, ...snap.data() };
        }
      } catch (e) {
        console.error("Error fetching work details:", e);
      }
    } else {
      const data = mockStore.getData();
      currentWork = data.works ? data.works[workId] : null;
    }

    if (!currentWork) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3 class="empty-state-title">${t("work_not_found")}</h3>
          <p class="empty-state-desc">This job listing may have been completed, removed by the owner, or expired.</p>
          <a href="home.html" class="btn btn-primary">${t("btn_back")}</a>
        </div>
      `;
      return;
    }

    // Check if the current user already applied
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
          console.warn("Could not check existing application in Firestore:", e);
        }
      } else {
        const data = mockStore.getData();
        const apps = Object.values(data.applications || {});
        existingApp = apps.find((a) => a.workId === workId && a.applicantId === user.uid);
        if (existingApp) hasApplied = true;
      }
    }

    const isOwner = user && user.uid === currentWork.postedBy;

    // Render Details
    container.innerHTML = `
      <div class="work-details-header-card">
        <div class="work-details-top-bar">
          <span class="badge badge-primary" style="font-size: 0.9rem; padding: 0.4rem 0.9rem;">
            ${escapeHtml(currentWork.category || "General")}
          </span>
          <span class="badge ${currentWork.status === 'active' ? 'badge-success' : 'badge-warning'}">
            ${t("status_" + (currentWork.status || "active"))}
          </span>
        </div>

        <h1 class="work-details-title">${escapeHtml(currentWork.workName)}</h1>

        <!-- Meta Grid -->
        <div class="work-details-meta-grid">
          <div class="detail-meta-box">
            <div class="meta-icon">${icons.briefcase}</div>
            <div>
              <div class="meta-label">${t("lbl_work_place")}</div>
              <div class="meta-value">${escapeHtml(currentWork.workPlace)}</div>
            </div>
          </div>

          <div class="detail-meta-box">
            <div class="meta-icon">${icons.mapPin}</div>
            <div>
              <div class="meta-label">${t("lbl_work_address")}</div>
              <div class="meta-value">${escapeHtml(currentWork.workAddress)}</div>
            </div>
          </div>

          <div class="detail-meta-box">
            <div class="meta-icon">${icons.user}</div>
            <div>
              <div class="meta-label">${t("lbl_posted_by")}</div>
              <div class="meta-value">${escapeHtml(currentWork.postedByName || "Employer")}</div>
            </div>
          </div>

          <div class="detail-meta-box">
            <div class="meta-icon">${icons.clock}</div>
            <div>
              <div class="meta-label">${t("lbl_posted_on")}</div>
              <div class="meta-value">${formatDate(currentWork.createdAt)}</div>
            </div>
          </div>
        </div>

        <!-- Description Section -->
        <div class="work-details-section">
          <h3>Work Description & Requirements</h3>
          <div class="work-details-body-text">${escapeHtml(currentWork.description)}</div>
        </div>

        <!-- Contact Box -->
        <div class="work-contact-box">
          <div class="contact-info-list">
            <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Direct Contact Details</span>
            <div class="contact-phone-item">
              ${icons.phone}
              <span>${currentWork.mobile1}</span>
              ${currentWork.mobile2 ? `<span style="font-weight: 400; color: var(--text-muted); font-size: 0.95rem;">• Alt: ${currentWork.mobile2}</span>` : ""}
            </div>
          </div>

          <button id="btn-call-employer" class="btn btn-secondary">
            ${icons.phone} ${t("btn_call")}
          </button>
        </div>

        <!-- Application Status Alert if already applied -->
        ${hasApplied ? `
          <div style="margin-top: 1.5rem; padding: 1rem 1.25rem; background: var(--success-light); border: 1px solid #a7f3d0; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: space-between;">
            <div style="color: var(--success-text); font-weight: 600;">
              ✓ ${t("already_applied")}
            </div>
            <span class="badge ${existingApp?.status === 'accepted' ? 'badge-success' : existingApp?.status === 'rejected' ? 'badge-danger' : 'badge-warning'}">
              Status: ${t("status_" + (existingApp?.status || 'pending'))}
            </span>
          </div>
        ` : ""}

        <!-- Action Bar -->
        <div class="work-details-action-bar">
          <a href="home.html" class="btn btn-secondary">
            ← ${t("btn_back")}
          </a>

          ${!isOwner ? `
            <button id="btn-apply-action" class="btn btn-primary btn-lg" ${hasApplied ? "disabled" : ""}>
              ${hasApplied ? t("already_applied") : t("btn_apply_now")}
            </button>
          ` : `
            <a href="my-works.html" class="btn btn-outline-primary">
              Manage in My Works
            </a>
          `}
        </div>
      </div>
    `;

    // Setup CALL Button (Mobile tel: / Desktop Clipboard copy)
    const callBtn = document.getElementById("btn-call-employer");
    if (callBtn) {
      callBtn.addEventListener("click", () => {
        const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
        if (isMobile) {
          window.location.href = `tel:${currentWork.mobile1}`;
        } else {
          navigator.clipboard.writeText(currentWork.mobile1).then(() => {
            showToast(`${t("btn_copied")}: ${currentWork.mobile1}`, "success");
          }).catch(() => {
            showToast(`Contact: ${currentWork.mobile1}`, "info");
          });
        }
      });
    }

    // Setup Apply Button
    const applyBtn = document.getElementById("btn-apply-action");
    if (applyBtn && !hasApplied) {
      const executeApply = async () => {
        if (!user) {
          showToast("Please log in to apply for this work.", "info");
          setTimeout(() => window.location.href = "login.html", 500);
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
            applicantEmail: user.email || "",
            applicantMobile: profile?.mobile || "Not provided",
            appliedAt: isDemoMode ? new Date().toISOString() : serverTimestamp(),
            status: "pending"
          };

          if (!isDemoMode && db) {
            // Save application
            const newAppRef = await addDoc(collection(db, "applications"), applicationData);
            await updateDoc(newAppRef, { applicationId: newAppRef.id });

            // Increment applicant count on work
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

          showToast(t("application_submitted"), "success");
          setTimeout(() => {
            window.location.reload();
          }, 800);
        } catch (err) {
          console.error("Apply error:", err);
          showToast(t("err_network"), "error");
          applyBtn.disabled = false;
          applyBtn.textContent = t("btn_apply_now");
        }
      };

      applyBtn.addEventListener("click", executeApply);

      // Trigger automatically if query param `?apply=true` was passed
      if (autoApply && !hasApplied) {
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

        // Fetch corresponding work details
        for (const app of myApps) {
          if (app.workId && !worksMap[app.workId]) {
            const wSnap = await getDoc(doc(db, "works", app.workId));
            if (wSnap.exists()) {
              worksMap[app.workId] = wSnap.data();
            }
          }
        }
      } catch (err) {
        console.warn("Could not load applications from Firestore:", err);
      }
    } else {
      const data = mockStore.getData();
      const allApps = Object.values(data.applications || {});
      myApps = allApps.filter((a) => a.applicantId === user.uid);
      worksMap = data.works || {};
    }

    // Sort latest applied first
    myApps.sort((a, b) => {
      const tA = a.appliedAt?.toDate ? a.appliedAt.toDate() : new Date(a.appliedAt || 0);
      const tB = b.appliedAt?.toDate ? b.appliedAt.toDate() : new Date(b.appliedAt || 0);
      return tB - tA;
    });

    if (myApps.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📄</div>
          <h3 class="empty-state-title">${t("no_apps_yet")}</h3>
          <p class="empty-state-desc">You haven't submitted any job or work applications yet. Discover open work opportunities today.</p>
          <a href="home.html" class="btn btn-primary">${t("btn_explore_works")}</a>
        </div>
      `;
      return;
    }

    container.innerHTML = myApps
      .map((app) => {
        const work = worksMap[app.workId] || {};
        const status = app.status || "pending";
        return `
          <div class="application-card">
            <div>
              <h3 class="app-work-title">${escapeHtml(work.workName || "Work Opportunity")}</h3>
              <div class="app-meta-text">
                ${icons.mapPin} ${escapeHtml(work.workPlace || "Location")} • ${escapeHtml(work.category || "General")}
              </div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.35rem;">
                ${icons.clock} Applied on: ${formatDate(app.appliedAt)}
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 1rem;">
              <span class="badge ${status === 'accepted' ? 'badge-success' : status === 'rejected' ? 'badge-danger' : 'badge-warning'}" style="font-size: 0.85rem; padding: 0.4rem 0.85rem;">
                ${t("status_" + status)}
              </span>

              <a href="work-details.html?id=${app.workId}" class="btn btn-secondary btn-sm">
                ${t("btn_view_details")}
              </a>
            </div>
          </div>
        `;
      })
      .join("");
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
