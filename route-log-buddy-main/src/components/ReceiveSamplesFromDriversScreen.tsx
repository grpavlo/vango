import { FormEvent, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronDown, ChevronRight, Package, Trash2, Plus, ScanLine, Target } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
interface ScannedCode {
  id: string;
  code: string;
  timestamp: Date;
}
interface CodePackage {
  id: string;
  barcode: string;
  codes: ScannedCode[];
  name: string;
  isActiveTarget?: boolean;
}
interface ReceiveSamplesFromDriversScreenProps {
  onBack: () => void;
  copyOverrides?: Partial<CopyText>;
}

export interface CopyText {
  title: string;
  confirmButtonLabel: string;
  confirmSuccessToast: string;
}

type ScanMode = 'package' | 'sample';
const DEFAULT_COPY: CopyText = {
  title: 'Receive Samples from Drivers',
  confirmButtonLabel: 'Confirm Receipt',
  confirmSuccessToast: 'Receipt confirmed successfully!'
};
const ReceiveSamplesFromDriversScreen = ({
  onBack,
  copyOverrides
}: ReceiveSamplesFromDriversScreenProps) => {
  const copy = {
    ...DEFAULT_COPY,
    ...copyOverrides
  };
  const [scannedCodes, setScannedCodes] = useState<ScannedCode[]>([]);
  const [packages, setPackages] = useState<CodePackage[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(() => new Set());
  const [showPackages, setShowPackages] = useState(true);
  const [showSamples, setShowSamples] = useState(true);
  const [expandedPackage, setExpandedPackage] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<ScanMode>('package');
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [scanInputValue, setScanInputValue] = useState('');
  const scanInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!scanDialogOpen) {
      return;
    }
    const timer = setTimeout(() => {
      scanInputRef.current?.focus();
      scanInputRef.current?.select();
    }, 80);
    return () => clearTimeout(timer);
  }, [scanDialogOpen, scanMode]);

  const handleScanPackage = (input?: string) => {
    const provided = input?.trim();
    if (input !== undefined && !provided) {
      toast.error("Enter a package barcode to continue.", {
        duration: 2000
      });
      return false;
    }

    const generated = `PKG-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const normalizedCode = (provided ?? generated).toUpperCase();

    let duplicate = false;
    let createdPackage: CodePackage | null = null;

    setPackages(prev => {
      if (prev.some(pkg => pkg.barcode === normalizedCode)) {
        duplicate = true;
        return prev;
      }

      const shouldActivate = prev.length === 0 || prev.every(pkg => !pkg.isActiveTarget);
      const nextPackage: CodePackage = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        barcode: normalizedCode,
        codes: [],
        name: `Package ${prev.length + 1}`,
        isActiveTarget: shouldActivate
      };

      createdPackage = nextPackage;

      const baseline = shouldActivate ? prev.map(pkg => ({
        ...pkg,
        isActiveTarget: false
      })) : [...prev];

      return [...baseline, nextPackage];
    });

    if (duplicate) {
      toast.error("Package already scanned", {
        duration: 2000
      });
      return false;
    }

    if (createdPackage) {
      toast.success(`Package ${createdPackage.name} added`);
    }

    return true;
  };

  const handleScanSample = (input?: string) => {
    const provided = input?.trim();
    if (input !== undefined && !provided) {
      toast.error("Enter a sample barcode to continue.", {
        duration: 2000
      });
      return false;
    }

    const generated = `SAM-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const normalizedCode = (provided ?? generated).toUpperCase();

    const isDuplicate = scannedCodes.some(code => code.code === normalizedCode) || packages.some(pkg => pkg.codes.some(code => code.code === normalizedCode));
    if (isDuplicate) {
      toast.error("Sample already scanned", {
        duration: 2000
      });
      return false;
    }

    const newSample: ScannedCode = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      code: normalizedCode,
      timestamp: new Date()
    };

    const activePackage = packages.find(pkg => pkg.isActiveTarget);
    if (activePackage) {
      setPackages(prev => prev.map(pkg => pkg.id === activePackage.id ? {
        ...pkg,
        codes: [...pkg.codes, newSample]
      } : pkg));
      toast.success(`Sample added to ${activePackage.name}`);
    } else {
      setScannedCodes(prev => [...prev, newSample]);
      toast.success("Sample added to unassigned");
    }

    return true;
  };

  const handleScanDialogChange = (open: boolean) => {
    setScanDialogOpen(open);
    if (!open) {
      setScanInputValue('');
    }
  };

  const handleOpenScan = (mode: ScanMode) => {
    setScanMode(mode);
    setScanInputValue('');
    setScanDialogOpen(true);
  };

  const handleScanSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const success = scanMode === 'package' ? handleScanPackage(scanInputValue) : handleScanSample(scanInputValue);

    if (success) {
      setScanInputValue('');
      setTimeout(() => {
        scanInputRef.current?.focus();
        scanInputRef.current?.select();
      }, 0);
    }
  };

  const handleDeleteCode = (codeId: string) => {
    setScannedCodes(prev => prev.filter(code => code.id !== codeId));
    setSelectedCodes(prev => {
      const newSet = new Set(prev);
      newSet.delete(codeId);
      return newSet;
    });
  };
  const handleToggleCodeSelection = (codeId: string) => {
    setSelectedCodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(codeId)) {
        newSet.delete(codeId);
      } else {
        newSet.add(codeId);
      }
      return newSet;
    });
  };
  const handleGroupCodes = (packageId: string) => {
    if (packages.length === 0) {
      toast.error("Create a package first");
      return;
    }
    const selectedCodesList = scannedCodes.filter(code => selectedCodes.has(code.id));
    if (selectedCodesList.length === 0) {
      toast.error("Select at least one sample to add to a package");
      return;
    }
    setPackages(prev => prev.map(pkg => pkg.id === packageId ? {
      ...pkg,
      codes: [...pkg.codes, ...selectedCodesList]
    } : pkg));
    setScannedCodes(prev => prev.filter(code => !selectedCodes.has(code.id)));
    setSelectedCodes(() => new Set<string>());
    toast.success(`${selectedCodesList.length} sample${selectedCodesList.length !== 1 ? 's' : ''} added to package`);
  };
  const handleUngroupCode = (packageId: string, codeId: string) => {
    const codeToMove = packages.find(pkg => pkg.id === packageId)?.codes.find(code => code.id === codeId);
    if (codeToMove) {
      setPackages(prev => prev.map(pkg => pkg.id === packageId ? {
        ...pkg,
        codes: pkg.codes.filter(code => code.id !== codeId)
      } : pkg));
      setScannedCodes(prev => [...prev, codeToMove]);
    }
  };
  const handleDeletePackage = (packageId: string) => {
    const packageExists = packages.some(pkg => pkg.id === packageId);
    if (!packageExists) {
      toast.error("Package not found");
      return;
    }

    let returningSamples: ScannedCode[] = [];
    let removedWasActive = false;

    setPackages(prev => {
      const remaining: CodePackage[] = [];
      prev.forEach(pkg => {
        if (pkg.id === packageId) {
          returningSamples = pkg.codes;
          removedWasActive = !!pkg.isActiveTarget;
        } else {
          remaining.push(pkg);
        }
      });

      if (removedWasActive && remaining.length > 0) {
        return remaining.map((pkg, index) => ({
          ...pkg,
          isActiveTarget: index === 0
        }));
      }

      return remaining;
    });

    if (returningSamples.length > 0) {
      setScannedCodes(prev => [...prev, ...returningSamples]);
      setSelectedCodes(prev => {
        const newSet = new Set(prev);
        returningSamples.forEach(sample => newSet.delete(sample.id));
        return newSet;
      });
    }

    if (expandedPackage === packageId) {
      setExpandedPackage(null);
    }

    const sampleInfo = returningSamples.length > 0 ? ` and ${returningSamples.length} sample${returningSamples.length !== 1 ? 's' : ''} moved to unassigned` : '';
    toast.success(`Package removed${sampleInfo}`);
  };
  const handleSetActiveTarget = (packageId: string) => {
    let activated = false;
    let activatedName = '';

    setPackages(prev => prev.map(pkg => {
      if (pkg.id === packageId) {
        const nextActive = !pkg.isActiveTarget;
        if (nextActive) {
          activated = true;
          activatedName = pkg.name;
        }
        return {
          ...pkg,
          isActiveTarget: nextActive
        };
      }
      return {
        ...pkg,
        isActiveTarget: false
      };
    }));

    if (activated) {
      toast.success(`${activatedName} ready to receive scans`);
    } else {
      toast("Scans will go to unassigned until a package is selected.");
    }
  };
  const canConfirm = () => {
    const hasPackages = packages.length > 0;
    const hasSamples = packages.some(pkg => pkg.codes.length > 0);
    return hasPackages && hasSamples;
  };
  const handleConfirmAction = () => {
    if (canConfirm()) {
      toast.success(copy.confirmSuccessToast);
      onBack();
    }
  };
  const hasSelectedCodes = selectedCodes.size > 0;
  const activeTarget = packages.find(pkg => pkg.isActiveTarget);
  return <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-background px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <Button onClick={onBack} variant="ghost" size="icon" className="text-foreground hover:bg-muted">
            <ChevronLeft size={24} />
          </Button>
          <h1 className="text-2xl font-semibold text-foreground">
            {copy.title}
          </h1>
        </div>
      </div>

      {/* Scrollable Main Content */}
      <div className="flex-1 px-4 pb-36 overflow-y-auto">{/* pb-36 = action bar + bottom menu + padding */}

        <div className="mb-6 bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm text-muted-foreground">
          <p className="text-foreground font-medium mb-2">Driver-to-Driver Transfer</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Scan or enter each sealed bag first so everyone agrees which package is active.</li>
            <li>Tap <span className="font-semibold">Set Receiving</span> to lock a package before scanning samples into it automatically.</li>
            <li>If a package is removed, all contained samples move back to the unassigned queue for reassignment.</li>
            <li>With a package selected, scan individual samples to place them inside automatically.</li>
          </ul>
        </div>

        {/* Packages Section */}
        <div className="mb-6">
          <Collapsible open={showPackages} onOpenChange={setShowPackages}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-3 text-left text-foreground">
              {showPackages ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              <h2 className="text-lg font-medium text-foreground">Incoming Packages</h2>
              <span className="bg-muted text-foreground px-2 py-1 rounded text-sm ml-1">
                {packages.length}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {packages.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                  <Package size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No driver packages yet</p>
                  <p className="text-xs">Use "Scan Packages" to register incoming packages.</p>
                </div> : packages.map(pkg => <div key={pkg.id} className={`bg-card rounded-lg p-3 border transition-all ${pkg.isActiveTarget ? 'border-primary bg-primary/10' : 'border-border'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Package size={16} className="text-primary" />
                          {pkg.isActiveTarget && <Target size={12} className="text-primary" />}
                        </div>
                        <span className="text-sm text-foreground font-semibold">
                          {pkg.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({pkg.codes.length} samples)
                        </span>
                        {pkg.isActiveTarget && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                            Receiving
                          </span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-pressed={pkg.isActiveTarget}
                          onClick={() => handleSetActiveTarget(pkg.id)}
                          className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${pkg.isActiveTarget ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border border-primary/60 text-primary hover:bg-primary/10'}`}
                        >
                          <Target size={12} />
                          {pkg.isActiveTarget ? 'Receiving' : 'Set Receiving'}
                        </button>
                        <button onClick={() => handleDeletePackage(pkg.id)} className="text-destructive hover:text-destructive/80 p-1 transition-colors" title="Remove package">
                          <Trash2 size={14} />
                        </button>
                        <button onClick={() => setExpandedPackage(expandedPackage === pkg.id ? null : pkg.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                          {expandedPackage === pkg.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground font-mono mb-2">
                      {pkg.barcode}
                    </p>
                    
                    {expandedPackage === pkg.id && <div className="space-y-1 mt-2 pt-2 border-t border-border">
                        {pkg.codes.length === 0 ? <span className="text-xs text-muted-foreground italic">
                            No samples in this package
                          </span> : <>
                            <span className="text-xs text-muted-foreground">
                              Package Contents:
                            </span>
                            {pkg.codes.map(code => <div key={code.id} className="flex items-center justify-between p-2 bg-muted rounded">
                                <span className="text-xs font-mono text-foreground">
                                  {code.code}
                                </span>
                                <button onClick={() => handleUngroupCode(pkg.id, code.id)} className="text-muted-foreground hover:text-destructive transition-colors" title="Remove from package">
                                  <Trash2 size={12} />
                                </button>
                              </div>)}
                          </>}
                      </div>}
                  </div>)}
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Samples (Unassigned) Section */}
        <div className="mb-6">
          <Collapsible open={showSamples} onOpenChange={setShowSamples}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-3 text-left text-foreground">
              {showSamples ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              <h2 className="text-lg font-medium text-foreground">Unassigned Samples</h2>
              <span className="bg-muted text-foreground px-2 py-1 rounded text-sm ml-1">
                {scannedCodes.length}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {packages.length > 0 && <div className="flex items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                  <Target size={12} className="text-primary" />
                  <span>
                    {activeTarget ? `Scanning will add samples directly to ${activeTarget.name}.` : "Set a package as the receiving target so scans route there automatically."}
                  </span>
                </div>}
              {scannedCodes.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                  <ScanLine size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No unassigned samples</p>
                  <p className="text-xs">Use "Scan Samples" to add</p>
                </div> : <div className="space-y-2">
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {scannedCodes.map(code => <div key={code.id} onClick={() => handleToggleCodeSelection(code.id)} className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${selectedCodes.has(code.id) ? 'bg-primary/20 border border-primary' : 'bg-card border border-border hover:bg-card/80'}`}>
                        <span className={`text-sm font-mono ${selectedCodes.has(code.id) ? 'text-foreground' : 'text-foreground'}`}>
                          {code.code}
                        </span>
                        <button onClick={e => {
                    e.stopPropagation();
                    handleDeleteCode(code.id);
                  }} className="text-muted-foreground hover:text-destructive p-1 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>)}
                  </div>
                  
                  {hasSelectedCodes && <div className="mt-4 p-3 bg-primary/20 rounded-lg border border-primary/30">
                      <p className="text-sm text-foreground mb-3">
                        {selectedCodes.size} sample{selectedCodes.size !== 1 ? 's' : ''} selected
                      </p>
                      {packages.length === 0 ? <p className="text-xs text-muted-foreground">
                          Scan a package first to group samples
                        </p> : <div className="flex gap-2 flex-wrap">
                          {packages.map(pkg => <Button key={pkg.id} onClick={() => handleGroupCodes(pkg.id)} variant="outline" size="sm" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all">
                              <Plus size={12} className="mr-1" />
                              Assign to {pkg.name}
                            </Button>)}
                        </div>}
                    </div>}
                </div>}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-[calc(var(--nav-height)+1rem)] left-0 right-0 px-4">
        <div className="bg-card/95 backdrop-blur-sm rounded-lg border border-border p-3 mb-3">
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => handleOpenScan('package')} variant="outline" className="h-12 flex flex-col items-center justify-center gap-1 border-primary/50 text-primary hover:bg-primary/10">
              <Package size={16} />
              <span className="text-xs">Scan Packages</span>
            </Button>
            <Button onClick={() => handleOpenScan('sample')} variant="outline" className="h-12 flex flex-col items-center justify-center gap-1 border-primary/50 text-primary hover:bg-primary/10">
              <ScanLine size={16} />
              <span className="text-xs">Scan Samples</span>
            </Button>
          </div>
        </div>

        {/* Status and Confirm Button */}
        <div className="bg-card/95 backdrop-blur-sm rounded-lg border border-border p-4">
          <p className={`text-sm mb-3 text-center ${canConfirm() ? 'text-foreground' : 'text-muted-foreground'}`}>
            {packages.length === 0 ? "Scan packages first, then assign samples." : !packages.some(pkg => pkg.codes.length > 0) ? "Add samples to packages to continue." : "Ready to confirm receipt."}
          </p>
          <Button onClick={handleConfirmAction} disabled={!canConfirm()} className={`w-full ${canConfirm() ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : ''}`}>
            {copy.confirmButtonLabel}
          </Button>
        </div>
      </div>

      <Dialog open={scanDialogOpen} onOpenChange={handleScanDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{scanMode === 'package' ? 'Scan Package' : 'Scan Sample'}</DialogTitle>
            <DialogDescription>
              Use your scanner or type the barcode, then press Enter to add it.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleScanSubmit} className="space-y-4">
            <Input
              ref={scanInputRef}
              value={scanInputValue}
              onChange={event => setScanInputValue(event.target.value)}
              placeholder={scanMode === 'package' ? 'Enter package barcode' : 'Enter sample barcode'}
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleScanDialogChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={scanInputValue.trim().length === 0}>
                Add {scanMode === 'package' ? 'Package' : 'Sample'}
              </Button>
            </DialogFooter>
          </form>
          {scanMode === 'sample' && activeTarget && <p className="mt-3 text-xs text-muted-foreground">
              Samples scanned while {activeTarget.name} is active go straight into that package.
            </p>}
        </DialogContent>
      </Dialog>
    </div>;
};
export default ReceiveSamplesFromDriversScreen;
