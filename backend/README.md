# Calviz CampusCRM Backend

This is the production-ready Node.js/Express backend for Calviz CampusCRM. It uses PostgreSQL with Prisma ORM and features a modular architecture for scalable admissions operations.

## 🚀 Features
- **JWT & RBAC**: Advanced authentication with access/refresh tokens and Role-Based Access Control.
- **Lead Lifecycle**: Complete management of student leads, following the New Enquiry -> Counseling -> Admission flow.
- **Call Tracking**: Detailed history of all student interactions and follow-ups.
- **Analytics**: Real-time KPI aggregation for the dashboard.
- **Finance**: Invoice generation and payment tracking.
- **Docker Support**: Containerized environment for rapid deployment.

## 🛠️ Setup Instructions

### Prerequisites
- Node.js (v18+)
- PostgreSQL (v14+) OR Docker

### Installation
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   - Create a `.env` file based on `.env.example`.
   - Update `DATABASE_URL` with your PostgreSQL credentials.

### Database Initialization
1. Run migrations to create tables:
   ```bash
   npx prisma migrate dev --name init
   ```
2. Seed the database with master data:
   ```bash
   npm run prisma:seed
   ```

### Running the Server
- **Development**: `npm run dev`
- **Production**: `npm start`
- **Docker**: `docker-compose up --build`

## 📡 API Documentation
The API follows a modular structure. Main endpoints:
- `POST /api/auth/login`: Authenticate and get tokens.
- `GET /api/health`: Check backend health.
- `GET /api/dashboard/stats`: Get KPI summaries for the dashboard.
- `GET /api/leads`: List student leads with advanced filters.
- `POST /api/followups`: Record a new student interaction.

## 👥 Seed Accounts
- **Admin**: `admin@calviz.in` / `Admin@123`
- **Manager**: `Manager@calviz.in` / `Manager@123`
- **Sales**: `User1@calviz.in` / `Sales@123`
