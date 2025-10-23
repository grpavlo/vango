import { useState } from 'react';
import { ChevronLeft, Camera } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';

interface NoSamplesFormScreenProps {
  onBack: () => void;
  onTakePictures: () => void;
  onHelp: () => void;
}

const NoSamplesFormScreen = ({
  onBack,
  onTakePictures,
  onHelp
}: NoSamplesFormScreenProps) => {
  const [personName, setPersonName] = useState('');
  const [note, setNote] = useState('');

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
          <h1 className="text-2xl font-bold text-foreground">No Samples Available</h1>
        </div>
        
        <div className="space-y-6 mb-8">
          <div className="space-y-2">
            <Label htmlFor="person-name" className="text-sm font-medium text-foreground">
              Name of the person you spoke with
            </Label>
            <Input
              id="person-name"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              placeholder="Enter person's name"
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="note" className="text-sm font-medium text-foreground">
              NOTE
            </Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any additional notes..."
              className="w-full min-h-[100px]"
            />
          </div>
        </div>
        
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground mb-2">NEXT STEP:</p>
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

export default NoSamplesFormScreen;