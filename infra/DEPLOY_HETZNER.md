# SocialOps on Hetzner

Cheapest production deploy for the solo operator. Tested 2026-05.

## What runs where

| Component | Hetzner box | Monthly |
| --- | --- | --- |
| api + web + postgres + redis + openpost + miniclaw + deck-worker + **video-worker + whisper** | **CCX23 (4 vCPU dedicated, 16GB RAM, 80GB SSD)** | **€14.86 / ~$16** |
| Storage (assets, generated MP4) | **Cloudflare R2** (10GB + 1M reads free) | **$0 → $1.50/100GB** |
| DNS + HTTPS | **Cloudflare** | $0 |
| Email (optional, signup/notifications) | **Resend free** (3k/month) | $0 |

Total to get the operator's daily-content loop live: **~$16/month**. ComfyUI and PokeeResearch are excluded because they need RAM you don't have on CCX23 — defer those until you rent a separate GPU box.

If you also want ComfyUI Wan I2V locally instead of paying providers, you need a GPU box (Hetzner GEX44 with RTX 4000 SFF Ada = ~€198/mo). Don't do this until your content is profitable; until then, use Kling / Replicate / fal.ai.

---

## One-time provision

```bash
# 1. Hetzner Cloud Console — create a CCX23 in NBG1 / FSN1 / HEL1 (whichever is closest)
#    OS: Ubuntu 24.04
#    SSH key: add your public key

# 2. SSH in
ssh root@<your-ip>

# 3. System bootstrap
apt-get update && apt-get install -y curl git ufw fail2ban
curl -fsSL https://get.docker.com | sh
apt-get install -y docker-compose-plugin

# 4. Lock down
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw --force enable

# 5. Add a non-root deploy user
adduser --disabled-password --gecos "" socialops
usermod -aG docker socialops
mkdir -p /home/socialops/.ssh && cp ~/.ssh/authorized_keys /home/socialops/.ssh/
chown -R socialops:socialops /home/socialops/.ssh
```

Switch to the deploy user for the rest:

```bash
su - socialops
git clone https://github.com/<your-org>/socialops ~/socialops
cd ~/socialops
```

## Cloudflare R2 setup (5 minutes)

1. dash.cloudflare.com → R2 → Create bucket — name it e.g. `socialops-media`. Pick the EU jurisdiction if you're in Europe (cheaper).
2. R2 → Manage API tokens → Create API token → Permissions: `Object Read & Write` for this bucket. Save the **Access Key ID** and **Secret Access Key** (only shown once).
3. R2 → your bucket → Settings → enable a **Public R2.dev URL** (or attach a custom domain). Copy that URL.
4. Note your **R2 endpoint host** from the bucket settings page: `<account-id>.r2.cloudflarestorage.com`.

## `.env` for production

`cp .env.example .env.production` then fill:

```bash
APP_URL=https://socialops.yourdomain.com
DATABASE_URL=postgres://socialops:<strong-password>@postgres:5432/socialops
REDIS_URL=redis://redis:6379
SESSION_SECRET=<openssl rand -hex 32>
ENCRYPTION_KEY=<openssl rand -hex 32>
POSTGRES_PASSWORD=<strong-password>

# OpenPost <-> SocialOps shared secret
SOCIALOPS_OPENPOST_INTERNAL_TOKEN=<openssl rand -hex 32>
OPENPOST_URL=http://openpost:8080
MINICLAW_URL=http://miniclaw:18789
POKEE_RESEARCH_URL=http://pokee-research:8888

# Whisper
USE_WHISPER=true
WHISPER_URL=http://whisper:18890
WHISPER_MODEL=small.en

# Storage = R2
STORAGE_KIND=r2
STORAGE_BUCKET=socialops-media
STORAGE_ENDPOINT=<account-id>.r2.cloudflarestorage.com
STORAGE_REGION=auto
STORAGE_ACCESS_KEY_ID=<r2 access key>
STORAGE_SECRET_ACCESS_KEY=<r2 secret>
STORAGE_PUBLIC_BASE_URL=https://pub-<hash>.r2.dev   # or your custom domain

# Auth — start with dev headers, switch to Clerk later
# CLERK_SECRET_KEY=sk_live_...

# Video providers (set only the ones you have keys for)
KLING_AI_ACCESS_KEY=
KLING_AI_SECRET_KEY=
HAILUO_API_KEY=
REPLICATE_API_TOKEN=
REPLICATE_MODEL_DEFAULT=lucataco/wan-2.2-5b-i2v
```

## First boot

```bash
cd ~/socialops/infra/compose
docker compose --env-file ~/socialops/.env.production -f socialops.production.example.yml \
  --profile workers --profile audio up -d postgres redis openpost miniclaw whisper

# Wait for postgres healthcheck, then bring up the rest
docker compose --env-file ~/socialops/.env.production -f socialops.production.example.yml \
  --profile workers --profile audio up -d
```

