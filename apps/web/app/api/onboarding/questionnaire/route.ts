import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email-transport';

/**
 * Senior questionnaire submission — the post-payment step that collects
 * the data the call-center actually needs to dispatch on an SOS: who the
 * senior is, where they live, what medical context applies, and who to
 * call first.
 *
 * Auth-gated. The signed-in user is the buyer (the daughter or son who
 * paid). The fields below describe the SENIOR (the device-wearer); the
 * buyer's email + password live on the same User row but are unrelated
 * to this submission.
 *
 * Sets questionnaireCompleted=true on success so the dashboard gate
 * stops bouncing the user back here on next login.
 */
export const dynamic = 'force-dynamic';

const contactSchema = z.object({
  fullName: z.string().min(1).max(120),
  phone: z.string().min(1).max(40),
  relationship: z.string().min(1).max(60),
});

// Mexican CURP: 4 letters + 6 digits (YYMMDD) + H|M + 5 letters
// + 1 alphanumeric (homonym) + 1 digit (check). 18 chars total. Validated
// server-side so the column never holds a malformed value.
const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;

const schema = z
  .object({
    fullName: z.string().min(1).max(255),
    dateOfBirth: z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
      message: 'Invalid date',
    }),
    gender: z.enum(['MUJER', 'HOMBRE', 'OTRO']),
    curp: z
      .string()
      .transform((s) => s.trim().toUpperCase())
      .refine((s) => CURP_REGEX.test(s), { message: 'CURP inválida' }),
    rfcHomoclave: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{3}$/, 'Homoclave debe ser 3 caracteres alfanuméricos')
      .nullable()
      .optional(),
    userPhone: z.string().max(40).nullable().optional(),
    address: z.string().min(1).max(500),
    shippingAddress: z.string().min(1).max(500).optional(),
    housingType: z.enum(['CASA', 'DEPARTAMENTO', 'CONDOMINIO']),
    livesAlone: z.boolean().optional().default(false),
    medicalConditions: z.string().max(2000).nullable().optional(),
    insuranceInfo: z.string().max(500).nullable().optional(),
    checkInEnabled: z.boolean().optional().default(false),
    checkInDay: z
      .enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'])
      .nullable()
      .optional(),
    checkInTimeOfDay: z
      .enum(['MORNING', 'EVENING'])
      .nullable()
      .optional(),
    contacts: z.array(contactSchema).min(1).max(5),
  })
  .superRefine((data, ctx) => {
    if (data.checkInEnabled) {
      if (!data.checkInDay) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'El día de la llamada es obligatorio cuando el check-in está activo.',
          path: ['checkInDay'],
        });
      }
      if (!data.checkInTimeOfDay) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'La hora de la llamada es obligatoria cuando el check-in está activo.',
          path: ['checkInTimeOfDay'],
        });
      }
      if (!data.userPhone || data.userPhone.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'El teléfono del usuario es obligatorio cuando el check-in está activo.',
          path: ['userPhone'],
        });
      }
    }
  });

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const userId = session.user.id;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        message: parsed.error.issues[0]?.message ?? 'Invalid input',
      },
      { status: 422 },
    );
  }

  const data = parsed.data;
  const dob = new Date(data.dateOfBirth);
  const now = new Date();
  const age = Math.floor(
    (now.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25),
  );

  // Defense-in-depth: after Zod the curp is guaranteed non-empty and
  // regex-valid, but Juan reported a 2026-06-08 case (Pablo's test
  // signup) where the DB row had curp NULL after a 'completed'
  // questionnaire. The validation path here could not have produced
  // that outcome on its own; we log every submission's curp shape so
  // the next incident has enough trace to diagnose, and we throw
  // before the prisma update if the invariant breaks for any reason.
  if (!data.curp || data.curp.length !== 18) {
    console.error('[questionnaire] curp invariant broken after Zod', {
      userId,
      curpLength: data.curp?.length ?? null,
      rawCurp: typeof data.curp,
    });
    return NextResponse.json(
      { error: 'CURP inválida' },
      { status: 422 },
    );
  }
  console.info('[questionnaire] submit ok', {
    userId,
    curpLength: data.curp.length,
    contacts: data.contacts.length,
  });

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        fullName: data.fullName,
        dateOfBirth: dob,
        age,
        gender: data.gender,
        curp: data.curp,
        rfcHomoclave: data.rfcHomoclave ?? null,
        userPhone: data.userPhone ?? null,
        address: data.address,
        shippingAddress: data.shippingAddress ?? data.address,
        housingType: data.housingType,
        livesAlone: data.livesAlone ?? false,
        medicalConditions: data.medicalConditions ?? null,
        insuranceInfo: data.insuranceInfo ?? null,
        checkInEnabled: data.checkInEnabled ?? false,
        checkInDay: data.checkInEnabled ? data.checkInDay ?? null : null,
        checkInTimeOfDay: data.checkInEnabled
          ? data.checkInTimeOfDay ?? null
          : null,
        questionnaireCompleted: true,
      },
    });

    // Wipe and re-create emergency contacts. The questionnaire is the
    // single source of truth for the initial roster; future edits go
    // through the profile page which manages contacts incrementally.
    await tx.emergencyContact.deleteMany({ where: { userId } });
    await tx.emergencyContact.createMany({
      data: data.contacts.map((c, i) => ({
        userId,
        fullName: c.fullName,
        phone: c.phone,
        relationship: c.relationship,
        priority: i,
      })),
    });
  });

  // Welcome email — fire-and-forget so a transient Resend hiccup never
  // blocks the user from reaching /dashboard. The Resend transport already
  // logs and swallows its own errors; if RESEND_API_KEY is unset the call
  // is a no-op (with an info log) and the test outbox still gets the row
  // when E2E hooks are active.
  if (session.user.email) {
    void sendEmail({
      to: session.user.email,
      subject: 'Tu Angela está en camino',
      text: [
        `Hola,`,
        '',
        `Tu cuenta para ${data.fullName} ya está activa.`,
        '',
        '¿Qué pasa ahora?',
        '',
        '  1. En las próximas 48 horas recibirás llamada del call-center para confirmar la dirección y la fecha de entrega de la Angela.',
        '  2. Cuando llegue, el call-center la activará a nombre de tu familiar en pocos minutos.',
        '  3. Tu panel familiar muestra la ubicación y las alertas en tiempo real desde el momento que se active.',
        '',
        'Si tu familiar pide ayuda, llamamos a los contactos de emergencia que registraste y escalamos con servicios médicos cuando sea necesario.',
        '',
        'Cualquier duda, responde este correo o escríbenos.',
        '',
        '— Sensu',
      ].join('\n'),
    });
  }

  return NextResponse.json({ ok: true });
}
