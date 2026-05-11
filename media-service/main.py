"""
Social Growth AI - Media Processing Service
FastAPI microservice: FFmpeg frame extraction + faster-whisper + pytesseract OCR
Deployed on Railway. Called by Next.js on Vercel.
"""

from __future__ import annotations

import base64
import json
import os
import subprocess
import tempfile
import urllib.parse
import urllib.request
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
print(f"Loading Whisper model: {WHISPER_MODEL_NAME} ...")
WHISPER = WhisperModel(WHISPER_MODEL_NAME, device="cpu", compute_type="int8")
print("Whisper ready.")

# -- Path configuration -------------------------------------------------------
# Windows-specific winget FFmpeg paths (no-op on Linux/Docker)
_FFMPEG_WINGET = (
    r"C:\Users\Rahim M\AppData\Local\Microsoft\WinGet\Packages"
    r"\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
    r"\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe"
)
_FFPROBE_WINGET = _FFMPEG_WINGET.replace("ffmpeg.exe", "ffprobe.exe")

FFMPEG_CMD  = os.getenv("FFMPEG_PATH",  _FFMPEG_WINGET if os.path.exists(_FFMPEG_WINGET)  else "ffmpeg")
FFPROBE_CMD = os.getenv("FFPROBE_PATH", _FFPROBE_WINGET if os.path.exists(_FFPROBE_WINGET) else "ffprobe")

# Tesseract
_TESS_WIN = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
pytesseract.pytesseract.tesseract_cmd = os.getenv(
    "TESSERACT_PATH",
    _TESS_WIN if os.path.exists(_TESS_WIN) else "tesseract"
)

MAX_VIDEO_BYTES = 100 * 1024 * 1024  # 100 MB hard cap

# -- Social media domains that may need yt-dlp --------------------------------
SOCIAL_DOMAINS = (
    "youtube.com", "youtu.be",
    "facebook.com", "fb.com", "twitter.com", "x.com",
    "threads.net", "snapchat.com", "pinterest.com", "reddit.com",
)

# -- TikTok CDN extraction via tikwm.com public API ---------------------------
def get_tiktok_cdn_url(tiktok_url: str) -> str | None:
    """
    Use the tikwm.com public API to extract the TikTok video CDN URL.
    This BYPASSES TikTok's IP block on Railway since we hit tikwm's servers,
    not TikTok directly. Returns the direct mp4 CDN URL or None on failure.
    """
    try:
        encoded = urllib.parse.quote(tiktok_url, safe="")
        api_url = f"https://www.tikwm.com/api/?url={encoded}&hd=1"
        req = urllib.request.Request(
            api_url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://www.tikwm.com/",
            },
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode())
        if data.get("code") == 0:
            video_data = data.get("data", {})
            # Prefer HD, fall back to standard quality
            cdn = video_data.get("hdplay") or video_data.get("play") or ""
            if cdn and cdn.startswith("http"):
                print(f"[tikwm] CDN URL obtained: {cdn[:80]}...")
                return cdn
    except Exception as e:
        print(f"[tikwm] Failed to get CDN URL: {e}")
    return None


def is_social_url(url: str) -> bool:
    """True if the URL is a social media page requiring yt-dlp (not TikTok/Instagram)."""
    if ".mp4" in url.lower():
        return False
    # TikTok handled separately via tikwm
    if "tiktok.com" in url.lower():
        return False
    # Instagram handled via extension — Railway IP is blocked
    if "instagram.com" in url.lower():
        return False
    return any(d in url.lower() for d in SOCIAL_DOMAINS)


async def download_direct(video_url: str, video_path: str) -> None:
    """Download a direct mp4/CDN URL using httpx (streaming to handle large files)."""
    try:
        async with httpx.AsyncClient(
            timeout=60.0,
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://www.tiktok.com/",
            },
        ) as client:
            async with client.stream("GET", video_url) as r:
                if r.status_code != 200:
                    raise HTTPException(400, f"CDN download failed: HTTP {r.status_code}")
                total = 0
                with open(video_path, "wb") as f:
                    async for chunk in r.aiter_bytes(chunk_size=65536):
                        total += len(chunk)
                        if total > MAX_VIDEO_BYTES:
                            raise HTTPException(400, "Video too large (>100MB)")
                        f.write(chunk)
        if not os.path.exists(video_path) or os.path.getsize(video_path) < 1000:
            raise HTTPException(400, "Downloaded file is empty")
    except httpx.TimeoutException:
        raise HTTPException(408, "Video download timed out (>60s)")
    except httpx.RequestError as e:
        raise HTTPException(400, f"Download error: {e}")


