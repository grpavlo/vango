import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';

interface OtherIssuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOk: () => void;
}

const OtherIssuesModal = ({
  isOpen,
  onClose,
  onOk
}: OtherIssuesModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-lg font-semibold mb-4">
            ATTENTION!!!
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-center text-foreground">
            Please describe the situation in detail and take photos of the area and the building to document the issue.
          </p>
          
          <Button
            onClick={onOk}
            className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            OK
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OtherIssuesModal;