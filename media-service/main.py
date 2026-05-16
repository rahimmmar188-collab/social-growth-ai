"""
Social Growth AI - Media Processing Service v3.0
FastAPI microservice: yt-dlp download + FFmpeg audio + faster-whisper transcription
+ PySceneDetect frame extraction + pytesseract OCR
"""

from __future__ import annotations

import base64
import logging
import os
import subprocess
import sys
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

# -- Logging setup -------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("media-service")

# -- App setup -----------------------------------------------------------------
app = FastAPI(title="Social Growth AI - Media Service", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# -- Whisper model (loaded once at startup, stays in memory) -------------------
WHISPER_MODEL_NAME = os.getenv("WHISPER_MODEL", "base.en")
log.info(f"Loading Whisper model: {WHISPER_MODEL_NAME} ...")
try:
    WHISPER = WhisperModel(WHISPER_MODEL_NAME, device="cpu", compute_type="int8")
    log.info("Whisper ready.")
except Exception as e:
    log.error(f"Whisper failed to load: {e}")
    WHISPER = None

# -- Path configuration --------------------------------------------------------
def _find_cmd(candidates: list[str], env_var: str) -> str:
    """Pick first existing path from candidates, or fall back to env/PATH."""
    env_override = os.getenv(env_var)
    if env_override and os.path.exists(env_override):
        return env_override
    for p in candidates:
        if os.path.exists(p):
            log.info(f"{env_var} found at: {p}")
            return p
    # Fall back to PATH name (works in Linux/Docker)
    cmd = candidates[-1]  # last entry is just the command name
    log.warning(f"{env_var} not found in known paths, falling back to: {cmd}")
    return cmd

FFMPEG_CMD = _find_cmd([
    r"C:\Users\Rahim M\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe",
    r"C:\ffmpeg\bin\ffmpeg.exe",
    r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
    "ffmpeg",  # Linux/Docker fallback
], "FFMPEG_PATH")

FFPROBE_CMD = _find_cmd([
    r"C:\Users\Rahim M\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\ffprobe.exe",
    r"C:\ffmpeg\bin\ffprobe.exe",
    r"C:\Program Files\ffmpeg\bin\ffprobe.exe",
    "ffprobe",
], "FFPROBE_PATH")

TESSERACT_CMD = _find_cmd([
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    r"C:\Users\Rahim M\AppData\Local\Programs\Tesseract-OCR\tesseract.exe",
    "tesseract",
], "TESSERACT_PATH")

pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD

# -- Python executable (use Python 3.12 explicitly on Windows) -----------------
PYTHON_312 = r"C:\Users\Rahim M\AppData\Local\Programs\Python\Python312\python.exe"
PYTHON_EXE = PYTHON_312 if os.path.exists(PYTHON_312) else sys.executable
log.info(f"Python for yt-dlp: {PYTHON_EXE}")
log.info(f"FFmpeg: {FFMPEG_CMD}")
log.info(f"Tesseract: {TESSERACT_CMD}")

MAX_VIDEO_BYTES = 100 * 1024 * 1024  # 100 MB

# -- Social media domains that require yt-dlp ---------------------------------
SOCIAL_DOMAINS = (
    "instagram.com", "tiktok.com", "youtube.com", "youtu.be",
    "facebook.com", "fb.com", "twitter.com", "x.com",
    "threads.net", "snapchat.com", "pinterest.com", "reddit.com",
    "linkedin.com",
)


def is_social_url(url: str) -> bool:
    if ".mp4" in url.lower() and "http" in url.lower():
        return False
    return any(d in url.lower() for d in SOCIAL_DOMAINS)


# -- Download video ------------------------------------------------------------
async def download_video(video_url: str, video_path: str) -> None:
    """
    Download video to video_path.
    Social URLs → yt-dlp; Direct .mp4 → httpx streaming download.
    Raises HTTPException on failure.
    """
    if is_social_url(video_url):
        log.info(f"yt-dlp download: {video_url[:80]}")
        try:
            result = subprocess.run(
                [
                    PYTHON_EXE, "-m", "yt_dlp",
                    "--no-playlist",
                    "--max-filesize", "100m",
                    "-f", (
                        "bestvideo[vcodec^=avc][height<=720]+bestaudio[ext=m4a]"
                        "/bestvideo[vcodec^=avc]+bestaudio[ext=m4a]"
                        "/bestvideo[height<=720]+bestaudio"
                        "/best[height<=720]"
                        "/best"
                    ),
                    "--merge-output-format", "mp4",
                    "-o", video_path,
                    "--no-warnings",
                    video_url,
                ],
                capture_output=True,
                timeout=120,
            )
            stdout = result.stdout.decode(errors="replace")
            stderr = result.stderr.decode(errors="replace")

            if result.returncode != 0:
                log.error(f"yt-dlp failed (code {result.returncode}): {stderr[:400]}")
                raise HTTPException(400, f"yt-dlp failed: {stderr[:300]}")

            if not os.path.exists(video_path) or os.path.getsize(video_path) < 1000:
                log.error(f"yt-dlp produced no output. stderr: {stderr[:200]}")
                raise HTTPException(400, "yt-dlp produced no output (private/geo-blocked?)")

            log.info(f"yt-dlp OK — {os.path.getsize(video_path) // 1024} KB")

            # Re-mux for OpenCV compatibility (faststart + h264)
            remuxed = video_path + ".remux.mp4"
            rr = subprocess.run(
                [
                    FFMPEG_CMD, "-y", "-i", video_path,
                    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
                    "-c:a", "aac", "-b:a", "128k",
                    "-movflags", "+faststart",
                    remuxed,
                ],
                capture_output=True,
                timeout=180,
            )
            if rr.returncode == 0 and os.path.exists(remuxed) and os.path.getsize(remuxed) > 1000:
                os.replace(remuxed, video_path)
                log.info("Re-mux OK")
            else:
                log.warning(f"Re-mux failed (code {rr.returncode}), using original file")

        except subprocess.TimeoutExpired:
            raise HTTPException(408, "yt-dlp timed out (>120s)")

    else:
        log.info(f"HTTP download: {video_url[:80]}")
        try:
            async with httpx.AsyncClient(
                timeout=60.0,
                follow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0 (compatible; SocialGrowthBot/2.0)"},
            ) as client:
                async with client.stream("GET", video_url) as r:
                    if r.status_code != 200:
                        raise HTTPException(400, f"Download failed: HTTP {r.status_code}")
                    total = 0
                    with open(video_path, "wb") as f:
                        async for chunk in r.aiter_bytes(chunk_size=65536):
                            total += len(chunk)
                            if total > MAX_VIDEO_BYTES:
                                raise HTTPException(400, "Video too large (>100MB)")
                            f.write(chunk)
            log.info(f"HTTP download OK — {total // 1024} KB")
        except httpx.TimeoutException:
            raise HTTPException(408, "Video download timed out (>60s)")
        except httpx.RequestError as e:
            raise HTTPException(400, f"Download error: {e}")


# -- Request / Response models -------------------------------------------------
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


# -- Health check --------------------------------------------------------------
@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": WHISPER_MODEL_NAME,
        "whisper": WHISPER is not None,
        "ffmpeg": os.path.exists(FFMPEG_CMD) or FFMPEG_CMD == "ffmpeg",
        "tesseract": os.path.exists(TESSERACT_CMD) or TESSERACT_CMD == "tesseract",
    }


