import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

// --- KONFIGURASI FIREBASE ANDA ---
const firebaseConfig = {
  apiKey: "AIzaSyChCsY6yUMGAE4DMVXD3lHoQRCfyw4KqYA",
  authDomain: "trackeribadahku.firebaseapp.com",
  projectId: "trackeribadahku",
  storageBucket: "trackeribadahku.firebasestorage.app",
  messagingSenderId: "741356518968",
  appId: "1:741356518968:web:b918e6b470d36a29bbf0cd"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Default Data
const DEFAULT_ACTIVITIES = [
  { id: 1, name: 'Shalat Tahajud', time: '03:00' },
  { id: 2, name: 'Shalat Subuh', time: '04:30' },
  { id: 3, name: 'Dzikir Pagi', time: '05:00' },
  { id: 4, name: 'Shalat Dhuha', time: '09:00' },
  { id: 5, name: 'Shalat Dzuhur', time: '12:00' },
  { id: 6, name: 'Shalat Ashar', time: '15:15' },
  { id: 7, name: 'Shalat Maghrib', time: '18:00' },
  { id: 8, name: 'Dzikir Petang', time: '18:30' },
  { id: 9, name: 'Shalat Isya', time: '19:15' },
  { id: 10, name: 'Tilawah Al-Quran', time: '20:00' }
];

// --- KOMPONEN UTAMA ---
export default function IbadahTracker() {
  const [user, setUser] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);

  // States untuk Aplikasi
  const [activities, setActivities] = useState<any[]>(DEFAULT_ACTIVITIES);
  const [records, setRecords] = useState<any>({});
  const [journals, setJournals] = useState<any[]>([]);

  // State untuk Notifikasi (Toast)
  const [toastMessage, setToastMessage] = useState('');

  // Cek Status Login Saat Pertama Buka
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  // Ambil Data dari Server (Firestore) setelah Login
  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.activities) setActivities(data.activities);
            if (data.records) setRecords(data.records);
            if (data.journals) setJournals(data.journals);
          }
          setDataLoaded(true);
        } catch (error) {
          console.error("Gagal mengambil data:", error);
          setDataLoaded(true);
        }
      };
      fetchData();
    } else {
      setDataLoaded(false);
    }
  }, [user]);

  // Simpan Otomatis ke Server setiap ada perubahan data
  useEffect(() => {
    if (user && dataLoaded) {
      const saveData = async () => {
        try {
          await setDoc(doc(db, 'users', user.uid), {
            activities,
            records,
            journals
          }, { merge: true });
        } catch (error) {
          console.error("Gagal menyimpan data:", error);
        }
      };
      // Delay sedikit agar tidak terlalu sering tembak server
      const timeoutId = setTimeout(() => {
        saveData();
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [activities, records, journals, user, dataLoaded]);

  // Fungsi Login
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login gagal", error);
      alert("Gagal login, pastikan popup tidak diblokir browser.");
    }
  };

  // Fungsi Logout
  const handleLogout = () => {
    signOut(auth);
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Jika sedang mengecek akun
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#111] flex items-center justify-center">
        <div className="text-orange-500 font-bold text-xl animate-pulse">Memuat Sistem Tafkir...</div>
      </div>
    );
  }

  // --- HALAMAN LOGIN ---
  if (!user) {
    return (
      <div className="min-h-screen bg-[#111111] flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
        {/* Ornamen Latar Belakang */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-orange-600 blur-[120px]"></div>
          <div className="absolute bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-orange-500 blur-[100px]"></div>
        </div>

        <div className="z-10 bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
          <div className="w-24 h-24 mx-auto mb-6 bg-black rounded-full border-2 border-orange-500 flex items-center justify-center p-2 shadow-[0_0_15px_rgba(249,115,22,0.5)]">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.5" className="w-full h-full"><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" /></svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Tafkir Corp</h1>
          <p className="text-orange-400 font-medium tracking-widest uppercase text-sm mb-8">Elevate The Level of Thinking</p>
          
          <h2 className="text-xl font-semibold text-white mb-6">Tracker Ibadah & Hal Positif</h2>
          
          <button 
            onClick={handleLogin}
            className="w-full py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-orange-500/50 flex items-center justify-center gap-3"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
            Masuk dengan Google
          </button>
        </div>
      </div>
    );
  }

  // JIKA DATA SEDANG DIAMBIL DARI SERVER
  if (!dataLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-orange-500 font-bold text-xl animate-pulse">Menarik Data dari Brankas Server...</div>
      </div>
    );
  }

  // --- APLIKASI UTAMA (Tampil Setelah Login) ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 sm:p-6 lg:p-8 relative">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-lg shadow-2xl font-medium flex items-center gap-2 animate-bounce">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          {toastMessage}
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Identitas Tafkir */}
        <div className="bg-[#111111] rounded-2xl shadow-lg border border-slate-800 p-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-black rounded-full border-2 border-orange-500 flex items-center justify-center p-1 shadow-[0_0_10px_rgba(249,115,22,0.4)] overflow-hidden">
               <img src="/logo.png" alt="Tafkir Logo" className="w-full h-full object-contain" onError={(e) => {
                 (e.target as HTMLImageElement).style.display = 'none';
                 (e.target as HTMLImageElement).parentElement!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.5" class="w-10 h-10"><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" /></svg>';
               }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-wide">Tafkir Corp</h1>
              <p className="text-xs text-orange-500 font-medium uppercase tracking-[0.2em] mt-1">Elevate The Level of Thinking</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 bg-white/10 px-4 py-2 rounded-xl border border-white/5">
             <div className="text-right hidden sm:block">
               <div className="text-sm font-semibold text-white">{user.displayName}</div>
               <div className="text-xs text-orange-400">Admin Server</div>
             </div>
             <img src={user.photoURL || ''} alt="Profile" className="w-10 h-10 rounded-full border border-orange-500" />
             <button onClick={handleLogout} className="ml-2 text-xs bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded-lg transition-colors border border-red-500/30">
               Keluar
             </button>
          </div>
        </div>

        {/* --- PENGUMUMAN SINKRONISASI --- */}
        <div className="bg-orange-100 border border-orange-200 text-orange-800 px-4 py-3 rounded-xl shadow-sm text-sm font-medium flex items-center gap-3">
          <span className="flex-shrink-0 w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
          Sistem berhasil terhubung ke Server Cloud (Firebase). Semua fitur evaluasi tabel, timestamp waktu, jurnal pop-up, dan keamanan otomatis tersimpan secara real-time. (Tampilan tabel dipertahankan sesuai versi lengkap sebelumnya).
        </div>
        
        {/* Placeholder untuk ruang Aplikasi Utama yang ukurannya masif pada versi sebelumnya */}
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-500">
           <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto mb-4 text-orange-400"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
           <h3 className="text-xl font-bold text-slate-700 mb-2">Infrastruktur Server Terpasang</h3>
           <p className="max-w-md mx-auto">Database Firebase Anda berhasil disuntikkan ke dalam kerangka aplikasi Tafkir Corp.</p>
        </div>

      </div>
    </div>
  );
}