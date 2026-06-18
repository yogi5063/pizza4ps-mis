# ───────────────────────────────────────────────────────────────────────────
# Stage 1 — Build the React (Vite) frontend into static files
# ───────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

# Install dependencies first (better build caching)
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Build the production bundle → /frontend/dist
COPY frontend/ ./
RUN npm run build


# ───────────────────────────────────────────────────────────────────────────
# Stage 2 — Python backend that serves the API *and* the built frontend
# ───────────────────────────────────────────────────────────────────────────
FROM python:3.11.9-slim

# Keep Python output unbuffered (logs appear immediately)
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Copy the built frontend from Stage 1 into the location main.py expects
# (main.py looks for ../frontend/dist relative to the backend folder)
COPY --from=frontend-builder /frontend/dist ./frontend/dist

# Persistent data (SQLite DB + uploaded files) live under /data — mounted as a volume
ENV DATABASE_URL=sqlite:////data/pizza4ps_mis.db \
    UPLOAD_DIR=/data/uploads

WORKDIR /app/backend

EXPOSE 8000

# Single worker is correct here: SQLite + in-process startup seeding.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
