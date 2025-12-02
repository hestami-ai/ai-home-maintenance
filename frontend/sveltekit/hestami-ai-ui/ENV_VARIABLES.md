# SvelteKit Environment Variables

## Required Environment Variables

Add these to your `.env` file or environment configuration:

```bash
# Django API Configuration
SVELTE_KIT_DJANGO_API_BASE_URL=http://django:8050

# LibreChat API Configuration
LIBRECHAT_API_URL=http://librechat:3080

# Redis Configuration (if not already set)
REDIS_URL=redis://redis:6379

# Cloudflare Turnstile (CAPTCHA)
# NEXT_PUBLIC_ prefix is used for client-side access in SvelteKit
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_turnstile_site_key
TURNSTILE_SECRET_KEY=your_turnstile_secret_key
```

## Development vs Production

### Development (.env.local)
```bash
SVELTE_KIT_DJANGO_API_BASE_URL=http://localhost:8050
LIBRECHAT_API_URL=http://localhost:3080
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_turnstile_site_key
TURNSTILE_SECRET_KEY=your_turnstile_secret_key
```

### Production (.env.prod)
```bash
SVELTE_KIT_DJANGO_API_BASE_URL=http://django:8050
LIBRECHAT_API_URL=http://librechat:3080
REDIS_URL=redis://redis:6379
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_turnstile_site_key
TURNSTILE_SECRET_KEY=your_turnstile_secret_key
```

## Notes

- `LIBRECHAT_API_URL` should point to the LibreChat API service
- In Docker, use service names (e.g., `http://librechat:3080`)
- For local development, use `localhost` with appropriate ports
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is exposed to the browser for the Turnstile widget
- `TURNSTILE_SECRET_KEY` is server-side only for verifying tokens with Cloudflare