async def download_with_ytdlp(video_url: str, video_path: str) -> None:
    """Download via yt-dlp for YouTube and other supported platforms."""
    try:
        result = subprocess.run(
            [
                "yt-dlp",
                "--no-playlist",
                "--max-filesize", "100m",
                # Force h264 + aac for OpenCV compatibility; fall back to best
                "-f", (
                    "bestvideo[vcodec^=avc][height<=720]+bestaudio[ext=m4a]"
                    "/bestvideo[vcodec^=avc]+bestaudio[ext=m4a]"
                    "/bestvideo[height<=720]+bestaudio"
                    "/best"
                ),
                "--merge-output-format", "mp4",
                "-o", video_path,
                "--quiet",
                "--no-warnings",
                video_url,
            ],
            capture_output=True,
            timeout=120,
        )
        if result.returncode != 0:
            err = result.stderr.decode(errors="replace")[:400]
            raise HTTPException(400, f"yt-dlp failed: {err}")
        if not os.path.exists(video_path) or os.path.getsize(video_path) < 1000:
            raise HTTPException(400, "yt-dlp produced no output (private/geo-blocked content?)")
    except subprocess.TimeoutExpired:
        raise HTTPException(408, "yt-dlp timed out (>120s)")


async def remux_to_h264(video_path: str) -> None:
    """
    Re-mux to h264 mp4 with moov-at-start so OpenCV can seek properly.
    Near-instant for h264 files (stream copy). Transcodes other codecs.
    Non-fatal: if remux fails, proceed with original.
    """
    remuxed = video_path + ".remux.mp4"
    try:
        subprocess.run(
            [
                FFMPEG_CMD, "-y", "-i", video_path,
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
                "-c:a", "aac", "-b:a", "128k",
                "-movflags", "+faststart",
                remuxed,
            ],
            capture_output=True,
            timeout=120,
        )
        if os.path.exists(remuxed) and os.path.getsize(remuxed) > 1000:
            os.replace(remuxed, video_path)
    except Exception as e:
        print(f"[remux] Non-fatal remux error: {e}")


async def download_video(video_url: str, video_path: str) -> None:
    """
    Smart download dispatcher:
    1. TikTok → tikwm.com CDN URL → httpx direct download
    2. YouTube/other social → yt-dlp
    3. Direct .mp4 CDN links → httpx
    Then remux all downloads to h264 for OpenCV compatibility.
    """
    if "tiktok.com" in video_url.lower():
        # Step 1: Try tikwm.com API to get CDN URL (bypasses IP block)
        cdn_url = get_tiktok_cdn_url(video_url)
        if cdn_url:
            print(f"[download] TikTok via tikwm CDN URL")
            await download_direct(cdn_url, video_path)
        else:
            # Fallback: try yt-dlp (will likely fail due to IP block, but worth trying)
            print(f"[download] TikTok tikwm failed, trying yt-dlp fallback")
            await download_with_ytdlp(video_url, video_path)
    elif is_social_url(video_url):
        print(f"[download] Social URL via yt-dlp: {video_url[:60]}")
        await download_with_ytdlp(video_url, video_path)
    else:
        # Direct CDN / mp4 URL
        print(f"[download] Direct URL via httpx: {video_url[:60]}")
        await download_direct(video_url, video_path)

    # Always remux to h264 for reliable OpenCV seeking
    if os.path.exists(video_path) and os.path.getsize(video_path) > 1000:
        await remux_to_h264(video_path)


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
        "version": "3.0.0",
        "tiktok_bypass": "tikwm.com",
    }


