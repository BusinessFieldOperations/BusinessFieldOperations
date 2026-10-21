const env = import.meta.env;

export const config = {
  name: env.VITE_BUSINESS_NAME,
  appName: env.VITE_BUSINESS_APP_NAME,
  appNameShort: env.VITE_BUSINESS_APP_NAME_SHORT,
  appDescription: env.VITE_BUSINESS_APP_DESCRIPTION,
  favicon: env.VITE_BUSINESS_FAVICON,
  language: env.VITE_BUSINESS_MAIN_LANGUAGE,
  languageShort: env.VITE_BUSINESS_MAIN_LANGUAGE_SHORT,
  colorScheme: env.VITE_BUSINESS_COLOR_SCHEME,
  /**
   * Date of the last update of the Terms of Use, as `yyyy-mm-dd`.
   *
   * It is also the version of the terms: when it changes, users are asked to
   * accept them again.
   */
  tosDate: env.VITE_BUSINESS_TOS_DATE,
} as const;

/**
 * Values that may be empty: the app still works without them, it only shows
 * less information.
 */
export const optionalConfig = {
  /** Support mailbox published in the Terms of Use. */
  supportEmail: env.VITE_BUSINESS_SUPPORT_EMAIL,
} as const;

// Fail loudly at startup if any variable is missing or empty.
for (const [key, value] of Object.entries(config)) {
  if (!value) {
    throw new Error(`Missing environment variable for config.${key}`);
  }
}
