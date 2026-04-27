# 🏛️ Smart Municipality Problem Reporting System

A full-stack, production-ready civic web application that digitizes complaint management with image uploads, duplicate detection, real-time notifications, multi-language support, and admin analytics.

---

## 📁 Folder Structure

```
smart-municipality/
├── backend/
│   ├── server.js                      # Express entry point
│   ├── package.json
│   ├── .env.example                   → copy to .env
│   │
│   ├── config/
│   │   └── db.js                      # MySQL pool connection
│   │
│   ├── middleware/
│   │   ├── auth.js                    # JWT verification
│   │   └── upload.js                  # Multer config
│   │
│   ├── controllers/
│   │   ├── authController.js          # Login/Register logic
│   │   ├── complaintController.js     # Complaint CRUD
│   │   ├── adminController.js         # Admin management
│   │   └── notificationController.js
│   │
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── complaintRoutes.js
│   │   ├── adminRoutes.js
│   │   └── notificationRoutes.js
│   │
│   └── uploads/                       # Uploaded images (auto-created)
│
├── frontend/                          # Frontend (served as static files)
│   ├── index.html                     # Landing page
│   ├── login.html
│   ├── register.html
│   ├── dashboard.html                 # Citizen dashboard
│   ├── admin-dashboard.html           # Admin dashboard
│   ├── share.html                     # Public shared complaint view
│   ├── css/
│   │   └── style.css                  # Full design system
│   └── js/
│       ├── api.js                     # HTTP client, Auth, utilities
│       └── translations.js            # EN + Hindi support
│
└── database/
    └── schema.sql                     # Full DB schema + seed data
```

---

## ⚙️ Tech Stack

| Layer                | Technology                      |
| -------------------- | ------------------------------- |
| Frontend             | HTML5, CSS3, Vanilla JavaScript |
| Backend              | Node.js, Express.js             |
| Database             | MySQL 8+                        |
| Auth                 | JWT (jsonwebtoken) + bcryptjs   |
| File Uploads         | Multer                          |
| Internationalisation | Custom EN + Hindi toggle        |

---

## 🚀 Setup Instructions

### 1. Prerequisites

- Node.js v16+
- MySQL 8.0+
- npm or yarn

### 2. Clone & Install

```bash
cd backend
npm install
```

### 3. Database Setup

```bash
# Login to MySQL
mysql -u root -p

# Run the schema file
source database/schema.sql
# OR
mysql -u root -p < database/schema.sql
```

### 4. Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=municipality_db
DB_PORT=3306
JWT_SECRET=your_random_secret_key_min_32_chars
JWT_EXPIRES_IN=7d
MAX_FILE_SIZE=5242880
FRONTEND_URL=http://localhost:3000
APP_URL=http://localhost:5000
```

### 5. Start the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

### 6. Open in Browser

```
http://localhost:5000
```

> **No build step needed!** The frontend is served automatically by Express.

---

## 📊 Database Schema Summary

```
users              → Citizen accounts (id, username, email, password, mobile, city, ward, role)
admins             → Admin accounts (id, username, email, password, city, role, is_active)
complaints         → Core complaint table (problem_type ENUM 10 types, priority, status,
                     image_path, attempt_count, is_duplicate, duplicate_of,
                     share_token UUID, escalated, resolved_at, admin_notes)
