import { useState } from 'react';
import { ChevronLeft, Camera, Video, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

interface TakePicturesScreenProps {
  onBack: () => void;
  onFinish: () => void;
  onHelp: () => void;
}

const TakePicturesScreen = ({
  onBack,
  onFinish,
  onHelp
}: TakePicturesScreenProps) => {
  const [capturedMedia, setCapturedMedia] = useState<string[]>([]);
  const [showFinishModal, setShowFinishModal] = useState(false);

  const handleTakePhoto = () => {
    // Simulate taking a photo - in a real app, this would use the camera API
    const newPhoto = `/demo-photo-${Date.now()}.jpg`;
    setCapturedMedia(prev => [...prev, newPhoto]);
  };

  const handleTakeVideo = () => {
    // Simulate taking a video - in a real app, this would use the camera API
    const newVideo = `/demo-video-${Date.now()}.mp4`;
    setCapturedMedia(prev => [...prev, newVideo]);
  };

  const handleDeleteMedia = (index: number) => {
    setCapturedMedia(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 pt-6 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <Button
            onClick={onBack}
            variant="ghost"
            size="icon"
            className="text-foreground hover:bg-muted"
          >
            <ChevronLeft size={24} />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">TAKE PICTURES/VIDEOS</h1>
        </div>
        
        {/* Preview Area */}
        <div className="bg-card/50 rounded-lg p-4 mb-6 min-h-[200px]">
          <h2 className="text-lg font-medium text-foreground mb-4">Captured Media</h2>
          
          {capturedMedia.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No photos or videos captured yet
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {capturedMedia.map((media, index) => (
                <div key={index} className="relative bg-muted rounded-lg p-4 flex items-center justify-center">
                  <div className="text-center">
                    {media.includes('video') ? (
                      <Video className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    ) : (
                      <Camera className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    )}
                    <p className="text-xs text-muted-foreground">
                      {media.includes('video') ? 'Video' : 'Photo'} {index + 1}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleDeleteMedia(index)}
                    variant="ghost"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 bg-destructive text-destructive-foreground rounded-full"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Camera Controls */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <Button
            onClick={handleTakePhoto}
            className="h-12 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Camera className="w-4 h-4 mr-2" />
            Take Photo
          </Button>
          
          <Button
            onClick={handleTakeVideo}
            className="h-12 bg-secondary text-secondary-foreground hover:bg-secondary/90"
          >
            <Video className="w-4 h-4 mr-2" />
            Take Video
          </Button>
        </div>
        
        <div className="space-y-3">
          <Button
            onClick={() => setShowFinishModal(true)}
            className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={capturedMedia.length === 0}
          >
            FINISH
          </Button>
          
          <Button
            onClick={onHelp}
            variant="outline"
            className="w-full h-12"
          >
            HELP
          </Button>
        </div>
      </div>
      
      {/* Finish Modal */}
      <Dialog open={showFinishModal} onOpenChange={setShowFinishModal}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-semibold">
              All required photos captured
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 pt-4">
            <Button
              onClick={onFinish}
              className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Confirm
            </Button>
            
            <Button
              onClick={() => setShowFinishModal(false)}
              variant="outline"
              className="w-full h-12"
            >
              Back
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TakePicturesScreen;