import { type ContractTerms } from 'src/types/contract-terms';

export type ContractDraft = Pick<ContractTerms, 'status' | 'auto_renew'> & {
  [Field in Exclude<keyof ContractTerms, 'status' | 'auto_renew'>]: string;
};
