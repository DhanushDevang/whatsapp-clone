# 💬 WhatsApp Clone

A full-stack real-time messaging application with voice/video calling, built with React, TypeScript, Node.js, and PostgreSQL.

🔗 **Live Demo:** [Replit Deployment](https://whatsapp-clone--dhanush26kkrtrd.replit.app)

---

## ✨ Features

### Messaging
- Real-time text messaging via Socket.IO
- Voice message recording and playback
- Image sharing (base64 encoded)
- Message timestamps and read receipts
- Dark mode with persistent theme
- Custom chat wallpapers

### Calling
- Real-time voice and video calls powered by **LiveKit**
- Live audio/video streaming between users
- Mute/unmute and camera toggle controls
- Incoming call notifications with accept/decline

### Authentication & Security
- JWT-based authentication with **token versioning** (real session invalidation, not just client-side logout)
- bcrypt password hashing
- Case-insensitive email login
- Google reCAPTCHA v2 on login/register
- **Rate limiting** — 100 req/15min general, 5 req/15min on auth routes (brute-force protection)
- **Helmet.js** security headers
- Explicit CORS domain whitelisting
- **Audit logging** — every login attempt (success/failure) logged with IP address and timestamp
- Server-side input validation

### Architecture
- **Frontend:** React + TypeScript + Vite, deployed on Replit
- **Backend:** Node.js + Express + TypeScript, Socket.IO for real-time events
- **Database:** PostgreSQL (Neon), managed via connection pooling
- **Calling infrastructure:** LiveKit Cloud for WebRTC media routing
- **Monorepo:** pnpm workspaces

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Real-time | Socket.IO |
| Video/Voice | LiveKit |
| Database | PostgreSQL (Neon) |
| Auth | JWT, bcrypt, reCAPTCHA v2 |
| Hosting | Replit |

---

## 📋 API Overview

### Auth
- `POST /api/auth/register` — Create account (with reCAPTCHA + password strength validation)
- `POST /api/auth/login` — Login (rate-limited, audit-logged, account lockout on repeated failures)
- `POST /api/auth/logout-all` — Invalidate all active sessions for a user
- `GET /api/auth/login-logs` — View recent login activity

### Conversations & Messages
- `GET /api/conversations` — List user's conversations
- `POST /api/conversations` — Start a new conversation
- `GET /api/messages/:conversationId` — Fetch message history
- `POST /api/messages` — Send a message (text/voice/image)

### Calling
- `POST /api/livekit/token` — Generate LiveKit access token for a call room

### Real-time Socket Events
`user_online`, `join_conversation`, `send_message`, `initiate_call`, `accept_call`, `decline_call`, `end_call`

---

## 🔒 Security Notes

This project implements defense-in-depth security practices:
- Passwords are never stored in plaintext (bcrypt hashed)
- All authenticated routes verify JWT + check token version against the database, enabling true server-side logout
- Rate limiting prevents credential-stuffing and brute-force attacks
- All login attempts (successful and failed) are logged for audit purposes
- CAPTCHA prevents automated bot registration/login attempts

> **Note:** This is a personal/portfolio project. While security best practices are followed, it has not undergone professional security auditing. Messages are stored in plaintext in the database (not end-to-end encrypted) — avoid sending sensitive information.

---

## 🚀 Local Development

```bash
# Clone the repo
git clone https://github.com/DhanushDevang/whatsapp-clone.git
cd whatsapp-clone
git checkout full-rewrite-backup

# Install dependencies
pnpm install

# Set up environment variables (see .env.example)
# Required: DATABASE_URL, JWT_SECRET, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, 
# LIVEKIT_URL, VITE_RECAPTCHA_SITE_KEY, RECAPTCHA_SECRET_KEY, ALLOWED_ORIGINS

# Run backend
cd artifacts/api-server && npm run dev

# Run frontend
cd artifacts/whatsapp-clone && npm run dev
```

---

## 👤 Author

**Dhanush**  
Built as a full-stack learning project — from initial architecture through deployment, debugging, and iterative security hardening.

---

## 📄 License

This project is for educational/portfolio purposes.
