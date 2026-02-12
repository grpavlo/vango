import React from 'react';
import { useAuth } from '../AuthContext';
import EditCustomerProfileScreen from './EditCustomerProfileScreen';
import EditProfile from './EditProfile';

export default function RoleProfileWrapper({ navigation }) {
  const { role, clearNeedsProfileSetup } = useAuth();

  const navWithComplete = {
    ...navigation,
    goBack: () => clearNeedsProfileSetup(),
  };

  if (role === 'CUSTOMER') {
    return (
      <EditCustomerProfileScreen
        navigation={navWithComplete}
        route={{ params: { user: null } }}
      />
    );
  }
  return (
    <EditProfile
      navigation={navWithComplete}
      route={{ params: { user: null } }}
    />
  );
}
