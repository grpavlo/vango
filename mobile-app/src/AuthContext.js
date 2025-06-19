import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from './api';

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
          try {
            const me = await apiFetch('/auth/me', {
              headers: { Authorization: `Bearer ${storedToken}` },
            });
            setToken(storedToken);
            const r = me.role === 'BOTH' ? null : me.role;
            setRole(r);
            if (r) {
              await AsyncStorage.setItem('role', r);
            } else {
              await AsyncStorage.removeItem('role');
            }
          } catch {
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('role');
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

  const logout = async () => {
    await AsyncStorage.multiRemove(['token', 'role']);
    setToken(null);
    setRole(null);
  };

  const selectRole = async (r) => {
    if (!token) return;
    await apiFetch('/auth/role', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role: r }),
    });
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
