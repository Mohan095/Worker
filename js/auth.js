/**
 * WORK CONNECT - AUTHENTICATION CONTROLLER (Google Sign-In & Session Handling)
 */

import {
  auth,
  isDemoMode,
  googleProvider,
  signInWithPopup,
  signInAnonymously,
  signOut,
  mockStore,
  db,
  doc,
  setDoc,
  serverTimestamp
} from "./firebase-config.js";
import { checkUserProfileExists, showToast } from "./common.js";
import { t, getAppLanguage } from "./translations.js";

/**
 * Handle Google Sign-in Click
 */
export async function handleGoogleSignIn() {
  const btn = document.getElementById("btn-google-login");
  const originalHtml = btn ? btn.innerHTML : "";

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner spinner-sm" style="margin-right: 8px;"></span> ${t("auth_signing_in")}`;
    }

    let user = null;

    if (!isDemoMode && auth) {
      // Live Firebase Sign-In
      const result = await signInWithPopup(auth, googleProvider);
      user = result.user;
    } else {
      // Demo Mode Sign-In Simulation
      await new Promise((resolve) => setTimeout(resolve, 800)); // Smooth UX transition
      user = {
        uid: "demo-user-123",
        displayName: "Rajesh Kumar",
        email: "rajesh.workconnect@example.com",
        photoURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
      };
      mockStore.setCurrentUser(user);
    }

    if (!user) {
      throw new Error("No user returned");
    }

    // Check if user profile document exists in Firestore
    const profileExists = await checkUserProfileExists(user.uid);

    if (profileExists) {
      showToast(`Welcome back, ${user.displayName || "User"}!`, "success");
      setTimeout(() => {
        window.location.href = "home.html";
      }, 500);
    } else {
      showToast("Please complete your profile to continue.", "info");
      setTimeout(() => {
        window.location.href = "profile-setup.html";
      }, 500);
    }
  } catch (error) {
    console.error("Google Auth Error:", error);

    let friendlyMessage = t("err_auth_failed");
    if (error.code === "auth/popup-closed-by-user") {
      friendlyMessage = t("err_popup_closed");
    } else if (error.code === "auth/popup-blocked") {
      friendlyMessage = t("err_popup_blocked");
    } else if (error.code === "auth/network-request-failed") {
      friendlyMessage = t("err_network");
    }

    showToast(friendlyMessage, "error");

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

/**
 * Handle Guest / Anonymous Sign-in
 */
export async function handleGuestSignIn() {
  const guestBtn = document.getElementById("btn-guest-login");
  const originalHtml = guestBtn ? guestBtn.innerHTML : "";

  try {
    if (guestBtn) {
      guestBtn.disabled = true;
      guestBtn.innerHTML = `<span class="spinner spinner-sm" style="margin-right: 8px;"></span> ${t("auth_guest_logging_in")}`;
    }

    let user = null;

    if (!isDemoMode && auth) {
      try {
        const cred = await signInAnonymously(auth);
        user = cred.user;
      } catch (fbErr) {
        console.warn("Firebase Anonymous Auth not enabled or failed, falling back to local guest session:", fbErr);
        // Fallback local guest session
        user = {
          uid: "guest-" + Date.now().toString(36),
          displayName: "Guest User",
          email: "guest@workconnect.local",
          isAnonymous: true,
          photoURL: ""
        };
        mockStore.setCurrentUser(user);
      }
    } else {
      // Demo / Local Mode Guest
      await new Promise((res) => setTimeout(res, 500));
      user = {
        uid: "guest-" + Date.now().toString(36),
        displayName: "Guest User",
        email: "guest@workconnect.local",
        isAnonymous: true,
        photoURL: ""
      };
      mockStore.setCurrentUser(user);
    }

    // Auto-create or ensure guest profile
    const lang = getAppLanguage();
    const guestProfile = {
      uid: user.uid,
      name: user.displayName || "Guest User",
      email: user.email || "guest@workconnect.local",
      photoUrl: "",
      location: "Local Area",
      address: "Work Connect Guest",
      mobile: "9876543210",
      language: lang,
      isGuest: true,
      updatedAt: new Date().toISOString()
    };

    if (!isDemoMode && db && !user.uid.startsWith("guest-")) {
      try {
        guestProfile.createdAt = serverTimestamp();
        await setDoc(doc(db, "users", user.uid), guestProfile, { merge: true });
      } catch (e) {
        console.warn("Could not save guest to Firestore:", e);
      }
    } else {
      const dbData = mockStore.getData();
      if (!dbData.users) dbData.users = {};
      guestProfile.createdAt = new Date().toISOString();
      dbData.users[user.uid] = guestProfile;
      mockStore.saveData(dbData);
    }

    showToast("Signed in as Guest User!", "success");
    setTimeout(() => {
      window.location.href = "home.html";
    }, 400);
  } catch (err) {
    console.error("Guest Sign-In Error:", err);
    showToast("Guest login failed. Please try again.", "error");

    if (guestBtn) {
      guestBtn.disabled = false;
      guestBtn.innerHTML = originalHtml;
    }
  }
}

// Attach listeners on login page
document.addEventListener("DOMContentLoaded", () => {
  const googleBtn = document.getElementById("btn-google-login");
  if (googleBtn) {
    googleBtn.addEventListener("click", handleGoogleSignIn);
  }

  const guestBtn = document.getElementById("btn-guest-login");
  if (guestBtn) {
    guestBtn.addEventListener("click", handleGuestSignIn);
  }
});