# -- Main processing endpoint --------------------------------------------------
@app.post("/process", response_model=ProcessResponse)
async def process_video(req: ProcessRequest):
    log.info(f"=== START process_video: {req.video_url[:80]} ===")

    with tempfile.TemporaryDirectory() as tmp:
        video_path = os.path.join(tmp, "input.mp4")
        audio_path = os.path.join(tmp, "audio.wav")

        # ── Step 1: Download ──────────────────────────────────────────────────
        log.info("Step 1: Downloading video...")
        await download_video(req.video_url, video_path)
        log.info(f"Step 1 DONE — file size: {os.path.getsize(video_path) // 1024} KB")

        # ── Verify OpenCV can read the file ───────────────────────────────────
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            log.error("OpenCV cannot open the downloaded file")
            raise HTTPException(422, "Downloaded file is not a valid video (OpenCV cannot read it)")
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        cap.release()
        log.info(f"OpenCV OK — fps={fps:.1f} total_frames={total_frames_count}")

        # ── Step 2: Extract audio ─────────────────────────────────────────────
        log.info("Step 2: Extracting audio with FFmpeg...")
        audio_ok = False
        try:
            proc = subprocess.run(
                [
                    FFMPEG_CMD, "-y", "-i", video_path,
                    "-vn",
                    "-ar", "16000",
                    "-ac", "1",
                    "-c:a", "pcm_s16le",
                    audio_path,
                ],
                capture_output=True,
                timeout=120,
            )
            if proc.returncode == 0 and os.path.exists(audio_path) and os.path.getsize(audio_path) > 1000:
                audio_ok = True
                log.info(f"Step 2 DONE — audio: {os.path.getsize(audio_path) // 1024} KB")
            else:
                log.warning(f"FFmpeg audio extraction failed (code {proc.returncode}): {proc.stderr.decode(errors='replace')[:200]}")
        except subprocess.TimeoutExpired:
            log.error("FFmpeg audio extraction timed out")
        except Exception as e:
            log.error(f"FFmpeg audio extraction error: {e}")

        # ── Step 3: Transcribe with Whisper ───────────────────────────────────
        transcript = ""
        hook_phrase = ""
        segments_out: list[TranscriptSegment] = []
        duration_seconds = 0.0
        audio_energy = "unknown"

        if audio_ok and WHISPER is not None:
            log.info("Step 3: Transcribing with Whisper...")
            try:
                # First attempt: WITHOUT VAD filter (VAD is too aggressive for music/singing)
                raw_segments, info = WHISPER.transcribe(
                    audio_path,
                    beam_size=5,
                    best_of=5,
                    language=None,           # auto-detect language
                    vad_filter=False,        # DISABLED: VAD removes music/singing entirely
                    no_speech_threshold=0.6, # only skip truly silent segments
                    condition_on_previous_text=True,
                    temperature=0.0,
                )
                raw_segments = list(raw_segments)
                duration_seconds = float(info.duration)

                for seg in raw_segments:
                    text = seg.text.strip()
                    if text:
                        segments_out.append(TranscriptSegment(
                            start=round(seg.start, 2),
                            end=round(seg.end, 2),
                            text=text,
                        ))

                transcript = " ".join(s.text for s in segments_out)
                hook_phrase = " ".join(
                    s.text for s in segments_out if s.start < 5.0
                ).strip()

                words_per_sec = len(transcript.split()) / max(duration_seconds, 1)
                audio_energy = (
                    "high" if words_per_sec > 3.5
                    else "medium" if words_per_sec > 1.5
                    else "low"
                )
                log.info(f"Step 3 DONE — {len(segments_out)} segments, dur={duration_seconds:.1f}s, energy={audio_energy}")
                log.info(f"Transcript (first 150 chars): {transcript[:150]}")
            except Exception as e:
                log.error(f"Whisper transcription failed: {e}", exc_info=True)
        elif not audio_ok:
            log.warning("Step 3: SKIPPED — audio extraction failed")
        else:
            log.warning("Step 3: SKIPPED — Whisper model not loaded")

        # ── Get duration via ffprobe if Whisper didn't give it ────────────────
        if duration_seconds <= 0:
            try:
                r = subprocess.run(
                    [FFPROBE_CMD, "-v", "error",
                     "-show_entries", "format=duration",
                     "-of", "default=noprint_wrappers=1:nokey=1",
                     video_path],
                    capture_output=True, text=True, timeout=15,
                )
                duration_seconds = float(r.stdout.strip() or "0")
                log.info(f"ffprobe duration: {duration_seconds:.1f}s")
            except Exception as e:
                duration_seconds = total_frames_count / fps if fps > 0 else 30.0
                log.warning(f"ffprobe failed ({e}), estimated duration: {duration_seconds:.1f}s")

        # ── Step 4: Smart frame extraction ────────────────────────────────────
        log.info("Step 4: Extracting frames...")
        frames, scene_count = extract_smart_frames(
            video_path, req.max_frames, duration_seconds, tmp
        )
        log.info(f"Step 4 DONE — {len(frames)} frames, {scene_count} scenes")

        # ── Step 5: OCR on each frame ─────────────────────────────────────────
        log.info("Step 5: Running OCR on frames...")
        ocr_results: list[OCRResult] = []
        seen_ocr: set[str] = set()
        ocr_errors = 0

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
            except Exception as e:
                ocr_errors += 1
                log.warning(f"OCR error on frame {frame_data['index']}: {e}")

        log.info(f"Step 5 DONE — {len(ocr_results)} unique OCR results, {ocr_errors} errors")

        # ── Step 6: Encode frames as base64 ───────────────────────────────────
        log.info("Step 6: Encoding frames as base64...")
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
            except Exception as e:
                log.warning(f"Frame encode error: {e}")

        log.info(f"Step 6 DONE — {len(encoded_frames)} frames encoded")
        log.info(f"=== COMPLETE: transcript={len(transcript)}chars frames={len(encoded_frames)} scenes={scene_count} dur={duration_seconds:.1f}s ===")

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


