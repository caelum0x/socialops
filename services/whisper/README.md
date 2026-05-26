# SocialOps Whisper Service

CPU-friendly transcription microservice. Runs `faster-whisper`
(`small.en` default, `tiny.en` for drafts, `large-v3-turbo` opt-in).

**License:** Whisper code + weights are MIT. `faster-whisper` is MIT.

**Hardware note:** designed for the operator's MacBook Air 24GB dev box and a
Hetzner CPU server in prod. No GPU required. `large-v3-turbo` on CPU is slow
(~0.3x realtime) so the default is `small.en` (~3x realtime, very good
English-only accuracy).

## API

```
POST /transcribe
content-type: application/json
{
  "audio_url": "https://media.socialops.local/uploads/abc.mp4",
  "audio_path": null,
  "language": "en",
  "model": "small.en"
}
```

Response:

```
{
  "language": "en",
  "text": "Full concatenated transcript ...",
  "segments": [
    { "start_ms": 0, "end_ms": 1840, "text": "Turn your work into content." },
    { "start_ms": 1840, "end_ms": 3920, "text": "Capture what changed." }
  ],
  "model": "small.en",
  "duration_seconds": 27.4
}
```

`GET /health` returns `{"ok": true}`.

## Run locally

```bash
cd services/whisper
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
WHISPER_MODEL=small.en uvicorn app:app --host 0.0.0.0 --port 18890
```

## Docker

```bash
docker build -t socialops-whisper .
docker run --rm -p 18890:18890 -v $(pwd)/cache:/cache socialops-whisper
```

## Boundary

The SocialOps API never spawns whisper directly. It calls
`WHISPER_URL` (default `http://localhost:18890`) via the typed
`WhisperClient` in `apps/api/src/whisper.ts`. The service is stateless
and may be deployed standalone on its own host.
