# College Photo Gallery

A premium, role-based mobile application for sharing and preserving college memories. Built with React Native (Expo) and Node.js (Express).

## 🚀 Features

- **Secure Authentication**: Email/Password login with JWT and bcrypt.
- **Role-Based Access**: Specialized views and permissions for Students, Mentors, and Admins.
- **Multi-Format Support**: Upload and view both high-quality photos and PDF documents.
- **Interactive UI**: Smother image loading (expo-image), haptic feedback, and shimmer/skeleton loaders.
- **Scalable Backend**: Express.js server with MongoDB integration and secure static file serving.

## 🛠️ Tech Stack

- **Frontend**: React Native, Expo Router, Expo Image, Expo Haptics.
- **Backend**: Node.js, Express, MongoDB (Mongoose), Multer, JWT, Bcrypt.
- **Styling**: Vanilla React Native StyleSheet with Linear Gradients.

## 📦 Project Structure

```text
├── backend/
│   ├── middleware/   # Auth and RBAC middleware
│   ├── models/       # Mongoose schemas (User, Photo)
│   ├── routes/       # API endpoints
│   └── server.js     # Entry point
├── mobile/
│   ├── app/          # Expo Router file-based navigation
│   ├── components/   # Reusable UI components
│   └── services/     # API and Auth service layers
```

## ⚙️ Setup Instructions

### Backend
1. `cd backend`
2. `npm install`
3. Create a `.env` file with:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `PORT` (default 5000)
4. `npm start`

### Mobile
1. `cd mobile`
2. `npm install`
3. Update `API_URL` in `services/api.js` with your local IP.
4. `npx expo start`

## 🛡️ Security
The app uses industry-standard JWT for session management. Deletion and upload privileges are restricted to `Admin` and `Mentor` roles via server-side middleware.
