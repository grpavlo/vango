import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';

interface RouteDescriptionScreenProps {
  routeId: string;
  onBack: () => void;
}

const RouteDescriptionScreen = ({ routeId, onBack }: RouteDescriptionScreenProps) => {
  // Mock data - in real app this would come from API
  const routeInstructions = {
    title: 'Instructions for Downtown Medical District Route',
    generalInstructions: [
      'Start the route at 8:00 AM from the central office',
      'Transport samples in special refrigerated container',
      'Ensure temperature does not exceed 4°C',
      'Follow chronological order of visits'
    ],
    safetyInstructions: [
      'Use protective gloves when handling biosamples',
      'Follow biosafety protocols',
      'In case of emergency, immediately contact dispatcher',
      'Keep documentation of all sample transfers'
    ],
    specialNotes: [
      'Central Hospital Lab: Get signature from lab technician John Smith',
      'Community Health Clinic: Samples stored in room 205',
      'Downtown Urgent Care: Open 24/7, ring back door after 7:00 PM'
    ]
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack}
            className="p-2 text-white hover:bg-white/10"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-xl font-semibold text-white">
            Route Instructions
          </h1>
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="text-base font-semibold text-white mb-3">
              General Instructions
            </h2>
            <div className="card-light rounded-lg p-4 space-y-3">
              {routeInstructions.generalInstructions.map((instruction, index) => (
                <div key={index} className="flex gap-3">
                  <span className="bg-[#2BBBDD] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </span>
                  <p className="text-sm text-[#6B6B6B]">{instruction}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">
              Safety Instructions
            </h2>
            <div className="card-light rounded-lg p-4 space-y-3">
              {routeInstructions.safetyInstructions.map((instruction, index) => (
                <div key={index} className="flex gap-3">
                  <span className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium">
                    !
                  </span>
                  <p className="text-sm text-[#6B6B6B]">{instruction}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">
              Special Notes
            </h2>
            <div className="card-light rounded-lg p-4 space-y-3">
              {routeInstructions.specialNotes.map((note, index) => (
                <div key={index} className="flex gap-3">
                  <span className="bg-[#5090DF] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium">
                    i
                  </span>
                  <p className="text-sm text-[#6B6B6B]">{note}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default RouteDescriptionScreen;