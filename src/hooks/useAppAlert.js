import { useCallback } from 'react';
import { useAppAlertStore } from '../store/useAppAlertStore';

export const useAppAlert = () => {
    const showAlertStore = useAppAlertStore((state) => state.showAlert);
    const hideAlertStore = useAppAlertStore((state) => state.hideAlert);

    const showAlert = useCallback(
        (config) => {
            showAlertStore(config);
        },
        [showAlertStore]
    );

    const hideAlert = useCallback(() => {
        hideAlertStore();
    }, [hideAlertStore]);

    return { showAlert, hideAlert };
};

