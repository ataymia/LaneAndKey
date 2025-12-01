# Lane & Key Properties Portal

A full-stack, role-based real estate portal built with React, TypeScript, Firebase, and designed for deployment on Cloudflare Pages.

## Features

### Authentication & Roles
- **Firebase Authentication** with email/password sign-up and login
- **Role-based access control** with three roles:
  - **Admin**: Full access to property management, tenants, applications, and settings
  - **Tenant**: Access to their rental information, payments, and maintenance requests
  - **Applicant**: Can browse properties and submit applications

### Account Flow
1. Users create an account or log in to start an application
2. New users start with the `applicant` role
3. When an application is approved, admin updates user to `tenant` role
4. User's account, documents, and history are preserved (no new account needed)

### Admin Features
- **Dashboard** with summary cards for properties, vacancies, renewals, and more
- **Properties Module** with full CRUD, photo management, and detailed listing fields
- **Applications Management** with status tracking and approval workflow
- **Tenant Management** with profiles, lease history, and payment tracking
- **Lease Management** with document attachments
- **Payments & Accounting** with Stripe integration placeholders
- **Maintenance Ticketing** with priority levels and comment threads
- **Messages** unified inbox for all communications
- **Documents Hub** for templates and tenant-specific documents
- **Settings** for company branding, payment defaults, and notifications

### Tenant Features
- **Dashboard** with rent due, lease info, and quick actions
- **Lease View** with all details and downloadable documents
- **Payment History** and online payment flow
- **Maintenance Requests** with photo uploads and status tracking
- **Documents** for uploading insurance and other required docs
- **Messages** for communicating with property manager

### Applicant Features
- **Dashboard** with application status tracking
- **Property Browsing** and application submission
- **Document Upload** for application requirements
- **Co-applicant Invitations** for household applications

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Custom CSS with periwinkle theme, responsive design
- **Authentication**: Firebase Auth
- **Database**: Cloud Firestore
- **Storage**: Firebase Storage
- **Payments**: Stripe (integration stubs)
- **Hosting**: Cloudflare Pages compatible

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Firebase project
- (Optional) Stripe account for payments

### Installation

1. **Clone and install dependencies**:
   ```bash
   cd portal
   npm install
   ```

2. **Configure Firebase**:
   - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
   - Enable Authentication (Email/Password provider)
   - Create a Firestore database
   - Create a Storage bucket
   - Get your config from Project Settings > General > Your apps

3. **Set environment variables**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your Firebase configuration:
   ```
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   ```

4. **Run development server**:
   ```bash
   npm run dev
   ```

5. **Build for production**:
   ```bash
   npm run build
   ```

### Firestore Security Rules

Set up the following security rules in Firebase Console > Firestore > Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own profile
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
      // Admins can read all users and update roles
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Properties - admins can manage, others can read on-market
    match /properties/{propertyId} {
      allow read: if resource.data.marketStatus == 'on' || 
        (request.auth != null && 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Add similar rules for other collections...
  }
}
```

### Storage Security Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Property photos - public read, admin write
    match /properties/{propertyId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Tenant documents - private
    match /tenants/{tenantId}/{allPaths=**} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == tenantId || 
         firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }
    
    // Application documents
    match /applications/{applicationId}/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Stripe Integration

The portal includes integration stubs for Stripe payments. To complete the integration:

### Frontend Configuration
Set the publishable key in your environment:
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your-publishable-key
```

### Backend Setup (Required)
Payment processing requires a backend for security. Options:

1. **Cloudflare Workers** (recommended for Cloudflare Pages):
   ```javascript
   // Example worker for /api/stripe/create-session
   import Stripe from 'stripe';
   
   const stripe = new Stripe(env.STRIPE_SECRET_KEY);
   
   export default {
     async fetch(request, env) {
       const { tenantId, amount, description } = await request.json();
       
       const session = await stripe.checkout.sessions.create({
         payment_method_types: ['card'],
         line_items: [{
           price_data: {
             currency: 'usd',
             product_data: { name: description },
             unit_amount: amount,
           },
           quantity: 1,
         }],
         mode: 'payment',
         success_url: `${env.APP_URL}/payment-success`,
         cancel_url: `${env.APP_URL}/payment-cancelled`,
         metadata: { tenantId },
       });
       
       return Response.json({ sessionId: session.id, url: session.url });
     },
   };
   ```

2. **Firebase Functions**:
   Similar implementation using Firebase Functions

### Webhook Configuration
Configure webhooks in Stripe Dashboard pointing to your backend endpoint:
- Endpoint: `https://your-domain.com/api/stripe/webhook`
- Events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`

## Deployment to Cloudflare Pages

1. **Connect your repository** to Cloudflare Pages
2. **Configure build settings**:
   - Build command: `cd portal && npm install && npm run build`
   - Build output directory: `portal/dist`
3. **Set environment variables** in Cloudflare Pages dashboard
4. **Deploy**

## Project Structure

```
portal/
├── src/
│   ├── components/
│   │   ├── auth/           # Protected route wrapper
│   │   ├── common/         # Shared UI components
│   │   └── layout/         # Sidebars, navigation, layouts
│   ├── contexts/
│   │   └── AuthContext.tsx # Authentication state management
│   ├── hooks/              # Custom React hooks
│   ├── lib/
│   │   ├── firebase/       # Firebase configuration and services
│   │   └── stripe.ts       # Stripe integration stubs
│   ├── pages/
│   │   ├── admin/          # Admin portal pages
│   │   ├── applicant/      # Applicant portal pages
│   │   ├── public/         # Login, signup pages
│   │   └── tenant/         # Tenant portal pages
│   ├── types/
│   │   └── index.ts        # TypeScript type definitions
│   ├── App.tsx             # Main app with routing
│   ├── index.css           # Global styles
│   └── main.tsx            # Entry point
├── .env.example            # Environment variable template
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Data Models

All TypeScript interfaces are defined in `src/types/index.ts`:

- **UserProfile**: User account with role and preferences
- **Property**: Full property listing with all details
- **Lead**: Prospective tenant inquiries
- **Tour**: Scheduled property viewings
- **Application**: Rental applications with household info
- **Household**: Group of applicants/tenants
- **Tenant**: Active tenant record
- **Lease**: Rental agreement details
- **Payment**: Transaction records
- **MaintenanceTicket**: Service requests
- **Message/Conversation**: Communication threads
- **Alert**: Notifications
- **DocumentTemplate**: Stored documents
- **AdminSettings**: Portal configuration

## Theming

The portal uses a periwinkle color scheme with bubbly gradients:

- Primary: `#9BAAFF`
- Primary Light: `#CCD5FF`
- Primary Dark: `#6B7FFF`

Customize colors in `src/index.css` CSS variables.

## License

MIT License
