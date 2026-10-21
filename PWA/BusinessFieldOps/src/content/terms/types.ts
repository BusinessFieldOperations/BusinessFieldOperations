/**
 * Shape of the Terms of Use document.
 *
 * The document is content, not a user-facing string, so it does not live in
 * the Paraglide message catalog: legal text must never be rewritten by the
 * machine translation script. It is translated by hand (see `en.ts` and
 * `es.ts`) and the locale is picked at runtime.
 */

/** A paragraph of plain text. */
export interface TermsParagraph {
  type: 'paragraph';
  text: string;
}

/**
 * A bullet point. `lead` is the bold label that opens the bullet, when the
 * original text had one (e.g. "Your Company's Data:").
 */
export interface TermsBullet {
  type: 'bullet';
  lead?: string;
  text: string;
}

/** A block of the document: a paragraph or a bullet point. */
export type TermsBlock = TermsParagraph | TermsBullet;

/** A numbered section, with its title and its blocks. */
export interface TermsSection {
  /** Stable id, used as the React key. */
  id: string;
  title: string;
  blocks: TermsBlock[];
}

/** How to reach the support team. */
export interface TermsContact {
  /** The organization to ask, e.g. "Your Company Administrator / IT Support". */
  organization: string;
  /** Label of the support mailbox line, e.g. "App Support Email". */
  emailLabel: string;
}

/** The whole Terms of Use document. */
export interface TermsDocument {
  title: string;
  /** Label of the "last updated" line, e.g. "Last Updated". */
  lastUpdatedLabel: string;
  /**
   * The welcome paragraphs. May contain the `{appName}` placeholder, which
   * is replaced with the business name when the document is rendered.
   */
  intro: string[];
  sections: TermsSection[];
  contact: TermsContact;
}
