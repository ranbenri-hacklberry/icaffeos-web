
import { AuthProvider as FullAuthProvider, useAuth as useFullAuth, APP_VERSION as FULL_APP_VERSION } from './FullAuthContext.jsx';
import AuthContext from './AuthContextCore.jsx';
import { useStore } from '../core/store.js';

const isLite = import.meta.env.VITE_APP_MODE === 'lite';

export const APP_VERSION = FULL_APP_VERSION;

// Lite Implementation
const LiteAuthProvider = ({ children }) => <>{children}</>;

const useLiteAuth = () => {
    const { currentUser, login, logout } = useStore();

    return {
        currentUser,
        isAuthenticated: !!currentUser,
        deviceMode: 'lite', // Hardcoded for Lite env
        isLoading: false,
        syncStatus: { inProgress: false },
        login,
        logout,
        setMode: (mode) => console.log('Set mode mocked for lite:', mode),
        triggerSync: () => console.log("Lite sync triggered internally via store"),
        appVersion: FULL_APP_VERSION + '-LITE',
        switchBusinessContext: () => console.warn('Not supported in Lite'),
    };
};

export const AuthProvider = isLite ? LiteAuthProvider : FullAuthProvider;
export const useAuth = isLite ? useLiteAuth : useFullAuth;
export { AuthContext };

