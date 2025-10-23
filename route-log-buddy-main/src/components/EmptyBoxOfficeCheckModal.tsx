import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';

interface EmptyBoxOfficeCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOfficeOpen: () => void;
  onOfficeClosed: () => void;
}

const EmptyBoxOfficeCheckModal = ({
  isOpen,
  onClose,
  onOfficeOpen,
  onOfficeClosed
}: EmptyBoxOfficeCheckModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-lg font-semibold">
            CHECK IF THE OFFICE IS OPEN
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 pt-4">
          <Button
            onClick={onOfficeOpen}
            className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            OPEN
          </Button>
          
          <Button
            onClick={onOfficeClosed}
            className="w-full h-12 bg-secondary text-secondary-foreground hover:bg-secondary/90"
          >
            CLOSED
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmptyBoxOfficeCheckModal;