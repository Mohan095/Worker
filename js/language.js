/**
 * WORK CONNECT - LANGUAGE CONTROLLER
 * Handles selection, persistence to Firestore users/{uid}.language & localStorage,
 * and page-wide text updates.
 */

import { auth, db, isDemoMode, mockStore, doc, updateDoc, serverTimestamp } from "./firebase-config.js";
import { listenToAuth, showToast } from "./common.js";
import { getAppLanguage, setAppLanguage, applyPageTranslations, t } from "./translations.js";

/**
 * Initialize Language Selection Page (language.html)
 */
export function initLanguagePage() {
  const langCards = document.querySelectorAll(".lang-card-option");
  const confirmBtn = document.getElementById("btn-confirm-language");
  let selectedLang = getAppLanguage();

  // Mark current
  langCards.forEach((card) => {
    const lang = card.getAttribute("data-lang");
    if (lang === selectedLang) {
      card.classList.add("selected");
    } else {
      card.classList.remove("selected");
    }

    card.addEventListener("click", () => {
      langCards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      selectedLang = lang;
      // Pre-translate button preview
      applyPageTranslations(selectedLang);
    });
  });

  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = `<span class="spinner spinner-sm"></span> Saving...`;

      // Save locally first
      setAppLanguage(selectedLang);

      // Save to Firestore if authenticated
      listenToAuth(async (user) => {
        if (user) {
          try {
            if (!isDemoMode && db) {
              const userRef = doc(db, "users", user.uid);
              await updateDoc(userRef, {
                language: selectedLang,
                updatedAt: serverTimestamp()
              });
            } else {
              const dbData = mockStore.getData();
              if (dbData.users && dbData.users[user.uid]) {
                dbData.users[user.uid].language = selectedLang;
                mockStore.saveData(dbData);
              }
            }
          } catch (e) {
            console.warn("Could not save language to Firestore profile:", e);
          }
        }

        showToast("Language updated successfully!", "success");
        setTimeout(() => {
          window.location.href = "home.html";
        }, 400);
      });
    });
  }
}

/**
 * Setup quick language switcher modal or inline selector (e.g. in profile)
 */
export function setupLanguageSwitcher(selectorId) {
  const selectEl = document.getElementById(selectorId);
  if (!selectEl) return;

  selectEl.value = getAppLanguage();
  selectEl.addEventListener("change", async (e) => {
    const newLang = e.target.value;
    setAppLanguage(newLang);
    applyPageTranslations(newLang);

    // Save to user profile if logged in
    listenToAuth(async (user) => {
      if (user) {
        try {
          if (!isDemoMode && db) {
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
              language: newLang,
              updatedAt: serverTimestamp()
            });
          } else {
            const dbData = mockStore.getData();
            if (dbData.users && dbData.users[user.uid]) {
              dbData.users[user.uid].language = newLang;
              mockStore.saveData(dbData);
            }
          }
        } catch (err) {
          console.error(err);
        }
      }
    });

    showToast("Language changed / மொழி மாற்றப்பட்டது / भाषा बदल दी गई", "info");
    setTimeout(() => window.location.reload(), 400);
  });
}
