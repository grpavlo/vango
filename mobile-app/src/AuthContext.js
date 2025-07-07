import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from './api';
import { getPushToken } from './notifications';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

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
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('role');
        setToken(null);
        setRole(null);
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
        }
      } catch (e) {
        console.log('push token error', e.message);
      }
    }
    register();
  }, [token]);

  const logout = async () => {
    await AsyncStorage.multiRemove(['token', 'role']);
    setToken(null);
    setRole(null);
  };

  const selectRole = async (r) => {
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
  };

  return (
    <AuthContext.Provider value={{ token, role, loading, login, logout, selectRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
