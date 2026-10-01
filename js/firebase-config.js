/**
 * WORK CONNECT - FIREBASE CONFIGURATION & SERVICE INITIALIZATION
 * Modular Firebase SDK (CDN Browser Modules)
 */

// Official Firebase Modular CDN Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

/* ==========================================================================
   FIREBASE CONFIGURATION
   ========================================================================== */
const defaultFirebaseConfig = {
  apiKey: "AIzaSyBHrCqx1FFnYw52Py4ZIicn5Pg_yxXeKjo",
  authDomain: "chat-mk-f1fc4.firebaseapp.com",
  projectId: "chat-mk-f1fc4",
  storageBucket: "chat-mk-f1fc4.firebasestorage.app",
  messagingSenderId: "561728667110",
  appId: "1:561728667110:web:2b6b05ad11b4826c63ea27",
  measurementId: "G-4M56M2Q8LW"
};

const savedConfig = localStorage.getItem("work_connect_firebase_config");
export const firebaseConfig = savedConfig ? JSON.parse(savedConfig) : defaultFirebaseConfig;

export const isDemoMode = !firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY";

// Real Firebase instances
let realApp = null;
let realAuth = null;
let realDb = null;
let realStorage = null;
let realGoogleProvider = null;

if (!isDemoMode) {
  try {
    realApp = initializeApp(firebaseConfig);
    realAuth = getAuth(realApp);
    realDb = getFirestore(realApp);
    realStorage = getStorage(realApp);
    realGoogleProvider = new GoogleAuthProvider();
  } catch (err) {
    // Fallback if needed
  }
}

/* ==========================================================================
   MOCK STORE (Fallback engine if offline or credentials unconfigured)
   ========================================================================== */
class LocalMockStore {
  constructor() {
    this.storageKey = "work_connect_mock_db";
    this.currentUserKey = "work_connect_mock_user";
    this.listeners = new Set();
    this.initStore();
  }

  initStore() {
    if (!localStorage.getItem(this.storageKey)) {
      const initialData = {
        users: {},
        works: {},
        applications: {}
      };
      localStorage.setItem(this.storageKey, JSON.stringify(initialData));
    }
  }

  getData() {
    try {
      return JSON.parse(localStorage.getItem(this.storageKey)) || { users: {}, works: {}, applications: {} };
    } catch {
      return { users: {}, works: {}, applications: {} };
    }
  }

  saveData(data) {
    localStorage.setItem(this.storageKey, JSON.stringify(data));
    this.notify();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    const data = this.getData();
    this.listeners.forEach((cb) => {
      try { cb(data); } catch (e) { /* silent */ }
    });
  }

  getCurrentUser() {
    try {
      const u = localStorage.getItem(this.currentUserKey);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  }

  setCurrentUser(user) {
    if (user) {
      localStorage.setItem(this.currentUserKey, JSON.stringify(user));
    } else {
      localStorage.removeItem(this.currentUserKey);
    }
    window.dispatchEvent(new CustomEvent("work_connect_auth_change", { detail: user }));
  }
}

export const mockStore = new LocalMockStore();

/* ==========================================================================
   EXPORTS
   ========================================================================== */
export const auth = realAuth;
export const db = realDb;
export const storage = realStorage;
export const googleProvider = realGoogleProvider;

export {
  signInWithPopup,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
  Timestamp
};
