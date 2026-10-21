import './TermsDocument.css';

import type {TermsDocument as TermsDocumentModel} from '@/content/terms';

/** Props of {@link TermsDocument}. */
export interface TermsDocumentProps {
  document: TermsDocumentModel;
  /**
   * Support mailbox shown at the end of the document. When it is empty the
   * mailbox line is left out.
   */
  supportEmail?: string;
}

/**
 * Renders the Terms of Use: the title, the intro, the numbered sections and
 * the contact details.
 *
 * The text is a document, not a list of UI strings, so it is rendered as
 * plain headings and paragraphs instead of the MDUI list components.
 */
export function TermsDocument({document, supportEmail}: TermsDocumentProps) {
  return (
    <article class="terms-document">
      <h2 class="terms-document__title">{document.title}</h2>

      {document.intro.map((text, index) => (
        <p class="terms-document__paragraph" key={index}>
          {text}
        </p>
      ))}

      {document.sections.map(section => (
        <section class="terms-document__section" key={section.id}>
          <h3 class="terms-document__heading">{section.title}</h3>

          {section.blocks.map((block, index) => (
            <p class="terms-document__paragraph" key={index}>
              {block.type === 'bullet' && block.lead ? (
                <strong class="terms-document__lead">{block.lead}</strong>
              ) : null}
              {block.text}
            </p>
          ))}
        </section>
      ))}

      <div class="terms-document__contact">
        <p class="terms-document__paragraph">{document.contact.organization}</p>
        {supportEmail ? (
          <p class="terms-document__paragraph">
            <strong class="terms-document__lead">
              {document.contact.emailLabel}:
            </strong>
            <a class="terms-document__email" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </a>
          </p>
        ) : null}
      </div>
    </article>
  );
}
