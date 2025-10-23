import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from './ui/carousel';
import samplePhoto1 from '../assets/sample-photo-1.jpg';
import samplePhoto2 from '../assets/sample-photo-2.jpg';

interface PhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  photoId: string;
  photos: string[];
  onPhotoChange?: (photoId: string) => void;
}

const PhotoModal = ({ isOpen, onClose, photoId, photos, onPhotoChange }: PhotoModalProps) => {
  const currentIndex = photos.findIndex(id => id === photoId);

  if (!isOpen) return null;

  const renderPhoto = (id: string) => {
    if (id.startsWith('sample')) {
      return (
        <img 
          src={id === 'sample1' ? samplePhoto1 : samplePhoto2} 
          alt="Sample photo" 
          className="w-full h-full object-contain rounded-lg"
        />
      );
    }
    return (
      <div className="w-full h-full bg-white/10 rounded-lg flex items-center justify-center border border-white/20">
        <div className="text-center">
          <div className="w-16 h-16 bg-white/20 rounded-lg mx-auto mb-3 flex items-center justify-center">
            <span className="text-white/60 text-sm">IMG</span>
          </div>
          <p className="text-white/80 text-sm">Demo Photo {id}</p>
          <p className="text-white/50 text-xs mt-1">Captured at checkpoint</p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-white hover:text-white/70 z-10"
        >
          <X size={24} />
        </button>

        {/* Photo Carousel */}
        <Carousel className="w-full" opts={{ startIndex: currentIndex }}>
          <CarouselContent>
            {photos.map((id, index) => (
              <CarouselItem key={id}>
                <div className="aspect-video">
                  {renderPhoto(id)}
                </div>
                <div className="text-center mt-4">
                  <p className="text-white/50 text-xs">
                    {index + 1} of {photos.length}
                  </p>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {photos.length > 1 && (
            <>
              <CarouselPrevious className="left-4 bg-black/50 border-white/20 text-white hover:bg-black/70" />
              <CarouselNext className="right-4 bg-black/50 border-white/20 text-white hover:bg-black/70" />
            </>
          )}
        </Carousel>
      </div>
    </div>
  );
};

export default PhotoModal;