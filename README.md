# 🏛️ Smart Municipality Problem Reporting System

A full-stack, production-ready civic web application that digitizes complaint management with image uploads, complaint joining system, real-time notifications, and admin analytics.

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
│   ├── data/
│   │   └── locations.json             # Location data (State/District/Taluk/Area)
│   ├── images/
│   │   └── municipality-logo.png      # Municipality logo
│   └── js/
│       └── api.js                     # HTTP client, Auth, utilities
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
users                → Citizen accounts (id, username, email, password, mobile, state, district, taluk, area, city, role)
admins               → Admin accounts (id, username, email, password, city, role, is_active)
complaints           → Core complaint table (problem_type ENUM 10 types, priority, status,
                       image_path, attempt_count, supporter_count,
                       share_token UUID, escalated, resolved_at, admin_notes)
complaint_supporters → Join table linking supporters to complaints (complaint_id, user_id, joined_at)
notifications        → Per-user notification feed (type ENUM, title, message, is_read)
```

---

## 🔐 Demo Credentials

Register citizen accounts through the UI after running `schema.sql`.

| Role    | City              | Email                              | Password   |
| ------- | ----------------- | ---------------------------------- | ---------- |
| Admin   | Udupi             | admin@municipality.com             | Admin@123  |
| Admin   | Bengaluru Urban   | admin.bengaluru@municipality.com   | Admin@123  |
| Admin   | Mysuru            | admin.mysuru@municipality.com      | Admin@123  |
| Admin   | Dakshina Kannada  | admin.dk@municipality.com          | Admin@123  |
| Admin   | Shivamogga        | admin.shivamogga@municipality.com  | Admin@123  |
| Citizen | —                 | Register at `/register.html`       | —          |

> ⚠️ Admin accounts are not self-registered. Add admins directly to the `admins` table in MySQL.

---

## 🌐 API Endpoints

### Auth `/api/auth`

| Method | Endpoint          | Auth     | Description      |
| ------ | ----------------- | -------- | ---------------- |
| POST   | /citizen/register | Public   | Register citizen |
| POST   | /citizen/login    | Public   | Citizen login    |
| POST   | /admin/login      | Public   | Admin login      |
| GET    | /me               | Any role | Get current user |
| DELETE | /me               | Citizen  | Delete account   |

### Complaints `/api/complaints`

| Method | Endpoint       | Auth    | Description                                |
| ------ | -------------- | ------- | ------------------------------------------ |
| POST   | /              | Citizen | Submit new complaint (multipart/form-data) |
| POST   | /check-match   | Citizen | Check for matching complaints before submit|
| GET    | /my            | Citizen | Get own + joined complaints                |
| GET    | /:id           | Citizen | Single complaint detail (owner or supporter)|
| DELETE | /:id           | Citizen | Delete own complaint                       |
| POST   | /:id/join      | Citizen | Join existing complaint as supporter       |
| POST   | /:id/leave     | Citizen | Leave a joined complaint                   |
| POST   | /:id/reattempt | Citizen | Re-submit rejected complaint               |
| GET    | /share/:token  | Public  | Public share view                          |

### Admin `/api/admin`

| Method | Endpoint               | Auth  | Description                              |
| ------ | ---------------------- | ----- | ---------------------------------------- |
| GET    | /dashboard             | Admin | Dashboard stats (incl. high impact)      |
| GET    | /complaints            | Admin | All city complaints (with filters/sort)  |
| GET    | /complaints/:id        | Admin | Complaint detail + supporter list        |
| PUT    | /complaints/:id/status | Admin | Update status + notify all supporters    |
| GET    | /users                 | Admin | City users list                          |
| DELETE | /users/:id             | Admin | Delete a citizen account                 |
| GET    | /high-impact           | Admin | Complaints with multiple supporters      |

### Notifications `/api/notifications`

| Method | Endpoint  | Auth     | Description           |
| ------ | --------- | -------- | --------------------- |
| GET    | /         | Any role | Get all notifications |
| PUT    | /:id/read | Any role | Mark as read          |
| PUT    | /read-all | Any role | Mark all as read      |

---

## ⚡ Key Features Explained

**Complaint Joining System**
When a citizen submits a complaint, the system checks for existing active complaints with the same `problem_type`, `city`, and `area`. If a match is found, the citizen is shown the existing complaint and offered a "Join Existing Complaint" button. Joining links the citizen as a supporter — they receive all status updates and resolution notifications without creating a duplicate entry. The `supporter_count` tracks how many citizens are affected, and complaints auto-escalate in priority when many users join (5+ → High, 10+ → Urgent). Admins see consolidated complaints with full supporter lists in the "Public Impact" section.

**Re-attempt & Escalation**
Citizens may re-submit a rejected complaint up to 2 times (`attempt_count` field). On a second failure, the complaint is automatically marked as `escalated = true`, triggering an escalation message and surfacing the complaint prominently in the admin dashboard.

**Location-Based Registration**
Citizens select their location through cascading dropdowns (State → District → Taluk → Area) loaded from `frontend/data/locations.json`. This ensures consistent location data and routes complaints to the correct municipality admin.

**City-Scoped Admin**
Admins are bound to their city (district) at account creation via SQL. All dashboard queries, complaint listings, and user lists are filtered by `city` — an admin from Udupi never sees Bengaluru's data, eliminating cross-city data leakage without any extra middleware.

**Public Share Link**
Each complaint is assigned a UUID `share_token` on creation. The `/api/complaints/share/:token` endpoint is fully public — no JWT required — allowing citizens to share complaint status with others via a clean URL without exposing private account details.


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
- Live complaint map with area-level hotspots
- Auto-categorisation using NLP
- SLA tracking per complaint type
- Area councillor read-only portal
- Complaint upvoting by citizens
- Offline PWA support
- Public transparency dashboard
- Multi-city admin panel
- PDF / Excel report export
