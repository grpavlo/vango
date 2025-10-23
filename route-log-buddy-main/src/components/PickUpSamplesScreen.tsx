import { useState } from 'react';
import { ChevronLeft, ChevronDown, ChevronRight, Package, Trash2, Plus, ScanLine, Target } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
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
interface PickUpSamplesScreenProps {
  onBack: () => void;
}
const PickUpSamplesScreen = ({
  onBack
}: PickUpSamplesScreenProps) => {
  const [scannedCodes, setScannedCodes] = useState<ScannedCode[]>([]);
  const [packages, setPackages] = useState<CodePackage[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [showPackages, setShowPackages] = useState(true);
  const [showSamples, setShowSamples] = useState(true);
  const [expandedPackage, setExpandedPackage] = useState<string | null>(null);
  const handleScanPackage = () => {
    // Simulate scanning a package barcode
    const newCode: ScannedCode = {
      id: Date.now().toString(),
      code: `PKG-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
      timestamp: new Date()
    };

    // Check for duplicates
    const isDuplicate = packages.some(pkg => pkg.barcode === newCode.code);
    if (isDuplicate) {
      toast.error("Package already scanned", {
        duration: 2000
      });
      return;
    }
    const newPackage: CodePackage = {
      id: Date.now().toString(),
      barcode: newCode.code,
      codes: [],
      name: `Package ${packages.length + 1}`,
      isActiveTarget: false
    };
    setPackages(prev => [...prev, newPackage]);
    toast.success(`Package ${newPackage.name} added`);
  };
  const handleScanSample = () => {
    // Simulate scanning a sample barcode
    const newCode: ScannedCode = {
      id: Date.now().toString(),
      code: `SAM-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
      timestamp: new Date()
    };

    // Check for duplicates
    const isDuplicate = scannedCodes.some(code => code.code === newCode.code) || packages.some(pkg => pkg.codes.some(code => code.code === newCode.code));
    if (isDuplicate) {
      toast.error("Sample already scanned", {
        duration: 2000
      });
      return;
    }

    // Find active target package
    const activePackage = packages.find(pkg => pkg.isActiveTarget);
    if (activePackage) {
      // Add directly to active package
      setPackages(prev => prev.map(pkg => pkg.id === activePackage.id ? {
        ...pkg,
        codes: [...pkg.codes, newCode]
      } : pkg));
      toast.success(`Sample added to ${activePackage.name}`);
    } else {
      // Add to unassigned samples
      setScannedCodes(prev => [...prev, newCode]);
      toast.success("Sample added to unassigned");
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
    setPackages(prev => prev.map(pkg => pkg.id === packageId ? {
      ...pkg,
      codes: [...pkg.codes, ...selectedCodesList]
    } : pkg));
    setScannedCodes(prev => prev.filter(code => !selectedCodes.has(code.id)));
    setSelectedCodes(new Set());
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
    const packageToDelete = packages.find(pkg => pkg.id === packageId);
    if (packageToDelete && packageToDelete.codes.length > 0) {
      setScannedCodes(prev => [...prev, ...packageToDelete.codes]);
    }
    setPackages(prev => prev.filter(pkg => pkg.id !== packageId));
  };
  const handleSetActiveTarget = (packageId: string) => {
    setPackages(prev => prev.map(pkg => ({
      ...pkg,
      isActiveTarget: pkg.id === packageId ? !pkg.isActiveTarget : false
    })));
  };
  const canConfirm = () => {
    const hasPackages = packages.length > 0;
    const hasSamples = packages.some(pkg => pkg.codes.length > 0);
    return hasPackages && hasSamples;
  };
  const handleConfirmPickUp = () => {
    if (canConfirm()) {
      toast.success("Pick-up confirmed successfully!");
      onBack();
    }
  };
  const hasSelectedCodes = selectedCodes.size > 0;
  return <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-background px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <Button onClick={onBack} variant="ghost" size="icon" className="text-foreground hover:bg-muted">
            <ChevronLeft size={24} />
          </Button>
          <h1 className="text-2xl font-semibold text-foreground">
            Pick Up Samples
          </h1>
        </div>
      </div>

      {/* Scrollable Main Content */}
      <div className="flex-1 px-4 pb-36 overflow-y-auto">{/* pb-36 = action bar + bottom menu + padding */}

        {/* Packages Section */}
        <div className="mb-6">
          <Collapsible open={showPackages} onOpenChange={setShowPackages}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-3 text-left text-foreground">
              {showPackages ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              <h2 className="text-lg font-medium text-foreground">Packages</h2>
              <span className="bg-muted text-foreground px-2 py-1 rounded text-sm ml-1">
                {packages.length}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {packages.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                  <Package size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No packages scanned yet</p>
                  <p className="text-xs">Use "Scan Packages" to add</p>
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
                            Active
                          </span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleSetActiveTarget(pkg.id)} className={`p-1 rounded transition-colors ${pkg.isActiveTarget ? 'text-primary hover:text-primary/80' : 'text-muted-foreground hover:text-primary'}`} title="Set as active target">
                          <Target size={14} />
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
              <h2 className="text-lg font-medium text-foreground">Consolidate Packages</h2>
              <span className="bg-muted text-foreground px-2 py-1 rounded text-sm ml-1">
                {scannedCodes.length}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
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
                              Add to {pkg.name}
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
            <Button onClick={handleScanPackage} variant="outline" className="h-12 flex flex-col items-center justify-center gap-1 border-primary/50 text-primary hover:bg-primary/10">
              <Package size={16} />
              <span className="text-xs">Scan Packages</span>
            </Button>
            <Button onClick={handleScanSample} variant="outline" className="h-12 flex flex-col items-center justify-center gap-1 border-primary/50 text-primary hover:bg-primary/10">
              <ScanLine size={16} />
              <span className="text-xs">Scan Samples</span>
            </Button>
          </div>
        </div>

        {/* Status and Confirm Button */}
        <div className="bg-card/95 backdrop-blur-sm rounded-lg border border-border p-4">
          <p className={`text-sm mb-3 text-center ${canConfirm() ? 'text-foreground' : 'text-muted-foreground'}`}>
            {packages.length === 0 ? "Scan packages first, then add samples." : !packages.some(pkg => pkg.codes.length > 0) ? "Add samples to packages to continue." : "Ready to confirm pick-up."}
          </p>
          <Button onClick={handleConfirmPickUp} disabled={!canConfirm()} className={`w-full ${canConfirm() ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : ''}`}>
            Confirm Pick-Up
          </Button>
        </div>
      </div>
    </div>;
};
export default PickUpSamplesScreen;