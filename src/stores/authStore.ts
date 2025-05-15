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
    (set, get) => ({
      token: null,
      user: null,
      isLoading: false,
      error: null,
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),
      login: async (values: {username: string, password: string}) => {
        set({ isLoading: true, error: null });
        try {
          // Use absolute URL for the backend API
          const response = await fetch('http://localhost:8080/api/v1/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(values),
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'Login failed');
          }
          set({ token: data.token, user: { username: values.username }, isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false, token: null, user: null });
          throw error; // Re-throw to be caught by the form handler
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

