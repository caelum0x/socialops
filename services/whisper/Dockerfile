FROM python:3.12-slim

WORKDIR /app

# ffmpeg is required by faster-whisper to decode arbitrary audio/video input.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py ./

ENV WHISPER_CACHE_DIR=/cache
ENV WHISPER_MODEL=small.en
ENV PYTHONUNBUFFERED=1

EXPOSE 18890

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "18890"]
