import { useState } from 'react';
import { QrCode, Camera, Trash2, Plus, Package, ChevronDown, ChevronRight, MapPin, Clock, Phone, Info, Edit } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import DemoCallUI from './DemoCallUI';
import PhotoModal from './PhotoModal';
import DispatchChat from './DispatchChat';
import VisitInfo from './VisitInfo';
import samplePhoto1 from '../assets/sample-photo-1.jpg';
import samplePhoto2 from '../assets/sample-photo-2.jpg';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';

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
}

interface VisitScreenProps {
  checkpointId: string;
  onComplete: () => void;
  onReportSamples?: () => void;
}

const VisitScreen = ({ checkpointId, onComplete, onReportSamples }: VisitScreenProps) => {
  const [scannedCodes, setScannedCodes] = useState<ScannedCode[]>([]);
  const [packages, setPackages] = useState<CodePackage[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [showPackages, setShowPackages] = useState(false);
  const [expandedPackage, setExpandedPackage] = useState<string | null>(null);
  
  const [photos, setPhotos] = useState<string[]>([]);
  const [showCallUI, setShowCallUI] = useState(false);
  const [callContact, setCallContact] = useState({ name: '', number: '' });
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [showDispatchChat, setShowDispatchChat] = useState(false);
  const [showVisitInfo, setShowVisitInfo] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<string | null>(null);

  // Mock checkpoint data - in real app this would come from props
  const checkpoint = {
    name: 'Central Hospital Lab',
    address: '123 Medical Center Dr, Downtown',
    type: 'pickup' as const,
    phone: '+1 (555) 123-4567',
    customerPhone: '+1 (555) 987-6543',
    openHours: '09:00–17:00',
    visitWindow: '10:00–12:00'
  };

  const handleScanCode = () => {
    // Simulate scanning a barcode
    const newCode: ScannedCode = {
      id: Date.now().toString(),
      code: `SAMPLE-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
      timestamp: new Date()
    };
    setScannedCodes(prev => [...prev, newCode]);
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
    // Check if no packages exist and show error
    if (packages.length === 0) {
      toast.error("Create a package first.");
      return;
    }
    
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

  const handleCreateNewPackage = () => {
    const newPackage: CodePackage = {
      id: Date.now().toString(),
      barcode: `PKG-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
      codes: [],
      name: `Package ${packages.length + 1}`
    };
    setPackages(prev => [...prev, newPackage]);
  };

  const handleGroupCodes = (packageId: string) => {
    const selectedCodesList = scannedCodes.filter(code => selectedCodes.has(code.id));
    
    setPackages(prev => prev.map(pkg => 
      pkg.id === packageId 
        ? { ...pkg, codes: [...pkg.codes, ...selectedCodesList] }
        : pkg
    ));
    
    setScannedCodes(prev => prev.filter(code => !selectedCodes.has(code.id)));
    setSelectedCodes(new Set());
  };

  const handleUngroupCode = (packageId: string, codeId: string) => {
    const codeToMove = packages
      .find(pkg => pkg.id === packageId)
      ?.codes.find(code => code.id === codeId);
    
    if (codeToMove) {
      setPackages(prev => prev.map(pkg => 
        pkg.id === packageId 
          ? { ...pkg, codes: pkg.codes.filter(code => code.id !== codeId) }
          : pkg
      ));
      setScannedCodes(prev => [...prev, codeToMove]);
    }
  };

  const handleUngroupAll = (packageId: string) => {
    const packageToUngroup = packages.find(pkg => pkg.id === packageId);
    if (packageToUngroup) {
      setScannedCodes(prev => [...prev, ...packageToUngroup.codes]);
      setPackages(prev => prev.map(pkg => 
        pkg.id === packageId 
          ? { ...pkg, codes: [] }
          : pkg
      ));
    }
  };

  const handleDeletePackage = (packageId: string) => {
    setPackageToDelete(packageId);
  };

  const confirmDeletePackage = () => {
    if (!packageToDelete) return;
    
    const packageToDeleteObj = packages.find(pkg => pkg.id === packageToDelete);
    if (packageToDeleteObj) {
      if (packageToDeleteObj.codes.length > 0) {
        setScannedCodes(prev => [...prev, ...packageToDeleteObj.codes]);
      }
      setPackages(prev => prev.filter(pkg => pkg.id !== packageToDelete));
    }
    setPackageToDelete(null);
  };


  const handleUploadPhoto = () => {
    // Simulate photo upload - automatically insert demo images first
    const currentPhotoCount = photos.length;
    let photoId: string;
    
    if (currentPhotoCount === 0) {
      photoId = 'sample1';
    } else if (currentPhotoCount === 1) {
      photoId = 'sample2';
    } else {
      photoId = Date.now().toString(); // Placeholder for third+ photos
    }
    
    setPhotos(prev => [...prev, photoId]);
  };

  const handleDeletePhoto = (photoId: string) => {
    setPhotos(prev => prev.filter(id => id !== photoId));
  };

  const handleCall = (contactType: 'dispatch' | 'customer') => {
    const contact = contactType === 'dispatch' 
      ? { name: 'Dispatch Center', number: '+1 (555) 911-HELP' }
      : { name: 'Customer Service', number: checkpoint.customerPhone };
    
    setCallContact(contact);
    setShowCallUI(true);
  };

  const canComplete = () => {
    const hasSamples = scannedCodes.length > 0 || packages.some(pkg => pkg.codes.length > 0);
    const hasPhotos = photos.length > 0;
    
    return hasSamples && hasPhotos;
  };

  const hasSelectedCodes = selectedCodes.size > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Scrollable Compact Checkpoint Info Block */}
      <div className="bg-card/80 backdrop-blur-sm rounded-lg border border-border p-3 mx-4 mt-4 mb-4 max-h-[120px] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={16} className="text-primary" />
              <h2 className="font-semibold text-foreground text-lg leading-tight">
                {checkpoint.name}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {checkpoint.address}
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock size={16} />
                <span>Open: {checkpoint.openHours}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock size={16} />
                <span>Visit: {checkpoint.visitWindow}</span>
              </div>
            </div>
            
            {/* Latest Departure Time */}
            <div className="mt-2 p-2 bg-warning/10 border border-warning/20 rounded-md">
              <div className="flex items-center gap-1 text-xs">
                <Clock size={14} className="text-warning" />
                <span className="text-warning font-medium">Leave by 3:12 PM to make it within the 3:30–4:00 PM window</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex flex-col items-center gap-1">
              <button 
                onClick={() => handleCall('dispatch')}
                className="w-10 h-10 bg-background rounded-full border border-divider flex items-center justify-center hover:bg-surface dark:bg-surface dark:hover:bg-surface/80 transition-colors"
              >
                <Phone size={16} className="text-primary" />
              </button>
              <span className="text-[8px] text-muted-foreground text-center leading-tight">Call<br/>Dispatch</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <button 
                onClick={() => handleCall('customer')}
                className="w-10 h-10 bg-background rounded-full border border-divider flex items-center justify-center hover:bg-surface dark:bg-surface dark:hover:bg-surface/80 transition-colors"
              >
                <Phone size={16} className="text-primary" />
              </button>
              <span className="text-[8px] text-muted-foreground text-center leading-tight">Contact<br/>Office</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <button 
                onClick={() => setShowVisitInfo(true)}
                className="w-10 h-10 bg-background rounded-full border border-divider flex items-center justify-center hover:bg-surface dark:bg-surface dark:hover:bg-surface/80 transition-colors"
              >
                <Info size={16} className="text-primary" />
              </button>
              <span className="text-[8px] text-muted-foreground text-center leading-tight">Visit<br/>Info</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <button 
                onClick={() => setShowDispatchChat(true)}
                className="w-10 h-10 bg-background rounded-full border border-divider flex items-center justify-center hover:bg-surface dark:bg-surface dark:hover:bg-surface/80 transition-colors"
              >
                <Edit size={16} className="text-primary" />
              </button>
              <span className="text-[8px] text-muted-foreground text-center leading-tight">Text<br/>Dispatch</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-28">
        <h1 className="text-xl font-semibold text-foreground mb-4">
          Visit: {checkpoint.name}
        </h1>
        
        {/* Barcode Scanning Section */}
        <div className="bg-card/50 rounded-lg p-4 mb-4">
          <h2 className="text-lg font-medium text-foreground mb-4">Scan Samples</h2>
          
          <div className="mb-4">
            <Button 
              onClick={handleScanCode}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <QrCode className="w-4 h-4 mr-2" />
              Scan Code
            </Button>
          </div>
          
          {/* Scanned Codes List */}
          {scannedCodes.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground mb-2">
                Scanned Codes ({scannedCodes.length})
              </h3>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {scannedCodes.map((code) => (
                  <div
                    key={code.id}
                    onClick={() => handleToggleCodeSelection(code.id)}
                    className={`flex items-center justify-between p-4 rounded-[8px] cursor-pointer transition-all duration-150 ${
                      selectedCodes.has(code.id)
                        ? 'bg-primary/10 border-2 border-primary'
                        : 'bg-card border border-border'
                    }`}
                  >
                    <span className={`text-sm font-mono ${
                      selectedCodes.has(code.id) ? 'text-foreground' : 'text-foreground'
                    }`}>
                      {code.code}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCode(code.id);
                      }}
                      className="text-gray-500 hover:text-red-500 p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Package Management */}
        <div className="bg-card/50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-foreground">Packages</h2>
          </div>
          
          {!hasSelectedCodes && (
            <div className="mb-4">
              <Button 
                onClick={handleCreateNewPackage}
                className="flex-1 bg-primary text-white hover:bg-primary/90"
              >
                <QrCode className="w-4 h-4 mr-2" />
                Scan Consolidate Package
              </Button>
            </div>
          )}
          
          {packages.length > 0 && (
            <div className="space-y-2">
              {packages.map((pkg) => (
                <div key={pkg.id} className="border border-border rounded-lg p-3 bg-card/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Package size={16} className="text-primary" />
                      <span className="text-sm text-foreground font-semibold">
                        {pkg.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({pkg.codes.length} codes)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDeletePackage(pkg.id)}
                        className="text-red-400 hover:text-red-300 p-1 transition-colors duration-150"
                        title="Delete package"
                      >
                        <Trash2 size={16} />
                      </button>
                      <button
                        onClick={() => setExpandedPackage(
                          expandedPackage === pkg.id ? null : pkg.id
                        )}
                        className="text-white/60 hover:text-white transition-colors duration-150"
                      >
                        {expandedPackage === pkg.id ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-xs text-muted-foreground font-mono mb-2">
                    {pkg.barcode}
                  </p>
                  
                  {expandedPackage === pkg.id && pkg.codes.length > 0 && (
                    <div className="space-y-1 mt-2 pt-2 border-t border-border">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-muted-foreground">
                          Package Contents:
                        </span>
                        <Button
                          onClick={() => handleUngroupAll(pkg.id)}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                        >
                          Ungroup All
                        </Button>
                      </div>
                      {pkg.codes.map((code) => (
                        <div key={code.id} className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-xs font-mono text-foreground">
                            {code.code}
                          </span>
                          <button
                            onClick={() => handleUngroupCode(pkg.id, code.id)}
                            className="text-white/60 hover:text-primary"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {hasSelectedCodes && (
            <div className="mt-4 p-3 bg-primary/20 rounded-lg">
              <p className="text-sm text-white mb-2">
                {selectedCodes.size} codes selected
              </p>
              <div className="flex gap-2">
                {packages.map((pkg) => (
                  <Button
                    key={pkg.id}
                    onClick={() => handleGroupCodes(pkg.id)}
                    variant="outline"
                    size="sm"
                    className="border-primary text-primary hover:bg-primary hover:text-white transition-all duration-150"
                  >
                    Group into {pkg.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Overall Photos Section */}
        <div className="bg-card/50 rounded-lg p-4 mb-4">
          <h2 className="text-lg font-medium text-foreground mb-4">Overall Photos</h2>
          <Button 
            onClick={handleUploadPhoto}
            variant="outline"
            className="w-full border-border text-foreground hover:bg-muted mb-3"
          >
            <Camera className="w-4 h-4 mr-2" />
            Upload Photo
          </Button>
          
          {photos.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Photos uploaded: {photos.length}
              </p>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {photos.map((photoId) => (
                   <div 
                     key={photoId} 
                     onClick={() => setSelectedPhoto(photoId)}
                     className="relative rounded-[8px] bg-white border border-[#E0E0E0] flex items-center justify-center cursor-pointer transition-all duration-150 hover:bg-gray-50 overflow-hidden"
                     style={{ aspectRatio: '2/1' }}
                   >
                    {photoId.startsWith('sample') ? (
                      <img 
                        src={photoId === 'sample1' ? samplePhoto1 : samplePhoto2} 
                        alt="Sample photo" 
                        className="w-full h-full object-cover rounded-[8px]"
                      />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full bg-muted rounded-[8px]">
                        <Plus size={20} className="text-muted-foreground" />
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePhoto(photoId);
                      }}
                      className="absolute top-1 right-1 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center shadow-sm"
                    >
                      <Trash2 size={14} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
      
      {/* Mark as Done Button - Raised above bottom navigation */}
      <div className="fixed bottom-[calc(var(--nav-height)+1rem)] left-0 right-0 px-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              disabled={!canComplete()}
              className={`w-full ${
                canComplete() 
                  ? 'bg-green-500 hover:bg-green-600 text-white' 
                  : 'bg-white/20 text-white/40 cursor-not-allowed'
              }`}
            >
              Mark as Done
              {!canComplete() && (
                <span className="ml-2 text-xs">
                  (Missing requirements)
                </span>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-background border-white/20">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">Confirm Completion</AlertDialogTitle>
              <AlertDialogDescription className="text-white/80">
                Are you sure you want to mark this checkpoint as done?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-white/10 text-white border-white/20 hover:bg-white/20">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  setIsCompleted(true);
                  onComplete();
                }}
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                Yes
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        {!canComplete() && (
          <p className="text-xs text-white/60 mt-2 text-center">
            Required: Samples + At least 1 photo
          </p>
        )}
      </div>
      

      {/* Demo Call UI */}
      <DemoCallUI 
        isOpen={showCallUI}
        onClose={() => setShowCallUI(false)}
        contactName={callContact.name}
        contactNumber={callContact.number}
      />

      {/* Photo Modal */}
      <PhotoModal 
        isOpen={selectedPhoto !== null}
        onClose={() => setSelectedPhoto(null)}
        photoId={selectedPhoto || ''}
        photos={photos}
      />

      {/* Dispatch Chat */}
      <DispatchChat 
        isOpen={showDispatchChat}
        onClose={() => setShowDispatchChat(false)}
      />

      {/* Visit Info */}
      <VisitInfo 
        isOpen={showVisitInfo}
        onClose={() => setShowVisitInfo(false)}
        checkpointId={checkpointId}
      />

      {/* Package Delete Confirmation Dialog */}
      <AlertDialog open={packageToDelete !== null} onOpenChange={() => setPackageToDelete(null)}>
        <AlertDialogContent className="bg-background border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Package?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/80">
              Are you sure you want to delete this package and return its samples?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 text-white border-white/20 hover:bg-white/20">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeletePackage}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VisitScreen;