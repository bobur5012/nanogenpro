/**
 * Helper to generate payment Deep Links
 */

// App Store / Play Store links as fallback
export const BANKING_APPS = {
    click: {
        name: 'Click Up',
        schema: 'clickuz://',
        ios: 'https://apps.apple.com/uz/app/click-uz/id1156529396',
        android: 'https://play.google.com/store/apps/details?id=air.com.ssdsoftwaresolutions.clickuz',
        color: '#007AFF',
    },
    payme: {
        name: 'Payme',
        schema: 'payme://',
        ios: 'https://apps.apple.com/uz/app/payme-uz/id1086656461',
        android: 'https://play.google.com/store/apps/details?id=uz.dida.payme',
        color: '#00CCCC',
    }
};

export const openBankingApp = (app: 'click' | 'payme') => {
    const config = BANKING_APPS[app];

    // Try to open app via custom scheme
    window.location.href = config.schema;

    // Fallback to store after timeout (if app not installed)
    setTimeout(() => {
        window.open(config.android, '_blank');
    }, 1500);
};
