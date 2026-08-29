import { env } from '../config/env';
import type {
  HouseholdTipData,
  SmartTip,
  SmartTipCategory,
  TipChatMessage,
} from '../types/smartTips';

const categories: SmartTipCategory[] = [
  'heating',
  'cooling',
  'appliances',
  'lighting',
  'behavior',
];

async function postJson(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      payload && typeof payload === 'object' && 'detail' in payload
        ? String(payload.detail)
        : 'The Smart Tips service is unavailable.';
    console.error(
      `[SmartTipsService] Request failed (${response.status}): ${detail}`,
    );
    if (response.status === 429) {
      throw new Error(
        'Smart Tips is temporarily rate-limited. Wait about a minute, then retry.',
      );
    }
    throw new Error('Smart Tips is unavailable right now. Please try again.');
  }
  return payload;
}

function isSmartTip(value: unknown): value is SmartTip {
  if (!value || typeof value !== 'object') return false;
  const tip = value as Partial<SmartTip>;
  return Boolean(
    typeof tip.id === 'string' &&
    typeof tip.title === 'string' &&
    typeof tip.summary === 'string' &&
    typeof tip.estimatedSavings === 'string' &&
    categories.includes(tip.category as SmartTipCategory),
  );
}

export async function generateSmartTips(
  householdData: HouseholdTipData,
): Promise<SmartTip[]> {
  const payload = await postJson('/v1/smart-tips/generate', householdData);
  const tips =
    payload && typeof payload === 'object' && 'tips' in payload
      ? (payload as { tips: unknown }).tips
      : null;
  if (!Array.isArray(tips) || tips.length !== 4 || !tips.every(isSmartTip)) {
    throw new Error('The Smart Tips response was incomplete. Please retry.');
  }
  return tips;
}

export async function sendTipChatMessage(
  tip: SmartTip,
  householdData: HouseholdTipData,
  history: TipChatMessage[],
  userMessage: string,
): Promise<string> {
  const payload = await postJson('/v1/smart-tips/chat', {
    tip,
    householdData,
    conversationHistory: history.map(({ role, text }) => ({ role, text })),
    userMessage,
  });
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('message' in payload) ||
    typeof payload.message !== 'string'
  ) {
    throw new Error('The advisor returned an invalid response. Please retry.');
  }
  return payload.message.trim();
}
