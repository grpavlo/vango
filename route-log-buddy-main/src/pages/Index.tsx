import { useState } from 'react';
import RoutesListScreen from '../components/RoutesListScreen';
import RouteDetailScreen from '../components/RouteDetailScreen';
import RouteDescriptionScreen from '../components/RouteDescriptionScreen';
import InTripNavigationScreen from '../components/InTripNavigationScreen';
import VisitScreen from '../components/VisitScreen';
import BottomNavigation from '../components/BottomNavigation';
import VehicleSelectionScreen from '../components/VehicleSelectionScreen';
import MapScreen from '../components/MapScreen';
import ReportCollectedSamplesScreen from '../components/ReportCollectedSamplesScreen';
import CollectedSamplesScreen from '../components/CollectedSamplesScreen';
import SettingsScreen from '../components/SettingsScreen';
import ChangePasswordScreen from '../components/ChangePasswordScreen';
import ActionsScreen from '../components/ActionsScreen';
import PickUpSamplesScreen from '../components/PickUpSamplesScreen';
import DropOffToLabScreen from '../components/DropOffToLabScreen';
import GetHelpScreen from '../components/GetHelpScreen';
import CallFuneralServiceScreen from '../components/CallFuneralServiceScreen';
import CallDispatcherScreen from '../components/CallDispatcherScreen';
import SendHelpRequestScreen from '../components/SendHelpRequestScreen';
import FindCourierTransferScreen from '../components/FindCourierTransferScreen';
import ArrivalCheckScreen from '../components/ArrivalCheckScreen';
import EmptyBoxOfficeCheckModal from '../components/EmptyBoxOfficeCheckModal';
import SamplesAvailableModal from '../components/SamplesAvailableModal';
import NoSamplesFormScreen from '../components/NoSamplesFormScreen';
import ClosedOfficeFormScreen from '../components/ClosedOfficeFormScreen';
import TakePicturesScreen from '../components/TakePicturesScreen';
import HelpScreen from '../components/HelpScreen';
import OtherIssuesModal from '../components/OtherIssuesModal';
import AppLayout from '../components/AppLayout';
import ShipScreen from '../components/ShipScreen';
import NotificationsScreen from '../components/NotificationsScreen';
import MainDashboardScreen from '../components/MainDashboardScreen';
import ReportsScreen from '../components/ReportsScreen';


type Screen = 'dashboard' | 'routes-list' | 'route-detail' | 'route-description' | 'navigation' | 'arrival-check' | 'visit' | 'samples' | 'vehicle-selection' | 'map' | 'report-samples' | 'collected-samples' | 'settings' | 'change-password' | 'actions' | 'notifications' | 'pick-up-samples' | 'drop-off-to-lab' | 'ship' | 'get-help' | 'call-funeral' | 'call-dispatcher' | 'send-help-request' | 'find-courier-transfer' | 'no-samples-form' | 'closed-office-form' | 'take-pictures' | 'help-screen' | 'reports';

