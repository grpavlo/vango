import { useState, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, VolumeX, Volume2 } from 'lucide-react';
import { Button } from './ui/button';

interface DemoCallUIProps {
  isOpen: boolean;
  onClose: () => void;
  contactName: string;
  contactNumber: string;
}

const DemoCallUI = ({ isOpen, onClose, contactName, contactNumber }: DemoCallUIProps) => {
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCallDuration(0);
      return;
    }

    const interval = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Contact Avatar */}
        <div className="w-32 h-32 bg-muted/20 rounded-full flex items-center justify-center mb-6">
          <span className="text-4xl text-foreground font-semibold">
            {contactName.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Contact Info */}
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          {contactName}
        </h2>
        <p className="text-lg text-muted-foreground mb-4">
          {contactNumber}
        </p>

        {/* Call Status */}
        <div className="text-center mb-8">
          <p className="text-muted-foreground mb-2">Connected</p>
          <p className="text-xl text-foreground font-mono">
            {formatDuration(callDuration)}
          </p>
        </div>
      </div>

      {/* Call Controls */}
      <div className="px-8 pb-12">
        <div className="flex justify-center items-center gap-8 mb-8">
          {/* Mute Button */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-16 h-16 rounded-full flex items-center justify-center ${
              isMuted ? 'bg-red-500' : 'bg-muted/20'
            } transition-colors`}
          >
            {isMuted ? (
              <MicOff size={24} className="text-foreground" />
            ) : (
              <Mic size={24} className="text-foreground" />
            )}
          </button>

          {/* Speaker Button */}
          <button
            onClick={() => setIsSpeaker(!isSpeaker)}
            className={`w-16 h-16 rounded-full flex items-center justify-center ${
              isSpeaker ? 'bg-primary' : 'bg-muted/20'
            } transition-colors`}
          >
            {isSpeaker ? (
              <Volume2 size={24} className="text-primary-foreground" />
            ) : (
              <VolumeX size={24} className="text-foreground" />
            )}
          </button>
        </div>

        {/* End Call Button */}
        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
          >
            <PhoneOff size={32} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DemoCallUI;