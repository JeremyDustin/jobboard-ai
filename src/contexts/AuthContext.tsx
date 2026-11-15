
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import type { ReactNode } from "react";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "../firebase";
import type { UserProfile } from "../types/user";

interface AuthContextType {
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeProfile?.();
      unsubscribeProfile = undefined;

      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      const userRef = doc(db, "users", user.uid);

      unsubscribeProfile = onSnapshot(
        userRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            setProfile(null);
            setLoading(false);
            return;
          }

          const data = snapshot.data();
          const role = data.role;

          if (
            role !== "admin" &&
            role !== "employer" &&
            role !== "jobSeeker"
          ) {
            setProfile(null);
            setLoading(false);
            return;
          }

          setProfile({
            uid: user.uid,
            name: data.name ?? "",
            email: user.email ?? "",
            role,
          });

          setLoading(false);
        },
        (error) => {
          console.error("Gagal mengambil profil:", error);
          setProfile(null);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile?.();
    };
  }, []);

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function register(
    name: string,
    email: string,
    password: string
  ) {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    try {
      await setDoc(doc(db, "users", credential.user.uid), {
        name,
        email,
        role: "jobSeeker",
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      await signOut(auth);
      throw error;
    }
  }

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{ profile, loading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth harus digunakan di dalam AuthProvider"
    );
  }

  return context;
}
