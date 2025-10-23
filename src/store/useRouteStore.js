// src/store.js
import {create} from 'zustand';

const useRouteStore = create((set) => ({
    routeChangeReason: null,
    setRouteChangeReason: (reason) => set({ routeChangeReason: reason }),
}));

export {useRouteStore};
