/**
 * WORK CONNECT - USER PROFILE CONTROLLER (Setup, View & Edit)
 */

import {
  auth,
  db,
  isDemoMode,
  mockStore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "./firebase-config.js";
import { listenToAuth, showToast, getUserProfile, logoutUser } from "./common.js";
import { t, getAppLanguage, setAppLanguage } from "./translations.js";

/**
 * Validate 10-digit Indian Mobile Number
 */
export function isValidMobile(phone) {
  const cleaned = phone.replace(/[\s\-\+]/g, "");
  // Matches 10-digit numbers starting with 6-9
  return /^[6-9]\d{9}$/.test(cleaned);
}

/**
 * Initialize Profile Setup Page
 */
export function initProfileSetup() {
  const form = document.getElementById("profile-setup-form");
  const saveBtn = document.getElementById("btn-save-profile");
  if (!form || !saveBtn) return;

  listenToAuth(async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    // Pre-fill name and email if available
    const nameInput = document.getElementById("input-name");
    const emailInput = document.getElementById("input-email");
    if (nameInput && !nameInput.value) {
      nameInput.value = user.displayName || user.name || "";
    }
    if (emailInput) {
      emailInput.value = user.email || "";
    }

    // Check if user already had a profile
    const existing = await getUserProfile(user.uid);
    if (existing) {
      if (nameInput) nameInput.value = existing.name || "";
      const locInput = document.getElementById("input-location");
      const addrInput = document.getElementById("input-address");
      const mobInput = document.getElementById("input-mobile");
      if (locInput) locInput.value = existing.location || "";
      if (addrInput) addrInput.value = existing.address || "";
      if (mobInput) mobInput.value = existing.mobile || "";
    }

    form.onsubmit = async (e) => {
      e.preventDefault();

      const name = document.getElementById("input-name").value.trim();
      const location = document.getElementById("input-location").value.trim();
      const address = document.getElementById("input-address").value.trim();
      const mobile = document.getElementById("input-mobile").value.trim();

      // Validation
      if (!name || !location || !address || !mobile) {
        showToast(t("err_required_fields"), "error");
        return;
      }

      if (!isValidMobile(mobile)) {
        showToast(t("err_invalid_phone"), "error");
        document.getElementById("input-mobile").classList.add("is-invalid");
        return;
      }
      document.getElementById("input-mobile").classList.remove("is-invalid");

      saveBtn.disabled = true;
      saveBtn.innerHTML = `<span class="spinner spinner-sm"></span> Saving...`;

      try {
        const lang = getAppLanguage();
        const profileData = {
          uid: user.uid,
          name,
          email: user.email || "",
          photoUrl: user.photoURL || user.photoUrl || "",
          location,
          address,
          mobile,
          language: lang,
          updatedAt: isDemoMode ? new Date().toISOString() : serverTimestamp()
        };

        if (!isDemoMode && db) {
          // Set to Firestore users/{uid}
          const userDocRef = doc(db, "users", user.uid);
          profileData.createdAt = serverTimestamp();
          await setDoc(userDocRef, profileData, { merge: true });
        } else {
          // Demo Store
          const dbData = mockStore.getData();
          if (!dbData.users) dbData.users = {};
          profileData.createdAt = dbData.users[user.uid]?.createdAt || new Date().toISOString();
          dbData.users[user.uid] = profileData;
          mockStore.saveData(dbData);

          // Update current user in mock
          mockStore.setCurrentUser({
            ...user,
            name,
            displayName: name
          });
        }

        showToast(t("msg_profile_saved"), "success");
        setTimeout(() => {
          window.location.href = "language.html";
        }, 600);
      } catch (err) {
        console.error("Profile save error:", err);
        showToast(t("err_network"), "error");
        saveBtn.disabled = false;
        saveBtn.innerHTML = t("btn_save_continue");
      }
    };
  });
}

/**
 * Initialize Profile View & Edit Page (profile.html)
 */
