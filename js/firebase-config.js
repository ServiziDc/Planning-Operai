// ============================================================
// CONFIGURAZIONE FIREBASE - Planning Operai Gama Service
// Progetto: gama-service (stesso di Gestione Ore)
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCp7WCI9wWBH1hLNXdYA0LTvRmKYjVo53o",
  authDomain: "gama-service.firebaseapp.com",
  projectId: "gama-service",
  storageBucket: "gama-service.firebasestorage.app",
  messagingSenderId: "440236038955",
  appId: "1:440236038955:web:24eaa8dca617b54b1b836e"
};

// Email con permessi di ADMIN (possono modificare il planning).
// Tutti gli altri utenti autenticati vedono in sola lettura.
const ADMIN_EMAILS = [
  "simox91.st@gmail.com",
  "simone.terragni@gama-service.com",
  "amministrazione@gama-service.com"
];

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
