import type {TermsDocument} from './types';

/**
 * Terms of Use, Spanish version.
 *
 * Translated by hand: this is legal text and must not be machine translated.
 * `{appName}` is replaced with the business name when the document renders.
 */
export const termsEs: TermsDocument = {
  title: 'Términos de Servicio',
  lastUpdatedLabel: 'Última actualización',
  intro: [
    'Bienvenido/a a {appName} (la "Aplicación"). Esta Aplicación es una herramienta de trabajo diseñada para permitirte consultar y gestionar información y registros empresariales autorizados por tu empleador u organización.',
    'Al instalar, acceder o utilizar esta Aplicación, aceptas estos Términos de Servicio. Si no estás de acuerdo con ellos, te pedimos que no utilices la Aplicación.',
  ],
  sections: [
    {
      id: 'who-can-use',
      title: '1. ¿Quién puede utilizar esta Aplicación?',
      blocks: [
        {
          type: 'bullet',
          text: 'Esta Aplicación está destinada exclusivamente al personal autorizado, colaboradores o contratistas de las empresas u organizaciones participantes.',
        },
        {
          type: 'bullet',
          text: 'Eres responsable de mantener la confidencialidad de tus datos de acceso. No compartas tu cuenta ni tu contraseña con nadie.',
        },
      ],
    },
    {
      id: 'location-services',
      title: '2. Servicios de Ubicación (GPS / GLONASS)',
      blocks: [
        {
          type: 'bullet',
          text: 'La Aplicación utiliza los servicios de ubicación por satélite y red de tu dispositivo móvil (incluidos GPS y GLONASS).',
        },
        {
          type: 'bullet',
          text: 'Según la configuración establecida por tu organización, esta función se utiliza exclusivamente para fines laborales (como el registro de visitas a clientes, check-in en puntos de trabajo o tareas de campo).',
        },
        {
          type: 'bullet',
          text: 'Los datos de ubicación solo se recopilan en relación con tus actividades laborales y el uso de la Aplicación. Puedes gestionar los permisos de ubicación en los ajustes de tu teléfono, aunque desactivarlos puede limitar ciertas funciones de la herramienta.',
        },
      ],
    },
    {
      id: 'ownership',
      title: '3. Propiedad de la Información y Derechos de Autor',
      blocks: [
        {
          type: 'paragraph',
          text: 'Para mantener total claridad, la propiedad de los distintos elementos se divide de la siguiente manera:',
        },
        {
          type: 'bullet',
          lead: 'Datos de la Empresa:',
          text: 'Toda la información empresarial, registros de clientes, bases de datos e información de terceros a la que accedas o que envíes a través de la Aplicación pertenece exclusivamente a tu empresa/empleador o a sus respectivos asociados.',
        },
        {
          type: 'bullet',
          lead: 'Diseño, Documentación y Medios de la App:',
          text: 'Los estilos visuales, la interfaz de usuario, los manuales, iconos, documentación técnica y recursos multimedia pertenecen a los autores de la Aplicación y a terceros proveedores (incluidos Google Material Design y MDUI).',
        },
        {
          type: 'bullet',
          lead: 'Código de la Aplicación:',
          text: 'El código fuente base de este software es de acceso público y está bajo la licencia Creative Commons Atribución-NoComercial 4.0 Internacional (CC BY-NC 4.0). No está permitida su venta o explotación comercial como producto cerrado sin la autorización correspondiente.',
        },
      ],
    },
    {
      id: 'third-party',
      title: '4. Servicios Externos y Proveedores en la Nube',
      blocks: [
        {
          type: 'paragraph',
          text: 'Para funcionar de manera rápida, estable y segura en distintos países, la Aplicación se apoya en plataformas externas de confianza, entre ellas:',
        },
        {
          type: 'bullet',
          lead: 'Supabase',
          text: '(gestión de bases de datos y autenticación de usuarios)',
        },
        {
          type: 'bullet',
          lead: 'Netlify',
          text: '(alojamiento y distribución de la plataforma)',
        },
        {
          type: 'bullet',
          lead: 'Workspaces',
          text: '(integración de herramientas de trabajo y productividad empresarial)',
        },
        {
          type: 'paragraph',
          text: 'Al utilizar la Aplicación, aceptas que la información técnica necesaria para operar se transmita a través de estos servicios según los estándares habituales de la computación en la nube.',
        },
      ],
    },
    {
      id: 'acceptable-use',
      title: '5. Uso Aceptable',
      blocks: [
        {
          type: 'paragraph',
          text: 'Al utilizar la Aplicación, te comprometes a no:',
        },
        {
          type: 'bullet',
          text: 'Copiar, filtrar, descargar o compartir con personas no autorizadas la información confidencial de la empresa, clientes o terceros.',
        },
        {
          type: 'bullet',
          text: 'Intentar vulnerar la seguridad del sistema, alterar las bases de datos o interferir en la cuenta de otros usuarios.',
        },
        {
          type: 'bullet',
          text: 'Utilizar la Aplicación para fines personales, actividades ilícitas o fines comerciales ajenos a tu trabajo.',
        },
      ],
    },
    {
      id: 'availability',
      title: '6. Disponibilidad de la Aplicación ("Tal cual")',
      blocks: [
        {
          type: 'paragraph',
          text: 'Nos esforzamos por ofrecer un servicio continuo y estable; sin embargo, la Aplicación se ofrece "tal cual" y "según disponibilidad":',
        },
        {
          type: 'bullet',
          text: 'El servicio puede suspenderse temporalmente por mantenimiento, actualizaciones o fallos en las redes de telecomunicaciones.',
        },
        {
          type: 'bullet',
          text: 'Ni los desarrolladores de la Aplicación ni tu empresa se hacen responsables por interrupciones temporales causadas por factores fuera de su control.',
        },
      ],
    },
    {
      id: 'access-termination',
      title: '7. Suspensión y Cancelación de Acceso',
      blocks: [
        {
          type: 'paragraph',
          text: 'El acceso a esta Aplicación está vinculado a tu relación laboral con la organización. Tu acceso puede ser revocado o desactivado en cualquier momento por tu empresa o por los administradores de la plataforma si:',
        },
        {
          type: 'bullet',
          text: 'Concluye tu relación laboral o cambias de puesto.',
        },
        {
          type: 'bullet',
          text: 'Incumples estos Términos de Servicio o las políticas internas de tu organización.',
        },
      ],
    },
    {
      id: 'changes',
      title: '8. Cambios en estos Términos',
      blocks: [
        {
          type: 'paragraph',
          text: 'Estos términos pueden actualizarse ocasionalmente para reflejar nuevas funciones o cumplir con requerimientos técnicos o legales. El uso continuo de la Aplicación tras una actualización se entenderá como la aceptación de los nuevos términos.',
        },
      ],
    },
    {
      id: 'contact',
      title: '9. Contacto',
      blocks: [
        {
          type: 'paragraph',
          text: 'Si tienes preguntas sobre el uso de esta Aplicación o sobre estos Términos, comunícate con:',
        },
      ],
    },
  ],
  contact: {
    organization: 'El Administrador de tu Empresa / Soporte de TI interno',
    emailLabel: 'Correo de soporte de la Aplicación',
  },
};
