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
        const storedRole = await AsyncStorage.getItem('role');
        if (storedToken) {
          try {
            await apiFetch('/orders/my', {
              headers: { Authorization: `Bearer ${storedToken}` },
            });
            setToken(storedToken);
            setRole(storedRole);
          } catch {
            await AsyncStorage.removeItem('token');
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const login = async (tok) => {
    await AsyncStorage.setItem('token', tok);
    setToken(tok);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['token', 'role']);
    setToken(null);
    setRole(null);
  };

  const selectRole = async (r) => {
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
