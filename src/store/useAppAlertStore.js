import { create } from 'zustand';

const defaultState = {
    visible: false,
    title: '',
    message: '',
    variant: 'info',
    confirmText: 'OK',
    cancelText: null,
    onConfirm: null,
    onCancel: null,
    dismissible: true,
};

export const useAppAlertStore = create((set) => ({
    ...defaultState,
    showAlert: (config = {}) =>
        set((state) => ({
            ...state,
            visible: true,
            title: config.title ?? '',
            message: config.message ?? '',
            variant: config.variant ?? 'info',
            confirmText: config.confirmText ?? 'OK',
            cancelText: config.cancelText ?? null,
            onConfirm: config.onConfirm ?? null,
            onCancel: config.onCancel ?? null,
            dismissible: config.dismissible ?? true,
        })),
    hideAlert: () =>
        set((state) => ({
            ...state,
            ...defaultState,
        })),
}));

export const showAppAlert = (config) => {
    useAppAlertStore.getState().showAlert(config);
};

export const hideAppAlert = () => {
    useAppAlertStore.getState().hideAlert();
};
