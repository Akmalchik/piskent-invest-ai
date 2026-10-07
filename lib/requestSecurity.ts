const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024;

export function isSameOriginRequest(request: Request) {
    const origin = request.headers.get('origin');
    if (!origin) return process.env.NODE_ENV !== 'production';

    const allowedOrigins = new Set<string>();
    allowedOrigins.add(new URL(request.url).origin);

    for (const configuredUrl of [process.env.SITE_URL, process.env.NEXT_PUBLIC_SITE_URL]) {
        if (!configuredUrl) continue;
        try {
            allowedOrigins.add(new URL(configuredUrl).origin);
        } catch {
            // Invalid configuration must not expand the allowlist.
        }
    }

    return allowedOrigins.has(origin);
}

export function hasAcceptableJsonSize(request: Request) {
    const contentLength = request.headers.get('content-length');
    if (!contentLength) return true;

    const bytes = Number(contentLength);
    return Number.isSafeInteger(bytes) && bytes >= 0 && bytes <= MAX_JSON_BODY_BYTES;
}

export function requestIp(request: Request) {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')?.trim()
        || 'unknown';
}