# -- Intelligent frame extraction ---------------------------------------------
def extract_smart_frames(
    video_path: str,
    max_frames: int,
    duration: float,
    tmp_dir: str,
) -> tuple[list[dict], int]:
    frames: list[dict] = []
    seen_ms: set[int] = set()
    scene_count = 0

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        log.error("extract_smart_frames: OpenCV cannot open video")
        return frames, 0

    def save_frame_at(ts: float, scene_idx: int) -> bool:
        ms = int(ts * 1000)
        if ms in seen_ms or ts < 0 or ts > duration + 1:
            return False
        seen_ms.add(ms)
        cap.set(cv2.CAP_PROP_POS_MSEC, ms)
        ret, frame = cap.read()
        if not ret or frame is None:
            log.debug(f"Frame read failed at {ts:.2f}s")
            return False
        h, w = frame.shape[:2]
        if w > 1280:
            scale = 1280.0 / w
            frame = cv2.resize(frame, (1280, int(h * scale)), interpolation=cv2.INTER_AREA)
        path = os.path.join(tmp_dir, f"frame_{len(frames):04d}.jpg")
        cv2.imwrite(path, frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        frames.append({
            "path": path,
            "timestamp": ts,
            "scene_index": scene_idx,
            "index": len(frames),
        })
        return True

    # Hook zone: first 3 seconds
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
        log.info(f"PySceneDetect found {scene_count} scenes")

        for i, (start, _) in enumerate(scene_list):
            ts = start.get_seconds() + 0.5
            if 3.5 < ts < duration - 3.0 and len(frames) < max_frames - 3:
                save_frame_at(ts, i + 1)
    except Exception as e:
        log.warning(f"PySceneDetect failed (non-fatal): {e}")
        scene_count = 0

    # Midpoint sample if we don't have enough frames
    if len(frames) < 4 and duration > 6:
        for ts in [duration * 0.25, duration * 0.5, duration * 0.75]:
            if len(frames) < max_frames:
                save_frame_at(ts, 50)

    # CTA zone: last 3 seconds
    for ts in [duration - 2.5, duration - 1.5, duration - 0.5]:
        if ts > 3.5 and len(frames) < max_frames:
            save_frame_at(ts, 99)

    cap.release()
    log.info(f"Frame extraction: {len(frames)} frames captured")
    return frames[:max_frames], scene_count


# -- OCR helper ----------------------------------------------------------------
def run_ocr(img: Image.Image) -> str:
    try:
        w, h = img.size
        if w < 1000:
            img = img.resize((1000, int(h * 1000 / w)), Image.LANCZOS)

        gray = img.convert("L")
        enhancer = ImageEnhance.Contrast(gray)
        gray = enhancer.enhance(2.0)
        gray = gray.filter(ImageFilter.SHARPEN)

        text = pytesseract.image_to_string(
            gray,
            config="--psm 6 --oem 3",
        ).strip()

        meaningful = [w for w in text.split() if len(w) > 2]
        if len(meaningful) < 1:
            return ""

        return " ".join(meaningful)
    except Exception as e:
        log.debug(f"OCR error: {e}")
        return ""
