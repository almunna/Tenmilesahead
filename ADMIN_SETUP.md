# Admin System Setup Guide

This guide explains how to set up and use the admin functionality in Ten Miles Ahead.

## Overview

The admin system provides a secure dashboard for administrators to:
- View platform statistics (total users, trips, etc.)
- Monitor recent user signups
- Track recent trip creation
- Access quick action buttons for future admin features

## Files Created

### Admin Pages
- `src/app/admin/page.tsx` - Main admin dashboard
- `src/app/admin/login/page.tsx` - Admin-specific login page

### Components
- `src/components/AdminProtected.tsx` - Protected route wrapper for admin pages

### Type Updates
- `src/lib/types.ts` - Added `role` field to `UserProfile` type

### Navigation Updates
- `src/components/Navbar.tsx` - Added admin link for users with admin role

## Setting Up an Admin User

To grant admin access to a user, you need to manually update their user document in Firestore:

### Option 1: Using Firebase Console

1. Go to your Firebase Console
2. Navigate to Firestore Database
3. Find the `users` collection
4. Select the user document you want to make an admin
5. Add a new field:
   - Field name: `role`
   - Field type: `string`
   - Field value: `admin`
6. Save the document

### Option 2: Using Firestore Update Script

You can also update a user programmatically. Here's an example Node.js script:

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./path/to/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function makeUserAdmin(userId) {
  await db.collection('users').doc(userId).update({
    role: 'admin'
  });
  console.log(`User ${userId} is now an admin`);
}

// Replace with actual user ID
makeUserAdmin('USER_ID_HERE');
```

## Accessing Admin Features

### For Admin Users

1. **Login as Admin:**
   - Navigate to `/admin/login`
   - Enter your admin credentials
   - The system will verify your admin role
   - You'll be redirected to the admin dashboard

2. **Access from Main Site:**
   - Once logged in with an admin account, you'll see an orange "Admin" link in the navbar
   - Click it to access the admin dashboard directly

### Admin Dashboard Features

The dashboard displays:

#### Statistics Cards
- **Total Users** - Number of registered users
- **Total Trips** - Number of created trips
- **Avg Trips/User** - Average trips per user
- **System Status** - Current system health

#### Recent Activity
- **Recent Users** - Last 5 users who signed up
- **Recent Trips** - Last 5 trips created

#### Quick Actions (Placeholders for Future Features)
- Manage Users
- View Analytics
- System Settings

## Security Features

1. **Role-Based Access Control:**
   - Only users with `role: "admin"` can access admin pages
   - Regular users are redirected to the login page

2. **Protected Routes:**
   - Admin pages use `AdminProtected` component wrapper
   - Verifies authentication AND admin role before rendering

3. **Dedicated Login:**
   - Separate admin login page with role verification
   - Prevents unauthorized access attempts

## Future Enhancements

The quick action buttons on the dashboard are placeholders for future features:

- **Manage Users:** View all users, edit profiles, deactivate accounts
- **View Analytics:** Detailed usage statistics, graphs, and reports
- **System Settings:** Configure app-wide settings, feature flags, etc.

## Troubleshooting

### Can't Access Admin Dashboard
- Ensure your user document has `role: "admin"` in Firestore
- Clear browser cache and cookies
- Try logging out and logging back in

### Admin Link Not Showing in Navbar
- Verify your user profile has the admin role
- Check browser console for any errors
- Refresh the page to ensure profile data is loaded

### Access Denied Error
- Confirm the user document in Firestore has the correct role
- Ensure you're logged in with the correct account
- Check Firebase security rules allow reading the role field

## Development Notes

- The admin system uses the existing Firebase authentication
- Admin status is stored in Firestore user documents
- No separate admin database required
- Future: Consider adding Firestore security rules to protect admin-only operations
