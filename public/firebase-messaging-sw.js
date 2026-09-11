// File: public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Konfigurasi Firebase Anda (Akan kita isi nanti)
const firebaseConfig = {
  apiKey: "API_KEY_ANDA",
  authDomain: "DOMAIN_ANDA",
  projectId: "PROJECT_ID_ANDA",
  storageBucket: "BUCKET_ANDA",
  messagingSenderId: "SENDER_ID_ANDA",
  appId: "APP_ID_ANDA"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Menerima pesan latar belakang ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/vite.svg' // Sesuaikan dengan ikon aplikasi Anda
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});