/**
 * WORK CONNECT - WORKS CONTROLLER
 * Available Works feed, Real-time Listeners, Add Work, Edit, Deactivate, and Delete.
 */

import {
  auth,
  db,
  isDemoMode,
  mockStore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "./firebase-config.js";
import { listenToAuth, showToast, confirmDialog, formatDate, icons, getUserProfile } from "./common.js";
import { t } from "./translations.js";
import { isValidMobile } from "./profile.js";

/**
 * Initialize Home Available Works Feed (home.html)
 */
export function initHomeWorksFeed() {
  const container = document.getElementById("works-grid-container");
  const searchInput = document.getElementById("search-works-input");
  const categoryChips = document.querySelectorAll(".chip-btn");
  if (!container) return;

  let allWorks = [];
  let selectedCategory = "all";
  let searchQuery = "";

  function renderWorks() {
    const filtered = allWorks.filter((w) => {
      // Must be active
      if (w.status && w.status !== "active") return false;

      // Filter by category
      if (selectedCategory !== "all") {
        if ((w.category || "").toLowerCase() !== selectedCategory.toLowerCase()) {
          return false;
        }
      }

      // Filter by search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (w.workName || "").toLowerCase().includes(q);
        const placeMatch = (w.workPlace || "").toLowerCase().includes(q);
        const addrMatch = (w.workAddress || "").toLowerCase().includes(q);
        const catMatch = (w.category || "").toLowerCase().includes(q);
        const descMatch = (w.description || "").toLowerCase().includes(q);
        return nameMatch || placeMatch || addrMatch || catMatch || descMatch;
      }

      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">🔍</div>
          <h3 class="empty-state-title">No Works Found</h3>
          <p class="empty-state-desc">
            ${searchQuery ? `No jobs match "${searchQuery}". Try a different keyword or category.` : "No active work listings are currently available in this category."}
          </p>
          <a href="add-work.html" class="btn btn-primary">
            ${icons.plus} ${t("nav_add_work")}
          </a>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered
      .map((work) => {
        const workId = work.workId || work.id;
        const applicantCount = work.applicantsCount || 0;
        return `
          <div class="work-card" id="card-${workId}">
            <div>
              <div class="work-card-header">
                <h3 class="work-card-title">${escapeHtml(work.workName || "")}</h3>
                <span class="badge badge-primary">${escapeHtml(work.category || "General")}</span>
              </div>

              <div class="work-meta-list">
                <div class="work-meta-item">
                  ${icons.briefcase}
                  <span><strong>${escapeHtml(work.workPlace || "")}</strong></span>
                </div>
                <div class="work-meta-item">
                  ${icons.mapPin}
                  <span>${escapeHtml(work.workAddress || "")}</span>
                </div>
                <div class="work-meta-item">
                  ${icons.clock}
                  <span>${formatDate(work.createdAt)}</span>
                </div>
              </div>

              <p class="work-card-desc">${escapeHtml(work.description || "")}</p>
            </div>

            <div class="work-card-footer">
              <div class="work-posted-by">
                <span>${t("lbl_posted_by")}: <strong>${escapeHtml(work.postedByName || "Employer")}</strong></span>
                <div style="font-size: 0.785rem; color: var(--text-muted); margin-top: 2px;">
                  👥 ${applicantCount} ${t("lbl_applicants")}
                </div>
              </div>

              <div class="work-card-actions">
                <a href="work-details.html?id=${workId}" class="btn btn-secondary btn-sm">
                  ${t("btn_view_details")}
                </a>
                <a href="work-details.html?id=${workId}&apply=true" class="btn btn-primary btn-sm">
                  ${t("btn_apply_now")}
                </a>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // Real-time Firestore or Mock listener
  if (!isDemoMode && db) {
    const q = query(
      collection(db, "works"),
      where("status", "==", "active"),
      orderBy("createdAt", "desc")
    );
    onSnapshot(q, (snapshot) => {
      allWorks = [];
      snapshot.forEach((d) => {
        allWorks.push({ id: d.id, workId: d.id, ...d.data() });
      });
      renderWorks();
    }, (err) => {
      console.warn("Firestore onSnapshot index warning:", err);
      // Fallback query if composite index not yet deployed
      const simpleQ = query(collection(db, "works"));
      onSnapshot(simpleQ, (s) => {
        allWorks = [];
        s.forEach((d) => {
          const item = { id: d.id, workId: d.id, ...d.data() };
          if (item.status === "active") allWorks.push(item);
        });
        allWorks.sort((a, b) => {
          const tA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          const tB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          return tB - tA;
        });
        renderWorks();
      });
    });
  } else {
    // Mock Store Real-time listener
    const updateFromMock = (data) => {
      const worksObj = data.works || {};
      allWorks = Object.values(worksObj)
        .filter((w) => w.status === "active")
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      renderWorks();
    };
    updateFromMock(mockStore.getData());
    mockStore.subscribe(updateFromMock);
  }

  // Search input event
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
 */
export function initAddWorkPage() {
  const form = document.getElementById("add-work-form");
  const submitBtn = document.getElementById("btn-submit-work");
  if (!form || !submitBtn) return;

  listenToAuth(async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    const profile = await getUserProfile(user.uid);
    // Auto fill primary mobile from profile if available
    const mob1Input = document.getElementById("input-mobile-1");
    if (mob1Input && profile && profile.mobile) {
      mob1Input.value = profile.mobile;
    }

    form.onsubmit = async (e) => {
      e.preventDefault();

      const workName = document.getElementById("input-work-name").value.trim();
      const workPlace = document.getElementById("input-work-place").value.trim();
      const workAddress = document.getElementById("input-work-address").value.trim();
      const mobile1 = document.getElementById("input-mobile-1").value.trim();
      const mobile2 = document.getElementById("input-mobile-2").value.trim();
      const category = document.getElementById("select-category").value;
      const description = document.getElementById("input-work-desc").value.trim();

      // Required: Work Name, Work Place, Work Address, Mobile 1
      if (!workName || !workPlace || !workAddress || !mobile1) {
        showToast(t("err_required_fields"), "error");
        return;
      }

      if (!isValidMobile(mobile1)) {
        showToast(t("err_invalid_phone"), "error");
        document.getElementById("input-mobile-1").focus();
        return;
      }

      if (mobile2 && !isValidMobile(mobile2)) {
        showToast("Please enter a valid alternative mobile number.", "error");
        document.getElementById("input-mobile-2").focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner spinner-sm"></span> Publishing...`;

      try {
        const workData = {
          workName,
          workPlace,
          workAddress,
          mobile1,
          mobile2: mobile2 || "",
          description: description || "No additional description provided.",
          category: category || "Other Work",
          postedBy: user.uid,
          postedByName: profile?.name || user.displayName || "Employer",
          postedByEmail: user.email || "",
          status: "active",
          applicantsCount: 0,
          createdAt: isDemoMode ? new Date().toISOString() : serverTimestamp(),
          updatedAt: isDemoMode ? new Date().toISOString() : serverTimestamp()
        };

        if (!isDemoMode && db) {
          const newDocRef = await addDoc(collection(db, "works"), workData);
          // Set internal workId field
          await updateDoc(newDocRef, { workId: newDocRef.id });
        } else {
          const generatedId = "work-" + Date.now();
          workData.workId = generatedId;
          workData.id = generatedId;
          const currentData = mockStore.getData();
          if (!currentData.works) currentData.works = {};
          currentData.works[generatedId] = workData;
          mockStore.saveData(currentData);
        }

        showToast(t("msg_work_saved"), "success");
        setTimeout(() => {
          window.location.href = "home.html";
        }, 600);
      } catch (err) {
        console.error("Add work error:", err);
        showToast(t("err_network"), "error");
        submitBtn.disabled = false;
        submitBtn.innerHTML = t("btn_submit_work");
      }
    };
  });
}

/**
 * Initialize My Works Page (my-works.html)
 */
export function initMyWorksPage() {
  const container = document.getElementById("my-works-container");
  const editModal = document.getElementById("edit-work-modal");
  const editForm = document.getElementById("edit-work-form");
  if (!container) return;

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
            where("postedBy", "==", user.uid)
          );
          const snap = await getDocs(q);
          snap.forEach((d) => {
            myWorks.push({ id: d.id, workId: d.id, ...d.data() });
          });
        } catch (e) {
          console.warn("Could not load my works from Firestore:", e);
        }
      } else {
        const data = mockStore.getData();
        const all = Object.values(data.works || {});
        myWorks = all.filter((w) => w.postedBy === user.uid);
      }

      // Sort latest first
      myWorks.sort((a, b) => {
        const tA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const tB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return tB - tA;
      });

      if (myWorks.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <h3 class="empty-state-title">You Haven't Posted Any Works Yet</h3>
            <p class="empty-state-desc">Post a work requirement and connect directly with skilled local workers.</p>
            <a href="add-work.html" class="btn btn-primary">
              ${icons.plus} ${t("nav_add_work")}
            </a>
          </div>
        `;
        return;
      }

      container.innerHTML = myWorks
        .map((work) => {
          const workId = work.workId || work.id;
          const isActive = work.status === "active";
          return `
            <div class="my-work-card ${isActive ? '' : 'status-inactive'}" id="my-work-${workId}">
              <div class="my-work-top-row">
                <div class="my-work-title-group">
                  <h3>${escapeHtml(work.workName)}</h3>
                  <div class="my-work-location">
                    ${icons.mapPin} ${escapeHtml(work.workPlace)} • ${escapeHtml(work.category || "General")}
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span class="badge ${isActive ? 'badge-success' : 'badge-warning'}">
                    ${isActive ? t("status_active") : t("status_inactive")}
                  </span>
                  <span class="badge badge-primary">
                    👥 ${work.applicantsCount || 0} ${t("lbl_applicants")}
                  </span>
                </div>
              </div>

              <div style="font-size: 0.85rem; color: var(--text-muted);">
                ${icons.clock} ${t("lbl_posted_on")}: ${formatDate(work.createdAt)}
              </div>

              <div class="my-work-action-toolbar">
                <a href="work-details.html?id=${workId}" class="btn btn-secondary btn-sm">
                  ${icons.briefcase} ${t("btn_view")}
                </a>
                <button class="btn btn-secondary btn-sm btn-edit-work" data-id="${workId}">
                  ${icons.edit} ${t("btn_edit")}
                </button>
                <button class="btn btn-outline-primary btn-sm btn-view-applicants" data-id="${workId}" data-title="${escapeHtml(work.workName)}">
                  👥 ${t("btn_applicants")} (${work.applicantsCount || 0})
                </button>
                <button class="btn ${isActive ? 'btn-secondary' : 'btn-success'} btn-sm btn-toggle-status" data-id="${workId}" data-status="${work.status}">
                  ${isActive ? t("btn_deactivate") : t("btn_activate")}
                </button>
                <button class="btn btn-outline-danger btn-sm btn-delete-work" data-id="${workId}">
                  ${icons.trash} ${t("btn_delete")}
                </button>
              </div>
            </div>
          `;
        })
        .join("");

      // Action Handlers
      // 1. Edit Work
      document.querySelectorAll(".btn-edit-work").forEach((b) => {
        b.addEventListener("click", () => {
          const id = b.getAttribute("data-id");
          const target = myWorks.find((w) => (w.workId || w.id) === id);
          if (!target) return;

          document.getElementById("edit-work-id").value = id;
          document.getElementById("edit-work-name").value = target.workName || "";
          document.getElementById("edit-work-place").value = target.workPlace || "";
          document.getElementById("edit-work-address").value = target.workAddress || "";
          document.getElementById("edit-work-mobile1").value = target.mobile1 || "";
          document.getElementById("edit-work-mobile2").value = target.mobile2 || "";
          document.getElementById("edit-work-category").value = target.category || "Other Work";
          document.getElementById("edit-work-desc").value = target.description || "";

          editModal.classList.add("active");
        });
      });

      // 2. Toggle Status (Active / Inactive)
      document.querySelectorAll(".btn-toggle-status").forEach((b) => {
        b.addEventListener("click", async () => {
          const id = b.getAttribute("data-id");
          const currentStatus = b.getAttribute("data-status");
          const newStatus = currentStatus === "active" ? "inactive" : "active";

          const proceed = () => toggleWorkStatus(id, newStatus, loadAndRender);

          if (currentStatus === "active") {
            confirmDialog({
              title: t("btn_deactivate"),
              message: t("confirm_deactivate_work"),
              confirmText: t("btn_deactivate"),
              onConfirm: proceed,
              isDanger: true
            });
          } else {
            proceed();
          }
        });
      });

      // 3. Delete Work
      document.querySelectorAll(".btn-delete-work").forEach((b) => {
        b.addEventListener("click", () => {
          const id = b.getAttribute("data-id");
          confirmDialog({
            title: t("btn_delete"),
            message: t("confirm_delete_work"),
            confirmText: t("btn_delete"),
            onConfirm: () => deleteWork(id, loadAndRender),
            isDanger: true
          });
        });
      });

      // 4. Applicants View
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
    document.getElementById("btn-close-edit-work").onclick = closeEdit;
    document.getElementById("btn-cancel-edit-work").onclick = closeEdit;

    // Handle Edit Submit
    if (editForm) {
      editForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById("edit-work-id").value;
        const workName = document.getElementById("edit-work-name").value.trim();
        const workPlace = document.getElementById("edit-work-place").value.trim();
        const workAddress = document.getElementById("edit-work-address").value.trim();
        const mobile1 = document.getElementById("edit-work-mobile1").value.trim();
        const mobile2 = document.getElementById("edit-work-mobile2").value.trim();
        const category = document.getElementById("edit-work-category").value;
        const description = document.getElementById("edit-work-desc").value.trim();

        if (!workName || !workPlace || !workAddress || !mobile1) {
          showToast(t("err_required_fields"), "error");
          return;
        }

        const saveBtn = document.getElementById("btn-save-edit-work");
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span class="spinner spinner-sm"></span> Saving...`;

        try {
          const updates = {
            workName,
            workPlace,
            workAddress,
            mobile1,
            mobile2: mobile2 || "",
            category,
            description,
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

          showToast(t("msg_work_updated"), "success");
          closeEdit();
          saveBtn.disabled = false;
          saveBtn.innerHTML = t("btn_save_changes");
          loadAndRender();
        } catch (err) {
          console.error("Save edit error:", err);
          showToast(t("err_network"), "error");
          saveBtn.disabled = false;
          saveBtn.innerHTML = t("btn_save_changes");
        }
      };
    }
  });
}

