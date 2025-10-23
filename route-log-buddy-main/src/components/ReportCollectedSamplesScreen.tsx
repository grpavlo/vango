import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';

interface ScannedSample {
  id: string;
  code: string;
  timestamp: Date;
  type: string;
  status: 'collected' | 'pending';
}

interface ReportCollectedSamplesScreenProps {
  onBack: () => void;
}

const ReportCollectedSamplesScreen = ({ onBack }: ReportCollectedSamplesScreenProps) => {
  // Mock data for demonstration - 15 samples to show scrolling
  const samples: ScannedSample[] = [
    { id: '1', code: 'SAMPLE-ABC123', timestamp: new Date('2024-01-15T09:30:00'), type: 'Blood', status: 'collected' },
    { id: '2', code: 'SAMPLE-DEF456', timestamp: new Date('2024-01-15T09:35:00'), type: 'Urine', status: 'collected' },
    { id: '3', code: 'SAMPLE-GHI789', timestamp: new Date('2024-01-15T09:40:00'), type: 'Blood', status: 'collected' },
    { id: '4', code: 'SAMPLE-JKL012', timestamp: new Date('2024-01-15T09:45:00'), type: 'Swab', status: 'collected' },
    { id: '5', code: 'SAMPLE-MNO345', timestamp: new Date('2024-01-15T09:50:00'), type: 'Blood', status: 'collected' },
    { id: '6', code: 'SAMPLE-PQR678', timestamp: new Date('2024-01-15T09:55:00'), type: 'Tissue', status: 'collected' },
    { id: '7', code: 'SAMPLE-STU901', timestamp: new Date('2024-01-15T10:00:00'), type: 'Blood', status: 'collected' },
    { id: '8', code: 'SAMPLE-VWX234', timestamp: new Date('2024-01-15T10:05:00'), type: 'Urine', status: 'collected' },
    { id: '9', code: 'SAMPLE-YZA567', timestamp: new Date('2024-01-15T10:10:00'), type: 'Blood', status: 'collected' },
    { id: '10', code: 'SAMPLE-BCD890', timestamp: new Date('2024-01-15T10:15:00'), type: 'Swab', status: 'collected' },
    { id: '11', code: 'SAMPLE-EFG123', timestamp: new Date('2024-01-15T10:20:00'), type: 'Blood', status: 'collected' },
    { id: '12', code: 'SAMPLE-HIJ456', timestamp: new Date('2024-01-15T10:25:00'), type: 'Tissue', status: 'collected' },
    { id: '13', code: 'SAMPLE-KLM789', timestamp: new Date('2024-01-15T10:30:00'), type: 'Blood', status: 'collected' },
    { id: '14', code: 'SAMPLE-NOP012', timestamp: new Date('2024-01-15T10:35:00'), type: 'Urine', status: 'collected' },
    { id: '15', code: 'SAMPLE-QRS345', timestamp: new Date('2024-01-15T10:40:00'), type: 'Blood', status: 'collected' },
  ];

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header with Back Button */}
      <div className="px-4 pt-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10 p-2"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-xl font-semibold text-white">
            Collected Samples Report
          </h1>
        </div>
      </div>

      {/* Samples Table/List */}
      <div className="px-4 pt-4">
        <div className="bg-white/5 rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-4 gap-2 p-3 bg-white/10 border-b border-white/10">
            <span className="text-sm font-medium text-white/80">Sample ID</span>
            <span className="text-sm font-medium text-white/80">Type</span>
            <span className="text-sm font-medium text-white/80">Time</span>
            <span className="text-sm font-medium text-white/80">Status</span>
          </div>

          {/* Scrollable Sample List */}
          <div className="max-h-96 overflow-y-auto">
            {samples.map((sample) => (
              <div 
                key={sample.id} 
                className="grid grid-cols-4 gap-2 p-3 border-b border-white/5 hover:bg-white/5 transition-colors"
              >
                <span className="text-sm font-mono text-white truncate">
                  {sample.code}
                </span>
                <span className="text-sm text-white/80">
                  {sample.type}
                </span>
                <span className="text-sm text-white/80">
                  {formatTime(sample.timestamp)}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  sample.status === 'collected' 
                    ? 'bg-green-500/20 text-green-300' 
                    : 'bg-orange-500/20 text-orange-300'
                }`}>
                  {sample.status === 'collected' ? 'Collected' : 'Pending'}
                </span>
              </div>
            ))}
          </div>

          {/* Summary Footer */}
          <div className="p-3 bg-white/10 border-t border-white/10">
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/80">
                Total Samples: {samples.length}
              </span>
              <span className="text-sm text-green-300">
                Collected: {samples.filter(s => s.status === 'collected').length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportCollectedSamplesScreen;