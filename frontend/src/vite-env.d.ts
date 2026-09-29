/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL for every console API call. The backend serves its REST surface
   * under `/api/v1`; the default keeps requests same-origin so the Vite proxy
   * can forward them in dev and preview.
   */
  readonly VITE_API_BASE_URL?: string;
  /** Where the dev/preview proxy forwards API traffic. */
  readonly VITE_API_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
