import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Términos y Condiciones — Sensu',
  description:
    'Términos y Condiciones Generales de Uso, Contratación y Prestación de Servicios de Sensu — Estela Systems, S. de R.L. de C.V.',
};

const LAST_UPDATED = '13 de mayo de 2026';
const VERSION = 'Versión 1.2';

type Section = { title: string; paragraphs: string[] };

const SECTIONS: Section[] = [
  {
    title: '1. Identidad del proveedor',
    paragraphs: [
      'Los presentes Términos y Condiciones Generales de Uso, Contratación y Prestación de Servicios (los "Términos y Condiciones") regulan el acceso, adquisición, contratación, activación y uso de los productos, servicios, aplicaciones, plataformas, dispositivos, herramientas digitales y servicios de intermediación tecnológica ofrecidos bajo la marca Sensu, por ESTELA SYSTEMS, S. DE R.L. DE C.V., sociedad legalmente constituida conforme a las leyes de los Estados Unidos Mexicanos, con Registro Federal de Contribuyentes ESY2502137B4, a quien en lo sucesivo se le denominará "Sensu".',
      'Para efectos legales y contractuales, cualquier referencia a "Sensu" comprenderá a ESTELA SYSTEMS, S. DE R.L. DE C.V., sus plataformas, aplicaciones, infraestructura tecnológica, sistemas de monitoreo, call center, personal operativo, canales de atención, distribuidores autorizados y, en su caso, sus proveedores tecnológicos.',
    ],
  },
  {
    title: '2. Objeto',
    paragraphs: [
      'Sensu pone a disposición del público consumidor una solución integral de tecnología de monitoreo, alertamiento, comunicación, asistencia e intermediación para la reacción ante eventos, incidentes y emergencias, compuesta, según el plan contratado, por:',
      'a) la venta de un dispositivo tecnológico portátil;',
      'b) acceso a aplicación móvil, plataforma o herramientas digitales;',
      'c) conectividad y funcionalidades asociadas al dispositivo;',
      'd) atención por call center y centro de asistencia;',
      'e) recepción y gestión de alertas;',
      'f) notificación a contactos de emergencia;',
      'g) geolocalización y funciones de ubicación;',
      'h) canalización, coordinación o enlace con prestadores terceros de asistencias, emergencias o servicios complementarios.',
      'El Cliente reconoce y acepta que Sensu es, primordialmente, un proveedor tecnológico y un intermediario de asistencias, y que, salvo pacto expreso en contrario, no presta directamente servicios médicos, hospitalarios, de ambulancia, aseguradores, funerarios, viales, de hogar, psicológicos, dentales, nutricionales, de seguridad pública, rescate, protección civil ni otros servicios especializados de terceros.',
    ],
  },
  {
    title: '3. Aceptación',
    paragraphs: [
      'La persona que adquiere, activa, paga, recibe, utiliza o mantiene activo cualquier producto o servicio de Sensu, por sí o en representación del usuario final, acepta de manera expresa, plena e incondicional estos Términos y Condiciones.',
      'La aceptación podrá manifestarse por cualquiera de los siguientes medios:',
      'a) firma autógrafa o electrónica;',
      'b) aceptación digital por clic, casilla, botón o mecanismo equivalente;',
      'c) pago total o parcial;',
      'd) activación del dispositivo;',
      'e) descarga o uso de la aplicación;',
      'f) uso continuado del servicio;',
      'g) entrega de datos del usuario, contactos de emergencia o información para la operación del servicio.',
      'Si quien acepta lo hace por cuenta de un menor de edad, adulto mayor o tercero, manifiesta bajo protesta de decir verdad que cuenta con autorización suficiente para ello.',
    ],
  },
  {
    title: '4. Definiciones',
    paragraphs: [
      'Para efectos de estos Términos y Condiciones, se entenderá por:',
      'Cliente: la persona física consumidora que contrata y paga el servicio.',
      'Usuario: la persona que porta, utiliza o respecto de la cual opera el dispositivo o el servicio, pudiendo coincidir o no con el Cliente.',
      'Dispositivo: el equipo físico comercializado por Sensu como parte de la solución contratada.',
      'Aplicación o App: la aplicación móvil o sistema digital vinculado al servicio.',
      'Call Center: el centro de atención, monitoreo, seguimiento, contacto y gestión operado por o para Sensu.',
      'Servicios de Sensu: los servicios tecnológicos, de monitoreo, alertamiento, geolocalización, comunicación, recepción de eventos, gestión y canalización prestados por Sensu.',
      'Servicios de Terceros: asistencias, ambulancias, servicios médicos, aseguradores, viales, de hogar, funerarios o cualesquiera otros prestados por proveedores distintos de Sensu.',
      'Contacto de Emergencia: la persona designada por el Cliente o Usuario para ser contactada en caso de evento, alarma o incidente.',
      'Evento: toda alerta, señal, activación SOS, notificación de caída, salida de geocerca, batería baja, solicitud de asistencia, incidencia técnica o cualquier otro suceso detectado o reportado por el sistema.',
      'Geolocalización: datos de ubicación aproximada o en tiempo real obtenidos a través del dispositivo, la aplicación, redes móviles, GPS u otras tecnologías.',
      'Plan: el paquete anual contratado por el Cliente.',
    ],
  },
  {
    title: '5. Naturaleza del servicio',
    paragraphs: [
      'El Cliente reconoce expresamente que el servicio de Sensu consiste en una solución de apoyo tecnológico y de intermediación de asistencias, orientada a facilitar la detección, comunicación, gestión y canalización de eventos, pero no constituye ni debe interpretarse como un seguro, servicio de seguridad pública, servicio médico directo, garantía de rescate, garantía de prevención de daños, servicio de protección absoluta, ni sustituto de atención médica, hospitalaria, policial, familiar, cuidador humano, supervisor presencial o servicios de emergencia gubernamentales.',
      'En consecuencia, Sensu no puede garantizar resultados específicos, eliminación de riesgos, prevención total de incidentes ni atención efectiva en todos los casos.',
    ],
  },
  {
    title: '6. Componentes del servicio',
    paragraphs: [
      'Dependiendo del plan contratado, el Cliente podrá contar con uno o varios de los siguientes componentes:',
      'a) dispositivo portátil con funciones de comunicación, alertamiento y ubicación;',
      'b) conectividad celular o de datos asociada al dispositivo;',
      'c) aplicación móvil para consulta de eventos y ubicación;',
      'd) geocercas y notificaciones;',
      'e) recepción de alertas SOS;',
      'f) recepción de ciertos eventos automatizados o semiautomatizados, incluyendo, en su caso, alertas de caída;',
      'g) call center para contacto, seguimiento y gestión;',
      'h) aviso a contactos de emergencia;',
      'i) enlace, canalización o gestión con proveedores terceros de servicios complementarios.',
      'La descripción comercial de planes, beneficios o alcances en publicidad, cotizaciones, sitio web, materiales promocionales, presentaciones, mensajes comerciales o conversaciones de venta deberá interpretarse siempre de forma consistente con estos Términos y Condiciones y bajo el entendido de que Sensu presta tecnología e intermediación, no la totalidad material de los servicios finales.',
    ],
  },
  {
    title: '7. Cobertura',
    paragraphs: [
      'Sensu opera en la República Mexicana. No obstante, el Cliente reconoce y acepta que la operación efectiva del servicio depende de factores variables, incluyendo:',
      'a) cobertura de red celular;',
      'b) disponibilidad de señal GPS;',
      'c) acceso a internet;',
      'd) estado de carga de batería;',
      'e) ubicación geográfica;',
      'f) condiciones climáticas, geográficas o estructurales;',
      'g) disponibilidad de proveedores terceros en la zona;',
      'h) fallas eléctricas o de telecomunicaciones;',
      'i) saturación de servicios externos;',
      'j) compatibilidad técnica.',
      'En consecuencia, aunque Sensu podrá ofrecer operación a nivel nacional, no garantiza cobertura continua, uniforme, ininterrumpida, simultánea ni técnicamente idéntica en todas las zonas del país.',
    ],
  },
  {
    title: '8. Venta del dispositivo',
    paragraphs: [
      'El dispositivo forma parte del plan contratado y se vende al Cliente. La adquisición del dispositivo se entiende incluida dentro del precio anual del plan, junto con los demás componentes del servicio, salvo que se indique expresamente lo contrario.',
      'La venta del dispositivo no implica, por sí sola, la contratación perpetua del servicio ni la obligación de Sensu de mantener conectividad, monitoreo o funcionalidades posteriores al vencimiento del plazo contratado, salvo renovación o nueva contratación.',
      'Sensu podrá vincular técnicamente el dispositivo al servicio contratado, por lo que ciertas funcionalidades podrán depender de una suscripción vigente, activación correcta, compatibilidad técnica, batería suficiente y conectividad disponible.',
    ],
  },
  {
    title: '9. Vigencia y plazo',
    paragraphs: [
      'Los planes de Sensu tienen una vigencia anual de doce meses, contada a partir de la activación, entrega o fecha que Sensu indique al Cliente al momento de contratar.',
      'No existe renovación automática obligatoria. Al concluir el plazo contratado, el Cliente podrá renovar voluntariamente bajo las condiciones vigentes al momento de la renovación.',
      'Si el Cliente no renueva, Sensu podrá suspender o desactivar total o parcialmente los servicios asociados al plan vencido, incluyendo monitoreo, conectividad, aplicación, geolocalización, alertas, comunicación y acceso del call center, sin responsabilidad para Sensu. Asimismo, los datos personales del Usuario serán eliminados conforme a la política de tratamiento y eliminación de datos prevista en la cláusula 47.',
    ],
  },
  {
    title: '10. Precio, impuestos y formas de pago',
    paragraphs: [
      'El Cliente pagará el precio vigente del plan anual contratado, más el Impuesto al Valor Agregado (IVA) y cualquier otro impuesto o carga aplicable conforme a la legislación mexicana.',
      'Sensu podrá ofrecer modalidades de pago, incluyendo:',
      'a) pago anual en una sola exhibición;',
      'b) pago a meses sin intereses, cuando así se promocione expresamente;',
      'c) mecanismos para dividir el pago entre dos o tres personas, siempre que ello sea operacionalmente posible;',
      'd) Opciones de suscripciones, renta, o cualquier otro medio de pago que Sensu ponga a disposición de los usuarios.',
      'Cualquier facilidad de pago, parcialización, promoción, financiamiento comercial o división entre terceros no altera la naturaleza anual del plan contratado ni los efectos de cancelación, vigencia, limitación de reembolsos o plazo convenido.',
      'El incumplimiento de pagos podrá dar lugar a suspensión, restricción o cancelación del servicio.',
    ],
  },
  {
    title: '11. Garantía inicial y política de cancelación',
    paragraphs: [
      'Sensu otorga al Cliente una garantía comercial de un mes, contada a partir de la activación o entrega del servicio, según corresponda.',
      'Dentro de dicho periodo, el Cliente podrá reportar inconformidades, fallas relevantes, defectos operativos iniciales o situaciones cubiertas por la garantía, y Sensu podrá, a su elección razonable y según la naturaleza del caso:',
      'a) corregir la falla;',
      'b) reemplazar el dispositivo;',
      'c) ajustar la configuración;',
      'd) brindar soporte;',
      'e) aceptar la cancelación bajo los criterios internos aplicables.',
      'Transcurrido el primer mes de garantía, el Cliente reconoce y acepta que:',
      'a) el plan continúa vigente por el plazo anual contratado;',
      'b) la cancelación anticipada no genera derecho a reembolso total ni parcial;',
      'c) Sensu no estará obligada a devolver cantidades pagadas, salvo disposición legal imperativa en contrario.',
    ],
  },
  {
    title: '12. Requisitos de uso',
    paragraphs: [
      'Para la correcta operación del servicio, el Cliente y el Usuario deberán:',
      'a) proporcionar información veraz, completa y actualizada;',
      'b) usar el dispositivo conforme a instrucciones;',
      'c) mantenerlo cargado, encendido y en condiciones funcionales;',
      'd) evitar manipulación indebida, desarme, alteración o intervención no autorizada;',
      'e) mantener actualizada la información de contactos de emergencia;',
      'f) verificar periódicamente el funcionamiento básico;',
      'g) revisar que la aplicación y el teléfono compatible funcionen correctamente, cuando aplique;',
      'h) informar a Sensu cualquier cambio relevante.',
      'El Cliente reconoce que el uso incorrecto, descuidado, incompleto o distinto al previsto puede afectar materialmente la capacidad de funcionamiento, detección, comunicación, monitoreo o reacción.',
    ],
  },
  {
    title: '13. Información del Usuario y datos proporcionados',
    paragraphs: [
      'Para la operación del servicio, Sensu podrá recabar, tratar o utilizar, directamente o a través de sus encargados, datos como:',
      'a) nombre del Cliente;',
      'b) nombre del Usuario;',
      'c) dirección;',
      'd) teléfonos;',
      'e) contactos de emergencia;',
      'f) información de servicios contratados externamente, como ambulancias o pólizas;',
      'g) información operativa necesaria para atender eventos;',
      'h) geolocalización en tiempo real;',
      'i) información médica relevante solo cuando el Cliente o Usuario la proporcione expresamente.',
      'Sensu no solicita de manera obligatoria datos de salud, pero el Cliente reconoce que podrá capturarlos voluntariamente cuando considere que ello puede facilitar la atención del Usuario.',
    ],
  },
  {
    title: '14. Geolocalización y autorización de uso compartido',
    paragraphs: [
      'Al aceptar estos Términos y Condiciones, el Cliente y, en su caso, el Usuario autorizan expresamente a Sensu a:',
      'a) activar y utilizar funciones de geolocalización;',
      'b) acceder a la ubicación del dispositivo en tiempo real o durante la operación del evento;',
      'c) mostrar o transmitir dicha ubicación en la aplicación correspondiente;',
      'd) compartir la ubicación e información operativa relevante con contactos de emergencia, familiares con acceso autorizado a la app, operadores del call center y terceros que deban intervenir para la gestión del evento.',
      'El Cliente declara que cuenta con consentimiento suficiente del Usuario para esta finalidad cuando el Cliente y el Usuario no sean la misma persona.',
      'El Cliente reconoce que la geolocalización puede ser inexacta, aproximada, intermitente, retardada o incompleta, y que ello depende de factores técnicos y externos no controlados por Sensu.',
    ],
  },
  {
    title: '15. Usuarios menores de edad y personas vulnerables',
    paragraphs: [
      'Cuando el Usuario sea menor de edad, adulto mayor, persona con discapacidad, con deterioro cognitivo, con necesidades especiales o en situación de vulnerabilidad, el Cliente declara bajo su responsabilidad que cuenta con facultades o autorización suficiente para contratar el servicio y proporcionar la información necesaria.',
      'Sensu no asume funciones de patria potestad, tutela, curatela, cuidado presencial, supervisión permanente, custodia ni vigilancia física directa.',
      'El servicio no sustituye la obligación de padres, tutores, familiares, cuidadores o responsables de mantener el nivel de atención personal, médica, educativa, doméstica o de supervisión que corresponda al Usuario.',
    ],
  },
  {
    title: '16. Familiares y accesos a la aplicación',
    paragraphs: [
      'Cuando Sensu permita acceso a la aplicación por familiares o personas relacionadas con el Usuario, dicho acceso será meramente funcional e informativo, limitado a las capacidades tecnológicas disponibles.',
      'Los familiares no adquieren, por ese solo hecho, calidad de administradores, contratantes, copropietarios del servicio ni representantes legales del Usuario, salvo que ello conste de manera expresa.',
      'El Cliente será responsable de definir y mantener actualizada la lista de personas con acceso autorizado.',
    ],
  },
  {
    title: '17. Contactos de emergencia',
    paragraphs: [
      'El Cliente será responsable de registrar contactos de emergencia reales, localizables, actualizados y previamente informados de su designación.',
      'Sensu podrá intentar contactar a tales personas cuando reciba un evento o cuando operativamente lo considere conveniente. Sin embargo, Sensu no garantiza que los contactos respondan, atiendan, puedan acudir o actúen de manera oportuna o adecuada.',
      'La falta de respuesta, disponibilidad o actuación de los contactos de emergencia no generará responsabilidad para Sensu.',
    ],
  },
  {
    title: '18. Asistencias y servicios de terceros',
    paragraphs: [
      'Sensu podrá, a través del call center o mecanismos asociados, canalizar, enlazar, coordinar, solicitar o intentar gestionar la intervención de terceros prestadores, incluyendo servicios de ambulancia, médicos, aseguradoras, auxilio vial, asistencia en el hogar, funerarias u otros.',
      'El Cliente reconoce que:',
      'a) dichos servicios son prestados por terceros independientes;',
      'b) la disponibilidad de los mismos depende de cobertura, horarios, capacidad instalada, aceptación del caso, ubicación y demás condiciones del tercero;',
      'c) los tiempos de respuesta no dependen exclusivamente de Sensu;',
      'd) Sensu no controla de manera absoluta la calidad, suficiencia, tiempo, resultado, costo, aprobación ni ejecución material del servicio de terceros;',
      'e) pueden existir requisitos, restricciones, exclusiones, cobros adicionales o validaciones propias de cada tercero.',
      'En consecuencia, Sensu no será responsable por actos, omisiones, negligencia, retrasos, cancelaciones, negativas, diagnósticos, tratamientos, cobros, calidad, cobertura, disponibilidad o resultados de los servicios proporcionados por terceros.',
    ],
  },
  {
    title: '19. No prestación de servicios médicos o de emergencia directa',
    paragraphs: [
      'Sensu no presta directamente servicios médicos, hospitalarios, paramédicos, de ambulancia, terapéuticos, psicológicos, odontológicos, funerarios, policiales, de protección civil o rescate.',
      'Cualquier referencia a asistencia médica, ambulancia, apoyo psicológico, asistencia vial, hogar u otros servicios deberá interpretarse como servicios de terceros canalizados o gestionados por intermediación, cuando estén disponibles y procedan conforme al plan y condiciones aplicables.',
      'El Cliente y el Usuario reconocen que en caso de urgencia médica grave, riesgo vital, delito flagrante, incendio, desastre u otra contingencia severa, deberán, además de usar Sensu si lo estiman conveniente, acudir directamente a los servicios públicos o privados de emergencia disponibles, y no depender exclusivamente del sistema Sensu.',
    ],
  },
  {
    title: '20. Detección de caídas, eventos y alertas',
    paragraphs: [
      'Las funcionalidades de detección de caídas, geocercas, alertas SOS, batería baja, rastreo, notificaciones, comunicación bidireccional y demás funciones tecnológicas se proporcionan bajo un criterio de mejor esfuerzo razonable, sujeto a limitaciones inherentes a la tecnología.',
      'El Cliente reconoce expresamente que:',
      'a) puede haber falsos positivos;',
      'b) puede haber falsos negativos;',
      'c) un evento real puede no ser detectado;',
      'd) una alerta puede activarse por error;',
      'e) una señal puede llegar tarde, incompleta o no llegar;',
      'f) el usuario puede no contestar;',
      'g) el equipo puede no funcionar si está sin batería, apagado, fuera de cobertura, dañado o mal utilizado.',
      'En consecuencia, Sensu no garantiza la detección infalible, continua o exacta de emergencias, caídas o incidencias.',
    ],
  },
  {
    title: '21. Disponibilidad del servicio',
    paragraphs: [
      'Sensu hará esfuerzos comercialmente razonables para mantener la operación de sus servicios; sin embargo, no garantiza disponibilidad absoluta ni funcionamiento ininterrumpido.',
      'El servicio puede verse afectado por:',
      'a) mantenimiento preventivo o correctivo;',
      'b) actualizaciones;',
      'c) fallas de telecomunicaciones;',
      'd) fallas de energía;',
      'e) actos de autoridad;',
      'f) sabotaje, ciberincidentes o ataques;',
      'g) saturación de redes;',
      'h) problemas del fabricante;',
      'i) defectos de terceros;',
      'j) caso fortuito o fuerza mayor.',
      'La mera existencia de monitoreo 24/7 no constituye garantía de recepción, procesamiento o resolución exitosa e inmediata de todos los eventos en todo momento.',
    ],
  },
  {
    title: '22. Obligaciones del Cliente y del Usuario',
    paragraphs: [
      'El Cliente y, en su caso, el Usuario se obligan a:',
      'a) proporcionar datos ciertos y actualizados;',
      'b) no usar el servicio para fines ilícitos, fraudulentos o abusivos;',
      'c) no activar alarmas intencionalmente sin causa legítima;',
      'd) no manipular ni alterar el dispositivo o software;',
      'e) leer y seguir recomendaciones de uso;',
      'f) conservar contraseñas y accesos de forma segura;',
      'g) informar pérdida, robo o daño del equipo;',
      'h) mantener disponibilidad básica del equipo y medios asociados;',
      'i) asumir que el servicio es de apoyo y no un sustituto de atención personal o médica.',
    ],
  },
  {
    title: '23. Uso indebido',
    paragraphs: [
      'Sensu podrá suspender, limitar o cancelar el servicio cuando detecte:',
      'a) uso fraudulento;',
      'b) simulación de emergencias;',
      'c) hostigamiento al personal del call center;',
      'd) uso contrario a la ley;',
      'e) reventa no autorizada;',
      'f) alteración técnica del dispositivo;',
      'g) suplantación de identidad;',
      'h) falsedad en la información proporcionada.',
      'Lo anterior podrá realizarse sin perjuicio de las acciones legales correspondientes.',
    ],
  },
  {
    title: '24. Garantías y exclusión de garantías no expresas',
    paragraphs: [
      'Salvo por las garantías expresamente otorgadas en estos Términos y Condiciones o las que resulten irrenunciables conforme a la legislación aplicable, Sensu no otorga garantías adicionales, expresas ni implícitas, respecto de:',
      'a) comerciabilidad para fines distintos a los previstos;',
      'b) idoneidad para necesidades particulares del Cliente;',
      'c) disponibilidad ininterrumpida;',
      'd) precisión absoluta de geolocalización;',
      'e) detección total de eventos;',
      'f) compatibilidad universal con cualquier entorno;',
      'g) ausencia total de errores;',
      'h) tiempos exactos de atención o llegada de terceros;',
      'i) resultado específico ante una emergencia o incidente.',
    ],
  },
  {
    title: '25. Limitación máxima de responsabilidad',
    paragraphs: [
      'En la máxima medida permitida por la legislación mexicana aplicable, el Cliente reconoce y acepta que Sensu no será responsable por daños directos, indirectos, incidentales, especiales, emergentes, consecuenciales, morales, punitivos, lucro cesante, pérdida de oportunidad, pérdida de ingresos, pérdida de datos, afectaciones personales, daños a terceros, agravamiento de condiciones, lesiones, fallecimiento, daños materiales o cualquier otra consecuencia derivada total o parcialmente de:',
      'a) fallas tecnológicas;',
      'b) falta o pérdida de cobertura;',
      'c) falta de batería;',
      'd) inexactitud de GPS;',
      'e) fallas de internet o telecomunicaciones;',
      'f) retrasos en alertas;',
      'g) no detección de caídas o eventos;',
      'h) falsas alarmas;',
      'i) indisponibilidad temporal del sistema;',
      'j) errores u omisiones en información proporcionada por el Cliente;',
      'k) imposibilidad de contactar al Usuario o a sus contactos;',
      'l) actos u omisiones de terceros;',
      'm) tiempos de respuesta de ambulancias, médicos, autoridades, aseguradoras o cualquier prestador externo;',
      'n) decisiones tomadas por el Usuario, sus familiares, cuidadores o terceros;',
      'o) uso indebido o incorrecto del dispositivo;',
      'p) cancelación, expiración o falta de renovación del plan;',
      'q) caso fortuito o fuerza mayor.',
      'Sin perjuicio de lo anterior, y solo en la medida en que una autoridad competente determine de manera definitiva que Sensu sí es legalmente responsable por un incumplimiento directamente imputable a ésta y no excluible por ley, la responsabilidad total acumulada de Sensu quedará limitada, como máximo, a la cantidad efectivamente pagada por el Cliente a Sensu por el plan específico correspondiente en los doce meses inmediatos anteriores al hecho reclamado.',
      'En ningún caso Sensu responderá por montos superiores a dicho límite, ni por daños atribuibles a terceros o factores ajenos a su control.',
    ],
  },
  {
    title: '26. Supuestos no renunciables',
    paragraphs: [
      'Nada de lo previsto en estos Términos y Condiciones deberá interpretarse como exclusión de responsabilidad en aquellos casos en que la legislación mexicana aplicable prohíba limitarla o eximirla.',
      'Si alguna cláusula fuese considerada inválida, excesiva, inoponible o no exigible por autoridad competente, se interpretará de la manera más cercana posible a su finalidad protectora y las demás disposiciones continuarán vigentes.',
    ],
  },
  {
    title: '27. Indemnidad a favor de Sensu',
    paragraphs: [
      'El Cliente se obliga a sacar en paz y a salvo a Sensu, sus socios, administradores, empleados, operadores, afiliadas, encargados y proveedores tecnológicos, respecto de cualquier reclamación, queja, denuncia, multa, procedimiento, daño, gasto, costo u honorario derivado de:',
      'a) información falsa, incompleta o desactualizada proporcionada por el Cliente;',
      'b) falta de consentimiento del Usuario o de terceros;',
      'c) uso indebido del dispositivo o la aplicación;',
      'd) designación de contactos sin autorización;',
      'e) uso del servicio para fines no previstos;',
      'f) reclamaciones promovidas por familiares, contactos, terceros prestadores o terceros afectados por conductas del Cliente o del Usuario.',
    ],
  },
  {
    title: '28. Fuerza mayor y caso fortuito',
    paragraphs: [
      'Sensu no será responsable por incumplimientos o retrasos causados por eventos fuera de su control razonable, incluyendo de manera enunciativa más no limitativa: fallas masivas de telecomunicaciones, interrupciones eléctricas, sismos, inundaciones, incendios, pandemias, disturbios, bloqueos, actos de autoridad, guerra, ciberataques, sabotaje, huelgas, fallas de proveedores críticos o cualquier otro evento de fuerza mayor o caso fortuito.',
    ],
  },
  {
    title: '29. Propiedad intelectual',
    paragraphs: [
      'Todos los derechos de propiedad intelectual e industrial relacionados con Sensu, su marca, plataforma, software, aplicación, diseños, bases de datos, documentación, interfaces, contenidos, manuales, procesos y materiales pertenecen a Sensu o a sus licenciantes.',
      'La contratación del servicio no transfiere al Cliente derecho alguno de propiedad intelectual, salvo el derecho limitado, no exclusivo, revocable y no transferible de uso conforme a estos Términos y Condiciones.',
    ],
  },
  {
    title: '30. Modificaciones al servicio y a los términos',
    paragraphs: [
      'Sensu podrá modificar, actualizar, mejorar, sustituir, descontinuar o ajustar características del dispositivo, la app, la plataforma, la operación del call center o los presentes Términos y Condiciones, siempre que ello no contravenga derechos irrenunciables del consumidor.',
      'Las modificaciones serán informadas por medios razonables, incluyendo sitio web, app, correo, mensaje o medios digitales. El uso continuado posterior a la notificación constituirá aceptación de los cambios, salvo que la ley disponga otra cosa.',
    ],
  },
  {
    title: '31. Soporte',
    paragraphs: [
      'Sensu podrá ofrecer soporte técnico, operativo o comercial por los canales que determine. El soporte se limita a aspectos relacionados con la solución tecnológica y la operación general del servicio, no a la atención material de servicios prestados por terceros.',
    ],
  },
  {
    title: '32. Privacidad y tratamiento de datos',
    paragraphs: [
      'El tratamiento de datos personales se sujetará al Aviso de Privacidad de Sensu y a la legislación mexicana aplicable.',
      'Sin perjuicio de lo anterior, el Cliente reconoce que la operación misma del servicio requiere el tratamiento de ciertos datos personales y la comunicación de información operativa a personal de call center, contactos de emergencia y terceros que deban intervenir en la gestión del evento.',
    ],
  },
  {
    title: '33. Comunicaciones y notificaciones',
    paragraphs: [
      'El Cliente autoriza a Sensu a realizar comunicaciones por llamada, SMS, correo electrónico, notificaciones push, mensajería instantánea u otros medios relacionados con:',
      'a) activación del servicio;',
      'b) eventos o alertas;',
      'c) soporte;',
      'd) cobranza;',
      'e) renovaciones;',
      'f) modificaciones operativas;',
      'g) información relevante del plan.',
    ],
  },
  {
    title: '34. Cesión',
    paragraphs: [
      'El Cliente no podrá ceder sus derechos u obligaciones derivados de estos Términos y Condiciones sin autorización previa y por escrito de Sensu.',
      'Sensu podrá ceder o transferir, total o parcialmente, sus derechos u obligaciones a sociedades afiliadas, causahabientes, adquirentes, fusionantes, subsidiarias, proveedores estratégicos o terceros relacionados con la operación del negocio, respetando la legislación aplicable.',
    ],
  },
  {
    title: '35. Integridad contractual',
    paragraphs: [
      'Estos Términos y Condiciones constituyen el acuerdo íntegro entre el Cliente y Sensu respecto del objeto aquí previsto, y sustituyen cualesquiera entendimientos previos verbales o escritos sobre la misma materia, salvo que exista contrato adicional firmado expresamente.',
    ],
  },
  {
    title: '36. Divisibilidad',
    paragraphs: [
      'Si cualquier disposición de estos Términos y Condiciones es declarada nula, inválida o inexigible, las demás disposiciones permanecerán en pleno vigor y efecto.',
    ],
  },
  {
    title: '37. No renuncia',
    paragraphs: [
      'La falta de ejercicio por parte de Sensu de algún derecho previsto en estos Términos y Condiciones no se interpretará como renuncia al mismo.',
    ],
  },
  {
    title: '38. Legislación aplicable y jurisdicción',
    paragraphs: [
      'Estos Términos y Condiciones se regirán por las leyes federales y, en lo aplicable, por la legislación vigente en los Estados Unidos Mexicanos.',
      'Para la interpretación, cumplimiento y resolución de controversias, las partes se someten a las autoridades competentes del domicilio del consumidor conforme a la legislación aplicable, sin perjuicio de los mecanismos conciliatorios o administrativos legalmente procedentes.',
    ],
  },
  {
    title: '39. Declaraciones finales del Cliente',
    paragraphs: [
      'El Cliente declara y reconoce expresamente que:',
      'a) ha leído íntegramente estos Términos y Condiciones;',
      'b) comprende que Sensu es un proveedor tecnológico e intermediario de asistencias;',
      'c) comprende que los servicios de terceros no son prestados directamente por Sensu;',
      'd) entiende que la tecnología puede fallar o no detectar todos los eventos;',
      'e) entiende que la geolocalización y las alertas pueden ser imprecisas o tardías;',
      'f) entiende que Sensu no sustituye al 911, a los servicios médicos, a cuidadores, familiares o autoridades;',
      'g) acepta compartir la ubicación del Usuario conforme a estos Términos;',
      'h) acepta la vigencia anual, la ausencia de renovación forzosa, la política de cancelación y no reembolso posterior al primer mes, la garantía de precio en renovación y el proceso de baja previstos en estos Términos, salvo disposición legal imperativa;',
      'i) acepta las limitaciones y exclusiones de responsabilidad aquí previstas en la máxima medida permitida por la ley.',
    ],
  },
  {
    title: '40. Garantía legal del dispositivo',
    paragraphs: [
      'Sin perjuicio de la garantía comercial de un mes prevista en la cláusula 11, el dispositivo físico comercializado por Sensu goza de la garantía legal mínima de doce meses que establece el artículo 77 de la Ley Federal de Protección al Consumidor (LFPC), contada a partir de la fecha de entrega al Cliente.',
      'Durante dicho plazo, Sensu responderá por defectos de fabricación o vicios ocultos del dispositivo que impidan su uso normal, mediante alguna de las siguientes opciones a elección razonable de Sensu: (a) reparación sin costo; (b) reposición del dispositivo por uno de las mismas características; o (c) devolución del precio pagado por el dispositivo.',
      'Esta garantía legal no cubre daños derivados de uso incorrecto, maltrato, modificaciones no autorizadas, exposición a condiciones físicas o ambientales fuera de las especificaciones del fabricante, ni deterioro por uso normal.',
      'Para hacer válida esta garantía, el Cliente deberá contactar a Sensu a través de los canales indicados en la cláusula 41, describir el defecto y, en su caso, enviar el dispositivo con flete prepagado por Sensu al domicilio que ésta indique. Sensu asumirá el costo de devolución del dispositivo reparado o repuesto al Cliente.',
    ],
  },
  {
    title: '41. Proceso de baja, cancelación y no renovación',
    paragraphs: [
      'El Cliente podrá solicitar la cancelación anticipada del servicio o manifestar su decisión de no renovar a través de cualquiera de los siguientes canales oficiales de Sensu:',
      'a) directamente desde la plataforma Sensu, mediante la opción de cancelación o baja disponible en su cuenta;',
      'b) correo electrónico a: atencion@sensu.com.mx;',
      'c) WhatsApp al número +52 55 4343 0729.',
      'La solicitud de cancelación deberá incluir: nombre del Cliente, número de plan o identificador del dispositivo, y motivo de la cancelación. Sensu acusará recibo de la solicitud dentro de los tres días hábiles siguientes.',
      'La cancelación surtirá efectos al término del periodo anual contratado y vigente, salvo que aplique la garantía comercial del primer mes prevista en la cláusula 11. La no renovación no requiere justificación y puede manifestarse por los mismos canales o simplemente absteniéndose de renovar al vencimiento del plan.',
      'El Cliente reconoce que, durante la tramitación de la solicitud de cancelación, el servicio permanecerá activo y las obligaciones de pago continuarán vigentes conforme al plan contratado.',
    ],
  },
  {
    title: '42. Devolución del dispositivo',
    paragraphs: [
      'Dado que el dispositivo se vende al Cliente como parte del plan anual, éste no está obligado a devolverlo al término de la vigencia ni en caso de no renovación.',
      'Únicamente procederá la devolución del dispositivo en los siguientes supuestos: (a) ejercicio de la garantía comercial del primer mes conforme a la cláusula 11; o (b) ejercicio de la garantía legal conforme a la cláusula 40, cuando la resolución elegida implique sustitución o devolución.',
      'En los casos en que proceda devolución, Sensu proporcionará al Cliente una guía de envío prepagada para que remita el dispositivo al domicilio que Sensu indique. El dispositivo deberá entregarse en condiciones funcionales, sin daños por uso indebido y, en la medida de lo posible, con su empaque original. Sensu asumirá el costo del flete de retorno.',
      'Una vez recibido y validado el dispositivo, Sensu procederá con la resolución correspondiente (reembolso, reposición o reparación) dentro de los quince días hábiles siguientes.',
    ],
  },
  {
    title: '43. Precio garantizado en renovación',
    paragraphs: [
      'Sensu garantiza al Cliente que el precio del plan anual aplicable en la renovación será el mismo precio que pagó en su contratación original, siempre que la renovación se realice dentro de los treinta días naturales posteriores al vencimiento del plan vigente y que no haya habido una modificación de plan o cambio de modalidad solicitado por el Cliente.',
      'En caso de que el Cliente desee renovar con un plan diferente o transcurra el plazo anterior sin renovación, se aplicará el precio vigente al momento de la nueva contratación, el cual podrá diferir del precio original.',
      'Esta garantía de precio aplica exclusivamente al servicio de monitoreo y call center. Los costos asociados a servicios de terceros o asistencias adicionales contratadas por separado se regirán por las condiciones vigentes del proveedor correspondiente.',
    ],
  },
  {
    title: '44. Cambio de usuario asociado al dispositivo',
    paragraphs: [
      'El cambio de Usuario asociado al dispositivo únicamente podrá realizarse al momento de la renovación anual del plan, como parte del proceso de actualización de datos que Sensu habilita en dicho momento a través de la plataforma Sensu. No se permitirán cambios de Usuario durante la vigencia del plan activo.',
      'Para efectuar el cambio de Usuario en la renovación, el Cliente deberá acceder a la plataforma Sensu e ingresar la información actualizada del nuevo Usuario, cumpliendo con las siguientes condiciones:',
      'a) la información del nuevo Usuario sea veraz, completa y actualizada conforme a lo exigido por estos Términos y Condiciones;',
      'b) el nuevo Usuario, o quien actúa en su representación, haya otorgado su consentimiento para el uso del dispositivo, la geolocalización y el tratamiento de sus datos personales;',
      'c) el Cliente declare que cuenta con facultades suficientes para proporcionar la información del nuevo Usuario, especialmente si éste es menor de edad, adulto mayor o persona en situación de vulnerabilidad.',
      'El cambio de Usuario no implica reinicio del plazo de garantía legal del dispositivo. El Cliente es responsable de actualizar los contactos de emergencia y demás información operativa del nuevo Usuario al momento de efectuar el cambio.',
      'El Cliente asume plena responsabilidad por la información proporcionada respecto del nuevo Usuario y por cualquier consecuencia derivada de datos inexactos, desactualizados o proporcionados sin autorización.',
    ],
  },
  {
    title: '45. Pérdida, robo o daño del dispositivo',
    paragraphs: [
      'En caso de pérdida, robo o daño irreparable del dispositivo, el Cliente deberá notificarlo a Sensu de manera inmediata a través de los canales indicados en la cláusula 41.',
      'Una vez recibida la notificación, Sensu podrá proceder a la desactivación remota del dispositivo reportado, a fin de evitar el uso no autorizado de las funciones de geolocalización y comunicación asociadas.',
      'La pérdida, robo o daño no autorizado del dispositivo no generará obligación de reposición gratuita a cargo de Sensu, salvo que dicha situación esté cubierta por la garantía legal conforme a la cláusula 40. En caso de que el Cliente desee continuar con el servicio, podrá adquirir un dispositivo de reposición al precio vigente que Sensu determine para tal efecto.',
      'Mientras no se notifique la pérdida o robo, el Cliente será responsable de cualquier evento, alerta o activación generada por el dispositivo, así como de las consecuencias derivadas del uso no autorizado por terceros.',
    ],
  },
  {
    title: '46. Aviso de Privacidad',
    paragraphs: [
      'El tratamiento de datos personales por parte de Sensu se rige por su Aviso de Privacidad Integral, elaborado conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) y su Reglamento.',
      'El Aviso de Privacidad se encuentra disponible en el sitio web oficial de Sensu (www.sensu.com.mx) y en la plataforma Sensu. En caso de no haber sido publicado aún al momento de la contratación, Sensu lo pondrá a disposición del Cliente a través del correo atencion@sensu.com.mx, a más tardar al momento de la activación del servicio.',
      'El Cliente tiene derecho a ejercer sus derechos ARCO (Acceso, Rectificación, Cancelación y Oposición) mediante solicitud enviada a atencion@sensu.com.mx, adjuntando copia de identificación oficial. Sensu dará respuesta dentro del plazo legal aplicable.',
      'La aceptación de estos Términos y Condiciones implica el consentimiento del Cliente para el tratamiento de sus datos personales y los del Usuario conforme al Aviso de Privacidad vigente.',
    ],
  },
  {
    title: '47. Tratamiento y eliminación de datos al término del servicio',
    paragraphs: [
      'La protección de los datos personales del Usuario es una prioridad para Sensu. Sensu aplica una política de eliminación activa de datos con los siguientes criterios:',
      'a) Cancelación o no renovación del plan. Cuando el Cliente cancele el servicio dentro del primer mes de garantía, no renueve al término del plan anual, o solicite expresamente la baja, Sensu procederá a eliminar de forma definitiva e irreversible los datos personales del Usuario —incluyendo historial de eventos, alertas, geolocalización y datos de salud capturados voluntariamente— dentro de los treinta días naturales siguientes a la fecha efectiva de terminación del servicio. Sensu no conserva bases de datos de Usuarios inactivos. Esta práctica forma parte del compromiso de Sensu con la seguridad de la información y el principio de minimización de datos previsto en la LFPDPPP.',
      'b) Datos requeridos por ley. Excepcionalmente, Sensu conservará exclusivamente los datos que la legislación mexicana exija retener para efectos fiscales, contables o de cumplimiento normativo, únicamente por el plazo legal obligatorio y en condiciones de acceso restringido. Dichos datos quedarán aislados de los sistemas operativos activos y serán eliminados al vencimiento del plazo legal correspondiente.',
      'c) Fallecimiento del Usuario. En caso de fallecimiento del Usuario, el Cliente o, en su defecto, un familiar acreditado podrá solicitar a Sensu la eliminación anticipada de los datos personales del Usuario, mediante comunicación al correo atencion@sensu.com.mx, adjuntando copia del acta de defunción e identificación oficial del solicitante. Sensu procederá con la eliminación en el mismo plazo de treinta días naturales indicado en el inciso a), salvo por los datos cuya conservación sea legalmente obligatoria.',
      'd) Acceso al historial. El historial de eventos, alertas y geolocalización asociado a un Usuario solo podrá ser entregado a autoridades competentes mediante orden o requerimiento legal, o al propio Cliente si lo solicita expresamente antes de la eliminación y acredita interés legítimo, conforme a la LFPDPPP.',
      'e) Seguridad de la información. Sensu mantiene medidas técnicas y organizativas alineadas a estándares de seguridad de la información para garantizar la confidencialidad, integridad y disponibilidad de los datos durante su vigencia y su destrucción segura al concluir el plazo de retención.',
    ],
  },
  {
    title: '48. Contratación por empresas o personas morales (B2B)',
    paragraphs: [
      'Cuando una empresa, persona moral u organización (en adelante, "Empresa") contrate el servicio de Sensu para sus trabajadores, colaboradores, familiares de trabajadores, beneficiarios o cualquier persona física usuaria final, se entenderá que la Empresa actúa en calidad de "Cliente" para todos los efectos de estos Términos y Condiciones, y el trabajador, familiar o beneficiario como "Usuario".',
      'La posibilidad de designar como Usuario a un familiar del trabajador (cónyuge, concubino, ascendientes, descendientes u otros dependientes económicos) estará sujeta al plan contratado por la Empresa y a las condiciones operativas que Sensu determine para tal efecto. En dicho caso, la Empresa asume la misma responsabilidad que respecto de sus trabajadores directos en lo relativo a veracidad de información, consentimiento del Usuario y notificación de cambios.',
      'En dicho supuesto:',
      'a) la Empresa declara contar con las facultades legales y, en su caso, contractuales o laborales necesarias para contratar el servicio en nombre o en beneficio del Usuario, así como para proporcionar los datos personales del mismo;',
      'b) la Empresa es responsable de informar al Usuario sobre la existencia del servicio, el tratamiento de sus datos personales y las características del mismo, obteniendo su consentimiento cuando así lo exija la legislación aplicable;',
      'c) las obligaciones de pago, veracidad de información y cumplimiento de estos Términos y Condiciones recaen sobre la Empresa como Cliente;',
      'd) la Empresa reconoce que Sensu prestará el servicio directamente al Usuario conforme a estos Términos, sin que ello implique subordinación, responsabilidad laboral ni relación jurídica entre Sensu y el Usuario más allá de la propia del servicio contratado;',
      'e) en caso de terminación de la relación laboral o contractual entre la Empresa y el trabajador titular, la Empresa deberá notificarlo a Sensu para proceder con la actualización o cancelación del servicio asociado a dicho Usuario y, en su caso, a los familiares vinculados al mismo.',
      'Las condiciones económicas y operativas aplicables a contratos empresariales podrán ser objeto de un contrato marco específico celebrado por separado entre Sensu y la Empresa, el cual prevalecerá sobre estos Términos y Condiciones en lo que expresamente regule.',
    ],
  },
  {
    title: '49. Dispositivos con conectividad satelital',
    paragraphs: [
      'Sensu ofrece o podrá ofrecer en el futuro dispositivos con conectividad satelital (incluyendo, de manera enunciativa, el dispositivo Angela SPOT), diseñados para operar en zonas sin cobertura celular. Cuando el Cliente contrate o utilice un dispositivo de este tipo, reconoce expresamente las siguientes particularidades técnicas y operativas:',
      'a) la comunicación se realiza mediante mensajes de texto satelitales, por lo que no es posible establecer llamadas de voz bidireccionales a través del dispositivo;',
      'b) los tiempos de transmisión y recepción de mensajes pueden ser superiores a los de dispositivos con conectividad celular, dependiendo de las condiciones de cobertura satelital;',
      'c) el servicio satelital puede estar sujeto a planes, tarifas o suscripciones adicionales con el proveedor de red satelital correspondiente, los cuales serán informados al Cliente al momento de la contratación;',
      'd) la cobertura satelital tiene sus propias limitaciones geográficas, de obstrucción y condiciones ambientales, distintas e independientes de la cobertura celular;',
      'e) todas las demás disposiciones de estos Términos y Condiciones aplican a los dispositivos satelitales en lo que no sea incompatible con las características técnicas descritas en esta cláusula.',
      'Las características, disponibilidad y condiciones comerciales de los dispositivos con conectividad satelital estarán sujetas a la información específica proporcionada por Sensu al momento de su lanzamiento comercial.',
    ],
  },
  {
    title: '50. Servicios de asistencias a través de proveedor tercero',
    paragraphs: [
      'Determinados planes de Sensu incluyen servicios de multiasistencias prestados por un proveedor tercero especializado. Dichos servicios son coordinados por Sensu como intermediario y ejecutados materialmente por dicho proveedor a través de su Centro de Asistencia Telefónica (CAT), disponible las 24 horas del día los 365 días del año. El Cliente reconoce que estos servicios son prestados por un tercero independiente y que su disponibilidad, alcance y condiciones se rigen por las siguientes disposiciones.',
      '50.1 Paquetes de asistencias disponibles. Dependiendo del plan contratado, el Cliente podrá tener acceso a uno o más de los siguientes paquetes de asistencias, con la cobertura y condiciones que se indican:',
      'A) Paquete Emergencias. Incluye: — Atención médica telefónica o por videollamada: ilimitada, sin costo, cobertura nacional. Orientación, recomendación y seguimiento por médicos generales del CAT. Incluye elaboración de historia clínica y, de considerarlo necesario el médico, emisión de receta vía correo o WhatsApp para Usuarios mayores de edad. — Ambulancia terrestre de emergencia: 1 evento al año, sin costo hasta MXN $2,500.00 por evento, cobertura nacional al hospital más cercano y conveniente. El envío requiere valoración previa por la cabina médica del CAT.',
      'B) Paquete Asistencias. Incluye todos los servicios del Paquete Emergencias, más: — Asistencia psicológica telefónica o por videollamada: ilimitada, sin costo, cobertura nacional. — Asistencia nutricional telefónica o por videollamada: ilimitada, sin costo, cobertura nacional. Horario de atención: 9:00 a 21:00 horas los 365 días del año. — Asistencia en el hogar (cerrajería, plomería, vidríería o electricidad): 2 eventos al año en combinación, hasta MXN $600.00 por evento, cobertura nacional. — Asistencia vial (grúa o asistencia vial, paso de corriente, cambio de llanta, envío de gasolina): ilimitada, a precios preferenciales, cobertura nacional. — Club de descuentos digital: acceso para 1 afiliado, sin costo.',
      'C) Paquete Asistencias con Seguro de Accidentes Personales. Incluye todos los servicios del Paquete Asistencias, más: — Seguro de Accidentes Personales: 1 evento. Hasta $100,000 por muerte accidental y hasta $15,000 de reembolso de gastos médicos por accidente. Elegibilidad: Usuarios de hasta 70 años de edad.',
      '50.2 Solicitud del servicio de asistencias. Para acceder a los servicios de asistencias, el Usuario podrá activar la solicitud a través de cualquiera de los siguientes medios:',
      'a) Dispositivo Angela. A través del dispositivo Angela mediante cualquiera de las siguientes acciones: (i) accionando el botón SOS, lo cual generará una alerta inmediata al call center de Sensu; o (ii) presionando el botón secundario de llamada, con el cual el Usuario podrá comunicarse directamente con un operador del call center para solicitar ayuda o cualquiera de las asistencias disponibles en su plan.',
      'b) Plataforma Sensu o aplicación móvil. Mediante la funcionalidad de solicitud de asistencia disponible en la plataforma Sensu o en la aplicación móvil, según las opciones habilitadas en el plan contratado.',
      'Una vez recibida la solicitud por cualquiera de los medios anteriores, el call center de Sensu validará la vigencia de la afiliación del Usuario en la base de datos activa del plan y, en coordinación con el proveedor de asistencias, gestionará la atención correspondiente conforme al tipo de servicio solicitado y a las condiciones del paquete contratado.',
      'Sensu proporcionará la información del Usuario al proveedor de asistencias conforme a los procesos operativos acordados entre las partes, a fin de garantizar una atención eficiente y personalizada.',
      '50.3 Consideraciones generales de las asistencias:',
      'a) Los servicios de asistencias están disponibles exclusivamente para Usuarios registrados en el plan activo y vigente. El proveedor podrá solicitar documentos oficiales para validar la identidad del Usuario o el parentesco con el titular, cuando corresponda.',
      'b) La atención médica a menores de edad se brindará únicamente en presencia y acompañamiento del padre, madre o tutor durante toda la consulta.',
      'c) Las consultas médicas, psicológicas y nutricionales se realizan exclusivamente por llamada telefónica o videollamada. No se brindan por mensajes de texto, WhatsApp ni correo electrónico, ni incluyen el costo de medicamentos ni el envío de especialistas a domicilio.',
      'd) El Usuario es responsable de la veracidad y exactitud de la información clínica y personal que proporcione al especialista del CAT. El proveedor no será responsable por omisiones u inexactitudes del Usuario.',
      'e) Cualquier servicio adicional a los incluidos en el paquete contratado será negociado y contratado directamente entre el Usuario y los proveedores de la red, sin responsabilidad de pago por parte de Sensu ni del proveedor de asistencias.',
      'f) El proveedor de asistencias no será responsable de los servicios coordinados con proveedores ajenos a su red.',
      'g) Las asistencias no estarán disponibles en los siguientes supuestos: (i) el Usuario no se encuentre en la base de datos activa por causas atribuibles a Sensu o al Cliente; (ii) el Usuario haya contratado el servicio de asistencias por cuenta propia directamente con el proveedor; (iii) exista atraso en el pago del plan que active la suspensión del servicio.',
      'h) El envío de ambulancia está sujeto a valoración previa por la cabina médica del CAT conforme al código de urgencia detectado (Rojo: emergencia con riesgo vital; Amarillo: urgencia sin riesgo vital inmediato; Verde: caso no urgente). No incluye traslados por COVID-19 ni situaciones que no constituyan emergencia o urgencia médica.',
      '50.4 Responsabilidad sobre las asistencias. Los servicios de asistencias descritos en esta cláusula son prestados por un tercero independiente. Sensu actúa exclusivamente como intermediario de coordinación y canalización. En consecuencia, y conforme a lo previsto en la cláusula 18 de estos Términos:',
      'a) Sensu no es responsable de la calidad, oportunidad, suficiencia, resultado o disponibilidad de los servicios de asistencias;',
      'b) el proveedor de asistencias no asumirá responsabilidad por las acciones u omisiones del Usuario en cuanto al seguimiento de las recomendaciones brindadas, ni por afectaciones derivadas de información incompleta o inexacta proporcionada por el Usuario;',
      'c) la relación jurídica derivada de la prestación de los servicios de asistencias se establece entre el proveedor y el Usuario; Sensu no forma parte de dicha relación en lo que respecta a la ejecución material del servicio.',
    ],
  },
];

