
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAaMzyc1WI0qc-6dgJHSwIW5OlRH7Je840",
  authDomain: "jobboard-mini.firebaseapp.com",
  projectId: "jobboard-mini",
  storageBucket: "jobboard-mini.firebasestorage.app",
  messagingSenderId: "441614413350",
  appId: "1:441614413350:web:5a8d18405938c777b200e7",
  measurementId: "G-TTKE7058MS",
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);

// Inisialisasi Firestore dan Authentication
export const db = getFirestore(app);
export const auth = getAuth(app);
