/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BUSINESS_NAME: string;
  readonly VITE_BUSINESS_APP_NAME: string;
  readonly VITE_BUSINESS_APP_NAME_SHORT: string;
  readonly VITE_BUSINESS_APP_DESCRIPTION: string;
  readonly VITE_BUSINESS_FAVICON: string;
  readonly VITE_BUSINESS_MAIN_LANGUAGE: string;
  readonly VITE_BUSINESS_MAIN_LANGUAGE_SHORT: string;
  readonly VITE_BUSINESS_COLOR_SCHEME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
