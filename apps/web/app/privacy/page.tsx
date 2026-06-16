import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Aviso de Privacidad — Sensu',
  description:
    'Aviso de Privacidad Integral de Estela Systems, S. de R.L. de C.V. — Sensu.',
};

const LAST_UPDATED = '13 de mayo de 2026';
const VERSION = 'Versión 1.0';

type Section = { title: string; paragraphs: string[] };

const SECTIONS: Section[] = [
  {
    title: '1. Identidad y domicilio del Responsable',
    paragraphs: [
      'ESTELA SYSTEMS, S. DE R.L. DE C.V. ("Sensu"), con domicilio en Av. Presidente Masaryk 264, Int. 3, Polanco V Sección, Miguel Hidalgo, C.P. 11560, Ciudad de México, con RFC ESY2502137B4, es responsable del tratamiento de los datos personales que usted nos proporcione, de conformidad con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) y su Reglamento.',
    ],
  },
  {
    title: '2. Definiciones',
    paragraphs: [
      'Para efectos del presente Aviso, se entenderá por:',
      'Titular: La persona física a quien corresponden los datos personales.',
      'Usuario: La persona que porta y utiliza el dispositivo o servicio Sensu.',
      'Cliente: La persona física o moral que contrata el servicio en beneficio del Usuario.',
      'Servicio: El ecosistema Sensu, integrado por el dispositivo Angela, la aplicación móvil, la plataforma Sensu y el call center de monitoreo y asistencia.',
      'Emergencia: Evento que implica riesgo real o potencial para la integridad o salud del Usuario y que activa los mecanismos de alerta, comunicación o canalización del Servicio.',
      'Datos sensibles: Datos personales que afectan la esfera más íntima del Titular, cuya divulgación indebida puede originar discriminación o conllevar riesgo grave. Para Sensu, esto incluye los datos de salud proporcionados voluntariamente.',
    ],
  },
  {
    title: '3. Datos personales recabados',
    paragraphs: [
      'Sensu podrá recabar y tratar las siguientes categorías de datos personales:',
      'a) Datos de identificación: nombre completo, fecha de nacimiento, género, CURP (cuando aplique), fotografía (cuando se proporcione voluntariamente).',
      'b) Datos de contacto: teléfono móvil, correo electrónico, domicilio.',
      'c) Contactos de emergencia: nombre, relación con el Usuario y teléfono de las personas designadas por el Cliente o Usuario.',
      'd) Datos de ubicación: geolocalización en tiempo real o diferida, obtenida a través del dispositivo Angela, la aplicación móvil, señal GPS o redes de telecomunicaciones.',
      'e) Datos operativos: historial de eventos y alertas (SOS, caída, geocerca, batería baja), estado del dispositivo, configuraciones del servicio, registros de comunicación con el call center.',
      'f) Datos de servicios contratados por el Cliente: información de pólizas de seguro, ambulancias u otros servicios de terceros que el Cliente haya contratado y proporcione a Sensu para fines operativos.',
      'g) Datos sensibles — salud (voluntarios): padecimientos, alergias, grupo sanguíneo, medicamentos, condiciones médicas relevantes. Estos datos son opcionales y únicamente se recaban cuando el Cliente o Usuario los proporciona expresamente para facilitar la atención en caso de emergencia. Su captura implica el consentimiento expreso y por escrito del Titular conforme al artículo 9 de la LFPDPPP.',
      'Sensu no recaba datos financieros ni de tarjetas de crédito de forma directa; dichos datos son gestionados exclusivamente por los procesadores de pago contratados para tal efecto, bajo sus propias políticas de privacidad.',
    ],
  },
  {
    title: '4. Datos de menores de edad',
    paragraphs: [
      'Cuando el Usuario sea menor de edad, Sensu únicamente tratará sus datos personales con el consentimiento expreso del padre, madre o tutor legal, quien será el Titular para todos los efectos de este Aviso. El padre, madre o tutor declara bajo su responsabilidad que cuenta con facultades suficientes para proporcionar los datos del menor y autorizar su tratamiento.',
      'Si Sensu detecta que ha recabado datos de un menor sin el consentimiento correspondiente, procederá a su eliminación inmediata.',
    ],
  },
  {
    title: '5. Finalidades del tratamiento',
    paragraphs: [
      '5.1 Finalidades primarias (necesarias para la prestación del Servicio — no requieren consentimiento adicional):',
      'Activación, configuración y operación del dispositivo Angela y demás componentes del Servicio.',
      'Recepción, procesamiento y gestión de alertas, eventos y señales generadas por el dispositivo o la aplicación.',
      'Monitoreo continuo del estado del dispositivo y del Usuario.',
      'Atención y resolución de emergencias e incidentes: contacto con el Usuario, sus contactos de emergencia y, en su caso, canalización con servicios de terceros (ambulancias, servicios médicos, asistencias).',
      'Geolocalización del Usuario para efectos operativos y de atención de eventos.',
      'Comunicación con el Cliente y el Usuario sobre el estado del Servicio, renovaciones, soporte y cobranza.',
      'Cumplimiento de obligaciones legales, fiscales y regulatorias.',
      '5.2 Finalidades secundarias (requieren consentimiento expreso — el Titular puede oponerse):',
      'Mejora del Servicio mediante análisis estadístico y analítica de uso agregada y anonimizada.',
      'Envío de comunicaciones comerciales, promociones y novedades de Sensu.',
      'Elaboración de perfiles de uso para personalizar la experiencia del Cliente.',
      'Si el Titular no desea que sus datos sean tratados para las finalidades secundarias, podrá manifestarlo en cualquier momento enviando un correo a atencion@sensu.com.mx indicando "Oposición a finalidades secundarias". La negativa no afectará la prestación del Servicio.',
    ],
  },
  {
    title: '6. Tratamiento de datos sensibles',
    paragraphs: [
      'Los datos de salud descritos en el inciso g) de la cláusula 3 tienen el carácter de datos sensibles conforme al artículo 9 de la LFPDPPP. Su tratamiento se sujeta a las siguientes reglas:',
      'Son estrictamente voluntarios. Sensu no condiciona la prestación del Servicio a su captura.',
      'Se recaban únicamente cuando el Titular los proporciona de forma expresa a través de la plataforma Sensu, la aplicación móvil o en comunicación directa con el call center.',
      'Su finalidad es exclusivamente operativa: facilitar la atención personalizada del call center y de los servicios de asistencia en caso de emergencia.',
      'No serán utilizados para finalidades secundarias ni transferidos a terceros salvo en los casos previstos en la cláusula 8 de este Aviso.',
      'El Titular puede solicitar su eliminación en cualquier momento ejerciendo su derecho de Cancelación conforme a la cláusula 10.',
    ],
  },
  {
    title: '7. Consentimiento',
    paragraphs: [
      'El tratamiento de datos personales para las finalidades primarias se realiza bajo consentimiento tácito, manifestándose por cualquiera de los actos descritos en los Términos y Condiciones del Servicio (activación del dispositivo, uso de la aplicación, pago del plan, entre otros).',
      'El tratamiento de datos sensibles de salud requiere consentimiento expreso del Titular, el cual se manifiesta en el momento en que el propio Titular los captura voluntariamente en la plataforma o los comunica al call center.',
      'El tratamiento para finalidades secundarias requiere consentimiento expreso por escrito o por medios electrónicos equivalentes, el cual podrá solicitarse al momento de la contratación o posteriormente a través de los canales disponibles.',
    ],
  },
  {
    title: '8. Transferencia de datos personales',
    paragraphs: [
      'Sensu podrá transferir datos personales a los siguientes destinatarios, en los términos que se indican:',
      '8.1 Transferencias que no requieren consentimiento del Titular (artículo 37 LFPDPPP):',
      'Autoridades competentes (judiciales, administrativas, fiscales, de salud pública) cuando sea requerido por ley, orden judicial o para la protección del interés público.',
      'Sociedades controladoras, subsidiarias o afiliadas de Sensu, para efectos administrativos y operativos internos.',
      '8.2 Transferencias que requieren consentimiento o se realizan bajo contrato con encargados:',
      'Call center y operadores de monitoreo: para la gestión de alertas, contacto con el Usuario y coordinación de asistencias.',
      'Proveedores de asistencias (médicas, psicológicas, nutricionales, hogar, viales, ambulancias): exclusivamente para la atención del evento reportado y conforme al paquete contratado.',
      'Proveedores tecnológicos (infraestructura de nube, conectividad, geolocalización): para la operación técnica del Servicio.',
      'Contactos de emergencia designados por el Cliente o Usuario: para notificación en caso de evento o alerta.',
      'Sensu suscribe contratos de tratamiento de datos con todos sus proveedores y encargados, obligando a éstos a tratar los datos conforme a las instrucciones de Sensu y a las disposiciones de la LFPDPPP. Sensu no vende ni cede datos personales a terceros con fines comerciales propios de dichos terceros.',
    ],
  },
  {
    title: '9. Conservación y eliminación de datos',
    paragraphs: [
      'Sensu aplica la siguiente política de conservación y eliminación activa de datos:',
      'Durante la vigencia del plan: los datos personales y operativos del Usuario son tratados activamente para la prestación del Servicio.',
      'Al término del Servicio (cancelación, no renovación o baja): Sensu eliminará de forma definitiva e irreversible los datos personales del Usuario — incluyendo historial de eventos, alertas, geolocalización y datos de salud — dentro de los treinta días naturales siguientes a la fecha efectiva de terminación. Sensu no conserva bases de datos de Usuarios inactivos.',
      'Datos de conservación legal obligatoria: excepcionalmente, Sensu conservará los datos estrictamente necesarios para cumplir con obligaciones fiscales, contables o legales, únicamente por el plazo que la legislación mexicana exija y en condiciones de acceso restringido, aislados de los sistemas operativos activos.',
      'Fallecimiento del Usuario: a petición del Cliente o familiar acreditado (con acta de defunción), Sensu procederá con la eliminación anticipada en el mismo plazo de treinta días.',
    ],
  },
  {
    title: '10. Medidas de seguridad',
    paragraphs: [
      'Sensu implementa medidas técnicas, administrativas y físicas para proteger los datos personales contra acceso no autorizado, pérdida, alteración o divulgación indebida, incluyendo:',
      'Cifrado de datos en tránsito y en reposo.',
      'Control de acceso basado en roles y necesidad de conocer.',
      'Monitoreo de actividad y registros de auditoría.',
      'Políticas internas de seguridad de la información.',
      'Destrucción segura de datos al término del plazo de conservación.',
      'No obstante lo anterior, ningún sistema de seguridad es infalible. En caso de una vulneración de seguridad que afecte significativamente los derechos de los Titulares, Sensu notificará al Instituto Nacional de Transparencia, Acceso a la Información y Protección de Datos Personales (INAI) y a los Titulares afectados en los términos y plazos que establezca la ley.',
    ],
  },
  {
    title: '11. Derechos ARCO y procedimiento de ejercicio',
    paragraphs: [
      'El Titular tiene derecho a:',
      'Acceso: conocer qué datos personales tiene Sensu sobre usted, para qué los trata y a quién los ha transferido.',
      'Rectificación: solicitar la corrección de datos inexactos, incompletos o desactualizados.',
      'Cancelación: solicitar la eliminación de sus datos cuando no sean necesarios para las finalidades para las que fueron recabados, o cuando haya concluido la relación contractual.',
      'Oposición: oponerse al tratamiento de sus datos para finalidades específicas, incluyendo las finalidades secundarias.',
      'Procedimiento: para ejercer cualquiera de los derechos anteriores, el Titular deberá enviar una solicitud al correo atencion@sensu.com.mx con el asunto "Solicitud ARCO", incluyendo:',
      'Nombre completo y correo electrónico registrado en el Servicio.',
      'Copia de identificación oficial vigente.',
      'Descripción clara del derecho que desea ejercer y los datos a los que se refiere.',
      'En caso de actuar en representación de un tercero: instrumento que acredite la representación.',
      'Sensu responderá en un plazo máximo de 20 días hábiles a partir de la recepción de la solicitud completa, informando la determinación adoptada. Si la solicitud procede, Sensu la hará efectiva dentro de los 15 días hábiles siguientes a la respuesta. Ambos plazos son prorrogables una sola vez por igual período, con justificación escrita.',
    ],
  },
  {
    title: '12. Revocación del consentimiento',
    paragraphs: [
      'El Titular puede revocar su consentimiento para el tratamiento de sus datos personales en cualquier momento, sin efectos retroactivos sobre el tratamiento realizado con anterioridad. La revocación del consentimiento para finalidades primarias implicará la imposibilidad de continuar prestando el Servicio.',
      'Para revocar el consentimiento, el Titular deberá enviar su solicitud al correo atencion@sensu.com.mx con el asunto "Revocación de consentimiento", indicando el alcance de la revocación deseada (total o parcial, especificando en su caso las finalidades afectadas). Sensu responderá y hará efectiva la revocación en los mismos plazos que los derechos ARCO.',
    ],
  },
  {
    title: '13. Uso de cookies y tecnologías de seguimiento',
    paragraphs: [
      'El sitio web de Sensu (www.sensu.com.mx) y la aplicación móvil pueden utilizar cookies y tecnologías similares para garantizar el funcionamiento correcto de la plataforma, recordar preferencias del Usuario y recabar información sobre el uso del sitio con fines analíticos.',
      'Actualmente Sensu utiliza cookies propias de funcionamiento y, en su caso, cookies de terceros para analítica web. La lista de cookies activas, su finalidad y su tiempo de vida está disponible en la configuración de cookies del sitio.',
      'El Usuario puede deshabilitar las cookies a través de la configuración de su navegador, aunque ello podrá afectar el funcionamiento de algunas funcionalidades del sitio. Las cookies estrictamente necesarias para el funcionamiento del Servicio no pueden desactivarse.',
    ],
  },
  {
    title: '14. Sensu como encargado en contratos empresariales',
    paragraphs: [
      'Cuando una empresa contrate el Servicio para sus trabajadores, familiares de trabajadores o beneficiarios (modalidad B2B), dicha empresa actúa como responsable del tratamiento de los datos de sus colaboradores frente a Sensu. En ese supuesto, Sensu actuará como encargado del tratamiento y tratará los datos únicamente conforme a las instrucciones de la empresa contratante y para los fines del Servicio.',
      'La empresa contratante será responsable de informar a sus trabajadores y beneficiarios sobre el tratamiento de sus datos y de obtener los consentimientos necesarios conforme a la legislación aplicable.',
    ],
  },
  {
    title: '15. Cambios a este Aviso de Privacidad',
    paragraphs: [
      'Sensu podrá modificar el presente Aviso de Privacidad en cualquier momento para reflejar cambios en el Servicio, en la legislación aplicable o en las prácticas de tratamiento de datos. Las modificaciones serán notificadas al Titular a través del sitio web www.sensu.com.mx, la aplicación móvil o por correo electrónico, con al menos 10 días naturales de anticipación a su entrada en vigor.',
      'El uso continuado del Servicio tras la notificación constituirá aceptación de los cambios, salvo que la ley disponga otra cosa.',
      'La versión vigente del Aviso estará siempre disponible en www.sensu.com.mx/avisodeprivacidad.',
    ],
  },
  {
    title: '16. Autoridad competente',
    paragraphs: [
      'Si el Titular considera que Sensu ha vulnerado sus derechos en materia de protección de datos personales, podrá acudir al Instituto Nacional de Transparencia, Acceso a la Información y Protección de Datos Personales (INAI), con domicilio en Insurgentes Sur 3211, Col. Insurgentes Cuicuilco, Alcaldía Coyoacán, C.P. 04530, Ciudad de México, o a través del portal www.inai.org.mx.',
    ],
  },
];