Migrate + seed:

```bash
docker compose exec api node dist/migrate.js
docker compose exec api node dist/seed.js
```

## Caddy reverse proxy (HTTPS in 30 seconds)

Install Caddy on the host (not in compose, simpler):

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`:

```caddyfile
socialops.yourdomain.com {
    encode zstd gzip
    handle_path /api/* {
        reverse_proxy localhost:3001
    }
    handle_path /social/* {
        reverse_proxy localhost:8080
    }
    handle {
        reverse_proxy localhost:3000
    }
}
```

Compose maps api → host port 3001, openpost → 8080, web → 3000. Caddy gets HTTPS via Let's Encrypt automatically.

```bash
sudo systemctl reload caddy
```

## Verify

```bash
curl https://socialops.yourdomain.com/api/health
# {"ok":true}

curl https://socialops.yourdomain.com/api/v1/storage/status
# {"enabled":true,"kind":"configured",...}

curl https://socialops.yourdomain.com/api/v1/videos/motion-presets
# 12 motion presets + provider readiness list
```

## Backups

```bash
# Daily postgres dump → R2
0 4 * * * docker exec socialops-postgres-1 pg_dump -U socialops socialops | \
    gzip | aws --endpoint-url=https://<account>.r2.cloudflarestorage.com \
    s3 cp - s3://socialops-media/backups/postgres-$(date +\%Y\%m\%d).sql.gz
```

R2's first 10GB are free; daily dumps for a year are < 5GB even with media metadata.

## Resource sizing reality check

- **postgres**: ~512MB RSS at startup, grows with data.
- **api**: ~200MB; spikes during generation.
- **video-worker + ffmpeg**: ~600MB during render, ~150MB idle. FFmpeg encode pegs 2-3 cores per job.
- **whisper (small.en, CPU)**: ~1.2GB; uses 2 cores per transcribe (5-second clip → ~2s wall).
- **miniclaw / openpost / deck-worker**: ~200MB each.
- **ComfyUI**: **do not run on CCX23** — needs GPU + 8GB+ VRAM. Use Replicate / fal.ai / Kling instead.

CCX23 = 16GB RAM handles all of the above with headroom. If video-worker starts OOM-killing, scale to CCX33 (€29/mo, 8 vCPU, 32GB) — that's the realistic ceiling before you need a separate render box.

## Updating

```bash
ssh socialops@<ip>
cd ~/socialops
git pull
docker compose --env-file .env.production -f infra/compose/socialops.production.example.yml \
  --profile workers --profile audio build
docker compose --env-file .env.production -f infra/compose/socialops.production.example.yml \
  --profile workers --profile audio up -d
docker compose exec api node dist/migrate.js
```

## What to do next on Hetzner

1. Set up a Cloudflare zero-trust tunnel instead of opening 80/443 directly — adds free DDoS + you don't need a public IP. (`cloudflared tunnel create socialops`)
2. Hook up [Sentry](https://sentry.io) free tier for error tracking — drop `SENTRY_DSN` into env, the API picks it up.
3. Schedule weekly `docker system prune -af --volumes` to clear stale images.
4. Move from `docker compose up -d` to systemd unit when you have time — survives reboots cleaner.

## Manual upload smoke test (proves the whole pipeline)

From your laptop, after deploy:

```bash
# 1. Get a presigned R2 upload URL
PRESIGN=$(curl -sX POST https://socialops.yourdomain.com/api/v1/workspaces/<ws-id>/uploads/presign \
  -H "content-type: application/json" \
  -H "x-socialops-user-email: you@youremail.com" \
  -d '{"file_name":"vcpeer-demo.mp4","content_type":"video/mp4"}')
echo $PRESIGN | jq

# 2. Upload your local mp4 directly to R2
UPLOAD_URL=$(echo $PRESIGN | jq -r .upload_url)
curl -X PUT -H "content-type: video/mp4" --data-binary @vcpeer-demo.mp4 "$UPLOAD_URL"

# 3. Register the asset
PUBLIC_URL=$(echo $PRESIGN | jq -r .public_url)
curl -sX POST https://socialops.yourdomain.com/api/v1/workspaces/<ws-id>/videos/people/upload \
  -H "content-type: application/json" \
  -H "x-socialops-user-email: you@youremail.com" \
  -d "{\"url\":\"$PUBLIC_URL\",\"file_name\":\"vcpeer-demo.mp4\",\"mime_type\":\"video/mp4\",\"media_kind\":\"video\",\"is_real_user\":true}"

# 4. (Optional) Transcribe via Whisper
curl -sX POST https://socialops.yourdomain.com/api/v1/workspaces/<ws-id>/videos/people/transcribe \
  -H "content-type: application/json" \
  -H "x-socialops-user-email: you@youremail.com" \
  -d '{"media_asset_id":"<from step 3>","model":"small.en"}'
```

If all four return 200, your pipeline is live and you're spending ~$16/month total.
