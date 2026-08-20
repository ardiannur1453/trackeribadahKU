import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, where, addDoc } from 'firebase/firestore';
import html2canvas from 'html2canvas';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Trash2, Edit3, Eye, Download, LogOut, Check, X, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle, BarChart2, Save, Zap, Plus, Award, AlertOctagon, Search, Shield, Medal, Users, Info, KeyRound, Copy } from 'lucide-react';

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
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatLastLogin = (timestamp: number) => {
   if (!timestamp) return "Belum pernah";
   return new Date(timestamp).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// 12 Aktivitas Baku Komunitas
const STANDARD_ACTIVITIES = [
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

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export default function IbadahTracker() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'user'|'admin'|'superadmin'>('user');
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Data State
  const [personalActivities, setPersonalActivities] = useState<any[]>([]);
  const [joinedCommunityIds, setJoinedCommunityIds] = useState<string[]>([]);
  const [allCommunities, setAllCommunities] = useState<any[]>([]); 
  
  const [records, setRecords] = useState<any>({});
  const [journals, setJournals] = useState<any[]>([]);
  
  // UI States
  const [toast, setToast] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [actModal, setActModal] = useState({ show: false, mode: 'add', id: null as any, name: '', time: '00:00' });
  const [activeJournal, setActiveJournal] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [journalInput, setJournalInput] = useState({ title: '', content: '' });
  const [journalSearch, setJournalSearch] = useState('');
  const [journalSort, setJournalSort] = useState<'newest' | 'oldest' | 'az' | 'za'>('newest');

  // Admin States
  const isSuperAdmin = user?.email === 'coachardi1453@gmail.com';
  const isAdmin = isSuperAdmin || userRole === 'admin';
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState<'users' | 'communities'>('users');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminSort, setAdminSort] = useState<'newest' | 'az'>('newest');
  
  const [newCommName, setNewCommName] = useState('');
  const [selectedActs, setSelectedActs] = useState<string[]>([]);

  // Tadi baris ini yang tidak sengaja terhapus, sekarang sudah kembali!
  const chartRef = useRef<HTMLDivElement>(null);
  
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const todayColumnRef = useRef<HTMLTableCellElement>(null);

  // 1. Inisialisasi Auth & Set Last Login
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
            console.error("Gagal sinkronisasi profil:", e);
         }
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Tarik Data Pribadi
  useEffect(() => {
    if (user) {
      setIsSyncing(true);
      const userRef = doc(db, 'users', user.uid);
      const unsubscribe = onSnapshot(userRef, (docSnap) => {
         if (docSnap.exists()) {
            const data = docSnap.data();
            setPersonalActivities(data.activities || []);
            setRecords(data.records || {});
            setJournals(data.journals || []);
            setJoinedCommunityIds(data.joinedCommunities || []);
            
            if (user.email === 'coachardi1453@gmail.com') setUserRole('superadmin');
            else setUserRole(data.role || 'user');
         }
         setIsSyncing(false);
      });
      return () => unsubscribe();
    }
  }, [user]);

  // 3. Tarik Semua Komunitas
  useEffect(() => {
    if (user) {
      const unsub = onSnapshot(collection(db, 'communities'), (snapshot) => {
         const comms: any[] = [];
         snapshot.forEach(d => comms.push({ id: d.id, ...d.data() }));
         setAllCommunities(comms);
      });
      return () => unsub();
    }
  }, [user]);

  // 4. Tarik Semua User (Khusus Admin/Super Admin)
  useEffect(() => {
    if (isAdmin) {
      const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
         const usersData: any[] = [];
         snapshot.forEach(d => usersData.push({ id: d.id, ...d.data() }));
         setAllUsers(usersData);
      });
      return () => unsub();
    }
  }, [isAdmin]);

  // Auto-Save Trigger
  useEffect(() => {
    if (hasUnsavedChanges && user) {
      const timer = setTimeout(() => saveToServer(true), 5 * 60 * 1000); 
      return () => clearTimeout(timer);
    }
  }, [hasUnsavedChanges, records, journals, personalActivities, joinedCommunityIds]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };
  
  const scrollToToday = () => {
      if (todayColumnRef.current && tableContainerRef.current) {
         const container = tableContainerRef.current;
         const target = todayColumnRef.current;
         container.scrollTo({ left: target.offsetLeft - (container.clientWidth / 2) + (target.clientWidth / 2), behavior: 'smooth' });
      } else { showToast("Bulan ini tidak sedang ditampilkan."); }
  };

  // --- LOGIKA DEDUPLIKASI AKTIVITAS KOMUNITAS ---
  const communityActivities = useMemo(() => {
     let commActsMap: Record<string, { id: string, name: string, time: string, communities: string[] }> = {};
     
     joinedCommunityIds.forEach(commId => {
        const comm = allCommunities.find(c => c.id === commId);
        if (comm && comm.activities) {
           comm.activities.forEach((actId: string) => {
              const stdAct = STANDARD_ACTIVITIES.find(a => a.id === actId);
              if (stdAct) {
                 if (!commActsMap[actId]) {
                    commActsMap[actId] = { ...stdAct, communities: [comm.name] };
                 } else {
                    if (!commActsMap[actId].communities.includes(comm.name)) {
                       commActsMap[actId].communities.push(comm.name);
                    }
                 }
              }
           });
        }
     });
     
     return Object.values(commActsMap).sort((a, b) => a.time.localeCompare(b.time));
  }, [joinedCommunityIds, allCommunities]);

  const allCombinedActivities = useMemo(() => [...personalActivities, ...communityActivities], [personalActivities, communityActivities]);

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));
  }, [currentDate]);

  // --- LOGIKA TEPAT WAKTU VERSI BARU (12:15 & 00:30) ---
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
        showToast(`Belum waktunya! Dibuka pukul ${unlockTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
        return;
    }

    const key = `${getLocalDateStr(day)}-${actId}`;
    let newStatus = 'done';
    if (currentStatus === 'done') newStatus = 'missed';
    if (currentStatus === 'missed') newStatus = 'none';

    let newRecs = { ...records };
    if (newStatus === 'none') { delete newRecs[key]; } 
    else { newRecs[key] = { status: newStatus, timestamp: now.getTime() }; }
    
    setRecords(newRecs);
    setHasUnsavedChanges(true); 
  };

  // MANAJEMEN KOMITMEN PRIBADI SAJA
  const saveActivity = () => {
     if (!actModal.name.trim()) return showToast("Nama aktivitas tidak boleh kosong!");
     let newActs = [...personalActivities];

     if (actModal.mode === 'add') {
        newActs.push({ id: Date.now().toString(), name: actModal.name, time: actModal.time });
     } else {
        newActs = newActs.map(a => String(a.id) === String(actModal.id) ? { ...a, name: actModal.name, time: actModal.time } : a);
     }
     newActs.sort((a, b) => a.time.localeCompare(b.time));

     setPersonalActivities(newActs);
     setHasUnsavedChanges(true);
     setActModal({ show: false, mode: 'add', id: null, name: '', time: '00:00' });
     showToast(`Aktivitas berhasil ${actModal.mode === 'add' ? 'ditambahkan' : 'diperbarui'}. Klik Simpan Perubahan.`);
  };

  const deleteActivity = (id: any) => {
     if (window.confirm("Yakin ingin menghapus aktivitas ini dari tabel?")) {
        setPersonalActivities(personalActivities.filter(a => String(a.id) !== String(id)));
        setHasUnsavedChanges(true);
        showToast("Aktivitas dihapus sementara. Klik Simpan Perubahan ke Server.");
     }
  };

  // --- KALKULASI PROGRES BERINGKAT & KOSONG = MINUS (DISEMBUHKAN) ---
  const calcStats = () => {
    const today = new Date();
    
    const calculateScore = (actArray: any[]) => {
       let expected = 0; let done = 0;
       daysInMonth.forEach(d => {
          const dateStr = getLocalDateStr(d);
          actArray.forEach(a => {
             const [h, m] = a.time.split(':').map(Number);
             const targetTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
             
             if (today.getTime() >= targetTime.getTime() + 60000) {
                expected++;
                if (records[`${dateStr}-${a.id}`]?.status === 'done') done++;
             }
          });
       });
       return expected === 0 ? 0 : Math.round((done / expected) * 100);
    };

    const scorePribadi = personalActivities.length ? calculateScore(personalActivities) : 0;
    
    let totalCommScore = 0;
    let activeComms = 0;
    const communityScoresDetail: Record<string, number> = {};
    
    joinedCommunityIds.forEach(commId => {
       const comm = allCommunities.find(c => c.id === commId);
       if (comm && comm.activities && comm.activities.length > 0) {
          const acts = comm.activities.map((actId: string) => STANDARD_ACTIVITIES.find(a => a.id === actId)).filter(Boolean);
          const score = calculateScore(acts);
          communityScoresDetail[commId] = score;
          totalCommScore += score;
          activeComms++;
       }
    });

    const scoreKomunitas = activeComms > 0 ? Math.round(totalCommScore / activeComms) : 0;
    
    let scoreGabungan = 0;
    if (personalActivities.length > 0 && activeComms > 0) scoreGabungan = Math.round((scorePribadi + scoreKomunitas) / 2);
    else if (personalActivities.length > 0) scoreGabungan = scorePribadi;
    else if (activeComms > 0) scoreGabungan = scoreKomunitas;

    // Disiplin Waktu (Untuk Grafik & Statistik Bawah)
    let totalDone = 0; let totalMissed = 0;
    let onTimeCount = 0; let lateCount = 0;
    const actData: Record<string, { done: number, missed: number, onTime: number, late: number }> = {};
    const weeklyStats = [ { expected: 0, done: 0 }, { expected: 0, done: 0 }, { expected: 0, done: 0 }, { expected: 0, done: 0 }, { expected: 0, done: 0 } ];

    allCombinedActivities.forEach(a => actData[String(a.id)] = { done: 0, missed: 0, onTime: 0, late: 0 });

    daysInMonth.forEach(d => {
       const wIdx = Math.floor((d.getDate() - 1) / 7);
       const dateStr = getLocalDateStr(d);
       
       allCombinedActivities.forEach(a => {
          const actIdStr = String(a.id);
          const [h, m] = a.time.split(':').map(Number);
          const targetTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
          
          if (today.getTime() >= targetTime.getTime() + 60000) {
             weeklyStats[wIdx].expected++;
             const rec = records[`${dateStr}-${actIdStr}`];
             
             if (rec) {
                if (rec.status === 'done') {
                   totalDone++;
                   weeklyStats[wIdx].done++;
                   if(actData[actIdStr]) actData[actIdStr].done++;
                   
                   if (getIsOnTime(rec.timestamp, d, a.time)) {
                       onTimeCount++;
                       if(actData[actIdStr]) actData[actIdStr].onTime++;
                   } else {
                       lateCount++;
                       if(actData[actIdStr]) actData[actIdStr].late++;
                   }
                } else {
                   totalMissed++;
                   if(actData[actIdStr]) actData[actIdStr].missed++;
                }
             } else {
                totalMissed++; 
                if(actData[actIdStr]) actData[actIdStr].missed++;
             }
          }
       });
    });

    const totalFilled = totalDone + totalMissed;
    const donePercent = totalFilled ? Math.round((totalDone / totalFilled) * 100) : 0;

    let sortedFreq = allCombinedActivities.map(a => ({ name: a.name, ...actData[String(a.id)] })).filter(a => (a.done + a.missed) > 0);
    let top3Freq = [...sortedFreq].sort((a,b) => b.done - a.done).slice(0, 3);
    let top3Missed = [...sortedFreq].sort((a,b) => b.missed - a.missed).slice(0, 3);

    let sortedDiscip = allCombinedActivities.map(a => {
       const stat = actData[String(a.id)];
       return { 
           name: a.name, done: stat.done,
           onTimePct: stat.done > 0 ? (stat.onTime / stat.done) * 100 : 0, 
           latePct: stat.done > 0 ? (stat.late / stat.done) * 100 : 0 
       };
    }).filter(a => a.done > 0);
    
    let top3OnTime = [...sortedDiscip].sort((a,b) => b.onTimePct - a.onTimePct).slice(0, 3);
    let top3Late = [...sortedDiscip].sort((a,b) => b.latePct - a.latePct).slice(0, 3);

    return { scorePribadi, scoreKomunitas, scoreGabungan, communityScoresDetail, totalDone, totalMissed, donePercent, weeklyStats, top3Freq, top3Missed, top3OnTime, top3Late };
  };

  const stats = calcStats();

  const getDailyPercentage = (day: Date) => {
     const today = new Date();
     const dateStr = getLocalDateStr(day);
     let expected = 0; let done = 0;

     allCombinedActivities.forEach(a => {
        const [h, m] = a.time.split(':').map(Number);
        const targetTime = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
        if (today.getTime() >= targetTime.getTime() + 60000) {
           expected++;
           if (records[`${dateStr}-${a.id}`]?.status === 'done') done++;
        }
     });

     if (expected === 0) return "-";
     return `${Math.round((done / expected) * 100)}%`;
  };

  const saveToServer = async (isAutoSave = false) => {
    if (!user) return;
    setIsSaving(true);
    
    const monthKey = `${String(currentDate.getMonth() + 1).padStart(2, '0')}-${currentDate.getFullYear()}`;
    const payload: any = { 
       activities: personalActivities, 
       records, journals, joinedCommunities: joinedCommunityIds,
       displayName: user.displayName, email: user.email,
       lastActivity: new Date().getTime(),
       [`score_${monthKey}_gabungan`]: stats.scoreGabungan
    };
    
    Object.entries(stats.communityScoresDetail).forEach(([commId, score]) => {
       payload[`score_${monthKey}_comm_${commId}`] = score;
    });
    
    try {
      await setDoc(doc(db, 'users', user.uid), payload, { merge: true });
      setHasUnsavedChanges(false);
      if(!isAutoSave) showToast("Data berhasil disinkronkan ke Server!");
    } catch (error: any) {
      showToast("Tersimpan di antrean lokal. Akan disinkronkan saat online.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- FITUR ADMIN: BUAT KOMUNITAS & KODE JOIN ---
  const handleCreateCommunity = async () => {
     if (!newCommName.trim() || selectedActs.length === 0) return showToast("Nama dan minimal 1 aktivitas harus diisi!");
     const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
     try {
        await addDoc(collection(db, 'communities'), {
           name: newCommName,
           ownerId: user.uid,
           activities: selectedActs,
           joinCode: joinCode,
           createdAt: new Date().getTime()
        });
        setNewCommName(''); setSelectedActs([]);
        showToast(`Komunitas dibuat! Kode Join: ${joinCode}`);
     } catch (e) { showToast("Gagal membuat komunitas."); }
  };

  const handleJoinCommunity = async () => {
     const code = joinCodeInput.trim().toUpperCase();
     const comm = allCommunities.find(c => c.joinCode === code);
     if (!comm) return showToast("Kode Komunitas tidak valid!");
     if (joinedCommunityIds.includes(comm.id)) return showToast("Anda sudah berada di komunitas ini.");
     
     const newJoined = [...joinedCommunityIds, comm.id];
     setJoinedCommunityIds(newJoined);
     setHasUnsavedChanges(true);
     setShowJoinModal(false);
     setJoinCodeInput('');
     showToast(`Berhasil bergabung dengan ${comm.name}! Klik Simpan Perubahan.`);
  };

  // --- FILTER & SORT ADMIN USERS ---
  const filteredAdminUsers = useMemo(() => {
     let result = allUsers;
     if (userRole === 'admin') {
        const myComms = allCommunities.filter(c => c.ownerId === user.uid).map(c => c.id);
        result = allUsers.filter(u => u.joinedCommunities?.some((id:string) => myComms.includes(id)));
     }
     if (adminSearch) {
        const q = adminSearch.toLowerCase();
        result = result.filter(u => (u.displayName||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q));
     }
     return result.sort((a,b) => {
        if (adminSort === 'newest') return (b.lastLogin || 0) - (a.lastLogin || 0);
        return (a.displayName||'').localeCompare(b.displayName||'');
     });
  }, [allUsers, userRole, allCommunities, user, adminSearch, adminSort]);

  const handleLogout = () => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm("PERINGATAN: Ada perubahan yang belum disimpan ke server! \n\nData Anda mungkin hilang jika pindah perangkat. Yakin ingin keluar sekarang?");
      if (!confirmLeave) return; 
    }
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
      allCombinedActivities.forEach(a => { if (records[`${dateStr}-${a.id}`]?.status === 'done') doneCount++; });
      const pct = allCombinedActivities.length ? Math.round((doneCount / allCombinedActivities.length) * 100) : 0;
      return { x: i + 1, tanggal: d.getDate().toString(), persentase: pct };
    });

    const n = rawData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    rawData.forEach(d => { sumX += d.x; sumY += d.persentase; sumXY += d.x * d.persentase; sumX2 += d.x * d.x; });

    const denominator = (n * sumX2 - sumX * sumX);
    const m = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
    const b = (sumY - m * sumX) / n;

    return rawData.map(d => ({ ...d, trend: Math.max(0, Math.min(100, Math.round(m * d.x + b))) }));
  }, [daysInMonth, records, allCombinedActivities]);


  if (isInitializing) return <div className="fixed inset-0 bg-slate-50 flex items-center justify-center text-orange-500 font-bold z-50">Memuat Sistem Tafkir...</div>;

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
      <div className="min-h-full p-4 md:p-8 relative">
        
        {/* MODAL INFO APP */}
        {showInfoModal && (
           <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
              <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
                 <button onClick={() => setShowInfoModal(false)} className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full"><X size={20}/></button>
                 <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center"><img src="/logo.png" alt="Logo" className="w-8 h-8" /></div>
                    <div><h2 className="text-xl font-bold text-slate-800">Tracker IbadahKU</h2><p className="text-xs text-orange-600 font-bold tracking-widest">VER 20.06.26</p></div>
                 </div>
                 
                 <div className="space-y-6">
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                       <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2"><Target size={16}/> Pembaruan Utama (Update)</h3>
                       <ul className="text-xs text-blue-700 space-y-1 ml-4 list-disc">
                          <li>Sistem <span className="font-bold">Multi-Komunitas & Gamifikasi</span>.</li>
                          <li>Tabel terbelah: Komitmen Pribadi & Komunitas.</li>
                          <li>Logika Tepat Waktu Baru (Maks 12:15 & 00:30).</li>
                          <li>Aturan Disiplin Ketat: Lupa Centang = Minus.</li>
                       </ul>
                    </div>
                    
                    <div>
                       <h3 className="font-bold text-slate-800 mb-3 border-b pb-2">Perbandingan Fitur Akses</h3>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-50 p-4 rounded-xl border">
                             <p className="text-sm font-bold text-slate-700 mb-2">👤 User Reguler</p>
                             <ul className="text-[10px] text-slate-500 space-y-1 list-disc ml-3">
                                <li>Buat aktivitas komitmen pribadi.</li>
                                <li>Join komunitas via Kode Unik.</li>
                                <li>Ikut klasemen Fastabiqul Khairat.</li>
                                <li>Jurnal & Analisa Grafik Pribadi.</li>
                             </ul>
                          </div>
                          <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                             <p className="text-sm font-bold text-orange-700 mb-2">👑 Admin / Premium</p>
                             <ul className="text-[10px] text-orange-600 space-y-1 list-disc ml-3">
                                <li>Semua fitur Reguler.</li>
                                <li>Akses Dashboard Pemantauan Admin.</li>
                                <li>Buat Komunitas & Kode Unik.</li>
                                <li>Pilih 12 Aktivitas Wajib Komunitas.</li>
                                <li>Pantau detail Jam Login anggotanya.</li>
                             </ul>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        )}

        {/* MODAL JOIN KOMUNITAS */}
        {showJoinModal && (
           <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
              <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl relative text-center">
                 <button onClick={() => setShowJoinModal(false)} className="absolute top-4 right-4 p-2 text-slate-400 rounded-full"><X size={20}/></button>
                 <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4"><KeyRound size={32} className="text-blue-600"/></div>
                 <h2 className="text-2xl font-bold text-slate-800 mb-2">Gabung Komunitas</h2>
                 <p className="text-slate-500 text-sm mb-6">Masukkan 6 Digit Kode Unik yang diberikan oleh Admin/Leader Anda.</p>
                 <input type="text" placeholder="Contoh: MIP-8X2A" value={joinCodeInput} onChange={e => setJoinCodeInput(e.target.value.toUpperCase())} maxLength={8} className="w-full text-center text-2xl font-black tracking-widest bg-slate-50 border-2 border-slate-200 rounded-xl p-4 mb-6 uppercase outline-none focus:border-blue-500 focus:bg-blue-50 transition-all" />
                 <button onClick={handleJoinCommunity} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg">Verifikasi Kode & Gabung</button>
              </div>
           </div>
        )}

        {/* MODAL SUPER ADMIN / ADMIN */}
        {showAdminPanel && isAdmin && (
           <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
              <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-5xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
                 <button onClick={() => setShowAdminPanel(false)} className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full"><X size={20}/></button>
                 <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-3"><Shield className="text-blue-500"/> {isSuperAdmin ? 'Super Admin Dashboard' : 'Admin Dashboard'}</h2>
                 <p className="text-sm text-slate-500 mb-6">Kelola Komunitas Gamifikasi dan Pantau Anggota Anda.</p>
                 
                 <div className="flex border-b border-slate-200 mb-6 gap-6">
                    <button onClick={()=>setAdminTab('users')} className={`pb-3 font-bold transition-all border-b-2 ${adminTab === 'users' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Pantau Anggota</button>
                    <button onClick={()=>setAdminTab('communities')} className={`pb-3 font-bold transition-all border-b-2 ${adminTab === 'communities' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Kelola Komunitas & Kode Join</button>
                 </div>

                 {adminTab === 'users' ? (
                    <div>
                       <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
                          <div className="relative w-full sm:w-64">
                             <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                             <input type="text" placeholder="Cari nama atau email..." value={adminSearch} onChange={e => setAdminSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"/>
                          </div>
                          <select value={adminSort} onChange={(e:any) => setAdminSort(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none">
                             <option value="newest">Terakhir Login (Terbaru)</option>
                             <option value="az">Nama (A-Z)</option>
                          </select>
                       </div>
                       
                       <div className="overflow-x-auto border border-slate-100 rounded-xl">
                          <table className="w-full text-left text-sm min-w-[800px]">
                             <thead className="bg-slate-50 text-slate-600 border-b border-slate-100">
                                <tr>
                                   <th className="p-4 font-bold">Nama Anggota</th>
                                   <th className="p-4 font-bold">Email</th>
                                   <th className="p-4 font-bold">Status (Terakhir Aktif/Login)</th>
                                   {isSuperAdmin && <th className="p-4 font-bold text-center">Hak Akses</th>}
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-50">
                                {filteredAdminUsers.map((u) => {
                                   let actStatus = <span className="text-slate-400 text-xs italic">Belum Aktif</span>;
                                   if (u.lastActivity || u.lastLogin) {
                                      const timestamp = u.lastActivity || u.lastLogin;
                                      const diffDays = Math.floor((new Date().getTime() - timestamp) / (1000 * 60 * 60 * 24));
                                      const timeStr = formatLastLogin(timestamp);
                                      
                                      if (diffDays > 2) actStatus = <span className="text-red-600 font-medium text-[11px]"><span className="font-bold">⚠️ Pasif {diffDays} Hari</span><br/><span className="text-[9px]">{timeStr}</span></span>;
                                      else actStatus = <span className="text-green-600 font-medium text-[11px]"><span className="font-bold">🟢 Aktif</span><br/><span className="text-[9px]">{timeStr}</span></span>;
                                   }

                                   return (
                                   <tr key={u.id} className="hover:bg-slate-50/50">
                                      <td className="p-4 font-bold text-slate-800">{u.displayName || 'Anonim'}</td>
                                      <td className="p-4 text-slate-500 text-xs">{u.email || '-'}</td>
                                      <td className="p-4">{actStatus}</td>
                                      {isSuperAdmin && (
                                         <td className="p-4 text-center">
                                            <button 
                                               onClick={() => {
                                                  const newRole = u.role === 'admin' ? 'user' : 'admin';
                                                  setDoc(doc(db, 'users', u.id), { role: newRole }, { merge: true });
                                               }}
                                               disabled={u.email === 'coachardi1453@gmail.com'}
                                               className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-colors ${u.role === 'admin' ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                            >
                                               {u.role === 'admin' ? 'Admin' : 'User'}
                                            </button>
                                         </td>
                                      )}
                                   </tr>
                                )})}
                                {filteredAdminUsers.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic">Tidak ada anggota ditemukan.</td></tr>}
                             </tbody>
                          </table>
                       </div>
                    </div>
                 ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                          <h3 className="font-bold text-slate-800 mb-4">Buat Komunitas Baru</h3>
                          <input type="text" placeholder="Nama Komunitas (Cth: Tim Sales MIP)" value={newCommName} onChange={e => setNewCommName(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-3 mb-4 text-sm focus:border-blue-500 outline-none" />
                          
                          <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Pilih Aktivitas Wajib</p>
                          <div className="space-y-2 h-64 overflow-y-auto bg-white p-3 rounded-xl border border-slate-200 mb-4">
                             {STANDARD_ACTIVITIES.map(act => (
                                <label key={act.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                                   <input type="checkbox" checked={selectedActs.includes(act.id)} onChange={(e) => {
                                      if(e.target.checked) setSelectedActs([...selectedActs, act.id]);
                                      else setSelectedActs(selectedActs.filter(id => id !== act.id));
                                   }} className="w-4 h-4 text-blue-600 rounded" />
                                   <span className="text-sm font-semibold text-slate-700">{act.name} <span className="text-[10px] text-slate-400 bg-slate-100 px-1 rounded ml-1">{act.time}</span></span>
                                </label>
                             ))}
                          </div>
                          
                          <button onClick={handleCreateCommunity} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 shadow-md">Generate Kode & Buat</button>
                       </div>
                       
                       <div>
                          <h3 className="font-bold text-slate-800 mb-4">Komunitas Buatan Anda</h3>
                          <div className="space-y-3">
                             {allCommunities.filter(c => c.ownerId === user.uid).map(c => (
                                <div key={c.id} className="bg-white border-2 border-dashed border-slate-200 p-4 rounded-xl flex items-center justify-between group">
                                   <div>
                                      <p className="font-bold text-slate-800 text-lg">{c.name}</p>
                                      <p className="text-[10px] text-slate-400 font-bold uppercase">{c.activities?.length || 0} Aktivitas Wajib</p>
                                   </div>
                                   <div className="text-right">
                                      <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Kode Join</p>
                                      <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                                         <span className="font-black text-blue-700 tracking-widest">{c.joinCode}</span>
                                         <button onClick={()=>{navigator.clipboard.writeText(c.joinCode); showToast("Kode disalin!");}} className="text-blue-400 hover:text-blue-600"><Copy size={14}/></button>
                                      </div>
                                   </div>
                                </div>
                             ))}
                             {allCommunities.filter(c => c.ownerId === user.uid).length === 0 && <p className="text-sm text-slate-400 italic">Anda belum membuat komunitas apapun.</p>}
                          </div>
                       </div>
                    </div>
                 )}
              </div>
           </div>
        )}

        {/* TOMBOL SIMPAN MELAYANG */}
        {hasUnsavedChanges && (
           <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] w-full px-4 sm:w-auto sm:px-0 pointer-events-none">
              <button onClick={() => saveToServer(false)} disabled={isSaving} className="w-full pointer-events-auto sm:w-auto bg-orange-600 text-white px-8 py-3.5 rounded-full font-bold flex items-center justify-center gap-3 shadow-[0_8px_30px_rgba(249,115,22,0.5)] hover:bg-orange-700 hover:-translate-y-1 transition-all animate-bounce">
                  {isSaving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                  {isSaving ? 'Menyimpan ke Antrean...' : 'Simpan Perubahan Anda'}
               </button>
           </div>
        )}

        <div className="max-w-7xl mx-auto space-y-8 pb-16">
          
          {/* HEADER UTAMA */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 flex flex-row justify-between items-center gap-4 relative overflow-hidden">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full border-2 border-orange-500 flex items-center justify-center shadow-md shrink-0">
                 <img src="/logo.png" alt="Logo" className="w-[70%] h-[70%] object-contain" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-wide">Tafkir Corp</h1>
                <p className="text-[9px] sm:text-xs text-orange-600 font-bold uppercase tracking-[0.1em] sm:tracking-[0.2em] mt-0.5 sm:mt-1">Tracker Ibadah & Hal Positif</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
               <div className="text-right flex flex-col justify-center bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 hidden sm:flex">
                 <div className="text-sm font-semibold text-slate-800">{user.displayName?.split(' ')[0]}</div>
                 <div className="text-[10px] font-bold flex justify-end">
                    {isSyncing ? <span className="text-blue-500 flex items-center gap-1"><RefreshCw size={10} className="animate-spin"/> Synchronizing...</span> : <span className="text-green-600 flex items-center gap-1"><Zap size={10}/> Synchronized</span>}
                 </div>
               </div>
               
               <button onClick={() => setShowInfoModal(true)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors border border-slate-100" title="Informasi Aplikasi"><Info size={18}/></button>
               
               {isAdmin && (
                  <button onClick={() => setShowAdminPanel(true)} className="bg-blue-50 text-blue-600 hover:bg-blue-100 p-2 rounded-lg transition-colors border border-blue-100" title="Admin Dashboard"><Shield size={18}/></button>
               )}
               
               <button onClick={handleLogout} className="bg-red-50 text-red-600 hover:bg-red-100 p-2 sm:px-3 sm:py-1.5 rounded-lg transition-colors text-sm font-medium flex items-center gap-1 border border-red-100">
                 <LogOut size={16}/> <span className="hidden sm:block">Keluar</span>
               </button>
            </div>
          </div>

          {/* TABEL HISAB PRIBADI & KOMUNITAS */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden relative">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col items-center gap-4">
               
               {/* INDIKATOR PROGRES GABUNGAN */}
               <div className="w-full flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-4 mb-2">
                  <div className={`px-5 py-2 rounded-xl text-lg font-black shadow-sm border text-center ${stats.scoreGabungan >= 50 ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white border-green-600' : 'bg-gradient-to-r from-orange-500 to-red-500 text-white border-orange-600'}`}>
                     Total Progress Gabungan: {stats.scoreGabungan}%
                  </div>
                  <div className="flex gap-2">
                     <span className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 shadow-sm">👤 Pribadi: <span className="text-blue-600">{stats.scorePribadi}%</span></span>
                     <span className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 shadow-sm">👥 Komunitas: <span className="text-purple-600">{stats.scoreKomunitas}%</span></span>
                  </div>
               </div>

               <div className="flex flex-col md:flex-row justify-between w-full gap-4 items-center">
                  <div className="flex items-center justify-between w-full md:w-auto gap-4">
                     <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-orange-500"></span> Tabel Hisab 
                     </h2>
                  </div>
                  
                  <div className="flex items-center gap-2 sm:gap-4 bg-white border border-slate-200 px-2 py-1 rounded-lg shadow-sm">
                     <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ChevronLeft size={20}/></button>
                     <div className="w-32 sm:w-40 text-center font-bold text-slate-700 text-sm sm:text-base">
                        {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
                     </div>
                     <button onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ChevronRight size={20}/></button>
                     
                     <button onClick={scrollToToday} className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 sm:px-3 py-1.5 rounded text-[10px] sm:text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-200 border-l-2 border-l-blue-400">
                        👉 <span className="hidden sm:block">HARI INI</span>
                     </button>
                  </div>
               </div>
            </div>
            
            <div className="overflow-x-auto pb-4" ref={tableContainerRef}>
              <table className="w-full text-sm">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="text-left text-slate-700 font-bold p-3 sm:p-4 sticky left-0 bg-slate-100 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[160px] sm:min-w-[280px]">
                       Ibadah & Aktivitas Positif KU
                    </th>
                    {daysInMonth.map(d => {
                      const isActuallyToday = getLocalDateStr(d) === getLocalDateStr(new Date());
                      return (
                         <th key={d.toISOString()} ref={isActuallyToday ? todayColumnRef : null} className={`p-3 text-center font-semibold min-w-[40px] transition-colors ${isActuallyToday ? 'bg-orange-100 text-orange-700 border-b-2 border-orange-500' : 'text-slate-600'}`}>
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
                
                {/* --- BLOK KOMITMEN PRIBADI --- */}
                <tbody>
                  <tr>
                     <td colSpan={daysInMonth.length + 1} className="bg-blue-50 border-b border-blue-100 p-2 sm:p-3 sticky left-0 z-10">
                        <div className="flex justify-between items-center px-2">
                           <span className="font-bold text-blue-800 text-xs sm:text-sm uppercase tracking-widest flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div> Komitmen Pribadi</span>
                           <button onClick={() => setActModal({ show: true, mode: 'add', id: null, name: '', time: '00:00' })} className="bg-white border border-blue-200 px-2 py-1 rounded text-[10px] sm:text-xs font-bold text-blue-600 hover:bg-blue-100 shadow-sm flex items-center gap-1">+ Buat Sendiri</button>
                        </div>
                     </td>
                  </tr>
                  {personalActivities.length === 0 && (
                     <tr><td colSpan={daysInMonth.length + 1} className="p-4 text-center text-slate-400 italic text-xs bg-white">Belum ada komitmen pribadi. Klik tombol "+ Buat Sendiri".</td></tr>
                  )}
                  {personalActivities.map((act, idx) => (
                    <tr key={act.id} className="bg-white hover:bg-orange-50/50 border-b border-slate-50">
                      <td className="p-2 sm:p-3 font-medium sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] bg-white">
                        <div className="flex items-center gap-2 sm:gap-3">
                           <div className="flex flex-col gap-1 shrink-0">
                              <button onClick={() => setActModal({ show: true, mode: 'edit', id: act.id, name: act.name, time: act.time })} className="p-1 text-slate-400 hover:text-blue-600 rounded"><Edit3 size={14}/></button>
                              <button onClick={() => deleteActivity(act.id)} className="p-1 text-slate-400 hover:text-red-600 rounded"><Trash2 size={14}/></button>
                           </div>
                           <div className="flex flex-col items-start leading-tight min-w-0">
                              <span className="text-xs sm:text-sm font-bold text-slate-700 truncate">{act.name}</span>
                              <span className="text-[9px] text-blue-600 font-bold bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded mt-1">{act.time}</span>
                           </div>
                        </div>
                      </td>
                      {daysInMonth.map(d => {
                        const key = `${getLocalDateStr(d)}-${act.id}`;
                        const rec = records[key];
                        return (
                          <td key={key} className="p-2 text-center relative group cursor-pointer border-r border-slate-50" onClick={() => handleRecord(d, act.id, act.time, rec?.status)}>
                            {rec?.status === 'done' ? <div className="w-6 h-6 mx-auto bg-green-100 rounded flex items-center justify-center border border-green-200"><Check className="text-green-600" size={14} /></div>
                            : rec?.status === 'missed' ? <div className="w-6 h-6 mx-auto bg-red-100 rounded flex items-center justify-center border border-red-200"><X className="text-red-600" size={14} /></div>
                            : <div className="w-6 h-6 mx-auto rounded bg-slate-50 border border-slate-200 hover:border-orange-300" />}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>

                {/* --- BLOK KOMITMEN KOMUNITAS --- */}
                <tbody>
                  <tr>
                     <td colSpan={daysInMonth.length + 1} className="bg-purple-50 border-y border-purple-100 p-2 sm:p-3 sticky left-0 z-10">
                        <div className="flex justify-between items-center px-2">
                           <span className="font-bold text-purple-800 text-xs sm:text-sm uppercase tracking-widest flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-600"></div> Komitmen Komunitas</span>
                           <button onClick={() => setShowJoinModal(true)} className="bg-white border border-purple-200 px-2 py-1 rounded text-[10px] sm:text-xs font-bold text-purple-600 hover:bg-purple-100 shadow-sm flex items-center gap-1">🔗 Gabung Grup</button>
                        </div>
                     </td>
                  </tr>
                  {communityActivities.length === 0 && (
                     <tr><td colSpan={daysInMonth.length + 1} className="p-4 text-center text-slate-400 italic text-xs bg-slate-50/50">Anda belum bergabung di komunitas manapun. Klik "Gabung Grup".</td></tr>
                  )}
                  {communityActivities.map((act: any) => (
                    <tr key={act.id} className="bg-slate-50/50 hover:bg-orange-50/50 border-b border-slate-100">
                      <td className="p-2 sm:p-3 font-medium sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] bg-[#f8fafc]">
                        <div className="flex items-center gap-2 pl-4">
                           <div className="flex flex-col items-start leading-tight min-w-0">
                              <span className="text-xs sm:text-sm font-bold text-slate-800 truncate">{act.name}</span>
                              <span className="text-[9px] text-purple-600 font-bold bg-purple-100 px-1.5 py-0.5 rounded mt-1 mb-1">{act.time}</span>
                              <span className="text-[8px] text-slate-500 uppercase font-semibold flex items-center gap-1"><Users size={10}/> {act.communities.join(', ')}</span>
                           </div>
                        </div>
                      </td>
                      {daysInMonth.map(d => {
                        const key = `${getLocalDateStr(d)}-${act.id}`;
                        const rec = records[key];
                        return (
                          <td key={key} className="p-2 text-center relative group cursor-pointer border-r border-slate-100/50" onClick={() => handleRecord(d, act.id, act.time, rec?.status)}>
                            {rec?.status === 'done' ? <div className="w-6 h-6 mx-auto bg-green-100 rounded flex items-center justify-center border border-green-200"><Check className="text-green-600" size={14} /></div>
                            : rec?.status === 'missed' ? <div className="w-6 h-6 mx-auto bg-red-100 rounded flex items-center justify-center border border-red-200"><X className="text-red-600" size={14} /></div>
                            : <div className="w-6 h-6 mx-auto rounded bg-white border border-slate-300 hover:border-orange-300" />}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300">
                    <td className="p-3 sm:p-4 text-right font-black text-slate-800 sticky left-0 z-20 bg-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-xs sm:text-sm uppercase tracking-widest">
                       Ketercapaian Gabungan:
                    </td>
                    {daysInMonth.map(d => (
                       <td key={d.toISOString()} className="p-2 text-center font-black text-blue-700 border-r border-slate-200 text-xs sm:text-sm">
                          {getDailyPercentage(d)}
                       </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* PANEL GAMIFIKASI MULTI-KOMUNITAS */}
          {joinedCommunityIds.length > 0 && (
             <div className="space-y-6">
                <h2 className="text-xl font-bold text-slate-800 border-l-4 border-yellow-500 pl-4">Leaderboard Komunitas</h2>
                
                {joinedCommunityIds.map(commId => {
                   const comm = allCommunities.find(c => c.id === commId);
                   if (!comm) return null;
                   
                   const boardData = allUsers
                      .map(u => ({ name: u.displayName || 'Anonim', score: u[`score_${String(currentDate.getMonth() + 1).padStart(2, '0')}-${currentDate.getFullYear()}_comm_${commId}`] || 0 }))
                      .filter(u => u.score > 0)
                      .sort((a,b) => b.score - a.score)
                      .slice(0, 5);

                   return (
                   <div key={commId} className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-xl p-6 border border-slate-700 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-48 h-48 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"></div>
                      
                      <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-slate-700 pb-4">
                         <div>
                            <h3 className="text-xl font-black text-white flex items-center gap-2"><Medal className="text-yellow-400" size={24}/> {comm.name}</h3>
                         </div>
                         <div className="bg-slate-800/50 border border-slate-600 px-3 py-1.5 rounded-lg text-[10px] text-slate-300 font-bold uppercase tracking-widest">Bulan {MONTH_NAMES[currentDate.getMonth()]}</div>
                      </div>

                      <div className="relative z-10">
                         {boardData.length === 0 ? (
                            <div className="text-center py-6 text-slate-500 text-sm font-medium italic border-2 border-dashed border-slate-700 rounded-xl">Belum ada kompetisi bulan ini.</div>
                         ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                               {boardData.map((usr, idx) => (
                                  <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${idx === 0 ? 'bg-gradient-to-r from-yellow-500/20 to-transparent border-yellow-500/30' : idx === 1 ? 'bg-gradient-to-r from-slate-300/10 to-transparent border-slate-400/20' : idx === 2 ? 'bg-gradient-to-r from-orange-600/20 to-transparent border-orange-500/20' : 'bg-white/5 border-white/10'}`}>
                                     <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shadow-md ${idx === 0 ? 'bg-yellow-400 text-yellow-900' : idx === 1 ? 'bg-slate-300 text-slate-800' : idx === 2 ? 'bg-orange-400 text-orange-900' : 'bg-slate-800 text-slate-400'}`}>{idx + 1}</div>
                                        <span className={`font-bold text-sm truncate max-w-[150px] ${idx === 0 ? 'text-yellow-400' : 'text-slate-200'}`}>{usr.name}</span>
                                     </div>
                                     <div className="text-right">
                                        <span className={`text-xl font-black ${idx === 0 ? 'text-yellow-400' : 'text-white'}`}>{usr.score}%</span>
                                     </div>
                                  </div>
                               ))}
                            </div>
                         )}
                      </div>
                   </div>
                )})}
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
                   <h2 className="text-xl font-bold text-slate-800 border-l-4 border-orange-500 pl-4">Analisa & Grafik Gabungan</h2>
                   <p className="text-sm text-slate-500 mt-2 pl-4 font-medium">Laporan: <span className="font-bold text-slate-700">{user.displayName}</span></p>
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
                     <h3 className="text-slate-700 font-bold mb-6 text-center">Kuantitas Total Gabungan</h3>
                     <div className="space-y-4 mb-6">
                        <div>
                          <div className="flex justify-between text-sm font-bold mb-1 text-slate-700">
                             <span>Selesai ({stats.totalDone}x)</span>
                             <span className="text-green-600">{stats.totalDone + stats.totalMissed === 0 ? 0 : Math.round((stats.totalDone / (stats.totalDone + stats.totalMissed)) * 100)}%</span>
                          </div>
                          <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                             <div className="h-full bg-green-500 rounded-full" style={{ width: `${stats.totalDone + stats.totalMissed === 0 ? 0 : Math.round((stats.totalDone / (stats.totalDone + stats.totalMissed)) * 100)}%` }}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm font-bold mb-1 text-slate-700">
                             <span>Terlewat ({stats.totalMissed}x)</span>
                             <span className="text-red-500">{stats.totalDone + stats.totalMissed === 0 ? 0 : 100 - Math.round((stats.totalDone / (stats.totalDone + stats.totalMissed)) * 100)}%</span>
                          </div>
                          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                             <div className="h-full bg-red-400 rounded-full" style={{ width: `${stats.totalDone + stats.totalMissed === 0 ? 0 : 100 - Math.round((stats.totalDone / (stats.totalDone + stats.totalMissed)) * 100)}%` }}></div>
                          </div>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                  <h3 className="text-slate-700 font-bold mb-4 text-center">Disiplin Pelaporan (Gabungan)</h3>
                  <p className="text-[9px] text-slate-500 text-center mb-6 leading-tight">Maks 12:15 hari yang sama (Untuk jadwal &lt; 12:00)<br/>Maks 00:30 hari esoknya (Untuk jadwal &gt; 12:00)</p>
                  
                  <div className="space-y-4">
                     <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex items-center justify-between">
                        <div>
                           <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">⏱️ Tepat Waktu</p>
                           <p className="text-2xl font-black text-blue-600">{stats.onTimeCount} <span className="text-xs font-semibold text-slate-500">kali</span></p>
                        </div>
                     </div>
                     <div className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm flex items-center justify-between">
                        <div>
                           <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">⚠️ Rapelan</p>
                           <p className="text-2xl font-black text-orange-500">{stats.lateCount} <span className="text-xs font-semibold text-slate-500">kali</span></p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="mt-12 pt-6 border-t border-slate-100 text-center leading-relaxed">
               <p className="text-slate-500 text-xs font-semibold">© 2026 TafkirCorp. Seluruh hak cipta milik ALLAAH SWT.</p>
               <p className="text-slate-400 text-[10px] mt-1">TafkirCorp App TrackerIbadahKU v20.06.26</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}