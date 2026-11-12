import React from 'react';
import { View } from 'react-native';
import AppButton from '../components/AppButton';
import { useAuth } from '../AuthContext';
import EditCustomerProfileScreen from './EditCustomerProfileScreen';
import EditProfile from './EditProfile';

export default function RoleProfileWrapper({ navigation }) {
  const { role, clearNeedsProfileSetup } = useAuth();

  const navWithComplete = {
    ...navigation,
    goBack: () => clearNeedsProfileSetup(),
  };

  const content = role === 'CUSTOMER'
    ? <EditCustomerProfileScreen navigation={navWithComplete} route={{params: {user: null}}} />
    : <EditProfile navigation={navWithComplete} route={{params: {user: null}}} />;
  return <View style={{flex: 1}}>
    <View style={{flex: 1}}>{content}</View>
    <AppButton title="Видалити акаунт" variant="danger" style={{marginBottom: 24, alignSelf: 'center', width: '88%'}}
      onPress={() => navigation.navigate('DeleteAccount')} />
  </View>;
}
