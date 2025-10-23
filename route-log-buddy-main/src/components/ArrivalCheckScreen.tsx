import { Package, AlertTriangle, Search, HelpCircle, FileText } from 'lucide-react';
import { Button } from './ui/button';

interface ArrivalCheckScreenProps {
  onPickUpSamples: () => void;
  onEmptyBox: () => void;
  onUnableToFind: () => void;
  onOtherIssues: () => void;
  onVisitNotes: () => void;
  onHelp: () => void;
}

const ArrivalCheckScreen = ({
  onPickUpSamples,
  onEmptyBox,
  onUnableToFind,
  onOtherIssues,
  onVisitNotes,
  onHelp
}: ArrivalCheckScreenProps) => {
  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 pt-6 pb-24">
        <h1 className="text-2xl font-bold text-foreground mb-8">Arrival / Check</h1>
        
        <div className="space-y-4 mb-12">
          <Button
            onClick={onPickUpSamples}
            className="w-full h-14 bg-primary text-primary-foreground hover:bg-primary/90 text-left justify-start px-6"
          >
            <Package className="w-5 h-5 mr-3" />
            PICK UP SAMPLES
          </Button>
          
          <Button
            onClick={onEmptyBox}
            className="w-full h-14 bg-orange-600 text-white hover:bg-orange-700 text-left justify-start px-6"
          >
            <Package className="w-5 h-5 mr-3" />
            EMPTY BOX
          </Button>
          
          <Button
            onClick={onUnableToFind}
            className="w-full h-14 bg-red-600 text-white hover:bg-red-700 text-left justify-start px-6"
          >
            <Search className="w-5 h-5 mr-3" />
            UNABLE TO FIND THE BOX
          </Button>
          
          <Button
            onClick={onOtherIssues}
            className="w-full h-14 bg-yellow-600 text-white hover:bg-yellow-700 text-left justify-start px-6"
          >
            <AlertTriangle className="w-5 h-5 mr-3" />
            OTHER ISSUES
          </Button>
        </div>
        
        <div className="border-t border-border pt-6 space-y-3">
          <Button
            onClick={onVisitNotes}
            variant="outline"
            className="w-full h-12 justify-start px-6"
          >
            <FileText className="w-4 h-4 mr-3" />
            VISIT NOTES
          </Button>
          
          <Button
            onClick={onHelp}
            variant="outline"
            className="w-full h-12 justify-start px-6"
          >
            <HelpCircle className="w-4 h-4 mr-3" />
            HELP
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ArrivalCheckScreen;