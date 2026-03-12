// Calls external services (OCR, Liveness, Face Match, Sanctions) with auth
// Reads service config from YAML (base_url, auth type)
// Handles OAuth2 client_credentials flow with token caching
// Handles API key auth (header-based)
// Credentials fetched from vault (never hardcoded)
