# ==============================================================================
# FOLDORA PDF - MULTI-STAGE DOCKERFILE
# Stage 1: Build Frontend (Vite + React + Tailwind CSS)
# Stage 2: Runtime Environment (Python + Debian PDF Utilities + FastAPI)
# ==============================================================================

# --- Stage 1: Build React Frontend ---
FROM node:22-slim AS frontend-builder
WORKDIR /build

# Copy frontend manifest and install dependencies
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source and build static bundle
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Python Runtime Stage ---
FROM python:3.11-slim

# Prevent Python from writing .pyc files and buffer outputs
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PORT=10000

WORKDIR /app

# Install system dependencies for complete PDF operations:
# - ghostscript: PDF compression & PDF/A generation
# - qpdf: Structural repair and linearized PDF checking
# - poppler-utils: PDF utilities and inspection
# - libreoffice-nogui: Headless office document conversion (Writer, Calc, Impress)
# - tesseract-ocr & language packs: OCR optical recognition
# - core system fonts for document rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript \
    qpdf \
    poppler-utils \
    libreoffice-nogui \
    tesseract-ocr \
    tesseract-ocr-eng \
    fonts-dejavu-core \
    fonts-liberation \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY app/ ./app
COPY conftest.py .

# Copy built frontend assets from Stage 1 into frontend/dist
COPY --from=frontend-builder /build/dist ./frontend/dist

# Expose Render PORT
EXPOSE 10000

# Start Uvicorn bound to 0.0.0.0 using dynamic Render PORT variable
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1"]
