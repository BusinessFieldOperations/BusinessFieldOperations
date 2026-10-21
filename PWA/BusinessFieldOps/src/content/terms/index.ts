import {getLocale} from '@/paraglide/runtime.js';

import {termsEn} from './en';
import {termsEs} from './es';
import type {TermsDocument} from './types';

export type {
  TermsBlock,
  TermsBullet,
  TermsContact,
  TermsDocument,
  TermsParagraph,
  TermsSection,
} from './types';

const DOCUMENTS: Record<string, TermsDocument> = {
  en: termsEn,
  es: termsEs,
};

/** The Terms of Use in the active locale, in the app's language. */
export function getTermsDocument(): TermsDocument {
  return DOCUMENTS[getLocale()] ?? termsEn;
}

/**
 * Formats the date of the last update for the active locale.
 *
 * The date is parsed as a local date: `new Date('2026-10-19')` is midnight
 * UTC, which is the previous day in every timezone behind UTC.
 */
export function formatTermsDate(value: string): string {
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return value;

  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat(getLocale(), {dateStyle: 'long'}).format(date);
}

/**
 * Fills the placeholders of the document: `{appName}` becomes the business
 * name. The date and the support mailbox come from the environment and are
 * rendered by the component, not baked into the legal text.
 */
export function fillTermsPlaceholders(
  document: TermsDocument,
  appName: string,
): TermsDocument {
  const fill = (text: string) => text.replaceAll('{appName}', appName);

  return {
    ...document,
    intro: document.intro.map(fill),
    sections: document.sections.map(section => ({
      ...section,
      blocks: section.blocks.map(block =>
        block.type === 'paragraph'
          ? {type: 'paragraph', text: fill(block.text)}
          : {
              type: 'bullet',
              ...(block.lead ? {lead: fill(block.lead)} : {}),
              text: fill(block.text),
            },
      ),
    })),
  };
}
