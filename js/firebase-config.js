// ============================================================
// CONFIGURAZIONE FIREBASE - Planning Operai Gama Service
// ============================================================
// Puoi riutilizzare il progetto Firebase "gama-service" esistente:
// Console Firebase > Impostazioni progetto > Le tue app > Config
// Incolla qui i valori del progetto.
// ============================================================

const firebaseConfig = {
  apiKey: "INSERISCI_API_KEY",
  authDomain: "gama-service.firebaseapp.com",
  projectId: "gama-service",
  storageBucket: "gama-service.appspot.com",
  messagingSenderId: "INSERISCI_SENDER_ID",
  appId: "INSERISCI_APP_ID"
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