const CONTACT_LINES = [
  'ESTELA SYSTEMS, S. DE R.L. DE C.V. — SENSU',
  'atencion@sensu.com.mx • +52 55 4343 0729 • www.sensu.com.mx',
  'Av. Presidente Masaryk 264, Int. 3, Polanco V Sección, Miguel Hidalgo, C.P. 11560, Ciudad de México',
];

export default function PrivacyPage() {
  return (
    <main
      data-testid="privacy-page"
      className="flex flex-1 flex-col items-center px-6 py-12"
    >
      <article className="w-full max-w-3xl text-sm leading-relaxed text-zinc-700">
        <header>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
            Aviso de Privacidad Integral
          </h1>
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
            {VERSION} · Vigente a partir del {LAST_UPDATED}
          </p>
        </header>

        <p className="mt-8 italic text-zinc-500">
          ESTELA SYSTEMS, S. DE R.L. DE C.V. — Sensu
        </p>

        {SECTIONS.map((s) => (
          <section key={s.title} className="mt-8">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
              {s.title}
            </h2>
            <div className="mt-3 space-y-3">
              {s.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        ))}

        <footer className="mt-12 border-t border-zinc-200/70 pt-6 text-xs text-zinc-500 space-y-1">
          {CONTACT_LINES.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </footer>
      </article>
    </main>
  );
}
