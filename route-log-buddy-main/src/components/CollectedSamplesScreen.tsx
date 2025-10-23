import { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, Package, TestTube, History, Shuffle, Check, Undo2, ScanLine } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { useToast } from './ui/use-toast';
interface Sample {
  type: 'sample';
  id: string;
  title: string;
  createdAt?: string;
  createdBy?: string;
  checkpoint?: string;
  history?: HistoryItem[];
}
interface Package {
  type: 'package';
  id: string;
  title: string;
  children: (Sample | Package)[];
  createdAt?: string;
  createdBy?: string;
  checkpoint?: string;
  history?: HistoryItem[];
}
interface HistoryItem {
  timestamp: string;
  action: string;
  user: string;
  checkpoint: string;
}
interface CollectedSamplesScreenProps {
  onBack: () => void;
}
const sampleData: Package[] = [{
  type: "package",
  id: "pkg1",
  title: "Package A",
  children: Array.from({
    length: 10
  }, (_, i) => ({
    type: "sample" as const,
    id: `sA${i + 1}`,
    title: `Sample A${i + 1}`,
    createdAt: `2025-07-31T${String(9 + Math.floor(i / 2)).padStart(2, '0')}:${String(15 + i * 5 % 60).padStart(2, '0')}`,
    createdBy: ["User X", "User Y", "User Z"][i % 3],
    checkpoint: `CP ${5 + i}`,
    history: i % 3 === 0 ? [{
      timestamp: `2025-07-31T${String(10 + Math.floor(i / 2)).padStart(2, '0')}:00`,
      action: "Moved to Package A",
      user: "User Y",
      checkpoint: `CP ${6 + i}`
    }] : undefined
  }))
}, {
  type: "package",
  id: "pkg2",
  title: "Package B",
  children: [{
    type: "package" as const,
    id: "pkg2-1",
    title: "Sub-Package B1",
    children: [{
      type: "package" as const,
      id: "pkg2-1-1",
      title: "Sub-Sub-Package B1a",
      children: Array.from({
        length: 5
      }, (_, i) => ({
        type: "sample" as const,
        id: `sB1a${i + 1}`,
        title: `Sample B1a${i + 1}`,
        createdAt: `2025-07-31T${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${String(30 + i * 8 % 60).padStart(2, '0')}`,
        createdBy: ["User P", "User Q", "User R"][i % 3],
        checkpoint: `CP ${40 + i}`,
        history: [{
          timestamp: `2025-07-31T${String(9 + Math.floor(i / 2)).padStart(2, '0')}:00`,
          action: "Collected from Sub-Sub-Package B1a",
          user: "User P",
          checkpoint: `CP ${41 + i}`
        }]
      }))
    }, ...Array.from({
      length: 3
    }, (_, i) => ({
      type: "sample" as const,
      id: `sB1${i + 1}`,
      title: `Sample B1-${i + 1}`,
      createdAt: `2025-07-31T${String(10 + Math.floor(i / 2)).padStart(2, '0')}:${String(45 + i * 6 % 60).padStart(2, '0')}`,
      createdBy: ["User M", "User N", "User O"][i % 3],
      checkpoint: `CP ${30 + i}`,
      history: i % 2 === 0 ? [{
        timestamp: `2025-07-31T${String(11 + Math.floor(i / 2)).padStart(2, '0')}:00`,
        action: "Processed in Sub-Package B1",
        user: "User M",
        checkpoint: `CP ${31 + i}`
      }] : undefined
    }))]
  }, ...Array.from({
    length: 7
  }, (_, i) => ({
    type: "sample" as const,
    id: `sB${i + 1}`,
    title: `Sample B${i + 1}`,
    createdAt: `2025-07-31T${String(11 + Math.floor(i / 2)).padStart(2, '0')}:${String(20 + i * 7 % 60).padStart(2, '0')}`,
    createdBy: ["User A", "User B", "User C"][i % 3],
    checkpoint: `CP ${15 + i}`,
    history: i % 2 === 0 ? [{
      timestamp: `2025-07-31T${String(12 + Math.floor(i / 2)).padStart(2, '0')}:00`,
      action: "Quality check completed",
      user: "User B",
      checkpoint: `CP ${16 + i}`
    }] : undefined
  }))]
}, {
  type: "package",
  id: "pkg3",
  title: "Package C",
  children: Array.from({
    length: 12
  }, (_, i) => ({
    type: "sample" as const,
    id: `sC${i + 1}`,
    title: `Sample C${i + 1}`,
    createdAt: `2025-07-31T${String(13 + Math.floor(i / 3)).padStart(2, '0')}:${String(10 + i * 4 % 60).padStart(2, '0')}`,
    createdBy: ["User D", "User E", "User F"][i % 3],
    checkpoint: `CP ${25 + i}`,
    history: i % 4 === 0 ? [{
      timestamp: `2025-07-31T${String(14 + Math.floor(i / 3)).padStart(2, '0')}:00`,
      action: "Moved to Package C",
      user: "User E",
      checkpoint: `CP ${26 + i}`
    }, {
      timestamp: `2025-07-31T${String(14 + Math.floor(i / 3)).padStart(2, '0')}:30`,
      action: "Processing completed",
      user: "User F",
      checkpoint: `CP ${27 + i}`
    }] : undefined
  }))
}];
const CollectedSamplesScreen = ({
  onBack
}: CollectedSamplesScreenProps) => {
  const [data, setData] = useState<Package[]>(sampleData);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['pkg1', 'pkg2', 'pkg3']));
  const [selectedSample, setSelectedSample] = useState<Sample | Package | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  // Repackaging states
  const [repackMode, setRepackMode] = useState<'main' | 'source' | 'target' | 'scanning'>('main');
  const [sourcePackage, setSourcePackage] = useState<Package | null>(null);
  const [targetPackage, setTargetPackage] = useState<Package | null>(null);
  const [scannedSamples, setScannedSamples] = useState<string[]>([]);
  const [lastMoveOperation, setLastMoveOperation] = useState<{
    samples: Sample[];
    fromPackage: Package;
    toPackage: Package;
  } | null>(null);
  
  const { toast } = useToast();

  // Calculate totals
  const getTotalSamples = (packages: Package[]): number => {
    let count = 0;
    const traverse = (items: (Sample | Package)[]) => {
      items.forEach(item => {
        if (item.type === 'sample') {
          count++;
        } else {
          traverse(item.children);
        }
      });
    };
    traverse(packages);
    return count;
  };

  const getTotalPackages = (packages: Package[]): number => {
    return packages.length; // Only count top-level packages
  };

  // Repackaging utility functions
  const getAllPackages = (packages: Package[]): Package[] => {
    const result: Package[] = [];
    const traverse = (items: (Sample | Package)[]) => {
      items.forEach(item => {
        if (item.type === 'package') {
          result.push(item);
          traverse(item.children);
        }
      });
    };
    traverse(packages);
    return result;
  };

  const getSamplesFromPackage = (pkg: Package): Sample[] => {
    const samples: Sample[] = [];
    const traverse = (items: (Sample | Package)[]) => {
      items.forEach(item => {
        if (item.type === 'sample') {
          samples.push(item);
        } else {
          traverse(item.children);
        }
      });
    };
    traverse(pkg.children);
    return samples;
  };

  const moveSamples = (sampleIds: string[], fromPackageId: string, toPackageId: string) => {
    const newData = [...data];
    const allPackages = getAllPackages(newData);
    const fromPkg = allPackages.find(p => p.id === fromPackageId);
    const toPkg = allPackages.find(p => p.id === toPackageId);
    
    if (!fromPkg || !toPkg) return;

    const samplesToMove: Sample[] = [];
    const removeSamplesFromPackage = (pkg: Package, ids: string[]) => {
      pkg.children = pkg.children.filter(child => {
        if (child.type === 'sample' && ids.includes(child.id)) {
          samplesToMove.push(child);
          return false;
        } else if (child.type === 'package') {
          removeSamplesFromPackage(child, ids);
        }
        return true;
      });
    };

    removeSamplesFromPackage(fromPkg, sampleIds);
    toPkg.children.push(...samplesToMove);

    setData(newData);
    setLastMoveOperation({
      samples: samplesToMove,
      fromPackage: fromPkg,
      toPackage: toPkg,
    });

    toast({
      title: "Samples moved successfully",
      description: `Moved ${samplesToMove.length} sample(s) from ${fromPkg.title} to ${toPkg.title}`,
      action: (
        <Button variant="outline" size="sm" onClick={undoLastMove}>
          <Undo2 className="h-3 w-3 mr-1" />
          Undo
        </Button>
      ),
    });

    // Reset repack mode
    setRepackMode('main');
    setSourcePackage(null);
    setTargetPackage(null);
    setScannedSamples([]);
  };

  const undoLastMove = () => {
    if (!lastMoveOperation) return;

    const newData = [...data];
    const allPackages = getAllPackages(newData);
    const fromPkg = allPackages.find(p => p.id === lastMoveOperation.fromPackage.id);
    const toPkg = allPackages.find(p => p.id === lastMoveOperation.toPackage.id);

    if (!fromPkg || !toPkg) return;

    // Remove samples from target package
    toPkg.children = toPkg.children.filter(child => 
      !(child.type === 'sample' && lastMoveOperation.samples.some(s => s.id === child.id))
    );

    // Add samples back to source package
    fromPkg.children.push(...lastMoveOperation.samples);

    setData(newData);
    setLastMoveOperation(null);

    toast({
      title: "Move undone",
      description: `Restored ${lastMoveOperation.samples.length} sample(s) to ${lastMoveOperation.fromPackage.title}`,
    });
  };

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };
  const handleItemClick = (item: Sample | Package) => {
    setSelectedSample(item);
  };
  const handleViewHistory = () => {
    setShowHistoryModal(true);
  };
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  const BASE_LEFT = 16;
  const INDENT = 16;
  const renderItem = (item: Sample | Package, level: number = 0): React.ReactNode => {
    if (item.type === 'sample') {
      return <Card key={item.id} className="cursor-pointer hover:bg-accent/50 transition-all duration-200 ease-in-out" onClick={() => handleItemClick(item)} style={{
        marginLeft: `${BASE_LEFT + level * INDENT}px`,
        marginRight: 0,
        marginBottom: '8px'
      }}>
          <CardContent className="p-3">
            <div className="grid grid-cols-[auto_1fr] items-center gap-3">
              <TestTube className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{item.title}</span>
            </div>
          </CardContent>
        </Card>;
    }
    const isExpanded = expandedGroups.has(item.id);
    const groupMargin = level === 0 ? 16 : level === 2 ? 12 : 8;
    return <div key={item.id} style={{
      marginBottom: `${groupMargin}px`
    }}>
        <Card className={`cursor-pointer transition-all duration-200 ease-in-out hover:bg-accent/70 ${selectedSample?.id === item.id ? 'bg-accent' : ''}`} onClick={() => handleItemClick(item)} style={{
        marginLeft: `${BASE_LEFT + level * INDENT}px`,
        marginRight: 0
      }}>
          <CardContent className="p-3">
            <div className="grid grid-cols-[auto_auto_1fr_88px] items-center gap-3">
              <Button variant="ghost" size="sm" onClick={e => {
              e.stopPropagation();
              toggleGroup(item.id);
            }} className="p-2 transition-transform duration-200 ease-in-out flex-shrink-0">
                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </Button>
              <Package className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm font-medium truncate">{item.title}</span>
              <span className="text-xs text-muted-foreground text-right flex-shrink-0 font-mono justify-self-end">
                {item.children.length} items
              </span>
            </div>
          </CardContent>
        </Card>
        
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'}`}>
          {isExpanded && <div className="space-y-1 pt-2">
              {item.children.map(child => renderItem(child, level + 1))}
            </div>}
        </div>
      </div>;
  };
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-4 pt-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button 
            onClick={repackMode === 'main' ? onBack : () => setRepackMode('main')} 
            variant="ghost" 
            size="sm" 
            className="p-2"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-xl font-semibold">
            {repackMode === 'main' && 'My Manifest'}
            {repackMode === 'source' && 'Select Source Package'}
            {repackMode === 'target' && 'Select Target Package'}
            {repackMode === 'scanning' && 'Scan Samples to Move'}
          </h1>
        </div>
        
        {repackMode === 'main' && (
          <>
            {/* Summary Totals */}
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Total Samples: {getTotalSamples(data)} · Packages: {getTotalPackages(data)}
              </p>
            </div>
            
            <div className="mt-4">
              <Button 
                onClick={() => {
                  setRepackMode('source');
                  setScannedSamples([]);
                  setSourcePackage(null);
                  setTargetPackage(null);
                }}
                className="w-full bg-primary hover:bg-primary/90 h-12 text-base font-medium flex items-center gap-3 justify-center"
              >
                <Shuffle size={20} />
                Repack Samples
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pt-4 space-y-4 overflow-y-auto" style={{
      paddingBottom: repackMode === 'main' ? '110px' : '80px',
      maxHeight: 'calc(100vh - 80px)'
    }}>
        {repackMode === 'main' && data.map(item => renderItem(item))}
        
        {/* Source Package Selection */}
        {repackMode === 'source' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              Select the package to move samples from:
            </p>
            {getAllPackages(data).map(pkg => (
              <Card 
                key={pkg.id} 
                className="cursor-pointer hover:bg-accent/70 transition-colors"
                onClick={() => {
                  setSourcePackage(pkg);
                  setRepackMode('target');
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <h3 className="font-medium">{pkg.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {getSamplesFromPackage(pkg).length} samples
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        {/* Target Package Selection */}
        {repackMode === 'target' && sourcePackage && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              Select the target package to move samples to:
            </p>
            {getAllPackages(data)
              .filter(pkg => pkg.id !== sourcePackage.id)
              .map(pkg => (
                <Card 
                  key={pkg.id} 
                  className="cursor-pointer hover:bg-accent/70 transition-colors"
                  onClick={() => {
                    setTargetPackage(pkg);
                    setRepackMode('scanning');
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Package className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <h3 className="font-medium">{pkg.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {getSamplesFromPackage(pkg).length} samples
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
        
        {/* Sample Scanning */}
        {repackMode === 'scanning' && sourcePackage && targetPackage && (
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm">
                <span className="font-medium">From:</span> {sourcePackage.title}
              </p>
              <p className="text-sm">
                <span className="font-medium">To:</span> {targetPackage.title}
              </p>
            </div>
            
            <div className="text-center py-8">
              <ScanLine className="h-16 w-16 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Scan Samples to Move</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Scan each sample barcode that you want to move from {sourcePackage.title} to {targetPackage.title}
              </p>
              
              <Button
                onClick={() => {
                  // Simulate scanning a sample
                  const availableSamples = getSamplesFromPackage(sourcePackage);
                  const unscannedSamples = availableSamples.filter(s => !scannedSamples.includes(s.id));
                  
                  if (unscannedSamples.length > 0) {
                    const randomSample = unscannedSamples[Math.floor(Math.random() * unscannedSamples.length)];
                    setScannedSamples(prev => [...prev, randomSample.id]);
                    toast({
                      title: "Sample scanned",
                      description: `Added ${randomSample.title} to move list`,
                    });
                  } else {
                    toast({
                      title: "No more samples",
                      description: "All samples from this package have been scanned",
                      variant: "destructive"
                    });
                  }
                }}
                className="bg-primary hover:bg-primary/90 h-12 px-8 text-base font-medium"
              >
                <ScanLine className="mr-2 h-5 w-5" />
                Simulate Scan
              </Button>
            </div>
            
            {scannedSamples.length > 0 && (
              <>
                <div className="border-t border-border pt-4">
                  <h4 className="font-medium mb-3">Scanned Samples ({scannedSamples.length})</h4>
                  <div className="space-y-2">
                    {scannedSamples.map(sampleId => {
                      const sample = getSamplesFromPackage(sourcePackage).find(s => s.id === sampleId);
                      return sample ? (
                        <Card key={sample.id} className="bg-green-50 border-green-200">
                          <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                              <Check className="h-4 w-4 text-green-600" />
                              <TestTube className="h-4 w-4 text-primary" />
                              <span className="font-medium flex-1">{sample.title}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setScannedSamples(prev => prev.filter(id => id !== sample.id));
                                  toast({
                                    title: "Sample removed",
                                    description: `Removed ${sample.title} from move list`,
                                  });
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                Remove
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ) : null;
                    })}
                  </div>
                </div>
                
                <div className="fixed bottom-[90px] left-4 right-4">
                  <Button
                    onClick={() => {
                      moveSamples(
                        scannedSamples,
                        sourcePackage.id,
                        targetPackage.id
                      );
                    }}
                    className="w-full bg-primary hover:bg-primary/90 h-12 text-base font-medium"
                  >
                    <Check className="mr-2 h-5 w-5" />
                    Move {scannedSamples.length} Sample{scannedSamples.length !== 1 ? 's' : ''}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Fixed Bottom Detail Panel - Only visible in main mode */}
      {repackMode === 'main' && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border h-[90px]">
        <div className="p-3 space-y-2 max-h-full overflow-y-auto">
          {selectedSample ? <>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold truncate">{selectedSample.title}</h2>
                <Button variant="outline" size="sm" onClick={handleViewHistory} disabled={(selectedSample.history?.length ?? 0) <= 1} className="h-7 text-xs px-2 ml-2 flex-shrink-0">
                  <History className="h-3 w-3 mr-1" />
                  History
                </Button>
              </div>
              
              <div className="space-y-1">
                <p className="text-xs">
                  <span className="font-medium">Created:</span> {selectedSample.createdAt ? formatTimestamp(selectedSample.createdAt) : 'N/A'} by {selectedSample.createdBy || 'Unknown'}
                </p>
                <p className="text-xs">
                  <span className="font-medium">Origin:</span> {selectedSample.checkpoint || 'N/A'}
                </p>
              </div>
            </> : <div className="flex items-center justify-center h-full text-muted-foreground">
              <p className="text-xs">Select a sample to view details</p>
            </div>}
        </div>
        </div>
      )}

      {/* Full History Modal */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden bg-background border border-border shadow-xl">
          <DialogHeader className="flex flex-row items-center justify-between p-6 border-b border-border">
            <div>
              <DialogTitle className="text-xl font-semibold text-foreground">Full Sample History</DialogTitle>
              {selectedSample && <p className="text-sm text-muted-foreground mt-1">{selectedSample.title}</p>}
            </div>
            
          </DialogHeader>
          
          {selectedSample?.history && <div className="overflow-y-auto max-h-[60vh] p-6">
              <div className="space-y-1">
                {/* Extended demo history with more entries */}
                {[...selectedSample.history, {
              timestamp: '2025-07-31T15:45:00',
              action: 'Quality control passed',
              user: 'QC Inspector',
              checkpoint: 'QC Station 3'
            }, {
              timestamp: '2025-07-31T15:30:00',
              action: 'Temperature verification completed',
              user: 'Lab Tech A',
              checkpoint: 'Storage Unit 2'
            }, {
              timestamp: '2025-07-31T15:15:00',
              action: 'Sample preparation initiated',
              user: 'Prep Technician',
              checkpoint: 'Prep Station 1'
            }, {
              timestamp: '2025-07-31T15:00:00',
              action: 'Chain of custody documented',
              user: 'Security Officer',
              checkpoint: 'Security Desk'
            }, {
              timestamp: '2025-07-31T14:45:00',
              action: 'Initial inspection completed',
              user: 'Field Inspector',
              checkpoint: 'Intake Station'
            }, {
              timestamp: '2025-07-31T14:30:00',
              action: 'Sample received at facility',
              user: 'Receiving Clerk',
              checkpoint: 'Main Entrance'
            }, {
              timestamp: '2025-07-31T14:15:00',
              action: 'Transport container sealed',
              user: 'Transport Team',
              checkpoint: 'Field Location A'
            }, {
              timestamp: '2025-07-31T14:00:00',
              action: 'Sample collection started',
              user: 'Field Collector',
              checkpoint: 'Collection Point 1'
            }].map((historyItem, index) => <div key={index} className="grid grid-cols-[1fr_120px] gap-4 py-3 border-b border-border/30 last:border-b-0">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground leading-tight">
                        {historyItem.action}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        by <span className="font-medium">{historyItem.user}</span> at <span className="font-medium">{historyItem.checkpoint}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground tabular-nums">
                        {formatTimestamp(historyItem.timestamp)}
                      </p>
                    </div>
                  </div>)}
              </div>
            </div>}
        </DialogContent>
      </Dialog>
    </div>;
};
export default CollectedSamplesScreen;