const Index = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('road');
  const [isRouteStarted, setIsRouteStarted] = useState(false);
  const [completedCheckpointId, setCompletedCheckpointId] = useState<string | null>(null);
  const [routeStatus, setRouteStatus] = useState<'not_started' | 'in_progress' | 'completed'>('not_started');
  
  // Modal states for arrival check flow
  const [showOfficeCheckModal, setShowOfficeCheckModal] = useState(false);
  const [showSamplesAvailableModal, setShowSamplesAvailableModal] = useState(false);
  const [showOtherIssuesModal, setShowOtherIssuesModal] = useState(false);

  const handleNavigateToRoute = (routeId: string) => {
    setSelectedRouteId(routeId);
    setCurrentScreen('route-detail');
  };

  const handleNavigateToCheckpoint = (checkpointId: string) => {
    setSelectedCheckpointId(checkpointId);
    setCurrentScreen('navigation');
  };

  const handleNavigateToDescription = () => {
    setCurrentScreen('route-description');
  };

  const handleStartVisit = () => {
    setCurrentScreen('arrival-check');
  };

  const handleCompleteVisit = (checkpointId?: string) => {
    // Mark checkpoint as completed if provided
    if (checkpointId) {
      setCompletedCheckpointId(checkpointId);
    }
    setCurrentScreen('route-detail');
  };

  const handleNavigateToSamples = () => {
    setCurrentScreen('samples');
  };

  const handleNavigateToCollectedSamples = () => {
    setCurrentScreen('collected-samples');
  };

  const handleBackFromCollectedSamples = () => {
    setCurrentScreen('dashboard');
  };

  const handleNavigateToReportSamples = () => {
    setCurrentScreen('report-samples');
  };

  const handleBackFromReportSamples = () => {
    setCurrentScreen('visit');
  };

  const handleStartRoute = () => {
    setCurrentScreen('vehicle-selection');
  };

  const handleVehicleConfirmed = (vehicleId: string) => {
    setIsRouteStarted(true);
    setRouteStatus('in_progress');
    setCurrentScreen('route-detail');
  };

  const handleBackToRoutes = () => {
    setCurrentScreen('routes-list');
    setSelectedRouteId(null);
    setSelectedCheckpointId(null);
    setIsRouteStarted(false);
    setCompletedCheckpointId(null);
  };

  const handleBackToRouteDetail = () => {
    console.log('Navigating back to route detail, selectedRouteId:', selectedRouteId);
    if (!selectedRouteId) {
      console.error('No selectedRouteId when navigating back to route detail');
      setCurrentScreen('routes-list');
    } else {
      setCurrentScreen('route-detail');
    }
  };

  const handleTabChange = (tabId: string) => {
    if (tabId === 'dashboard') {
      setCurrentScreen('dashboard');
    } else if (tabId === 'road') {
      setCurrentScreen('routes-list');
    } else if (tabId === 'map') {
      setCurrentScreen('map');
    } else if (tabId === 'actions') {
      setCurrentScreen('actions');
    } else if (tabId === 'settings') {
      setCurrentScreen('settings');
    }
    setActiveTab(tabId);
  };

  const handleNavigateToChangePassword = () => {
    setCurrentScreen('change-password');
  };

  const handleBackFromChangePassword = () => {
    setCurrentScreen('settings');
  };

  const handleNavigateToPickUpSamples = () => {
    setCurrentScreen('pick-up-samples');
  };

  const handleBackFromPickUpSamples = () => {
    setCurrentScreen('actions');
  };

  const handleNavigateToDropOffToLab = () => {
    setCurrentScreen('drop-off-to-lab');
  };

  const handleBackFromDropOffToLab = () => {
    setCurrentScreen('actions');
  };

  const handleNavigateToShip = () => {
    setCurrentScreen('ship');
  };

  const handleBackFromShip = () => {
    setCurrentScreen('actions');
  };

  const handleNavigateToGetHelp = () => {
    setCurrentScreen('get-help');
  };

  const handleBackFromGetHelp = () => {
    setCurrentScreen('actions');
  };

  const handleNavigateToNotifications = () => {
    setCurrentScreen('notifications');
  };

  const handleBackFromNotifications = () => {
    setCurrentScreen('actions');
  };

  const handleNavigateToCallFuneral = () => {
    setCurrentScreen('call-funeral');
  };

  const handleNavigateToCallDispatcher = () => {
    setCurrentScreen('call-dispatcher');
  };

  const handleNavigateToSendHelpRequest = () => {
    setCurrentScreen('send-help-request');
  };

  const handleNavigateToFindCourier = () => {
    setCurrentScreen('find-courier-transfer');
  };

  const handleBackFromHelpScreens = () => {
    setCurrentScreen('get-help');
  };

  // Arrival Check handlers
  const handlePickUpSamples = () => {
    setCurrentScreen('visit');
  };

  const handleEmptyBox = () => {
    setShowOfficeCheckModal(true);
  };

  const handleUnableToFind = () => {
    setShowOfficeCheckModal(true);
  };

  const handleOtherIssues = () => {
    setShowOtherIssuesModal(true);
  };

  const handleVisitNotes = () => {
    // Navigate to visit notes functionality
    console.log('Navigate to visit notes');
  };

  const handleArrivalHelp = () => {
    setCurrentScreen('help-screen');
  };

  const handleOfficeOpen = () => {
    setShowOfficeCheckModal(false);
    setShowSamplesAvailableModal(true);
  };

  const handleOfficeClosed = () => {
    setShowOfficeCheckModal(false);
    setCurrentScreen('closed-office-form');
  };

  const handleSamplesYes = () => {
    setShowSamplesAvailableModal(false);
    setCurrentScreen('visit');
  };

  const handleSamplesNo = () => {
    setShowSamplesAvailableModal(false);
    setCurrentScreen('no-samples-form');
  };

  const handleOtherIssuesOk = () => {
    setShowOtherIssuesModal(false);
    setCurrentScreen('take-pictures');
  };

  const handleTakePictures = () => {
    setCurrentScreen('take-pictures');
  };

  const handleFinishTakePictures = () => {
    setCurrentScreen('route-detail');
  };

  const handleBackFromArrivalFlow = () => {
    setCurrentScreen('arrival-check');
  };

  const handleBackFromTakePictures = () => {
    // Determine where to go back based on context
    setCurrentScreen('arrival-check');
  };

  const handleContactOffice = () => {
    console.log('Contact office');
  };

  const handleTextDispatch = () => {
    console.log('Text dispatch');
  };

  const handleShareLocation = () => {
    console.log('Share location');
  };

  const handleBackFromHelpScreen = () => {
    setCurrentScreen('arrival-check');
  };

  const handleNavigateToReports = () => {
    setCurrentScreen('reports');
  };

  const handleBackFromReports = () => {
    setCurrentScreen('dashboard');
  };

  // FAB handlers
  const handleFABStartRoute = () => {
    setRouteStatus('in_progress');
    setCurrentScreen('navigation');
  };

  const handleFABResumeRoute = () => {
    setCurrentScreen('navigation');
  };

  const handleFABNextStop = () => {
    // Navigate to next checkpoint
    console.log('Navigating to next stop...');
  };

  const handleFABCompleteStop = () => {
    if (selectedCheckpointId) {
      setCompletedCheckpointId(selectedCheckpointId);
      setCurrentScreen('route-detail');
    }
  };

  const handleFABGetHelp = () => {
    setCurrentScreen('get-help');
  };

  // Get FAB screen context
  const getFABScreen = () => {
    switch (currentScreen) {
      case 'routes-list': return 'routes';
      case 'route-detail': return 'route_detail';
      case 'navigation': 
      case 'visit': return 'in_trip';
      case 'actions': 
      case 'get-help': return 'actions';
      default: return null;
    }
  };

  return (
    <AppLayout>
      {currentScreen === 'dashboard' && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab="dashboard"
              onTabChange={handleTabChange}
              badges={{ actions: 3 }}
            />
          }
        >
          <MainDashboardScreen
            onNavigateToNotifications={handleNavigateToNotifications}
            onNavigateToSettings={() => setCurrentScreen('settings')}
            onNavigateToRoutes={() => setCurrentScreen('routes-list')}
            onNavigateToMap={() => setCurrentScreen('map')}
            onNavigateToActions={() => setCurrentScreen('actions')}
            onNavigateToReports={handleNavigateToCollectedSamples}
            onNavigateToGetHelp={() => setCurrentScreen('get-help')}
            onStartActiveRoute={() => setCurrentScreen('vehicle-selection')}
            onPickUpSamples={() => setCurrentScreen('pick-up-samples')}
            onDropOffToLab={() => setCurrentScreen('drop-off-to-lab')}
            onShip={() => setCurrentScreen('ship')}
            onRequestDispatcherAssistance={() => setCurrentScreen('send-help-request')}
            onContactDriverTransfer={() => setCurrentScreen('find-courier-transfer')}
            onCallDispatcher={() => setCurrentScreen('call-dispatcher')}
            onNavigateToActiveRoute={() => {
              setSelectedRouteId('route-127');
              setCurrentScreen('route-detail');
            }}
            notificationCount={3}
          />
        </AppLayout>
      )}

      {currentScreen === 'routes-list' && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          }
        >
          <RoutesListScreen 
            onNavigateToRoute={handleNavigateToRoute}
            onNavigateToSamples={handleNavigateToSamples}
            onNavigateToCollectedSamples={handleNavigateToCollectedSamples}
          />
        </AppLayout>
      )}
      
      {currentScreen === 'route-detail' && selectedRouteId && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          }
        >
          <RouteDetailScreen 
            routeId={selectedRouteId}
            onNavigateToCheckpoint={handleNavigateToCheckpoint}
            onNavigateToDescription={handleNavigateToDescription}
            onStartRoute={handleStartRoute}
            onBack={handleBackToRoutes}
            completedCheckpointId={completedCheckpointId}
          />
        </AppLayout>
      )}
      
      {currentScreen === 'route-description' && selectedRouteId && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          }
        >
          <RouteDescriptionScreen 
            routeId={selectedRouteId}
            onBack={handleBackToRouteDetail}
          />
        </AppLayout>
      )}
      
      {currentScreen === 'navigation' && selectedCheckpointId && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          }
        >
          <InTripNavigationScreen 
            checkpointId={selectedCheckpointId}
            onStartVisit={handleStartVisit}
            onBack={handleBackToRouteDetail}
            isRouteStarted={isRouteStarted}
          />
        </AppLayout>
      )}
      
      {currentScreen === 'visit' && selectedCheckpointId && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          }
        >
          <VisitScreen 
            checkpointId={selectedCheckpointId}
            onComplete={handleCompleteVisit}
            onReportSamples={handleNavigateToReportSamples}
          />
        </AppLayout>
      )}
      
      {currentScreen === 'report-samples' && (
        <AppLayout showBottomNav={false}>
          <ReportCollectedSamplesScreen 
            onBack={handleBackFromReportSamples}
          />
        </AppLayout>
      )}
      
      {currentScreen === 'samples' && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          }
        >
          <VisitScreen 
            checkpointId="samples"
            onComplete={handleBackToRoutes}
          />
        </AppLayout>
      )}
      
      {currentScreen === 'vehicle-selection' && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          }
        >
          <VehicleSelectionScreen 
            onBack={handleBackToRouteDetail}
            onVehicleConfirmed={handleVehicleConfirmed}
          />
        </AppLayout>
      )}
      
      {currentScreen === 'map' && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          }
        >
          <MapScreen 
            routeId={selectedRouteId} 
            onNavigateToCheckpoint={(checkpointId) => {
              setSelectedCheckpointId(checkpointId);
              setCurrentScreen('navigation');
            }}
          />
        </AppLayout>
      )}
      
      {currentScreen === 'collected-samples' && (
        <CollectedSamplesScreen 
          onBack={handleBackFromCollectedSamples}
        />
      )}
      
      {currentScreen === 'settings' && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          }
        >
          <SettingsScreen 
            onChangePassword={handleNavigateToChangePassword}
          />
        </AppLayout>
      )}
      
      {currentScreen === 'change-password' && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          }
        >
          <ChangePasswordScreen 
            onBack={handleBackFromChangePassword}
          />
        </AppLayout>
      )}
      
      {currentScreen === 'actions' && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
              badges={{ actions: 3 }}
            />
          }
        >
          <NotificationsScreen 
            onBack={() => setCurrentScreen('dashboard')}
            onNavigateToRoute={handleNavigateToRoute}
            onNavigateToCheckpoint={handleNavigateToCheckpoint}
          />
        </AppLayout>
      )}
      
      {currentScreen === 'pick-up-samples' && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          }
        >
          <PickUpSamplesScreen 
            onBack={() => setCurrentScreen('dashboard')}
          />
        </AppLayout>
      )}

      {currentScreen === 'drop-off-to-lab' && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          }
        >
          <DropOffToLabScreen 
            onBack={() => setCurrentScreen('dashboard')}
          />
        </AppLayout>
      )}

      {currentScreen === 'ship' && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          }
        >
          <ShipScreen 
            onBack={() => setCurrentScreen('dashboard')}
          />
        </AppLayout>
      )}

      {currentScreen === 'get-help' && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          }
        >
          <GetHelpScreen 
            onBack={handleBackFromGetHelp}
            onNavigateToCallFuneral={handleNavigateToCallFuneral}
            onNavigateToCallDispatcher={handleNavigateToCallDispatcher}
            onNavigateToSendHelpRequest={handleNavigateToSendHelpRequest}
            onNavigateToFindCourier={handleNavigateToFindCourier}
          />
        </AppLayout>
      )}

      {currentScreen === 'call-funeral' && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          }
        >
          <CallFuneralServiceScreen 
            onBack={handleBackFromHelpScreens}
          />
        </AppLayout>
      )}

      {currentScreen === 'call-dispatcher' && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          }
        >
          <CallDispatcherScreen 
            onBack={() => setCurrentScreen('dashboard')}
          />
        </AppLayout>
      )}

      {currentScreen === 'send-help-request' && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          }
        >
          <SendHelpRequestScreen 
            onBack={() => setCurrentScreen('dashboard')}
          />
        </AppLayout>
      )}

      {currentScreen === 'find-courier-transfer' && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          }
        >
          <FindCourierTransferScreen 
            onBack={() => setCurrentScreen('dashboard')}
          />
        </AppLayout>
      )}

      {currentScreen === 'arrival-check' && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          }
        >
          <ArrivalCheckScreen 
            onPickUpSamples={handlePickUpSamples}
            onEmptyBox={handleEmptyBox}
            onUnableToFind={handleUnableToFind}
            onOtherIssues={handleOtherIssues}
            onVisitNotes={handleVisitNotes}
            onHelp={handleArrivalHelp}
          />
          <EmptyBoxOfficeCheckModal
            isOpen={showOfficeCheckModal}
            onClose={() => setShowOfficeCheckModal(false)}
            onOfficeOpen={handleOfficeOpen}
            onOfficeClosed={handleOfficeClosed}
          />
          <SamplesAvailableModal
            isOpen={showSamplesAvailableModal}
            onClose={() => setShowSamplesAvailableModal(false)}
            onYes={handleSamplesYes}
            onNo={handleSamplesNo}
          />
          <OtherIssuesModal
            isOpen={showOtherIssuesModal}
            onClose={() => setShowOtherIssuesModal(false)}
            onOk={handleOtherIssuesOk}
          />
        </AppLayout>
      )}

      {currentScreen === 'no-samples-form' && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          }
        >
          <NoSamplesFormScreen 
            onBack={handleBackFromArrivalFlow}
            onTakePictures={handleTakePictures}
            onHelp={handleArrivalHelp}
          />
        </AppLayout>
      )}

      {currentScreen === 'closed-office-form' && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          }
        >
          <ClosedOfficeFormScreen 
            onBack={handleBackFromArrivalFlow}
            onTakePictures={handleTakePictures}
            onHelp={handleArrivalHelp}
          />
        </AppLayout>
      )}

      {currentScreen === 'take-pictures' && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          }
        >
          <TakePicturesScreen 
            onBack={handleBackFromTakePictures}
            onFinish={handleFinishTakePictures}
            onHelp={handleArrivalHelp}
          />
        </AppLayout>
      )}

      {currentScreen === 'help-screen' && (
        <AppLayout 
          bottomContent={
            <BottomNavigation 
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          }
        >
          <HelpScreen 
            onBack={handleBackFromHelpScreen}
            onContactOffice={handleContactOffice}
            onCallDispatcher={handleNavigateToCallDispatcher}
            onTextDispatch={handleTextDispatch}
            onShareLocation={handleShareLocation}
          />
        </AppLayout>
      )}

      {currentScreen === 'reports' && (
        <ReportsScreen 
          onBack={handleBackFromReports}
          onNavigateToCollectedSamples={() => setCurrentScreen('collected-samples')}
        />
      )}
    </AppLayout>
  );
};

export default Index;
