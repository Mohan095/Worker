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
  increment
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

/* ==========================================================================
   FIREBASE CONFIGURATION
   Replace these placeholders with your actual Firebase Web App Credentials
   Found in Firebase Console -> Project Settings -> General -> Your apps -> Web app
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

// Check if credentials have been saved in browser localStorage for quick testing
const savedConfig = localStorage.getItem("work_connect_firebase_config");
export const firebaseConfig = savedConfig ? JSON.parse(savedConfig) : defaultFirebaseConfig;

export const isDemoMode = !firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY";

// Real Firebase variables
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
    
    // Optional Analytics
    import("https://www.gstatic.com/firebasejs/10.13.2/firebase-analytics.js")
      .then(({ getAnalytics, isSupported }) => {
        isSupported().then((supported) => {
          if (supported) getAnalytics(realApp);
        }).catch(() => {});
      })
      .catch(() => {});

    console.log("✅ Work Connect: Firebase successfully initialized in Cloud Mode with project: " + firebaseConfig.projectId);
  } catch (err) {
    console.warn("⚠️ Work Connect: Firebase cloud initialization failed. Switching to Local Demo Mode.", err);
  }
} else {
  console.info("ℹ️ Work Connect: Running in Local Demo Mode (Mock Firestore & Auth active). Replace placeholders in js/firebase-config.js to connect to live Firebase.");
}

/* ==========================================================================
   SIMULATED / MOCK STORE (Active when using placeholders so UI & tests work 100%)
   ========================================================================== */
class LocalMockStore {
  constructor() {
    this.storageKey = "work_connect_mock_db";
    this.currentUserKey = "work_connect_mock_user";
    this.listeners = new Set();
    this.initSampleData();
  }

  initSampleData() {
    if (!localStorage.getItem(this.storageKey)) {
      const initialData = {
        users: {
          "demo-user-123": {
            uid: "demo-user-123",
            name: "Rajesh Kumar",
            email: "rajesh.workconnect@example.com",
            photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
            location: "Chennai, Tamil Nadu",
            address: "No. 45, Anna Salai, T. Nagar",
            mobile: "9876543210",
            language: "en",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        },
        works: {
          "work-101": {
            id: "work-101",
            workId: "work-101",
            workName: "Experienced House Electrician Needed",
            workPlace: "Metro Residential Apartments",
            workAddress: "Velachery Main Road, Chennai",
            mobile1: "9876543210",
            mobile2: "9840112233",
            description: "Need a certified electrician for complete conduit wiring, switchboard fixing, and inverter installation for 3-BHK flats. Daily wage Rs. 950 + lunch provided.",
            category: "Electrical & Wiring",
            postedBy: "demo-user-123",
            postedByName: "Rajesh Kumar",
            postedByEmail: "rajesh.workconnect@example.com",
            status: "active",
            applicantsCount: 1,
            createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
            updatedAt: new Date().toISOString()
          },
          "work-102": {
            id: "work-102",
            workId: "work-102",
            workName: "Modular Kitchen Carpenter Required",
            workPlace: "Design Studio Site",
            workAddress: "Koramangala 4th Block, Bengaluru",
            mobile1: "9123456780",
            mobile2: "",
            description: "Looking for 2 skilled carpenters for plywood laminate pressing, hinge installation and modular kitchen setup. 4 days work. Good pay.",
            category: "Carpentry & Woodwork",
            postedBy: "another-user-456",
            postedByName: "Suresh Builders",
            postedByEmail: "suresh@example.com",
            status: "active",
            applicantsCount: 0,
            createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
            updatedAt: new Date().toISOString()
          },
          "work-103": {
            id: "work-103",
            workId: "work-103",
            workName: "Commercial Painter for 2-Floor Villa",
            workPlace: "Green Valley Enclave",
            workAddress: "OMR, Thoraipakkam, Chennai",
            mobile1: "9988776655",
            mobile2: "",
            description: "Interior and exterior wall putty and emulsion paint coating. Scaffoldings provided by contractor. Work begins Monday.",
            category: "Painting",
            postedBy: "another-user-456",
            postedByName: "Suresh Builders",
            postedByEmail: "suresh@example.com",
            status: "active",
            applicantsCount: 2,
            createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
            updatedAt: new Date().toISOString()
          }
        },
        applications: {
          "app-201": {
            id: "app-201",
            applicationId: "app-201",
            workId: "work-101",
            applicantId: "worker-user-789",
            applicantName: "Mani Kandan",
            applicantEmail: "manikandan@example.com",
            applicantMobile: "9845098450",
            appliedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
            status: "pending"
          }
        }
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
      try { cb(data); } catch (e) { console.error(e); }
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
    // trigger auth listeners
    window.dispatchEvent(new CustomEvent("work_connect_auth_change", { detail: user }));
  }
}

export const mockStore = new LocalMockStore();

/* ==========================================================================
   UNIFIED EXPORTS
   These allow the app to work seamlessly whether using real Firebase or mock mode.
   ========================================================================== */

export const auth = realAuth;
export const db = realDb;
export const storage = realStorage;
export const googleProvider = realGoogleProvider;

// Re-export SDK primitives for convenience across modules
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
  increment
};
