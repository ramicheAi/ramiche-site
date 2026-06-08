import FinanceHQ from '@/components/command-center/po/FinanceHQ';

/* Finance HQ — Parallax OS showpiece (#5). The instrument-grade reskin lives in
 * the FinanceHQ component; it seeds its live MRR/ARR + transaction stream from
 * the real `/api/command-center/stripe-revenue` endpoint when Stripe is live. */
export default function FinancePage() {
  return <FinanceHQ />;
}