# -- Main processing endpoint --------------------------------------------------
@app.post("/process", response_model=ProcessResponse)
async def process_video(req: ProcessRequest):
    with tempfile.TemporaryDirectory() as tmp:
        video_path = os.path.join(tmp, "input.mp4")
        audio_path = os.path.join(tmp, "audio.wav")

        # -- Step 1: Download video -------------------------------------------
        await download_video(req.video_url, video_path)

        # Verify video is readable by OpenCV
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise HTTPException(422, "Downloaded file is not a valid video (OpenCV cannot open it)")
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        cap.release()

        # -- Step 2: Extract audio -> WAV (non-fatal if it fails) ------------
        audio_ok = False
        try:
            proc = subprocess.run(
                [
                    FFMPEG_CMD, "-y", "-i", video_path,
                    "-vn",           # no video stream
                    "-ar", "16000",  # 16kHz - optimal for Whisper
                    "-ac", "1",      # mono
                    "-c:a", "pcm_s16le",
                    audio_path,
                ],
                capture_output=True,
                timeout=60,
            )
            audio_ok = (
                proc.returncode == 0
                and os.path.exists(audio_path)
                and os.path.getsize(audio_path) > 1000
            )
            if audio_ok:
                print(f"[audio] WAV extracted OK: {os.path.getsize(audio_path)} bytes")
            else:
                print(f"[audio] WAV extraction failed: rc={proc.returncode} stderr={proc.stderr.decode(errors='replace')[:200]}")
        except Exception as e:
            print(f"[audio] Exception during extraction: {e}")
            audio_ok = False

        # -- Step 3: Transcribe with faster-whisper (non-fatal) ---------------
        transcript = ""
        hook_phrase = ""
        segments_out: list[TranscriptSegment] = []
        duration_seconds = 0.0
        audio_energy = "unknown"

        if audio_ok:
            try:
                raw_segments, info = WHISPER.transcribe(
                    audio_path,
                    beam_size=5,
                    best_of=5,
                    # Don't lock to English — many social videos are multilingual
                    language=None,
                    task="transcribe",
                    vad_filter=True,
                    # Looser VAD: catches singing, fast speech, music vocals
                    vad_parameters={
                        "min_silence_duration_ms": 200,
                        "speech_pad_ms": 400,
                        "threshold": 0.25,
                    },
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

                transcript = " ".join(s.text for s in segments_out).strip()
                hook_phrase = " ".join(
                    s.text for s in segments_out if s.start < 5.0
                ).strip()

                # Simple energy estimate from word density
                words_per_sec = len(transcript.split()) / max(duration_seconds, 1)
                audio_energy = (
                    "high" if words_per_sec > 3.5
                    else "medium" if words_per_sec > 1.0
                    else "low"
                )

                print(f"[whisper] transcript={len(transcript)} chars, segments={len(segments_out)}, dur={duration_seconds:.1f}s, energy={audio_energy}")

            except Exception as e:
                print(f"[whisper] Transcription error (non-fatal): {e}")
                transcript = ""
                hook_phrase = ""
                audio_energy = "unknown"

        # Use ffprobe for accurate duration if whisper didn't get it
        if duration_seconds <= 0:
            try:
                result = subprocess.run(
                    [
                        FFPROBE_CMD, "-v", "error",
                        "-show_entries", "format=duration",
                        "-of", "default=noprint_wrappers=1:nokey=1",
                        video_path,
                    ],
                    capture_output=True, text=True, timeout=10,
                )
                duration_seconds = float(result.stdout.strip() or "0")
            except Exception:
                duration_seconds = total_frames_count / fps if fps > 0 else 30.0

        # -- Step 4: Intelligent frame extraction -----------------------------
        frames, scene_count = extract_smart_frames(
            video_path, req.max_frames, duration_seconds, tmp
        )
        print(f"[frames] extracted={len(frames)}, scenes={scene_count}, dur={duration_seconds:.1f}s")

        # -- Step 5: OCR on each frame ----------------------------------------
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

        # -- Step 6: Encode frames as base64 ----------------------------------
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

        print(f"[process] DONE — frames={len(encoded_frames)} transcript={len(transcript)}chars ocr={len(ocr_results)}")

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


# -- Intelligent frame extraction ----------------------------------------------
def extract_smart_frames(
    video_path: str,
    max_frames: int,
    duration: float,
    tmp_dir: str,
) -> tuple[list[dict], int]:
    """
    Sampling strategy:
    1. Hook zone   - first 3 seconds, 1 frame every ~1s
    2. Scene transitions - via PySceneDetect ContentDetector
    3. CTA zone    - last 3 seconds, 1 frame every ~1s
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


# -- OCR helper ----------------------------------------------------------------
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
            config='--psm 6 --oem 3 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 !?.,@#$%&*()-+:;\'"',
        ).strip()

        # Filter noise: must have at least 1 meaningful word (>2 chars)
        meaningful = [w for w in text.split() if len(w) > 2]
        if len(meaningful) < 1:
            return ""

        return " ".join(meaningful)
    except Exception:
        return ""
