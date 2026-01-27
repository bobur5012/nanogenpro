/**
 * Helper functions for generation requests
 */

export interface GenerationRequestData {
  user_id: number;
  init_data: string;
  model_id: string;
  model_name: string;
  generation_type: 'image' | 'video';
  prompt: string;
  negative_prompt?: string;
  parameters?: Record<string, any>;
  image_url?: string;
  idempotency_key?: string;
}

/**
 * Get Telegram user data
 */
export function getTelegramUserData(): { userId: number; initData: string } | null {
  const tg = window.Telegram?.WebApp;
  const userId = tg?.initDataUnsafe?.user?.id;
  const initData = tg?.initData;

  if (!userId || !initData) {
    return null;
  }

  return { userId, initData };
}

/**
 * Generate idempotency key
 */
export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}
