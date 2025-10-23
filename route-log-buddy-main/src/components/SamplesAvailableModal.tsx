import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';

interface SamplesAvailableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onYes: () => void;
  onNo: () => void;
}

const SamplesAvailableModal = ({
  isOpen,
  onClose,
  onYes,
  onNo
}: SamplesAvailableModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-lg font-semibold">
            DO THEY HAVE ANY SAMPLES?
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 pt-4">
          <Button
            onClick={onYes}
            className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            YES
          </Button>
          
          <Button
            onClick={onNo}
            className="w-full h-12 bg-secondary text-secondary-foreground hover:bg-secondary/90"
          >
            NO
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SamplesAvailableModal;