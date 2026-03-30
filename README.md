# 💬 WhatsApp Clone

A full-stack real-time messaging application inspired by WhatsApp, built with modern web technologies.

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Socket.IO Client |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| Real-time | Socket.IO |
| Auth | JWT + bcrypt |

## ✨ Features

- 🔐 User registration and login with JWT authentication
- 💬 Real-time messaging using WebSockets
- 🎤 Voice messages (record and playback)
- 🟢 Online/Offline presence tracking
- 🌙 Dark/Light mode toggle
- 📱 WhatsApp-style modern UI
- 🔒 Password hashing with bcrypt
- 📄 Paginated message loading

## 📁 Project Structure
```
whatsapp-clone/
├── backend/
│   ├── src/
│   │   ├── config/        # Database connection
│   │   ├── controllers/   # Route handlers
│   │   ├── middleware/    # Auth & error middleware
│   │   └── routes/        # API routes
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── context/       # Auth context
│   │   ├── pages/         # AuthPage, ChatPage
│   │   └── socket.js      # Socket.IO client
│   └── package.json
└── README.md
```

## ⚙️ Setup Instructions

### Prerequisites
- Node.js v18+
- PostgreSQL 14+

### 1. Clone the repo
```bash
git clone https://github.com/DhanushDevang/whatsapp-clone.git
cd whatsapp-clone
```

### 2. Setup Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run dev
```

### 3. Setup Database
```bash
psql -U postgres -d whatsapp_clone -f schema.sql
```

### 4. Setup Frontend
```bash
cd frontend
npm install
npm start
```

### 5. Open the app
- Frontend: http://localhost:3000
- Backend API: http://localhost:5001

## 🔌 API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /api/auth/register | Register user | ❌ |
| POST | /api/auth/login | Login user | ❌ |
| GET | /api/auth/find | Find user by email | ✅ |
| GET | /api/conversations | Get all conversations | ✅ |
| POST | /api/conversations | Create conversation | ✅ |
| GET | /api/messages/:id | Get messages | ✅ |
| POST | /api/messages | Send message | ✅ |

## 🔄 Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| user_online | Client → Server | Register online status |
| online_users | Server → Client | Broadcast online users |
| join_conversation | Client → Server | Join a chat room |
| send_message | Client → Server | Send a message |
| receive_message | Server → Client | Receive a message |

## 👨‍💻 Author
Dhanush Devang
