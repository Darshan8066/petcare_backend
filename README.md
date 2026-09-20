# PetCare+ Backend API Service

Robust, production-ready RESTful API backend service for the **PetCare+** platform. Built with **Node.js**, **Express**, **MongoDB / Mongoose**, and **Google Gemini Gen AI**.

---

## 🐾 Overview

The PetCare+ backend handles user authentication, pet management, service bookings, e-commerce transactions, marketplace listings, emergency clinic directories, and AI-powered veterinary triage.

### Architecture Highlights

- **Database**: MongoDB via Mongoose. The connection is required — the server exits on startup if it cannot reach the cluster, rather than silently falling back to non-persistent storage. See `DEPLOYMENT.md`.
- **AI Integration**: Powered by `@google/genai` (Gemini 2.5 Flash) for instant veterinary health advisory with timeout guards and context injection.
- **RESTful Routing**: Modular Express routers organized cleanly by resource domain.
- **Security**: JWT authentication, bcrypt password hashing, CORS, and cookie parser.

---

## 🛠️ Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/) (ES Modules)
- **Framework**: [Express 4](https://expressjs.com/)
- **Database**: [Mongoose / MongoDB](https://mongoosejs.com/)
- **Authentication**: [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) & [bcryptjs](https://github.com/dcodeIO/bcrypt.js)
- **AI Triage**: [@google/genai](https://www.npmjs.com/package/@google/genai)
- **Utilities**: CORS, Cookie-Parser, Dotenv

---

## 📁 Project Structure

```
backend/
├── config/
│   ├── db.js                 # MongoDB connection lifecycle
│   ├── env.js                # Startup environment validation
│   ├── seed.js               # Idempotent seeding (only fills empty collections)
│   └── seedData.js           # Static seed content
├── middleware/
│   ├── auth.middleware.js    # JWT bearer & cookie authentication verification
│   └── errorHandler.js       # Centralized error handler
├── models/
│   ├── User.model.js         # User account schema
│   ├── Pet.model.js          # Pet profile schema
│   ├── Booking.model.js      # Appointments & booking schema
│   ├── Product.model.js      # E-commerce store product schema
│   ├── Order.model.js        # Checkout order schema
│   └── PetListing.model.js   # Adoption & marketplace listing schema
├── routes/
│   ├── auth.routes.js        # Login, register, profile, refresh, logout
│   ├── pet.routes.js         # Pets CRUD & medical records
│   ├── booking.routes.js     # Appointment bookings CRUD & cancellations
│   ├── provider.routes.js    # Vets, groomers, sitters listings
│   ├── product.routes.js     # Store catalog, categories, promo coupons
│   ├── order.routes.js       # Order checkout, history & tracking
│   ├── petListing.routes.js  # Adoption listings & inquiries
│   ├── ai.routes.js          # Gemini veterinary triage assistant
│   ├── misc.routes.js        # Calendar reminders, emergency clinics, notifications
│   └── admin.routes.js       # Operational stats & KPI metrics
├── appRoutes.js              # Aggregated router mount points
├── server.js                 # Express application factory (`createApp`)
├── .env.example              # Backend environment variables template
├── .gitignore                # Ignored files for version control
└── package.json              # Dependencies & scripts
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
- [MongoDB](https://www.mongodb.com/) (**required** — set `MONGO_URI`)
- Gemini API Key (optional; built-in guidance responses are used if `GEMINI_API_KEY` is omitted)

> **Setup and deployment instructions live in [`../DEPLOYMENT.md`](../DEPLOYMENT.md).**
> Copy `.env.example` to `.env` and fill it in before starting.

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configure your variables in `.env`:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/petcare_plus_db
JWT_ACCESS_SECRET=your_jwt_access_secret_key_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Run Development Server

```bash
npm run dev
```

For production execution:

```bash
npm start
```

The backend server listens on `http://localhost:5000` (or `PORT` specified in `.env`).

---

## 📡 API Endpoints Reference

### 🔐 Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a new account
- `POST /api/auth/login` — Sign in and receive JWT tokens
- `GET  /api/auth/me` — Retrieve current authenticated user profile
- `POST /api/auth/refresh` — Refresh access token
- `POST /api/auth/logout` — Logout user session

### 🐶 Pet Profiles & Health Records (`/api/pets`)
- `GET  /api/pets` — Get all pets for current user
- `GET  /api/pets/:id` — Get single pet details
- `POST /api/pets` — Register a new pet
- `PUT  /api/pets/:id` — Update pet information
- `DELETE /api/pets/:id` — Remove pet record
- `GET  /api/pets/:id/medical-records` — List medical history & vet notes
- `POST /api/pets/:id/medical-records` — Add clinical record or diagnosis

### 🩺 Service Bookings (`/api/bookings`)
- `GET   /api/bookings` — List all user bookings
- `GET   /api/bookings/:id` — Get booking details
- `POST  /api/bookings` — Create vet, grooming, or sitter booking
- `PATCH /api/bookings/:id` — Update booking status or time slot
- `PUT   /api/bookings/:id/cancel` — Cancel appointment & trigger refund

### 👨‍⚕️ Verified Providers (`/api`)
- `GET /api/vets` — List verified veterinarians and clinics
- `GET /api/groomers` — List professional pet grooming salons
- `GET /api/sitters` — List background-checked pet sitters

### 🛍️ Pet Store & Products (`/api/products`)
- `GET  /api/products` — Catalog query with category, search & sorting
- `GET  /api/products/:id` — Product details
- `GET  /api/categories` or `/api/products/categories/list` — Available product categories
- `POST /api/coupon/validate` — Validate promo code (e.g. `WELCOME10`)

### 📦 Orders & Checkout (`/api/orders`)
- `GET  /api/orders` — List user purchase orders
- `POST /api/orders` — Submit new order checkout
- `GET  /api/orders/:id` — Order status and tracking

### 🏡 Adoption Marketplace (`/api/pet-listings`)
- `GET  /api/pet-listings` — List available pets for adoption
- `GET  /api/pet-listings/:id` — Listing details
- `POST /api/pet-listings/:id/inquire` — Send inquiry or place reservation hold

### 🤖 AI Health Advisor (`/api/ai`)
- `POST /api/ai/chat` — Submit pet symptoms/questions for clinical triage advice

### 🚑 Emergency & Miscellaneous (`/api`)
- `GET  /api/emergency-clinics` — 24/7 urgent pet clinics directory
- `GET  /api/calendar` — Pet vaccination & medicine calendar tasks
- `POST /api/calendar` — Create calendar event
- `PATCH /api/calendar/:id` — Toggle event completion status
- `GET  /api/notifications` — User notifications feed
- `POST /api/notifications/read-all` — Mark notifications as read

### 📊 Admin Analytics (`/api/admin`)
- `GET /api/admin/stats` — High-level KPI metrics and system counters
"# petcare-backend" 
"# petcare_backend" 
