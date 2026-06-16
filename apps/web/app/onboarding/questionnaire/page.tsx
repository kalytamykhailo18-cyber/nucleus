import { redirect } from 'next/navigation';
import { LuShield } from 'react-icons/lu';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { fetchPlanByType, formatPriceMXN, type PlanType } from '@/lib/plans';
import { QuestionnaireForm } from './questionnaire-form';

/**
 * Senior questionnaire — post-payment activation step.
 *
 * Reached after Stripe success on /checkout. Visitors who try to come
 * here directly without paying are bounced to /login. Visitors who have
 * already completed the questionnaire are bounced to /dashboard so we
 * don't double-collect.
 *
 * The buyer's phone (from /checkout) is passed into the form as the
 * default first emergency contact, so they don't re-type a number we
 * already have.
 */
export const dynamic = 'force-dynamic';

export default async function QuestionnairePage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login?next=%2Fonboarding%2Fquestionnaire');
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      questionnaireCompleted: true,
      phone: true,
      fullName: true,
      subscriptions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          status: true,
          plan: { select: { type: true } },
        },
      },
    },
  });

  if (!me) redirect('/login');
  if (me.questionnaireCompleted) redirect('/dashboard');

  // Payment status gate: this page is the *post-payment* activation
  // step. A user who created an account but abandoned checkout sits at
  // PENDING_PAYMENT — they have not paid, so showing them "Ya pagaste"
  // copy is a lie. Send them back to /checkout, which detects authed
  // PENDING users and resumes the Stripe flow.
  const latestSub = me.subscriptions[0];
  if (!latestSub) redirect('/dashboard');
  if (latestSub.status !== 'ACTIVE') redirect('/checkout');

  const planType = latestSub.plan.type as PlanType | undefined;
  const plan = planType ? await fetchPlanByType(planType) : null;

  return (
    <main className="flex flex-1 flex-col items-center px-6 pt-12 pb-12">
      <div className="w-full max-w-2xl">
        <header className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            Activa tu Angela
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-600 sm:text-base">
            Ya pagaste — un paso más. Esta información es la que verá el
            call-center cuando tu familiar pida ayuda. Mientras más completa,
            mejor.
          </p>
        </header>

        {plan && (
          <div
            data-testid="onboarding-plan-recap"
            className="card-surface mt-8 flex items-center justify-between rounded-3xl px-6 py-5"
          >
            <div>
              <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                <LuShield
                  aria-hidden
                  className={`h-4 w-4 ${plan.includesAura ? 'text-violet-500' : 'text-emerald-500'}`}
                />
                <span>{plan.name}</span>
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Pago confirmado. Tu primer mes ya está cubierto.
              </p>
            </div>
            <p className="text-xl font-semibold tracking-tight text-zinc-900 tabular-nums">
              {formatPriceMXN(plan.monthlyPriceCents)}
              <span className="ml-1.5 align-middle text-[10px] font-medium tracking-normal text-zinc-500">
                + IVA
              </span>
            </p>
          </div>
        )}

        <QuestionnaireForm
          buyerPhone={me.phone ?? ''}
          buyerFullName={me.fullName ?? ''}
        />
      </div>
    </main>
  );
}
