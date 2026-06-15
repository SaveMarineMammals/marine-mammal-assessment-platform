/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_FIELD_APP_URL?: string;
  readonly VITE_GITHUB_URL?: string;
  readonly VITE_WEB_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
