import React, { useState, useEffect } from 'react';
import { Music, AlertCircle, Coins, Clock, Zap, Mic, CheckCircle } from 'lucide-react';
import { Button } from '../components/Button';
import { ModelHeader } from '../components/ModelHeader';
import { triggerHaptic, triggerSelection, triggerNotification } from '../utils/haptics';
import { generationAPI } from '../utils/api';
import { getTelegramUserData, generateIdempotencyKey } from '../utils/generationHelpers';

interface CreateKlingViewProps {
  userCredits: number;
  onOpenProfile: () => void;
}

// Pricing in UZS (3x markup applied)
const PRICE_PER_SEC_NO_AUDIO = 22050;  // ~$0.0735 * 3 * 100 credits
const PRICE_PER_SEC_AUDIO = 44100;     // ~$0.147 * 3 * 100 credits
const CREDITS_PER_UZS = 1000;          // 1000 UZS = 1 credit

export const CreateKlingView: React.FC<CreateKlingViewProps> = ({ userCredits, onOpenProfile }) => {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [duration, setDuration] = useState<5 | 10>(5);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
      console.log("MODEL_SELECTED: Kling 2.6 Pro");
  }, []);

  useEffect(() => {
      console.log("USER_BALANCE:", userCredits);
  }, [userCredits]);

  const pricePerSec = isAudioEnabled ? PRICE_PER_SEC_AUDIO : PRICE_PER_SEC_NO_AUDIO;
  const costUZS = duration * pricePerSec;
  const costCredits = Math.ceil(costUZS / CREDITS_PER_UZS);
  const remainingCredits = userCredits - costCredits;

  const canAfford = userCredits >= costCredits;
  const isValid = prompt.trim().length > 0;

  const handleDurationChange = (d: 5 | 10) => {
      if (duration !== d) {
          triggerSelection();
          setDuration(d);
      }
  };

  const toggleAudio = () => {
      triggerSelection();
      setIsAudioEnabled(!isAudioEnabled);
  };

  const handleSubmit = async () => {
    if (!canAfford || !isValid || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);
    triggerHaptic('medium');
    
    try {
      const userData = getTelegramUserData();
      if (!userData) {
        throw new Error('Telegram данные не найдены');
      }

      const result = await generationAPI.start({
        user_id: userData.userId,
        init_data: userData.initData,
        model_id: 'kling-video/v2.0/master/text-to-video',
        model_name: 'Kling 2.6 Pro',
        generation_type: 'video',
        prompt: prompt.trim(),
        negative_prompt: negativePrompt.trim() || undefined,
        parameters: {
          duration: `${duration}s`,
          audio: isAudioEnabled,
        },
        idempotency_key: generateIdempotencyKey(),
      });

      setSuccess(true);
      triggerNotification('success');

      // Вернуться в профиль через 2 секунды
      setTimeout(() => {
        onOpenProfile();
      }, 2000);

    } catch (err: any) {
      console.error('Generation failed:', err);
      let errorMessage = 'Не удалось запустить генерацию. Попробуйте позже.';
      
      // Парсим структурированную ошибку
      if (err.message) {
        try {
          const errorData = JSON.parse(err.message);
          errorMessage = errorData.message || errorData.detail || errorMessage;
        } catch {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      triggerNotification('error');
      
      // Если это ошибка недостатка кредитов, предложить пополнить
      if (errorMessage.includes('кредит') || errorMessage.includes('баланс') || errorMessage.includes('INSUFFICIENT')) {
        setTimeout(() => {
          onOpenProfile();
        }, 3000);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatUZS = (amount: number) => amount.toLocaleString('ru-RU');

  return (
    <div className="flex flex-col h-screen bg-[#0B0B0E] animate-fade-in">
      <ModelHeader
        modelName="Kling 2.6 Pro"
        subtitle="Text to Video"
        badge={<span className="bg-[#FFD400] text-black text-[10px] px-1.5 py-0.5 rounded font-bold">NEW</span>}
        userCredits={userCredits}
        canAfford={canAfford}
        onOpenProfile={onOpenProfile}
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-20">
        
        {/* Settings Section */}
        <div className="space-y-4">
            <h3 className="text-[#A0A0A0] text-xs font-bold uppercase tracking-wider ml-1">Настройки генерации</h3>
            
            <div className="grid grid-cols-2 gap-3">
                 {/* Duration */}
                 <div className="bg-[#15151A] border border-[#24242A] rounded-xl p-1 flex">
                     <button 
                        onClick={() => handleDurationChange(5)} 
                        className={`flex-1 rounded-lg text-xs font-bold py-2 transition-all ${duration === 5 ? 'bg-[#24242A] text-white shadow-sm' : 'text-[#A0A0A0]'}`}
                     >
                         5 сек
                     </button>
                     <button 
                        onClick={() => handleDurationChange(10)} 
                        className={`flex-1 rounded-lg text-xs font-bold py-2 transition-all ${duration === 10 ? 'bg-[#24242A] text-white shadow-sm' : 'text-[#A0A0A0]'}`}
                     >
                         10 сек
                     </button>
                 </div>

                 {/* Audio Toggle */}
                 <button 
                    onClick={toggleAudio}
                    className={`border rounded-xl px-4 flex items-center justify-between transition-all ${
                        isAudioEnabled 
                        ? 'bg-[#FFD400]/10 border-[#FFD400] text-[#FFD400]' 
                        : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'
                    }`}
                 >
                     <div className="flex items-center gap-2">
                         {isAudioEnabled ? <Mic size={16} /> : <Music size={16} />}
                         <span className="text-xs font-bold">Аудио</span>
                     </div>
                     <span className="text-[10px] font-bold">{isAudioEnabled ? 'ВКЛ' : 'ВЫКЛ'}</span>
                 </button>
            </div>

            {/* Price Info */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5 text-[10px] text-[#A0A0A0]">
                    <Clock size={10} />
                    <span>Цена за секунду:</span>
                </div>
                <div className="text-xs font-mono font-bold text-white">
                    {formatUZS(pricePerSec)} UZS
                </div>
            </div>
        </div>

        {/* Prompt Section */}
        <div className="space-y-4">
            <div className="space-y-2">
                <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">Промпт</label>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    maxLength={5000}
                    placeholder={isAudioEnabled ? "Опишите сцену и звуковое сопровождение..." : "Детально опишите сцену..."}
                    className="w-full h-32 bg-[#15151A] border border-[#24242A] rounded-2xl p-4 text-white placeholder-[#505055] focus:border-[#FFD400] focus:outline-none transition-all resize-none text-sm leading-relaxed"
                />
                <div className="flex justify-end px-1">
                    <span className="text-[10px] text-[#505055] font-mono">{prompt.length}/5000</span>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-bold text-[#505055] uppercase tracking-wider ml-1">Негативный промпт (Опционально)</label>
                <textarea
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="Размыто, низкое качество, искажения..."
                    className="w-full h-20 bg-[#15151A] border border-[#24242A] rounded-xl p-3 text-white placeholder-[#505055] focus:border-[#FFD400]/50 focus:outline-none transition-all resize-none text-xs"
                />
            </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-[#2A1515] border border-[#441111] rounded-xl p-4 flex items-start gap-3">
            <AlertCircle size={20} className="text-[#FF4D4D] shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[#FF4D4D] text-sm font-bold mb-1">Ошибка</p>
              <p className="text-[#A0A0A0] text-xs">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-[#1A4D3A] border border-[#2d7a5a] rounded-xl p-4 flex items-start gap-3">
            <CheckCircle size={20} className="text-[#22C55E] shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[#22C55E] text-sm font-bold mb-1">Генерация запущена!</p>
              <p className="text-[#A0A0A0] text-xs">Результат придёт в Telegram</p>
            </div>
          </div>
        )}

        {/* Cost Preview Section */}
        <div className="bg-[#15151A] border border-[#24242A] rounded-2xl p-4 space-y-3">
             <div className="flex justify-between items-center text-xs">
                 <span className="text-[#A0A0A0]">Расчет</span>
                 <span className="font-mono text-[#A0A0A0]">{duration}с × {formatUZS(pricePerSec)}</span>
             </div>
             <div className="h-px bg-[#24242A]" />
             <div className="flex justify-between items-center">
                 <div className="flex items-center gap-2">
                     <Coins size={16} className={canAfford ? 'text-[#FFD400]' : 'text-[#FF4D4D]'} />
                     <span className="text-sm font-bold text-white">Итого</span>
                 </div>
                 <div className="flex flex-col items-end">
                     <span className="text-lg font-bold text-white">{costCredits} 💎</span>
                     <span className="text-[10px] text-[#505055] font-mono">({formatUZS(costUZS)} UZS)</span>
                 </div>
             </div>
             {canAfford ? (
                 <div className="flex justify-between items-center text-[10px] bg-black/20 p-2 rounded-lg">
                     <span className="text-[#A0A0A0]">Остаток</span>
                     <span className="text-white font-mono">{remainingCredits} 💎</span>
                 </div>
             ) : (
                 <div className="flex items-center gap-2 text-[#FF4D4D] text-[10px] bg-[#2A1515] p-2 rounded-lg border border-[#441111]">
                    <AlertCircle size={12} />
                    <span>Недостаточно средств</span>
                </div>
             )}
        </div>
      </div>

      {/* Footer Action */}
      <div className="p-5 border-t border-[#24242A] bg-[#0B0B0E]">
        <Button 
            fullWidth 
            onClick={handleSubmit} 
            disabled={!isValid || !canAfford}
            loading={isSubmitting}
        >
             {isSubmitting ? (
                 <span className="flex items-center gap-2">
                     Генерация с Kling...
                 </span>
             ) : (
                 <div className="flex items-center gap-2 justify-center">
                     <Zap size={18} className={canAfford ? "text-black" : "text-[#FF4D4D]"} />
                     <span>{canAfford ? 'Сгенерировать видео' : 'Пополнить баланс'}</span>
                 </div>
             )}
        </Button>
      </div>
    </div>
  );
};
