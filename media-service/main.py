"""
Social Growth AI — Media Processing Service
FastAPI microservice: FFmpeg frame extraction + faster-whisper + pytesseract OCR
Deployed on Render.com (free tier). Called by Next.js on Vercel.
"""

from __future__ import annotations

import base64
import os
import subprocess
import tempfile
from typing import Optional

import cv2
import httpx
import numpy as np
import pytesseract
from faster_whisper import WhisperModel
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageFilter, ImageEnhance
from pydantic import BaseModel
from scenedetect import SceneManager, open_video
from scenedetect.detectors import ContentDetector

# ── App setup ─────────────────────────────────────────────────────────────────
app = FastAPI(title="Social Growth AI — Media Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ── Whisper model (loaded once at startup, stays in memory) ───────────────────
WHISPER_MODEL_NAME = os.getenv("WHISPER_MODEL", "base.en")
print(f"Loading Whisper model: {WHISPER_MODEL_NAME} ...")
WHISPER = WhisperModel(WHISPER_MODEL_NAME, device="cpu", compute_type="int8")
print("Whisper ready.")

# ── Path configuration ────────────────────────────────────────────────────
# Explicit paths for tools installed via winget (not on PATH)
_FFMPEG_WINGET = (
    r"C:\Users\Rahim M\AppData\Local\Microsoft\WinGet\Packages"
    r"\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
    r"\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe"
)
_FFPROBE_WINGET = _FFMPEG_WINGET.replace("ffmpeg.exe", "ffprobe.exe")

# Use env override → winget path → fall back to bare command (Linux/Docker/PATH)
FFMPEG_CMD  = os.getenv("FFMPEG_PATH",  _FFMPEG_WINGET if os.path.exists(_FFMPEG_WINGET)  else "ffmpeg")
FFPROBE_CMD = os.getenv("FFPROBE_PATH", _FFPROBE_WINGET if os.path.exists(_FFPROBE_WINGET) else "ffprobe")

# Tesseract
_TESS_WIN = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
pytesseract.pytesseract.tesseract_cmd = os.getenv(
    "TESSERACT_PATH",
    _TESS_WIN if os.path.exists(_TESS_WIN) else "tesseract"
)

MAX_VIDEO_BYTES = 80 * 1024 * 1024  # 80 MB guard



# ── Request / Response models ─────────────────────────────────────────────────
class ProcessRequest(BaseModel):
    video_url: str
    max_frames: int = 12


class FrameResult(BaseModel):
    index: int
    timestamp: float
    scene_index: int
    base64: str
    mime_type: str = "image/jpeg"


class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str


class OCRResult(BaseModel):
    frame_index: int
    text: str


class ProcessResponse(BaseModel):
    frames: list[FrameResult]
    transcript: str
    hook_phrase: str
    segments: list[TranscriptSegment]
    ocr_texts: list[OCRResult]
    duration_seconds: float
    frame_count: int
    scene_count: int
    audio_energy: str
    fallback: bool = False


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "model": WHISPER_MODEL_NAME}


