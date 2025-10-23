import { ArrowLeft, FileText, Package, RotateCcw, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ReportsScreenProps {
  onBack: () => void;
  onNavigateToCollectedSamples?: () => void;
}

const ReportsScreen = ({ onBack, onNavigateToCollectedSamples }: ReportsScreenProps) => {
  const handleMyManifest = () => {
    // Navigate to manifest screen
    console.log('Navigate to My Manifest');
  };

  const handleRepackSamples = () => {
    // Navigate to repack samples screen  
    console.log('Navigate to Repack Samples');
  };

  const handleExportData = () => {
    // Export data functionality
    console.log('Export Data');
  };

  const handleViewReports = () => {
    // View reports functionality
    console.log('View Reports');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-surface border-b border-divider px-6 py-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-h1 font-bold text-textPrimary">Reports</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        <div className="grid gap-4">
          <Card className="p-4">
            <Button
              onClick={handleMyManifest}
              className="w-full flex items-center justify-start gap-4 h-auto p-4 bg-transparent hover:bg-surfaceAlt text-textPrimary"
              variant="ghost"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="text-subtitle font-semibold">My Manifest</h3>
                <p className="text-caption text-textSecondary">View and manage current manifest</p>
              </div>
            </Button>
          </Card>

          <Card className="p-4">
            <Button
              onClick={handleRepackSamples}
              className="w-full flex items-center justify-start gap-4 h-auto p-4 bg-transparent hover:bg-surfaceAlt text-textPrimary"
              variant="ghost"
            >
              <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
                <RotateCcw className="w-6 h-6 text-warning" />
              </div>
              <div className="text-left">
                <h3 className="text-subtitle font-semibold">Repack Samples</h3>
                <p className="text-caption text-textSecondary">Repack and reorganize samples</p>
              </div>
            </Button>
          </Card>

          {onNavigateToCollectedSamples && (
            <Card className="p-4">
              <Button
                onClick={onNavigateToCollectedSamples}
                className="w-full flex items-center justify-start gap-4 h-auto p-4 bg-transparent hover:bg-surfaceAlt text-textPrimary"
                variant="ghost"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Package className="w-6 h-6 text-primary" />
                </div>
                <div className="text-left">
                  <h3 className="text-subtitle font-semibold">Collected Samples</h3>
                  <p className="text-caption text-textSecondary">View samples collected today</p>
                </div>
              </Button>
            </Card>
          )}

          <Card className="p-4">
            <Button
              onClick={handleExportData}
              className="w-full flex items-center justify-start gap-4 h-auto p-4 bg-transparent hover:bg-surfaceAlt text-textPrimary"
              variant="ghost"
            >
              <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
                <Download className="w-6 h-6 text-warning" />
              </div>
              <div className="text-left">
                <h3 className="text-subtitle font-semibold">Export Data</h3>
                <p className="text-caption text-textSecondary">Download reports and data</p>
              </div>
            </Button>
          </Card>

          <Card className="p-4">
            <Button
              onClick={handleViewReports}
              className="w-full flex items-center justify-start gap-4 h-auto p-4 bg-transparent hover:bg-surfaceAlt text-textPrimary"
              variant="ghost"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Eye className="w-6 h-6 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="text-subtitle font-semibold">View Reports</h3>
                <p className="text-caption text-textSecondary">Access historical reports</p>
              </div>
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ReportsScreen;