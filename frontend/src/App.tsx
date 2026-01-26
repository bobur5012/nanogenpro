import React, { useEffect, useState, useRef } from 'react';
import { TelegramUser, AppScreen } from './types';
import { CreateKlingView } from './views/CreateKlingView';
import { ProfileView } from './views/ProfileView';
import { PaymentView } from './views/PaymentView';
import { ReferralView } from './views/ReferralView';
import { DebugHub } from './views/DebugHub';
import * as Sim from './utils/simulation';

// Placeholder component for models not yet implemented
const PlaceholderView: React.FC<{ name: string; userCredits: number; onOpenProfile: () => void }> = ({ name, userCredits, onOpenProfile }) => (
  <div className="min-h-screen bg-[#0B0B0E] flex flex-col items-center justify-center p-6">
    <div className="text-center space-y-4">
      <div className="w-20 h-20 bg-[#15151A] rounded-2xl border border-[#24242A] flex items-center justify-center mx-auto">
        <span className="text-3xl">🚧</span>
      </div>
      <h1 className="text-xl font-bold text-white">{name}</h1>
      <p className="text-[#A0A0A0] text-sm">Coming soon...</p>
      <div className="text-[#FFD400] text-sm font-mono">Balance: {userCredits} 💎</div>
      <button 
        onClick={onOpenProfile}
        className="mt-4 bg-[#FFD400] text-black px-6 py-3 rounded-xl font-bold text-sm"
      >
        Go to Profile
      </button>
    </div>
  </div>
);

const App: React.FC = () => {
  const [screen, setScreen] = useState<AppScreen | null>(null);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [credits, setCredits] = useState<number>(0);
  
  // Payment State
  const [paymentData, setPaymentData] = useState<{amount: number, price: number} | null>(null);
  
  const isDebugSession = useRef(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
        tg.ready();
        tg.expand();
        tg.MainButton.hide();

        const tgUser = tg.initDataUnsafe?.user;
        const db = Sim.initUser(tgUser);
        setUser(db.user);
        setCredits(db.credits);

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

  useEffect(() => {
      const tg = window.Telegram?.WebApp;
      if (!tg) return;

      const handleBack = () => {
          if (screen === 'payment' || screen === 'referral') {
              setScreen('profile');
              return;
          }
          
          if (isDebugSession.current && screen !== 'debug') {
              setScreen('debug');
          } else {
              tg.close();
          }
      };

      tg.BackButton.onClick(handleBack);
      return () => {
          if (tg.BackButton.offClick) tg.BackButton.offClick(handleBack);
      };
  }, [screen]);

  const handleOpenProfile = () => {
      setScreen('profile');
  };

  const handlePayment = (amount: number, price: number) => {
      setPaymentData({ amount, price });
      setScreen('payment');
  };

  const renderScreen = () => {
      switch (screen) {
          case 'kling':
              return <CreateKlingView userCredits={credits} onOpenProfile={handleOpenProfile} />;
          case 'kling_img2vid':
              return <PlaceholderView name="Kling 2.6 Pro (I2V)" userCredits={credits} onOpenProfile={handleOpenProfile} />;
          case 'kling_o1':
              return <PlaceholderView name="Kling Video O1" userCredits={credits} onOpenProfile={handleOpenProfile} />;
          case 'kling_turbo':
              return <PlaceholderView name="Kling Turbo Pro" userCredits={credits} onOpenProfile={handleOpenProfile} />;
          case 'seedance':
              return <PlaceholderView name="Seedance 1.0" userCredits={credits} onOpenProfile={handleOpenProfile} />;
          case 'wan':
              return <PlaceholderView name="Wan 2.5" userCredits={credits} onOpenProfile={handleOpenProfile} />;
          case 'wan_2_6':
              return <PlaceholderView name="Wan 2.6" userCredits={credits} onOpenProfile={handleOpenProfile} />;
          case 'runway_gen4':
              return <PlaceholderView name="Runway Gen-4 Turbo" userCredits={credits} onOpenProfile={handleOpenProfile} />;
          case 'gpt_image':
              return <PlaceholderView name="GPT Image 1.5" userCredits={credits} onOpenProfile={handleOpenProfile} />;
          case 'imagen_4':
              return <PlaceholderView name="Imagen 4.0" userCredits={credits} onOpenProfile={handleOpenProfile} />;
          case 'nano_banana':
              return <PlaceholderView name="Nano Banana" userCredits={credits} onOpenProfile={handleOpenProfile} />;
          case 'sora':
              return <PlaceholderView name="Sora 2 Pro" userCredits={credits} onOpenProfile={handleOpenProfile} />;
          case 'veo':
              return <PlaceholderView name="Veo 3.1" userCredits={credits} onOpenProfile={handleOpenProfile} />;
          case 'upscale':
              return <PlaceholderView name="NanoScale Upscaler" userCredits={credits} onOpenProfile={handleOpenProfile} />;
          case 'profile':
              return <ProfileView 
                        user={user} 
                        credits={credits} 
                        onNavigateToPayment={handlePayment} 
                        onNavigateToReferral={() => setScreen('referral')}
                     />;
          case 'referral':
              return <ReferralView onBack={() => setScreen('profile')} userStats={Sim.getReferralStats()} userCredits={credits} />;
          case 'payment':
              return <PaymentView amount={paymentData?.amount || 0} price={paymentData?.price || 0} onBack={() => setScreen('profile')} userCredits={credits} />;
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
