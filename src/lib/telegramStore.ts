export type TelegramTokenRecord = {
  userId: string;
  expiresAt: number;
};

export type TelegramLinkRecord = {
  userId: string;
  chatId: string;
  connectedAt: number;
};

const telegramTokens = new Map<string, TelegramTokenRecord>();
const userPendingToken = new Map<string, string>();
const telegramLinks = new Map<string, TelegramLinkRecord>();

export function saveTelegramToken(
  userId: string,
  token: string,
  expiresAt: number,
) {
  telegramTokens.set(token, { userId, expiresAt });
  userPendingToken.set(userId, token);
}

export function getPendingTelegramToken(userId: string): string | null {
  const token = userPendingToken.get(userId);
  if (!token) return null;
  const record = telegramTokens.get(token);
  if (!record || record.userId !== userId) {
    userPendingToken.delete(userId);
    return null;
  }
  if (record.expiresAt <= Date.now()) {
    telegramTokens.delete(token);
    userPendingToken.delete(userId);
    return null;
  }
  return token;
}

export function consumeTelegramToken(token: string) {
  const record = telegramTokens.get(token);
  if (!record) return null;
  telegramTokens.delete(token);
  userPendingToken.delete(record.userId);
  if (record.expiresAt <= Date.now()) return null;
  return record.userId;
}

export function saveTelegramChatId(userId: string, chatId: string) {
  telegramLinks.set(userId, {
    userId,
    chatId,
    connectedAt: Date.now(),
  });
}

export function getTelegramLink(userId: string): TelegramLinkRecord | null {
  return telegramLinks.get(userId) ?? null;
}

export function getUserIdByChatId(chatId: string): string | null {
  for (const record of telegramLinks.values()) {
    if (record.chatId === chatId) {
      return record.userId;
    }
  }
  return null;
}