notifications      → Per-user notification feed (type ENUM, title, message, is_read)
```

---

## 🔐 Demo Credentials

Register accounts through the UI after running `schema.sql`.

| Role    | Register URL                        | Tab                  |
| ------- | ----------------------------------- | -------------------- |
| Citizen | http://localhost:5000/register.html | Default              |
| Admin   | http://localhost:5000/register.html | "Admin Register" tab |

> ⚠️ The hashed passwords in schema.sql are placeholders only. Always register fresh accounts before use!

---

## 🌐 API Endpoints

### Auth `/api/auth`

| Method | Endpoint          | Auth     | Description      |
| ------ | ----------------- | -------- | ---------------- |
| POST   | /citizen/register | Public   | Register citizen |
| POST   | /citizen/login    | Public   | Citizen login    |
| POST   | /admin/register   | Public   | Register admin   |
| POST   | /admin/login      | Public   | Admin login      |
| GET    | /me               | Any role | Get current user |

### Complaints `/api/complaints`

| Method | Endpoint       | Auth    | Description                                |
| ------ | -------------- | ------- | ------------------------------------------ |
| POST   | /              | Citizen | Submit new complaint (multipart/form-data) |
| GET    | /my            | Citizen | Get my complaints                          |
| GET    | /:id           | Any     | Single complaint detail                    |
| DELETE | /:id           | Citizen | Delete complaint                           |
| POST   | /:id/reattempt | Citizen | Re-submit rejected complaint               |
| GET    | /share/:token  | Public  | Public share view                          |

### Admin `/api/admin`

| Method | Endpoint               | Auth  | Description                        |
| ------ | ---------------------- | ----- | ---------------------------------- |
| GET    | /dashboard             | Admin | Dashboard stats                    |
| GET    | /complaints            | Admin | All city complaints (with filters) |
| GET    | /complaints/:id        | Admin | Complaint detail                   |
| PUT    | /complaints/:id/status | Admin | Update status + notify citizen     |
| GET    | /users                 | Admin | City users list                    |
| GET    | /duplicates            | Admin | Duplicate complaints               |

### Notifications `/api/notifications`

| Method | Endpoint  | Auth     | Description           |
| ------ | --------- | -------- | --------------------- |
| GET    | /         | Any role | Get all notifications |
| PUT    | /:id/read | Any role | Mark as read          |
| PUT    | /read-all | Any role | Mark all as read      |

---

## ⚡ Key Features Explained

**Duplicate Detection**
When a new complaint is submitted, the system checks for an existing complaint with the same `location` and `problem_type` combination. Flagged complaints have `is_duplicate = true` and a `duplicate_of` foreign key pointing to the original, preventing redundant admin workload.

**Re-attempt & Escalation**
Citizens may re-submit a rejected complaint up to 2 times (`attempt_count` field). On a second failure, the complaint is automatically marked as `escalated = true`, triggering an escalation message and surfacing the complaint prominently in the admin dashboard.

**City-Scoped Admin**
Admins are bound to their registered city at account creation. All dashboard queries, complaint listings, and user lists are filtered by `city` — an admin from Mumbai never sees Chennai's data, eliminating cross-city data leakage without any extra middleware.

**Public Share Link**
Each complaint is assigned a UUID `share_token` on creation. The `/api/complaints/share/:token` endpoint is fully public — no JWT required — allowing citizens to share complaint status with others via a clean URL without exposing private account details.

**Multi-Language Support**
Language toggle is handled client-side via `translations.js`, which holds a flat key-value map for both English and Hindi. Switching language re-renders all `data-i18n` attribute targets instantly with no page reload.

---

## 🛡️ Security Features

- Passwords hashed with bcrypt (cost factor 10) — plaintext never stored
- JWT-based stateless auth with configurable expiry via `JWT_EXPIRES_IN`
- Separate role guards for Citizen and Admin routes — no privilege crossover
- City-scoped data isolation — admin queries always carry an implicit `WHERE city = ?` filter
- Uploaded files validated by both MIME type and file extension before saving
- File size hard-capped at 5MB via Multer; oversized requests rejected before hitting the controller
- Share tokens generated as UUIDs — non-guessable and not tied to any user identity
- Parameterized queries via `mysql2` pool throughout — no raw string interpolation
- CORS restricted to known frontend origin defined in `.env`

---

## 🔮 Future Enhancements

- WhatsApp/SMS notifications via Twilio
- Live complaint map with ward-level hotspots
- Auto-categorisation using NLP
- SLA tracking per complaint type
- Ward councillor read-only portal
- Complaint upvoting by citizens
- Offline PWA support
- Public transparency dashboard
- Multi-city superadmin panel
- PDF / Excel report export
