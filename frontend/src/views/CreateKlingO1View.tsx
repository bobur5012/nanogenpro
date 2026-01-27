import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
    Image as ImageIcon, 
    Video, 
    Layers, 
    Upload, 
    Trash2, 
    Smartphone, 
    Monitor, 
    Square, 
    Coins, 
    AlertCircle, 
    Zap,
    Film,
    Plus,
    CheckCircle
} from 'lucide-react';
import { Button } from '../components/Button';
import { BalanceDisplay } from '../components/BalanceDisplay';
import { triggerHaptic, triggerSelection, triggerNotification } from '../utils/haptics';
import { generationAPI } from '../utils/api';
import { getTelegramUserData, generateIdempotencyKey } from '../utils/generationHelpers';

interface CreateKlingO1ViewProps {
  userCredits: number;
  onOpenProfile: () => void;
}

type ModeType = 'img2vid' | 'vid2edit' | 'ref2vid' | 'vidref';

interface ModeConfig {
    id: ModeType;
    label: string;
    icon: React.ElementType;
    pricePerSec: number;
    desc: string;
}

const MODES: ModeConfig[] = [
    { id: 'img2vid', label: 'Image → Video', icon: ImageIcon, pricePerSec: 0.1176, desc: 'Анимация статики' },
    { id: 'vid2edit', label: 'Video → Edit', icon: Film, pricePerSec: 0.1764, desc: 'Редактирование видео' },
    { id: 'ref2vid', label: 'Ref → Video', icon: Layers, pricePerSec: 0.1176, desc: 'По референсу' },
    { id: 'vidref', label: 'Video Ref', icon: Video, pricePerSec: 0.1764, desc: 'Видео референс' },
];

const CREDITS_PER_DOLLAR = 100;
const RESOLUTIONS = ['Auto', '720p', '1080p', '4K'];
const RATIOS = [
  { id: '16:9', label: '16:9', icon: Monitor },
  { id: '9:16', label: '9:16', icon: Smartphone },
  { id: '1:1', label: '1:1', icon: Square },
];

