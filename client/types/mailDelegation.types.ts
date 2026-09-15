// ─── Requests ────────────────────────────────────────────────────────────────

export interface AddMailRequest {
  email: string;
}

export interface ImportAccountsRequest {
  adsIds: string[];
}

export interface DelegationCallbackRequest {
  code: string;
  state: string;
}

// ─── Responses ───────────────────────────────────────────────────────────────

export interface MailResponse {
  id: string;
  email: string;
  userId: string;
  createdAt: string;
  isDelegated: boolean;
  expiresIn: string | null;
  accounts: AdsAccountResponse[];
}

export interface MailListResponse {
  total: number;
  items: MailResponse[];
}

export interface SendAuthResponse {
  message: string;
  expiresAt: string;
  authUrl: string | null;
}

export interface AccountNode {
  adsId: string;
  adsName: string;
  adsStatus: string | null;
  currencyCode: string | null;
  timezone: string | null;
  isManager: boolean;
  managerAccountAdsId: string;
  isAlreadyInDatabase: boolean;
  subAccounts: AccountNode[];
}

export interface CallbackResponse {
  message: string;
  mailId: string;
  accounts: AccountNode[];
  unaccessibleIds: string[];
}

export interface AdsAccountResponse {
  id: string;
  mailId: string;
  adsId: string;
  adsName: string;
  adsStatus: string | null;
  accountType: string | null;
  managerAccountAdsId: string | null;
  currencyCode: string | null;
  timezone: string | null;
  budgetPaid: number | null;
  budgetUsed: number | null;
  budgetAdjustment: number | null;
  createdAt: string;
}

export interface AdsAccountListResponse {
  total: number;
  items: AdsAccountResponse[];
}

export interface ImportAccountsResponse {
  message: string;
  imported: number;
  accounts: AdsAccountResponse[];
}
