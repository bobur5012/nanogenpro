import { TelegramUser, Job, ReferralStats } from '../types';

const STORAGE_KEY = 'nanogen_sim_db_v3';

export interface SimDB {
  user: TelegramUser | null;
  credits: number;
  isTrialUsed: boolean;
  history: Job[];
  referralStats: ReferralStats;
}

// Helper to get DB
export const getDB = (): SimDB => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    return JSON.parse(saved);
  }
  // Default State
  return {
    user: null,
    credits: 500, // Trial start
    isTrialUsed: false,
    history: [],
    referralStats: {
      invitedCount: 17,
      activeCount: 9,
      totalEarnings: 1245000, // 1 245 000 UZS
      balance: 980000, // 980 000 UZS available
      savedCard: undefined
    }
  };
};

// Helper to save DB
export const saveDB = (db: SimDB) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
};

// Initialize or User Login
export const initUser = (tgUser?: TelegramUser): SimDB => {
  let db = getDB();
  
  // If we have a TG user from WebApp, update/set it
  if (tgUser) {
    db.user = tgUser;
    saveDB(db);
    return db;
  }

  // If no user exists in DB, create a Mock one (Simulation Rule)
  if (!db.user) {
    db.user = {
      id: 7561794800 + Math.floor(Math.random() * 1000),
      first_name: 'Guest',
      username: 'guest_user',
      language_code: 'ru'
    };
    db.credits = 10; // Ensure trial balance for new user
    saveDB(db);
  }
  
  return db;
};

// Add Credits
export const addCredits = (amount: number): number => {
  const db = getDB();
  db.credits += amount;
  saveDB(db);
  return db.credits;
};

// Save Card
export const saveCard = (cardNumber: string) => {
    const db = getDB();
    db.referralStats.savedCard = cardNumber;
    saveDB(db);
};

// Request Withdraw
export const requestWithdraw = (amount: number): boolean => {
    const db = getDB();
    if (db.referralStats.balance >= amount) {
        db.referralStats.balance -= amount;
        saveDB(db);
        return true;
    }
    return false;
};

// Create Job
export const createJob = (type: 'image' | 'video' | 'enhance', cost: number, prompt: string, details: string): Job | null => {
  const db = getDB();
  
  if (db.credits < cost) return null;

  db.credits -= cost;
  
  const newJob: Job = {
    id: Date.now().toString(),
    type,
    status: type === 'video' ? 'queued' : 'done', // Image is instant in this sim, video is async
    prompt,
    cost,
    createdAt: Date.now(),
    details,
    resultUrl: type !== 'video' 
      ? `https://picsum.photos/seed/${Math.random()}/500/500` 
      : undefined
  };

  db.history.unshift(newJob);
  saveDB(db);
  return newJob;
};

// Delete Job
export const deleteJob = (id: string): Job[] => {
    const db = getDB();
    db.history = db.history.filter(job => job.id !== id);
    saveDB(db);
    return db.history;
};

// Background Tick (Simulate Backend)
export const simulateTick = (): SimDB => {
  const db = getDB();
  let modified = false;
  const now = Date.now();

  // 1. Check for Queue
  const processingVideo = db.history.find(j => j.type === 'video' && j.status === 'processing');
  
  // If nothing processing, check queue
  if (!processingVideo) {
    const nextInQueue = db.history.slice().reverse().find(j => j.type === 'video' && j.status === 'queued');
    if (nextInQueue) {
       // Start processing
       nextInQueue.status = 'processing';
       // Update in main array
       const idx = db.history.findIndex(j => j.id === nextInQueue.id);
       if (idx !== -1) db.history[idx] = nextInQueue;
       modified = true;
    }
  } else {
    // Process existing
    // Simulate 10s processing time
    if (now - processingVideo.createdAt > 10000) {
       // Finish
       const idx = db.history.findIndex(j => j.id === processingVideo.id);
       if (idx !== -1) {
           // 10% Error chance
           if (Math.random() < 0.1) {
               db.history[idx].status = 'error';
               db.credits += db.history[idx].cost; // Auto refund
           } else {
               db.history[idx].status = 'done';
               db.history[idx].resultUrl = `https://picsum.photos/seed/${processingVideo.id}/400/600`;
           }
           modified = true;
       }
    }
  }

  if (modified) {
      saveDB(db);
  }
  return db;
};

export const clearHistory = () => {
    const db = getDB();
    db.history = [];
    saveDB(db);
};

export const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
};

export const getReferralStats = (): ReferralStats => {
    return getDB().referralStats;
};
