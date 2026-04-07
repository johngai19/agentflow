import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  user: { username: string } | null; // Adjust user type as needed
  isLoading: boolean;
  error: string | null;
  setToken: (token: string | null) => void;
  setUser: (user: { username: string } | null) => void;
  login: (values: {username: string, password: string}) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isLoading: false,
      error: null,
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),
      login: async (values: { username: string; password: string }) => {
        set({ isLoading: true, error: null });
        try {
          // now calls your Next.js proxy in dev, and a same-origin endpoint in prod
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'Login failed');
          }
          set({ token: data.token, user: { username: values.username }, isLoading: false });
        } catch (error: unknown) {
          set({ error: error instanceof Error ? error.message : "Login failed", isLoading: false, token: null, user: null });
          throw error;
        }
      },
      logout: () => {
        set({ token: null, user: null, isLoading: false, error: null });
      },
      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);

export default useAuthStore;

