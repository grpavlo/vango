//infoCheckpoint
// src/store.js
import {create} from 'zustand';

const useInfoCheckpoint = create((set) => ({
    data: {},
    setData: (reason) => set({ data: reason }),
}));

export {useInfoCheckpoint};
