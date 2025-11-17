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
```

## Development vs Production

### Development (.env.local)
```bash
SVELTE_KIT_DJANGO_API_BASE_URL=http://localhost:8050
LIBRECHAT_API_URL=http://localhost:3080
REDIS_URL=redis://localhost:6379
```

### Production (.env.prod)
```bash
SVELTE_KIT_DJANGO_API_BASE_URL=http://django:8050
LIBRECHAT_API_URL=http://librechat:3080
REDIS_URL=redis://redis:6379
```

## Notes

- `LIBRECHAT_API_URL` should point to the LibreChat API service
- In Docker, use service names (e.g., `http://librechat:3080`)
- For local development, use `localhost` with appropriate ports
