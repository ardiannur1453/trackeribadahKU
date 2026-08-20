import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import html2canvas from 'html2canvas';
import { ComposedChart, Area, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { Trash2, Edit3, Eye, Download, LogOut, Check, X, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle, BarChart2, Save, Zap, Plus, Award, AlertOctagon, Search, Shield, Medal, Users, Info, KeyRound, Copy, Target, Clock, Calendar, Activity } from 'lucide-react';

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

// --- HELPER & KONSTANTA ---
const getLocalDateStr = (d: Date) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getDayName = (d: Date) => {
  return ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][d.getDay()];
};

const formatLastLogin = (timestamp: number) => {
   if (!timestamp) return "Belum pernah";
   return new Date(timestamp).toLocaleDateString('id-ID', { 
     weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
   });
};

const SEED_ACTIVITIES = [
  { id: 'c1', name: 'Shalat Taubat', time: '02:00' }, 
  { id: 'c2', name: 'Shalat Tahajud', time: '03:00' },
  { id: 'c3', name: 'Shalat Qabliyah Subuh', time: '04:15' }, 
  { id: 'c4', name: 'Shalat Subuh Berjamaah', time: '04:30' },
  { id: 'c5', name: 'Dzikir Pagi', time: '05:00' }, 
  { id: 'c6', name: 'Shalat Dhuha', time: '09:00' },
  { id: 'c7', name: 'Shalat Dzuhur Berjamaah', time: '12:00' }, 
  { id: 'c8', name: 'Shalat Ashar Berjamaah', time: '15:15' },
  { id: 'c9', name: 'Shalat Maghrib Berjamaah', time: '18:00' }, 
  { id: 'c10', name: 'Dzikir Petang', time: '18:30' },
  { id: 'c11', name: 'Shalat Isya Berjamaah', time: '19:15' }, 
  { id: 'c12', name: 'Tilawah Al-Quran', time: '20:00' }
];

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

