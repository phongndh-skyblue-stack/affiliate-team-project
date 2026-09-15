export interface TelegramConfigResponse {
  botUsername: string;
  enabled: boolean;
}

export interface TelegramVerificationCodeResponse {
  code: string;
  command: string;
  instruction: string;
  expiresInMinutes: number;
  expiresAt: string;
}

export interface TelegramSubscription {
  id: string;
  chatId: number;
  topics: string[];
  scheduledSearchNotificationsEnabled: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
