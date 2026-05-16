import { create } from "zustand";
import { authClient, clearToken } from "../lib/auth";

interface AuthStore {
  niches: string[];
  plan: string;
  setNiches: (n: string[]) => void;
  setPlan: (p: string) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  niches: [],
  plan: "free",
  setNiches: (niches) => set({ niches }),
  setPlan: (plan) => set({ plan }),
  signOut: async () => {
    await authClient.signOut();
    await clearToken();
  },
}));
