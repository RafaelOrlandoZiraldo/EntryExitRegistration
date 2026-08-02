/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: "opfs" | "api";
  readonly VITE_AUTH_USERNAME?: string;
  readonly VITE_AUTH_PASSWORD_HASH?: string;
  readonly VITE_AUTH_PASSWORD_SALT?: string;
  readonly VITE_AUTH_PASSWORD_ITERATIONS?: string;
  readonly VITE_SESSION_TIMEOUT_MINUTES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
