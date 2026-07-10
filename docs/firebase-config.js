// docs/firebase-config.js

// Importa las funciones que necesitas de los SDKs a través de CDN (Versión modular 9/10)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// TODO: Reemplaza este objeto con la configuración de tu propio proyecto de Firebase
// Para obtenerlo: Consola Firebase -> Configuración del proyecto -> Mis aplicaciones (Añadir Web App </>)
const firebaseConfig = {
  apiKey: "AIzaSyCSCEtAx_wU9Iz46B1vuQzZdOVELWlIfJQ",
  authDomain: "fitness-9f344.firebaseapp.com",
  projectId: "fitness-9f344",
  storageBucket: "fitness-9f344.firebasestorage.app",
  messagingSenderId: "982199662373",
  appId: "1:982199662373:web:ecfe2c9f4a91885a080ccc",
  measurementId: "G-31K75K8TRL"
};

// Inicializar Firebase
let app, auth, db, provider;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  provider = new GoogleAuthProvider();
  console.log("Firebase inicializado correctamente.");
} catch (error) {
  console.warn("Firebase no se pudo inicializar. Revisa firebase-config.js:", error);
}

export { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, doc, getDoc, setDoc };
