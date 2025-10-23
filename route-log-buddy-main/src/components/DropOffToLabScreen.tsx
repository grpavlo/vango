import { useState } from 'react';
import { ChevronLeft, Trash2, ScanLine, Truck, AlertTriangle, CheckCircle, Package2 } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface ScannedSample {
  id: string;
  code: string;
  timestamp: Date;
  isSTAT?: boolean;
}

interface DropOffToLabScreenProps {
  onBack: () => void;
}

const DropOffToLabScreen = ({
  onBack
}: DropOffToLabScreenProps) => {
  const [scannedSamples, setScannedSamples] = useState<ScannedSample[]>([]);

  // Mock data for assigned samples count
  const assignedSamplesCount = 127;

  const handleScanSample = () => {
    // Simulate scanning a sample for drop-off
    const sampleCode = `SAM-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
    // Randomly determine if it's a STAT sample
    const isSTAT = sampleCode.includes('STAT') || Math.random() < 0.2; // 20% chance for demo

    const newSample: ScannedSample = {
      id: Date.now().toString(),
      code: isSTAT ? sampleCode.replace('SAM-', 'STAT-') : sampleCode,
      timestamp: new Date(),
      isSTAT
    };

    // Check for duplicates
    const isDuplicate = scannedSamples.some(sample => sample.code === newSample.code);
    if (isDuplicate) {
      toast.error("Sample already scanned", {
        duration: 2000
      });
      return;
    }
    setScannedSamples(prev => [...prev, newSample]);

    // Check if it's a STAT sample and show warning
    if (newSample.isSTAT) {
      toast.error("STAT sample detected! This must be handed directly to lab technician in person.", {
        duration: 4000,
        style: {
          backgroundColor: 'hsl(var(--destructive))'
        }
      });
    } else {
      toast.success("Sample ready for lab drop-off");
    }
  };

  const handleDeleteSample = (sampleId: string) => {
    setScannedSamples(prev => prev.filter(sample => sample.id !== sampleId));
  };

  const canConfirm = () => {
    return scannedSamples.length > 0;
  };

  const handleConfirmDropOff = () => {
    if (canConfirm()) {
      toast.success("Drop-off to lab confirmed successfully!");
      onBack();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Compact Header */}
      <div className="bg-background px-4 pt-2 pb-1">
        <div className="flex items-center gap-2 mb-2">
          <Button onClick={onBack} variant="ghost" size="icon" className="text-foreground hover:bg-muted h-8 w-8">
            <ChevronLeft size={18} />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">
            Drop Off to Lab
          </h1>
        </div>
      </div>

      {/* Scrollable Main Content */}
      <div className="flex-1 px-4 pb-28 overflow-y-auto space-y-2">
        
        {/* Compact STAT Warning */}
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="text-destructive flex-shrink-0" size={14} />
            <div>
              <h3 className="text-xs font-medium text-destructive">STAT Notice</h3>
              <p className="text-muted-foreground text-xs">"STAT: hand directly to lab tech — no drop-off."</p>
            </div>
          </div>
        </div>

        {/* Compact Driver Sample Count (shown after first scan) */}
        {scannedSamples.length > 0 && (
          <div className="bg-primary/10 border border-primary/20 rounded-md p-2">
            <div className="flex items-center gap-1.5">
              <Package2 className="text-primary flex-shrink-0" size={14} />
              <h3 className="text-xs font-medium text-primary">Your Load: {assignedSamplesCount} samples</h3>
            </div>
          </div>
        )}

        {/* Compact Samples Section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ScanLine size={16} className="text-primary" />
            <h2 className="text-sm font-medium text-foreground">Samples for Lab Drop-off</h2>
            <span className="bg-muted text-foreground px-2 py-0.5 rounded text-xs">
              {scannedSamples.length}
            </span>
          </div>
          
          {scannedSamples.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <ScanLine size={24} className="mx-auto mb-1 opacity-50" />
              <p className="text-xs">No samples scanned</p>
              <p className="text-xs">Use "Scan Sample" to add samples for lab drop-off</p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="max-h-80 overflow-y-auto space-y-1">
                {scannedSamples.map(sample => (
                  <div key={sample.id} className="flex items-center justify-between p-2 rounded-md bg-card border border-border">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      {sample.isSTAT && <CheckCircle size={12} className="text-destructive flex-shrink-0" />}
                      <span className={`text-xs font-mono truncate ${sample.isSTAT ? 'text-destructive font-semibold' : 'text-foreground'}`}>
                        {sample.code}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {sample.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {sample.isSTAT && (
                        <span className="text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full border border-destructive/20 flex-shrink-0">
                          MANUAL
                        </span>
                      )}
                    </div>
                    <button 
                      onClick={() => handleDeleteSample(sample.id)} 
                      className="text-muted-foreground hover:text-destructive p-1 transition-colors flex-shrink-0" 
                      title="Remove sample"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compact Fixed Bottom Action Bar */}
      <div className="fixed bottom-[calc(var(--nav-height)+0.5rem)] left-0 right-0 px-4">
        <div className="bg-card/95 backdrop-blur-sm rounded-lg border border-border p-2 mb-2">
          <Button 
            onClick={handleScanSample} 
            variant="outline" 
            className="w-full h-10 flex items-center justify-center gap-2 border-primary/50 text-primary hover:bg-primary/10"
          >
            <ScanLine size={14} />
            <span className="text-sm">Scan Sample</span>
          </Button>
        </div>

        {/* Compact Status and Confirm Button */}
        <div className="bg-card/95 backdrop-blur-sm rounded-lg border border-border p-3">
          <p className={`text-xs mb-2 text-center ${canConfirm() ? 'text-foreground' : 'text-muted-foreground'}`}>
            {scannedSamples.length === 0 ? "Scan samples to prepare for lab drop-off." : "Ready to confirm drop-off to lab."}
          </p>
          <Button 
            onClick={handleConfirmDropOff} 
            disabled={!canConfirm()} 
            className={`w-full h-10 ${canConfirm() ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
          >
            <Truck size={14} className="mr-2" />
            Confirm Drop-Off to Lab
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DropOffToLabScreen;