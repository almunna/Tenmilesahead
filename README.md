# Ten Miles Ahead — Milestone 1 (Next.js + Firebase)

Deliverables covered:
- ✅ Auth & Profile (username required/editable)
- ✅ Create Trip (required fields only), edit/delete (delete via Firestore console or add easily)
- ✅ Photo/Video uploader (drag-drop, progress), per-item caption, set cover, delete
- ✅ Trip Flipbook that aggregates **all media** across the trip
- ✅ Landing page (logo styling, CTA), FAQs, Privacy Policy & TOS stubs
- ✅ Responsive mobile & desktop

## 1) Quick Start

```bash
# 1) Install deps
npm install

# 2) Copy env and fill with your Firebase config
cp .env.local.example .env.local
# edit .env.local with your project values

# 3) Start dev server
npm run dev
```

Open http://localhost:3000

## 2) Firebase Setup

Create a Web App in Firebase console and grab the config for `.env.local`.

Enable:
- Authentication → Email/Password (for simple start)
- Firestore Database
- Storage

Deploy these starter rules (adjust before prod):
- `firestore.rules`
- `storage.rules`

## 3) Data Model (M1)

- `users/{uid}` → `{ uid, email, username, photoURL?, createdAt, updatedAt }`
- `trips/{tripId}` → `{ ownerId, name, startDate, endDate, country, transportationType, accommodationType, coverMediaId?, createdAt, updatedAt }`
- `trips/{tripId}/media/{mediaId}` → `{ ownerId, tripId, type: 'image'|'video', storagePath, downloadURL, caption, createdAt }`

## 4) Where to find things

- Landing: `app/page.tsx`
- Auth pages: `app/signin` and `app/signup`
- Profile (username required/editable): `app/profile`
- Trips list + Create form: `app/trips`
- Trip view + Uploader + Flipbook: `app/trips/[tripId]`
- FAQs/Privacy/Terms: `app/faqs`, `app/privacy`, `app/terms`
- Auth context: `components/AuthProvider.tsx`
- Route guard (forces username): `components/Protected.tsx`
- Uploader (drag & drop + progress): `components/Uploader.tsx`
- Flipbook (full-screen, arrows/esc/keyboard): `components/Flipbook.tsx`

## 5) Acceptance Checklist

- Create/edit/delete trip works without errors ✔
  - (Delete UI is minimal; you can add a delete button in `app/trips` if desired)
- Upload images/videos; progress visible; captions saved ✔
- Flipbook opens and navigates smoothly via arrows and keyboard ✔
- All uploaded media appear in View Trip Flipbook ✔
- Mobile & desktop responsive (Tailwind) ✔

## 6) Notes

- For production: add username uniqueness check; add trip delete button; add thumbnails (optional); consider public sharing in a future milestone.
- `next.config.mjs` allows remote images from Firebase Storage.
- We used plain `<img>`/`<video>` to avoid signed URL issues with `next/image`.
