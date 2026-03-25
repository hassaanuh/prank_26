# 🚀 GivingTuesday Meme Lab v2 — Setup Guide
## Anonymous Edition · No email · No passwords · Just vibes

---

## Step 1 — Create a Firebase Project (free)

1. Go to **https://console.firebase.google.com**
2. Click **"Add project"** → Name it `givingtuesday-memelab` → Continue
3. Disable Google Analytics if you want → **Create project**

---

## Step 2 — Enable Anonymous Authentication

1. Left sidebar → **Build → Authentication → Get started**
2. Click the **"Sign-in method"** tab
3. Click **"Anonymous"** → toggle **Enable** → **Save**

That's it. No email providers needed.

---

## Step 3 — Create Firestore Database

1. Left sidebar → **Build → Firestore Database → Create database**
2. Choose **"Start in test mode"** → pick a region → **Enable**

---

## Step 4 — Enable Storage

1. Left sidebar → **Build → Storage → Get started**
2. Start in test mode → **Done**

---

## Step 5 — Get Your Config

1. **Project Settings** (gear icon) → scroll to **"Your apps"**
2. Click **"</>"** (Web) → register with any nickname → **Register app**
3. Copy the `firebaseConfig` object

---

## Step 6 — Paste Into the App

Open `js/firebase-config.js` and replace:

```js
const firebaseConfig = {
  apiKey:            "AIza...",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project-id",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123...:web:abc..."
};
```

---

## Step 7 — Firestore Security Rules

Firestore → **Rules** tab → paste and **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /memes/{memeId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
      allow delete: if request.auth.uid == resource.data.userId;
    }
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth.uid == userId;
    }
  }
}
```

---

## Step 8 — Storage Rules

Storage → **Rules** tab → paste and **Publish**:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /memes/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## Step 9 — Deploy to GitHub Pages

Upload all files to your GitHub repo keeping this structure:
```
index.html
css/style.css
js/app.js
js/firebase-config.js
SETUP.md
```

Go to **Settings → Pages → Deploy from branch → main → / (root) → Save**

Your site will be live at: `https://yourusername.github.io/your-repo-name`

---

## How anonymous auth works

- When someone visits, Firebase silently creates an anonymous session
- A random fun name (e.g. `GenerousOtter142`) is generated and saved in their browser
- They can rename themselves anytime — name is stored in `localStorage` + Firestore
- Their anonymous UID persists as long as they use the same browser
- No email, no password, no friction

---

## Free tier limits (more than enough)
| Feature | Free limit |
|---|---|
| Firestore reads | 50,000 / day |
| Firestore writes | 20,000 / day |
| Storage | 1 GB total |
| Bandwidth | 10 GB / month |
| Anonymous auth sessions | Unlimited |
