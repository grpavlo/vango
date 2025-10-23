import { ArrowLeft, MapPin, Clock, Phone, Package, Truck, Calendar } from 'lucide-react';
import { Button } from './ui/button';

interface VisitInfoProps {
  isOpen: boolean;
  onClose: () => void;
  checkpointId: string;
}

const VisitInfo = ({ isOpen, onClose, checkpointId }: VisitInfoProps) => {
  // Mock checkpoint data - in real app this would come from props
  const checkpoint = {
    name: 'Central Hospital Lab',
    address: '123 Medical Center Dr, Downtown',
    type: 'pickup' as const,
    phone: '+1 (555) 123-4567',
    customerPhone: '+1 (555) 987-6543',
    openHours: '09:00–17:00',
    visitWindow: '10:00–12:00',
    specialInstructions: 'Please ring the bell at the main entrance. Ask for Dr. Smith in the lab department. Samples are usually ready in the refrigerated storage unit.',
    contactPerson: 'Dr. Sarah Smith',
    department: 'Laboratory Services',
    buildingDetails: 'Building A, 3rd Floor, Room 301',
    parkingInfo: 'Visitor parking available in Lot B. Use entrance code 1234.',
    accessNotes: 'Weekends: Use side entrance. Security desk will direct you.',
    estimatedSamples: '15-20 samples expected',
    priority: 'Standard',
    route: 'Route A-Morning',
    scheduledDate: '2024-01-15',
    timeSlot: '10:00 AM - 12:00 PM'
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="bg-primary text-white p-4 flex items-center gap-3">
        <button onClick={onClose} className="text-white hover:text-white/70">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="font-semibold">Visit Information</h1>
          <p className="text-xs text-white/80">{checkpoint.name}</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6 pb-20 overflow-y-auto">
        {/* Location Details */}
        <div className="bg-white/5 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <MapPin size={20} className="text-primary" />
            Location Details
          </h2>
          <div className="space-y-2 text-sm">
            <p className="text-white/90">{checkpoint.address}</p>
            <p className="text-white/70">{checkpoint.buildingDetails}</p>
            <p className="text-white/70"><strong>Contact:</strong> {checkpoint.contactPerson}</p>
            <p className="text-white/70"><strong>Department:</strong> {checkpoint.department}</p>
          </div>
        </div>

        {/* Schedule Information */}
        <div className="bg-white/5 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Clock size={20} className="text-primary" />
            Schedule
          </h2>
          <div className="space-y-2 text-sm">
            <p className="text-white/90"><strong>Date:</strong> {checkpoint.scheduledDate}</p>
            <p className="text-white/90"><strong>Time Slot:</strong> {checkpoint.timeSlot}</p>
            <p className="text-white/70"><strong>Open Hours:</strong> {checkpoint.openHours}</p>
            <p className="text-white/70"><strong>Visit Window:</strong> {checkpoint.visitWindow}</p>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white/5 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Phone size={20} className="text-primary" />
            Contact Information
          </h2>
          <div className="space-y-2 text-sm">
            <p className="text-white/90"><strong>Main Phone:</strong> {checkpoint.phone}</p>
            <p className="text-white/90"><strong>Customer Service:</strong> {checkpoint.customerPhone}</p>
          </div>
        </div>

        {/* Pickup Details */}
        <div className="bg-white/5 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Package size={20} className="text-primary" />
            Pickup Details
          </h2>
          <div className="space-y-2 text-sm">
            <p className="text-white/90"><strong>Type:</strong> {checkpoint.type}</p>
            <p className="text-white/90"><strong>Expected Samples:</strong> {checkpoint.estimatedSamples}</p>
            <p className="text-white/70"><strong>Priority:</strong> {checkpoint.priority}</p>
          </div>
        </div>

        {/* Route Information */}
        <div className="bg-white/5 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Truck size={20} className="text-primary" />
            Route Information
          </h2>
          <div className="space-y-2 text-sm">
            <p className="text-white/90"><strong>Route:</strong> {checkpoint.route}</p>
          </div>
        </div>

        {/* Access & Parking */}
        <div className="bg-white/5 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Calendar size={20} className="text-primary" />
            Access & Parking
          </h2>
          <div className="space-y-2 text-sm">
            <p className="text-white/90"><strong>Parking:</strong> {checkpoint.parkingInfo}</p>
            <p className="text-white/70"><strong>Access Notes:</strong> {checkpoint.accessNotes}</p>
          </div>
        </div>

        {/* Special Instructions */}
        <div className="bg-white/5 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-3">Special Instructions</h2>
          <p className="text-white/90 text-sm leading-relaxed">
            {checkpoint.specialInstructions}
          </p>
        </div>
      </div>
    </div>
  );
};

export default VisitInfo;