/**
 * Toggle active/inactive status of a work
 */
async function toggleWorkStatus(workId, newStatus, onDone) {
  try {
    if (!isDemoMode && db) {
      await updateDoc(doc(db, "works", workId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } else {
      const data = mockStore.getData();
      if (data.works && data.works[workId]) {
        data.works[workId].status = newStatus;
        mockStore.saveData(data);
      }
    }
    showToast(`Work status set to ${newStatus}.`, "info");
    onDone();
  } catch (e) {
    console.error(e);
    showToast(t("err_network"), "error");
  }
}

/**
 * Delete a work
 */
async function deleteWork(workId, onDone) {
  try {
    if (!isDemoMode && db) {
      await deleteDoc(doc(db, "works", workId));
    } else {
      const data = mockStore.getData();
      if (data.works && data.works[workId]) {
        delete data.works[workId];
        mockStore.saveData(data);
      }
    }
    showToast(t("msg_work_deleted"), "success");
    onDone();
  } catch (e) {
    console.error(e);
    showToast(t("err_network"), "error");
  }
}

/**
 * Open Applicants review modal
 */
export async function openApplicantsModal(workId, workTitle) {
  const modal = document.getElementById("applicants-modal");
  const modalTitle = document.getElementById("applicants-modal-title");
  const listContainer = document.getElementById("applicants-modal-list");
  if (!modal || !listContainer) return;

  modalTitle.textContent = `${t("applicants_title")} ${workTitle}`;
  listContainer.innerHTML = `<div class="loading-container"><span class="spinner"></span></div>`;
  modal.classList.add("active");

  const closeBtn = document.getElementById("btn-close-applicants-modal");
  if (closeBtn) closeBtn.onclick = () => modal.classList.remove("active");

  // Load applications for this work
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
      console.warn("Could not load applicants from Firestore:", e);
    }
  } else {
    const data = mockStore.getData();
    apps = Object.values(data.applications || {}).filter((a) => a.workId === workId);
  }

  if (apps.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state" style="padding: 2rem 1rem;">
        <div class="empty-state-icon">👥</div>
        <p style="color: var(--text-muted);">${t("no_applicants_yet")}</p>
      </div>
    `;
    return;
  }

  function renderApplicantCards() {
    listContainer.innerHTML = apps
      .map((app) => {
        const appId = app.applicationId || app.id;
        const status = app.status || "pending";
        return `
          <div class="applicant-card" id="app-card-${appId}">
            <div class="applicant-profile">
              <div class="applicant-avatar">${(app.applicantName || "A").charAt(0).toUpperCase()}</div>
              <div class="applicant-details">
                <h4>${escapeHtml(app.applicantName || "Anonymous")}</h4>
                <div class="applicant-contact-details">
                  <span>${icons.phone} <a href="tel:${app.applicantMobile}">${app.applicantMobile || "N/A"}</a></span>
                  <span>${icons.clock} ${formatDate(app.appliedAt)}</span>
                </div>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span class="badge ${status === 'accepted' ? 'badge-success' : status === 'rejected' ? 'badge-danger' : 'badge-warning'}">
                ${t("status_" + status)}
              </span>

              <div class="applicant-actions">
                ${status !== 'accepted' ? `
                  <button class="btn btn-success btn-sm btn-applicant-action" data-id="${appId}" data-status="accepted">
                    ${icons.check} ${t("btn_accept")}
                  </button>
                ` : ""}
                ${status !== 'rejected' ? `
                  <button class="btn btn-outline-danger btn-sm btn-applicant-action" data-id="${appId}" data-status="rejected">
                    &times; ${t("btn_reject")}
                  </button>
                ` : ""}
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    // Action buttons
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
 * Update application status (Owner action: Accept / Reject)
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
    showToast(t("msg_status_updated"), "success");
  } catch (err) {
    console.error(err);
    showToast(t("err_network"), "error");
  }
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
