import React, { useEffect, useState, useRef } from 'react';
import { TelegramUser, AppScreen } from './types';

// Video Views
import { CreateKlingView } from './views/CreateKlingView';
import { CreateKlingImg2VideoView } from './views/CreateKlingImg2VideoView';
import { CreateKlingO1View } from './views/CreateKlingO1View';
import { CreateKlingTurboView } from './views/CreateKlingTurboView';
import { CreateSeedanceView } from './views/CreateSeedanceView';
import { CreateWanView } from './views/CreateWanView';
import { CreateWan26View } from './views/CreateWan26View';
import { CreateRunwayView } from './views/CreateRunwayView';
import { CreateSoraView } from './views/CreateSoraView';
import { CreateVeoView } from './views/CreateVeoView';

// Image Views
import { CreateGPTImageView } from './views/CreateGPTImageView';
import { CreateImagenView } from './views/CreateImagenView';
import { CreateNanoBananaView } from './views/CreateNanoBananaView';

// Other Views
import { ProfileView } from './views/ProfileView';
import { PaymentView } from './views/PaymentView';
import { ReferralView } from './views/ReferralView';
import { AdminView } from './views/AdminView';
import { DebugHub } from './views/DebugHub';

// Utils
import * as Sim from './utils/simulation';
import { userAPI } from './utils/api';

// Placeholder for Upscale (not yet implemented)
import { CreateUpscaleView } from './views/CreateUpscaleView';

const App: React.FC = () => {
    const [screen, setScreen] = useState<AppScreen | null>(null);
    const [user, setUser] = useState<TelegramUser | null>(null);
    const [credits, setCredits] = useState<number>(0);

    // Payment State
    const [paymentData, setPaymentData] = useState<{ amount: number, price: number } | null>(null);

    const isDebugSession = useRef(false);

    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (tg) {
            tg.ready();
            tg.expand();
            tg.MainButton.hide();

            const tgUser = tg.initDataUnsafe?.user;
            setUser(tgUser || null);

            // Load user data from API
            loadUserData();

            // Support both URL path and query params for routing
            const path = window.location.pathname;
            const params = new URLSearchParams(window.location.search);
            const screenParam = params.get('screen') as AppScreen;
            const creditsParam = params.get('credits');

            if (creditsParam) setCredits(parseInt(creditsParam));

            // Try to get model from URL path (e.g., /model/kling-2-6-pro)
            let modelFromPath: AppScreen | null = null;
            if (path.includes('/model/')) {
                const modelSlug = path.split('/model/')[1]?.split('?')[0];
                // Map slug to screen
                const slugToScreen: Record<string, AppScreen> = {
                    'kling-2-6-pro': 'kling',
                    'kling-i2v': 'kling_img2vid',
                    'kling-o1': 'kling_o1',
                    'kling-turbo': 'kling_turbo',
                    'seedance': 'seedance',
                    'wan-2-5': 'wan',
                    'wan-2-6': 'wan_2_6',
                    'runway-gen4': 'runway_gen4',
                    'gpt-image': 'gpt_image',
                    'imagen-4': 'imagen_4',
                    'nano-banana': 'nano_banana',
                    'sora-2-pro': 'sora',
                    'veo-3-1': 'veo',
                    'upscale': 'upscale',
                };
                modelFromPath = slugToScreen[modelSlug] || null;
            }

            if (modelFromPath) {
                setScreen(modelFromPath);
                isDebugSession.current = false;
            } else if (screenParam) {
                setScreen(screenParam);
                isDebugSession.current = false;
            } else {
                setScreen('debug');
                isDebugSession.current = true;
            }

            tg.BackButton.show();
        }
    }, []);

    const loadUserData = async () => {
        try {
            const response = await userAPI.auth();
            setUser(response.user || window.Telegram?.WebApp?.initDataUnsafe?.user || null);
            setCredits(response.credits || 0);
        } catch (error) {
            console.error('Failed to load user data:', error);
            // Fallback to simulation for development
            const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
            if (tgUser) {
                const db = Sim.initUser(tgUser);
                setUser(db.user);
                setCredits(db.credits);
            }
        }
    };

    const handleCreditsUpdate = (newCredits: number) => {
        setCredits(newCredits);
    };

    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (!tg) return;

        const handleBack = () => {
            // If opened payment from profile, go back to profile
            if (screen === 'payment') {
                setScreen('profile');
                return;
            }

            // Debug mode navigation
            if (isDebugSession.current && screen !== 'debug') {
                setScreen('debug');
                return;
            }

            // Otherwise close the Web App (return to Telegram)
            tg.close();
        };

        tg.BackButton.onClick(handleBack);
        return () => {
            if (tg.BackButton.offClick) tg.BackButton.offClick(handleBack);
        };
    }, [screen]);

    const handleOpenProfile = () => {
        console.log('Navigating to profile');
        setScreen('profile');
    };

    const handleNavigateToReferral = () => {
        console.log('Navigating to referral');
        setScreen('referral');
    };

    const handlePayment = (amount: number, price: number) => {
        setPaymentData({ amount, price });
        setScreen('payment');
    };

    const renderScreen = () => {
        const commonProps = {
            userCredits: credits,
            onOpenProfile: handleOpenProfile,
            onCreditsUpdate: handleCreditsUpdate,
        };

        switch (screen) {
            // Video Models
            case 'kling':
                return <CreateKlingView {...commonProps} />;
            case 'kling_img2vid':
                return <CreateKlingImg2VideoView {...commonProps} />;
            case 'kling_o1':
                return <CreateKlingO1View {...commonProps} />;
            case 'kling_turbo':
                return <CreateKlingTurboView {...commonProps} />;
            case 'seedance':
                return <CreateSeedanceView {...commonProps} />;
            case 'wan':
                return <CreateWanView {...commonProps} />;
            case 'wan_2_6':
                return <CreateWan26View {...commonProps} />;
            case 'runway_gen4':
                return <CreateRunwayView {...commonProps} />;
            case 'sora':
                return <CreateSoraView {...commonProps} />;
            case 'veo':
                return <CreateVeoView {...commonProps} />;

            // Image Models
            case 'gpt_image':
                return <CreateGPTImageView {...commonProps} />;
            case 'imagen_4':
                return <CreateImagenView {...commonProps} />;
            case 'nano_banana':
                return <CreateNanoBananaView {...commonProps} />;
            case 'upscale':
                return <CreateUpscaleView {...commonProps} />;

            // Profile & Payments
            case 'profile':
                return <ProfileView
                    user={user}
                    credits={credits}
                    onNavigateToPayment={handlePayment}
                    onNavigateToReferral={handleNavigateToReferral}
                    onCreditsUpdate={handleCreditsUpdate}
                />;
            case 'referral':
                return <ReferralView
                    onBack={() => setScreen('profile')}
                    userCredits={credits}
                    user={user}
                />;
            case 'admin':
                return <AdminView onBack={() => setScreen('profile')} />;
            case 'payment':
                return <PaymentView
                    amount={paymentData?.amount || 0}
                    price={paymentData?.price || 0}
                    onBack={() => setScreen('profile')}
                    userCredits={credits}
                    onCreditsUpdate={handleCreditsUpdate}
                />;

            // Debug / Dev
            case 'debug':
            default:
                return <DebugHub onNavigate={(s) => setScreen(s as AppScreen)} />;
        }
    };

    return (
        <div className="min-h-screen bg-[#0B0B0E] text-white">
            {renderScreen()}
        </div>
    );
};

export default App;
