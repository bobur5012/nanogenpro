export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

export interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  image: string;
  buttonText: string;
}

export type Tab = 'home' | 'trends' | 'history' | 'profile';

export type CreateMode = 'image' | 'video' | 'enhance';

export interface CreateViewParams {
  initialPrompt?: string;
  magicPrompt?: boolean;
}

// Routes - Model Specific Only
export type AppScreen = 
  | 'kling'           // Kling 2.6 Pro (Text)
  | 'kling_img2vid'   // Kling 2.6 Pro (Image)
  | 'kling_o1'        // Kling Video O1
  | 'kling_turbo'     // Kling Turbo Pro
  | 'seedance'        // Seedance 1.0
  | 'wan'             // Wan 2.5
  | 'wan_2_6'         // Wan 2.6
  | 'runway_gen4'     // Runway Gen-4 Turbo
  | 'gpt_image'       // GPT Image 1.5
  | 'imagen_4'        // Imagen 4.0
  | 'nano_banana'     // Nano Banana (Google)
  | 'sora'            // Sora 2 Pro
  | 'veo'             // Veo 3.1
  | 'upscale'         // Upscale Model
  | 'profile'         // User Profile
  | 'referral'        // Partner/Referral Section
  | 'payment'         // Payment Screen
  | 'debug';          // Dev Console

// Bot Payloads
export type WebAppPayload = 
  | { type: 'video_gen'; payload: any }
  | { type: 'image_gen'; payload: any }
  | { type: 'upscale'; payload: { scale: string; image_url?: string } }
  | { type: 'buy_credits'; payload: { amount: number; price: number; method: 'card' } }
  | { type: 'payment_confirm'; payload: { credits: number; amount_uzs: number; screenshot: string } }
  | { type: 'withdraw_request'; payload: { amount_uzs: number; card_number: string } };

// Jobs/History
export interface Job {
    id: string;
    type: 'image' | 'video' | 'enhance';
    status: 'queued' | 'processing' | 'done' | 'error';
    prompt: string;
    cost: number;
    createdAt: number;
    details: string;
    resultUrl?: string;
}

// Referral Stats (for simulation/local use)
export interface ReferralStats {
    invitedCount: number;
    activeCount: number;
    totalEarnings: number;
    balance: number;
    savedCard?: string;
}

// Partner Stats (from API)
export interface PartnerStats {
    referral_code: string;
    referral_link: string;
    total_earned: number;         // Ваш доход (lifetime)
    available_balance: number;    // Баланс партнёра (для вывода)
    total_withdrawn: number;      // Всего выведено
    referrals_total: number;      // Всего рефералов
    referrals_active: number;     // Активных (с 1+ платежом)
    saved_card: string | null;
    saved_card_type: string | null;
    min_withdrawal: number;
    commission_percent: number;
}

// Credit Package
export interface CreditPackage {
    credits: number;
    price_uzs: number;
    discount: number;
}

// Payment Card Info
export interface PaymentCard {
    number: string;
    holder: string;
    type: string;
}

declare global {
  interface Window {
    Telegram: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: TelegramUser;
          start_param?: string;
          [key: string]: any;
        };
        version: string;
        isVersionAtLeast: (version: string) => boolean;
        ready: () => void;
        expand: () => void;
        close: () => void;
        sendData: (data: string) => void;
        showPopup: (params: any, callback?: (id: string) => void) => void;
        openTelegramLink: (url: string) => void;  // For native share
        openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
        BackButton: {
            isVisible: boolean;
            show: () => void;
            hide: () => void;
            onClick: (cb: () => void) => void;
            offClick: (cb: () => void) => void;
        };
        MainButton: {
            show: () => void;
            hide: () => void;
            setText: (text: string) => void;
            onClick: (cb: () => void) => void;
            setParams: (params: any) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: string) => void;
          notificationOccurred: (type: string) => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}
