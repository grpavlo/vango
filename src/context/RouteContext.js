import React, { createContext, useContext, useState } from 'react';

const RouteContext = createContext({});

export const RouteProvider = ({ children }) => {
    const [lastUserLocation, setLastUserLocation] = useState(null);
    const [cachedRoute, setCachedRoute] = useState('');

    return (
        <RouteContext.Provider
            value={{
                lastUserLocation,
                setLastUserLocation,
                cachedRoute,
                setCachedRoute
            }}
        >
            {children}
        </RouteContext.Provider>
    );
};

export const useRouteContext = () => useContext(RouteContext);
