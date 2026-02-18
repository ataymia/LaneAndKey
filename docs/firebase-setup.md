# Firebase Setup Guide

This guide covers configuring Firebase for the Lane & Key Properties portal.

## 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project** → name it (e.g. `laneandkey-prod`)
3. Enable Google Analytics if desired → **Create project**

## 2. Enable Firebase Services

### Authentication
1. Go to **Authentication → Sign-in method**
2. Enable **Email/Password**
3. (Optional) Enable **Google** provider

### Firestore Database
1. Go to **Firestore Database → Create database**
2. Choose **Start in production mode**
3. Select a region closest to your users (e.g. `us-east1`)
4. Deploy the rules from `firestore.rules`:
   ```bash
   firebase deploy --only firestore:rules
   ```

### Storage
1. Go to **Storage → Get started**
2. Start in **production mode**
3. Choose the same region as Firestore
4. Deploy storage rules:
   ```bash
   firebase deploy --only storage
   ```

## 3. Get Web App Config

1. Go to **Project settings → General → Your apps**
2. Click **Add app → Web** (</>)
3. Name it (e.g. "Lane & Key Portal")
4. Copy the config object

## 4. Set Environment Variables

Create `portal/.env` (or set in your CI/CD):

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

## 5. Firestore Indexes

If any queries require composite indexes, Firebase will log an error link.
Click it to auto-create the index, or add to `firestore.indexes.json`:

```bash
firebase deploy --only firestore:indexes
```

### Recommended indexes

| Collection      | Fields                             |
|----------------|------------------------------------|
| rentStatements | `tenantUid` ASC, `month` DESC      |
| rentStatements | `status` ASC, `month` DESC         |
| portalDocuments| `ownerUid` ASC, `createdAt` DESC   |
| payments       | `tenantId` ASC, `createdAt` DESC   |

## 6. Bootstrap the First Admin

After a user signs up, promote them to admin:

```bash
FIREBASE_PROJECT_ID=your-project-id \
FIREBASE_SA_KEY=$(base64 -w0 service-account.json) \
node scripts/bootstrap-admin.js <firebase-uid>
```

Or use `gcloud auth login` + Application Default Credentials:

```bash
FIREBASE_PROJECT_ID=your-project-id \
node scripts/bootstrap-admin.js <firebase-uid>
```

## 7. Security Rules Overview

See `firestore.rules` for the full rule set. Key patterns:

- **Admin**: Full read/write on all collections
- **Tenant**: Read own documents, statements, ledger entries
- **Applicant**: Read/write own applications and documents
- Users can only read their own `users/{uid}` document
- Ledger entries require parent statement check for tenant access

## 8. Storage Security

Firebase Storage rules should mirror Firestore access:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /documents/{userId}/{allPaths=**} {
      allow read: if request.auth != null && 
        (request.auth.uid == userId || isAdmin());
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /leases/{leaseId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && isAdmin();
    }
    match /properties/{propertyId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && isAdmin();
    }
    function isAdmin() {
      return firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```
