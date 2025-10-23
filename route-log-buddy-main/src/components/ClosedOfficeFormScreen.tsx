import { useState } from 'react';
import { ChevronLeft, Camera } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';

interface ClosedOfficeFormScreenProps {
  onBack: () => void;
  onTakePictures: () => void;
  onHelp: () => void;
}

const ClosedOfficeFormScreen = ({
  onBack,
  onTakePictures,
  onHelp
}: ClosedOfficeFormScreenProps) => {
  const [description, setDescription] = useState('');

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
          <h1 className="text-2xl font-bold text-foreground">Office Closed</h1>
        </div>
        
        <div className="space-y-6 mb-8">
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium text-foreground">
              TELL US WHAT HAPPENED AND TAKE PICTURES/VIDEOS OF THE BUILDING
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what happened..."
              className="w-full min-h-[120px]"
            />
          </div>
        </div>
        
        <div className="space-y-3">
          <Button
            onClick={onTakePictures}
            className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Camera className="w-4 h-4 mr-2" />
            TAKE PICTURES
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
    </div>
  );
};

export default ClosedOfficeFormScreen;