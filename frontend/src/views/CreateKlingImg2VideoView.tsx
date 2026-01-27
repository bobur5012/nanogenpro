import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, Video, Music, AlertCircle, Coins, Clock, Zap, Mic, Upload, Trash2, Smartphone, Monitor, Square, Film, CheckCircle } from 'lucide-react';
import { Button } from '../components/Button';
import { BalanceDisplay } from '../components/BalanceDisplay';
import { triggerHaptic, triggerSelection, triggerNotification } from '../utils/haptics';
import { generationAPI } from '../utils/api';
import { getTelegramUserData, generateIdempotencyKey } from '../utils/generationHelpers';

interface CreateKlingImg2VideoViewProps {
  userCredits: number;
  onOpenProfile: () => void;
  onCreditsUpdate?: (newCredits: number) => void;
}

const PRICE_PER_SEC_NO_AUDIO = 0.0735;
const PRICE_PER_SEC_AUDIO = 0.147;
const CREDITS_PER_DOLLAR = 100;

const RATIOS = [
  { id: '16:9', label: '16:9', icon: Monitor },
  { id: '9:16', label: '9:16', icon: Smartphone },
  { id: '1:1', label: '1:1', icon: Square },
];

export const CreateKlingImg2VideoView: React.FC<CreateKlingImg2VideoViewProps> = ({ userCredits, onOpenProfile, onCreditsUpdate }) => {
  const [image, setImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [duration, setDuration] = useState<5 | 10>(5);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      console.log("MODEL_SELECTED: Kling 2.6 Pro (Image to Video)");
  }, []);

  useEffect(() => {
      console.log("USER_BALANCE:", userCredits);
  }, [userCredits]);

  const pricePerSec = isAudioEnabled ? PRICE_PER_SEC_AUDIO : PRICE_PER_SEC_NO_AUDIO;
  const costUSD = duration * pricePerSec;
  const costCredits = Math.ceil(costUSD * CREDITS_PER_DOLLAR);
  const remainingCredits = userCredits - costCredits;

  const canAfford = userCredits >= costCredits;
  const isValid = !!image;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
              if (e.target?.result) {
                  setImage(e.target.result as string);
                  triggerHaptic('medium');
              }
          };
          reader.readAsDataURL(file);
      }
  };

  const handleUploadClick = () => {
      triggerHaptic('light');
      fileInputRef.current?.click();
  };

  const clearImage = (e: React.MouseEvent) => {
      e.stopPropagation();
      triggerHaptic('rigid');
      setImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
    if (!canAfford || !isValid || isSubmitting || !image) {
        if (!image) triggerNotification('error');
        return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);
    triggerHaptic('medium');
    
    try {
      const userData = getTelegramUserData();
      if (!userData) {
        throw new Error('Telegram данные не найдены');
      }

      // Extract base64 data from image (remove data:image/...;base64, prefix)
      const base64Data = image.includes(',') ? image.split(',')[1] : image;
      
      const result = await generationAPI.start({
        user_id: userData.userId,
        init_data: userData.initData,
        model_id: 'kling-video/v2.0/master/image-to-video',
        model_name: 'Kling 2.6 Pro (Image to Video)',
        generation_type: 'video',
        prompt: prompt.trim() || 'Transform this image into a video',
        negative_prompt: negativePrompt.trim() || undefined,
        image_url: image, // Pass full data URL
        parameters: {
          duration: `${duration}s`,
          aspect_ratio: aspectRatio,
          audio: isAudioEnabled,
        },
        idempotency_key: generateIdempotencyKey(),
      });

      setSuccess(true);
      triggerNotification('success');

      // Update balance if provided
      if (result.new_balance !== undefined && onCreditsUpdate) {
        onCreditsUpdate(result.new_balance);
      }

      setTimeout(() => {
        onOpenProfile();
      }, 2000);

    } catch (err: any) {
      console.error('Generation failed:', err);
      let errorMessage = 'Не удалось запустить генерацию. Попробуйте позже.';
      
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
      
      if (errorMessage.includes('кредит') || errorMessage.includes('баланс') || errorMessage.includes('INSUFFICIENT')) {
        setTimeout(() => {
          onOpenProfile();
        }, 3000);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0B0B0E] animate-fade-in">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between shrink-0 bg-[#0B0B0E] sticky top-0 z-10 border-b border-[#24242A]">
        <div>
            <h1 className="font-bold text-lg text-white leading-none flex items-center gap-2">
                Kling 2.6 Pro <span className="bg-[#FFD400] text-black text-[10px] px-1.5 py-0.5 rounded font-bold">PRO</span>
            </h1>
            <div className="flex flex-col mt-1">
                <span className="text-[10px] text-[#A0A0A0] font-mono flex items-center gap-1.5">
                    <ImageIcon size={10} /> Image to Video
                </span>
                <span className="text-[8px] text-[#505055] font-mono mt-0.5">
                    PNG, JPEG, TIFF, WEBP
                </span>
            </div>
        </div>
        <div className="flex flex-col items-end gap-1">
             <BalanceDisplay amount={userCredits} canAfford={canAfford} onClick={onOpenProfile} />
             <span className="text-[9px] text-[#505055] font-mono font-bold">
                 ${pricePerSec}/s
             </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-20">
        
        {/* Input Image Section */}
        <div className="space-y-2">
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept="image/png, image/jpeg, image/webp, image/tiff" 
                className="hidden" 
            />
            
            {!image ? (
                <div 
                    onClick={handleUploadClick}
                    className="w-full h-48 border-2 border-dashed border-[#24242A] bg-[#15151A] rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-[#FFD400]/50 hover:bg-[#1A1A1F] transition-all active:scale-[0.99]"
                >
                    <div className="w-12 h-12 rounded-full bg-[#1A1A22] flex items-center justify-center border border-[#24242A]">
                        <Upload size={20} className="text-[#A0A0A0]" />
                    </div>
                    <div className="text-center">
                        <span className="block text-sm font-bold text-white">Загрузить изображение</span>
                        <span className="text-[10px] text-[#505055] mt-1">Нажмите для выбора файла</span>
                    </div>
                </div>
            ) : (
                <div className="relative w-full h-64 rounded-2xl overflow-hidden border border-[#24242A] group bg-[#15151A]">
                    <img src={image} alt="Preview" className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm">
                        <button 
                            onClick={handleUploadClick}
                            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-xs font-bold backdrop-blur-md transition-colors border border-white/10"
                        >
                            Заменить
                        </button>
                        <button 
                            onClick={clearImage}
                            className="bg-[#2A1515] hover:bg-[#441111] text-[#FF4D4D] p-2 rounded-xl border border-[#441111] transition-colors"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* Generation Settings */}
        <div className="space-y-4">
            <h3 className="text-[#A0A0A0] text-xs font-bold uppercase tracking-wider ml-1">Настройки</h3>
            
            {/* Grid for basic settings */}
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
                    className={`border rounded-xl px-3 flex items-center justify-between transition-all ${
                        isAudioEnabled 
                        ? 'bg-[#FFD400]/10 border-[#FFD400] text-[#FFD400]' 
                        : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'
                    }`}
                 >
                     <div className="flex items-center gap-2">
                         {isAudioEnabled ? <Mic size={14} /> : <Music size={14} />}
                         <span className="text-[10px] font-bold">Аудио</span>
                     </div>
                     <span className="text-[10px] font-bold">{isAudioEnabled ? 'ВКЛ' : 'ВЫКЛ'}</span>
                 </button>
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-2">
                 <label className="text-[10px] font-bold text-[#505055] uppercase tracking-wider ml-1">Соотношение сторон</label>
                 <div className="grid grid-cols-3 gap-2">
                     {RATIOS.map((r) => {
                         const Icon = r.icon;
                         const isSelected = aspectRatio === r.id;
                         return (
                             <button
                                key={r.id}
                                onClick={() => { triggerSelection(); setAspectRatio(r.id); }}
                                className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                                    isSelected 
                                    ? 'bg-[#FFD400] border-[#FFD400] text-black' 
                                    : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'
                                }`}
                             >
                                 <Icon size={16} className="mb-1" />
                                 <span className="text-[10px] font-bold">{r.label}</span>
                             </button>
                         );
                     })}
                 </div>
            </div>

            {/* Read-only Specs */}
            <div className="flex gap-2 text-[9px] text-[#505055] font-mono px-1">
                <span className="bg-[#15151A] border border-[#24242A] px-2 py-1 rounded">Res: Auto (1080p)</span>
                <span className="bg-[#15151A] border border-[#24242A] px-2 py-1 rounded">FPS: 30</span>
            </div>
        </div>

        {/* Prompt Section */}
        <div className="space-y-4">
            <div className="space-y-2">
                <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">Промпт (Опционально)</label>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    maxLength={5000}
                    placeholder="Опишите, как изображение должно ожить..."
                    className="w-full h-24 bg-[#15151A] border border-[#24242A] rounded-2xl p-4 text-white placeholder-[#505055] focus:border-[#FFD400] focus:outline-none transition-all resize-none text-sm leading-relaxed"
                />
            </div>

            <div className="space-y-2">
                <label className="text-xs font-bold text-[#505055] uppercase tracking-wider ml-1">Негативный промпт</label>
                <input
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="Искажения, размытие, артефакты..."
                    className="w-full bg-[#15151A] border border-[#24242A] rounded-xl p-3 text-white placeholder-[#505055] focus:border-[#FFD400]/50 focus:outline-none transition-all text-xs"
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
                 <span className="font-mono text-[#A0A0A0]">{duration}с × ${pricePerSec}</span>
             </div>
             <div className="h-px bg-[#24242A]" />
             <div className="flex justify-between items-center">
                 <div className="flex items-center gap-2">
                     <Coins size={16} className={canAfford ? 'text-[#FFD400]' : 'text-[#FF4D4D]'} />
                     <span className="text-sm font-bold text-white">Итого</span>
                 </div>
                 <div className="flex flex-col items-end">
                     <span className="text-lg font-bold text-white">{costCredits} CR</span>
                     <span className="text-[10px] text-[#505055] font-mono">(${costUSD.toFixed(3)})</span>
                 </div>
             </div>
             {canAfford ? (
                 <div className="flex justify-between items-center text-[10px] bg-black/20 p-2 rounded-lg">
                     <span className="text-[#A0A0A0]">Остаток</span>
                     <span className="text-white font-mono">{remainingCredits} CR</span>
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
                     Генерация Image-to-Video...
                 </span>
             ) : (
                 <div className="flex items-center gap-2 justify-center">
                     <Zap size={18} className={canAfford && isValid ? "text-black" : "text-[#FF4D4D]"} />
                     <span>{canAfford ? (isValid ? 'Сгенерировать видео' : 'Сначала загрузите фото') : 'Пополнить баланс'}</span>
                 </div>
             )}
        </Button>
      </div>
    </div>
  );
};