export function initProfileView() {
  const profileCard = document.getElementById("profile-display-card");
  const editForm = document.getElementById("profile-edit-form");
  const editModal = document.getElementById("edit-profile-modal");
  const btnEdit = document.getElementById("btn-edit-profile-trigger");
  const btnLogout = document.getElementById("btn-profile-logout");

  listenToAuth(async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    const profile = await getUserProfile(user.uid);
    if (!profile) {
      window.location.href = "profile-setup.html";
      return;
    }

    // Populate display fields
    const nameEl = document.getElementById("display-profile-name");
    const emailEl = document.getElementById("display-profile-email");
    const locEl = document.getElementById("display-profile-location");
    const addrEl = document.getElementById("display-profile-address");
    const phoneEl = document.getElementById("display-profile-phone");
    const langEl = document.getElementById("display-profile-language");
    const avatarImg = document.getElementById("display-profile-avatar");

    if (nameEl) nameEl.textContent = profile.name || user.displayName || "User";
    if (emailEl) emailEl.textContent = profile.email || user.email || "";
    if (locEl) locEl.textContent = profile.location || "Not set";
    if (addrEl) addrEl.textContent = profile.address || "Not set";
    if (phoneEl) phoneEl.textContent = profile.mobile || "Not set";

    const langMap = { en: "English", ta: "தமிழ் (Tamil)", hi: "हिन्दी (Hindi)" };
    if (langEl) langEl.textContent = langMap[profile.language || getAppLanguage()] || "English";

    if (avatarImg) {
      if (profile.photoUrl || user.photoURL) {
        avatarImg.src = profile.photoUrl || user.photoURL;
      } else {
        avatarImg.style.display = "none";
        const initialsEl = document.getElementById("display-profile-initials");
        if (initialsEl) {
          initialsEl.style.display = "flex";
          initialsEl.textContent = (profile.name || "U").charAt(0).toUpperCase();
        }
      }
    }

    // Edit Profile Modal Wiring
    if (btnEdit && editModal) {
      btnEdit.onclick = () => {
        document.getElementById("edit-input-name").value = profile.name || "";
        document.getElementById("edit-input-location").value = profile.location || "";
        document.getElementById("edit-input-address").value = profile.address || "";
        document.getElementById("edit-input-mobile").value = profile.mobile || "";
        editModal.classList.add("active");
      };

      const closeEdit = () => editModal.classList.remove("active");
      document.getElementById("btn-close-edit-modal").onclick = closeEdit;
      document.getElementById("btn-cancel-edit-modal").onclick = closeEdit;

      if (editForm) {
        editForm.onsubmit = async (e) => {
          e.preventDefault();
          const name = document.getElementById("edit-input-name").value.trim();
          const location = document.getElementById("edit-input-location").value.trim();
          const address = document.getElementById("edit-input-address").value.trim();
          const mobile = document.getElementById("edit-input-mobile").value.trim();

          if (!name || !location || !address || !mobile) {
            showToast(t("err_required_fields"), "error");
            return;
          }
          if (!isValidMobile(mobile)) {
            showToast(t("err_invalid_phone"), "error");
            return;
          }

          const saveBtn = document.getElementById("btn-submit-edit-profile");
          saveBtn.disabled = true;
          saveBtn.innerHTML = `<span class="spinner spinner-sm"></span> Saving...`;

          try {
            if (!isDemoMode && db) {
              const userRef = doc(db, "users", user.uid);
              await updateDoc(userRef, {
                name,
                location,
                address,
                mobile,
                updatedAt: serverTimestamp()
              });
            } else {
              const dbData = mockStore.getData();
              if (dbData.users && dbData.users[user.uid]) {
                dbData.users[user.uid].name = name;
                dbData.users[user.uid].location = location;
                dbData.users[user.uid].address = address;
                dbData.users[user.uid].mobile = mobile;
                dbData.users[user.uid].updatedAt = new Date().toISOString();
                mockStore.saveData(dbData);
              }
            }

            showToast(t("msg_profile_saved"), "success");
            closeEdit();
            saveBtn.disabled = false;
            saveBtn.innerHTML = t("btn_save_changes");
            // Refresh view
            setTimeout(() => window.location.reload(), 400);
          } catch (err) {
            console.error("Update profile error:", err);
            showToast(t("err_network"), "error");
            saveBtn.disabled = false;
            saveBtn.innerHTML = t("btn_save_changes");
          }
        };
      }
    }

    // Logout Button
    if (btnLogout) {
      btnLogout.onclick = logoutUser;
    }
  });
}
