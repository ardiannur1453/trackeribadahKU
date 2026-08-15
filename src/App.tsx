import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import html2canvas from 'html2canvas';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Trash2, Edit3, Eye, Download, LogOut, Check, X, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle, BarChart2, Save, Zap, Plus, Award, AlertOctagon, Search, Shield, Medal, Users } from 'lucide-react';

// --- KONFIGURASI FIREBASE ---
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

// --- HELPER ZONA WAKTU LOKAL ---
const getLocalDateStr = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DEFAULT_ACTIVITIES = [
  { id: 1, name: 'Shalat Tahajud Berjamaah', time: '03:00' },
  { id: 2, name: 'Shalat Subuh Berjamaah', time: '04:30' },
  { id: 3, name: 'Dzikir Pagi', time: '05:00' },
  { id: 4, name: 'Shalat Dhuha Berjamaah', time: '09:00' },
  { id: 5, name: 'Shalat Dzuhur Berjamaah', time: '12:00' },
  { id: 6, name: 'Shalat Ashar Berjamaah', time: '15:15' },
  { id: 7, name: 'Shalat Maghrib Berjamaah', time: '18:00' },
  { id: 10, name: 'Tilawah Al-Quran', time: '18:15' }, 
  { id: 8, name: 'Dzikir Petang', time: '18:30' },
  { id: 9, name: 'Shalat Isya Berjamaah', time: '19:15' }
];

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export default function IbadahTracker() {
  const [user, setUser] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'loading' | 'success'>('loading');
  const [isFastLoaded, setIsFastLoaded] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activities, setActivities] = useState(DEFAULT_ACTIVITIES);
  const [records, setRecords] = useState<any>({});
  const [journals, setJournals] = useState<any[]>([]);
  
  const [journalSearch, setJournalSearch] = useState('');
  const [journalSort, setJournalSort] = useState<'newest' | 'oldest' | 'az' | 'za'>('newest');
  
  const [toast, setToast] = useState('');
  const [activeJournal, setActiveJournal] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [journalInput, setJournalInput] = useState({ title: '', content: '' });
  
  const [actModal, setActModal] = useState({ show: false, mode: 'add', id: null as number | null, name: '', time: '00:00' });
  
  const chartRef = useRef<HTMLDivElement>(null);

  // --- STATE SUPER ADMIN & KOMUNITAS ---
  const isAdmin = user?.email === 'coachardi1453@gmail.com';
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [adminCommunityInputs, setAdminCommunityInputs] = useState<Record<string, string>>({});
  
  const [myCommunity, setMyCommunity] = useState<string | null>(null);
  const [communityUsers, setCommunityUsers] = useState<any[]>([]);

  // TAHAP 1: OTOMATISASI PENDAFTARAN IDENTITAS SAAT BUKA APLIKASI
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsInitializing(false);
      
      if (currentUser) {
         try {
            // Memaksa pengiriman Nama dan Email ke database setiap kali aplikasi dibuka
            await setDoc(doc(db, 'users', currentUser.uid), {
               displayName: currentUser.displayName,
               email: currentUser.email
            }, { merge: true });
         } catch (e) {
            console.error("Gagal sinkronisasi profil:", e);
         }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = ''; 
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (hasUnsavedChanges && user) {
      const timer = setTimeout(() => {
         saveToServer(true);
      }, 7 * 60 * 1000); 
      return () => clearTimeout(timer);
    }
  }, [hasUnsavedChanges, records, journals, activities]);

  // Data Fetching Pribadi
  useEffect(() => {
    if (user) {
      const cacheKey = `tafkir_cache_${user.uid}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      setShowSyncModal(true);
      setSyncStatus('loading');

      if (cachedData) {
         try {
            const parsed = JSON.parse(cachedData);
            if (parsed.activities) setActivities(parsed.activities);
            if (parsed.records) setRecords(parsed.records);
            if (parsed.journals) setJournals(parsed.journals);
            setIsFastLoaded(true); 
         } catch (e) {
            console.error("Gagal membaca cache:", e);
         }
      }

      setIsSyncing(true);
      const userRef = doc(db, 'users', user.uid);
      const unsubscribe = onSnapshot(userRef, (docSnap) => {
         if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.activities) setActivities(data.activities);
            if (data.records) setRecords(data.records);
            if (data.journals) setJournals(data.journals);
            if (data.community) setMyCommunity(data.community); 
            localStorage.setItem(cacheKey, JSON.stringify(data));
         } else {
            setDoc(userRef, { activities: DEFAULT_ACTIVITIES }, { merge: true });
         }
         setIsSyncing(false);
         if (syncStatus === 'loading') {
            setTimeout(() => setSyncStatus('success'), 600);
         }
      }, (error) => {
         console.error("Firestore Error:", error);
         showToast("Koneksi Firebase terputus.");
         setIsSyncing(false);
         setSyncStatus('success');
      });

      return () => unsubscribe();
    }
  }, [user]);

  // Data Fetching ADMIN (Menarik semua user)
  useEffect(() => {
    if (isAdmin) {
      const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
         const usersData: any[] = [];
         const inputs: Record<string, string> = {};
         snapshot.forEach(d => {
            const data = d.data();
            usersData.push({ id: d.id, ...data });
            inputs[d.id] = data.community || '';
         });
         setAllUsers(usersData);
         setAdminCommunityInputs(inputs);
      });
      return () => unsub();
    }
  }, [isAdmin]);

  // Data Fetching KOMUNITAS (Menarik data klasemen)
  useEffect(() => {
    if (myCommunity) {
      const q = query(collection(db, 'users'), where('community', '==', myCommunity));
      const unsub = onSnapshot(q, (snapshot) => {
         const usersData: any[] = [];
         snapshot.forEach(d => usersData.push({ id: d.id, ...d.data() }));
         setCommunityUsers(usersData);
      });
      return () => unsub();
    }
  }, [myCommunity]);

  // Fungsi Admin Mengubah Komunitas
  const handleUpdateCommunity = async (targetUid: string) => {
     const newComm = adminCommunityInputs[targetUid].trim();
     try {
        await setDoc(doc(db, 'users', targetUid), { community: newComm }, { merge: true });
        showToast("Komunitas berhasil diperbarui!");
     } catch (e) {
        showToast("Gagal memperbarui komunitas. Cek koneksi.");
     }
  };

  const handleLogout = () => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm("PERINGATAN: Ada perubahan yang belum disimpan ke server! \n\nData Anda mungkin hilang jika pindah perangkat. Yakin ingin keluar sekarang?");
      if (!confirmLeave) return; 
    }
    signOut(auth);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));
  }, [currentDate]);

  const saveActivity = () => {
     if (!actModal.name.trim()) return showToast("Nama aktivitas tidak boleh kosong!");
     let newActs = [...activities];

     if (actModal.mode === 'add') {
        newActs.push({ id: Date.now(), name: actModal.name, time: actModal.time });
     } else {
        newActs = newActs.map(a => a.id === actModal.id ? { ...a, name: actModal.name, time: actModal.time } : a);
     }
     newActs.sort((a, b) => a.time.localeCompare(b.time));

     setActivities(newActs);
     setHasUnsavedChanges(true);
     setActModal({ show: false, mode: 'add', id: null, name: '', time: '00:00' });
     showToast(`Aktivitas berhasil ${actModal.mode === 'add' ? 'ditambahkan' : 'diperbarui'}. Klik Simpan Perubahan.`);
  };

  const deleteActivity = (id: number) => {
     if (window.confirm("Yakin ingin menghapus aktivitas ini dari tabel?")) {
        setActivities(activities.filter(a => a.id !== id));
        setHasUnsavedChanges(true);
        showToast("Aktivitas dihapus sementara. Klik Simpan Perubahan ke Server.");
     }
  };

  const getDailyEvaluation = (actId: number) => {
    const today = new Date();
    let isCurrentMonth = currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
    let isPastMonth = currentDate.getFullYear() < today.getFullYear() || (currentDate.getFullYear() === today.getFullYear() && currentDate.getMonth() < today.getMonth());

    if (!isCurrentMonth && !isPastMonth) return true; 

    const activity = activities.find(a => a.id === actId);
    if (!activity) return true;
    const [h, m] = activity.time.split(':').map(Number);

    let expected = 0;
    let doneCount = 0;

    daysInMonth.forEach(d => {
       const targetTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
       if (today.getTime() >= targetTime.getTime()) {
          expected++;
          const key = `${getLocalDateStr(d)}-${actId}`;
          if (records[key]?.status === 'done') doneCount++;
       }
    });

    if (expected === 0) return true; 
    const percentage = doneCount / expected;
    return percentage >= 0.5; 
  };

  const getDailyPercentage = (day: Date) => {
     const today = new Date();
     const dateStr = getLocalDateStr(day);
     let expected = 0;
     let done = 0;

     activities.forEach(a => {
        const [h, m] = a.time.split(':').map(Number);
        const targetTime = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
        if (today.getTime() >= targetTime.getTime()) {
           expected++;
           if (records[`${dateStr}-${a.id}`]?.status === 'done') done++;
        }
     });

     if (expected === 0) return "-";
     return `${Math.round((done / expected) * 100)}%`;
  };

  const handleRecord = (day: Date, actId: number, actTime: string, currentStatus: string | undefined) => {
    const now = new Date();
    const [hours, minutes] = actTime.split(':').map(Number);
    const targetTime = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
    
    const todayStr = getLocalDateStr(now);
    const clickDayStr = getLocalDateStr(day);

    if (day > now && clickDayStr !== todayStr) {
        showToast("Belum waktunya! Tidak bisa mengisi aktivitas untuk hari esok.");
        return;
    }

    if (clickDayStr === todayStr) {
        const unlockTime = new Date(targetTime.getTime() + 60000); 
        if (now < unlockTime) {
            showToast(`Belum waktunya! Laporan dibuka pukul ${unlockTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
            return;
        }
    }

    const key = `${clickDayStr}-${actId}`;
    let newStatus = 'done';
    if (currentStatus === 'done') newStatus = 'missed';
    if (currentStatus === 'missed') newStatus = 'none';

    let newRecs = { ...records };
    if (newStatus === 'none') {
      delete newRecs[key];
    } else {
      newRecs[key] = {
        status: newStatus,
        timestamp: now.getTime(),
        actualDay: todayStr
      };
    }
    setRecords(newRecs);
    setHasUnsavedChanges(true); 
  };

  const calcStats = () => {
    const actData: Record<number, { done: number, missed: number, onTime: number, late: number }> = {};
    activities.forEach(a => actData[a.id] = { done: 0, missed: 0, onTime: 0, late: 0 });

    const weeklyStats = [
      { done: 0, expected: 0 }, { done: 0, expected: 0 }, 
      { done: 0, expected: 0 }, { done: 0, expected: 0 }, { done: 0, expected: 0 }
    ];

    let totalDone = 0;
    let totalMissed = 0;

    Object.entries(records).forEach(([key, val]: [string, any]) => {
      const [yStr, mStr, dStr, actIdStr] = key.split('-');
      const y = parseInt(yStr);
      const m = parseInt(mStr);
      const d = parseInt(dStr);
      const actId = parseInt(actIdStr);
      const recDate = new Date(y, m - 1, d);

      if (recDate.getMonth() === currentDate.getMonth() && recDate.getFullYear() === currentDate.getFullYear()) {
         if (val.status === 'done') {
            totalDone++;
            if(actData[actId]) actData[actId].done++;
            
            const activity = activities.find(a => a.id === actId);
            if (activity) {
               const recordDateStr = `${yStr}-${mStr}-${dStr}`;
               if (val.actualDay === recordDateStr) {
                  const [h, min] = activity.time.split(':').map(Number);
                  const targetTime = new Date(y, m - 1, d, h, min).getTime();
                  const timeDiffMins = (val.timestamp - targetTime) / 60000;
                  
                  if (timeDiffMins <= 30) { actData[actId].onTime++; } 
                  else { actData[actId].late++; }
               } else { actData[actId].late++; }
            }
         }
         if (val.status === 'missed') {
            totalMissed++;
            if(actData[actId]) actData[actId].missed++;
         }
      }
    });

    const today = new Date();
    daysInMonth.forEach(d => {
       const weekIdx = Math.floor((d.getDate() - 1) / 7);
       const dateStr = getLocalDateStr(d);
       activities.forEach(a => {
          const [h, m] = a.time.split(':').map(Number);
          const targetTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
          if (today.getTime() >= targetTime.getTime()) { weeklyStats[weekIdx].expected++; }
          if (records[`${dateStr}-${a.id}`]?.status === 'done') { weeklyStats[weekIdx].done++; }
       });
    });

    const totalFilled = totalDone + totalMissed;
    const donePercent = totalFilled ? Math.round((totalDone / totalFilled) * 100) : 0;

    let sortedFreq = activities.map(a => ({ name: a.name, ...actData[a.id] })).filter(a => (a.done + a.missed) > 0);
    let top3Freq = [...sortedFreq].sort((a,b) => b.done - a.done).slice(0, 3);
    let top3Missed = [...sortedFreq].sort((a,b) => b.missed - a.missed).slice(0, 3);

    let sortedDiscip = activities.map(a => {
       const stat = actData[a.id];
       return { 
           name: a.name, done: stat.done,
           onTimePct: stat.done > 0 ? (stat.onTime / stat.done) * 100 : 0, 
           latePct: stat.done > 0 ? (stat.late / stat.done) * 100 : 0 
       };
    }).filter(a => a.done > 0);
    
    let top3OnTime = [...sortedDiscip].sort((a,b) => b.onTimePct - a.onTimePct).slice(0, 3);
    let top3Late = [...sortedDiscip].sort((a,b) => b.latePct - a.latePct).slice(0, 3);

    return { totalDone, totalMissed, donePercent, weeklyStats, top3Freq, top3Missed, top3OnTime, top3Late };
  };

  const stats = calcStats();

  const saveToServer = async (isAutoSave = false) => {
    if (!user) return;
    setIsSaving(true);
    
    const monthKey = `${String(currentDate.getMonth() + 1).padStart(2, '0')}-${currentDate.getFullYear()}`;
    const payload = { 
       activities, 
       records, 
       journals,
       displayName: user.displayName,
       email: user.email,
       [`score_${monthKey}`]: stats.donePercent 
    };
    
    localStorage.setItem(`tafkir_cache_${user.uid}`, JSON.stringify(payload));
    setHasUnsavedChanges(false); 
    
    try {
      await setDoc(doc(db, 'users', user.uid), payload, { merge: true });
      if(isAutoSave) { showToast("Sistem: Data diamankan secara otomatis (Auto-Save 7 Menit)."); } 
      else { showToast("Data berhasil diamankan ke Server!"); }
    } catch (error: any) {
      console.error("GAGAL SIMPAN FIREBASE:", error);
      setHasUnsavedChanges(true); 
      if (error.code === 'permission-denied') { showToast("ERROR: Pintu Database Firebase Terkunci (Rules)!"); } 
      else { showToast("Gagal menyambung ke server. Data aman di perangkat ini."); }
    } finally {
      setIsSaving(false);
    }
  };

  const saveJournal = () => {
    if (!journalInput.title) return showToast("Judul jurnal tidak boleh kosong");
    const newJ = {
      id: activeJournal ? activeJournal.id : Date.now(),
      title: journalInput.title,
      content: journalInput.content,
      date: new Date().toISOString() 
    };
    if (activeJournal) { setJournals(journals.map(j => j.id === activeJournal.id ? newJ : j)); } 
    else { setJournals([newJ, ...journals]); }
    
    setJournalInput({ title: '', content: '' });
    setActiveJournal(null);
    setHasUnsavedChanges(true);
    showToast("Jurnal telah disematkan. Klik Simpan Perubahan!");
  };

  const filteredAndSortedJournals = useMemo(() => {
     let result = journals.filter(j => 
        j.title.toLowerCase().includes(journalSearch.toLowerCase()) || 
        j.content.toLowerCase().includes(journalSearch.toLowerCase())
     );
     return result.sort((a, b) => {
        if (journalSort === 'newest') return new Date(b.date).getTime() - new Date(a.date).getTime();
        if (journalSort === 'oldest') return new Date(a.date).getTime() - new Date(b.date).getTime();
        if (journalSort === 'az') return a.title.localeCompare(b.title);
        if (journalSort === 'za') return b.title.localeCompare(a.title);
        return 0;
     });
  }, [journals, journalSearch, journalSort]);

  const exportChart = async () => {
    if (chartRef.current) {
      const canvas = await html2canvas(chartRef.current, { backgroundColor: '#ffffff', scale: 2 });
      const link = document.createElement('a');
      const firstName = user.displayName?.split(' ')[0] || 'User';
      const yearStr = currentDate.getFullYear().toString().slice(-2);
      link.download = `${firstName}-Tafkir-Stats-${MONTH_NAMES[currentDate.getMonth()]}-${yearStr}-Ibadahku.jpg`;
      link.href = canvas.toDataURL('image/jpeg');
      link.click();
    }
  };

  const chartData = useMemo(() => {
    const rawData = daysInMonth.map((d, i) => {
      const dateStr = getLocalDateStr(d);
      let doneCount = 0;
      activities.forEach(a => { if (records[`${dateStr}-${a.id}`]?.status === 'done') doneCount++; });
      const pct = activities.length ? Math.round((doneCount / activities.length) * 100) : 0;
      return { x: i + 1, tanggal: d.getDate().toString(), persentase: pct };
    });

    const n = rawData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    rawData.forEach(d => { sumX += d.x; sumY += d.persentase; sumXY += d.x * d.persentase; sumX2 += d.x * d.x; });

    const denominator = (n * sumX2 - sumX * sumX);
    const m = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
    const b = (sumY - m * sumX) / n;

    return rawData.map(d => ({ ...d, trend: Math.max(0, Math.min(100, Math.round(m * d.x + b))) }));
  }, [daysInMonth, records, activities]);

  // Klasemen Real-Time Berdasarkan Komunitas
  const leaderboardData = useMemo(() => {
     if (!myCommunity || communityUsers.length === 0) return [];
     const monthKey = `${String(currentDate.getMonth() + 1).padStart(2, '0')}-${currentDate.getFullYear()}`;
     
     return communityUsers
        .map(u => ({
           name: u.displayName || 'Anonim',
           score: u[`score_${monthKey}`] || 0
        }))
        .filter(u => u.score > 0) 
        .sort((a,b) => b.score - a.score)
        .slice(0, 5); 
  }, [communityUsers, currentDate, myCommunity]);


  if (isInitializing) return (
     <div className="fixed inset-0 w-full h-full bg-slate-50 flex items-center justify-center text-orange-500 font-bold z-50">
        Memuat Sistem Tafkir...
     </div>
  );

  if (!user) {
    return (
      <div className="fixed inset-0 w-full h-full overflow-y-auto bg-[#111111] flex flex-col items-center justify-center p-4 z-50">
        <div className="bg-white/5 border border-orange-500/30 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center relative overflow-hidden m-auto">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="w-24 h-24 mx-auto mb-6 bg-white rounded-full border-4 border-orange-500 flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.4)]">
             <img src="/logo.png" alt="Logo Tafkir Corp" className="w-[75%] h-[75%] object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Tracker IbadahKU</h1>
          <p className="text-orange-500 text-xs tracking-widest uppercase mb-8">by TafkirCorp</p>
          <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-orange-500/30">
            Masuk dengan Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full overflow-y-auto bg-slate-50 text-slate-800 font-sans">
      <div className="min-h-full p-4 md:p-8 relative">
        
        {/* PANEL SUPER ADMIN (Modal) */}
        {showAdminPanel && isAdmin && (
           <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
              <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-4xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
                 <button onClick={() => setShowAdminPanel(false)} className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full"><X size={20}/></button>
                 <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-3"><Shield className="text-blue-500"/> Super Admin Dashboard</h2>
                 <p className="text-sm text-slate-500 mb-8 border-b border-slate-100 pb-4">Kelola akses dan pengelompokan komunitas untuk Gamifikasi (Fastabiqul Khairat).</p>
                 
                 <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                       <thead className="bg-slate-50 text-slate-600">
                          <tr>
                             <th className="p-4 font-bold rounded-tl-xl">Nama Pengguna</th>
                             <th className="p-4 font-bold">Email Google</th>
                             <th className="p-4 font-bold">Nama Komunitas</th>
                             <th className="p-4 font-bold text-center rounded-tr-xl">Aksi</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {allUsers.map((u) => (
                             <tr key={u.id} className="hover:bg-slate-50/50">
                                <td className="p-4 font-bold text-slate-800">{u.displayName || 'Anonim'}</td>
                                <td className="p-4 text-slate-500">{u.email || '-'}</td>
                                <td className="p-4">
                                   <input 
                                      type="text" 
                                      placeholder="Kosong"
                                      value={adminCommunityInputs[u.id] || ''} 
                                      onChange={(e) => setAdminCommunityInputs({...adminCommunityInputs, [u.id]: e.target.value})}
                                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
                                   />
                                </td>
                                <td className="p-4 text-center">
                                   <button 
                                      onClick={() => handleUpdateCommunity(u.id)}
                                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors shadow-sm"
                                   >Simpan</button>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>
        )}

        {hasUnsavedChanges && (
           <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] w-full px-4 sm:w-auto sm:px-0 pointer-events-none">
              <button 
                  onClick={() => saveToServer(false)}
                  disabled={isSaving}
                  className="w-full pointer-events-auto sm:w-auto bg-orange-600 text-white px-8 py-3.5 rounded-full font-bold flex items-center justify-center gap-3 shadow-[0_8px_30px_rgba(249,115,22,0.5)] hover:bg-orange-700 hover:-translate-y-1 transition-all animate-bounce"
               >
                  {isSaving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                  {isSaving ? 'Menyimpan ke Cloud...' : 'Simpan Perubahan Anda'}
               </button>
           </div>
        )}

        {showSyncModal && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
             <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl relative text-center">
                {syncStatus === 'loading' ? (
                   <>
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                         <RefreshCw size={32} className="text-blue-600 animate-spin" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 mb-2">Mengunduh Data...</h3>
                      <p className="text-slate-600 text-sm">Mohon tunggu sebentar, sistem sedang menarik data Anda dari server dan menyiapkan sistem lokal.</p>
                   </>
                ) : (
                   <>
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                         <Check size={32} className="text-green-600" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 mb-2">Sinkronisasi Berhasil</h3>
                      <p className="text-slate-600 text-sm mb-6">Data selesai didownload. Aplikasi siap digunakan.</p>
                      <button onClick={() => setShowSyncModal(false)} className="px-5 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors w-full shadow-lg shadow-orange-500/30">
                         Oke
                      </button>
                   </>
                )}
             </div>
          </div>
        )}

        {actModal.show && (
           <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
              <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
                 <button onClick={() => setActModal({...actModal, show: false})} className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                 <h2 className="text-xl font-bold text-slate-800 mb-4">{actModal.mode === 'add' ? 'Tambah Aktivitas Baru' : 'Edit Aktivitas'}</h2>
                 
                 <div className="space-y-4 mb-6">
                    <div>
                       <label className="block text-sm font-bold text-slate-600 mb-1">Nama Aktivitas</label>
                       <input type="text" value={actModal.name} onChange={e => setActModal({...actModal, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-orange-200 outline-none" placeholder="Contoh: Shalat Dhuha" />
                    </div>
                    <div>
                       <label className="block text-sm font-bold text-slate-600 mb-1">Jam Pelaksanaan</label>
                       <input type="time" value={actModal.time} onChange={e => setActModal({...actModal, time: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-orange-200 outline-none" />
                    </div>
                 </div>
                 
                 <button onClick={saveActivity} className="w-full bg-orange-600 text-white font-bold py-3 rounded-xl hover:bg-orange-700 transition-all shadow-md">Simpan Pengaturan</button>
              </div>
           </div>
        )}

        {isViewModalOpen && activeJournal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-8 w-full max-w-2xl shadow-2xl relative">
              <button onClick={() => setIsViewModalOpen(false)} className="absolute top-6 right-6 p-2 bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
              <h2 className="text-2xl font-bold text-slate-800 mb-2 pr-10">{activeJournal.title}</h2>
              <p className="text-sm text-orange-600 font-medium mb-6">{new Date(activeJournal.date).toLocaleString('id-ID', {weekday: 'long', day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit'})}</p>
              <div className="whitespace-pre-wrap text-slate-700 leading-relaxed bg-slate-50 p-6 rounded-2xl border border-slate-100 max-h-[60vh] overflow-y-auto">{activeJournal.content}</div>
            </div>
          </div>
        )}

        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[90] bg-slate-900 text-white px-6 py-3 rounded-lg shadow-2xl font-medium flex items-center gap-2 border-l-4 border-orange-500 animate-bounce">
            <AlertCircle size={20} className="text-orange-500" /> {toast}
          </div>
        )}

        <div className="max-w-7xl mx-auto space-y-8 pb-16">
          
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 flex flex-row justify-between items-center gap-4 relative overflow-hidden">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full border-2 border-orange-500 flex items-center justify-center shadow-md shrink-0">
                 <img src="/logo.png" alt="Logo Tafkir Corp" className="w-[70%] h-[70%] object-contain" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-wide">Tafkir Corp</h1>
                <p className="text-[9px] sm:text-xs text-orange-600 font-bold uppercase tracking-[0.1em] sm:tracking-[0.2em] mt-0.5 sm:mt-1">Tracker Ibadah & Hal Positif</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
               <div className="text-right flex flex-col justify-center">
                 <div className="text-sm font-semibold text-slate-800 max-w-[80px] sm:max-w-none truncate">{user.displayName?.split(' ')[0]}</div>
                 <div className="text-[10px] font-medium flex items-center gap-1 justify-end">
                    {isSyncing ? (
                       <span className="text-blue-500 flex items-center gap-1"><RefreshCw size={10} className="animate-spin"/> Synchronizing...</span>
                    ) : (
                       <span className="text-green-600 flex items-center gap-1"><Zap size={10}/> Synchronized</span>
                    )}
                 </div>
               </div>
               
               {/* TOMBOL SUPER ADMIN */}
               {isAdmin && (
                  <button onClick={() => setShowAdminPanel(true)} className="ml-1 bg-blue-100 text-blue-600 hover:bg-blue-200 p-2 rounded-lg transition-colors" title="Super Admin Dashboard">
                     <Shield size={16}/>
                  </button>
               )}
               
               <button onClick={handleLogout} className="ml-1 bg-red-100 text-red-600 hover:bg-red-200 p-2 sm:px-3 sm:py-1.5 rounded-lg transition-colors text-sm font-medium flex items-center gap-1">
                 <LogOut size={16}/> <span className="hidden sm:block">Keluar</span>
               </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden relative">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col items-center gap-4">
               <div className="w-full flex justify-center mb-1">
                  <div className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-sm border ${stats.donePercent >= 50 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                     Total Progress Bulan Ini: {stats.donePercent}%
                  </div>
               </div>

               <div className="flex flex-col md:flex-row justify-between w-full gap-4 items-center">
                  <div className="flex items-center justify-between w-full md:w-auto gap-4">
                     <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-orange-500"></span> Tabel Hisab Pribadi
                     </h2>
                     <button onClick={() => setActModal({ show: true, mode: 'add', id: null, name: '', time: '00:00' })} className="flex items-center gap-1 bg-white border border-orange-200 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold text-orange-600 hover:bg-orange-50 transition-colors shadow-sm whitespace-nowrap">
                        <Plus size={16}/> <span className="hidden sm:block">Tambah Ibadah/Aktivitas Positif KU</span><span className="sm:hidden">Tambah</span>
                     </button>
                  </div>
                  
                  <div className="flex items-center gap-4 bg-white border border-slate-200 px-2 py-1 rounded-lg shadow-sm">
                     <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ChevronLeft size={20}/></button>
                     <div className="w-40 text-center font-bold text-slate-700">
                        {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
                     </div>
                     <button onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ChevronRight size={20}/></button>
                  </div>
               </div>
            </div>
            
            <div className="overflow-x-auto pb-4">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="text-left text-slate-700 font-bold p-3 sm:p-4 sticky left-0 bg-slate-100 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[140px] sm:min-w-[240px] max-w-[160px] sm:max-w-none">
                       Ibadah & Aktivitas Positif KU
                    </th>
                    {daysInMonth.map(d => {
                      const isActuallyToday = getLocalDateStr(d) === getLocalDateStr(new Date());
                      return (
                         <th key={d.toISOString()} className={`p-3 text-center font-semibold min-w-[40px] transition-colors ${isActuallyToday ? 'bg-orange-100 text-orange-700 border-b-2 border-orange-500' : 'text-slate-600'}`}>
                            {isActuallyToday ? (
                               <div className="flex flex-col items-center">
                                  <span className="text-[9px] uppercase tracking-widest mb-0.5 font-black">Hari Ini</span>
                                  <span className="text-base">{d.getDate()}</span>
                               </div>
                            ) : d.getDate()}
                         </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {activities.map((act, idx) => {
                    const isSafe = getDailyEvaluation(act.id);
                    return (
                    <tr key={act.id} className={idx % 2 === 0 ? 'bg-white hover:bg-orange-50/50' : 'bg-slate-50 hover:bg-orange-50/50'}>
                      
                      <td className="p-2 sm:p-3 font-medium sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-slate-100 whitespace-normal sm:whitespace-nowrap" style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                           <div className="flex sm:flex-col gap-1 shrink-0">
                              <button onClick={() => setActModal({ show: true, mode: 'edit', id: act.id, name: act.name, time: act.time })} className="p-1 bg-slate-100 border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 rounded transition-colors" title="Edit Aktivitas"><Edit3 size={14}/></button>
                              <button onClick={() => deleteActivity(act.id)} className="p-1 bg-slate-100 border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 rounded transition-colors" title="Hapus Aktivitas"><Trash2 size={14}/></button>
                           </div>
                           <div className="flex flex-col items-start leading-tight min-w-0">
                              <div className="flex items-center gap-1 sm:gap-2 flex-wrap sm:flex-nowrap">
                                <span className={`text-xs sm:text-sm truncate sm:overflow-visible break-words ${!isSafe ? 'text-red-600 font-bold' : 'text-slate-800'}`}>{act.name}</span>
                                {!isSafe && (
                                   <div className="relative group/alert cursor-help">
                                      <AlertTriangle size={14} className="text-red-500 shrink-0" />
                                      <div className="absolute hidden group-hover/alert:block bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900 text-white text-[10px] sm:text-xs text-center p-2 rounded shadow-xl z-50 pointer-events-none leading-relaxed">
                                         Pelaksanaan di bawah 50% dari target hari yang telah berlalu
                                         <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                                      </div>
                                   </div>
                                )}
                              </div>
                              <span className="text-[9px] sm:text-[10px] text-orange-600 font-bold bg-orange-100 px-1.5 py-0.5 rounded mt-1 shrink-0">{act.time}</span>
                           </div>
                        </div>
                      </td>

                      {daysInMonth.map(d => {
                        const isActuallyToday = getLocalDateStr(d) === getLocalDateStr(new Date());
                        const key = `${getLocalDateStr(d)}-${act.id}`;
                        const rec = records[key];
                        return (
                          <td key={key} className={`p-2 text-center relative group cursor-pointer border-r border-slate-100/50 ${isActuallyToday ? 'bg-orange-50/40' : ''}`} onClick={() => handleRecord(d, act.id, act.time, rec?.status)}>
                            {rec?.status === 'done' ? (
                               <div className="w-6 h-6 sm:w-7 sm:h-7 mx-auto bg-green-100 rounded flex items-center justify-center border border-green-200"><Check className="text-green-600" size={14} /></div>
                            ) : rec?.status === 'missed' ? (
                               <div className="w-6 h-6 sm:w-7 sm:h-7 mx-auto bg-red-100 rounded flex items-center justify-center border border-red-200"><X className="text-red-600" size={14} /></div>
                            ) : (
                               <div className="w-6 h-6 sm:w-7 sm:h-7 mx-auto rounded bg-slate-100 border border-slate-200 hover:border-orange-300 transition-colors" />
                            )}
                            
                            {rec && (
                              <div className="absolute hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-xs p-3 rounded-lg shadow-xl w-max z-30 pointer-events-none">
                                <p className="font-semibold border-b border-slate-700 pb-1 mb-1">{act.name} ({d.getDate()}/{d.getMonth()+1})</p>
                                <p className="text-slate-300">Waktu Isi: {new Date(rec.timestamp).toLocaleString('id-ID', {day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit'})}</p>
                                <p className="mt-1">
                                  Status: {(() => {
                                     const [h, m] = act.time.split(':').map(Number);
                                     const targetTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime();
                                     const diffMins = (rec.timestamp - targetTime) / 60000;
                                     const isOnTime = rec.actualDay === getLocalDateStr(d) && diffMins <= 30;
                                     
                                     return isOnTime ? (
                                        <span className="text-green-400 font-bold tracking-wide">TEPAT WAKTU</span>
                                     ) : (
                                        <span className="text-red-400 font-bold tracking-wide">RAPELAN</span>
                                     );
                                  })()}
                                </p>
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )})}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td className="p-3 sm:p-4 text-right font-bold text-slate-700 sticky left-0 z-20 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-xs sm:text-sm">
                       Ketercapaian Harian:
                    </td>
                    {daysInMonth.map(d => (
                       <td key={d.toISOString()} className="p-2 text-center font-bold text-slate-600 border-r border-slate-100/50 text-xs sm:text-sm">
                          {getDailyPercentage(d)}
                       </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* PANEL GAMIFIKASI GLOBAL (LEADERBOARD) */}
          {myCommunity && (
             <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-xl p-6 md:p-8 border border-slate-700 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-slate-700 pb-4">
                   <div>
                      <h2 className="text-2xl font-black text-white flex items-center gap-3">
                         <Medal className="text-yellow-400" size={28}/> Fastabiqul Khairat
                      </h2>
                      <p className="text-slate-400 text-sm mt-1 font-medium flex items-center gap-2"><Users size={16}/> Komunitas: <span className="text-yellow-400">{myCommunity}</span></p>
                   </div>
                   <div className="bg-slate-800/50 border border-slate-600 px-4 py-2 rounded-xl text-xs text-slate-300 font-bold uppercase tracking-widest">
                      Bulan {MONTH_NAMES[currentDate.getMonth()]}
                   </div>
                </div>

                <div className="relative z-10">
                   {leaderboardData.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 font-medium italic border-2 border-dashed border-slate-700 rounded-xl">
                         Belum ada anggota yang mensinkronkan data bulan ini.
                      </div>
                   ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {leaderboardData.map((user, idx) => (
                            <div key={idx} className={`flex items-center justify-between p-4 rounded-xl border transition-all hover:-translate-y-1 ${idx === 0 ? 'bg-gradient-to-r from-yellow-500/20 to-transparent border-yellow-500/30' : idx === 1 ? 'bg-gradient-to-r from-slate-300/10 to-transparent border-slate-400/20' : idx === 2 ? 'bg-gradient-to-r from-orange-600/20 to-transparent border-orange-500/20' : 'bg-white/5 border-white/10'}`}>
                               <div className="flex items-center gap-4">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg shadow-lg ${idx === 0 ? 'bg-yellow-400 text-yellow-900' : idx === 1 ? 'bg-slate-300 text-slate-800' : idx === 2 ? 'bg-orange-400 text-orange-900' : 'bg-slate-800 text-slate-400'}`}>
                                     {idx + 1}
                                  </div>
                                  <span className={`font-bold text-lg truncate max-w-[150px] sm:max-w-[200px] ${idx === 0 ? 'text-yellow-400' : 'text-slate-200'}`}>{user.name}</span>
                               </div>
                               <div className="text-right">
                                  <span className={`text-2xl font-black ${idx === 0 ? 'text-yellow-400' : 'text-white'}`}>{user.score}%</span>
                                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Progress</p>
                               </div>
                            </div>
                         ))}
                      </div>
                   )}
                </div>
             </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 border-b border-slate-100 pb-4">
                 <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                   <span className="w-3 h-3 rounded-full bg-orange-500 shrink-0"></span> Arsip Jurnal
                 </h3>
                 <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-32">
                       <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                       <input type="text" placeholder="Cari..." value={journalSearch} onChange={(e) => setJournalSearch(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-2 py-1.5 text-xs focus:ring-1 focus:ring-orange-500 outline-none" />
                    </div>
                    <select value={journalSort} onChange={(e: any) => setJournalSort(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-600 focus:ring-1 focus:ring-orange-500 outline-none cursor-pointer">
                       <option value="newest">Terbaru</option>
                       <option value="oldest">Terlama</option>
                       <option value="az">A - Z</option>
                       <option value="za">Z - A</option>
                    </select>
                 </div>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-2">
                {filteredAndSortedJournals.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">Tidak ada jurnal ditemukan.</p> : filteredAndSortedJournals.map(j => (
                  <div key={j.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-start group hover:border-orange-300 transition-colors">
                    <div className="truncate pr-2">
                      <p className="font-bold text-slate-700 truncate">{j.title}</p>
                      <p className="text-xs text-slate-500 mt-1">{new Date(j.date).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit'})}</p>
                    </div>
                    <div className="flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setActiveJournal(j); setIsViewModalOpen(true); }} className="p-1 hover:bg-slate-200 rounded text-blue-600"><Eye size={16} /></button>
                      <button onClick={() => { setActiveJournal(j); setJournalInput({title: j.title, content: j.content}); setIsViewModalOpen(false); }} className="p-1 hover:bg-slate-200 rounded text-orange-600"><Edit3 size={16} /></button>
                      <button onClick={() => { setJournals(journals.filter(x => x.id !== j.id)); setHasUnsavedChanges(true); }} className="p-1 hover:bg-slate-200 rounded text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-3 h-3 rounded-full bg-orange-500"></span> {activeJournal && !isViewModalOpen ? 'Edit Jurnal' : 'Tulis Jurnal Baru'}
              </h3>
              <input type="text" placeholder="Judul Jurnal / Catatan..." value={journalInput.title} onChange={e => setJournalInput({...journalInput, title: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-slate-800 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all font-medium" />
              <textarea placeholder="Tuliskan evaluasi, syukur, atau doa Anda hari ini..." value={journalInput.content} onChange={e => setJournalInput({...journalInput, content: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 h-40 text-slate-800 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all resize-none mb-4" />
              <div className="flex justify-end">
                 <button onClick={saveJournal} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl hover:bg-slate-900 font-bold shadow-md transition-all flex items-center gap-2"><Check size={18}/> Draf Jurnal (Lalu Simpan Perubahan)</button>
              </div>
            </div>
          </div>

          <div ref={chartRef} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 relative overflow-hidden">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
               <div>
                   <h2 className="text-xl font-bold text-slate-800 border-l-4 border-orange-500 pl-4">Analisa & Grafik Progres</h2>
                   <p className="text-sm text-slate-500 mt-2 pl-4 font-medium">Laporan Aktivitas: <span className="font-bold text-slate-700">{user.displayName}</span></p>
               </div>
               <button data-html2canvas-ignore="true" onClick={exportChart} className="flex items-center gap-2 bg-orange-50 hover:bg-orange-100 text-orange-600 px-4 py-2 rounded-xl text-sm font-bold border border-orange-200 transition-colors w-full sm:w-auto justify-center">
                 <Download size={16} /> Ekspor Laporan
               </button>
            </div>
            
            <div className="w-full h-72 mb-8 bg-slate-50 rounded-xl p-4 border border-slate-100">
               <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                     <defs>
                        <linearGradient id="colorOrange" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                           <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                     <XAxis dataKey="tanggal" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                     <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                     <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                        itemStyle={{ color: '#f97316' }}
                        formatter={(value, name) => [
                           name === 'trend' ? `${value}% (Trend)` : `${value}% Selesai`, 
                           name === 'trend' ? 'Trend Progress' : 'Aktual'
                        ]}
                        labelFormatter={(label) => `Tanggal ${label}`}
                     />
                     <Area type="monotone" dataKey="persentase" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorOrange)" />
                     <Line type="linear" dataKey="trend" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} />
                  </ComposedChart>
               </ResponsiveContainer>
               <p className="text-center text-xs text-slate-400 mt-2 flex justify-center gap-4">
                  <span className="flex items-center gap-1"><span className="w-3 h-1 bg-orange-500 rounded"></span> Aktual Harian</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 rounded border border-dashed"></span> Trend Progress</span>
               </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               
               <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                  <h3 className="text-slate-700 font-bold mb-6 text-center flex items-center justify-center gap-2">
                     <BarChart2 size={18} className="text-blue-500"/> Progress Mingguan
                  </h3>
                  <div className="space-y-4">
                     {stats.weeklyStats.map((w, idx) => {
                        if (w.expected === 0) return null;
                        const pct = Math.round((w.done / w.expected) * 100);
                        const startDay = idx * 7 + 1;
                        const endDay = Math.min((idx + 1) * 7, daysInMonth.length);
                        return (
                           <div key={idx}>
                              <div className="flex justify-between text-sm font-semibold mb-1 text-slate-600">
                                 <span>Pekan {idx + 1} <span className="text-xs font-normal text-slate-400">(Tgl {startDay}-{endDay})</span></span>
                                 <span className={pct >= 50 ? 'text-blue-600' : 'text-orange-500'}>{pct}%</span>
                              </div>
                              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                 <div className={`h-full rounded-full transition-all duration-1000 ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-orange-500'}`} style={{ width: `${pct}%` }}></div>
                              </div>
                           </div>
                        );
                     })}
                     {stats.weeklyStats.every(w => w.expected === 0) && (
                        <p className="text-xs text-slate-400 text-center py-4">Belum ada data pekan ini.</p>
                     )}
                  </div>
               </div>

               <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 flex flex-col justify-between">
                  <div>
                     <h3 className="text-slate-700 font-bold mb-6 text-center">Kuantitas Bulanan</h3>
                     <div className="space-y-4 mb-6">
                        <div>
                          <div className="flex justify-between text-sm font-bold mb-1 text-slate-700">
                             <span>Total Selesai ({stats.totalDone}x)</span>
                             <span className="text-green-600">{stats.donePercent}%</span>
                          </div>
                          <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                             <div className="h-full bg-green-500 rounded-full" style={{ width: `${stats.donePercent}%` }}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm font-bold mb-1 text-slate-700">
                             <span>Total Terlewat ({stats.totalMissed}x)</span>
                             <span className="text-red-500">{100 - stats.donePercent}%</span>
                          </div>
                          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                             <div className="h-full bg-red-400 rounded-full" style={{ width: `${100 - stats.donePercent}%` }}></div>
                          </div>
                        </div>
                     </div>
                  </div>
                  
                  <div className="pt-4 border-t border-slate-200 space-y-3">
                     <div className="bg-white p-4 rounded-xl border border-green-100 shadow-sm">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-3 flex items-center gap-1"><Award size={12} className="text-green-500"/> 3 Paling Konsisten</p>
                        <div className="space-y-2">
                           {stats.top3Freq.length ? stats.top3Freq.map((item, i) => (
                              <div key={i} className="flex justify-between items-center text-sm">
                                 <span className="font-bold text-slate-700 truncate mr-2">{i+1}. {item.name}</span>
                                 <span className="font-black text-green-600 shrink-0">{item.done}x</span>
                              </div>
                           )) : <p className="text-xs text-slate-400 italic">Belum ada data.</p>}
                        </div>
                     </div>
                     
                     <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-3 flex items-center gap-1"><AlertOctagon size={12} className="text-red-500"/> 3 Sering Terlewat</p>
                        <div className="space-y-2">
                           {stats.top3Missed.length ? stats.top3Missed.map((item, i) => (
                              <div key={i} className="flex justify-between items-center text-sm">
                                 <span className="font-bold text-slate-700 truncate mr-2">{i+1}. {item.name}</span>
                                 <span className="font-black text-red-500 shrink-0">{item.missed}x</span>
                              </div>
                           )) : <p className="text-xs text-slate-400 italic">Belum ada data.</p>}
                        </div>
                     </div>
                  </div>
               </div>

               <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                  <h3 className="text-slate-700 font-bold mb-4 text-center">Disiplin Waktu Pelaporan</h3>
                  <p className="text-[10px] text-slate-500 text-center mb-6">Tepat waktu: Maksimal 30 menit dari target pelaksanaan.</p>
                  
                  <div className="space-y-4">
                     <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-3 flex items-center gap-1">⏱️ 3 Teratas (Tepat Waktu)</p>
                        <div className="space-y-2">
                           {stats.top3OnTime.length ? stats.top3OnTime.map((item, i) => (
                              <div key={i} className="flex justify-between items-center text-sm">
                                 <span className="font-bold text-slate-700 truncate mr-2">{i+1}. {item.name}</span>
                                 <span className="font-black text-blue-600 shrink-0">{Math.round(item.onTimePct)}%</span>
                              </div>
                           )) : <p className="text-xs text-slate-400 italic">Belum ada data valid.</p>}
                        </div>
                     </div>

                     <div className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-3 flex items-center gap-1">⚠️ 3 Terbawah (Sering Rapelan)</p>
                        <div className="space-y-2">
                           {stats.top3Late.length ? stats.top3Late.map((item, i) => (
                              <div key={i} className="flex justify-between items-center text-sm">
                                 <span className="font-bold text-slate-700 truncate mr-2">{i+1}. {item.name}</span>
                                 <span className="font-black text-orange-500 shrink-0">{Math.round(item.latePct)}%</span>
                              </div>
                           )) : <p className="text-xs text-slate-400 italic">Belum ada data valid.</p>}
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="mt-12 pt-6 border-t border-slate-100 text-center leading-relaxed">
               <p className="text-slate-500 text-xs font-semibold">© 2026 TafkirCorp. Seluruh hak cipta milik ALLAAH SWT.</p>
               <p className="text-slate-400 text-[10px] mt-1">TafkirCorp App TrackerIbadahKU v1.0.0</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}