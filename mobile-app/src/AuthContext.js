import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch, setUnauthorizedHandler } from './api';
import { getPushToken } from './notifications';
import { setNotificationCenterUser } from './notificationCenter';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  const applyUserId = useCallback(async (nextUserId) => {
    const normalizedUserId = nextUserId == null ? null : String(nextUserId);
    setUserId(normalizedUserId);
    await setNotificationCenterUser(normalizedUserId);
    if (normalizedUserId) {
      await AsyncStorage.setItem('userId', normalizedUserId);
    } else {
      await AsyncStorage.removeItem('userId');
    }
  }, []);

  const forceLogout = useCallback(async () => {
    await AsyncStorage.multiRemove(['token', 'role', 'userId']);
    setToken(null);
    setRole(null);
    setUserId(null);
    await setNotificationCenterUser(null);
    setNeedsProfileSetup(false);
  }, []);

  // Register global unauthorized handler early to catch 401s during initial load
  useEffect(() => {
    setUnauthorizedHandler(forceLogout);
  }, [forceLogout]);

  useEffect(() => {
    async function load() {
      try {
        const storedToken = await AsyncStorage.getItem('token');
        const storedUserId = await AsyncStorage.getItem('userId');
        if (storedUserId) {
          setUserId(storedUserId);
          await setNotificationCenterUser(storedUserId);
        }
        if (storedToken) {
          setToken(storedToken);
          try {
            const me = await apiFetch('/auth/me', {
              headers: { Authorization: `Bearer ${storedToken}` },
            });
            await applyUserId(me.id);
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
  }, [applyUserId]);


  const login = async (tok, r) => {
    await AsyncStorage.setItem('token', tok);
    setToken(tok);
    let profile = null;
    try {
      profile = await apiFetch('/auth/me', {
        headers: { Authorization: `Bearer ${tok}` },
      });
      await applyUserId(profile.id);
    } catch {}

    if (r) {
      const roleValue = profile?.role || r;
      const roleVal = roleValue === 'BOTH' ? null : roleValue;
      if (roleVal) {
        await AsyncStorage.setItem('role', roleVal);
      } else {
        await AsyncStorage.removeItem('role');
      }
      setRole(roleVal);
    } else {
      try {
        const me = profile || await apiFetch('/auth/me', {
          headers: { Authorization: `Bearer ${tok}` },
        });
        await applyUserId(me.id);
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
    <AuthContext.Provider value={{ token, role, userId, needsProfileSetup, loading, login, logout, selectRole, clearNeedsProfileSetup }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