# ── Main processing endpoint ───────────────────────────────────────────────────
@app.post("/process", response_model=ProcessResponse)
async def process_video(req: ProcessRequest):
    with tempfile.TemporaryDirectory() as tmp:
        video_path = os.path.join(tmp, "input.mp4")
        audio_path = os.path.join(tmp, "audio.wav")

        # ── Step 1: Download video ────────────────────────────────────────────
        try:
            async with httpx.AsyncClient(
                timeout=30.0,
                follow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0 (compatible; SocialGrowthBot/1.0)"},
            ) as client:
                r = await client.get(req.video_url)
                if r.status_code != 200:
                    raise HTTPException(400, f"Video download failed: HTTP {r.status_code}")
                if len(r.content) > MAX_VIDEO_BYTES:
                    raise HTTPException(400, "Video too large (>80MB)")
                with open(video_path, "wb") as f:
                    f.write(r.content)
        except httpx.TimeoutException:
            raise HTTPException(408, "Video download timed out (>30s)")
        except httpx.RequestError as e:
            raise HTTPException(400, f"Download error: {e}")

        # Verify video is readable
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise HTTPException(422, "Downloaded file is not a valid video")
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        cap.release()

        # ── Step 2: Extract audio → WAV ───────────────────────────────────────
        try:
            subprocess.run(
                [
                    FFMPEG_CMD, "-y", "-i", video_path,
                    "-vn",           # no video
                    "-ar", "16000",  # 16kHz — optimal for Whisper
                    "-ac", "1",      # mono
                    "-c:a", "pcm_s16le",
                    audio_path,
                ],
                capture_output=True,
                check=True,
                timeout=30,
            )
        except subprocess.CalledProcessError as e:
            raise HTTPException(500, f"Audio extraction failed: {e.stderr.decode()[:200]}")

        # ── Step 3: Transcribe with faster-whisper ────────────────────────────
        transcript = ""
        hook_phrase = ""
        segments_out: list[TranscriptSegment] = []
        duration_seconds = 0.0
        audio_energy = "unknown"

        try:
            raw_segments, info = WHISPER.transcribe(
                audio_path,
                beam_size=3,
                best_of=3,
                language="en",
                vad_filter=True,          # skip silence
                vad_parameters={"min_silence_duration_ms": 500},
            )
            raw_segments = list(raw_segments)
            duration_seconds = float(info.duration)

            for seg in raw_segments:
                text = seg.text.strip()
                segments_out.append(TranscriptSegment(
                    start=round(seg.start, 2),
                    end=round(seg.end, 2),
                    text=text,
                ))

            transcript = " ".join(s.text for s in segments_out)
            hook_phrase = " ".join(
                s.text for s in segments_out if s.start < 5.0
            ).strip()

            # Simple energy estimate from word density
            words_per_sec = len(transcript.split()) / max(duration_seconds, 1)
            audio_energy = "high" if words_per_sec > 3.5 else "medium" if words_per_sec > 1.5 else "low"

        except Exception as e:
            # Transcription failure is non-fatal — continue with silent video
            transcript = ""
            hook_phrase = ""
            audio_energy = "unknown"

        # Use ffprobe for accurate duration if whisper didn't get it
        if duration_seconds <= 0:
            try:
                result = subprocess.run(
                    [FFPROBE_CMD, "-v", "error", "-show_entries", "format=duration",
                     "-of", "default=noprint_wrappers=1:nokey=1", video_path],
                    capture_output=True, text=True, timeout=10,
                )
                duration_seconds = float(result.stdout.strip() or "0")
            except Exception:
                duration_seconds = total_frames_count / fps if fps > 0 else 30.0

        # ── Step 4: Intelligent frame extraction ──────────────────────────────
        frames, scene_count = extract_smart_frames(
            video_path, req.max_frames, duration_seconds, tmp
        )

        # ── Step 5: OCR on each frame ─────────────────────────────────────────
        ocr_results: list[OCRResult] = []
        seen_ocr: set[str] = set()

        for frame_data in frames:
            try:
                img = Image.open(frame_data["path"])
                text = run_ocr(img)
                if text and text not in seen_ocr:
                    seen_ocr.add(text)
                    ocr_results.append(OCRResult(
                        frame_index=frame_data["index"],
                        text=text,
                    ))
            except Exception:
                pass

        # ── Step 6: Encode frames as base64 ───────────────────────────────────
        encoded_frames: list[FrameResult] = []
        for frame_data in frames:
            try:
                with open(frame_data["path"], "rb") as f:
                    b64 = base64.b64encode(f.read()).decode()
                encoded_frames.append(FrameResult(
                    index=frame_data["index"],
                    timestamp=round(frame_data["timestamp"], 2),
                    scene_index=frame_data["scene_index"],
                    base64=b64,
                ))
            except Exception:
                pass

        return ProcessResponse(
            frames=encoded_frames,
            transcript=transcript,
            hook_phrase=hook_phrase,
            segments=segments_out,
            ocr_texts=ocr_results,
            duration_seconds=round(duration_seconds, 2),
            frame_count=len(encoded_frames),
            scene_count=scene_count,
            audio_energy=audio_energy,
        )


