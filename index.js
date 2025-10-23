import React from 'react';
import { registerRootComponent } from 'expo';

import App from './App';
import { ThemeProvider } from './src/context/ThemeContext';
import ThemeSystemBridge from './src/components/ThemeSystemBridge';

const RootApp = () => (
    <ThemeProvider>
        <>
            <App />
            <ThemeSystemBridge />
        </>
    </ThemeProvider>
);

registerRootComponent(RootApp);
