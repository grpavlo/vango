import { useState } from 'react';
import { ChevronLeft, Camera, Car, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';

interface Vehicle {
  id: string;
  make: string;
  model: string;
  registration: string;
  available: boolean;
}

interface VehicleSelectionScreenProps {
  onBack: () => void;
  onVehicleConfirmed: (vehicleId: string) => void;
}

const VehicleSelectionScreen = ({ onBack, onVehicleConfirmed }: VehicleSelectionScreenProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedVehicle, setScannedVehicle] = useState<Vehicle | null>(null);
  const [scanError, setScanError] = useState('');

  // Default vehicle for the driver
  const defaultVehicle: Vehicle & {
    year: string;
    color: string;
    vin: string;
    odometer: string;
    status: string;
  } = {
    id: 'default-1',
    make: 'Ford',
    model: 'Transit Connect',
    registration: 'ABC-123',
    available: true,
    year: '2023',
    color: 'White',
    vin: 'WF0EXXGB••••••5678',
    odometer: '24,580 mi',
    status: 'Available'
  };

  const handleUseDefaultVehicle = () => {
    onVehicleConfirmed(defaultVehicle.id);
  };

  const handleScanQR = () => {
    setIsScanning(true);
    setScanError('');
    
    // Simulate QR scanning - in real app this would open camera
    setTimeout(() => {
      // Simulate successful scan
      const mockScannedVehicle: Vehicle = {
        id: 'scanned-1',
        make: 'Mercedes',
        model: 'Sprinter',
        registration: 'XYZ-789',
        available: true
      };
      
      setScannedVehicle(mockScannedVehicle);
      setIsScanning(false);
    }, 2000);
  };

  const handleConfirmScannedVehicle = () => {
    if (scannedVehicle) {
      onVehicleConfirmed(scannedVehicle.id);
    }
  };

  const handleScanAgain = () => {
    setScannedVehicle(null);
    setScanError('');
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 pt-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center hover:bg-muted/80 transition-colors">
            <ChevronLeft size={20} className="text-foreground" />
          </button>
          <h1 className="text-xl font-semibold text-foreground">
            Select Vehicle
          </h1>
        </div>

        <div className="text-center mb-6">
          <p className="text-foreground text-lg mb-6">Select the vehicle for this route.</p>
        </div>

        {!scannedVehicle ? (
          <div className="space-y-4">
            {/* Default Vehicle Option */}
            <Button
              onClick={handleUseDefaultVehicle}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-4 text-lg"
            >
              <Car className="mr-2" size={20} />
              Use my default vehicle
            </Button>

            {/* Default Vehicle Details Card */}
            <div className="p-4 rounded-lg border border-border bg-surface">
              <h3 className="text-sm font-medium text-foreground mb-3">Default Vehicle Details</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Make/Model/Year</span>
                  <span className="text-sm text-foreground font-medium">
                    {defaultVehicle.make} {defaultVehicle.model} {defaultVehicle.year}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">License Plate</span>
                  <span className="text-sm text-foreground font-medium">{defaultVehicle.registration}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Color</span>
                  <span className="text-sm text-foreground font-medium">{defaultVehicle.color}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">VIN</span>
                  <span className="text-sm text-foreground font-medium font-mono">{defaultVehicle.vin}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Odometer</span>
                  <span className="text-sm text-foreground font-medium">{defaultVehicle.odometer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className={`text-sm font-medium ${
                    defaultVehicle.status === 'Available' ? 'text-primary' : 'text-warning'
                  }`}>
                    {defaultVehicle.status}
                  </span>
                </div>
              </div>
            </div>

            {/* QR Scan Option */}
            <div className="space-y-2">
              <Button
                onClick={handleScanQR}
                disabled={isScanning}
                variant="outline"
                className="w-full py-4 text-lg"
              >
                <Camera className="mr-2" size={20} />
                {isScanning ? 'Scanning...' : 'Scan Vehicle QR'}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                The QR is on the windshield.
              </p>
            </div>

            {scanError && (
              <div className="text-center">
                <p className="text-destructive text-sm mb-2">{scanError}</p>
                <Button variant="ghost" onClick={handleScanAgain} className="text-sm">
                  Try again
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Scanned Vehicle Summary */
          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-border bg-muted">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle size={24} className="text-primary" />
                <h3 className="font-semibold text-foreground">Vehicle Found</h3>
              </div>
              <div className="flex items-center gap-3">
                <Car size={24} className="text-primary" />
                <div className="flex-1">
                  <h4 className="font-medium text-foreground">
                    {scannedVehicle.make} {scannedVehicle.model}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Registration: {scannedVehicle.registration}
                  </p>
                  <p className="text-xs text-primary">Available</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleScanAgain}
                variant="outline"
                className="flex-1"
              >
                Scan Again
              </Button>
              <Button
                onClick={handleConfirmScannedVehicle}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Continue
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VehicleSelectionScreen;