# ── Intelligent frame extraction ──────────────────────────────────────────────
def extract_smart_frames(
    video_path: str,
    max_frames: int,
    duration: float,
    tmp_dir: str,
) -> tuple[list[dict], int]:
    """
    Sampling strategy:
    1. Hook zone — first 3 seconds, 1 frame every 1.5s
    2. Scene transitions — via PySceneDetect ContentDetector
    3. CTA zone — last 3 seconds, 1 frame every 1.5s
    Total capped at max_frames. Each frame saved as 720p JPEG (75% quality).
    """
    frames: list[dict] = []
    seen_ms: set[int] = set()
    scene_count = 0

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return frames, 0

    def save_frame_at(ts: float, scene_idx: int) -> bool:
        ms = int(ts * 1000)
        if ms in seen_ms or ts < 0 or ts > duration:
            return False
        seen_ms.add(ms)
        cap.set(cv2.CAP_PROP_POS_MSEC, ms)
        ret, frame = cap.read()
        if not ret or frame is None:
            return False
        # Downscale to max 1280px wide for smaller base64 payload
        h, w = frame.shape[:2]
        if w > 1280:
            scale = 1280.0 / w
            frame = cv2.resize(
                frame, (1280, int(h * scale)), interpolation=cv2.INTER_AREA
            )
        path = os.path.join(tmp_dir, f"frame_{len(frames):04d}.jpg")
        cv2.imwrite(path, frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
        frames.append({
            "path": path,
            "timestamp": ts,
            "scene_index": scene_idx,
            "index": len(frames),
        })
        return True

    # Hook zone: first 3 seconds (dense)
    for ts in [0.3, 1.0, 2.0, 3.0]:
        if ts < duration:
            save_frame_at(ts, 0)

    # Scene transitions via PySceneDetect
    try:
        video = open_video(video_path)
        sm = SceneManager()
        sm.add_detector(ContentDetector(threshold=27.0, min_scene_len=15))
        sm.detect_scenes(video, show_progress=False)
        scene_list = sm.get_scene_list()
        scene_count = len(scene_list)

        for i, (start, _) in enumerate(scene_list):
            ts = start.get_seconds() + 0.5  # 0.5s after cut for stable frame
            if 3.5 < ts < duration - 3.0 and len(frames) < max_frames - 3:
                save_frame_at(ts, i + 1)
    except Exception:
        scene_count = 0  # non-fatal

    # CTA zone: last 3 seconds (dense)
    for ts in [duration - 2.5, duration - 1.5, duration - 0.5]:
        if ts > 3.5 and len(frames) < max_frames:
            save_frame_at(ts, 99)

    cap.release()
    return frames[:max_frames], scene_count


# ── OCR helper ────────────────────────────────────────────────────────────────
def run_ocr(img: Image.Image) -> str:
    """
    Pre-processes frame for better OCR accuracy:
    1. Convert to grayscale
    2. Increase contrast
    3. Slight sharpening
    Then runs Tesseract with page-segmentation mode 6 (uniform block of text).
    """
    try:
        # Resize to at least 1000px wide for OCR accuracy
        w, h = img.size
        if w < 1000:
            img = img.resize((1000, int(h * 1000 / w)), Image.LANCZOS)

        gray = img.convert("L")
        # Boost contrast
        enhancer = ImageEnhance.Contrast(gray)
        gray = enhancer.enhance(2.0)
        # Sharpen
        gray = gray.filter(ImageFilter.SHARPEN)

        text = pytesseract.image_to_string(
            gray,
            config="--psm 6 --oem 3 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 !?.,@#$%&*()-+:;'\"",
        ).strip()

        # Filter noise: must be >3 meaningful chars
        meaningful = [w for w in text.split() if len(w) > 2]
        if len(meaningful) < 1:
            return ""

        return " ".join(meaningful)
    except Exception:
        return ""
