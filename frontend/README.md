# Prometheus Frontend

Web client for **Project Prometheus** (Clubhaus München Giesing), built with React, Vite, and Tailwind CSS.

---

## 1. Features & Tech Stack

- **Build Tool:** Vite with Hot Module Replacement (HMR)
- **UI Framework:** React (JavaScript)
- **Styling:** Tailwind CSS (via official Vite plugin)
- **Code Quality:** ESLint configuration
- **Backend Handshake:** Automatic health check querying the FastAPI backend (`[http://127.0.0.1:8000/api/v1/health](http://127.0.0.1:8000/api/v1/health)`)

---

## 2. Development Setup

### 2.1 Prerequisites
Ensure all required Node.js dependencies are installed:

```bash
npm install
```


### 2.2 Run Frontend Locally
Start the local development server:

```bash
npm run dev
```

The application runs by default at `http://localhost:5173`.


### 2.3 Backend Connectivity
To see the live connection indicator turn green, make sure the FastAPI backend server is running concurrently on port 8000:

```bash
# In the backend directory:
source .venv/bin/activate
uvicorn prometheus_backend.main:app --reload --host 127.0.0.1 --port 8000
```


## 3. Available Scripts
In the frontend directory, you can run:
 - `npm run dev`: Starts the local development server.
 - `npm run build`: Compiles and bundles production assets.
 - `npm run lint`: Runs ESLint to inspect code quality.
 - `npm run preview`: Previews the production build locally.
