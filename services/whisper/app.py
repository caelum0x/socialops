"""SocialOps Whisper service. CPU-friendly faster-whisper.

The service downloads audio from a URL (or reads a local path) and returns
timed segments. Defaults: model = small.en (best CPU sweet spot), language = en.

Boundary: only the SocialOps API talks to this service. Do not expose publicly.
"""
from __future__ import annotations

import os
import tempfile
import time
from pathlib import Path
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException
from faster_whisper import WhisperModel
from pydantic import BaseModel, Field

DEFAULT_MODEL = os.environ.get("WHISPER_MODEL", "small.en")
CACHE_DIR = os.environ.get("WHISPER_CACHE_DIR", "/cache")

app = FastAPI(title="SocialOps Whisper", version="0.1.0")

# Lazy-load to keep boot fast.
_models: dict[str, WhisperModel] = {}


def _get_model(model_name: str) -> WhisperModel:
    if model_name not in _models:
        _models[model_name] = WhisperModel(
            model_name,
            device="cpu",
            compute_type="int8",
            download_root=CACHE_DIR,
        )
    return _models[model_name]


class TranscribeRequest(BaseModel):
    audio_url: Optional[str] = None
    audio_path: Optional[str] = None
    language: Optional[str] = Field(default="en")
    model: Optional[str] = Field(default=None)


class Segment(BaseModel):
    start_ms: int
    end_ms: int
    text: str


class TranscribeResponse(BaseModel):
    language: str
    text: str
    segments: list[Segment]
    model: str
    duration_seconds: float


@app.get("/health")
def health() -> dict[str, object]:
    return {"ok": True, "service": "socialops-whisper", "default_model": DEFAULT_MODEL}


@app.post("/transcribe", response_model=TranscribeResponse)
def transcribe(payload: TranscribeRequest) -> TranscribeResponse:
    if not payload.audio_url and not payload.audio_path:
        raise HTTPException(status_code=400, detail="audio_url or audio_path is required")

    model_name = payload.model or DEFAULT_MODEL
    started = time.time()

    audio_path = payload.audio_path
    tmp_path: Optional[str] = None
    try:
        if payload.audio_url and not audio_path:
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=Path(payload.audio_url).suffix or ".mp4")
            tmp_path = tmp.name
            with httpx.stream("GET", payload.audio_url, timeout=120.0) as response:
                if response.status_code >= 400:
                    raise HTTPException(status_code=502, detail=f"download failed: {response.status_code}")
                for chunk in response.iter_bytes():
                    tmp.write(chunk)
            tmp.close()
            audio_path = tmp_path

        if not audio_path:
            raise HTTPException(status_code=400, detail="audio source unresolved")

        model = _get_model(model_name)
        segments_iter, info = model.transcribe(
            audio_path,
            language=payload.language or "en",
            beam_size=5,
            vad_filter=True,
        )

        segments: list[Segment] = []
        texts: list[str] = []
        for seg in segments_iter:
            text = seg.text.strip()
            if not text:
                continue
            segments.append(
                Segment(
                    start_ms=int(seg.start * 1000),
                    end_ms=int(seg.end * 1000),
                    text=text,
                )
            )
            texts.append(text)

        elapsed = time.time() - started
        return TranscribeResponse(
            language=info.language,
            text=" ".join(texts),
            segments=segments,
            model=model_name,
            duration_seconds=info.duration if info.duration else elapsed,
        )
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
