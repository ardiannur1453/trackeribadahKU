// Import script Firebase secara langsung (Versi Compat untuk Service Worker)
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// [PENTING] Masukkan Konfigurasi Firebase Anda yang sama persis dengan yang ada di App.tsx
const firebaseConfig = {
  apiKey: "AIzaSyChCsY6yUMGAE4DMVXD3lHoQRCfyw4KqYA",
  authDomain: "trackeribadahku.firebaseapp.com",
  projectId: "trackeribadahku",
  storageBucket: "trackeribadahku.firebasestorage.app",
  messagingSenderId: "741356518968",
  appId: "1:741356518968:web:b918e6b470d36a29bbf0cd"
};

// Inisialisasi Firebase App di background
firebase.initializeApp(firebaseConfig);

// Inisialisasi Messaging di background
const messaging = firebase.messaging();

// Menangkap notifikasi jika aplikasi sedang tertutup / di background
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Menerima pesan background: ', payload);
  
  const notificationTitle = payload.notification.title || "Notifikasi Baru";
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png',
    badge: '/logo.png' // Icon kecil di status bar Android
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});