export default function IbadahTracker() {
  // --- STATES UTAMA ---
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'user'|'admin'|'superadmin'>('user');
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // --- STATES DATA ---
  const [personalActivities, setPersonalActivities] = useState<any[]>([]);
  const [joinedCommunityIds, setJoinedCommunityIds] = useState<string[]>([]);
  const [allCommunities, setAllCommunities] = useState<any[]>([]); 
  const [globalActivities, setGlobalActivities] = useState<any[]>([]); 
  const [records, setRecords] = useState<any>({});
  const [journals, setJournals] = useState<any[]>([]);
  
  // --- STATES UI & MODAL ---
  const [toast, setToast] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [actModal, setActModal] = useState({ show: false, mode: 'add', id: null as any, name: '', time: '00:00' });
  const [roleConfirmModal, setRoleConfirmModal] = useState({ show: false, targetUser: null as any, makeAdmin: false });
  
  // --- STATES JURNAL ---
  const [activeJournal, setActiveJournal] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [journalInput, setJournalInput] = useState({ title: '', content: '' });
  const [journalSearch, setJournalSearch] = useState('');
  const [journalSort, setJournalSort] = useState<'newest' | 'oldest' | 'az' | 'za'>('newest');

  // --- STATES GRAFIK & ANALISA ---
  const [leaderboardTabs, setLeaderboardTabs] = useState<Record<string, 'monthly'|'weekly'|'yesterday'>>({});
  const [wtwMonthOffset, setWtwMonthOffset] = useState(0); // 0 = Bulan ini, -1 = Bulan lalu, dst
  const [mtmRange, setMtmRange] = useState(6); // 3, 6, atau 12 bulan

  // --- STATES ADMIN ---
  const isSuperAdmin = user?.email === 'coachardi1453@gmail.com';
  const isAdmin = isSuperAdmin || userRole === 'admin';
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState<'users' | 'communities' | 'globalacts'>('users');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminSort, setAdminSort] = useState<'newest' | 'az'>('newest');
  
  const [editCommId, setEditCommId] = useState<string|null>(null);
  const [newCommName, setNewCommName] = useState('');
  const [selectedActs, setSelectedActs] = useState<{id: string, time: string}[]>([]);
  const [newGlobalAct, setNewGlobalAct] = useState({ name: '', time: '00:00' });

  // --- REFERENCES ---
  const chartRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const todayColumnRef = useRef<HTMLTableCellElement>(null);

  // ==========================================
  // 1. INIT AUTH & LAST LOGIN
  // ==========================================
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser); 
      setIsInitializing(false);
      
      if (currentUser) {
         try {
            const isSuper = currentUser.email === 'coachardi1453@gmail.com';
            await setDoc(doc(db, 'users', currentUser.uid), {
               displayName: currentUser.displayName, 
               email: currentUser.email,
               lastLogin: new Date().getTime(), 
               role: isSuper ? 'superadmin' : undefined
            }, { merge: true });
         } catch (e) {
            console.error("Gagal sinkronisasi login:", e);
         }
      }
    });
    return () => unsubscribe();
  }, []);

  // ==========================================
  // 2. FETCH DATA DARI FIREBASE
  // ==========================================
  useEffect(() => {
    if (!user) return;
    setIsSyncing(true);
    
    // 2A. Profil User & Rekaman
    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
       if (snap.exists()) {
          const d = snap.data();
          setPersonalActivities(d.activities || []); 
          setRecords(d.records || {});
          setJournals(d.journals || []); 
          setJoinedCommunityIds(d.joinedCommunities || []);
          
          if (user.email === 'coachardi1453@gmail.com') {
              setUserRole('superadmin');
          } else {
              setUserRole(d.role || 'user');
          }
       }
       setIsSyncing(false);
    });
    
    // 2B. Daftar Semua Komunitas
    const unsubComms = onSnapshot(collection(db, 'communities'), (snap) => {
       const comms: any[] = []; 
       snap.forEach(d => comms.push({ id: d.id, ...d.data() })); 
       setAllCommunities(comms);
    });
    
    // 2C. Master Ibadah Global
    const unsubGlobal = onSnapshot(collection(db, 'global_activities'), (snap) => {
       // Seeding otomatis untuk Super Admin jika kosong
       if (snap.empty && isSuperAdmin) { 
          SEED_ACTIVITIES.forEach(async (act) => {
              await setDoc(doc(db, 'global_activities', act.id), act);
          }); 
       } else {
          const acts: any[] = []; 
          snap.forEach(d => acts.push({ docId: d.id, ...d.data() }));
          acts.sort((a, b) => a.time.localeCompare(b.time)); 
          setGlobalActivities(acts);
       }
    });
    
    return () => { 
        unsubUser(); 
        unsubComms(); 
        unsubGlobal(); 
    };
  }, [user, isSuperAdmin]);

  // 2D. Daftar User (Hanya jika role Admin/SuperAdmin)
  useEffect(() => {
    if (isAdmin) {
      const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
         const usersData: any[] = []; 
         snap.forEach(d => usersData.push({ id: d.id, ...d.data() })); 
         setAllUsers(usersData);
      });
      return () => unsubUsers();
    }
  }, [isAdmin]);

  // ==========================================
  // 3. AUTO SAVE TRIGGER & UTILS
  // ==========================================
  useEffect(() => {
    if (hasUnsavedChanges && user) {
      const timer = setTimeout(() => saveToServer(true), 5 * 60 * 1000); 
      return () => clearTimeout(timer);
    }
  }, [hasUnsavedChanges, records, journals, personalActivities, joinedCommunityIds]);

  const showToast = (msg: string) => { 
      setToast(msg); 
      setTimeout(() => setToast(''), 4000); 
  };
  
  const scrollToToday = () => {
      if (todayColumnRef.current && tableContainerRef.current) {
         const container = tableContainerRef.current; 
         const target = todayColumnRef.current;
         container.scrollTo({ 
             left: target.offsetLeft - (container.clientWidth / 2) + (target.clientWidth / 2), 
             behavior: 'smooth' 
         });
      } else { 
         showToast("Bulan ini tidak sedang ditampilkan."); 
      }
  };

  // ==========================================
  // 4. PEMROSESAN DATA (USEMEMO)
  // ==========================================
  
  // Deduplikasi & Penggabungan Data Komunitas
  const communityActivities = useMemo(() => {
     let commActsMap: Record<string, any> = {};
     
     joinedCommunityIds.forEach(commId => {
        const comm = allCommunities.find(c => c.id === commId);
        if (comm && comm.activities) {
           comm.activities.forEach((actObj: any) => {
              const globalAct = globalActivities.find(a => a.id === actObj.id || a.docId === actObj.id);
              if (globalAct) {
                 const uniqueKey = `${actObj.id}_${actObj.time}`;
                 if (!commActsMap[uniqueKey]) {
                     commActsMap[uniqueKey] = { 
                         id: uniqueKey, 
                         type: 'komunitas', 
                         name: globalAct.name, 
                         time: actObj.time, 
                         communities: [comm.name] 
                     };
                 } else if (!commActsMap[uniqueKey].communities.includes(comm.name)) {
                     commActsMap[uniqueKey].communities.push(comm.name);
                 }
              }
           });
        }
     });
     return Object.values(commActsMap).sort((a, b) => a.time.localeCompare(b.time));
  }, [joinedCommunityIds, allCommunities, globalActivities]);

  const formattedPersonalActivities = useMemo(() => {
      return personalActivities.map(a => ({...a, type: 'pribadi'}));
  }, [personalActivities]);

  const allCombinedActivities = useMemo(() => {
      return [...formattedPersonalActivities, ...communityActivities];
  }, [formattedPersonalActivities, communityActivities]);

  const joinedCommunityNames = useMemo(() => {
     return joinedCommunityIds.map(id => allCommunities.find(c => c.id === id)?.name)
                              .filter(Boolean)
                              .join(', ');
  }, [joinedCommunityIds, allCommunities]);

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear(); 
    const month = currentDate.getMonth(); 
    const days = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));
  }, [currentDate]);

  // Clean-up "ID Hantu" jika admin menghapus komunitas
  useEffect(() => {
     if(allCommunities.length > 0 && joinedCommunityIds.length > 0) {
        const validIds = joinedCommunityIds.filter(id => allCommunities.some(c => c.id === id));
        if(validIds.length !== joinedCommunityIds.length) {
            setJoinedCommunityIds(validIds);
        }
     }
  }, [allCommunities, joinedCommunityIds]);


  // ==========================================
  // 5. LOGIKA INPUT & TABEL HISAB
  // ==========================================
  
  // Penentuan Tepat Waktu (Maks 12:15 & Maks 00:30)
  const getIsOnTime = (recordTimestamp: number, targetDate: Date, actTime: string) => {
     const [h] = actTime.split(':').map(Number);
     const deadline = new Date(targetDate);
     
     if (h < 12) { 
         deadline.setHours(12, 15, 0, 0); 
     } else { 
         deadline.setDate(deadline.getDate() + 1); 
         deadline.setHours(0, 30, 0, 0); 
     }
     
     return recordTimestamp <= deadline.getTime();
  };

  const handleRecord = (day: Date, actId: string, actTime: string, currentStatus: string | undefined) => {
    const now = new Date(); 
    const [hours, minutes] = actTime.split(':').map(Number);
    const targetTime = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
    
    // Gembok Masa Depan + 1 Menit
    const unlockTime = new Date(targetTime.getTime() + 60000); 
    if (now < unlockTime) {
        return showToast(`Belum waktunya! Dibuka pukul ${unlockTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
    }

    const key = `${getLocalDateStr(day)}-${actId}`;
    let newStatus = 'done';
    
    if (currentStatus === 'done') newStatus = 'missed';
    if (currentStatus === 'missed') newStatus = 'none';

    let newRecs = { ...records };
    if (newStatus === 'none') {
        delete newRecs[key]; 
    } else { 
        newRecs[key] = { status: newStatus, timestamp: now.getTime() }; 
    }
    
    setRecords(newRecs); 
    setHasUnsavedChanges(true); 
  };

  // ==========================================
  // 6. MANAJEMEN KOMITMEN PRIBADI
  // ==========================================
  const saveActivity = () => {
     if (!actModal.name.trim()) return showToast("Nama aktivitas kosong!");
     let newActs = [...personalActivities];
     
     if (actModal.mode === 'add') {
         newActs.push({ id: `p_${Date.now()}`, name: actModal.name, time: actModal.time }); 
     } else { 
         newActs = newActs.map(a => String(a.id) === String(actModal.id) ? { ...a, name: actModal.name, time: actModal.time } : a); 
     }
     
     newActs.sort((a, b) => a.time.localeCompare(b.time));
     setPersonalActivities(newActs); 
     setHasUnsavedChanges(true);
     setActModal({ show: false, mode: 'add', id: null, name: '', time: '00:00' });
     showToast(`Aktivitas disimpan! Jangan lupa Simpan Perubahan.`);
  };

  const deleteActivity = (id: any) => {
     if (window.confirm("Yakin hapus aktivitas ini?")) {
        setPersonalActivities(personalActivities.filter(a => String(a.id) !== String(id))); 
        setHasUnsavedChanges(true);
        showToast("Aktivitas dihapus. Klik Simpan Perubahan.");
     }
  };

  // Peringatan Segitiga Merah (< 50%)
  const getDailyEvaluation = (actId: any) => {
    const today = new Date();
    let isCurrentMonth = currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
    let isPastMonth = currentDate.getFullYear() < today.getFullYear() || (currentDate.getFullYear() === today.getFullYear() && currentDate.getMonth() < today.getMonth());
    
    if (!isCurrentMonth && !isPastMonth) return true; 

    const activity = allCombinedActivities.find(a => String(a.id) === String(actId));
    if (!activity) return true;
    
    const [h, m] = activity.time.split(':').map(Number);
    let expected = 0; 
    let doneCount = 0;
    
    daysInMonth.forEach(d => {
       const targetTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
       // Logika Kosong = Minus (Hanya cek yang waktunya sudah lewat)
       if (today.getTime() >= targetTime.getTime() + 60000) {
          expected++; 
          if (records[`${getLocalDateStr(d)}-${actId}`]?.status === 'done') {
              doneCount++;
          }
       }
    });
    
    return expected === 0 ? true : (doneCount / expected) >= 0.5; 
  };


  // ==========================================
  // 7. MESIN KALKULASI STATISTIK MASTER
  // ==========================================
  const calcStats = () => {
    const today = new Date();
    
    // Helper Penghitung Skor Generik (Memakai logika Kosong=Minus)
    const calculateScore = (actArray: any[]) => {
       let expected = 0; 
       let done = 0;
       
       daysInMonth.forEach(d => {
          const dateStr = getLocalDateStr(d);
          actArray.forEach(a => {
             const [h, m] = a.time.split(':').map(Number);
             const targetTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
             
             if (today.getTime() >= targetTime.getTime() + 60000) {
                expected++; 
                if (records[`${dateStr}-${a.id}`]?.status === 'done') {
                    done++;
                }
             }
          });
       });
       return expected === 0 ? 0 : Math.round((done / expected) * 100);
    };

    // A. Skor Berjenjang
    const scorePribadi = personalActivities.length ? calculateScore(formattedPersonalActivities) : 0;
    
    let totalCommScore = 0; 
    let activeComms = 0; 
    const communityScoresDetail: Record<string, number> = {};
    
    joinedCommunityIds.forEach(commId => {
       const comm = allCommunities.find(c => c.id === commId);
       if (comm && comm.activities?.length > 0) {
          const acts = comm.activities.map((actObj: any) => {
             const gAct = globalActivities.find(g => g.id === actObj.id || g.docId === actObj.id);
             return gAct ? { id: `${actObj.id}_${actObj.time}`, name: gAct.name, time: actObj.time } : null;
          }).filter(Boolean);
          
          const score = calculateScore(acts);
          communityScoresDetail[commId] = score; 
          totalCommScore += score; 
          activeComms++;
       }
    });

    const scoreKomunitas = activeComms > 0 ? Math.round(totalCommScore / activeComms) : 0;
    
    let scoreGabungan = 0;
    if (personalActivities.length > 0 && activeComms > 0) {
        scoreGabungan = Math.round((scorePribadi + scoreKomunitas) / 2);
    } else if (personalActivities.length > 0) {
        scoreGabungan = scorePribadi;
    } else if (activeComms > 0) {
        scoreGabungan = scoreKomunitas;
    }

    // B. Metrik Kuantitas & Kedisiplinan
    let totalDone = 0; 
    let totalMissed = 0;
    
    const weeklyStats = [ 
        { expected: 0, done: 0 }, { expected: 0, done: 0 }, { expected: 0, done: 0 }, 
        { expected: 0, done: 0 }, { expected: 0, done: 0 } 
    ];
    
    const actMetrics: Record<string, { name: string, type: string, done: number, missed: number, diffMinsTotal: number }> = {};
    allCombinedActivities.forEach(a => actMetrics[a.id] = { name: a.name, type: a.type, done: 0, missed: 0, diffMinsTotal: 0 });

    let qty = { p_done: 0, p_miss: 0, c_done: 0, c_miss: 0 };

    daysInMonth.forEach(d => {
       const wIdx = Math.floor((d.getDate() - 1) / 7); 
       const dateStr = getLocalDateStr(d);
       
       allCombinedActivities.forEach(a => {
          const [h, m] = a.time.split(':').map(Number);
          const targetTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime();
          
          if (today.getTime() >= targetTime + 60000) {
             weeklyStats[wIdx].expected++;
             const rec = records[`${dateStr}-${a.id}`];
             const isPribadi = a.type === 'pribadi';
             
             if (rec && rec.status === 'done') {
                weeklyStats[wIdx].done++; 
                actMetrics[a.id].done++;
                if (isPribadi) qty.p_done++; else qty.c_done++;
                
                // Hitung selisih waktu pelaporan dengan target (dalam menit)
                // Kita gunakan Math.abs untuk mengamankan jika lapor lebih awal (walau ada gembok)
                let diff = (rec.timestamp - targetTime) / 60000;
                if (diff < 0) diff = Math.abs(diff); 
                
                actMetrics[a.id].diffMinsTotal += diff;
                
             } else {
                actMetrics[a.id].missed++;
                if (isPribadi) qty.p_miss++; else qty.c_miss++;
             }
          }
       });
    });

    const qtyGabungan = { done: qty.p_done + qty.c_done, missed: qty.p_miss + qty.c_miss };

    // Cari Frekuensi Tertinggi/Terendah
    const metricArray = Object.values(actMetrics).filter(a => a.done + a.missed > 0);
    const p_metrics = metricArray.filter(a => a.type === 'pribadi');
    const c_metrics = metricArray.filter(a => a.type === 'komunitas');
    
    const topPribadi = [...p_metrics].sort((a,b) => b.done - a.done)[0];
    const botPribadi = [...p_metrics].sort((a,b) => a.done - b.done)[0];
    const topComm = [...c_metrics].sort((a,b) => b.done - a.done)[0];
    const botComm = [...c_metrics].sort((a,b) => a.done - b.done)[0];

    // C. Analisa Tepat Waktu Berdasarkan Rata-rata Menit Keterlambatan
    const disciplineList = metricArray.filter(a => a.done > 0).map(a => {
        return { name: a.name, avgDiff: a.diffMinsTotal / a.done, done: a.done };
    });
    
    const topOnTime = [...disciplineList].sort((a,b) => a.avgDiff - b.avgDiff).slice(0, 5);
    const topLate = [...disciplineList].sort((a,b) => b.avgDiff - a.avgDiff).slice(0, 5);

    return { 
        scorePribadi, scoreKomunitas, scoreGabungan, communityScoresDetail, 
        qty, qtyGabungan, weeklyStats, 
        topPribadi, botPribadi, topComm, botComm, 
        topOnTime, topLate 
    };
  };

  const stats = calcStats();

  // Helper untuk Footer Tabel
  const getSubDailyPct = (day: Date, acts: any[]) => {
     const today = new Date(); 
     const dateStr = getLocalDateStr(day);
     let exp = 0; 
     let done = 0;
     
     acts.forEach(a => {
        const [h, m] = a.time.split(':').map(Number);
        if (today.getTime() >= new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).getTime() + 60000) {
           exp++; 
           if (records[`${dateStr}-${a.id}`]?.status === 'done') done++;
        }
     });
     return exp === 0 ? "-" : `${Math.round((done / exp) * 100)}%`;
  };

  const getDailyPercentage = (day: Date) => {
     return getSubDailyPct(day, allCombinedActivities);
  };

  // ==========================================
  // 8. FUNGSI SIMPAN KE FIREBASE
  // ==========================================
  const saveToServer = async (isAutoSave = false) => {
    if (!user) return; 
    setIsSaving(true);
    
    const mKey = `${String(currentDate.getMonth() + 1).padStart(2, '0')}-${currentDate.getFullYear()}`;
    const payload: any = { 
       activities: personalActivities, 
       records, 
       journals, 
       joinedCommunities: joinedCommunityIds,
       displayName: user.displayName, 
       email: user.email, 
       lastActivity: new Date().getTime(),
       [`score_${mKey}_gabungan`]: stats.scoreGabungan
    };
    
    // Simpan data skor per komunitas untuk Leaderboard
    Object.entries(stats.communityScoresDetail).forEach(([cId, score]) => {
        payload[`score_${mKey}_comm_${cId}`] = score;
    });
    
    try {
      await setDoc(doc(db, 'users', user.uid), payload, { merge: true });
      setHasUnsavedChanges(false); 
      if (!isAutoSave) showToast("Disinkronkan ke Server!");
    } catch (e) { 
      showToast("Tersimpan lokal. Akan sync saat online."); 
    } finally { 
      setIsSaving(false); 
    }
  };

  // ==========================================
  // 9. FITUR SUPER ADMIN & ADMIN
  // ==========================================
  const executeRoleChange = async () => {
     try {
        await setDoc(doc(db, 'users', roleConfirmModal.targetUser.id), { 
            role: roleConfirmModal.makeAdmin ? 'admin' : 'user' 
        }, { merge: true });
        showToast("Hak akses berhasil diubah!");
     } catch(e) { 
        showToast("Gagal mengubah hak akses."); 
     }
     setRoleConfirmModal({ show: false, targetUser: null, makeAdmin: false });
  };

  const handleSaveCommunity = async () => {
     if (!newCommName.trim() || selectedActs.length === 0) return showToast("Nama & min 1 aktivitas wajib diisi!");
     
     try {
        if (editCommId) {
           await updateDoc(doc(db, 'communities', editCommId), { 
               name: newCommName, activities: selectedActs 
           });
           showToast("Komunitas diperbarui!");
        } else {
           // Generate Semantik Join Code (Cth: mip_X8J9)
           const prefix = newCommName.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
           const joinCode = `${prefix}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
           
           await addDoc(collection(db, 'communities'), { 
               name: newCommName, 
               ownerId: user.uid, 
               activities: selectedActs, 
               joinCode: joinCode, 
               createdAt: new Date().getTime() 
           });
           showToast(`Komunitas dibuat! Kode Join: ${joinCode}`);
        }
        setNewCommName(''); setSelectedActs([]); setEditCommId(null);
     } catch (e) { 
        showToast("Gagal menyimpan."); 
     }
  };

  const handleDeleteCommunity = async (id: string) => {
     if (window.confirm("PERINGATAN: Yakin menghapus komunitas ini selamanya?")) {
        try { 
            await deleteDoc(doc(db, 'communities', id)); 
            showToast("Komunitas telah dihapus."); 
        } catch(e) { 
            showToast("Gagal menghapus."); 
        }
     }
  };

  const handleAddGlobalActivity = async () => {
     if(!newGlobalAct.name.trim()) return;
     try {
        const newId = `c${Date.now()}`;
        await setDoc(doc(db, 'global_activities', newId), { 
            id: newId, name: newGlobalAct.name, time: newGlobalAct.time 
        });
        setNewGlobalAct({ name: '', time: '00:00' }); 
        showToast("Master Ibadah ditambahkan.");
     } catch (e) { 
        showToast("Gagal menambah master."); 
     }
  };

  const handleJoinCommunity = () => {
     const code = joinCodeInput.trim().toLowerCase();
     const comm = allCommunities.find(c => c.joinCode?.toLowerCase() === code);
     if (!comm) return showToast("Kode tidak valid!");
     if (joinedCommunityIds.includes(comm.id)) return showToast("Sudah bergabung.");
     
     setJoinedCommunityIds([...joinedCommunityIds, comm.id]); 
     setHasUnsavedChanges(true); 
     setShowJoinModal(false); 
     setJoinCodeInput('');
     showToast(`Bergabung ke ${comm.name}! Klik Simpan Perubahan.`);
  };

  // Filter Data Users untuk Admin Dashboard
  const filteredAdminUsers = useMemo(() => {
     let result = allUsers;
     if (userRole === 'admin') {
        const myComms = allCommunities.filter(c => c.ownerId === user.uid).map(c => c.id);
        result = allUsers.filter(u => u.joinedCommunities?.some((id:string) => myComms.includes(id)));
     }
     
     if (adminSearch) {
         result = result.filter(u => 
             (u.displayName||'').toLowerCase().includes(adminSearch.toLowerCase()) || 
             (u.email||'').toLowerCase().includes(adminSearch.toLowerCase())
         );
     }
     
     return result.sort((a,b) => adminSort === 'newest' ? (b.lastLogin || 0) - (a.lastLogin || 0) : (a.displayName||'').localeCompare(b.displayName||''));
  }, [allUsers, userRole, allCommunities, user, adminSearch, adminSort]);

  // ==========================================
  // 10. FITUR JURNAL & EXPORT
  // ==========================================
  const handleLogout = () => {
    if (hasUnsavedChanges && !window.confirm("PERINGATAN: Ada perubahan yang belum disimpan. Yakin ingin keluar?")) return; 
    signOut(auth);
  };

  const saveJournal = () => {
    if (!journalInput.title) return showToast("Judul jurnal tidak boleh kosong");
    const newJ = { 
        id: activeJournal ? activeJournal.id : Date.now(), 
        title: journalInput.title, 
        content: journalInput.content, 
        date: new Date().toISOString() 
    };
    
    if (activeJournal) { 
        setJournals(journals.map(j => j.id === activeJournal.id ? newJ : j)); 
    } else { 
        setJournals([newJ, ...journals]); 
    }
    
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
      link.download = `${user.displayName?.split(' ')[0]||'User'}-Tafkir-${MONTH_NAMES[currentDate.getMonth()]}.jpg`;
      link.href = canvas.toDataURL('image/jpeg'); 
      link.click();
    }
  };

  // ==========================================
  // 11. GENERATOR DATA GRAFIK (CHARTS)
  // ==========================================
  const linearRegression = (data: any[], key: string) => {
     const n = data.length; 
     let sumX=0, sumY=0, sumXY=0, sumX2=0;
     data.forEach(d => { 
         sumX += d.x; 
         sumY += d[key]; 
         sumXY += d.x * d[key]; 
         sumX2 += d.x * d.x; 
     });
     const den = (n * sumX2 - sumX * sumX); 
     const m = den === 0 ? 0 : (n * sumXY - sumX * sumY) / den;
     const b = (sumY - m * sumX) / n; 
     return {m, b};
  };

  // A. Data Grafik Utama 3 Garis
  const mainChartData = useMemo(() => {
    const raw = daysInMonth.map((d, i) => {
      const p = getSubDailyPct(d, formattedPersonalActivities);
      const c = getSubDailyPct(d, communityActivities);
      const g = getSubDailyPct(d, allCombinedActivities);
      return { 
          x: i + 1, 
          tgl: d.getDate().toString(), 
          pri: p === '-' ? 0 : parseInt(p), 
          kom: c === '-' ? 0 : parseInt(c), 
          gab: g === '-' ? 0 : parseInt(g) 
      };
    });
    
    // Regresi linier untuk mencari Trend
    const tGab = linearRegression(raw, 'gab');
    
    return raw.map(d => ({ 
        ...d, 
        t_gab: Math.max(0, Math.min(100, Math.round(tGab.m * d.x + tGab.b))) 
    }));
  }, [daysInMonth, records, formattedPersonalActivities, communityActivities, allCombinedActivities]);

  // B. Data Week to Week
  const wtwData = useMemo(() => {
     const targetDate = new Date(); 
     targetDate.setMonth(targetDate.getMonth() + wtwMonthOffset);
     const days = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
     
     const wStats = [ 
         { name: 'Pekan 1', exp:0, done:0 }, { name: 'Pekan 2', exp:0, done:0 }, 
         { name: 'Pekan 3', exp:0, done:0 }, { name: 'Pekan 4', exp:0, done:0 }, { name: 'Pekan 5', exp:0, done:0 } 
     ];
     
     Array.from({ length: days }, (_, i) => new Date(targetDate.getFullYear(), targetDate.getMonth(), i + 1)).forEach(d => {
        const wIdx = Math.floor((d.getDate() - 1) / 7); 
        const dStr = getLocalDateStr(d);
        
        allCombinedActivities.forEach(a => {
           const [h, m] = a.time.split(':').map(Number);
           // Logika Kosong = Minus
           if (new Date().getTime() >= new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime() + 60000) {
              wStats[wIdx].exp++; 
              if(records[`${dStr}-${a.id}`]?.status === 'done') {
                  wStats[wIdx].done++;
              }
           }
        });
     });
     
     return wStats.filter(w => w.exp > 0).map(w => ({ 
         name: w.name, pencapaian: Math.round((w.done/w.exp)*100) 
     }));
  }, [wtwMonthOffset, records, allCombinedActivities]);

  // C. Data Month to Month
  const mtmData = useMemo(() => {
     const result = [];
     for(let i = mtmRange - 1; i >= 0; i--) {
        const d = new Date(); 
        d.setMonth(d.getMonth() - i);
        const mKey = `${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
        
        // Tarik skor historis gabungan dari profil User itu sendiri
        const userProfileScore = user && allUsers.find(u => u.id === user.uid)?.[`score_${mKey}_gabungan`];
        
        result.push({ 
            x: mtmRange - i, 
            bln: MONTH_NAMES[d.getMonth()].substring(0, 3), 
            skor: userProfileScore || 0 
        });
     }
     
     const tLine = linearRegression(result, 'skor');
     return result.map(d => ({ 
         ...d, 
         trend: Math.max(0, Math.min(100, Math.round(tLine.m * d.x + tLine.b))) 
     }));
  }, [mtmRange, user, allUsers]);

  // ==========================================
  // RENDER APP STATE
  // ==========================================
  if (isInitializing) {
      return <div className="fixed inset-0 bg-slate-50 flex items-center justify-center text-orange-500 font-bold z-50">Memuat Sistem Tafkir...</div>;
  }
  
  if (!user) {
    return (
      <div className="fixed inset-0 w-full h-full bg-[#111111] flex flex-col items-center justify-center p-4 z-50">
        <div className="bg-white/5 border border-orange-500/30 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center m-auto">
          <div className="w-24 h-24 mx-auto mb-6 bg-white rounded-full border-4 border-orange-500 flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.4)]">
             <img src="/logo.png" alt="Logo" className="w-[75%] h-[75%] object-contain" />
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
      <div className="min-h-full p-2 md:p-6 relative">
        
        {/* ================= MODALS ================= */}

        {/* MODAL INFO APP */}
        {showInfoModal && (
           <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
              <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
                 <button onClick={() => setShowInfoModal(false)} className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full"><X size={20}/></button>
                 <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center"><img src="/logo.png" alt="Logo" className="w-8 h-8" /></div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Tracker IbadahKU</h2>
                        <p className="text-xs text-orange-600 font-bold tracking-widest">VER 20.08.26 rev4</p>
                    </div>
                 </div>
                 <div className="space-y-6">
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                       <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2"><Target size={16}/> Pembaruan Enterprise</h3>
                       <ul className="text-[11px] text-blue-700 space-y-1 ml-4 list-disc">
                          <li>Sistem Multi-Komunitas & Gamifikasi dengan Master Global.</li>
                          <li>Tabel Kuantitas berjenjang (Pribadi & Komunitas).</li>
                          <li>Grafik Area 3 Garis + Grafik Historis (Mingguan & Bulanan).</li>
                          <li>Bedah Disiplin Waktu Akurat (Maks 12:15 & 00:30).</li>
                          <li>Aturan Disiplin Ketat: Lupa Centang = Minus.</li>
                       </ul>
                    </div>
                 </div>
              </div>
           </div>
        )}

        {/* MODAL ROLE CONFIRM */}
        {roleConfirmModal.show && (
           <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[130] p-4">
              <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative text-center">
                 <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                     <Shield className="text-orange-600" size={32}/>
                 </div>
                 <h2 className="text-xl font-bold text-slate-800 mb-2">Konfirmasi Perubahan</h2>
                 <p className="text-slate-500 text-sm mb-6">Yakin ingin mengubah status <b>{roleConfirmModal.targetUser?.displayName}</b> menjadi <b>{roleConfirmModal.makeAdmin ? 'ADMIN' : 'USER REGULER'}</b>?</p>
                 <div className="flex gap-3">
                    <button onClick={() => setRoleConfirmModal({show:false, targetUser:null, makeAdmin:false})} className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200">Batal</button>
                    <button onClick={executeRoleChange} className="flex-1 bg-orange-600 text-white font-bold py-3 rounded-xl hover:bg-orange-700">Ya, Ubah</button>
                 </div>
              </div>
           </div>
        )}

        {/* MODAL JOIN KOMUNITAS */}
        {showJoinModal && (
           <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
              <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative text-center">
                 <button onClick={() => setShowJoinModal(false)} className="absolute top-4 right-4 p-2 text-slate-400 rounded-full"><X size={20}/></button>
                 <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                     <KeyRound size={32} className="text-purple-600"/>
                 </div>
                 <h2 className="text-2xl font-bold text-slate-800 mb-2">Gabung Grup</h2>
                 <input type="text" value={joinCodeInput} onChange={e => setJoinCodeInput(e.target.value.toLowerCase())} placeholder="Cth: tafkir_x8j9" className="w-full text-center text-lg font-bold bg-slate-50 border-2 border-slate-200 rounded-xl p-4 mb-6 outline-none focus:border-purple-500 focus:bg-purple-50 transition-all" />
                 <button onClick={handleJoinCommunity} className="w-full bg-purple-600 text-white font-bold py-3.5 rounded-xl hover:bg-purple-700 shadow-lg">Gabung Sekarang</button>
              </div>
           </div>
        )}

        {/* MODAL BUAT AKTIVITAS PRIBADI */}
        {actModal.show && (
           <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
              <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
                 <button onClick={() => setActModal({...actModal, show: false})} className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                 <h2 className="text-xl font-bold text-slate-800 mb-4">{actModal.mode === 'add' ? 'Tambah Komitmen Pribadi' : 'Edit Komitmen Pribadi'}</h2>
                 <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Nama</label>
                        <input type="text" value={actModal.name} onChange={e => setActModal({...actModal, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Jam</label>
                        <input type="time" value={actModal.time} onChange={e => setActModal({...actModal, time: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-blue-500 outline-none" />
                    </div>
                 </div>
                 <button onClick={saveActivity} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700">Simpan</button>
              </div>
           </div>
        )}

        {/* ================= ADMIN DASHBOARD ================= */}
        {showAdminPanel && isAdmin && (
           <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
              <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-5xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
                 <button onClick={() => {setShowAdminPanel(false); setEditCommId(null); setNewCommName(''); setSelectedActs([]);}} className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full"><X size={20}/></button>
                 <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-3"><Shield className="text-blue-500"/> {isSuperAdmin ? 'Super Admin Dashboard' : 'Admin Dashboard'}</h2>
                 <p className="text-sm text-slate-500 mb-6">Kelola Komunitas Gamifikasi dan Pantau Anggota Anda.</p>
                 
                 <div className="flex border-b border-slate-200 mb-6 gap-6 overflow-x-auto">
                    <button onClick={()=>setAdminTab('users')} className={`pb-3 font-bold transition-all border-b-2 whitespace-nowrap ${adminTab === 'users' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Pantau Anggota</button>
                    <button onClick={()=>{setAdminTab('communities'); setEditCommId(null); setNewCommName(''); setSelectedActs([]);}} className={`pb-3 font-bold transition-all border-b-2 whitespace-nowrap ${adminTab === 'communities' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Kelola Komunitas & Kode Join</button>
                    {isSuperAdmin && <button onClick={()=>setAdminTab('globalacts')} className={`pb-3 font-bold transition-all border-b-2 whitespace-nowrap ${adminTab === 'globalacts' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Master Ibadah Global</button>}
                 </div>

                 {adminTab === 'users' ? (
                    <div>
                       <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
                          <div className="relative w-full sm:w-64">
                             <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                             <input type="text" placeholder="Cari nama atau email..." value={adminSearch} onChange={e => setAdminSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"/>
                          </div>
                          <select value={adminSort} onChange={(e:any) => setAdminSort(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none">
                             <option value="newest">Terakhir Login</option><option value="az">Nama (A-Z)</option>
                          </select>
                       </div>
                       <div className="overflow-x-auto border border-slate-100 rounded-xl">
                          <table className="w-full text-left text-sm min-w-[800px]">
                             <thead className="bg-slate-50 text-slate-600 border-b border-slate-100">
                                <tr>
                                    <th className="p-4 font-bold">Nama</th>
                                    <th className="p-4 font-bold">Email</th>
                                    <th className="p-4 font-bold">Status (Aktif/Login)</th>
                                    {isSuperAdmin && <th className="p-4 font-bold text-center">Hak Akses</th>}
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-50">
                                {filteredAdminUsers.map((u) => {
                                   let actStatus = <span className="text-slate-400 text-xs italic">Belum Aktif</span>;
                                   if (u.lastActivity || u.lastLogin) {
                                      const timestamp = u.lastActivity || u.lastLogin;
                                      const diffDays = Math.floor((new Date().getTime() - timestamp) / (1000 * 60 * 60 * 24));
                                      if (diffDays > 2) {
                                          actStatus = <span className="text-red-600 font-medium text-[11px]"><span className="font-bold">⚠️ Pasif {diffDays} Hari</span><br/><span className="text-[9px]">{formatLastLogin(timestamp)}</span></span>;
                                      } else {
                                          actStatus = <span className="text-green-600 font-medium text-[11px]"><span className="font-bold">🟢 Aktif</span><br/><span className="text-[9px]">{formatLastLogin(timestamp)}</span></span>;
                                      }
                                   }
                                   return (
                                   <tr key={u.id} className="hover:bg-slate-50/50">
                                      <td className="p-4 font-bold text-slate-800">{u.displayName || 'Anonim'}</td>
                                      <td className="p-4 text-slate-500 text-xs">{u.email || '-'}</td>
                                      <td className="p-4">{actStatus}</td>
                                      {isSuperAdmin && (
                                         <td className="p-4 text-center">
                                            <button 
                                                onClick={() => setRoleConfirmModal({show:true, targetUser:u, makeAdmin: u.role!=='admin'})} 
                                                disabled={u.email === 'coachardi1453@gmail.com'} 
                                                className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-colors ${u.role === 'admin' ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                            >
                                                {u.role === 'admin' ? 'Admin' : 'User'}
                                            </button>
                                         </td>
                                      )}
                                   </tr>
                                )})}
                             </tbody>
                          </table>
                       </div>
                    </div>
                 ) : adminTab === 'communities' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                          <h3 className="font-bold text-slate-800 mb-4">{editCommId ? 'Edit Komunitas' : 'Buat Komunitas Baru'}</h3>
                          <input type="text" placeholder="Nama Komunitas (Cth: Tim Sales MIP)" value={newCommName} onChange={e => setNewCommName(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-3 mb-4 text-sm focus:border-blue-500 outline-none font-bold" />
                          <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Pilih & Atur Jam</p>
                          <div className="space-y-2 h-[350px] overflow-y-auto bg-white p-3 rounded-xl border border-slate-200 mb-4">
                             {globalActivities.map(act => {
                                const isSel = selectedActs.find(a => a.id === act.docId);
                                return (
                                <div key={act.docId} className={`flex items-center justify-between p-2 rounded-lg border ${isSel ? 'bg-blue-50 border-blue-200' : 'border-transparent hover:bg-slate-50'}`}>
                                   <label className="flex items-center gap-3 cursor-pointer flex-1">
                                      <input type="checkbox" checked={!!isSel} onChange={() => { if(isSel) setSelectedActs(selectedActs.filter(a=>a.id!==act.docId)); else setSelectedActs([...selectedActs, {id:act.docId, time:act.time}]); }} className="w-4 h-4 rounded text-blue-600" />
                                      <span className="text-sm font-semibold text-slate-700">{act.name}</span>
                                   </label>
                                   {isSel && <input type="time" value={isSel.time} onChange={(e) => setSelectedActs(selectedActs.map(a => a.id===act.docId ? {...a, time:e.target.value} : a))} className="bg-white border border-blue-200 text-xs px-2 py-1 rounded outline-none text-blue-700 font-bold" />}
                                </div>
                             )})}
                          </div>
                          <div className="flex gap-2">
                             {editCommId && <button onClick={()=>{setEditCommId(null); setNewCommName(''); setSelectedActs([]);}} className="px-4 bg-slate-200 text-slate-600 font-bold rounded-xl">Batal</button>}
                             <button onClick={handleSaveCommunity} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 shadow-md">{editCommId ? 'Simpan Perubahan' : 'Buat Komunitas'}</button>
                          </div>
                       </div>
                       <div>
                          <h3 className="font-bold text-slate-800 mb-4">Komunitas Buatan Anda</h3>
                          <div className="space-y-3">
                             {allCommunities.filter(c => c.ownerId === user.uid).map(c => (
                                <div key={c.id} className="bg-white border-2 border-dashed border-slate-200 p-4 rounded-xl flex items-center justify-between group">
                                   <div>
                                      <p className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                          {c.name} 
                                         <button onClick={()=>{setEditCommId(c.id); setNewCommName(c.name); setSelectedActs(c.activities||[]); setAdminTab('communities');}} className="text-blue-500"><Edit3 size={14}/></button>
                                         <button onClick={()=>handleDeleteCommunity(c.id)} className="text-red-500"><Trash2 size={14}/></button>
                                      </p>
                                      <p className="text-[10px] text-slate-400 font-bold uppercase">{c.activities?.length || 0} Aktivitas</p>
                                   </div>
                                   <div className="text-right">
                                      <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Kode Join</p>
                                      <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                                         <span className="font-black text-blue-700 tracking-widest">{c.joinCode}</span>
                                         <button onClick={()=>{navigator.clipboard.writeText(c.joinCode); showToast("Disalin!");}} className="text-blue-400 hover:text-blue-600"><Copy size={14}/></button>
                                      </div>
                                   </div>
                                </div>
                             ))}
                          </div>
                       </div>
                    </div>
                 ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100">
                          <h3 className="font-bold text-orange-800 mb-4">Tambah Master Ibadah Global</h3>
                          <input type="text" placeholder="Nama Ibadah" value={newGlobalAct.name} onChange={e => setNewGlobalAct({...newGlobalAct, name: e.target.value})} className="w-full bg-white border border-orange-200 rounded-xl p-3 mb-4 text-sm outline-none" />
                          <input type="time" value={newGlobalAct.time} onChange={e => setNewGlobalAct({...newGlobalAct, time: e.target.value})} className="w-full bg-white border border-orange-200 rounded-xl p-3 mb-4 text-sm outline-none" />
                          <button onClick={handleAddGlobalActivity} className="w-full bg-orange-600 text-white font-bold py-3 rounded-xl hover:bg-orange-700 shadow-md">Tambahkan Global</button>
                       </div>
                       <div>
                          <h3 className="font-bold text-slate-800 mb-4">Daftar Global ({globalActivities.length})</h3>
                          <div className="space-y-2 h-[350px] overflow-y-auto pr-2">
                             {globalActivities.map(act => (
                                <div key={act.docId} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-lg">
                                   <span className="font-semibold text-slate-700 text-sm">{act.name}</span>
                                   <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded">{act.time}</span>
                                </div>
                             ))}
                          </div>
                       </div>
                    </div>
                 )}
              </div>
           </div>
        )}

        {/* ================= TOMBOL SIMPAN MELAYANG ================= */}
        {hasUnsavedChanges && (
           <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] w-full px-4 sm:w-auto sm:px-0 pointer-events-none">
              <button onClick={() => saveToServer(false)} disabled={isSaving} className="w-full pointer-events-auto sm:w-auto bg-orange-600 text-white px-8 py-3.5 rounded-full font-bold flex items-center justify-center gap-3 shadow-[0_8px_30px_rgba(249,115,22,0.5)] hover:bg-orange-700 hover:-translate-y-1 transition-all animate-bounce">
                  {isSaving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                  {isSaving ? 'Menyimpan...' : 'Simpan Perubahan Anda'}
               </button>
           </div>
        )}

        {/* ================= AREA KONTEN UTAMA ================= */}
        <div className="max-w-7xl mx-auto space-y-8 pb-16">
          
          {/* HEADER DASHBOARD */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 flex flex-row justify-between items-center gap-4 relative overflow-hidden">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full border-2 border-orange-500 flex items-center justify-center shadow-md">
                  <img src="/logo.png" alt="Logo" className="w-[70%] h-[70%] object-contain" />
              </div>
              <div>
                  <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-wide">Tafkir Corp</h1>
                  <p className="text-[9px] sm:text-xs text-orange-600 font-bold uppercase tracking-[0.2em] mt-1">Tracker Ibadah & Hal Positif</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
               <div className="text-right flex flex-col justify-center bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 hidden sm:flex">
                 <div className="text-sm font-semibold text-slate-800">{user.displayName?.split(' ')[0]}</div>
                 <div className="text-[10px] font-bold flex justify-end">
                     {isSyncing ? <span className="text-blue-500 flex items-center gap-1"><RefreshCw size={10} className="animate-spin"/> Syncing...</span> : <span className="text-green-600 flex items-center gap-1"><Zap size={10}/> Synchronized</span>}
                 </div>
               </div>
               <button onClick={() => setShowInfoModal(true)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors border border-slate-100"><Info size={18}/></button>
               {isAdmin && ( <button onClick={() => setShowAdminPanel(true)} className="bg-blue-50 text-blue-600 hover:bg-blue-100 p-2 rounded-lg transition-colors border border-blue-100"><Shield size={18}/></button> )}
               <button onClick={handleLogout} className="bg-red-50 text-red-600 hover:bg-red-100 p-2 sm:px-3 sm:py-1.5 rounded-lg transition-colors text-sm font-medium flex items-center gap-1 border border-red-100"><LogOut size={16}/> <span className="hidden sm:block">Keluar</span></button>
            </div>
          </div>

          {/* ================= MAIN TABLE HISAB ================= */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden relative">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col items-center gap-4">
               
               {/* 3 BADGE PROGRESS */}
               <div className="w-full flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-4 mb-2">
                  <div className="flex gap-2">
                     <span className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 shadow-sm">👤 Pribadi: <span className="text-blue-600">{stats.scorePribadi}%</span></span>
                  </div>
                  <div className={`px-5 py-2 rounded-xl text-lg font-black shadow-sm border text-center ${stats.scoreGabungan >= 50 ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white border-green-600' : 'bg-gradient-to-r from-orange-500 to-red-500 text-white border-orange-600'}`}>
                     Total Gabungan: {stats.scoreGabungan}%
                  </div>
                  <div className="flex gap-2">
                     <span className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 shadow-sm">👥 Komunitas: <span className="text-purple-600">{stats.scoreKomunitas}%</span></span>
                  </div>
               </div>

               <div className="flex flex-col md:flex-row justify-between w-full gap-4 items-center">
                  <div className="flex flex-col items-start gap-2 w-full md:w-auto">
                     <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-orange-500"></span> Tabel Hisab 
                        </h2>
                        {/* TOMBOL UX DI ATAS */}
                        <button onClick={() => setActModal({ show: true, mode: 'add', id: null, name: '', time: '00:00' })} className="bg-blue-50 border border-blue-200 px-2 py-1 rounded text-[10px] font-bold text-blue-600 hover:bg-blue-100 flex items-center gap-1"><Plus size={14}/> Buat Sendiri</button>
                        <button onClick={() => setShowJoinModal(true)} className="bg-purple-50 border border-purple-200 px-2 py-1 rounded text-[10px] font-bold text-purple-600 hover:bg-purple-100 flex items-center gap-1"><KeyRound size={12}/> Gabung Grup</button>
                     </div>
                     {joinedCommunityNames && (
                         <p className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1"><Users size={12}/> Komunitas Anda: {joinedCommunityNames}</p>
                     )}
                  </div>
                  
                  <div className="flex items-center gap-2 sm:gap-4 bg-white border border-slate-200 px-2 py-1 rounded-lg shadow-sm">
                     <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ChevronLeft size={20}/></button>
                     <div className="w-32 sm:w-40 text-center font-bold text-slate-700 text-sm sm:text-base">
                         {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
                     </div>
                     <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ChevronRight size={20}/></button>
                     <button onClick={scrollToToday} className="flex items-center gap-1 bg-orange-50 text-orange-600 px-2 sm:px-3 py-1.5 rounded text-[10px] sm:text-xs font-bold hover:bg-orange-100 border border-orange-200 border-l-2 border-l-orange-400">👉 HARI INI</button>
                  </div>
               </div>
            </div>
            
            <div className="overflow-x-auto pb-4" ref={tableContainerRef}>
              <table className="w-full text-sm">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="text-left text-slate-700 font-bold p-3 sticky left-0 bg-slate-100 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[180px] sm:min-w-[280px]">
                        Ibadah & Aktivitas Positif KU
                    </th>
                    {daysInMonth.map(d => {
                      const isActToday = getLocalDateStr(d) === getLocalDateStr(new Date());
                      return (
                         <th key={d.toISOString()} ref={isActToday ? todayColumnRef : null} className={`p-2 text-center font-semibold min-w-[44px] ${isActToday ? 'bg-orange-100 text-orange-700 border-b-2 border-orange-500' : 'text-slate-600'}`}>
                            <div className="flex flex-col items-center">
                               {/* NAMA HARI DI ATAS TANGGAL */}
                               <span className={`text-[8px] uppercase tracking-widest mb-0.5 ${isActToday ? 'font-black' : 'font-medium'}`}>{isActToday ? 'Hari Ini' : getDayName(d)}</span>
                               <span className="text-base">{d.getDate()}</span>
                            </div>
                         </th>
                      )
                    })}
                  </tr>
                </thead>
                
                {/* ================= BODY KOMITMEN PRIBADI ================= */}
                <tbody>
                  <tr>
                     <td colSpan={daysInMonth.length + 1} className="bg-blue-50 border-y border-blue-100 p-2 sticky left-0 z-10">
                         <span className="font-bold text-blue-800 text-xs uppercase tracking-widest pl-2">Komitmen Pribadi</span>
                     </td>
                  </tr>
                  {formattedPersonalActivities.map((act) => {
                     const isSafe = getDailyEvaluation(act.id);
                     return (
                    <tr key={act.id} className="bg-white hover:bg-orange-50/50 border-b border-slate-50">
                      <td className="p-2 font-medium sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] bg-white">
                        <div className="flex items-center gap-2">
                           <div className="flex flex-col gap-1">
                               <button onClick={() => setActModal({ show:true, mode:'edit', id:act.id, name:act.name, time:act.time })} className="text-slate-400 hover:text-blue-600"><Edit3 size={14}/></button>
                               <button onClick={() => deleteActivity(act.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={14}/></button>
                           </div>
                           <div className="flex flex-col items-start min-w-0">
                              <div className="flex items-center gap-1">
                                  <span className={`text-xs font-bold truncate ${!isSafe ? 'text-red-600' : 'text-slate-700'}`}>{act.name}</span>
                                  {!isSafe && (
                                      <div className="relative group/alert cursor-help">
                                          <AlertTriangle size={12} className="text-red-500" />
                                          <div className="absolute hidden group-hover/alert:block bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 bg-slate-900 text-white text-[9px] text-center p-2 rounded shadow-xl z-50 pointer-events-none">Pelaksanaan di bawah 50%</div>
                                      </div>
                                  )}
                              </div>
                              <span className="text-[9px] text-blue-600 font-bold bg-blue-50 border border-blue-100 px-1.5 rounded mt-1">{act.time}</span>
                           </div>
                        </div>
                      </td>
                      {daysInMonth.map(d => {
                        const rec = records[`${getLocalDateStr(d)}-${act.id}`];
                        return (
                          <td key={`${d}-${act.id}`} className="p-1 text-center relative group cursor-pointer border-r border-slate-50" onClick={() => handleRecord(d, act.id, act.time, rec?.status)}>
                            {rec?.status === 'done' ? <div className="w-6 h-6 mx-auto bg-green-100 rounded flex items-center justify-center"><Check className="text-green-600" size={14} /></div>
                            : rec?.status === 'missed' ? <div className="w-6 h-6 mx-auto bg-red-100 rounded flex items-center justify-center"><X className="text-red-600" size={14} /></div>
                            : <div className="w-6 h-6 mx-auto rounded bg-slate-50 border hover:border-orange-300" />}
                            
                            {rec && (
                                <div className="absolute hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-[10px] p-2 rounded shadow-xl w-max z-30 pointer-events-none">
                                    <p className="font-semibold">{act.name}</p>
                                    <p className="text-slate-300">Isi: {new Date(rec.timestamp).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</p>
                                    <p>{getIsOnTime(rec.timestamp, d, act.time) ? <span className="text-green-400 font-bold">TEPAT WAKTU</span> : <span className="text-orange-400 font-bold">RAPELAN</span>}</p>
                                </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )})}
                  <tr className="bg-blue-50/30 border-t border-blue-100">
                    <td className="p-2 text-right font-bold text-blue-800 sticky left-0 z-20 bg-blue-50/90 text-[10px] uppercase">Ketercapaian Pribadi:</td>
                    {daysInMonth.map(d => (
                        <td key={d.toISOString()} className="p-2 text-center font-bold text-blue-700 text-[10px]">{getSubDailyPct(d, formattedPersonalActivities)}</td>
                    ))}
                  </tr>
                </tbody>

                {/* ================= BODY KOMITMEN KOMUNITAS ================= */}
                <tbody>
                  <tr>
                     <td colSpan={daysInMonth.length + 1} className="bg-purple-50 border-y border-purple-100 p-2 sticky left-0 z-10">
                         <span className="font-bold text-purple-800 text-xs uppercase tracking-widest pl-2">Komitmen Komunitas</span>
                     </td>
                  </tr>
                  {communityActivities.length === 0 && (
                     <tr><td colSpan={daysInMonth.length + 1} className="p-4 text-center text-slate-400 italic text-xs bg-slate-50/50">Anda belum bergabung di komunitas manapun.</td></tr>
                  )}
                  {communityActivities.map((act: any) => {
                     const isSafe = getDailyEvaluation(act.id);
                     return (
                    <tr key={act.id} className="bg-slate-50/50 hover:bg-orange-50/50 border-b border-slate-100">
                      <td className="p-2 font-medium sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] bg-[#f8fafc]">
                        <div className="flex items-center gap-2 pl-2">
                           <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1">
                                  <span className={`text-xs font-bold truncate ${!isSafe ? 'text-red-600' : 'text-slate-800'}`}>{act.name}</span>
                                  {!isSafe && (
                                      <div className="relative group/alert cursor-help">
                                          <AlertTriangle size={12} className="text-red-500" />
                                          <div className="absolute hidden group-hover/alert:block bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 bg-slate-900 text-white text-[9px] text-center p-2 rounded shadow-xl z-50 pointer-events-none">Pelaksanaan di bawah 50%</div>
                                      </div>
                                  )}
                              </div>
                              <span className="text-[9px] text-purple-600 font-bold bg-purple-100 px-1.5 rounded mt-1 mb-0.5 flex items-center gap-1 w-max"><Clock size={10}/> {act.time}</span>
                              <span className="text-[8px] text-slate-500 uppercase font-semibold flex items-center gap-1 truncate w-[150px]"><Users size={10} className="shrink-0"/> {act.communities.join(', ')}</span>
                           </div>
                        </div>
                      </td>
                      {daysInMonth.map(d => {
                        const rec = records[`${getLocalDateStr(d)}-${act.id}`];
                        return (
                          <td key={`${d}-${act.id}`} className="p-1 text-center relative group cursor-pointer border-r border-slate-100/50" onClick={() => handleRecord(d, act.id, act.time, rec?.status)}>
                            {rec?.status === 'done' ? <div className="w-6 h-6 mx-auto bg-green-100 rounded flex items-center justify-center"><Check className="text-green-600" size={14} /></div>
                            : rec?.status === 'missed' ? <div className="w-6 h-6 mx-auto bg-red-100 rounded flex items-center justify-center"><X className="text-red-600" size={14} /></div>
                            : <div className="w-6 h-6 mx-auto rounded bg-white border hover:border-orange-300" />}
                            
                            {rec && (
                                <div className="absolute hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-[10px] p-2 rounded shadow-xl w-max z-30 pointer-events-none">
                                    <p className="font-semibold">{act.name}</p>
                                    <p className="text-slate-300">Isi: {new Date(rec.timestamp).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</p>
                                    <p>{getIsOnTime(rec.timestamp, d, act.time) ? <span className="text-green-400 font-bold">TEPAT WAKTU</span> : <span className="text-orange-400 font-bold">RAPELAN</span>}</p>
                                </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )})}
                  <tr className="bg-purple-50/30 border-t border-purple-100">
                    <td className="p-2 text-right font-bold text-purple-800 sticky left-0 z-20 bg-purple-50/90 text-[10px] uppercase">Ketercapaian Komunitas:</td>
                    {daysInMonth.map(d => (
                        <td key={d.toISOString()} className="p-2 text-center font-bold text-purple-700 text-[10px]">{getSubDailyPct(d, communityActivities)}</td>
                    ))}
                  </tr>
                </tbody>

                {/* ================= FOOTER GABUNGAN ================= */}
                <tfoot>
                  <tr className="bg-slate-200 border-t-2 border-slate-300">
                    <td className="p-3 sm:p-4 text-right font-black text-slate-800 sticky left-0 z-20 bg-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-xs sm:text-sm uppercase tracking-widest">Ketercapaian Gabungan:</td>
                    {daysInMonth.map(d => (
                        <td key={d.toISOString()} className="p-2 text-center font-black text-slate-800 border-r border-slate-300 text-xs sm:text-sm">{getDailyPercentage(d)}</td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ================= GAMIFIKASI ================= */}
          {joinedCommunityIds.length > 0 && (
             <div className="space-y-6">
                <h2 className="text-xl font-bold text-slate-800 border-l-4 border-yellow-500 pl-4">Leaderboard Komunitas</h2>
                {joinedCommunityIds.map(commId => {
                   const comm = allCommunities.find(c => c.id === commId); 
                   if (!comm) return null;
                   
                   const activeTab = leaderboardTabs[commId] || 'monthly';
                   let sKey = `score_${String(currentDate.getMonth() + 1).padStart(2, '0')}-${currentDate.getFullYear()}_comm_${commId}`;
                   const boardData = allUsers.map(u => ({ name: u.displayName || 'Anonim', score: u[sKey] || 0 })).filter(u => u.score > 0).sort((a,b) => b.score - a.score).slice(0, 5);

                   return (
                   <div key={commId} className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-xl p-6 border border-slate-700 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-48 h-48 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"></div>
                      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-slate-700 pb-4">
                         <h3 className="text-xl font-black text-white flex items-center gap-2"><Medal className="text-yellow-400" size={24}/> {comm.name}</h3>
                         <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-600 shadow-inner">
                            <button onClick={()=>setLeaderboardTabs({...leaderboardTabs, [commId]: 'yesterday'})} className={`px-4 py-2 text-xs font-bold rounded-lg ${activeTab==='yesterday' ? 'bg-yellow-500 text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}>Kemarin</button>
                            <button onClick={()=>setLeaderboardTabs({...leaderboardTabs, [commId]: 'weekly'})} className={`px-4 py-2 text-xs font-bold rounded-lg ${activeTab==='weekly' ? 'bg-yellow-500 text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}>Pekan Ini</button>
                            <button onClick={()=>setLeaderboardTabs({...leaderboardTabs, [commId]: 'monthly'})} className={`px-4 py-2 text-xs font-bold rounded-lg ${activeTab==='monthly' ? 'bg-yellow-500 text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}>Bulan Ini</button>
                         </div>
                      </div>
                      <div className="relative z-10">
                         {boardData.length === 0 ? <div className="text-center py-6 text-slate-500 text-sm font-medium italic border-2 border-dashed border-slate-700 rounded-xl">Belum ada kompetisi.</div> : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                               {boardData.map((usr, idx) => (
                                  <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border ${idx === 0 ? 'bg-gradient-to-r from-yellow-500/20 border-yellow-500/30' : idx === 1 ? 'bg-gradient-to-r from-slate-300/10 border-slate-400/20' : idx === 2 ? 'bg-gradient-to-r from-orange-600/20 border-orange-500/20' : 'bg-white/5 border-white/10'}`}>
                                     <div className="flex items-center gap-3">
                                         <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shadow-md ${idx === 0 ? 'bg-yellow-400 text-yellow-900' : idx === 1 ? 'bg-slate-300 text-slate-800' : idx === 2 ? 'bg-orange-400 text-orange-900' : 'bg-slate-800 text-slate-400'}`}>{idx + 1}</div>
                                         <span className={`font-bold text-sm truncate max-w-[150px] ${idx === 0 ? 'text-yellow-400' : 'text-slate-200'}`}>{usr.name}</span>
                                     </div>
                                     <span className={`text-xl font-black ${idx === 0 ? 'text-yellow-400' : 'text-white'}`}>{usr.score}%</span>
                                  </div>
                               ))}
                            </div>
                         )}
                      </div>
                   </div>
                )})}
             </div>
          )}

          {/* ================= JURNAL ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 border-b border-slate-100 pb-4">
                 <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-500 shrink-0"></span> Arsip Jurnal</h3>
                 <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-32">
                        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" placeholder="Cari..." value={journalSearch} onChange={e => setJournalSearch(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-2 py-1.5 text-xs outline-none" />
                    </div>
                    <select value={journalSort} onChange={(e: any) => setJournalSort(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none">
                        <option value="newest">Terbaru</option><option value="oldest">Terlama</option><option value="az">A - Z</option><option value="za">Z - A</option>
                    </select>
                 </div>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-2">
                {filteredAndSortedJournals.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">Kosong.</p> : filteredAndSortedJournals.map(j => (
                  <div key={j.id} className="bg-slate-50 p-3 rounded-xl border flex justify-between items-start group hover:border-orange-300 transition-colors">
                    <div className="truncate pr-2">
                        <p className="font-bold text-slate-700 truncate">{j.title}</p>
                        <p className="text-xs text-slate-500 mt-1">{new Date(j.date).toLocaleDateString('id-ID')}</p>
                    </div>
                    <div className="flex gap-2 opacity-50 group-hover:opacity-100">
                        <button onClick={() => { setActiveJournal(j); setIsViewModalOpen(true); }} className="text-blue-600"><Eye size={16} /></button>
                        <button onClick={() => { setActiveJournal(j); setJournalInput({title: j.title, content: j.content}); setIsViewModalOpen(false); }} className="text-orange-600"><Edit3 size={16} /></button>
                        <button onClick={() => { setJournals(journals.filter(x => x.id !== j.id)); setHasUnsavedChanges(true); }} className="text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2"><span className="w-3 h-3 rounded-full bg-orange-500"></span> {activeJournal && !isViewModalOpen ? 'Edit Jurnal' : 'Tulis Jurnal Baru'}</h3>
              <input type="text" placeholder="Judul Jurnal..." value={journalInput.title} onChange={e => setJournalInput({...journalInput, title: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-slate-800 outline-none font-medium" />
              <textarea placeholder="Tuliskan evaluasi, syukur, atau doa..." value={journalInput.content} onChange={e => setJournalInput({...journalInput, content: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 h-40 text-slate-800 outline-none resize-none mb-4" />
              <div className="flex justify-end">
                  <button onClick={saveJournal} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl hover:bg-slate-900 font-bold shadow-md flex items-center gap-2"><Check size={18}/> Draf Jurnal</button>
              </div>
            </div>
          </div>

          {/* ================= MASTER CHARTS & ANALYTICS ================= */}
          <div ref={chartRef} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
               <div>
                   <h2 className="text-xl font-bold text-slate-800 border-l-4 border-orange-500 pl-4">Dashboard Analisa Eksekutif</h2>
                   <p className="text-sm text-slate-500 mt-2 pl-4 font-medium">Laporan: <span className="font-bold text-slate-700">{user.displayName}</span></p>
               </div>
               <button data-html2canvas-ignore="true" onClick={exportChart} className="flex items-center gap-2 bg-orange-50 text-orange-600 px-4 py-2 rounded-xl text-sm font-bold border border-orange-200"><Download size={16} /> Ekspor Laporan</button>
            </div>
            
            {/* --- CHART 3 GARIS --- */}
            <div className="w-full h-80 mb-8 bg-slate-50 rounded-xl p-4 border border-slate-100">
               <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={mainChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                     <XAxis dataKey="tgl" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                     <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                     <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} labelFormatter={(l) => `Tanggal ${l}`} />
                     <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}/>
                     
                     <Area type="monotone" dataKey="gab" name="Gabungan" stroke="#f97316" strokeWidth={3} fill="#f97316" fillOpacity={0.1} />
                     <Line type="monotone" dataKey="pri" name="Pribadi" stroke="#3b82f6" strokeWidth={2} dot={false} />
                     <Line type="monotone" dataKey="kom" name="Komunitas" stroke="#a855f7" strokeWidth={2} dot={false} />
                     
                     <Line type="linear" dataKey="t_gab" name="Trend Gab" stroke="#ea580c" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={false} />
                  </ComposedChart>
               </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
               {/* --- BEDAH KUANTITAS --- */}
               <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                  <h3 className="text-slate-700 font-bold mb-4 text-center">Bedah Kuantitas Gabungan</h3>
                  <div className="flex justify-between items-center mb-2 px-2">
                     <span className="text-sm font-bold">Total Selesai: <span className="text-green-600">{stats.qtyGabungan.done}</span></span>
                     <span className="text-sm font-bold">Total Terlewat: <span className="text-red-500">{stats.qtyGabungan.missed}</span></span>
                  </div>
                  <div className="h-3 w-full bg-red-400 rounded-full overflow-hidden mb-6 flex">
                     <div className="h-full bg-green-500" style={{ width: `${stats.qtyGabungan.done + stats.qtyGabungan.missed === 0 ? 0 : (stats.qtyGabungan.done / (stats.qtyGabungan.done + stats.qtyGabungan.missed))*100}%` }}></div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-white p-3 rounded-xl border">
                        <p className="text-[10px] font-bold text-blue-600 uppercase mb-2">👤 Pribadi</p>
                        <p className="text-xs">Selesai: <b>{stats.qty.p_done}</b></p>
                        <p className="text-xs">Terlewat: <b>{stats.qty.p_miss}</b></p>
                        <div className="mt-2 pt-2 border-t text-[10px]">
                           <p className="truncate text-green-600">🥇 {stats.topPribadi ? `${stats.topPribadi.name} (${stats.topPribadi.done}x)` : '-'}</p>
                           <p className="truncate text-red-500 mt-1">📉 {stats.botPribadi ? `${stats.botPribadi.name} (${stats.botPribadi.done}x)` : '-'}</p>
                        </div>
                     </div>
                     <div className="bg-white p-3 rounded-xl border">
                        <p className="text-[10px] font-bold text-purple-600 uppercase mb-2">👥 Komunitas</p>
                        <p className="text-xs">Selesai: <b>{stats.qty.c_done}</b></p>
                        <p className="text-xs">Terlewat: <b>{stats.qty.c_miss}</b></p>
                        <div className="mt-2 pt-2 border-t text-[10px]">
                           <p className="truncate text-green-600">🥇 {stats.topComm ? `${stats.topComm.name} (${stats.topComm.done}x)` : '-'}</p>
                           <p className="truncate text-red-500 mt-1">📉 {stats.botComm ? `${stats.botComm.name} (${stats.botComm.done}x)` : '-'}</p>
                        </div>
                     </div>
                  </div>
               </div>

               {/* --- BEDAH DISIPLIN --- */}
               <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                  <h3 className="text-slate-700 font-bold mb-4 text-center">Bedah Disiplin Pelaporan</h3>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm">
                        <p className="text-[10px] text-blue-600 font-bold uppercase mb-2 text-center">⏱️ Top Tepat Waktu</p>
                        <div className="space-y-1">
                           {stats.topOnTime.length ? stats.topOnTime.map((a,i) => (
                              <div key={i} className="flex justify-between text-[10px]">
                                  <span className="truncate font-semibold text-slate-700">{i+1}. {a.name}</span>
                                  <span className="text-blue-600 font-bold">{Math.round(a.avgDiff)}m</span>
                              </div>
                           )) : <p className="text-xs text-center italic text-slate-400">Belum ada</p>}
                        </div>
                     </div>
                     <div className="bg-white p-3 rounded-xl border border-orange-100 shadow-sm">
                        <p className="text-[10px] text-orange-600 font-bold uppercase mb-2 text-center">⚠️ Top Rapelan</p>
                        <div className="space-y-1">
                           {stats.topLate.length ? stats.topLate.map((a,i) => (
                              <div key={i} className="flex justify-between text-[10px]">
                                  <span className="truncate font-semibold text-slate-700">{i+1}. {a.name}</span>
                                  <span className="text-orange-500 font-bold">{Math.round(a.avgDiff)}m</span>
                              </div>
                           )) : <p className="text-xs text-center italic text-slate-400">Belum ada</p>}
                        </div>
                     </div>
                  </div>
                  <p className="text-[9px] text-slate-400 text-center mt-4">Angka menunjukkan rata-rata selisih waktu (menit) antara target dan laporan.</p>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               {/* --- WEEK TO WEEK CHART --- */}
               <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="text-slate-700 font-bold text-sm">Week to Week</h3>
                     <select value={wtwMonthOffset} onChange={e=>setWtwMonthOffset(Number(e.target.value))} className="text-xs bg-white border border-slate-200 rounded p-1">
                        <option value={0}>Bulan Ini</option>
                        <option value={-1}>Bulan Lalu</option>
                        <option value={-2}>2 Bln Lalu</option>
                     </select>
                  </div>
                  <div className="h-48">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={wtwData} margin={{top:0,right:0,left:-25,bottom:0}}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} />
                           <XAxis dataKey="name" fontSize={10} />
                           <YAxis fontSize={10} domain={[0,100]} tickFormatter={v=>`${v}%`} />
                           <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius:'8px' }} formatter={v=>`${v}%`} />
                           <Bar dataKey="pencapaian" fill="#3b82f6" radius={[4,4,0,0]} />
                        </BarChart>
                     </ResponsiveContainer>
                  </div>
               </div>

               {/* --- MONTH TO MONTH CHART --- */}
               <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="text-slate-700 font-bold text-sm">Month to Month</h3>
                     <select value={mtmRange} onChange={e=>setMtmRange(Number(e.target.value))} className="text-xs bg-white border border-slate-200 rounded p-1">
                        <option value={3}>3 Bln Terakhir</option>
                        <option value={6}>6 Bln Terakhir</option>
                        <option value={12}>1 Tahun</option>
                     </select>
                  </div>
                  <div className="h-48">
                     <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={mtmData} margin={{top:0,right:0,left:-25,bottom:0}}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} />
                           <XAxis dataKey="bln" fontSize={10} />
                           <YAxis fontSize={10} domain={[0,100]} tickFormatter={v=>`${v}%`} />
                           <RechartsTooltip contentStyle={{ borderRadius:'8px' }} formatter={v=>`${v}%`} />
                           <Line type="monotone" dataKey="skor" name="Skor Bulanan" stroke="#10b981" strokeWidth={3} dot={{r:4}} />
                           <Line type="linear" dataKey="trend" name="Trend" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={false} />
                        </ComposedChart>
                     </ResponsiveContainer>
                  </div>
               </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 text-center leading-relaxed">
               <p className="text-slate-500 text-xs font-semibold">© 2026 TafkirCorp. Seluruh hak cipta milik ALLAAH SWT.</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}