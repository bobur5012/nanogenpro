// Helper for Telegram Haptic Feedback
export const triggerHaptic = (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred(style);
    }
};

export const triggerNotification = (type: 'error' | 'success' | 'warning') => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred(type);
    }
};

export const triggerSelection = () => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
};