export const CreateKlingO1View: React.FC<CreateKlingO1ViewProps> = ({ userCredits, onOpenProfile }) => {
  const [mode, setMode] = useState<ModeType>('img2vid');
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState<5 | 10>(5);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [resolution, setResolution] = useState('1080p');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [sourceVideo, setSourceVideo] = useState<string | null>(null);
  const [refImages, setRefImages] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<'sourceImage' | 'sourceVideo' | 'refImages' | null>(null);

  const currentMode = MODES.find(m => m.id === mode) || MODES[0];

  useEffect(() => {
      console.log("MODEL_SELECTED: Kling Video O1");
  }, []);

  useEffect(() => {
      console.log(`MODE_SELECTED: ${currentMode.label}`);
  }, [mode]);

  useEffect(() => {
      console.log("USER_BALANCE:", userCredits);
  }, [userCredits]);

  const costUSD = duration * currentMode.pricePerSec;
  const costCredits = Math.ceil(costUSD * CREDITS_PER_DOLLAR);
  const remainingCredits = userCredits - costCredits;
  const canAfford = userCredits >= costCredits;

  const isValid = useMemo(() => {
      switch (mode) {
          case 'img2vid': return !!sourceImage;
          case 'vid2edit': return !!sourceVideo && prompt.length > 0;
          case 'ref2vid': return refImages.length > 0;
          case 'vidref': return !!sourceVideo;
          default: return false;
      }
  }, [mode, sourceImage, sourceVideo, refImages, prompt]);

  const handleModeChange = (m: ModeType) => {
      if (m !== mode) {
          triggerSelection();
          setMode(m);
      }
  };

  const handleUploadClick = (target: 'sourceImage' | 'sourceVideo' | 'refImages') => {
      uploadTarget.current = target;
      triggerHaptic('light');
      fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && uploadTarget.current) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              const result = ev.target?.result as string;
              if (result) {
                  triggerHaptic('medium');
                  if (uploadTarget.current === 'sourceImage') setSourceImage(result);
                  else if (uploadTarget.current === 'sourceVideo') setSourceVideo(result);
                  else if (uploadTarget.current === 'refImages') {
                      if (refImages.length < 4) setRefImages(prev => [...prev, result]);
                  }
              }
          };
          reader.readAsDataURL(file);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeRefImage = (index: number) => {
      triggerHaptic('rigid');
      setRefImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
      if (!canAfford || !isValid || isSubmitting) {
          if (!isValid) triggerNotification('error');
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

          // Determine model_id based on mode
          let modelId = 'kling-video/v1.6/pro/text-to-video'; // Default
          let imageUrl: string | undefined = undefined;
          
          if (mode === 'img2vid' && sourceImage) {
              modelId = 'kling-video/v2.0/master/image-to-video';
              imageUrl = sourceImage;
          } else if (mode === 'vid2edit' && sourceVideo) {
              // Video editing - use same model
              imageUrl = sourceVideo;
          } else if (mode === 'ref2vid' && refImages.length > 0) {
              // Reference images - use first image
              imageUrl = refImages[0];
          } else if (mode === 'vidref' && sourceVideo) {
              imageUrl = sourceVideo;
          }

          const result = await generationAPI.start({
              user_id: userData.userId,
              init_data: userData.initData,
              model_id: modelId,
              model_name: 'Kling O1',
              generation_type: 'video',
              prompt: prompt.trim() || 'Generate video',
              image_url: imageUrl,
              parameters: {
                  duration: `${duration}s`,
                  aspect_ratio: aspectRatio,
                  resolution: resolution,
                  mode: mode,
              },
              idempotency_key: generateIdempotencyKey(),
          });

          setSuccess(true);
          triggerNotification('success');

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

  const renderUploadBox = (
      label: string, 
      subLabel: string, 
      preview: string | null, 
      onUpload: () => void, 
      onClear: () => void,
      icon: React.ElementType = Upload
  ) => {
      const Icon = icon;
      if (preview) {
          return (
            <div className="relative w-full h-40 rounded-xl overflow-hidden border border-[#24242A] group bg-[#15151A]">
                <img src={preview} alt="Preview" className="w-full h-full object-cover opacity-80" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2">
                    <button onClick={onUpload} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold backdrop-blur-md border border-white/10">Заменить</button>
                    <button onClick={onClear} className="bg-[#2A1515] text-[#FF4D4D] p-1.5 rounded-lg border border-[#441111]"><Trash2 size={16} /></button>
                </div>
            </div>
          );
      }
      return (
        <div 
            onClick={onUpload}
            className="w-full h-40 border-2 border-dashed border-[#24242A] bg-[#15151A] rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#FFD400]/50 hover:bg-[#1A1A1F] transition-all active:scale-[0.99]"
        >
            <div className="w-10 h-10 rounded-full bg-[#1A1A22] flex items-center justify-center border border-[#24242A]">
                <Icon size={18} className="text-[#A0A0A0]" />
            </div>
            <div className="text-center">
                <span className="block text-xs font-bold text-white">{label}</span>
                <span className="text-[10px] text-[#505055]">{subLabel}</span>
            </div>
        </div>
      );
  };

  return (
    <div className="flex flex-col h-screen bg-[#0B0B0E] animate-fade-in">
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*" />
        
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between shrink-0 bg-[#0B0B0E] sticky top-0 z-10 border-b border-[#24242A]">
            <div>
                <h1 className="font-bold text-lg text-white leading-none flex items-center gap-2">
                    Kling Video O1
                </h1>
                <span className="text-[10px] text-[#A0A0A0] font-mono mt-1 block">
                    Advanced Multi-Modal Generation
                </span>
            </div>
            <div className="flex flex-col items-end gap-1">
                <BalanceDisplay amount={userCredits} canAfford={canAfford} onClick={onOpenProfile} />
                <span className="text-[9px] text-[#505055] font-mono font-bold">
                    ${currentMode.pricePerSec}/s
                </span>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-20">
            
            {/* Mode Selector */}
            <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#505055] uppercase tracking-wider ml-1">Режим генерации</label>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                    {MODES.map((m) => {
                        const isActive = mode === m.id;
                        const Icon = m.icon;
                        return (
                            <button
                                key={m.id}
                                onClick={() => handleModeChange(m.id)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl border whitespace-nowrap transition-all ${
                                    isActive 
                                    ? 'bg-[#FFD400] border-[#FFD400] text-black shadow-lg shadow-yellow-500/20' 
                                    : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'
                                }`}
                            >
                                <Icon size={14} />
                                <span className="text-xs font-bold">{m.label}</span>
                            </button>
                        );
                    })}
                </div>
                <p className="text-[10px] text-[#505055] px-1">{currentMode.desc}</p>
            </div>

            {/* Dynamic Inputs Area */}
            <div className="space-y-4 animate-fade-in">
                
                {mode === 'img2vid' && (
                    <div className="space-y-2">
                        {renderUploadBox('Исходное изображение', 'PNG, JPG, WEBP', sourceImage, () => handleUploadClick('sourceImage'), () => setSourceImage(null), ImageIcon)}
                    </div>
                )}

                {mode === 'vid2edit' && (
                    <div className="space-y-2">
                         {renderUploadBox('Исходное видео', 'Макс 10с', sourceVideo, () => handleUploadClick('sourceVideo'), () => setSourceVideo(null), Film)}
                    </div>
                )}

                {mode === 'ref2vid' && (
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-[#A0A0A0]">Референсы (1-4)</label>
                        <div className="grid grid-cols-4 gap-2">
                            {refImages.map((img, idx) => (
                                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-[#24242A] group">
                                    <img src={img} className="w-full h-full object-cover" />
                                    <button onClick={() => removeRefImage(idx)} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[#FF4D4D] transition-opacity">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                            {refImages.length < 4 && (
                                <button 
                                    onClick={() => handleUploadClick('refImages')}
                                    className="aspect-square rounded-lg border border-dashed border-[#24242A] bg-[#15151A] flex items-center justify-center text-[#A0A0A0] hover:border-[#FFD400] hover:text-[#FFD400] transition-colors"
                                >
                                    <Plus size={20} />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {mode === 'vidref' && (
                    <div className="space-y-2">
                        {renderUploadBox('Видео референс', 'Референс движения', sourceVideo, () => handleUploadClick('sourceVideo'), () => setSourceVideo(null), Video)}
                    </div>
                )}
            </div>

            {/* Settings */}
            <div className="space-y-4 pt-2">
                <h3 className="text-[#A0A0A0] text-xs font-bold uppercase tracking-wider ml-1">Настройки</h3>
                
                <div className="grid grid-cols-2 gap-3">
                    {/* Duration */}
                    <div className="bg-[#15151A] border border-[#24242A] rounded-xl p-1 flex">
                        <button onClick={() => {triggerSelection(); setDuration(5)}} className={`flex-1 rounded-lg text-xs font-bold py-2 transition-all ${duration === 5 ? 'bg-[#24242A] text-white' : 'text-[#A0A0A0]'}`}>5s</button>
                        <button onClick={() => {triggerSelection(); setDuration(10)}} className={`flex-1 rounded-lg text-xs font-bold py-2 transition-all ${duration === 10 ? 'bg-[#24242A] text-white' : 'text-[#A0A0A0]'}`}>10s</button>
                    </div>

                    {/* Resolution */}
                    <button 
                        className="bg-[#15151A] border border-[#24242A] rounded-xl px-3 flex items-center justify-between text-[#A0A0A0]"
                        onClick={() => { if(mode === 'vidref') { 
                            const nextIdx = (RESOLUTIONS.indexOf(resolution) + 1) % RESOLUTIONS.length;
                            setResolution(RESOLUTIONS[nextIdx]);
                            triggerSelection();
                        }}}
                    >
                         <span className="text-[10px] font-bold">Res</span>
                         <span className="text-xs font-bold text-white">{resolution}</span>
                    </button>
                </div>

                {/* Aspect Ratio */}
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

            {/* Prompt */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">Промпт</label>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    maxLength={5000}
                    placeholder={mode === 'vid2edit' ? "Опишите изменения (например, стиль пластилина)..." : "Опишите видео контент..."}
                    className="w-full h-24 bg-[#15151A] border border-[#24242A] rounded-2xl p-4 text-white placeholder-[#505055] focus:border-[#FFD400] focus:outline-none transition-all resize-none text-sm leading-relaxed"
                />
            </div>

            {/* Cost Preview */}
            <div className="bg-[#15151A] border border-[#24242A] rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center text-xs">
                    <span className="text-[#A0A0A0]">Расчет</span>
                    <span className="font-mono text-[#A0A0A0]">{duration}с × ${currentMode.pricePerSec}</span>
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

        {/* Action */}
        <div className="p-5 border-t border-[#24242A] bg-[#0B0B0E]">
            <Button 
                fullWidth 
                onClick={handleSubmit} 
                disabled={!isValid || !canAfford}
                loading={isSubmitting}
            >
                {isSubmitting ? (
                    <span className="flex items-center gap-2">
                        Генерация {currentMode.label}...
                    </span>
                ) : (
                    <div className="flex items-center gap-2 justify-center">
                        <Zap size={18} className={canAfford && isValid ? "text-black" : "text-[#FF4D4D]"} />
                        <span>{canAfford ? (isValid ? 'Сгенерировать' : 'Заполните данные') : 'Пополнить баланс'}</span>
                    </div>
                )}
            </Button>
      </div>
    </div>
  );
};