import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch, setUnauthorizedHandler } from './api';
import { getPushToken } from './notifications';
import { navigate } from './navigationRef';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  const forceLogout = useCallback(async () => {
    await AsyncStorage.multiRemove(['token', 'role']);
    setToken(null);
    setRole(null);
    navigate('Login'); // PhoneAuthScreen
  }, []);

  // Register global unauthorized handler early to catch 401s during initial load
  useEffect(() => {
    setUnauthorizedHandler(forceLogout);
  }, [forceLogout]);

  useEffect(() => {
    async function load() {
      try {
        const storedToken = await AsyncStorage.getItem('token');
        if (storedToken) {
          setToken(storedToken);
          try {
            const me = await apiFetch('/auth/me', {
              headers: { Authorization: `Bearer ${storedToken}` },
            });
            const r = me.role === 'BOTH' ? null : me.role;
            setRole(r);
            if (r) {
              await AsyncStorage.setItem('role', r);
            } else {
              await AsyncStorage.removeItem('role');
            }
          } catch {
            const storedRole = await AsyncStorage.getItem('role');
            if (storedRole) setRole(storedRole);
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);


  const login = async (tok, r) => {
    await AsyncStorage.setItem('token', tok);
    setToken(tok);
    if (r) {
      const roleVal = r === 'BOTH' ? null : r;
      if (roleVal) {
        await AsyncStorage.setItem('role', roleVal);
      } else {
        await AsyncStorage.removeItem('role');
      }
      setRole(roleVal);
    } else {
      try {
        const me = await apiFetch('/auth/me', {
          headers: { Authorization: `Bearer ${tok}` },
        });
        const roleVal = me.role === 'BOTH' ? null : me.role;
        if (roleVal) {
          await AsyncStorage.setItem('role', roleVal);
        } else {
          await AsyncStorage.removeItem('role');
        }
        setRole(roleVal);
      } catch {
        await forceLogout();
      }
    }
  };

  useEffect(() => {
    if (!token) return;
    async function register() {
      try {
        const expoToken = await getPushToken();
        if (expoToken) {
          await apiFetch('/auth/push-token', {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify({ token: expoToken }),
          });
          // Mark user consent to receive pushes on the backend
          await apiFetch('/auth/push-consent', {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify({ consent: true }),
          });
        }
      } catch (e) {
        console.log('push token error', e.message);
      }
    }
    register();
  }, [token]);

  const logout = useCallback(async () => {
    await forceLogout();
  }, [forceLogout]);

  const selectRole = async (r, fromRegistration = false) => {
    if (!token) return;
    try {
      await apiFetch('/auth/role', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: r }),
      });
    } catch (e) {
      console.log('selectRole error', e.message);
    }
    await AsyncStorage.setItem('role', r);
    setRole(r);
    if (fromRegistration) {
      setNeedsProfileSetup(true);
    }
  };

  const clearNeedsProfileSetup = useCallback(() => {
    setNeedsProfileSetup(false);
  }, []);

  return (
    <AuthContext.Provider value={{ token, role, needsProfileSetup, loading, login, logout, selectRole, clearNeedsProfileSetup }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
