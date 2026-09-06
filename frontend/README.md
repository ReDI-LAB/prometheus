# Prometheus Frontend

Web client for **Project Prometheus** (Clubhaus München Giesing), built with React, Vite, and Tailwind CSS.

## Features & Setup

- **Build Tool:** Vite with Hot Module Replacement (HMR)
- **UI Framework:** React (JavaScript)
- **Styling:** Tailwind CSS (via official Vite plugin)
- **Code Quality:** ESLint configuration
- **Backend Handshake:** Automatic health check querying the FastAPI backend (`http://127.0.0.1:8000/api/v1/health`)

## Development

### 1. Prerequisites

Ensure dependencies are installed:

```bash
npm install