import type {TermsDocument} from './types';

/**
 * Terms of Use, English version.
 *
 * Translated by hand: this is legal text and must not be machine translated.
 * `{appName}` is replaced with the business name when the document renders.
 */
export const termsEn: TermsDocument = {
  title: 'Terms of Service',
  lastUpdatedLabel: 'Last Updated',
  intro: [
    'Welcome to {appName} (the "App"). This App is a workplace tool designed to help you access business records and information authorized by your employer or organization.',
    'By installing, accessing, or using this App, you agree to these Terms of Service. If you do not agree, please do not use the App.',
  ],
  sections: [
    {
      id: 'who-can-use',
      title: '1. Who Can Use This App',
      blocks: [
        {
          type: 'bullet',
          text: 'This App is intended strictly for authorized employees, contractors, and team members of participating businesses.',
        },
        {
          type: 'bullet',
          text: 'You are responsible for keeping your login credentials confidential. Do not share your account or password with anyone else.',
        },
      ],
    },
    {
      id: 'location-services',
      title: '2. Location Services (GPS / GLONASS)',
      blocks: [
        {
          type: 'bullet',
          text: "The App uses your device's satellite and network location services (such as GPS and GLONASS).",
        },
        {
          type: 'bullet',
          text: 'Depending on how your organization sets up the App, this feature may be used for work-related functions (such as verifying job site visits, route check-ins, or field reporting).',
        },
        {
          type: 'bullet',
          text: 'Location data is only collected in connection with your work duties and app usage. You can manage location permissions directly in your device settings, but disabling them may limit some features of the App.',
        },
      ],
    },
    {
      id: 'ownership',
      title: '3. Ownership and Intellectual Property',
      blocks: [
        {
          type: 'paragraph',
          text: 'To keep things transparent, here is who owns what within the App:',
        },
        {
          type: 'bullet',
          lead: "Your Company's Data:",
          text: 'All business records, customer information, database entries, and third-party business data you view or submit through this App belong entirely to your employer, organization, or their respective partners.',
        },
        {
          type: 'bullet',
          lead: 'App Design, Media, and Documentation:',
          text: 'The user interface styles, icons, manuals, media, custom graphics, and documentation belong to the creators of this App and their respective licensors (including Google Material Design and MDUI).',
        },
        {
          type: 'bullet',
          lead: 'The App Code:',
          text: 'The underlying source code of this App is publicly available under the Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0) license. It may not be used or exploited for commercial software sales without explicit permission.',
        },
      ],
    },
    {
      id: 'third-party',
      title: '4. Third-Party Services',
      blocks: [
        {
          type: 'paragraph',
          text: 'To operate reliably and securely across regions, the App relies on trusted third-party cloud infrastructure and services, including:',
        },
        {
          type: 'bullet',
          lead: 'Supabase',
          text: '(data storage and authentication)',
        },
        {
          type: 'bullet',
          lead: 'Netlify',
          text: '(hosting and network delivery)',
        },
        {
          type: 'bullet',
          lead: 'Workspaces',
          text: '(business workspace and productivity integration)',
        },
        {
          type: 'paragraph',
          text: 'These providers help keep the service online and secure. By using the App, you acknowledge that technical data travels through these services according to standard cloud operations.',
        },
      ],
    },
    {
      id: 'acceptable-use',
      title: '5. Acceptable Use',
      blocks: [
        {type: 'paragraph', text: 'When using the App, you agree not to:'},
        {
          type: 'bullet',
          text: 'Copy, leak, export, or share confidential company or client data with unauthorized individuals.',
        },
        {
          type: 'bullet',
          text: 'Attempt to bypass security controls, tamper with the database, or interfere with other users.',
        },
        {
          type: 'bullet',
          text: 'Use the App for any illegal, unauthorized, or personal commercial purpose.',
        },
      ],
    },
    {
      id: 'availability',
      title: '6. App Availability ("As-Is")',
      blocks: [
        {
          type: 'paragraph',
          text: 'We work hard to keep the App running smoothly, but it is provided on an "as-is" and "as-available" basis.',
        },
        {
          type: 'bullet',
          text: 'There may be times when the App is temporarily unavailable due to maintenance, system updates, or network failures.',
        },
        {
          type: 'bullet',
          text: 'Neither the App developers nor your employer are liable for temporary interruptions or network loss beyond their control.',
        },
      ],
    },
    {
      id: 'access-termination',
      title: '7. Access and Account Termination',
      blocks: [
        {
          type: 'paragraph',
          text: 'Your access to this App is tied to your authorized role with your organization. Your access may be suspended or revoked at any time by your employer or the App administrators if:',
        },
        {
          type: 'bullet',
          text: 'You leave your company or change roles.',
        },
        {
          type: 'bullet',
          text: 'You violate these Terms of Service or your company’s internal policies.',
        },
      ],
    },
    {
      id: 'changes',
      title: '8. Changes to These Terms',
      blocks: [
        {
          type: 'paragraph',
          text: 'We may update these terms from time to time to reflect changes in the App’s features or legal requirements. Continued use of the App after an update means you accept the revised terms.',
        },
      ],
    },
    {
      id: 'contact',
      title: '9. Contact',
      blocks: [
        {
          type: 'paragraph',
          text: 'If you have questions about using this App or about these Terms, please contact:',
        },
      ],
    },
  ],
  contact: {
    organization: 'Your Company Administrator / IT Support',
    emailLabel: 'App Support Email',
  },
};
