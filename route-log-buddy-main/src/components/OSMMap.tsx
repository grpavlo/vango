import { useEffect, useRef, useState } from 'react';
import { Navigation, Layers } from 'lucide-react';
import { Button } from './ui/button';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Checkpoint {
  id: string;
  name: string;
  address: string;
  phone: string;
  hours?: string;
  type: 'pickup' | 'dropoff';
  isCompleted: boolean;
  lat: number;
  lng: number;
}

interface OSMMapProps {
  checkpoints?: Checkpoint[];
  showControls?: boolean;
  height?: string;
  center?: [number, number];
  zoom?: number;
  className?: string;
  selectedCheckpointId?: string;
  onCheckpointSelect?: (checkpoint: Checkpoint) => void;
  mapTheme?: 'light' | 'dark';
}

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const OSMMap = ({
  checkpoints = [],
  showControls = false,
  height = "h-64",
  center = [40.7128, -74.0060],
  zoom = 13,
  className = "",
  selectedCheckpointId,
  onCheckpointSelect,
  mapTheme = 'light'
}: OSMMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [currentLayer, setCurrentLayer] = useState<'standard' | 'satellite'>('standard');
  const [showLayerSelector, setShowLayerSelector] = useState(false);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);

  const getTileLayer = (layerType: 'standard' | 'satellite', theme: 'light' | 'dark') => {
    if (layerType === 'satellite') {
      return L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri, Maxar, Earthstar Geographics',
        maxZoom: 19
      });
    }

    if (theme === 'dark') {
      return L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors, © CARTO',
        maxZoom: 19
      });
    }

    return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    });
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map
    const map = L.map(mapContainerRef.current, {
      center: center,
      zoom: zoom,
      zoomControl: false
    });

    // Add initial tile layer
    const initialLayer = getTileLayer(currentLayer, mapTheme);

    currentTileLayerRef.current = initialLayer;
    initialLayer.addTo(map);

    // Custom icon for completed checkpoints
    const completedIcon = L.divIcon({
      html: '<div style="background-color: #10b981; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;"><div style="color: white; font-size: 14px; font-weight: bold;">✓</div></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      className: 'custom-div-icon'
    });

    // Custom icon for pending checkpoints
    const pendingIcon = L.divIcon({
      html: '<div style="background-color: #f59e0b; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;"><div style="color: white; font-size: 12px; font-weight: bold;">!</div></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      className: 'custom-div-icon'
    });

    // Custom icon for selected checkpoints (larger with ring)
    const selectedIcon = L.divIcon({
      html: '<div style="background-color: #3b82f6; width: 32px; height: 32px; border-radius: 50%; border: 4px solid white; box-shadow: 0 0 0 3px #3b82f6, 0 4px 8px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;"><div style="color: white; font-size: 14px; font-weight: bold;">📍</div></div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      className: 'custom-div-icon'
    });

    // Add checkpoint markers
    const markers: L.Marker[] = [];
    checkpoints.forEach((checkpoint, index) => {
      // Determine icon based on selection and completion status
      let icon;
      if (selectedCheckpointId === checkpoint.id) {
        icon = selectedIcon;
      } else if (checkpoint.isCompleted) {
        icon = completedIcon;
      } else {
        icon = pendingIcon;
      }

      const marker = L.marker([checkpoint.lat, checkpoint.lng], { icon }).addTo(map);

      // Add click handler for marker selection
      marker.on('click', () => {
        if (onCheckpointSelect) {
          onCheckpointSelect(checkpoint);
        }
      });

      marker.bindPopup(`
        <div class="p-2">
          <h3 class="font-semibold">${checkpoint.name}</h3>
          <p class="text-sm text-gray-600">${checkpoint.address}</p>
          <span class="inline-block px-2 py-1 text-xs rounded mt-1 ${
            checkpoint.type === 'pickup' 
              ? 'bg-blue-100 text-blue-700' 
              : 'bg-orange-100 text-orange-700'
          }">
            ${checkpoint.type === 'pickup' ? 'Pickup' : 'Drop-off'}
          </span>
          ${checkpoint.isCompleted ? '<span class="inline-block px-2 py-1 text-xs rounded mt-1 ml-1 bg-green-100 text-green-700">Completed</span>' : ''}
        </div>
      `);

      markers.push(marker);
    });

    // Draw route polyline connecting all checkpoints in order
    if (checkpoints.length > 1) {
      const routeCoords = checkpoints.map(cp => [cp.lat, cp.lng] as [number, number]);
      L.polyline(routeCoords, {
        color: '#3b82f6',
        weight: 5,
        opacity: 0.8,
        dashArray: '10, 5'
      }).addTo(map);
    }

    // Fit map to show all markers
    if (markers.length > 0) {
      const group = new L.FeatureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.1));
    }

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [checkpoints, center, zoom, selectedCheckpointId, onCheckpointSelect, mapTheme]);

  // Handle layer switching
  useEffect(() => {
    if (!mapRef.current || !currentTileLayerRef.current) return;

    const map = mapRef.current;

    // Remove current layer
    map.removeLayer(currentTileLayerRef.current);

    // Add new layer based on selection and theme
    const newLayer = getTileLayer(currentLayer, mapTheme);

    newLayer.addTo(map);
    currentTileLayerRef.current = newLayer;
  }, [currentLayer, mapTheme]);

  const handleRecenter = () => {
    if (mapRef.current && checkpoints.length > 0) {
      const markers = checkpoints.map(cp => L.marker([cp.lat, cp.lng]));
      const group = new L.FeatureGroup(markers);
      mapRef.current.fitBounds(group.getBounds().pad(0.1));
    } else if (mapRef.current) {
      mapRef.current.setView(center, zoom);
    }
  };

  return (
    <div className={`${height} relative ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full rounded-lg" />
      
      {/* Google Maps-style Layers Button */}
      <button
        onClick={() => setShowLayerSelector(!showLayerSelector)}
        className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-2 hover:bg-gray-50 z-[1000] transition-colors"
        aria-label="Map layers"
      >
        <Layers size={20} className="text-gray-700" />
      </button>

      {/* Layer Selector Popup - Google Maps style */}
      {showLayerSelector && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 z-[999]"
            onClick={() => setShowLayerSelector(false)}
          />
          
          {/* Layer options */}
          <div className="absolute top-16 right-4 bg-white rounded-xl shadow-2xl overflow-hidden z-[1001] min-w-[200px]">
            <div className="p-3 border-b border-gray-100">
              <h3 className="text-sm font-medium text-gray-900">Map type</h3>
            </div>
            
            <div className="p-2 space-y-1">
              <button
                onClick={() => {
                  setCurrentLayer('standard');
                  setShowLayerSelector(false);
                }}
                className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors ${
                  currentLayer === 'standard' ? 'bg-primary/10' : ''
                }`}
              >
                <div className={`w-10 h-10 rounded border-2 bg-gradient-to-br from-green-100 to-blue-100 flex items-center justify-center ${
                  currentLayer === 'standard' ? 'border-primary' : 'border-gray-200'
                }`}>
                  🗺️
                </div>
                <div className="flex-1 text-left">
                  <div className={`text-sm font-medium ${currentLayer === 'standard' ? 'text-primary' : 'text-gray-900'}`}>
                    Default
                  </div>
                  <div className="text-xs text-gray-500">
                    Street map
                  </div>
                </div>
                {currentLayer === 'standard' && (
                  <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white"></div>
                  </div>
                )}
              </button>

              <button
                onClick={() => {
                  setCurrentLayer('satellite');
                  setShowLayerSelector(false);
                }}
                className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors ${
                  currentLayer === 'satellite' ? 'bg-primary/10' : ''
                }`}
              >
                <div className={`w-10 h-10 rounded border-2 bg-gradient-to-br from-green-600 to-blue-600 flex items-center justify-center ${
                  currentLayer === 'satellite' ? 'border-primary' : 'border-gray-200'
                }`}>
                  🛰️
                </div>
                <div className="flex-1 text-left">
                  <div className={`text-sm font-medium ${currentLayer === 'satellite' ? 'text-primary' : 'text-gray-900'}`}>
                    Satellite
                  </div>
                  <div className="text-xs text-gray-500">
                    Aerial imagery
                  </div>
                </div>
                {currentLayer === 'satellite' && (
                  <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white"></div>
                  </div>
                )}
              </button>
            </div>
          </div>
        </>
      )}
      
      {/* Re-center Button */}
      <Button
        onClick={handleRecenter}
        className="absolute bottom-4 right-4 bg-white text-gray-700 hover:bg-gray-50 shadow-lg z-[1000] border-0"
        size="sm"
        variant="ghost"
      >
        <Navigation size={16} className="mr-2" />
        Re-center
      </Button>

      {/* Attribution */}
      <div className="absolute bottom-1 left-1 bg-white/90 px-2 py-1 text-xs text-gray-600 rounded z-[1000]">
        {currentLayer === 'satellite' ? '© Esri, Maxar, Earthstar Geographics' : '© OpenStreetMap contributors'}
      </div>
    </div>
  );
};

export default OSMMap;