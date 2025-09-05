import React, { forwardRef } from 'react';
import { Platform } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';

// Wrapper to ensure we consistently use Google provider across the app.
// No custom tiles here — uses default Google Maps.
const AppMap = forwardRef(({ children, style, ...rest }, ref) => (
  <MapView
    ref={ref}
    style={style || { flex: 1 }}
    provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
    {...rest}
  >
    {children}
  </MapView>
));

export default AppMap;
