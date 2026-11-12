import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import AsyncStorage, { pausePersonalStorage } from './personalStorage';
import RawAsyncStorage from '@react-native-async-storage/async-storage';
import { createAccountDeletionFlow, isDeletionLocked } from './accountDeletionFlow';
import { requestAccountDeletion } from './accountDeletionApi';
import { clearPersonalData } from './clearPersonalData';
import { clearCallbacks } from './callbackRegistry';
import { apiFetch, setUnauthorizedHandler, setAccountDeletionToken, isAccountDeletionInProgress, retireAccountDeletionToken, isAccountSessionUnavailable } from './api';
import { getPushToken } from './notifications';
import { setNotificationCenterUser, pauseNotificationStorage } from './notificationCenter';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [isTestAccount, setIsTestAccount] = useState(false);
  const roleRequestRef = useRef(false);
  const [role, setRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accountDeletion, setAccountDeletion] = useState(null);
  const [deletionNotice, setDeletionNotice] = useState('');
  const deletionFlowRef = useRef(null);
  const deletionCompletedRef = useRef(false);
  if (!deletionFlowRef.current) {
    deletionFlowRef.current = createAccountDeletionFlow({
      storage: RawAsyncStorage, request: requestAccountDeletion, cleanup: clearPersonalData,
      onSession: deletionToken => {
        setAccountDeletionToken(deletionToken);
        pausePersonalStorage(Boolean(deletionToken) || deletionCompletedRef.current);
        pauseNotificationStorage(Boolean(deletionToken) || deletionCompletedRef.current);
        if (deletionToken) clearCallbacks();
      },
      onComplete: notice => {
        deletionCompletedRef.current = true;
        retireAccountDeletionToken(deletionFlowRef.current.getState()?.token);
        setIsTestAccount(false);
        setToken(null); setRole(null); setUserId(null); setNeedsProfileSetup(false);
        setDeletionNotice(notice);
      },
    });
  }
  useEffect(() => deletionFlowRef.current.subscribe(setAccountDeletion), []);


  const applyUserId = useCallback(async (nextUserId, expectedToken) => {
    if (expectedToken && isAccountSessionUnavailable(expectedToken)) return;
    const normalizedUserId = nextUserId == null ? null : String(nextUserId);
    setUserId(normalizedUserId);
    await setNotificationCenterUser(normalizedUserId);
    if (expectedToken && isAccountSessionUnavailable(expectedToken)) return;
    if (normalizedUserId) {
      await AsyncStorage.setItem('userId', normalizedUserId);
    } else {
      await AsyncStorage.removeItem('userId');
    }
  }, []);

  const forceLogout = useCallback(async () => {
    if (isDeletionLocked(deletionFlowRef.current.getState())) return;
    deletionFlowRef.current.dismissBlocked();
    await AsyncStorage.multiRemove(['token', 'role', 'userId', 'isTestAccount']);
    setIsTestAccount(false);
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
        await deletionFlowRef.current.restore();
        const restoredDeletion = deletionFlowRef.current.getState();
        if (restoredDeletion) { setToken(restoredDeletion.token); return; }
        const storedToken = await AsyncStorage.getItem('token');
        const storedUserId = await AsyncStorage.getItem('userId');
        if (storedUserId) {
          setUserId(storedUserId);
          await setNotificationCenterUser(storedUserId);
        }
        if (storedToken) {
          setToken(storedToken);
          setIsTestAccount((await AsyncStorage.getItem('isTestAccount')) === 'true');
          try {
            const me = await apiFetch('/auth/me', {
              headers: { Authorization: `Bearer ${storedToken}` },
            });
            if (isAccountSessionUnavailable(storedToken)) return;
            setIsTestAccount(me.isTestAccount === true);
            await AsyncStorage.setItem('isTestAccount', String(me.isTestAccount === true));
            await applyUserId(me.id, storedToken);
            const r = me.role === 'BOTH' ? null : me.role;
            setRole(r);
            if (r) {
              if (isAccountSessionUnavailable(token)) return;
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


  const login = async (tok, r, metadata = {}) => {
    deletionCompletedRef.current = false;
    pausePersonalStorage(false); pauseNotificationStorage(false);
    setIsTestAccount(metadata.isTestAccount === true);
    await AsyncStorage.setItem('isTestAccount', String(metadata.isTestAccount === true));
    setDeletionNotice('');
    await AsyncStorage.setItem('token', tok);
    setToken(tok);
    let profile = null;
    try {
      profile = await apiFetch('/auth/me', {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (isAccountSessionUnavailable(tok)) return;
      setIsTestAccount(profile.isTestAccount === true);
      await AsyncStorage.setItem('isTestAccount', String(profile.isTestAccount === true));
      await applyUserId(profile.id, tok);
    } catch {}
    if (isAccountSessionUnavailable(tok)) return;

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
        if (isAccountSessionUnavailable(tok)) return;
        await applyUserId(me.id, tok);
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
    if (!token || isDeletionLocked(accountDeletion)) return;
    let cancelled = false;
    async function register() {
      try {
        const expoToken = await getPushToken();
        if (cancelled || isAccountDeletionInProgress()) return;
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
    return () => { cancelled = true; };
  }, [token, accountDeletion]);

  const logout = useCallback(async () => {
    await forceLogout();
  }, [forceLogout]);

  const selectRole = async (r, fromRegistration = false) => {
    if (!token || roleRequestRef.current) return;
    roleRequestRef.current = true;
    try {
      const result = await apiFetch('/auth/role', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: r }),
      });
      if (isAccountSessionUnavailable(token)) return;
      await AsyncStorage.setItem('role', r);
      if (isAccountSessionUnavailable(token)) return;
      await AsyncStorage.setItem('isTestAccount', String(result.isTestAccount === true));
      if (isAccountSessionUnavailable(token)) return;
      setIsTestAccount(result.isTestAccount === true);
      setNeedsProfileSetup(fromRegistration && !(r === 'DRIVER' &&
        result.isTestAccount === true && result.demoDriverProfileReady === true));
      setRole(r);
    } finally {
      roleRequestRef.current = false;
    }
  };

  const clearNeedsProfileSetup = useCallback(() => {
    setNeedsProfileSetup(false);
  }, []);

  return (
    <AuthContext.Provider value={{ token, role, isTestAccount, userId, needsProfileSetup, loading, login, logout, selectRole, clearNeedsProfileSetup,
      accountDeletion, deletionNotice,
      beginAccountDeletion: () => deletionFlowRef.current.begin(token),
      retryAccountDeletion: () => deletionFlowRef.current.retry(),
      exitUnconfirmedDeletion: () => deletionFlowRef.current.exitUnconfirmed(),
      dismissBlockedDeletion: () => deletionFlowRef.current.dismissBlocked(),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
