import { useEffect, useState } from 'react';
import { processImageFromUrl } from '@/utils/backgroundRemoval';

interface LogoProcessorProps {
  originalImageUrl: string;
  onProcessed: (processedDataUrl: string) => void;
  className?: string;
  alt?: string;
}

export const LogoProcessor = ({ 
  originalImageUrl, 
  onProcessed, 
  className = "w-8 h-8 object-contain",
  alt = "Logo" 
}: LogoProcessorProps) => {
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processLogo = async () => {
      setIsProcessing(true);
      setError(null);
      try {
        console.log('Processing logo for transparency...');
        const processed = await processImageFromUrl(originalImageUrl);
        setProcessedImage(processed);
        onProcessed(processed);
        console.log('Logo processed with transparent background');
      } catch (err) {
        console.error('Failed to process logo:', err);
        setError('Failed to process logo');
        // Fallback to original image
        setProcessedImage(originalImageUrl);
        onProcessed(originalImageUrl);
      } finally {
        setIsProcessing(false);
      }
    };

    processLogo();
  }, [originalImageUrl, onProcessed]);

  if (isProcessing) {
    return (
      <div className={`${className} bg-primary/20 animate-pulse rounded flex items-center justify-center`}>
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="sr-only">Processing logo transparency...</span>
      </div>
    );
  }

  return (
    <img 
      src={processedImage || originalImageUrl} 
      alt={alt}
      className={className}
      style={{ 
        background: 'transparent',
        mixBlendMode: 'multiply' 
      }}
    />
  );
};