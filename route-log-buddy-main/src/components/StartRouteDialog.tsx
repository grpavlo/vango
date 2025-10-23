import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';

interface StartRouteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const StartRouteDialog = ({ isOpen, onClose, onConfirm }: StartRouteDialogProps) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="bg-background border border-border z-50">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-textPrimary">
            Ready to Start Route?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-textSecondary">
            Are you ready to start this route? You'll need to select a vehicle next.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={onClose}
            className="border-border text-textSecondary hover:bg-muted"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-primary hover:bg-primary/90 text-onPrimary"
          >
            Yes, Start
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default StartRouteDialog;