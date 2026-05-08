# Social Growth AI — Media Processing Service

Python FastAPI microservice that powers the multimodal video pipeline:
- **FFmpeg** — video download + audio extraction + keyframe sampling
- **faster-whisper** — on-device audio transcription (no API cost)
- **PySceneDetect** — intelligent scene-based frame selection
- **pytesseract** — OCR text extraction from video frames

## Local Development

### Prerequisites
- Python 3.11+
- [FFmpeg](https://ffmpeg.org/download.html) installed and on PATH
- [Tesseract OCR](https://github.com/UB-Mannheim/tesseract/wiki) installed

### Setup

```bash
cd media-service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Test it:
```bash
curl http://localhost:8000/health
# {"status":"ok","model":"base.en"}

curl -X POST http://localhost:8000/process \
  -H "Content-Type: application/json" \
  -d '{"video_url": "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4"}'
```

### Environment
In `.env.local` (Next.js app):
```
MEDIA_SERVICE_URL=http://localhost:8000
```

---

## Production Deployment (Render.com)

1. Create a free account at [render.com](https://render.com)
2. Click **New → Web Service**
3. Connect this repository
4. Set **Root Directory** → `media-service`
5. Set **Runtime** → `Docker`
6. Click **Create Web Service**

After deploy, get your service URL (e.g. `https://social-growth-media-service.onrender.com`) and add it to Vercel:

```
MEDIA_SERVICE_URL=https://social-growth-media-service.onrender.com
```

### Important Notes
- **Free tier cold starts:** Service sleeps after 15 min idle → 30-60s first request delay.
  The `/api/media/process` route sends a warm-up ping before the main request.
- **No persistent disk on free tier.** All files are processed in `/tmp` (ephemeral).
- **Whisper model** (`base.en`) is pre-downloaded at Docker build time — no runtime download.

---

## API Reference

### `GET /health`
```json
{ "status": "ok", "model": "base.en" }
```

### `POST /process`
**Request:**
```json
{
  "video_url": "https://...",
  "max_frames": 12
}
```

**Response:**
```json
{
  "frames": [
    {
      "index": 0,
      "timestamp": 0.5,
      "scene_index": 0,
      "base64": "<jpeg base64>",
      "mime_type": "image/jpeg"
    }
  ],
  "transcript": "Full spoken text from the video",
  "hook_phrase": "First 5 seconds of speech",
  "segments": [
    { "start": 0.0, "end": 2.3, "text": "spoken segment text" }
  ],
  "ocr_texts": [
    { "frame_index": 0, "text": "On-screen text found" }
  ],
  "duration_seconds": 30.5,
  "frame_count": 12,
  "scene_count": 6,
  "audio_energy": "high",
  "fallback": false
}
```

**Fallback response** (when video download or processing fails):
```json
{
  "fallback": true,
  "error": "reason",
  "frames": [], "transcript": "", ...
}
```
The Next.js app handles `fallback: true` gracefully and falls back to caption-only analysis.

---

## Frame Sampling Strategy

Frames are selected intelligently — NOT uniformly:

| Zone | Strategy |
|---|---|
| First 3s | Dense 1fps — captures hook |
| Mid-video | PySceneDetect scene transitions (threshold 27) |
| Last 3s | Dense 1fps — captures CTA |
| Max total | 12 frames (configurable via `max_frames`) |

Each frame is downscaled to 1280px wide, JPEG quality 75 — optimized for Gemini Vision API tokens.

---

## Cost Model

| Step | Cost |
|---|---|
| Video download | $0 |
| FFmpeg extraction | $0 |
| faster-whisper transcription | $0 |
| PySceneDetect scene detection | $0 |
| pytesseract OCR | $0 |
| **This entire service** | **$0** |

Only the Next.js app pays for Gemini API calls (vision + reasoning = ~$0.017/analysis).
