export type ContractTerms = {
  status: 'draft' | 'active';
  counterparty_name: string | null;
  value: number | null;
  currency: string | null;
  start_date: string | null;
  end_date: string | null;
  auto_renew: boolean;
  renewal_term_months: number | null;
  notice_period_days: number | null;
};
