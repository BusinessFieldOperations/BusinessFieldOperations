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
  /** Date of the last update of the Terms of Use, as `yyyy-mm-dd`. */
  readonly VITE_BUSINESS_TOS_DATE: string;
  /** Support mailbox published in the Terms of Use. */
  readonly VITE_BUSINESS_SUPPORT_EMAIL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
