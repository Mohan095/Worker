# Work Connect (ஒர்க் கனெக்ட் / वर्क कनेक्ट)

**Find Work • Share Work • Connect**

Work Connect is a modern, responsive, no-framework web application connecting skilled workers (electricians, carpenters, plumbers, painters, construction laborers, drivers, etc.) directly with employers and homeowners.

Built strictly with:
- **HTML5** (Semantic structure)
- **CSS3** (Custom design tokens, glassmorphism, responsive mobile bottom navigation)
- **Vanilla JavaScript** (Modular ES6 modules, zero bundlers, zero npm dependencies)
- **Firebase Modular SDK** (Loaded from Google CDN via `<script type="module">`)

---

## 📁 Project Structure

```text
WorkConnect/
│
├── index.html              # Landing gateway & smart session redirect
├── login.html              # Google Authentication page
├── profile-setup.html      # First-time user profile setup & validation
├── language.html           # 3-Language selector (தமிழ் / English / हिन्दी)
├── home.html               # Main dashboard with live works & search
├── add-work.html           # Post a new work form
├── work-details.html       # Full work details, call employer, apply action
├── my-works.html           # Posted works manager, edit, status toggle, applicants
├── my-applications.html    # Candidate application tracker
├── profile.html            # Profile view & edit, language switcher, logout
│
├── css/
│   ├── style.css           # Core design system, tokens, typography, toasts, modals
│   ├── auth.css            # Authentication cards, language tiles & onboarding
│   ├── dashboard.css       # Work cards, applicant management & profile layout
│   └── responsive.css      # Mobile drawer, breakpoints, mobile bottom bar
│
├── js/
│   ├── firebase-config.js  # CDN imports, config placeholders & resilient mock store
│   ├── auth.js             # Google Auth, popup handling & friendly error handling
│   ├── profile.js          # Profile setup, 10-digit mobile validation & editing
│   ├── language.js         # Multi-language controller & Firestore sync
│   ├── works.js            # Live works feed, search, add work, edit & deactivation
│   ├── applications.js     # Duplicate-safe apply logic, direct calling & review
│   ├── common.js           # Header, bottom nav, route guards, modals & toasts
│   └── translations.js     # Comprehensive dictionary for en, ta, and hi
│
├── assets/
│   └── logo.svg            # Custom vector brand logo
│
├── firestore.rules         # Enterprise Cloud Firestore security rules
├── firestore.indexes.json  # Query composite indexes
└── README.md               # Complete setup and deployment documentation
```

---

## 🚀 Quick Start (Local Run)

Because this is a pure HTML/CSS/Vanilla JS application using browser ES modules, simply serve the folder using any local static HTTP server:

### Option 1: Python HTTP Server (Built-in)
```bash
python -m http.server 8000
```
Open [http://localhost:8000](http://localhost:8000) in your browser.

### Option 2: VS Code Live Server or Antigravity Browser
Right-click `index.html` and click **"Open with Live Server"**.

> **Note on Demo Mode**: The application includes an active Local Simulation Engine that persists sample data to `localStorage`. You can immediately test login, profile creation, work posting, applying, language switching, and applicant reviews even before adding your Firebase API keys!

---

## 🔥 Firebase Setup Guide

Follow these steps to connect Work Connect to your live Firebase project:

### 1. Create a Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project**, enter **Work Connect**, and continue.

### 2. Add a Web App
1. On your project overview page, click the **Web icon (`</>`)**.
2. Enter an app nickname (e.g., `work-connect-web`) and register.
3. You will receive your `firebaseConfig` object:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "work-connect-xxx.firebaseapp.com",
     projectId: "work-connect-xxx",
     storageBucket: "work-connect-xxx.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```

### 3. Replace Config in `js/firebase-config.js`
Open [js/firebase-config.js](file:///d:/Work%20web/js/firebase-config.js) and replace the default placeholders with your credentials:
```javascript
const defaultFirebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "YOUR_ACTUAL_AUTH_DOMAIN",
  projectId: "YOUR_ACTUAL_PROJECT_ID",
  storageBucket: "YOUR_ACTUAL_STORAGE_BUCKET",
  messagingSenderId: "YOUR_ACTUAL_MESSAGING_SENDER_ID",
  appId: "YOUR_ACTUAL_APP_ID"
};
```
*(Alternatively, in Demo Mode you can click the banner at the top of the app and paste your configuration directly into the UI!)*

### 4. Enable Firebase Authentication (Google Provider)
1. In Firebase Console, open **Build** → **Authentication**.
2. Click **Get Started**.
3. Under the **Sign-in method** tab, click **Google**, enable it, specify your support email, and click **Save**.
4. In **Authorized domains**, ensure `localhost` is listed (it is by default).

### 5. Create Cloud Firestore
1. In Firebase Console, open **Build** → **Firestore Database**.
2. Click **Create database**, choose your preferred region, and start in **Production mode**.
3. Go to the **Rules** tab and paste the contents of `firestore.rules`.
4. Click **Publish**.

### 6. Deploy Indexes & Rules via Firebase CLI (Optional)
If you have `firebase-tools` installed:
```bash
firebase login
firebase init firestore
firebase deploy --only firestore:rules,firestore:indexes
```

---

## 🌐 Deploy to Firebase Hosting

To deploy your static site for free with global CDN and SSL:
```bash
firebase init hosting
# Select your project
# Set public directory to: . (or leave as current directory)
# Configure as single-page app: No
# Overwrite index.html: No
firebase deploy --only hosting
```

---

## 🌟 Key Features

1. **True Multilingual Support**:
   - English (`en`), தமிழ் (`ta`), and हिन्दी (`hi`).
   - Dynamic real-time translation with automatic persistence.
2. **Duplicate Application Prevention**:
   - Candidates cannot re-apply to the same work.
3. **Employer Workflow**:
   - Edit work details, toggle active/inactive status, or permanently delete postings.
   - Review incoming applications with applicant names and phone numbers.
   - Accept or Reject applications with immediate status synchronization.
4. **Mobile Ergonomics**:
   - Sticky mobile bottom navigation bar with quick action buttons.
   - Direct `tel:` calling on mobile and one-click copy on desktop.