const ACCEPTANCE_LINE =
  'Declaro que leí y acepto los Términos y Condiciones de Sensu. Entiendo que Sensu presta servicios de tecnología, monitoreo, call center e intermediación de asistencias, y que los servicios médicos, ambulancias, asistencias y demás apoyos materiales son prestados por terceros. Autorizo el tratamiento de mis datos y, en su caso, la geolocalización y compartición de ubicación del usuario conforme a los Términos y Condiciones y al Aviso de Privacidad aplicable.';

export default function TermsPage() {
  return (
    <main
      data-testid="terms-page"
      className="flex flex-1 flex-col items-center px-6 py-12"
    >
      <article className="w-full max-w-3xl text-sm leading-relaxed text-zinc-700">
        <header>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
            Términos y Condiciones
          </h1>
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
            {VERSION} · Última actualización: {LAST_UPDATED}
          </p>
        </header>

        <p className="mt-8 italic text-zinc-500">
          Términos y Condiciones Generales de Uso, Contratación y Prestación de
          Servicios de Sensu — ESTELA SYSTEMS, S. DE R.L. DE C.V.
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

        <footer className="mt-12 rounded-3xl bg-sensu-50/60 p-6 text-sm text-zinc-700 ring-1 ring-sensu-100">
          {ACCEPTANCE_LINE}
        </footer>
      </article>
    </main>
  );
}
