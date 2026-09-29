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
} as const;

// Fail loudly at startup if any variable is missing or empty.
for (const [key, value] of Object.entries(config)) {
  if (!value) {
    throw new Error(`Missing environment variable for config.${key}`);
  }
}
