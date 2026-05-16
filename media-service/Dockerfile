FROM python:3.12-slim

# System deps: FFmpeg + Tesseract + OpenCV deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    tesseract-ocr \
    tesseract-ocr-eng \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download Whisper model at build time (avoids cold-start delay)
RUN python -c "\
from faster_whisper import WhisperModel; \
model = WhisperModel('base.en', device='cpu', compute_type='int8'); \
print('Whisper base.en model ready')"

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--log-level", "info"]
