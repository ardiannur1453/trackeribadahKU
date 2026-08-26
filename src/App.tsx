import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import html2canvas from 'html2canvas';
import { ComposedChart, Area, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { 
  Trash2, Edit3, Eye, Download, LogOut, Check, X, AlertCircle, RefreshCw, 
  ChevronLeft, ChevronRight, AlertTriangle, BarChart2, Save, Zap, Plus, 
  Award, Search, Shield, Medal, Users, Info, KeyRound, Copy, Target, 
  Clock, Calendar, Activity, Settings, Crown, UserMinus, FileUp, 
  FileDown, ClipboardPaste, Files, Undo2, Redo2, ListOrdered, Megaphone, Flame, Heart, Link as LinkIcon
} from 'lucide-react';

// ==========================================
// KONFIGURASI FIREBASE
// ==========================================
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

// ==========================================
// HELPER & KONSTANTA
// ==========================================
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

const getFreqLabel = (freq: string) => {
    if (freq === 'weekly') return 'Weekly';
    if (freq === 'biweekly') return 'Bi-Weekly';
    if (freq === 'monthly') return 'Monthly';
    return 'Daily'; 
};

// Default fallback daily untuk seed master global
const SEED_ACTIVITIES = [
  { id: 'c1', name: 'Shalat Taubat', time: '02:00', frequency: 'daily' }, 
  { id: 'c2', name: 'Shalat Tahajud', time: '03:00', frequency: 'daily' },
  { id: 'c3', name: 'Shalat Qabliyah Subuh', time: '04:15', frequency: 'daily' }, 
  { id: 'c4', name: 'Shalat Subuh Berjamaah', time: '04:30', frequency: 'daily' },
  { id: 'c5', name: 'Dzikir Pagi', time: '05:00', frequency: 'daily' }, 
  { id: 'c6', name: 'Shalat Dhuha', time: '09:00', frequency: 'daily' },
  { id: 'c7', name: 'Shalat Dzuhur Berjamaah', time: '12:00', frequency: 'daily' }, 
  { id: 'c8', name: 'Shalat Ashar Berjamaah', time: '15:15', frequency: 'daily' },
  { id: 'c9', name: 'Shalat Maghrib Berjamaah', time: '18:00', frequency: 'daily' }, 
  { id: 'c10', name: 'Dzikir Petang', time: '18:30', frequency: 'daily' },
  { id: 'c11', name: 'Shalat Isya Berjamaah', time: '19:15', frequency: 'daily' }, 
  { id: 'c12', name: 'Tilawah Al-Quran', time: '20:00', frequency: 'daily' }
];

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const WEEKDAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// ==========================================
// KOMPONEN UTAMA APLIKASI
// ==========================================
export default function IbadahTracker() {
  
  // --- STATES AUTH & STATUS ---
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'demo'|'user'|'admin'|'superadmin'>('demo');
  const [myCommunityLimit, setMyCommunityLimit] = useState(1);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // --- STATES DATA UTAMA ---
  const [personalActivities, setPersonalActivities] = useState<any[]>([]);
  const [joinedCommunityIds, setJoinedCommunityIds] = useState<string[]>([]);
  const [allCommunities, setAllCommunities] = useState<any[]>([]); 
  const [globalActivities, setGlobalActivities] = useState<any[]>([]); 
  const [records, setRecords] = useState<any>({});
  const [journals, setJournals] = useState<any[]>([]);
  
  // --- STATES TIME TRAVEL (UNDO / REDO) ---
  const [pastRecords, setPastRecords] = useState<any[]>([]);
  const [futureRecords, setFutureRecords] = useState<any[]>([]);

  // --- STATES UI & MODAL ---
  const [toast, setToast] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMyCommsModal, setShowMyCommsModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  
  const [actModal, setActModal] = useState({ 
      show: false, mode: 'add', tab: 'global', id: null as any, name: '', time: '00:00', frequency: 'daily', freqConfig: '' 
  });
  
  const [roleConfirmModal, setRoleConfirmModal] = useState({ 
      show: false, targetUser: null as any, targetRole: '' 
  });
  
  const [membersModal, setMembersModal] = useState({ 
      show: false, commId: '', commName: '', isAdminView: false 
  });

  const [fullLeaderboardModal, setFullLeaderboardModal] = useState({
      show: false, commName: '', boardData: [] as any[]
  });

  const [copiedPattern, setCopiedPattern] = useState<{status: string, timestamp: number, dateStr: string}[] | null>(null);
  
  // --- STATES JURNAL ---
  const [activeJournal, setActiveJournal] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [journalInput, setJournalInput] = useState({ title: '', content: '', sharedWith: [] as string[] });
  const [journalSearch, setJournalSearch] = useState('');
  const [journalSort, setJournalSort] = useState<'newest' | 'oldest' | 'az' | 'za'>('newest');

  // --- STATES GRAFIK & GAMIFIKASI ---
  const [leaderboardTabs, setLeaderboardTabs] = useState<Record<string, 'monthly'|'weekly'|'yesterday'>>({});
  const [wtwMonthOffset, setWtwMonthOffset] = useState(0); 
  const [mtmRange, setMtmRange] = useState(6); 

  // --- STATES ADMIN DASHBOARD ---
  const isSuperAdmin = user?.email === 'coachardi1453@gmail.com';
  const isAdmin = isSuperAdmin || userRole === 'admin';
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState<'users' | 'communities' | 'globalacts' | 'characters'>('users');
  const [adminCommTab, setAdminCommTab] = useState<'my' | 'others'>('my');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminSort, setAdminSort] = useState<'newest' | 'oldest' | 'az' | 'za' | 'role'>('newest');
  
  const [editCommId, setEditCommId] = useState<string|null>(null);
  const [newCommName, setNewCommName] = useState('');
  const [selectedActs, setSelectedActs] = useState<{id: string, time: string}[]>([]);
  
  const [editGlobalActId, setEditGlobalActId] = useState<string|null>(null);
  const [newGlobalAct, setNewGlobalAct] = useState({ name: '', time: '00:00', frequency: 'daily', freqConfig: '' });

  // --- REFERENCES ---
  const chartRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const todayColumnRef = useRef<HTMLTableCellElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    
    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
       if (snap.exists()) {
          const d = snap.data();
          setPersonalActivities(d.activities || []); 
          setRecords(d.records || {});
          setJournals(d.journals || []); 
          setJoinedCommunityIds(d.joinedCommunities || []);
          setMyCommunityLimit(d.communityLimit || 1); 
          
          let effectiveRole = d.role || 'demo';
          if (user.email === 'coachardi1453@gmail.com') effectiveRole = 'superadmin';
          setUserRole(effectiveRole);
       }
       setIsSyncing(false);
    });
    
    const unsubComms = onSnapshot(collection(db, 'communities'), (snap) => {
       const comms: any[] = []; 
       snap.forEach(d => comms.push({ id: d.id, ...d.data() })); 
       setAllCommunities(comms);
    });
    
    const unsubGlobal = onSnapshot(collection(db, 'global_activities'), (snap) => {
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
    
    return () => { unsubUser(); unsubComms(); unsubGlobal(); };
  }, [user, isSuperAdmin]);

  // Daftar Semua User untuk Gamifikasi & Share Jurnal
  useEffect(() => {
    if (!user) return;
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
       const usersData: any[] = []; 
       snap.forEach(d => usersData.push({ id: d.id, ...d.data() })); 
       setAllUsers(usersData);
    });
    return () => unsubUsers();
  }, [user]);

  // PENYEMBUHAN RETROAKTIF (Auto-Sync Admin ke grup buatannya)
  useEffect(() => {
     if (user && allCommunities.length > 0) {
        const myOwnedComms = allCommunities.filter(c => c.ownerId === user.uid).map(c => c.id);
        const missingComms = myOwnedComms.filter(id => !joinedCommunityIds.includes(id));
        
        if (missingComms.length > 0) {
           const newJoined = Array.from(new Set([...joinedCommunityIds, ...missingComms]));
           setJoinedCommunityIds(newJoined);
           setDoc(doc(db, 'users', user.uid), { joinedCommunities: newJoined }, { merge: true })
             .catch(e => console.error("Auto-sync failed:", e));
        }
     }
  }, [user, allCommunities, joinedCommunityIds]);

  // SIKLUS 3: Opt #2 - Blok `useEffect` Phantom Cleanup (Auto-Kick) telah dihapus secara mutlak dari sini.
  // Data keanggotaan grup kini 100% imun dari fluktuasi cache / delay loading server.

  // Auto Save
  useEffect(() => {
    if (hasUnsavedChanges && user) {
      const timer = setTimeout(() => saveToServer(true), 5 * 60 * 1000); 
      return () => clearTimeout(timer);
    }
  }, [hasUnsavedChanges, records, journals, personalActivities, joinedCommunityIds]);

  // --- FUNGSI UTILITIES TAMPILAN & TOAST ---
  const showToast = (msg: string) => { 
      setToast(msg); 
      setTimeout(() => setToast(''), 4000); 
  };
  
  const scrollToToday = () => {
      if (todayColumnRef.current) {
         todayColumnRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else { 
         showToast("Bulan ini tidak sedang ditampilkan."); 
      }
  };

  // ==========================================
  // 3. FUNGSI "DYNAMIC DENOMINATOR" PENJADWALAN
  // ==========================================
  const isDayActive = (act: any, dateObj: Date) => {
      const freq = act.frequency || 'daily';
      if (freq === 'daily') return true;

      if (freq === 'weekly') {
          if (!act.freqConfig) return true;
          const days = act.freqConfig.split(',').map(Number);
          return days.includes(dateObj.getDay());
      }
      if (freq === 'monthly') {
          if (!act.freqConfig) return true;
          const dates = act.freqConfig.split(',').map((s: string) => Number(s.trim()));
          return dates.includes(dateObj.getDate());
      }
      if (freq === 'biweekly') {
          if (!act.freqConfig) return true;
          const [y, m, day] = act.freqConfig.split('-').map(Number);
          if (!y || !m || !day) return true;
          const anchor = new Date(y, m-1, day);
          anchor.setHours(0,0,0,0);
          const target = new Date(dateObj);
          target.setHours(0,0,0,0);
          const diff = Math.floor((target.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
          return diff >= 0 && diff % 14 === 0;
      }
      return true;
  };

  const isDeduplicatedDayActive = (dedupAct: any, dateObj: Date) => {
      if (!dedupAct.schedules || dedupAct.schedules.length === 0) return true;
      return dedupAct.schedules.some((sch: any) => isDayActive(sch, dateObj));
  };


  // ==========================================
  // 4. PEMROSESAN DATA (USEMEMO)
  // ==========================================
  
  const globalActsMap = useMemo(() => {
      const map: Record<string, string> = {};
      globalActivities.forEach(g => map[g.docId] = g.name);
      return map;
  }, [globalActivities]);

  const communityActivities = useMemo(() => {
     let commActsMap: Record<string, any> = {};
     joinedCommunityIds.forEach(commId => {
        const comm = allCommunities.find(c => c.id === commId);
        if (comm && comm.activities) {
           comm.activities.forEach((actObj: any) => {
              const globalAct = globalActivities.find(a => a.id === actObj.id || a.docId === actObj.id);
              if (globalAct) {
                 const baseId = actObj.id; 
                 if (!commActsMap[baseId]) {
                     commActsMap[baseId] = { 
                         id: baseId,
                         type: 'komunitas', 
                         name: globalAct.name, 
                         time: actObj.time, 
                         frequency: globalAct.frequency || 'daily',
                         freqConfig: globalAct.freqConfig || '',
                         communities: [comm.name] 
                     };
                 } else {
                     if (!commActsMap[baseId].communities.includes(comm.name)) {
                         commActsMap[baseId].communities.push(comm.name);
                     }
                     if (actObj.time < commActsMap[baseId].time) {
                         commActsMap[baseId].time = actObj.time;
                     }
                 }
              }
           });
        }
     });
     return Object.values(commActsMap).sort((a, b) => a.time.localeCompare(b.time));
  }, [joinedCommunityIds, allCommunities, globalActivities]);

  const formattedPersonalActivities = useMemo(() => {
      return personalActivities.map(a => ({
          ...a, 
          name: globalActsMap[a.id] || a.name, 
          type: 'pribadi'
      }));
  }, [personalActivities, globalActsMap]);

  const allCombinedActivities = useMemo(() => {
      return [...formattedPersonalActivities, ...communityActivities];
  }, [formattedPersonalActivities, communityActivities]);

  const deduplicatedCombinedActivities = useMemo(() => {
     let actMap: Record<string, any> = {};
     allCombinedActivities.forEach(act => {
         if (!actMap[act.id]) {
             actMap[act.id] = { ...act, schedules: [{ frequency: act.frequency, freqConfig: act.freqConfig }] };
         } else {
             if (act.time < actMap[act.id].time) actMap[act.id].time = act.time;
             actMap[act.id].schedules.push({ frequency: act.frequency, freqConfig: act.freqConfig });
         }
     });
     return Object.values(actMap).sort((a, b) => a.time.localeCompare(b.time));
  }, [allCombinedActivities]);

  // Smart Truncation Array
  const joinedCommunityNamesArray = useMemo(() => {
     // Gunakan optional chaining untuk Graceful Degradation (Anti-Crash) jika allCommunities blm load
     return joinedCommunityIds.map(id => allCommunities.find(c => c.id === id)?.name).filter(Boolean);
  }, [joinedCommunityIds, allCommunities]);

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear(); 
    const month = currentDate.getMonth(); 
    const days = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1, 0, 0, 0));
  }, [currentDate]);

  const todayDateObj = new Date();

  // ==========================================
  // LINKED ACTIVITY CHECKER
  // ==========================================
  const getLinkedCommunities = (actId: string) => {
      const isPersonal = personalActivities.some(p => p.id === actId);
      const commAct = communityActivities.find(c => c.id === actId);
      if (isPersonal && commAct) {
          return commAct.communities;
      }
      return null;
  };

  // ==========================================
  // 5. LOGIKA TIME TRAVEL (UNDO/REDO) & INPUT
  // ==========================================
  
  const pushToHistory = (newRecs: any) => {
      setPastRecords(prev => [...prev, records]);
      setFutureRecords([]);
      setRecords(newRecs);
      setHasUnsavedChanges(true);
  };

  const handleUndo = () => {
      if (pastRecords.length === 0) return;
      const previousState = pastRecords[pastRecords.length - 1];
      
      setFutureRecords(prev => [records, ...prev]);
      setPastRecords(prev => prev.slice(0, -1));
      setRecords(previousState);
      setHasUnsavedChanges(true);
      showToast("Tindakan dibatalkan (Undo).");
  };

  const handleRedo = () => {
      if (futureRecords.length === 0) return;
      const nextState = futureRecords[0];
      
      setPastRecords(prev => [...prev, records]);
      setFutureRecords(prev => prev.slice(1));
      setRecords(nextState);
      setHasUnsavedChanges(true);
      showToast("Tindakan diulangi (Redo).");
  };

  const getIsOnTime = (recordTimestamp: number, targetDate: Date, actTime: string) => {
     const [h] = actTime.split(':').map(Number);
     const deadline = new Date(targetDate);
     if (h < 12) { deadline.setHours(12, 15, 0, 0); } 
     else { deadline.setDate(deadline.getDate() + 1); deadline.setHours(0, 30, 0, 0); }
     return recordTimestamp <= deadline.getTime();
  };

  const handleRecord = (day: Date, actId: string, actTime: string, currentStatus: string | undefined) => {
    const now = new Date(); 
    const [hours, minutes] = actTime.split(':').map(Number);
    const targetTime = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
    
    // Gembok Masa Depan + 1 Menit
    const unlockTime = new Date(targetTime.getTime() + 60000); 
    if (now < unlockTime) {
        return showToast(`Gagal: Belum waktunya! Laporan dibuka pukul ${unlockTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
    }

    const key = `${getLocalDateStr(day)}-${actId}`;
    let newStatus = 'done';
    
    // Alur Status: Kosong/None -> Done -> Missed -> None
    if (currentStatus === 'done') newStatus = 'missed';
    if (currentStatus === 'missed') newStatus = 'none';

    let newRecs = { ...records };
    
    // Fix Zombie Data Bug
    if (newStatus === 'none') {
        newRecs[key] = { status: 'none', timestamp: now.getTime() }; 
    } else { 
        newRecs[key] = { status: newStatus, timestamp: now.getTime() }; 
    }
    
    pushToHistory(newRecs);
  };

  // --- FITUR COPY PASTE ---
  const handleCopyPattern = (act: any) => {
      const pattern: {status: string, timestamp: number, dateStr: string}[] = [];
      daysInMonth.forEach(d => {
          if (isDayActive(act, d)) {
              const dateStr = getLocalDateStr(d);
              const rec = records[`${dateStr}-${act.id}`];
              if (rec && rec.status !== 'none') {
                  pattern.push({ status: rec.status, timestamp: rec.timestamp, dateStr: dateStr });
              }
          }
      });
      setCopiedPattern(pattern);
      showToast("Pola baris disalin! Klik Tempel di baris tujuan.");
  };

  const handlePastePattern = (act: any) => {
      if (!copiedPattern) return showToast("Tidak ada pola yang disalin.");
      
      const now = new Date().getTime();
      let newRecs = { ...records };
      const [h, m] = act.time.split(':').map(Number);
      
      copiedPattern.forEach(item => {
          const targetDateObj = new Date(item.dateStr);
          targetDateObj.setHours(h, m, 0, 0);
          
          if (new Date().getTime() >= targetDateObj.getTime() + 60000 && isDayActive(act, targetDateObj)) {
              const key = `${item.dateStr}-${act.id}`;
              newRecs[key] = { status: item.status, timestamp: now };
          }
      });
      
      pushToHistory(newRecs);
      showToast("Pola berhasil ditempel!");
  };

  // ==========================================
  // 6. MANAJEMEN KOMITMEN PRIBADI & GUARDRAILS DEMO
  // ==========================================
  const handleOpenAddAct = () => {
      if (userRole === 'demo') {
          showToast("Info Akun Demo: Maksimal 3 Aktivitas Global & 1 Kustom.");
      }
      setActModal({ show: true, mode: 'add', tab: 'global', id: null, name: '', time: '00:00', frequency: 'daily', freqConfig: '' });
  };

  const saveActivity = () => {
     if (actModal.tab === 'custom' && !actModal.name.trim()) return showToast("Nama aktivitas kosong!");
     if (actModal.tab === 'global' && !actModal.id) return showToast("Pilih master aktivitas terlebih dahulu!");

     if (userRole === 'demo' && actModal.mode === 'add') {
         if (actModal.tab === 'custom') {
             const customCount = personalActivities.filter(a => String(a.id).startsWith('p_')).length;
             if (customCount >= 1) return showToast("Peringatan: Akun DEMO maksimal 1 Aktivitas Kustom. Hubungi Admin.");
         } else {
             const globalCount = personalActivities.filter(a => !String(a.id).startsWith('p_')).length;
             if (globalCount >= 3) return showToast("Peringatan: Akun DEMO maksimal 3 Aktivitas Global. Hubungi Admin.");
         }
     }

     let newActs = [...personalActivities];
     
     if (actModal.mode === 'add') {
         if (actModal.tab === 'global') {
             if (newActs.find(a => a.id === actModal.id)) return showToast("Aktivitas ini sudah ada di daftar Anda.");
             newActs.push({ id: actModal.id, name: actModal.name, time: actModal.time, frequency: actModal.frequency, freqConfig: actModal.freqConfig });
         } else {
             newActs.push({ id: `p_${Date.now()}`, name: actModal.name, time: actModal.time, frequency: actModal.frequency, freqConfig: actModal.freqConfig });
         }
     } else { 
         newActs = newActs.map(a => String(a.id) === String(actModal.id) ? { ...a, name: actModal.name, time: actModal.time, frequency: actModal.frequency, freqConfig: actModal.freqConfig } : a); 
     }
     
     newActs.sort((a, b) => a.time.localeCompare(b.time));
     setPersonalActivities(newActs); 
     setHasUnsavedChanges(true);
     setActModal({ show: false, mode: 'add', tab: 'global', id: null, name: '', time: '00:00', frequency: 'daily', freqConfig: '' });
     showToast(`Aktivitas disimpan! Jangan lupa Simpan Perubahan.`);
  };

  const deleteActivity = (id: any) => {
     if (window.confirm("Yakin hapus aktivitas ini dari Komitmen Pribadi?")) {
        setPersonalActivities(personalActivities.filter(a => String(a.id) !== String(id))); 
        setHasUnsavedChanges(true);
        showToast("Aktivitas dihapus. Klik Simpan Perubahan.");
     }
  };

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
       if (isDayActive(activity, d)) {
           const targetTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
           if (today.getTime() >= targetTime.getTime() + 60000) {
              expected++; 
              if (records[`${getLocalDateStr(d)}-${actId}`]?.status === 'done') {
                  doneCount++;
              }
           }
       }
    });
    
    return expected === 0 ? true : (doneCount / expected) >= 0.5; 
  };


  // ==========================================
  // 7. MESIN KALKULATOR GAMIFIKASI REAL-TIME
  // ==========================================
  const getRealTimeLeaderboard = (commId: string, timeframe: 'monthly'|'weekly'|'yesterday') => {
      const comm = allCommunities.find(c => c.id === commId);
      if (!comm || !comm.activities) return [];

      const acts = comm.activities.map((actObj: any) => {
          const gAct = globalActivities.find(g => g.id === actObj.id || g.docId === actObj.id);
          return gAct ? { id: actObj.id, time: actObj.time, frequency: gAct.frequency || 'daily', freqConfig: gAct.freqConfig || '' } : null;
      }).filter(Boolean);

      const today = new Date();
      const currentWeekIdx = Math.floor((today.getDate() - 1) / 7);
      const yesterdayDate = today.getDate() - 1;

      const validDays = daysInMonth.filter(d => {
          if (timeframe === 'monthly') return true;
          if (timeframe === 'weekly') return Math.floor((d.getDate() - 1) / 7) === currentWeekIdx;
          if (timeframe === 'yesterday') return d.getDate() === yesterdayDate;
          return true;
      });

      const board = allUsers.filter(u => u.joinedCommunities?.includes(commId)).map(u => {
          let expected = 0;
          let done = 0;
          
          validDays.forEach(d => {
              const dateStr = getLocalDateStr(d);
              acts.forEach(a => {
                  if (isDayActive(a, d)) {
                      const [h, m] = a.time.split(':').map(Number);
                      const targetTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
                      if (today.getTime() >= targetTime.getTime() + 60000) {
                          expected++;
                          if (u.records && u.records[`${dateStr}-${a.id}`]?.status === 'done') {
                              done++;
                          }
                      }
                  }
              });
          });
          
          const score = expected === 0 ? 0 : Math.round((done / expected) * 100);
          return { name: u.displayName || 'Anonim', score };
      });

      return board.sort((a,b) => b.score - a.score);
  };


  // ==========================================
  // 8. MESIN KALKULASI STATISTIK MASTER, KUANTITAS & 4 PILAR DISIPLIN
  // ==========================================
  const calcStats = () => {
    const today = new Date();
    
    // --- HELPER STANDAR ---
    const calculateScore = (actArray: any[], isDedup = false) => {
       let expected = 0; let done = 0;
       daysInMonth.forEach(d => {
          const dateStr = getLocalDateStr(d);
          actArray.forEach(a => {
             const active = isDedup ? isDeduplicatedDayActive(a, d) : isDayActive(a, d);
             if (active) {
                 const [h, m] = a.time.split(':').map(Number);
                 const targetTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime();
                 if (today.getTime() >= targetTime + 60000) {
                    expected++; 
                    if (records[`${dateStr}-${a.id}`]?.status === 'done') done++;
                 }
             }
          });
       });
       return expected === 0 ? 0 : Math.round((done / expected) * 100);
    };

    const calculateTimeframeScore = (actArray: any[], filterFn: (d: Date) => boolean, isDedup = false) => {
       let expected = 0; let done = 0;
       daysInMonth.filter(filterFn).forEach(d => {
          const dateStr = getLocalDateStr(d);
          actArray.forEach(a => {
             const active = isDedup ? isDeduplicatedDayActive(a, d) : isDayActive(a, d);
             if (active) {
                 const [h, m] = a.time.split(':').map(Number);
                 const targetTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime();
                 if (today.getTime() >= targetTime + 60000) {
                    expected++; 
                    if (records[`${dateStr}-${a.id}`]?.status === 'done') done++;
                 }
             }
          });
       });
       return expected === 0 ? 0 : Math.round((done / expected) * 100);
    };

    const scorePribadi = personalActivities.length ? calculateScore(formattedPersonalActivities) : 0;
    
    let totalCommScore = 0; 
    let activeComms = 0; 
    const communityScoresDetail: Record<string, { monthly: number, weekly: number, yesterday: number }> = {};
    
    const todayDate = today.getDate();
    const currentWeekIdx = Math.floor((todayDate - 1) / 7);

    joinedCommunityIds.forEach(commId => {
       const comm = allCommunities.find(c => c.id === commId);
       if (comm && comm.activities?.length > 0) {
          const acts = comm.activities.map((actObj: any) => {
             const gAct = globalActivities.find(g => g.id === actObj.id || g.docId === actObj.id);
             return gAct ? { id: actObj.id, name: gAct.name, time: actObj.time, frequency: gAct.frequency || 'daily', freqConfig: gAct.freqConfig || '' } : null;
          }).filter(Boolean);
          
          const mScore = calculateTimeframeScore(acts, () => true); 
          const wScore = calculateTimeframeScore(acts, (d) => Math.floor((d.getDate() - 1) / 7) === currentWeekIdx); 
          const yScore = calculateTimeframeScore(acts, (d) => d.getDate() === todayDate - 1); 
          
          communityScoresDetail[commId] = { monthly: mScore, weekly: wScore, yesterday: yScore }; 
          totalCommScore += mScore; 
          activeComms++;
       }
    });

    const scoreKomunitas = activeComms > 0 ? Math.round(totalCommScore / activeComms) : 0;
    const scoreGabungan = deduplicatedCombinedActivities.length ? calculateScore(deduplicatedCombinedActivities, true) : 0;

    // --- KALKULASI KUANTITAS MURNI & TOP/BOT AKTIVITAS ---
    const actMetrics: Record<string, { name: string, type: string, done: number, missed: number, totalExpected: number }> = {};
    allCombinedActivities.forEach(a => {
        const uniqueMetricKey = `${a.id}_${a.type}`; 
        actMetrics[uniqueMetricKey] = { name: a.name, type: a.type, done: 0, missed: 0, totalExpected: 0 };
    });

    let qty = { p_done: 0, p_miss: 0, c_done: 0, c_miss: 0 };
    
    daysInMonth.forEach(d => {
       const dateStr = getLocalDateStr(d);
       allCombinedActivities.forEach(a => {
          if (isDayActive(a, d)) {
              const [h, m] = a.time.split(':').map(Number);
              const targetTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime();
              const metricKey = `${a.id}_${a.type}`;
              
              if (today.getTime() >= targetTime + 60000) {
                 const rec = records[`${dateStr}-${a.id}`];
                 const isPribadi = a.type === 'pribadi';
                 actMetrics[metricKey].totalExpected++;

                 if (rec && rec.status === 'done') {
                    actMetrics[metricKey].done++;
                    if (isPribadi) qty.p_done++; else qty.c_done++;
                 } else if (rec && rec.status === 'missed') { 
                    actMetrics[metricKey].missed++;
                    if (isPribadi) qty.p_miss++; else qty.c_miss++;
                 }
              }
          }
       });
    });

    let gab_done = 0; let gab_miss = 0;
    daysInMonth.forEach(d => {
       const dateStr = getLocalDateStr(d);
       deduplicatedCombinedActivities.forEach(a => {
          if (isDeduplicatedDayActive(a, d)) {
              const [h, m] = a.time.split(':').map(Number);
              const targetTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime();
              if (today.getTime() >= targetTime + 60000) {
                 const rec = records[`${dateStr}-${a.id}`];
                 if (rec && rec.status === 'done') gab_done++;
                 else if (rec && rec.status === 'missed') gab_miss++;
              }
          }
       });
    });
    const qtyGabungan = { done: gab_done, missed: gab_miss };

    const metricArray = Object.values(actMetrics).filter(a => a.totalExpected > 0);
    const p_metrics = metricArray.filter(a => a.type === 'pribadi');
    const c_metrics = metricArray.filter(a => a.type === 'komunitas');
    
    const topPribadi = [...p_metrics].sort((a,b) => b.done - a.done)[0];
    const botPribadi = [...p_metrics].sort((a,b) => b.missed - a.missed)[0]; 
    const topComm = [...c_metrics].sort((a,b) => b.done - a.done)[0];
    const botComm = [...c_metrics].sort((a,b) => b.missed - a.missed)[0];


    // --- KALKULASI 4 PILAR KARAKTER DISIPLIN (Deduplicated Data) ---
    let totalExpectedPast = 0;
    let totalResponded = 0;
    let totalOnTime = 0;
    let disciplineHealth = 100;

    daysInMonth.forEach(d => {
        const dateStr = getLocalDateStr(d);
        deduplicatedCombinedActivities.forEach(a => {
            if (isDeduplicatedDayActive(a, d)) {
                const [h, m] = a.time.split(':').map(Number);
                const targetTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime();

                if (today.getTime() >= targetTime + 60000) {
                    totalExpectedPast++;
                    const rec = records[`${dateStr}-${a.id}`];

                    if (rec && (rec.status === 'done' || rec.status === 'missed')) {
                        totalResponded++;
                        if (getIsOnTime(rec.timestamp, d, a.time)) {
                            totalOnTime++;
                        } else {
                            disciplineHealth -= 2; 
                        }
                    } else {
                        if (today.getTime() - targetTime > 3 * 24 * 60 * 60 * 1000) {
                            disciplineHealth -= 5; 
                        }
                    }
                }
            }
        });
    });

    disciplineHealth = Math.max(0, disciplineHealth);
    const noGhostingRate = totalExpectedPast === 0 ? 100 : Math.round((totalResponded / totalExpectedPast) * 100);
    const onTimeRate = totalResponded === 0 ? 100 : Math.round((totalOnTime / totalResponded) * 100);

    // --- Kalkulasi Daily Streak 🔥 ---
    let currentStreak = 0;
    let checkDate = new Date();
    checkDate.setHours(23, 59, 59, 999);

    for (let i = 0; i < 60; i++) {
        const d = new Date(checkDate.getTime() - (i * 24 * 60 * 60 * 1000));
        const dateStr = getLocalDateStr(d);
        let dayExpected = 0;
        let dayDone = 0;

        deduplicatedCombinedActivities.forEach(a => {
            if (isDeduplicatedDayActive(a, d)) {
                const [h, m] = a.time.split(':').map(Number);
                const targetTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime();
                if (today.getTime() >= targetTime + 60000) {
                    dayExpected++;
                    const rec = records[`${dateStr}-${a.id}`];
                    if (rec && rec.status === 'done') {
                        dayDone++;
                    }
                }
            }
        });

        if (dayExpected > 0) {
            if (dayDone > 0) {
                currentStreak++;
            } else {
                break; 
            }
        }
    }

    return { 
        scorePribadi, scoreKomunitas, scoreGabungan, communityScoresDetail, 
        qty, qtyGabungan, topPribadi, botPribadi, topComm, botComm, 
        noGhostingRate, onTimeRate, disciplineHealth, currentStreak
    };
  };

  const stats = calcStats();

  const getSubDailyPct = (day: Date, acts: any[], isDedup = false) => {
     const today = new Date(); 
     const dateStr = getLocalDateStr(day);
     let exp = 0; let done = 0;
     
     acts.forEach(a => {
        const active = isDedup ? isDeduplicatedDayActive(a, day) : isDayActive(a, day);
        if (active) {
            const [h, m] = a.time.split(':').map(Number);
            if (today.getTime() >= new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).getTime() + 60000) {
               exp++; 
               if (records[`${dateStr}-${a.id}`]?.status === 'done') done++;
            }
        }
     });
     return exp === 0 ? "-" : `${Math.round((done / exp) * 100)}%`;
  };

  const getDailyPercentage = (day: Date) => {
     return getSubDailyPct(day, deduplicatedCombinedActivities, true);
  };

  // ==========================================
  // 9. FUNGSI SIMPAN, RESET & BACKUP
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
       hp_score: stats.disciplineHealth, 
       daily_streak: stats.currentStreak, 
       [`score_${mKey}_gabungan`]: stats.scoreGabungan
    };
    
    Object.entries(stats.communityScoresDetail).forEach(([cId, scores]) => {
        payload[`score_${mKey}_comm_${cId}_monthly`] = scores.monthly;
        payload[`score_${mKey}_comm_${cId}_weekly`] = scores.weekly;
        payload[`score_${mKey}_comm_${cId}_yesterday`] = scores.yesterday;
    });
    
    try {
      await setDoc(doc(db, 'users', user.uid), payload, { merge: true });
      if (!isAutoSave) { setPastRecords([]); setFutureRecords([]); }
      setHasUnsavedChanges(false); 
      if (!isAutoSave) showToast("Disinkronkan ke Server!");
    } catch (e) { 
      showToast("Tersimpan lokal. Akan sync saat online."); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleResetData = async (type: 'this_month' | 'last_month' | 'all') => {
      const msg = type === 'all' 
          ? "PERINGATAN FATAL: Seluruh data aktivitas & jurnal Anda akan dihapus permanen! Anda yakin?" 
          : `Yakin ingin mereset data untuk ${type === 'this_month' ? 'Bulan Ini' : 'Bulan Lalu'}?`;
          
      if (!window.confirm(msg)) return;

      let newRecs = { ...records };
      const now = new Date();
      const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth()-1, 1);
      const lastMonthPrefix = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth()+1).padStart(2,'0')}`;

      if (type === 'all') {
         newRecs = {};
         setPersonalActivities([]);
         setJournals([]);
         setJoinedCommunityIds([]);
      } else if (type === 'this_month') {
         Object.keys(newRecs).forEach(k => { if(k.startsWith(thisMonthPrefix)) delete newRecs[k]; });
      } else if (type === 'last_month') {
         Object.keys(newRecs).forEach(k => { if(k.startsWith(lastMonthPrefix)) delete newRecs[k]; });
      }

      pushToHistory(newRecs);
      setShowSettingsModal(false);
      showToast("Data berhasil direset. Silakan klik Simpan Perubahan.");
  };

  const handleExportData = () => {
      const backupData = {
          exportDate: new Date().toISOString(),
          user: user.email,
          personalActivities,
          joinedCommunityIds,
          records,
          journals
      };
      const blob = new Blob([JSON.stringify(backupData)], {type: "application/json"});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Backup-TafkirTracker-${getLocalDateStr(new Date())}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast("File backup berhasil diunduh.");
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const data = JSON.parse(event.target?.result as string);
              if (!data.records || !data.personalActivities) throw new Error("Format tidak valid");
              if (!window.confirm("Yakin ingin melakukan Import Restore? Data Anda saat ini akan digabungkan (merge) dengan data file.")) return;

              setPersonalActivities(prev => {
                  const merged = [...prev];
                  data.personalActivities.forEach((a:any) => { if(!merged.find(x => x.id === a.id)) merged.push(a); });
                  return merged;
              });
              setJoinedCommunityIds(prev => Array.from(new Set([...prev, ...(data.joinedCommunityIds||[])])));
              setJournals(prev => {
                  const merged = [...prev];
                  data.journals.forEach((j:any) => { if(!merged.find(x => x.id === j.id)) merged.push(j); });
                  return merged;
              });
              
              pushToHistory({ ...records, ...data.records });
              setShowSettingsModal(false);
              showToast("Data berhasil di-restore! Klik Simpan Perubahan.");
          } catch(err) {
              showToast("Gagal: File backup tidak valid.");
          }
          if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsText(file);
  };

  // ==========================================
  // 10. FITUR SUPER ADMIN & ADMIN
  // ==========================================
  const executeRoleChange = async () => {
     try {
        await setDoc(doc(db, 'users', roleConfirmModal.targetUser.id), { 
            role: roleConfirmModal.targetRole 
        }, { merge: true });
        showToast("Hak akses berhasil diubah!");
     } catch(e) { showToast("Gagal mengubah hak akses."); }
     setRoleConfirmModal({ show: false, targetUser: null, targetRole: '' });
  };

  const handleUpdateCommunityLimit = async (targetUid: string, newLimit: number) => {
     try {
         await setDoc(doc(db, 'users', targetUid), { communityLimit: newLimit }, { merge: true });
         showToast("Limit Grup berhasil diupdate!");
     } catch(e) { showToast("Gagal update limit."); }
  };

  const handleSaveCommunity = async () => {
     if (!newCommName.trim() || selectedActs.length === 0) return showToast("Nama & min 1 aktivitas wajib diisi!");
     
     const myCommCount = allCommunities.filter(c => c.ownerId === user.uid).length;
     if (!isSuperAdmin && !editCommId && myCommCount >= myCommunityLimit) {
         return showToast(`Gagal! Batas pembuatan komunitas Anda maksimal ${myCommunityLimit} grup.`);
     }
     
     try {
        if (editCommId) {
           await updateDoc(doc(db, 'communities', editCommId), { 
               name: newCommName, activities: selectedActs 
           });
           showToast("Komunitas diperbarui!");
        } else {
           const prefix = newCommName.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
           const joinCode = `${prefix}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
           
           const newDocRef = await addDoc(collection(db, 'communities'), { 
               name: newCommName, ownerId: user.uid, ownerName: user.displayName || 'Admin', 
               activities: selectedActs, joinCode: joinCode, createdAt: new Date().getTime() 
           });
           
           const newJoined = [...joinedCommunityIds, newDocRef.id];
           setJoinedCommunityIds(newJoined);
           await setDoc(doc(db, 'users', user.uid), { joinedCommunities: newJoined }, { merge: true });

           showToast(`Komunitas dibuat! Anda otomatis bergabung.`);
        }
        setNewCommName(''); setSelectedActs([]); setEditCommId(null);
     } catch (e) { showToast("Gagal menyimpan komunitas."); }
  };

  const handleDeleteCommunity = async (id: string) => {
     if (window.confirm("PERINGATAN: Yakin menghapus komunitas ini selamanya? \n\nSemua member akan otomatis dikeluarkan dari grup ini.")) {
        try { 
            await deleteDoc(doc(db, 'communities', id)); showToast("Komunitas telah dihapus."); 
        } catch(e) { showToast("Gagal menghapus."); }
     }
  };

  const handleKickMember = async (targetUid: string) => {
      if(!window.confirm("Yakin ingin mengeluarkan anggota ini dari komunitas?")) return;
      try {
          const targetUser = allUsers.find(u => u.id === targetUid);
          if(!targetUser) return;
          const newJoined = targetUser.joinedCommunities.filter((id: string) => id !== membersModal.commId);
          await setDoc(doc(db, 'users', targetUid), { joinedCommunities: newJoined }, { merge: true });
          showToast("Member berhasil dikeluarkan.");
      } catch(e) { showToast("Gagal mengeluarkan member."); }
  };

  // SIKLUS 3: Opt #3 - OTONOMI LEAVE GROUP
  const handleLeaveCommunity = (commId: string) => {
      const comm = allCommunities.find(c => c.id === commId);
      if (!window.confirm(`Yakin ingin keluar dari grup "${comm?.name || 'ini'}"?\n\nHistori aktivitas gabungan dari grup ini akan ditarik dari layar utama Anda.`)) return;

      const newJoined = joinedCommunityIds.filter(id => id !== commId);
      setJoinedCommunityIds(newJoined);
      setHasUnsavedChanges(true);
      showToast(`Anda telah keluar dari grup. Klik Simpan Perubahan!`);
  };

  const handleAddGlobalActivity = async () => {
     if(!newGlobalAct.name.trim()) return showToast("Nama Master tidak boleh kosong!");
     try {
        if (editGlobalActId) {
            await updateDoc(doc(db, 'global_activities', editGlobalActId), { 
                name: newGlobalAct.name, time: newGlobalAct.time, frequency: newGlobalAct.frequency, freqConfig: newGlobalAct.freqConfig
            });
            setEditGlobalActId(null);
            showToast("Master Ibadah berhasil diperbarui. Sinkronisasi paksa ke seluruh user sedang berjalan.");
        } else {
            const newId = `c${Date.now()}`;
            await setDoc(doc(db, 'global_activities', newId), { 
                id: newId, name: newGlobalAct.name, time: newGlobalAct.time, frequency: newGlobalAct.frequency, freqConfig: newGlobalAct.freqConfig
            });
            showToast("Master Ibadah baru ditambahkan.");
        }
        setNewGlobalAct({ name: '', time: '00:00', frequency: 'daily', freqConfig: '' }); 
     } catch (e) { showToast("Gagal menyimpan master ibadah."); }
  };

  const handleJoinCommunity = () => {
     if (userRole === 'demo') return showToast("AKUN DEMO dilarang bergabung grup komunitas. Hubungi Admin.");
     const code = joinCodeInput.trim().toLowerCase();
     const comm = allCommunities.find(c => c.joinCode?.toLowerCase() === code);
     if (!comm) return showToast("Kode tidak valid!");
     if (joinedCommunityIds.includes(comm.id)) return showToast("Sudah bergabung.");
     
     setJoinedCommunityIds([...joinedCommunityIds, comm.id]); 
     setHasUnsavedChanges(true); setShowJoinModal(false); setJoinCodeInput('');
     showToast(`Bergabung ke ${comm.name}! Klik Simpan Perubahan.`);
  };

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
     
     const roleWeight: any = { superadmin: 4, admin: 3, user: 2, demo: 1 };
     return result.sort((a,b) => {
         if (adminSort === 'newest') return (b.lastLogin === undefined ? -Infinity : b.lastLogin) - (a.lastLogin === undefined ? -Infinity : a.lastLogin);
         if (adminSort === 'oldest') return (a.lastLogin === undefined ? Infinity : a.lastLogin) - (b.lastLogin === undefined ? Infinity : b.lastLogin);
         if (adminSort === 'az') return (a.displayName||'').localeCompare(b.displayName||'');
         if (adminSort === 'za') return (b.displayName||'').localeCompare(a.displayName||'');
         if (adminSort === 'role') return (roleWeight[b.role||'demo']||0) - (roleWeight[a.role||'demo']||0);
         return 0;
     });
  }, [allUsers, userRole, allCommunities, user, adminSearch, adminSort]);

  const getCommunityMembersFull = (commId: string) => {
      return allUsers.filter(u => u.joinedCommunities?.includes(commId));
  };


  // ==========================================
  // 11. FITUR JURNAL, SHARE & EXPORT
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
        date: new Date().toISOString(),
        sharedWith: journalInput.sharedWith || [] 
    };
    
    if (activeJournal && !activeJournal.isShared) { 
        setJournals(journals.map(j => j.id === activeJournal.id ? newJ : j)); 
    } else { 
        setJournals([newJ, ...journals]); 
    }
    
    setJournalInput({ title: '', content: '', sharedWith: [] }); 
    setActiveJournal(null); 
    setHasUnsavedChanges(true);
    showToast("Jurnal telah disematkan. Klik Simpan Perubahan!");
  };

  const combinedJournalsList = useMemo(() => {
     const shared: any[] = [];
     allUsers.forEach(u => {
         if (u.id === user?.uid) return;
         (u.journals || []).forEach((j: any) => {
             if (j.sharedWith && j.sharedWith.some((commId: string) => joinedCommunityIds.includes(commId))) {
                 shared.push({
                     ...j,
                     isShared: true,
                     authorName: u.displayName,
                     commNames: j.sharedWith.filter((id: string) => joinedCommunityIds.includes(id)).map((id: string) => allCommunities.find(c=>c.id===id)?.name).join(', ')
                 });
             }
         });
     });
     return [...journals, ...shared];
  }, [journals, allUsers, user, joinedCommunityIds, allCommunities]);

  const filteredAndSortedJournals = useMemo(() => {
     let result = combinedJournalsList.filter(j => 
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
  }, [combinedJournalsList, journalSearch, journalSort]);

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
  // 12. GENERATOR DATA GRAFIK (CHARTS)
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

  const mainChartData = useMemo(() => {
    const raw = daysInMonth.map((d, i) => {
      const p = getSubDailyPct(d, formattedPersonalActivities);
      const c = getSubDailyPct(d, communityActivities);
      const g = getSubDailyPct(d, deduplicatedCombinedActivities, true); 
      return { 
          x: i + 1, 
          tgl: d.getDate().toString(), 
          pri: p === '-' ? 0 : parseInt(p), 
          kom: c === '-' ? 0 : parseInt(c), 
          gab: g === '-' ? 0 : parseInt(g) 
      };
    });
    
    const tPri = linearRegression(raw, 'pri');
    const tKom = linearRegression(raw, 'kom');
    const tGab = linearRegression(raw, 'gab');
    
    return raw.map(d => ({ 
        ...d, 
        t_pri: Math.max(0, Math.min(100, Math.round(tPri.m * d.x + tPri.b))),
        t_kom: Math.max(0, Math.min(100, Math.round(tKom.m * d.x + tKom.b))),
        t_gab: Math.max(0, Math.min(100, Math.round(tGab.m * d.x + tGab.b))) 
    }));
  }, [daysInMonth, records, formattedPersonalActivities, communityActivities, deduplicatedCombinedActivities]);

  const wtwData = useMemo(() => {
     const targetDate = new Date(); 
     targetDate.setMonth(targetDate.getMonth() + wtwMonthOffset);
     const days = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
     
     const wStats = [ 
         { name: 'Pekan 1', exp:0, done:0 }, { name: 'Pekan 2', exp:0, done:0 }, 
         { name: 'Pekan 3', exp:0, done:0 }, { name: 'Pekan 4', exp:0, done:0 }, { name: 'Pekan 5', exp:0, done:0 } 
     ];
     
     Array.from({ length: days }, (_, i) => new Date(targetDate.getFullYear(), targetDate.getMonth(), i + 1, 0, 0, 0)).forEach(d => {
        const wIdx = Math.floor((d.getDate() - 1) / 7); 
        const dStr = getLocalDateStr(d);
        
        deduplicatedCombinedActivities.forEach(a => {
           if (isDeduplicatedDayActive(a, d)) {
               const [h, m] = a.time.split(':').map(Number);
               if (new Date().getTime() >= new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime() + 60000) {
                  wStats[wIdx].exp++; 
                  if(records[`${dStr}-${a.id}`]?.status === 'done') {
                      wStats[wIdx].done++;
                  }
               }
           }
        });
     });
     
     return wStats.filter(w => w.exp > 0).map(w => ({ 
         name: w.name, pencapaian: Math.round((w.done/w.exp)*100) 
     }));
  }, [wtwMonthOffset, records, deduplicatedCombinedActivities]);

  const mtmData = useMemo(() => {
     const result = [];
     for(let i = mtmRange - 1; i >= 0; i--) {
        const d = new Date(); 
        d.setMonth(d.getMonth() - i);
        const mKey = `${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
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
  // LOGIKA SMART TRUNCATION HEADER
  // ==========================================
  let displayCommText = "";
  if (joinedCommunityNamesArray.length <= 2) {
      displayCommText = joinedCommunityNamesArray.join(', ');
  } else {
      displayCommText = `${joinedCommunityNamesArray[0]}, ${joinedCommunityNamesArray[1]}, +${joinedCommunityNamesArray.length - 2} Grup Lainnya`;
  }

  // ==========================================
  // RENDER APP STATE
  // ==========================================
  if (isInitializing) {
      return <div className="fixed inset-0 bg-slate-50 flex items-center justify-center text-orange-500 font-bold z-50">Memuat Sistem Tafkir...</div>;
  }
  
  if (!user) {
    return (
      <div className="fixed inset-0 w-full h-full bg-[#111111] flex flex-col items-center justify-center p-4 z-50">
        <div className="bg-white/5 border border-orange-500/30 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center m-auto">
          <div className="w-24 h-24 mx-auto mb-6 bg-white rounded-full border-4 border-orange-500 flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.4)]">
             <img src="/logo.png" alt="Logo" className="w-[75%] h-[75%] object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Tracker IbadahKU</h1>
          <p className="text-orange-500 text-xs tracking-widest uppercase mb-8">by TafkirCorp</p>
          <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white font-black text-lg rounded-xl transition-all shadow-[0_5px_20px_rgba(249,115,22,0.5)] hover:-translate-y-1">
            Masuk dengan Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full overflow-y-auto bg-slate-50 text-slate-800 font-sans">
      
      {/* RESTORASI: CSS TOOLTIP MOBILE 1 DETIK DELAY & SIKLUS 3 Opt #1 DELAY 500ms */}
      <style>{`
         @media (hover: hover) {
            .desktop-tooltip-hover:hover .tooltip-content {
                opacity: 1 !important;
                visibility: visible !important;
                transition-delay: 1000ms !important;
            }
            .delay-500-trigger:hover .tooltip-content-delay {
                opacity: 1 !important;
                visibility: visible !important;
                transition-delay: 500ms !important;
            }
         }
      `}</style>

      {/* RESTORASI: GLOBAL TOAST NOTIFICATION */}
      {toast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl font-bold text-sm flex items-center gap-2 animate-bounce border border-slate-700">
              <Info size={16} className="text-orange-500"/> {toast}
          </div>
      )}

      {/* RESTORASI: MODAL VIEW JURNAL (MATA) */}
      {isViewModalOpen && activeJournal && (
         <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
            <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
               <button onClick={() => {setIsViewModalOpen(false); setActiveJournal(null);}} className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors"><X size={20}/></button>
               <h2 className="text-2xl font-black text-slate-800 mb-2 pr-10">{activeJournal.title}</h2>
               <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mb-6 border-b border-slate-100 pb-4">
                   <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5"><Calendar size={12}/> {new Date(activeJournal.date).toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}</p>
                   {activeJournal.isShared && <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5 border border-blue-200"><Megaphone size={12}/> Pesan Admin: {activeJournal.authorName}</span>}
               </div>
               <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                   {activeJournal.content}
               </div>
               <div className="mt-8 pt-4 border-t border-slate-100 flex justify-end">
                   <button onClick={() => {setIsViewModalOpen(false); setActiveJournal(null);}} className="bg-slate-800 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-slate-900 transition-colors shadow-sm">Tutup Jendela</button>
               </div>
            </div>
         </div>
      )}

      <div className="min-h-full p-2 md:p-6 relative">
        {/* ================= MODALS ================= */}

        {/* MODAL SETTINGS */}
        {showSettingsModal && (
           <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[130] p-4">
              <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl relative text-center">
                 <button onClick={() => setShowSettingsModal(false)} className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full"><X size={20}/></button>
                 <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                     <Settings className="text-slate-600" size={32}/>
                 </div>
                 <h2 className="text-2xl font-bold text-slate-800 mb-2">Pengaturan Akun</h2>
                 <p className="text-slate-500 text-sm mb-6 border-b pb-4">Kelola data dan sesi aplikasi Anda.</p>
                 
                 <div className="space-y-6 mb-8 text-left">
                     <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                         <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2 text-sm"><FileUp size={16}/> Backup & Restore</h4>
                         <p className="text-[10px] text-blue-600 mb-3">Simpan seluruh rekam jejak Anda ke file, atau pulihkan data dari file backup sebelumnya.</p>
                         <div className="flex gap-2">
                            <button onClick={handleExportData} className="flex-1 bg-white border border-blue-200 text-blue-700 font-bold py-2 rounded-lg hover:bg-blue-100 transition-colors text-xs flex items-center justify-center gap-1"><FileDown size={14}/> Export Backup</button>
                            <label className="flex-1 bg-white border border-blue-200 text-blue-700 font-bold py-2 rounded-lg hover:bg-blue-100 transition-colors text-xs flex items-center justify-center gap-1 cursor-pointer">
                                <FileUp size={14}/> Import Restore
                                <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleImportData} />
                            </label>
                         </div>
                     </div>
                     <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl">
                         <h4 className="font-bold text-orange-800 mb-2 flex items-center gap-2 text-sm"><RefreshCw size={16}/> Sapu Bersih (Reset)</h4>
                         <div className="space-y-2">
                             <button onClick={() => handleResetData('this_month')} className="w-full bg-white border border-orange-200 text-orange-700 font-bold py-2 rounded-lg hover:bg-orange-100 transition-colors text-xs">Reset Laporan Bulan Ini</button>
                             <button onClick={() => handleResetData('last_month')} className="w-full bg-white border border-orange-200 text-orange-700 font-bold py-2 rounded-lg hover:bg-orange-100 transition-colors text-xs">Reset Laporan Bulan Lalu</button>
                             <button onClick={() => handleResetData('all')} className="w-full bg-red-600 text-white font-black py-2 rounded-lg hover:bg-red-700 transition-colors text-xs flex items-center justify-center gap-1 mt-2"><AlertTriangle size={14}/> Mulai Baru (Reset Total)</button>
                         </div>
                     </div>
                 </div>
                 <button onClick={handleLogout} className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-900 transition-colors flex items-center justify-center gap-2"><LogOut size={18}/> Keluar Aplikasi</button>
              </div>
           </div>
        )}

        {/* MODAL INFO APP */}
        {showInfoModal && (
           <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
              <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-3xl shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                 <button onClick={() => setShowInfoModal(false)} className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full"><X size={20}/></button>
                 <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center"><img src="/logo.png" alt="Logo" className="w-8 h-8" /></div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Tracker IbadahKU</h2>
                        <p className="text-xs text-orange-600 font-bold tracking-widest">VER 26.08.26 rev16 (Enterprise)</p>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Demo Column */}
                    <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl opacity-70 hover:opacity-100 transition-opacity">
                       <h3 className="text-sm font-black text-slate-700 mb-1 flex items-center gap-2">👀 Akun Demo</h3>
                       <p className="text-[9px] text-slate-500 mb-4 pb-4 border-b border-slate-200">Akses pendaftar baru.</p>
                       <ul className="text-[10px] text-slate-600 space-y-3">
                          <li className="flex gap-2"><Check size={12} className="text-green-500 shrink-0"/> Max 3 Aktivitas Global.</li>
                          <li className="flex gap-2"><Check size={12} className="text-green-500 shrink-0"/> Max 1 Aktivitas Kustom.</li>
                          <li className="flex gap-2"><Check size={12} className="text-green-500 shrink-0"/> Akses Fitur Jurnal & Analisa.</li>
                          <li className="flex gap-2 text-slate-400 opacity-50"><X size={12} className="text-slate-400 shrink-0"/> Dilarang Gabung Grup.</li>
                       </ul>
                    </div>
                    {/* Reguler Column */}
                    <div className="bg-white border-2 border-blue-200 p-5 rounded-2xl shadow-sm">
                       <h3 className="text-sm font-black text-blue-800 mb-1 flex items-center gap-2">👤 User Reguler</h3>
                       <p className="text-[9px] text-blue-600 mb-4 pb-4 border-b border-blue-100">Akses dasar untuk individu aktif.</p>
                       <ul className="text-[10px] text-slate-700 space-y-3">
                          <li className="flex gap-2"><Check size={12} className="text-blue-500 shrink-0"/> Input aktivitas pribadi Unlimited.</li>
                          <li className="flex gap-2"><Check size={12} className="text-blue-500 shrink-0"/> Gabung ke komunitas (Grup).</li>
                          <li className="flex gap-2"><Check size={12} className="text-blue-500 shrink-0"/> Penjadwalan aktivitas berulang.</li>
                          <li className="flex gap-2"><Check size={12} className="text-blue-500 shrink-0"/> Podium Leaderboard Interaktif.</li>
                          <li className="flex gap-2 text-slate-400 opacity-50"><X size={12} className="text-slate-400 shrink-0"/> Buat Grup / Admin Dashboard.</li>
                       </ul>
                    </div>
                    {/* Premium Column */}
                    <div className="bg-gradient-to-b from-orange-50 to-white border-2 border-orange-300 p-5 rounded-2xl shadow-md relative">
                       <div className="absolute top-0 right-0 bg-orange-500 text-white text-[8px] font-black px-2 py-1 rounded-bl-lg rounded-tr-xl uppercase tracking-widest">Premium</div>
                       <h3 className="text-sm font-black text-orange-800 mb-1 flex items-center gap-2">👑 Admin / Leader</h3>
                       <p className="text-[9px] text-orange-600 mb-4 pb-4 border-b border-orange-200">Kontrol penuh tim & komunitas.</p>
                       <ul className="text-[10px] text-orange-800 space-y-3 font-medium">
                          <li className="flex gap-2"><Check size={12} className="text-orange-600 shrink-0"/> Semua fitur Reguler terbuka.</li>
                          <li className="flex gap-2"><Check size={12} className="text-orange-600 shrink-0"/> Buat Komunitas & Kustomisasi.</li>
                          <li className="flex gap-2"><Check size={12} className="text-orange-600 shrink-0"/> Akses Eksklusif Admin Dashboard.</li>
                          <li className="flex gap-2"><Check size={12} className="text-orange-600 shrink-0"/> Broadcast Share Jurnal ke Tim.</li>
                          <li className="flex gap-2"><Check size={12} className="text-orange-600 shrink-0"/> Fitur 'Kick' anggota dari grup.</li>
                       </ul>
                    </div>
                 </div>
              </div>
           </div>
        )}

        {/* MODAL DAFTAR KOMUNITAS AKTIF & SIKLUS 3: Opt #3 OTONOMI LEAVE GROUP */}
        {showMyCommsModal && (
           <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[130] p-4">
              <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
                 <button onClick={() => setShowMyCommsModal(false)} className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full"><X size={20}/></button>
                 <h2 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2"><Users className="text-purple-500"/> Daftar Komunitas Aktif</h2>
                 <p className="text-sm font-semibold text-slate-500 mb-6 border-b pb-4">Grup yang Anda ikuti saat ini</p>
                 <div className="max-h-80 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                     {joinedCommunityIds.map(id => {
                         const c = allCommunities.find(x => x.id === id);
                         if(!c) return null;
                         return (
                             <div key={id} className="bg-slate-50 p-3 rounded-xl border flex justify-between items-center group hover:border-purple-300 transition-colors shadow-sm">
                                <div className="flex flex-col flex-1 pr-2">
                                    <span className="font-bold text-sm text-slate-700 leading-snug">{c.name}</span>
                                    <span className="text-[10px] font-black bg-purple-100 text-purple-700 px-2 py-0.5 mt-1 rounded w-max">{c.activities?.length || 0} Aktivitas</span>
                                </div>
                                <button onClick={() => handleLeaveCommunity(id)} className="text-red-500 hover:text-red-700 bg-white border border-red-200 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm shrink-0" title="Keluar dari Grup">
                                    <LogOut size={14}/>
                                    <span className="text-[10px] font-bold">Keluar</span>
                                </button>
                             </div>
                         )
                     })}
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
                 <p className="text-slate-500 text-sm mb-6">Yakin ingin mengubah status <b>{roleConfirmModal.targetUser?.displayName}</b> menjadi <b>{roleConfirmModal.targetRole.toUpperCase()}</b>?</p>
                 <div className="flex gap-3">
                    <button onClick={() => setRoleConfirmModal({show:false, targetUser:null, targetRole:''})} className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200">Batal</button>
                    <button onClick={executeRoleChange} className="flex-1 bg-orange-600 text-white font-bold py-3 rounded-xl hover:bg-orange-700">Ya, Ubah</button>
                 </div>
              </div>
           </div>
        )}

        {/* MODAL LIHAT/MANAGE MEMBER */}
        {membersModal.show && (
           <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[130] p-4">
              <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
                 <button onClick={() => setMembersModal({show:false, commId:'', commName:'', isAdminView: false})} className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full"><X size={20}/></button>
                 <h2 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2"><Users className="text-blue-500"/> Anggota Grup</h2>
                 <p className="text-sm font-semibold text-slate-500 mb-6 border-b pb-4">{membersModal.commName}</p>
                 <div className="max-h-80 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                     {getCommunityMembersFull(membersModal.commId).map((u, i) => (
                         <div key={u.id} className="bg-slate-50 p-3 rounded-xl border flex justify-between items-center group hover:border-blue-300 transition-colors">
                            <span className="font-bold text-sm text-slate-700">{i+1}. {u.displayName || 'Anonim'}</span>
                            {membersModal.isAdminView && (
                                <button onClick={() => handleKickMember(u.id)} className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1 rounded-lg font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 hover:bg-red-100">
                                   <UserMinus size={12}/> Keluarkan
                                </button>
                            )}
                         </div>
                     ))}
                     {getCommunityMembersFull(membersModal.commId).length === 0 && <p className="text-center text-sm text-slate-400">Belum ada anggota.</p>}
                 </div>
              </div>
           </div>
        )}
        
        {/* MODAL FULL LEADERBOARD */}
        {fullLeaderboardModal.show && (
           <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[130] p-4">
              <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
                 <button onClick={() => setFullLeaderboardModal({show:false, commName:'', boardData: []})} className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full"><X size={20}/></button>
                 <h2 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2"><ListOrdered className="text-blue-500"/> Peringkat Lengkap</h2>
                 <p className="text-sm font-semibold text-slate-500 mb-6 border-b pb-4">{fullLeaderboardModal.commName}</p>
                 <div className="max-h-80 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                     {fullLeaderboardModal.boardData.map((u, i) => (
                         <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${i===0?'bg-yellow-50 border-yellow-200':i===1?'bg-slate-100 border-slate-300':i===2?'bg-orange-50 border-orange-200':'bg-white border-slate-100'}`}>
                            <div className="flex items-center gap-3">
                                <span className={`font-black text-sm w-6 text-center ${i===0?'text-yellow-600':i===1?'text-slate-600':i===2?'text-orange-700':'text-slate-400'}`}>{i+1}</span>
                                <span className="font-bold text-sm text-slate-700 truncate max-w-[180px]">{u.name}</span>
                            </div>
                            <span className="font-black text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">{u.score}%</span>
                         </div>
                     ))}
                     {fullLeaderboardModal.boardData.length === 0 && <p className="text-center text-sm text-slate-400">Belum ada data kompetisi.</p>}
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

        {/* MODAL BUAT AKTIVITAS PRIBADI (Linked System) */}
        {actModal.show && (
           <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
              <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                 <button onClick={() => setActModal({...actModal, show: false})} className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                 <h2 className="text-xl font-bold text-slate-800 mb-4">{actModal.mode === 'add' ? 'Tambah Komitmen Pribadi' : 'Edit Komitmen Pribadi'}</h2>
                 
                 {actModal.mode === 'add' && (
                     <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                        <button onClick={()=>setActModal({...actModal, tab:'global', id: null, name:'', time:'00:00', frequency: 'daily', freqConfig: ''})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${actModal.tab==='global'?'bg-white shadow text-blue-600':'text-slate-500'}`}>Pilih dari Master Global</button>
                        <button onClick={()=>setActModal({...actModal, tab:'custom', id: null, name:'', time:'00:00', frequency: 'daily', freqConfig: ''})} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${actModal.tab==='custom'?'bg-white shadow text-blue-600':'text-slate-500'}`}>Buat Kustom Sendiri</button>
                     </div>
                 )}

                 <div className="space-y-4 mb-6">
                    {actModal.tab === 'global' && actModal.mode === 'add' ? (
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Pilih Aktivitas Global</label>
                            <select value={actModal.id || ''} onChange={e => {
                                const selected = globalActivities.find(g => g.docId === e.target.value);
                                if(selected) setActModal({...actModal, id: selected.docId, name: selected.name, time: selected.time, frequency: selected.frequency || 'daily', freqConfig: selected.freqConfig || ''});
                            }} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-blue-500 outline-none font-medium text-sm">
                                <option value="" disabled>Pilih Aktivitas...</option>
                                {globalActivities.filter(g => !personalActivities.find(p => p.id === g.docId)).map(g => (
                                    <option key={g.docId} value={g.docId}>{g.name}</option>
                                ))}
                            </select>
                            <p className="text-[10px] text-slate-500 mt-2 italic">*Jika grup Anda juga mewajibkan aktivitas ini, pelaporan akan terhubung (Linked) otomatis.</p>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Nama Aktivitas</label>
                            <input type="text" value={actModal.name} onChange={e => setActModal({...actModal, name: e.target.value})} placeholder="Cth: Olahraga Pagi" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-blue-500 outline-none font-medium text-sm" disabled={actModal.tab === 'global'}/>
                            {actModal.tab === 'global' && <p className="text-[10px] text-orange-500 mt-1 italic">*Nama Master Global tidak bisa diubah di sini.</p>}
                        </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-xs font-bold text-slate-600 mb-1">Jam Target</label>
                            <input type="time" value={actModal.time} onChange={e => setActModal({...actModal, time: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-blue-500 outline-none" />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-xs font-bold text-slate-600 mb-1">Pengulangan</label>
                            <select value={actModal.frequency} onChange={e => setActModal({...actModal, frequency: e.target.value, freqConfig: ''})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-blue-500 outline-none text-xs font-medium cursor-pointer">
                                <option value="daily">Daily (Harian)</option>
                                <option value="weekly">Weekly (Mingguan)</option>
                                <option value="biweekly">Bi-Weekly (2-Mingguan)</option>
                                <option value="monthly">Monthly (Bulanan)</option>
                            </select>
                        </div>
                    </div>
                    
                    {/* FREQ CONFIG INPUTS */}
                    {actModal.frequency === 'weekly' && (
                       <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Pilih Hari Wajib</label>
                          <div className="flex gap-1.5 justify-between">
                             {WEEKDAYS_SHORT.map((day, idx) => {
                                const isSel = actModal.freqConfig.split(',').includes(String(idx));
                                return (
                                   <button key={idx} onClick={() => {
                                      let days = actModal.freqConfig ? actModal.freqConfig.split(',') : [];
                                      if(days.includes(String(idx))) days = days.filter(d => d !== String(idx));
                                      else days.push(String(idx));
                                      setActModal({...actModal, freqConfig: days.join(',')});
                                   }} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-colors ${isSel ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-500'}`}>{day}</button>
                                );
                             })}
                          </div>
                       </div>
                    )}
                    {actModal.frequency === 'monthly' && (
                       <div className="mt-2">
                           <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tentukan Tanggal Wajib</label>
                           <input type="text" placeholder="Cth: 1, 15, 28" value={actModal.freqConfig} onChange={e => setActModal({...actModal, freqConfig: e.target.value.replace(/[^0-9, ]/g, '')})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:border-blue-500 outline-none" />
                           <p className="text-[9px] text-slate-400 mt-1 italic">Pisahkan dengan koma jika lebih dari satu tanggal.</p>
                       </div>
                    )}
                    {actModal.frequency === 'biweekly' && (
                       <div className="mt-2">
                           <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tanggal Mulai (Anchor Date)</label>
                           <input type="date" value={actModal.freqConfig} onChange={e => setActModal({...actModal, freqConfig: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:border-blue-500 outline-none" />
                           <p className="text-[9px] text-slate-400 mt-1 italic">Sistem akan membuka kolom otomatis setiap kelipatan 14 hari dari tanggal ini.</p>
                       </div>
                    )}

                 </div>
                 <button onClick={saveActivity} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 shadow-lg transition-transform hover:-translate-y-0.5">Simpan ke Tabel</button>
              </div>
           </div>
        )}

        {/* ================= ADMIN DASHBOARD ================= */}
        {showAdminPanel && isAdmin && (
           <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
              <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-6xl shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                 <button onClick={() => {setShowAdminPanel(false); setEditCommId(null); setNewCommName(''); setSelectedActs([]); setEditGlobalActId(null); setNewGlobalAct({name: '', time: '00:00', frequency: 'daily', freqConfig: ''});}} className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full"><X size={20}/></button>
                 <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-3"><Shield className="text-blue-500"/> {isSuperAdmin ? 'Super Admin Dashboard' : 'Admin Dashboard'}</h2>
                 <p className="text-sm text-slate-500 mb-6 border-b pb-4">Kelola Komunitas Gamifikasi dan Pantau Anggota Anda.</p>
                 
                 <div className="flex border-b border-slate-200 mb-6 gap-6 overflow-x-auto custom-scrollbar pb-1">
                    <button onClick={()=>setAdminTab('users')} className={`pb-3 font-bold transition-all border-b-2 whitespace-nowrap ${adminTab === 'users' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Pantau Anggota</button>
                    <button onClick={()=>{setAdminTab('communities'); setEditCommId(null); setNewCommName(''); setSelectedActs([]);}} className={`pb-3 font-bold transition-all border-b-2 whitespace-nowrap ${adminTab === 'communities' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Kelola Komunitas & Kode Join</button>
                    {isSuperAdmin && <button onClick={()=>{setAdminTab('globalacts'); setEditGlobalActId(null); setNewGlobalAct({name: '', time: '00:00', frequency: 'daily', freqConfig: ''});}} className={`pb-3 font-bold transition-all border-b-2 whitespace-nowrap ${adminTab === 'globalacts' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Master Ibadah Global</button>}
                    {isSuperAdmin && <button onClick={()=>setAdminTab('characters')} className={`pb-3 font-bold transition-all border-b-2 whitespace-nowrap ${adminTab === 'characters' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Top Karakter Disiplin</button>}
                 </div>

                 {adminTab === 'users' ? (
                    <div>
                       <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
                          <div className="relative w-full sm:w-64">
                             <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                             <input type="text" placeholder="Cari nama atau email..." value={adminSearch} onChange={e => setAdminSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"/>
                          </div>
                          <select value={adminSort} onChange={(e:any) => setAdminSort(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none font-bold text-slate-600 cursor-pointer">
                             <option value="newest">Terakhir Login (Terbaru)</option>
                             <option value="oldest">Terakhir Login (Terlama)</option>
                             <option value="az">Nama (A-Z)</option>
                             <option value="za">Nama (Z-A)</option>
                             <option value="role">Hak Akses (Role)</option>
                          </select>
                       </div>
                       <div className="overflow-x-auto border border-slate-100 rounded-xl custom-scrollbar">
                          <table className="w-full text-left text-sm min-w-[900px]">
                             <thead className="bg-slate-50 text-slate-600 border-b border-slate-100">
                                <tr>
                                    <th className="p-4 font-bold">Nama & Komunitas</th>
                                    <th className="p-4 font-bold">Email</th>
                                    <th className="p-4 font-bold">Status (Aktif/Login)</th>
                                    {isSuperAdmin && <th className="p-4 font-bold text-center">Limit Grup</th>}
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
                                   
                                   const usrComms = u.joinedCommunities?.map((id:string) => allCommunities.find(c=>c.id===id)?.name).filter(Boolean).join(', ') || 'Tidak ada';
                                   const isUAdmin = u.role === 'admin' || u.role === 'superadmin';

                                   return (
                                   <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="p-4">
                                          <div className="flex items-center gap-2">
                                             <p className="font-bold text-slate-800">{u.displayName || 'Anonim'}</p>
                                             {u.role === 'superadmin' && <span className="text-[8px] bg-red-100 text-red-700 px-1 rounded uppercase font-black">Super</span>}
                                             {u.role === 'admin' && <span className="text-[8px] bg-orange-100 text-orange-700 px-1 rounded uppercase font-black">Admin</span>}
                                             {u.role === 'demo' && <span className="text-[8px] bg-slate-200 text-slate-500 px-1 rounded uppercase font-black">Demo</span>}
                                          </div>
                                          <p className="text-[9px] font-semibold text-slate-500 uppercase mt-1">Komunitas: <span className="text-blue-600">{usrComms}</span></p>
                                      </td>
                                      <td className="p-4 text-slate-500 text-xs">{u.email || '-'}</td>
                                      <td className="p-4">{actStatus}</td>
                                      {isSuperAdmin && (
                                         <td className="p-4 text-center">
                                            {isUAdmin ? (
                                                <select value={u.communityLimit || 1} onChange={(e)=>handleUpdateCommunityLimit(u.id, Number(e.target.value))} className="bg-slate-50 border border-slate-200 text-xs px-2 py-1.5 rounded outline-none font-bold text-slate-700 cursor-pointer focus:border-blue-500">
                                                   <option value={1}>1 Grup</option><option value={3}>3 Grup</option><option value={5}>5 Grup</option><option value={999}>Unlimited</option>
                                                </select>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-1 rounded">Bukan Admin</span>
                                            )}
                                         </td>
                                      )}
                                      {isSuperAdmin && (
                                         <td className="p-4 text-center">
                                            <select 
                                                value={u.role || 'demo'} 
                                                onChange={(e) => setRoleConfirmModal({ show: true, targetUser: u, targetRole: e.target.value })} 
                                                disabled={u.email === 'coachardi1453@gmail.com'} 
                                                className={`bg-white border text-[10px] font-bold uppercase transition-colors shadow-sm px-2 py-1.5 rounded cursor-pointer outline-none ${u.role === 'superadmin' ? 'border-red-300 text-red-700' : u.role === 'admin' ? 'border-orange-300 text-orange-700' : u.role === 'user' ? 'border-blue-300 text-blue-700' : 'border-slate-300 text-slate-500'}`}
                                            >
                                                <option value="demo">Demo</option>
                                                <option value="user">Reguler</option>
                                                <option value="admin">Admin</option>
                                                {u.email === 'coachardi1453@gmail.com' && <option value="superadmin">Superadmin</option>}
                                            </select>
                                         </td>
                                      )}
                                   </tr>
                                )})}
                                {filteredAdminUsers.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">Tidak ada anggota ditemukan.</td></tr>}
                             </tbody>
                          </table>
                       </div>
                    </div>
                 ) : adminTab === 'communities' ? (
                    <div>
                       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                           <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 h-max">
                              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">{editCommId ? <><Edit3 size={18}/> Edit Komunitas</> : <><Plus size={18}/> Buat Komunitas Baru</>}</h3>
                              <input type="text" placeholder="Nama Komunitas (Cth: Tim Sales MIP)" value={newCommName} onChange={e => setNewCommName(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-3 mb-4 text-sm focus:border-blue-500 outline-none font-bold" />
                              <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest text-left w-full">Pilih & Atur Jam (Master Global)</p>
                              <div className="space-y-2 h-[350px] overflow-y-auto bg-white p-3 rounded-xl border border-slate-200 mb-4 custom-scrollbar">
                                 {globalActivities.map(act => {
                                    const isSel = selectedActs.find(a => a.id === act.docId);
                                    return (
                                    <div key={act.docId} className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${isSel ? 'bg-blue-50 border-blue-200' : 'border-transparent hover:bg-slate-50'}`}>
                                       <label className="flex items-center gap-3 cursor-pointer flex-1">
                                          <input type="checkbox" checked={!!isSel} onChange={() => { if(isSel) setSelectedActs(selectedActs.filter(a=>a.id!==act.docId)); else setSelectedActs([...selectedActs, {id:act.docId, time:act.time}]); }} className="w-4 h-4 rounded text-blue-600" />
                                          <div className="flex flex-col items-start text-left">
                                             <span className="text-sm font-semibold text-slate-700">{act.name}</span>
                                             <span className="text-[9px] text-slate-400 font-medium uppercase tracking-widest">{getFreqLabel(act.frequency)}</span>
                                          </div>
                                       </label>
                                       {isSel && <input type="time" value={isSel.time} onChange={(e) => setSelectedActs(selectedActs.map(a => a.id===act.docId ? {...a, time:e.target.value} : a))} className="bg-white border border-blue-200 text-xs px-2 py-1 rounded outline-none text-blue-700 font-bold shadow-sm" />}
                                    </div>
                                 )})}
                              </div>
                              <div className="flex gap-2">
                                 {editCommId && <button onClick={()=>{setEditCommId(null); setNewCommName(''); setSelectedActs([]);}} className="px-4 bg-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-300">Batal</button>}
                                 <button onClick={handleSaveCommunity} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 shadow-md transition-colors">{editCommId ? 'Simpan Perubahan' : 'Generate Kode & Buat'}</button>
                              </div>
                           </div>
                           
                           {/* TAB KELOLA KOMUNITAS KANAN */}
                           <div>
                              <div className="flex border-b border-slate-200 mb-4 gap-4">
                                  <button onClick={() => setAdminCommTab('my')} className={`pb-2 font-bold text-sm border-b-2 transition-colors ${adminCommTab === 'my' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Komunitas Anda</button>
                                  {isSuperAdmin && (
                                      <button onClick={() => setAdminCommTab('others')} className={`pb-2 font-bold text-sm border-b-2 transition-colors ${adminCommTab === 'others' ? 'text-red-600 border-red-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Komunitas Admin Lain</button>
                                  )}
                              </div>

                              {adminCommTab === 'my' ? (
                                  <div className="space-y-4 max-h-[550px] overflow-y-auto pr-2 custom-scrollbar">
                                     <p className="text-xs font-bold text-slate-500 mb-2 bg-slate-100 px-3 py-1.5 rounded-lg inline-block text-left w-full">Limit: {allCommunities.filter(c => c.ownerId === user.uid).length} / {isSuperAdmin ? 'Unlimited' : myCommunityLimit}</p>
                                     {allCommunities.filter(c => c.ownerId === user.uid).map(c => (
                                        <div key={c.id} className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col xl:flex-row justify-between group hover:border-blue-300 transition-colors shadow-sm gap-4 items-start text-left">
                                           <div className="flex flex-col items-start w-full xl:w-auto flex-1">
                                              <div className="flex items-center gap-2 mb-1 w-full justify-start">
                                                  <p className="font-black text-slate-800 text-lg">{c.name}</p>
                                                  <button onClick={()=>{setEditCommId(c.id); setNewCommName(c.name); setSelectedActs(c.activities||[]);}} className="text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 p-1.5 rounded-lg transition-colors"><Edit3 size={14}/></button>
                                                  <button onClick={()=>handleDeleteCommunity(c.id)} className="text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 p-1.5 rounded-lg transition-colors"><Trash2 size={14}/></button>
                                              </div>
                                              <p className="text-[10px] text-slate-500 font-bold uppercase mb-3 text-left w-full">{c.activities?.length || 0} Aktivitas Wajib</p>
                                              <button onClick={() => setMembersModal({show:true, commId: c.id, commName: c.name, isAdminView: true})} className="text-xs bg-slate-50 border border-slate-200 text-slate-600 font-bold px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-100 transition-colors self-start w-max">
                                                  <Users size={14}/> Kelola {getCommunityMembersFull(c.id).length} Anggota
                                              </button>
                                           </div>
                                           <div className="text-left xl:text-right mt-2 xl:mt-0 flex flex-col items-start xl:items-end w-full xl:w-auto">
                                              <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Kode Join</p>
                                              <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-xl border border-blue-100 w-max">
                                                 <span className="font-black text-blue-700 tracking-widest text-lg">{c.joinCode}</span>
                                                 <button onClick={()=>{navigator.clipboard.writeText(c.joinCode); showToast("Disalin!");}} className="text-blue-400 hover:text-blue-600 bg-white p-1 rounded shadow-sm"><Copy size={14}/></button>
                                              </div>
                                           </div>
                                        </div>
                                     ))}
                                     {allCommunities.filter(c => c.ownerId === user.uid).length === 0 && <p className="text-sm text-center py-8 text-slate-400 italic border-2 border-dashed border-slate-200 rounded-2xl">Anda belum membuat komunitas.</p>}
                                  </div>
                              ) : (
                                  <div className="space-y-4 max-h-[550px] overflow-y-auto pr-2 custom-scrollbar">
                                     <p className="text-xs font-bold text-red-500 mb-2 bg-red-50 px-3 py-1.5 rounded-lg inline-block flex items-center gap-1.5 w-max"><Eye size={14}/> God-Eye View</p>
                                     {allCommunities.filter(c => c.ownerId !== user.uid).map(c => (
                                        <div key={c.id} className="bg-red-50 border border-red-100 p-5 rounded-2xl flex flex-col xl:flex-row justify-between group hover:border-red-300 transition-colors shadow-sm gap-4 items-start text-left">
                                           <div className="flex flex-col items-start w-full xl:w-auto flex-1">
                                              <div className="flex items-center gap-2 mb-1 w-full justify-start">
                                                  <p className="font-black text-slate-800 text-lg">{c.name}</p>
                                                  <button onClick={()=>{setEditCommId(c.id); setNewCommName(c.name); setSelectedActs(c.activities||[]);}} className="text-slate-400 hover:text-blue-600 bg-white hover:bg-blue-50 p-1.5 rounded-lg transition-colors shadow-sm"><Edit3 size={14}/></button>
                                                  <button onClick={()=>handleDeleteCommunity(c.id)} className="text-slate-400 hover:text-red-600 bg-white hover:bg-red-50 p-1.5 rounded-lg transition-colors shadow-sm"><Trash2 size={14}/></button>
                                              </div>
                                              <p className="text-[10px] text-slate-500 font-bold uppercase mb-3 text-left w-full">{c.activities?.length || 0} Aktivitas Wajib</p>
                                              <button onClick={() => setMembersModal({show:true, commId: c.id, commName: c.name, isAdminView: true})} className="text-xs bg-white border border-red-200 text-red-700 font-bold px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-red-100 transition-colors shadow-sm mb-3 self-start w-max">
                                                  <Users size={14}/> Kelola {getCommunityMembersFull(c.id).length} Anggota
                                              </button>
                                              <p className="text-[9px] text-red-500 font-black uppercase tracking-widest bg-white inline-block px-2 py-1 rounded border border-red-100 shadow-sm w-max self-start mt-1">Pembuat: {c.ownerName || 'Unknown'}</p>
                                           </div>
                                           <div className="text-left xl:text-right mt-2 xl:mt-0 flex flex-col items-start xl:items-end w-full xl:w-auto">
                                              <p className="text-[9px] text-red-400 font-bold uppercase mb-1">Kode Join</p>
                                              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-red-200 shadow-sm w-max">
                                                 <span className="font-black text-red-700 tracking-widest text-lg">{c.joinCode}</span>
                                                 <button onClick={()=>{navigator.clipboard.writeText(c.joinCode); showToast("Disalin!");}} className="text-red-400 hover:text-red-600 bg-red-50 p-1 rounded shadow-sm"><Copy size={14}/></button>
                                              </div>
                                           </div>
                                        </div>
                                     ))}
                                     {allCommunities.filter(c => c.ownerId !== user.uid).length === 0 && <p className="text-sm text-center py-8 text-slate-400 italic border-2 border-dashed border-slate-200 rounded-2xl">Belum ada admin lain yang membuat komunitas.</p>}
                                  </div>
                              )}
                           </div>
                       </div>
                    </div>
                 ) : adminTab === 'globalacts' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100 h-max sticky top-0">
                          <h3 className="font-bold text-orange-800 mb-2 flex items-center gap-2">{editGlobalActId ? <><Edit3 size={18}/> Edit Master Ibadah</> : <><Plus size={18}/> Tambah Master Ibadah Global</>}</h3>
                          <p className="text-xs text-orange-700 mb-6">Aktivitas ini akan muncul di daftar pilihan saat Admin membuat komunitas baru.</p>
                          <input type="text" placeholder="Nama Ibadah" value={newGlobalAct.name} onChange={e => setNewGlobalAct({...newGlobalAct, name: e.target.value})} className="w-full bg-white border border-orange-200 rounded-xl p-3 mb-4 text-sm focus:border-orange-500 outline-none font-bold" />
                          <div className="grid grid-cols-2 gap-4 mb-4">
                              <div className="col-span-2 sm:col-span-1">
                                  <label className="block text-[10px] font-bold text-orange-600 uppercase mb-1">Jam Default</label>
                                  <input type="time" value={newGlobalAct.time} onChange={e => setNewGlobalAct({...newGlobalAct, time: e.target.value})} className="w-full bg-white border border-orange-200 rounded-xl p-3 text-sm focus:border-orange-500 outline-none font-bold" />
                              </div>
                              <div className="col-span-2 sm:col-span-1">
                                  <label className="block text-[10px] font-bold text-orange-600 uppercase mb-1">Pengulangan</label>
                                  <select value={newGlobalAct.frequency} onChange={e => setNewGlobalAct({...newGlobalAct, frequency: e.target.value, freqConfig: ''})} className="w-full bg-white border border-orange-200 rounded-xl p-3 text-xs font-bold focus:border-orange-500 outline-none cursor-pointer">
                                      <option value="daily">Daily (Harian)</option>
                                      <option value="weekly">Weekly (Mingguan)</option>
                                      <option value="biweekly">Bi-Weekly (2-Mingguan)</option>
                                      <option value="monthly">Monthly (Bulanan)</option>
                                  </select>
                              </div>
                          </div>
                          
                          {newGlobalAct.frequency === 'weekly' && (
                             <div className="mb-4">
                                <label className="block text-[10px] font-bold text-orange-600 uppercase mb-2">Pilih Hari Wajib</label>
                                <div className="flex gap-1.5 justify-between">
                                   {WEEKDAYS_SHORT.map((day, idx) => {
                                      const isSel = newGlobalAct.freqConfig.split(',').includes(String(idx));
                                      return (
                                         <button key={idx} onClick={() => {
                                            let days = newGlobalAct.freqConfig ? newGlobalAct.freqConfig.split(',') : [];
                                            if(days.includes(String(idx))) days = days.filter(d => d !== String(idx));
                                            else days.push(String(idx));
                                            setNewGlobalAct({...newGlobalAct, freqConfig: days.join(',')});
                                         }} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-colors ${isSel ? 'bg-orange-600 text-white shadow-sm' : 'bg-white border border-orange-200 text-orange-600'}`}>{day}</button>
                                      );
                                   })}
                                </div>
                             </div>
                          )}
                          {newGlobalAct.frequency === 'monthly' && (
                             <div className="mb-4">
                                 <label className="block text-[10px] font-bold text-orange-600 uppercase mb-1">Tanggal Wajib (Pisahkan dengan koma)</label>
                                 <input type="text" placeholder="Cth: 1, 15, 30" value={newGlobalAct.freqConfig} onChange={e => setNewGlobalAct({...newGlobalAct, freqConfig: e.target.value.replace(/[^0-9, ]/g, '')})} className="w-full bg-white border border-orange-200 rounded-xl p-3 text-sm focus:border-orange-500 outline-none" />
                             </div>
                          )}
                          {newGlobalAct.frequency === 'biweekly' && (
                             <div className="mb-4">
                                 <label className="block text-[10px] font-bold text-orange-600 uppercase mb-1">Tanggal Mulai (Anchor Date)</label>
                                 <input type="date" value={newGlobalAct.freqConfig} onChange={e => setNewGlobalAct({...newGlobalAct, freqConfig: e.target.value})} className="w-full bg-white border border-orange-200 rounded-xl p-3 text-sm focus:border-orange-500 outline-none" />
                             </div>
                          )}

                          <div className="flex gap-2 mt-4">
                             {editGlobalActId && <button onClick={()=>{setEditGlobalActId(null); setNewGlobalAct({name: '', time: '00:00', frequency: 'daily', freqConfig: ''});}} className="px-4 bg-orange-200 text-orange-800 font-bold rounded-xl hover:bg-orange-300">Batal</button>}
                             <button onClick={handleAddGlobalActivity} className="flex-1 bg-orange-600 text-white font-bold py-3 rounded-xl hover:bg-orange-700 shadow-md transition-colors">{editGlobalActId ? 'Simpan Perubahan' : 'Tambahkan ke Master Global'}</button>
                          </div>
                          {editGlobalActId && <p className="text-[9px] text-orange-500 mt-4 font-bold italic leading-relaxed text-center">*Peringatan: Perubahan NAMA di sini akan otomatis mensinkronkan ulang dan merubah nama di tabel komitmen pribadi maupun komunitas seluruh user (Force-Sync).</p>}
                       </div>
                       <div>
                          <h3 className="font-bold text-slate-800 mb-4 text-left w-full">Daftar Master Global ({globalActivities.length})</h3>
                          <div className="space-y-2 h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                             {globalActivities.map(act => (
                                <div key={act.docId} className={`flex justify-between items-center bg-slate-50 border p-4 rounded-xl shadow-sm transition-colors ${editGlobalActId === act.docId ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-orange-300'}`}>
                                   <div className="flex flex-col items-start text-left min-w-0">
                                      <span className="font-bold text-slate-700 truncate w-full">{act.name}</span>
                                      <span className="text-[9px] text-slate-400 font-medium uppercase tracking-widest mt-0.5 w-full">{getFreqLabel(act.frequency)}</span>
                                   </div>
                                   <div className="flex items-center gap-3 shrink-0 ml-4">
                                       <span className="text-xs font-black text-orange-600 bg-orange-100 border border-orange-200 px-2 py-1 rounded shadow-sm">{act.time}</span>
                                       <button onClick={()=>{setEditGlobalActId(act.docId); setNewGlobalAct({name: act.name, time: act.time, frequency: act.frequency || 'daily', freqConfig: act.freqConfig || ''});}} className="text-slate-400 hover:text-orange-600 bg-white p-2 rounded-lg shadow-sm border border-slate-200 transition-colors"><Edit3 size={14}/></button>
                                   </div>
                                </div>
                             ))}
                          </div>
                       </div>
                    </div>
                 ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* TAB KARAKTER DISIPLIN TERBAIK (SUPER ADMIN ONLY) */}
                        <div className="bg-white border border-red-200 p-6 rounded-2xl shadow-sm">
                            <h3 className="text-lg font-black text-red-600 mb-4 flex items-center gap-2 border-b border-red-100 pb-3"><Flame size={20}/> Top 5 Daily Streak 🔥</h3>
                            <div className="space-y-3">
                               {[...allUsers].sort((a,b) => (b.daily_streak||0) - (a.daily_streak||0)).slice(0,5).map((u,i) => (
                                  <div key={i} className="flex justify-between items-center bg-red-50 p-3 rounded-xl border border-red-100">
                                      <span className="font-bold text-sm text-slate-700">{i+1}. {u.displayName || 'Anonim'}</span>
                                      <span className="font-black text-red-600 text-sm">{u.daily_streak||0} Hari</span>
                                  </div>
                               ))}
                               {allUsers.length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">Belum ada data.</p>}
                            </div>
                        </div>
                        <div className="bg-white border border-green-200 p-6 rounded-2xl shadow-sm">
                            <h3 className="text-lg font-black text-green-600 mb-4 flex items-center gap-2 border-b border-green-100 pb-3"><Heart size={20}/> Top 5 Kesehatan Disiplin</h3>
                            <div className="space-y-3">
                               {[...allUsers].sort((a,b) => (b.hp_score||0) - (a.hp_score||0)).slice(0,5).map((u,i) => (
                                  <div key={i} className="flex justify-between items-center bg-green-50 p-3 rounded-xl border border-green-100">
                                      <span className="font-bold text-sm text-slate-700">{i+1}. {u.displayName || 'Anonim'}</span>
                                      <span className="font-black text-green-600 text-sm">{u.hp_score||0} HP</span>
                                  </div>
                               ))}
                               {allUsers.length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">Belum ada data.</p>}
                            </div>
                        </div>
                    </div>
                 )}
              </div>
           </div>
        )}

        {/* ================= TOMBOL SIMPAN MELAYANG (DENGAN UNDO/REDO MENCOLOK) ================= */}
        {hasUnsavedChanges && (
           <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[80] w-full px-4 sm:w-auto sm:px-0 flex items-center justify-center gap-4 pointer-events-none">
              
              {/* Tombol Undo */}
              {pastRecords.length > 0 && (
                  <button onClick={handleUndo} className="pointer-events-auto flex flex-col items-center bg-blue-600 text-white p-3 rounded-xl shadow-[0_10px_30px_rgba(37,99,235,0.6)] hover:bg-blue-700 hover:-translate-y-1 transition-all border-2 border-blue-400" title="Batal (Undo)">
                      <Undo2 size={24} />
                      <span className="text-[10px] font-black uppercase tracking-widest mt-1">Batal</span>
                  </button>
              )}

              {/* Tombol Simpan */}
              <button onClick={() => saveToServer(false)} disabled={isSaving} className="pointer-events-auto bg-orange-600 text-white px-10 py-5 rounded-full font-black text-lg flex items-center justify-center gap-3 shadow-[0_10px_40px_rgba(249,115,22,0.6)] hover:bg-orange-700 hover:-translate-y-1 transition-all animate-bounce border-2 border-orange-400">
                  {isSaving ? <RefreshCw className="animate-spin" size={24} /> : <Save size={24} />}
                  {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>

              {/* Tombol Redo */}
              {futureRecords.length > 0 && (
                  <button onClick={handleRedo} className="pointer-events-auto flex flex-col items-center bg-blue-600 text-white p-3 rounded-xl shadow-[0_10px_30px_rgba(37,99,235,0.6)] hover:bg-blue-700 hover:-translate-y-1 transition-all border-2 border-blue-400" title="Ulangi (Redo)">
                      <Redo2 size={24} />
                      <span className="text-[10px] font-black uppercase tracking-widest mt-1">Ulangi</span>
                  </button>
              )}
           </div>
        )}

        {/* ================= AREA KONTEN UTAMA ================= */}
        <div className="max-w-7xl mx-auto space-y-8 pb-40">
          
          {/* HEADER STICKY DASHBOARD (OPTIMASI #1: Compact & Sleek) */}
          <div className="sticky top-0 z-[100] bg-white/90 backdrop-blur-md rounded-b-3xl shadow-sm border-b border-slate-200 py-3 px-4 sm:px-6 flex flex-row justify-between items-center gap-4 transition-all">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white rounded-full border-2 border-orange-500 flex items-center justify-center shadow-md shrink-0">
                  <img src="/logo.png" alt="Logo" className="w-[70%] h-[70%] object-contain" />
              </div>
              <div className="hidden sm:block">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-wide">Tafkir Corp</h1>
                  <p className="text-[9px] sm:text-xs text-orange-600 font-bold uppercase tracking-[0.2em] mt-0.5">Tracker Ibadah & Hal Positif</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
               {/* USER INFO HORIZONTAL ROW */}
               <div className="flex flex-row items-center bg-white/60 px-3 py-1.5 sm:py-2 rounded-xl border border-slate-200 gap-3 shadow-sm">
                 <div className="text-[11px] sm:text-sm font-bold text-slate-800 flex items-center gap-1.5 sm:gap-2 border-r border-slate-300 pr-3">
                     <span className="truncate max-w-[70px] sm:max-w-[120px]">{user.displayName?.split(' ')[0]}</span>
                     {isSuperAdmin ? <span className="text-[8px] sm:text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-black uppercase tracking-widest border border-red-200 shadow-sm">Super</span> : isAdmin ? <span className="text-[8px] sm:text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-black uppercase tracking-widest border border-orange-200 shadow-sm">Admin</span> : userRole === 'user' ? <span className="text-[8px] sm:text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-black uppercase tracking-widest border border-blue-200 shadow-sm">Reguler</span> : <span className="text-[8px] sm:text-[9px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-black uppercase tracking-widest border border-slate-300 shadow-sm">Demo</span>}
                 </div>
                 <div className="text-[8px] sm:text-[10px] font-bold flex items-center">
                     {isSyncing ? <span className="text-blue-500 flex items-center gap-1"><RefreshCw size={10} className="animate-spin"/> Syncing</span> : <span className="text-green-600 flex items-center gap-1"><Zap size={10}/> Synced</span>}
                 </div>
               </div>
               
               <button onClick={() => setShowInfoModal(true)} className="p-1.5 sm:px-3 sm:py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 rounded-xl transition-all shadow-sm flex items-center gap-1.5">
                   <Info size={16}/> <span className="hidden sm:block text-[10px] font-bold uppercase tracking-wide">Info</span>
               </button>
               
               {isAdmin && ( 
               <button onClick={() => setShowAdminPanel(true)} className="p-1.5 sm:px-3 sm:py-1.5 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-xl transition-all shadow-sm flex items-center gap-1.5">
                   <Shield size={16}/> <span className="hidden sm:block text-[10px] font-bold uppercase tracking-wide">Admin</span>
               </button> 
               )}
               
               <button onClick={() => setShowSettingsModal(true)} className="p-1.5 sm:px-3 sm:py-1.5 bg-slate-800 border border-slate-900 text-white hover:bg-slate-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5">
                   <Settings size={16}/> <span className="hidden sm:block text-[10px] font-bold uppercase tracking-wide">Pengaturan</span>
               </button>
            </div>
          </div>

          {/* ================= MAIN TABLE HISAB ================= */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm relative overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50 flex flex-col items-center gap-6">
               
               {/* 3 BADGE PROGRESS */}
               <div className="w-full flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-6 mb-2">
                  <div className="flex items-center gap-3 bg-white border border-slate-200 px-5 py-2.5 rounded-2xl shadow-sm">
                     <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">👤 Pribadi</span>
                     <span className="text-xl font-black text-blue-600">{stats.scorePribadi}%</span>
                  </div>
                  <div className={`px-10 py-4 rounded-3xl shadow-lg border text-center relative overflow-hidden ${stats.scoreGabungan >= 50 ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white border-green-600' : 'bg-gradient-to-r from-orange-500 to-red-500 text-white border-orange-600'}`}>
                     <div className="absolute top-0 left-0 w-full h-full bg-white/10 transform -skew-x-12"></div>
                     <p className="text-[10px] uppercase tracking-widest font-bold opacity-90 mb-1 relative z-10">Total Progress</p>
                     <p className="text-3xl font-black tracking-tight relative z-10">GABUNGAN: {stats.scoreGabungan}%</p>
                  </div>
                  <div className="flex items-center gap-3 bg-white border border-slate-200 px-5 py-2.5 rounded-2xl shadow-sm">
                     <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">👥 Komunitas</span>
                     <span className="text-xl font-black text-purple-600">{stats.scoreKomunitas}%</span>
                  </div>
               </div>

               <div className="flex flex-col lg:flex-row justify-between w-full gap-6 items-center">
                  <div className="flex flex-col items-center lg:items-start gap-3 w-full lg:w-auto">
                     <div className="flex flex-wrap justify-center lg:justify-start items-center gap-2 sm:gap-3">
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 mr-2">
                            <span className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]"></span> Tabel Hisab 
                        </h2>
                        {/* TOMBOL UX DI ATAS TABEL */}
                        <div className="flex items-center gap-2">
                           <button onClick={handleOpenAddAct} className="bg-blue-50 border border-blue-200 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold text-blue-700 hover:bg-blue-100 shadow-sm flex items-center gap-1.5 transition-colors"><Plus size={16}/> Buat Sendiri</button>
                           <button onClick={() => { if(userRole === 'demo') return showToast("AKUN DEMO dilarang bergabung grup komunitas. Hubungi Super Admin."); setShowJoinModal(true); }} className={`bg-purple-50 border border-purple-200 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors ${userRole === 'demo' ? 'opacity-50 grayscale cursor-not-allowed text-purple-500' : 'text-purple-700 hover:bg-purple-100'}`}><KeyRound size={16}/> Gabung Grup</button>
                        </div>
                     </div>
                     
                     {/* SIKLUS 2: Opt #1 - SMART TRUNCATION HEADER */}
                     {joinedCommunityNamesArray.length > 0 && (
                         <button onClick={() => setShowMyCommsModal(true)} className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1.5 bg-slate-200/80 hover:bg-slate-300 px-3 py-1.5 rounded-lg max-w-full truncate border border-slate-300 transition-colors shadow-sm cursor-pointer">
                             <Users size={12} className="text-slate-500"/> Komunitas Anda: <span className="text-slate-800">{displayCommText}</span>
                         </button>
                     )}
                  </div>
                  
                  <div className="flex items-center gap-2 sm:gap-4 bg-white border border-slate-200 p-1.5 rounded-2xl shadow-sm">
                     <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"><ChevronLeft size={20}/></button>
                     <div className="w-32 sm:w-40 text-center font-black text-slate-800 text-sm sm:text-base tracking-wide">
                         {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
                     </div>
                     <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"><ChevronRight size={20}/></button>
                     <div className="w-px h-8 bg-slate-200 mx-1"></div>
                     <button onClick={scrollToToday} className="flex items-center gap-1.5 bg-orange-50 text-orange-600 px-4 sm:px-5 py-2.5 rounded-xl text-[10px] sm:text-xs font-black hover:bg-orange-100 transition-colors">👉 <span className="hidden sm:block uppercase tracking-widest">Hari Ini</span></button>
                  </div>
               </div>
            </div>
            
            {/* CONTAINER TABEL COMPACT (Max-h-[85vh] vertikal, ruang sentuh min-w-[56px] lebar horizontal) */}
            <div className="overflow-x-auto overflow-y-auto max-h-[85vh] custom-scrollbar" ref={tableContainerRef}>
              <table className="w-full text-xs border-collapse">
                
                {/* --- HEADER STICKY TINGKAT 1 --- */}
                <thead className="sticky top-0 z-[50] bg-slate-100 shadow-md">
                  <tr>
                    {/* SUDUT KIRI ATAS MUTLAK */}
                    <th className="text-left text-slate-800 font-black p-4 sticky left-0 top-0 z-[60] bg-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[200px] sm:min-w-[280px]">
                        Ibadah & Aktivitas Positif KU
                    </th>
                    {daysInMonth.map(d => {
                      const isActToday = d.getDate() === todayDateObj.getDate() && d.getMonth() === todayDateObj.getMonth() && d.getFullYear() === todayDateObj.getFullYear();
                      return (
                         <th key={d.toISOString()} ref={isActToday ? todayColumnRef : null} className={`p-2 text-center min-w-[56px] border-r border-slate-200 transition-colors ${isActToday ? 'bg-orange-100 text-orange-800 border-b-4 border-orange-500' : 'text-slate-600'}`}>
                            <div className="flex flex-col items-center">
                               <span className={`text-[8px] uppercase tracking-widest mb-1 ${isActToday ? 'font-black text-orange-600' : 'font-bold text-slate-400'}`}>{getDayName(d)}</span>
                               <span className={`text-sm ${isActToday ? 'font-black' : 'font-bold'}`}>{d.getDate()}</span>
                            </div>
                         </th>
                      )
                    })}
                  </tr>
                </thead>
                
                {/* ================= BODY KOMITMEN PRIBADI ================= */}
                <tbody>
                  {/* BARIS SECTION HEADER PRIBADI */}
                  <tr>
                     <td colSpan={daysInMonth.length + 1} className="bg-blue-50 border-y border-blue-200 p-2 sm:p-3">
                         <div className="sticky left-4 flex items-center gap-2 w-max">
                             <div className="w-2 h-2 rounded-full bg-blue-600 shadow-[0_0_5px_rgba(37,99,235,0.8)]"></div>
                             <span className="font-black text-blue-900 text-[10px] uppercase tracking-widest">Komitmen Pribadi</span>
                         </div>
                     </td>
                  </tr>
                  {formattedPersonalActivities.length === 0 && (
                     <tr><td colSpan={daysInMonth.length + 1} className="p-6 text-center text-slate-400 font-medium italic text-xs bg-white">Belum ada komitmen pribadi. Klik tombol "+ Buat Sendiri" di atas.</td></tr>
                  )}
                  {formattedPersonalActivities.map((act, rowIndex) => {
                     const isSafe = getDailyEvaluation(act.id);
                     const isTopRow = rowIndex < 3; 
                     const linkedComms = getLinkedCommunities(act.id);

                     return (
                    <tr key={act.id} className="bg-white hover:bg-orange-50/50 border-b border-slate-100 transition-colors group/row">
                      {/* KOLOM NAMA AKTIVITAS KIRI */}
                      <td className="p-3 font-medium sticky left-0 z-[40] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] bg-white border-l-[4px] border-blue-500 align-top">
                        <div className="flex flex-col items-start min-w-0 flex-1 pl-1">
                           <div className="flex items-center gap-2">
                               <span className={`text-xs sm:text-sm font-bold truncate ${!isSafe ? 'text-red-600' : 'text-slate-700'}`}>{act.name}</span>
                               
                               {/* SIKLUS 3: Opt #1 - SMART PLACEMENT (DELAY 500MS) TOOLTIP */}
                               {linkedComms && (
                                   <div className="relative group/link delay-500-trigger cursor-help flex items-center shrink-0">
                                       <LinkIcon size={12} className="text-blue-500/70 hover:text-blue-600 transition-colors" />
                                       <div className={`absolute opacity-0 invisible tooltip-content-delay transition-all duration-300 left-1/2 -translate-x-1/2 w-48 bg-blue-900 text-white text-[9px] font-bold text-center p-2.5 rounded-lg shadow-xl z-[9999] tracking-wide leading-relaxed ${isTopRow ? 'top-full mt-2' : 'bottom-full mb-2'}`}>
                                           🔗 Aktivitas Terhubung (Linked). Laporan pada baris ini saling tersinkron otomatis.<br/><br/>
                                           <span className="text-blue-300">Terhubung dengan grup: {linkedComms.join(', ')}</span>
                                           <div className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-900 rotate-45 ${isTopRow ? '-top-1 border-l border-t border-blue-900' : '-bottom-1 border-b border-r border-blue-900'}`}></div>
                                       </div>
                                   </div>
                               )}

                               {!isSafe && (
                                   <div className="relative group/alert delay-500-trigger cursor-help">
                                       <AlertTriangle size={14} className="text-red-500 animate-pulse" />
                                       <div className={`absolute opacity-0 invisible tooltip-content-delay transition-all duration-300 left-1/2 -translate-x-1/2 w-48 bg-red-900 text-white text-[9px] font-bold text-center p-2 rounded-lg shadow-xl z-[9999] tracking-wide leading-relaxed ${isTopRow ? 'top-full mt-2' : 'bottom-full mb-2'}`}>
                                           Pelaksanaan di bawah 50% dari target hari yang telah berlalu!
                                           <div className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-red-900 rotate-45 ${isTopRow ? '-top-1 border-l border-t border-red-900' : '-bottom-1 border-b border-r border-red-900'}`}></div>
                                       </div>
                                   </div>
                               )}
                           </div>
                           <div className="flex items-center gap-1.5 mt-1">
                               <span className="text-[10px] text-blue-700 font-bold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md flex items-center gap-1 w-max shadow-sm"><Clock size={10}/> {act.time}</span>
                               {act.frequency !== 'daily' && <span className="text-[8px] font-black text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded uppercase tracking-widest">{getFreqLabel(act.frequency)}</span>}
                           </div>
                           
                           {/* MENU AKSI HORIZONTAL COMPACT */}
                           <div className="flex flex-wrap items-center gap-1.5 mt-2 opacity-30 group-hover/row:opacity-100 transition-opacity w-full">
                               <button onClick={() => setActModal({ show:true, mode:'edit', tab:'global', id:act.id, name:act.name, time:act.time, frequency: act.frequency||'daily', freqConfig: act.freqConfig||'' })} className="flex items-center gap-1 text-[9px] font-bold text-slate-500 hover:text-blue-600 bg-slate-100 px-1.5 py-1 rounded" title="Edit"><Edit3 size={10}/> Edit</button>
                               <button onClick={() => deleteActivity(act.id)} className="flex items-center gap-1 text-[9px] font-bold text-slate-500 hover:text-red-600 bg-slate-100 px-1.5 py-1 rounded" title="Hapus"><Trash2 size={10}/> Hapus</button>
                               <button onClick={() => handleCopyPattern(act)} className="flex items-center gap-1 text-[9px] font-bold text-slate-500 hover:text-orange-600 bg-slate-100 px-1.5 py-1 rounded" title="Salin Pola"><Files size={10}/> Salin</button>
                               {copiedPattern && <button onClick={() => handlePastePattern(act)} className="flex items-center gap-1 text-[9px] font-bold text-orange-600 hover:text-orange-800 bg-orange-50 border border-orange-200 px-1.5 py-1 rounded shadow-sm" title="Tempel Pola"><ClipboardPaste size={10}/> Tempel</button>}
                           </div>
                        </div>
                      </td>
                      {daysInMonth.map(d => {
                        const active = isDayActive(act, d);
                        if (!active) {
                            return (
                               <td key={`${d}-${act.id}`} className="p-1.5 text-center border-r border-slate-100 bg-slate-200/40 pointer-events-none align-middle">
                                   <div className="w-6 h-6 mx-auto rounded-lg bg-slate-200 border-2 border-slate-300 opacity-40" />
                               </td>
                            );
                        }

                        const rec = records[`${getLocalDateStr(d)}-${act.id}`];
                        return (
                          <td key={`${d}-${act.id}`} className="p-1.5 text-center relative cursor-pointer border-r border-slate-100 desktop-tooltip-hover group align-middle" onClick={() => handleRecord(d, act.id, act.time, rec?.status)}>
                            {/* BUG FIX Zombie Data: Render kotak kosong eksplicit jika status 'none' */}
                            {rec?.status === 'done' ? <div className="w-7 h-7 mx-auto bg-green-100 rounded-lg flex items-center justify-center border border-green-300 shadow-inner"><Check className="text-green-600" size={16} strokeWidth={3}/></div>
                            : rec?.status === 'missed' ? <div className="w-7 h-7 mx-auto bg-red-50 rounded-lg flex items-center justify-center border border-red-200"><X className="text-red-500" size={16} strokeWidth={3}/></div>
                            : <div className="w-7 h-7 mx-auto rounded-lg bg-slate-50 border-2 border-slate-200 hover:border-orange-400 hover:bg-orange-50 transition-colors" />}
                            
                            {/* TOOLTIP REPORT INFO */}
                            {rec && rec.status !== 'none' && (
                                <div className={`tooltip-content absolute opacity-0 invisible transition-all duration-300 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 text-white text-[10px] p-3 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] w-48 z-[9999] pointer-events-none ${isTopRow ? 'top-full mt-2' : 'bottom-full mb-2'}`}>
                                    <p className="font-black text-orange-400 border-b border-slate-700 pb-1.5 mb-2 truncate">{act.name} ({d.getDate()}/{d.getMonth()+1})</p>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-slate-400 font-medium">Target:</span>
                                        <span className="font-bold">{act.time}</span>
                                    </div>
                                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-700/50">
                                        <span className="text-slate-400 font-medium">Lapor:</span>
                                        <span className="font-bold text-white">{new Date(rec.timestamp).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</span>
                                    </div>
                                    <div className="text-center w-full">
                                        {getIsOnTime(rec.timestamp, d, act.time) ? <span className="bg-green-900/50 text-green-400 border border-green-800 px-2 py-1 rounded-md font-black tracking-widest text-[8px] uppercase block w-full">Tepat Waktu</span> : <span className="bg-orange-900/50 text-orange-400 border border-orange-800 px-2 py-1 rounded-md font-black tracking-widest text-[8px] uppercase block w-full">Rapelan</span>}
                                    </div>
                                    <div className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 border-slate-700 rotate-45 ${isTopRow ? '-top-1.5 border-l border-t' : '-bottom-1.5 border-b border-r'}`}></div>
                                </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )})}
                  <tr className="bg-blue-50/50 border-y-2 border-blue-200 shadow-sm">
                    {/* Z-[40] FOOTER PRIBADI */}
                    <td className="p-3 text-right font-black text-blue-900 sticky left-0 z-[40] bg-blue-100 text-[10px] uppercase tracking-widest shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Ketercapaian Pribadi:</td>
                    {daysInMonth.map(d => (
                        <td key={d.toISOString()} className="p-2 text-center font-black text-blue-700 text-xs border-r border-blue-200/50">{getSubDailyPct(d, formattedPersonalActivities)}</td>
                    ))}
                  </tr>
                </tbody>

                {/* ================= BODY KOMITMEN KOMUNITAS ================= */}
                <tbody>
                  {/* BARIS SECTION HEADER KOMUNITAS */}
                  <tr>
                     <td colSpan={daysInMonth.length + 1} className="bg-purple-50 border-y border-purple-200 p-2 sm:p-3 mt-4">
                         <div className="sticky left-4 flex items-center gap-2 w-max">
                             <div className="w-2 h-2 rounded-full bg-purple-600 shadow-[0_0_5px_rgba(147,51,234,0.8)]"></div>
                             <span className="font-black text-purple-900 text-[10px] uppercase tracking-widest">Komitmen Komunitas</span>
                         </div>
                     </td>
                  </tr>
                  {communityActivities.length === 0 && (
                     <tr><td colSpan={daysInMonth.length + 1} className="p-6 text-center text-slate-400 font-medium italic text-xs bg-slate-50">Anda belum bergabung di komunitas manapun.</td></tr>
                  )}
                  {communityActivities.map((act: any, rowIndex: number) => {
                     const isSafe = getDailyEvaluation(act.id);
                     const isTopRow = rowIndex < 3;
                     const linkedComms = getLinkedCommunities(act.id);

                     return (
                    <tr key={act.uniqueKey} className="bg-slate-50 hover:bg-orange-50/50 border-b border-slate-100 transition-colors group/row">
                      {/* KOLOM NAMA AKTIVITAS KIRI */}
                      <td className="p-3 font-medium sticky left-0 z-[40] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] bg-[#f8fafc] border-l-[4px] border-purple-400 align-top">
                        <div className="flex flex-col min-w-0 flex-1 pl-1">
                           <div className="flex items-center gap-2">
                               <span className={`text-xs sm:text-sm font-bold truncate ${!isSafe ? 'text-red-600' : 'text-slate-800'}`}>{act.name}</span>
                               
                               {/* SIKLUS 3: Opt #1 - SMART PLACEMENT (DELAY 500MS) TOOLTIP */}
                               {linkedComms && (
                                   <div className="relative group/link delay-500-trigger cursor-help flex items-center shrink-0">
                                       <LinkIcon size={12} className="text-purple-500/70 hover:text-purple-600 transition-colors" />
                                       <div className={`absolute opacity-0 invisible tooltip-content-delay transition-all duration-300 left-1/2 -translate-x-1/2 w-48 bg-purple-900 text-white text-[9px] font-bold text-center p-2.5 rounded-lg shadow-xl z-[9999] tracking-wide leading-relaxed ${isTopRow ? 'top-full mt-2' : 'bottom-full mb-2'}`}>
                                           🔗 Aktivitas Terhubung (Linked). Laporan pada baris ini saling tersinkron otomatis.<br/><br/>
                                           <span className="text-purple-300">Terhubung dengan grup: {linkedComms.join(', ')}</span>
                                           <div className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-purple-900 rotate-45 ${isTopRow ? '-top-1 border-l border-t border-purple-900' : '-bottom-1 border-b border-r border-purple-900'}`}></div>
                                       </div>
                                   </div>
                               )}

                               {!isSafe && (
                                   <div className="relative group/alert delay-500-trigger cursor-help">
                                       <AlertTriangle size={14} className="text-red-500 animate-pulse" />
                                       <div className={`absolute opacity-0 invisible tooltip-content-delay transition-all duration-300 left-1/2 -translate-x-1/2 w-48 bg-red-900 text-white text-[9px] font-bold text-center p-2 rounded-lg shadow-xl z-[9999] tracking-wide leading-relaxed ${isTopRow ? 'top-full mt-2' : 'bottom-full mb-2'}`}>
                                           Pelaksanaan di bawah 50% dari target hari yang telah berlalu!
                                           <div className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-red-900 rotate-45 ${isTopRow ? '-top-1 border-l border-t border-red-900' : '-bottom-1 border-b border-r border-red-900'}`}></div>
                                       </div>
                                   </div>
                               )}
                           </div>
                           <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              <span className="text-[10px] text-purple-700 font-bold bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-md flex items-center gap-1 w-max shadow-sm"><Clock size={10}/> {act.time}</span>
                              {act.frequency !== 'daily' && <span className="text-[8px] font-black text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded uppercase tracking-widest">{getFreqLabel(act.frequency)}</span>}
                              
                              {/* SIKLUS 3: Opt #1 - SMART PLACEMENT (DELAY 500MS) TOOLTIP */}
                              <div className="relative group/commbadge delay-500-trigger cursor-help flex items-center">
                                 <span className="text-[8px] text-slate-500 uppercase font-semibold flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-sm ml-1">
                                    <Users size={10} className="shrink-0 text-slate-400"/> 
                                    {act.communities.length > 1 ? `${act.communities[0]} +${act.communities.length - 1} Grup` : act.communities[0]}
                                 </span>
                                 {act.communities.length > 1 && (
                                     <div className={`absolute opacity-0 invisible tooltip-content-delay transition-all duration-300 left-1/2 -translate-x-1/2 w-48 bg-slate-800 text-white text-[9px] font-bold text-center p-2 rounded-lg shadow-xl z-[9999] tracking-wide leading-relaxed ${isTopRow ? 'top-full mt-2' : 'bottom-full mb-2'}`}>
                                         Terhubung dengan:<br/>
                                         <span className="text-purple-300">{act.communities.join(', ')}</span>
                                         <div className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45 ${isTopRow ? '-top-1 border-l border-t border-slate-800' : '-bottom-1 border-b border-r border-slate-800'}`}></div>
                                     </div>
                                 )}
                              </div>
                           </div>

                           {/* MENU AKSI HORIZONTAL COMPACT */}
                           <div className="flex flex-wrap items-center gap-1.5 mt-2 opacity-30 group-hover/row:opacity-100 transition-opacity w-full">
                               <button onClick={() => handleCopyPattern(act)} className="flex items-center gap-1 text-[9px] font-bold text-slate-500 hover:text-orange-600 bg-white border border-slate-200 px-1.5 py-1 rounded" title="Salin Pola"><Files size={10}/> Salin</button>
                               {copiedPattern && <button onClick={() => handlePastePattern(act)} className="flex items-center gap-1 text-[9px] font-bold text-orange-600 hover:text-orange-800 bg-orange-50 border border-orange-200 px-1.5 py-1 rounded shadow-sm" title="Tempel Pola"><ClipboardPaste size={10}/> Tempel</button>}
                           </div>
                        </div>
                      </td>
                      {daysInMonth.map(d => {
                        const active = isDayActive(act, d);
                        if (!active) {
                            return (
                               <td key={`${d}-${act.id}`} className="p-1.5 text-center border-r border-slate-100/50 bg-slate-200/40 pointer-events-none align-middle">
                                   <div className="w-6 h-6 mx-auto rounded-lg bg-slate-200 border-2 border-slate-300 opacity-40" />
                               </td>
                            );
                        }

                        const rec = records[`${getLocalDateStr(d)}-${act.id}`];
                        return (
                          <td key={`${d}-${act.id}`} className="p-1.5 text-center relative cursor-pointer border-r border-slate-100/50 desktop-tooltip-hover group align-middle" onClick={() => handleRecord(d, act.id, act.time, rec?.status)}>
                            {rec?.status === 'done' ? <div className="w-7 h-7 mx-auto bg-green-100 rounded-lg flex items-center justify-center border border-green-300 shadow-inner"><Check className="text-green-600" size={16} strokeWidth={3}/></div>
                            : rec?.status === 'missed' ? <div className="w-7 h-7 mx-auto bg-red-50 rounded-lg flex items-center justify-center border border-red-200"><X className="text-red-500" size={16} strokeWidth={3}/></div>
                            : <div className="w-7 h-7 mx-auto rounded-lg bg-white border-2 border-slate-200 hover:border-orange-400 hover:bg-orange-50 transition-colors" />}
                            
                            {/* TOOLTIP REPORT INFO */}
                            {rec && rec.status !== 'none' && (
                                <div className={`tooltip-content absolute opacity-0 invisible transition-all duration-300 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 text-white text-[10px] p-3 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] w-48 z-[9999] pointer-events-none ${isTopRow ? 'top-full mt-2' : 'bottom-full mb-2'}`}>
                                    <p className="font-black text-orange-400 border-b border-slate-700 pb-1.5 mb-2 truncate">{act.name} ({d.getDate()}/{d.getMonth()+1})</p>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-slate-400 font-medium">Target:</span>
                                        <span className="font-bold">{act.time}</span>
                                    </div>
                                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-700/50">
                                        <span className="text-slate-400 font-medium">Lapor:</span>
                                        <span className="font-bold text-white">{new Date(rec.timestamp).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</span>
                                    </div>
                                    <div className="text-center w-full">
                                        {getIsOnTime(rec.timestamp, d, act.time) ? <span className="bg-green-900/50 text-green-400 border border-green-800 px-3 py-1 rounded-md font-black tracking-widest text-[9px] uppercase block w-full">Tepat Waktu</span> : <span className="bg-orange-900/50 text-orange-400 border border-orange-800 px-3 py-1 rounded-md font-black tracking-widest text-[9px] uppercase block w-full">Rapelan</span>}
                                    </div>
                                    <div className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 border-slate-700 rotate-45 ${isTopRow ? '-top-1.5 border-l border-t' : '-bottom-1.5 border-b border-r'}`}></div>
                                </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )})}
                  <tr className="bg-purple-50/50 border-y-2 border-purple-200 shadow-sm">
                    {/* Z-[40] FOOTER KOMUNITAS */}
                    <td className="p-3 text-right font-black text-purple-900 sticky left-0 z-[40] bg-purple-100 text-[10px] uppercase tracking-widest shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Ketercapaian Komunitas:</td>
                    {daysInMonth.map(d => (
                        <td key={d.toISOString()} className="p-3 text-center font-black text-purple-700 text-xs border-r border-purple-200/50">{getSubDailyPct(d, communityActivities)}</td>
                    ))}
                  </tr>
                </tbody>

                {/* ================= FOOTER GABUNGAN ================= */}
                <tfoot>
                  <tr className="bg-slate-200 border-t-4 border-slate-300">
                    {/* Z-[40] FOOTER GABUNGAN */}
                    <td className="p-4 sm:p-5 text-right font-black text-slate-900 sticky left-0 z-[40] bg-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-xs sm:text-sm uppercase tracking-widest">Ketercapaian Gabungan:</td>
                    {daysInMonth.map(d => (
                        <td key={d.toISOString()} className="p-3 text-center font-black text-slate-800 border-r border-slate-300 text-sm sm:text-base bg-slate-100">{getDailyPercentage(d)}</td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ================= GAMIFIKASI (PODIUM GRID & REAL-TIME CALCULATOR) ================= */}
          {joinedCommunityIds.length > 0 && (
             <div className="space-y-8 pt-4">
                <div className="flex items-center gap-3">
                   <Award size={32} className="text-yellow-500" strokeWidth={2.5}/>
                   <h2 className="text-2xl font-black text-slate-800">Leaderboard Komunitas</h2>
                </div>
                
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {joinedCommunityIds.map(commId => {
                   const comm = allCommunities.find(c => c.id === commId); 
                   if (!comm) return null;
                   
                   const commMembers = getCommunityMembersFull(commId);
                   const activeTab = leaderboardTabs[commId] || 'monthly';
                   
                   const boardData = getRealTimeLeaderboard(commId, activeTab);
                   
                   const top3 = boardData.slice(0, 3);
                   const rest = boardData.slice(3);

                   return (
                   <div key={commId} className="bg-gradient-to-br from-slate-900 to-[#0f172a] rounded-3xl shadow-2xl p-6 md:p-8 border border-slate-700/50 relative overflow-hidden flex flex-col h-full">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-40 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>
                      
                      <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 border-b border-slate-700/50 pb-6">
                         <div className="text-center sm:text-left w-full sm:w-auto">
                            <h3 className="text-2xl font-black text-white flex items-center justify-center sm:justify-start gap-3 truncate max-w-[250px]"><Medal className="text-blue-400 shrink-0" size={24}/> {comm.name}</h3>
                            <button onClick={() => setMembersModal({show: true, commId: comm.id, commName: comm.name, isAdminView: false})} className="text-xs text-slate-400 hover:text-white mt-2 font-semibold flex items-center justify-center sm:justify-start gap-1.5 transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-white/10 mx-auto sm:mx-0"><Users size={12}/> {commMembers.length} Member Terdaftar</button>
                         </div>
                         <div className="flex bg-slate-800/80 p-1.5 rounded-xl border border-slate-600 shadow-inner w-full sm:w-auto">
                            <button onClick={()=>setLeaderboardTabs({...leaderboardTabs, [commId]: 'yesterday'})} className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab==='yesterday' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>Kemarin</button>
                            <button onClick={()=>setLeaderboardTabs({...leaderboardTabs, [commId]: 'weekly'})} className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab==='weekly' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>Pekan Ini</button>
                            <button onClick={()=>setLeaderboardTabs({...leaderboardTabs, [commId]: 'monthly'})} className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab==='monthly' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>Bulan Ini</button>
                         </div>
                      </div>

                      <div className="relative z-10 flex-1 flex flex-col">
                         {boardData.length === 0 ? <div className="text-center py-12 text-slate-500 text-sm font-bold uppercase tracking-widest border-2 border-dashed border-slate-700/50 rounded-2xl bg-white/5 m-auto w-full">Belum ada peserta di grup ini</div> : (
                            <div className="flex flex-col items-center flex-1">
                               {/* === PODIUM TOP 3 COMPACT (NAMA DEPAN SAJA) === */}
                               <div className="flex justify-center items-end gap-2 sm:gap-4 mb-6 pt-4 w-full px-2">
                                  {/* JUARA 2 */}
                                  {top3[1] && (
                                  <div className="flex flex-col items-center flex-1 max-w-[110px] group">
                                     <div className="mb-3 text-center transition-transform group-hover:-translate-y-1">
                                         <span className="block text-xs font-bold text-slate-300 truncate w-full px-1">{top3[1].name.split(' ')[0]}</span>
                                         <span className="block text-sm font-black text-slate-100 mt-1 bg-white/10 px-2 py-0.5 rounded border border-white/5">{top3[1].score}%</span>
                                     </div>
                                     <div className="w-full h-20 bg-gradient-to-t from-slate-600 via-slate-400 to-slate-300 rounded-t-xl flex justify-center pt-3 text-slate-800 font-black text-2xl border-t-[3px] border-slate-100 shadow-[0_0_15px_rgba(148,163,184,0.2)]">2</div>
                                  </div>
                                  )}
                                  {/* JUARA 1 */}
                                  {top3[0] && (
                                  <div className="flex flex-col items-center z-10 flex-1 max-w-[130px] group">
                                     <div className="mb-3 text-center relative transition-transform group-hover:-translate-y-2">
                                         <Crown className="text-yellow-400 w-8 h-8 mx-auto mb-1.5 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)] animate-pulse" strokeWidth={2}/>
                                         <span className="block text-sm font-black text-yellow-400 truncate w-full px-1 drop-shadow-md">{top3[0].name.split(' ')[0]}</span>
                                         <span className="block text-base font-black text-white mt-1 bg-yellow-500/20 px-3 py-1 rounded-lg border border-yellow-500/30">{top3[0].score}%</span>
                                     </div>
                                     <div className="w-full h-32 bg-gradient-to-t from-yellow-700 via-yellow-500 to-yellow-300 rounded-t-xl flex justify-center pt-4 text-yellow-950 font-black text-3xl border-t-[4px] border-yellow-100 shadow-[0_0_25px_rgba(250,204,21,0.4)]">1</div>
                                  </div>
                                  )}
                                  {/* JUARA 3 */}
                                  {top3[2] && (
                                  <div className="flex flex-col items-center flex-1 max-w-[110px] group">
                                     <div className="mb-3 text-center transition-transform group-hover:-translate-y-1">
                                         <span className="block text-[11px] font-bold text-orange-300 truncate w-full px-1">{top3[2].name.split(' ')[0]}</span>
                                         <span className="block text-xs font-black text-slate-100 mt-1 bg-white/10 px-2 py-0.5 rounded border border-white/5">{top3[2].score}%</span>
                                     </div>
                                     <div className="w-full h-14 bg-gradient-to-t from-[#78350f] via-[#b45309] to-[#d97706] rounded-t-xl flex justify-center pt-2 text-[#451a03] font-black text-xl border-t-[3px] border-[#fcd34d] shadow-[0_0_15px_rgba(217,119,6,0.2)]">3</div>
                                  </div>
                                  )}
                               </div>
                               
                               {/* === TOMBOL MENU PERINGKAT LENGKAP === */}
                               {rest.length > 0 && (
                                   <button onClick={() => setFullLeaderboardModal({show:true, commName: comm.name, boardData: boardData})} className="text-sm w-full py-3.5 mt-auto bg-blue-900/30 hover:bg-blue-800/50 text-blue-400 font-bold rounded-xl border border-blue-500/30 transition-colors flex items-center justify-center gap-2 shadow-sm hover:shadow-blue-900/50">
                                       <ListOrdered size={16}/> Lihat Peringkat Lengkap (Ke-{boardData.length})
                                   </button>
                               )}
                            </div>
                         )}
                      </div>
                   </div>
                )})}
                </div>
             </div>
          )}

          {/* ================= ARSIP DOA & JURNAL (DENGAN BROADCAST SHARE & PRESISI UI) ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-10 border-t border-slate-200 mt-10">
            
            {/* KOLOM KIRI: DAFTAR ARSIP */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col h-full">
              <div className="flex flex-col mb-6 border-b border-slate-100 pb-4">
                 <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-4 w-full"><span className="w-3 h-3 rounded-full bg-orange-500 shrink-0"></span> Arsip Doa & Jurnal</h3>
                 <div className="flex flex-row items-center gap-2 w-full">
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" placeholder="Cari..." value={journalSearch} onChange={e => setJournalSearch(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs outline-none focus:border-orange-500" />
                    </div>
                    <select value={journalSort} onChange={(e: any) => setJournalSort(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-orange-500 font-bold text-slate-600 cursor-pointer w-1/3">
                        <option value="newest">Terbaru</option><option value="oldest">Terlama</option><option value="az">A - Z</option><option value="za">Z - A</option>
                    </select>
                 </div>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px] pr-4 custom-scrollbar">
                {filteredAndSortedJournals.length === 0 ? <p className="text-sm text-slate-400 text-center py-10 italic border-2 border-dashed rounded-xl">Belum ada arsip yang tersimpan.</p> : filteredAndSortedJournals.map(j => (
                  <div key={j.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center group hover:border-orange-400 transition-colors">
                    <div className="flex flex-col text-left flex-1 pr-4 min-w-0">
                        <p className="font-bold text-slate-800 text-sm line-clamp-2 leading-snug">{j.title}</p>
                        <div className="flex items-center flex-wrap gap-2 mt-2">
                           <p className="text-[10px] font-semibold text-slate-400 uppercase flex items-center gap-1"><Calendar size={10}/> {new Date(j.date).toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'})}</p>
                           {j.isShared && <span className="text-[9px] bg-blue-50 text-blue-600 font-bold px-1.5 py-0.5 rounded flex items-center gap-1"><Megaphone size={10}/> Pesan Admin</span>}
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-50 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => { setActiveJournal(j); setIsViewModalOpen(true); }} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg"><Eye size={16} /></button>
                        {!j.isShared && (
                            <>
                                <button onClick={() => { setActiveJournal(j); setJournalInput({title: j.title, content: j.content, sharedWith: j.sharedWith || []}); setIsViewModalOpen(false); }} className="text-orange-600 hover:bg-orange-50 p-1.5 rounded-lg"><Edit3 size={16} /></button>
                                <button onClick={() => { setJournals(journals.filter(x => x.id !== j.id)); setHasUnsavedChanges(true); }} className="text-red-600 hover:bg-red-50 p-1.5 rounded-lg"><Trash2 size={16} /></button>
                            </>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* KOLOM KANAN: EDITOR JURNAL */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col">
              <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-100 pb-4"><span className="w-3 h-3 rounded-full bg-orange-500"></span> {activeJournal && !isViewModalOpen ? 'Edit Doa / Jurnal' : 'Tulis Doa / Jurnal Baru'}</h3>
              <input type="text" placeholder="Tuliskan Judul Jurnal / Doa..." value={journalInput.title} onChange={e => setJournalInput({...journalInput, title: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-slate-800 outline-none font-bold focus:border-orange-500 focus:bg-white transition-colors" />
              <textarea placeholder="Tuliskan evaluasi, syukur, atau curahan doa Anda hari ini secara detail..." value={journalInput.content} onChange={e => setJournalInput({...journalInput, content: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 flex-1 min-h-[200px] text-slate-800 outline-none resize-none mb-6 focus:border-orange-500 focus:bg-white transition-colors leading-relaxed" />
              
              {/* OPSI SHARE KE KOMUNITAS KHUSUS ADMIN/SUPER ADMIN */}
              {(isAdmin || isSuperAdmin) && (
                 <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <p className="text-xs font-black text-blue-800 mb-3 flex items-center gap-2"><Megaphone size={14}/> Bagikan sebagai Pesan Admin ke Komunitas (Opsional)</p>
                    <div className="flex flex-wrap gap-2">
                        {allCommunities.filter(c => isSuperAdmin || c.ownerId === user.uid).map(c => (
                            <label key={c.id} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors shadow-sm">
                                <input type="checkbox" checked={journalInput.sharedWith.includes(c.id)} onChange={(e) => {
                                    const newShared = e.target.checked ? [...journalInput.sharedWith, c.id] : journalInput.sharedWith.filter((id: string) => id !== c.id);
                                    setJournalInput({...journalInput, sharedWith: newShared});
                                }} className="rounded text-blue-600" />
                                <span className="text-[10px] font-bold text-blue-900">{c.name}</span>
                            </label>
                        ))}
                        {allCommunities.filter(c => isSuperAdmin || c.ownerId === user.uid).length === 0 && <p className="text-xs text-blue-500 italic">Anda belum memiliki komunitas untuk dibagikan.</p>}
                    </div>
                 </div>
              )}

              <div className="flex justify-end">
                  <button onClick={saveJournal} className="bg-slate-800 text-white px-8 py-3 rounded-xl hover:bg-slate-900 font-bold shadow-lg flex items-center gap-2 transition-transform hover:-translate-y-1"><Check size={18}/> Simpan Jurnal & Doa</button>
              </div>
            </div>
          </div>

          {/* ================= MASTER CHARTS & ANALYTICS ================= */}
          <div ref={chartRef} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 relative overflow-hidden mt-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
               <div>
                   <h2 className="text-2xl font-black text-slate-800 border-l-[6px] border-orange-500 pl-4 rounded-sm">Dashboard Analisa Eksekutif</h2>
                   <p className="text-sm font-semibold text-slate-500 mt-2 pl-4 flex items-center gap-2"><Activity size={14}/> Laporan: <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{user.displayName}</span></p>
               </div>
               <button data-html2canvas-ignore="true" onClick={exportChart} className="flex items-center gap-2 bg-orange-50 text-orange-700 px-5 py-2.5 rounded-xl text-sm font-bold border border-orange-200 hover:bg-orange-100 transition-colors shadow-sm"><Download size={16} /> Ekspor Laporan</button>
            </div>
            
            {/* --- CHART UTAMA 3 GARIS --- */}
            <div className="w-full h-[400px] mb-4 bg-slate-50 rounded-2xl p-4 sm:p-6 border border-slate-100 shadow-inner">
               <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={mainChartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} />
                     <XAxis dataKey="tgl" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} fontWeight={600}/>
                     <YAxis width={45} stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(val) => `${val}%`} fontWeight={600}/>
                     <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }} labelStyle={{color: '#94a3b8', fontWeight: 'bold', marginBottom: '5px'}} labelFormatter={(l) => `Tanggal ${l}`} />
                     <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '20px', fontWeight: 'bold' }} iconType="circle"/>
                     
                     <Area type="monotone" dataKey="gab" name="Total Gabungan" stroke="#ea580c" strokeWidth={4} fill="#ffedd5" fillOpacity={0.5} activeDot={{r: 6, fill: '#ea580c', stroke: '#fff', strokeWidth: 2}}/>
                     <Line type="monotone" dataKey="pri" name="Pribadi" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{r: 5}}/>
                     <Line type="monotone" dataKey="kom" name="Komunitas" stroke="#a855f7" strokeWidth={3} dot={false} activeDot={{r: 5}}/>
                     
                     <Line type="linear" dataKey="t_gab" name="Trend Gabungan" stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 6" dot={false} activeDot={false} />
                  </ComposedChart>
               </ResponsiveContainer>
            </div>
            <p className="text-center text-[10px] font-semibold text-slate-400 mb-10 italic">*Grafik Area Gabungan memvisualisasikan kedisiplinan murni Anda bulan ini tanpa redudansi (Double-Input) akibat tabrakan irisan jadwal grup dan pribadi.</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
               {/* --- BEDAH KUANTITAS MURNI --- */}
               <div className="bg-slate-50 rounded-2xl p-6 md:p-8 border border-slate-200 flex flex-col justify-center">
                  <h3 className="text-lg font-black text-slate-800 mb-2 text-center flex items-center justify-center gap-2"><BarChart2 className="text-orange-500"/> Bedah Kuantitas Murni</h3>
                  <p className="text-[10px] text-center text-slate-500 mb-6 px-4">Membandingkan total aksi fisik yang dituntaskan melawan yang terlewatkan (X).</p>
                  
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mt-auto mb-auto">
                      <div className="flex justify-between items-center mb-4 px-1">
                         <span className="text-sm font-bold text-slate-700">Total Selesai: <span className="text-green-600 font-black text-xl ml-1">{stats.qtyGabungan.done} <span className="text-xs font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded ml-1">({stats.qtyGabungan.done + stats.qtyGabungan.missed === 0 ? 0 : Math.round((stats.qtyGabungan.done / (stats.qtyGabungan.done + stats.qtyGabungan.missed))*100)}%)</span></span></span>
                         <span className="text-sm font-bold text-slate-700">Total Terlewat: <span className="text-red-500 font-black text-xl ml-1">{stats.qtyGabungan.missed} <span className="text-xs font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded ml-1">({stats.qtyGabungan.done + stats.qtyGabungan.missed === 0 ? 0 : Math.round((stats.qtyGabungan.missed / (stats.qtyGabungan.done + stats.qtyGabungan.missed))*100)}%)</span></span></span>
                      </div>
                      <div className="h-6 w-full bg-red-100 rounded-full overflow-hidden flex border border-red-200/50 shadow-inner">
                         <div className="h-full bg-gradient-to-r from-green-400 to-green-500" style={{ width: `${stats.qtyGabungan.done + stats.qtyGabungan.missed === 0 ? 0 : (stats.qtyGabungan.done / (stats.qtyGabungan.done + stats.qtyGabungan.missed))*100}%` }}></div>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6">
                     <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex flex-col h-full">
                        <p className="text-[10px] font-black text-blue-600 uppercase mb-3 flex items-center justify-between border-b border-blue-50 pb-2">👤 Pribadi <span className="text-[9px] font-bold bg-blue-50 px-2 py-0.5 rounded text-blue-800">Total: {stats.qty.p_done + stats.qty.p_miss}</span></p>
                        <div className="flex justify-between mb-1"><span className="text-xs text-slate-500 font-bold">Selesai:</span><span className="text-sm font-black text-green-600">{stats.qty.p_done}</span></div>
                        <div className="flex justify-between mb-4"><span className="text-xs text-slate-500 font-bold">Terlewat:</span><span className="text-sm font-black text-red-500">{stats.qty.p_miss}</span></div>
                        <div className="mt-auto pt-3 border-t border-slate-100 text-[10px] space-y-2">
                           <div>
                               <p className="text-[8px] text-slate-400 uppercase font-bold mb-0.5">🔥 Paling Sering Selesai</p>
                               <p className="truncate font-bold text-green-700 bg-green-50 px-2 py-1 rounded">{stats.topPribadi ? `${stats.topPribadi.name}` : '-'}</p>
                           </div>
                           <div>
                               <p className="text-[8px] text-slate-400 uppercase font-bold mb-0.5">⚠️ Paling Sering Terlewat</p>
                               <p className="truncate font-bold text-red-700 bg-red-50 px-2 py-1 rounded">{stats.botPribadi ? `${stats.botPribadi.name}` : '-'}</p>
                           </div>
                        </div>
                     </div>
                     <div className="bg-white p-4 rounded-xl border border-purple-100 shadow-sm flex flex-col h-full">
                        <p className="text-[10px] font-black text-purple-600 uppercase mb-3 flex items-center justify-between border-b border-purple-50 pb-2">👥 Komunitas <span className="text-[9px] font-bold bg-purple-50 px-2 py-0.5 rounded text-purple-800">Total: {stats.qty.c_done + stats.qty.c_miss}</span></p>
                        <div className="flex justify-between mb-1"><span className="text-xs text-slate-500 font-bold">Selesai:</span><span className="text-sm font-black text-green-600">{stats.qty.c_done}</span></div>
                        <div className="flex justify-between mb-4"><span className="text-xs text-slate-500 font-bold">Terlewat:</span><span className="text-sm font-black text-red-500">{stats.qty.c_miss}</span></div>
                        <div className="mt-auto pt-3 border-t border-slate-100 text-[10px] space-y-2">
                           <div>
                               <p className="text-[8px] text-slate-400 uppercase font-bold mb-0.5">🔥 Paling Sering Selesai</p>
                               <p className="truncate font-bold text-green-700 bg-green-50 px-2 py-1 rounded">{stats.topComm ? `${stats.topComm.name}` : '-'}</p>
                           </div>
                           <div>
                               <p className="text-[8px] text-slate-400 uppercase font-bold mb-0.5">⚠️ Paling Sering Terlewat</p>
                               <p className="truncate font-bold text-red-700 bg-red-50 px-2 py-1 rounded">{stats.botComm ? `${stats.botComm.name}` : '-'}</p>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

               {/* --- 4 PILAR KARAKTER DISIPLIN --- */}
               <div className="bg-slate-50 rounded-2xl p-6 md:p-8 border border-slate-200">
                  <h3 className="text-lg font-black text-slate-800 mb-2 text-center flex items-center justify-center gap-2"><Shield className="text-blue-500"/> Kartu Karakter Disiplin</h3>
                  <p className="text-[10px] text-center text-slate-500 mb-6 px-4">Empat pilar analisis psikologis yang merekam tingkat integritas dan konsistensi Anda.</p>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
                        <p className="text-[10px] text-blue-700 font-black uppercase tracking-widest mb-1 flex items-center gap-1.5 pl-2"><Target size={14}/> Akuntabilitas</p>
                        <p className="text-[8px] text-slate-400 mb-2 pl-2">Keberanian merespon tanpa *ghosting*</p>
                        <p className="text-3xl font-black text-slate-800 pl-2">{stats.noGhostingRate}%</p>
                     </div>
                     <div className="bg-white p-4 rounded-xl border border-purple-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-2 h-full bg-purple-500"></div>
                        <p className="text-[10px] text-purple-700 font-black uppercase tracking-widest mb-1 flex items-center gap-1.5 pl-2"><Clock size={14}/> Integritas Waktu</p>
                        <p className="text-[8px] text-slate-400 mb-2 pl-2">Ketepatan lapor vs rapelan</p>
                        <p className="text-3xl font-black text-slate-800 pl-2">{stats.onTimeRate}%</p>
                     </div>
                     <div className="bg-white p-4 rounded-xl border border-orange-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-2 h-full bg-orange-500"></div>
                        <p className="text-[10px] text-orange-700 font-black uppercase tracking-widest mb-1 flex items-center gap-1.5 pl-2"><Flame size={14}/> Daily Streak</p>
                        <p className="text-[8px] text-slate-400 mb-2 pl-2">Konsistensi harian tanpa putus</p>
                        <p className="text-3xl font-black text-slate-800 pl-2">{stats.currentStreak} <span className="text-sm text-slate-500 font-bold">Hari</span></p>
                     </div>
                     <div className="bg-white p-4 rounded-xl border border-green-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-2 h-full bg-green-500"></div>
                        <p className="text-[10px] text-green-700 font-black uppercase tracking-widest mb-1 flex items-center gap-1.5 pl-2"><Heart size={14}/> Kesehatan Disiplin</p>
                        <p className="text-[8px] text-slate-400 mb-2 pl-2">Skor nyawa (Penalti rapelan & absen)</p>
                        <p className="text-3xl font-black text-slate-800 pl-2">{stats.disciplineHealth} <span className="text-sm text-slate-500 font-bold">HP</span></p>
                     </div>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               {/* --- WEEK TO WEEK CHART --- */}
               <div className="bg-slate-50 rounded-2xl p-6 md:p-8 border border-slate-200">
                  <div className="flex justify-between items-center mb-2 border-b border-slate-200 pb-4">
                     <h3 className="text-slate-800 font-black text-base flex items-center gap-2"><Calendar size={18} className="text-blue-500"/> Week-to-Week</h3>
                     <select value={wtwMonthOffset} onChange={e=>setWtwMonthOffset(Number(e.target.value))} className="text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-700 outline-none focus:border-blue-500 cursor-pointer shadow-sm">
                        <option value={0}>Bulan Ini</option>
                        <option value={-1}>Bulan Lalu</option>
                        <option value={-2}>2 Bulan Lalu</option>
                     </select>
                  </div>
                  <p className="text-[10px] text-slate-500 mb-6 italic">*Menganalisa konsistensi kedisiplinan Anda antar pekan. Idealnya stabil atau meningkat.</p>
                  <div className="h-56">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={wtwData} margin={{top:10,right:10,left:0,bottom:0}} barSize={30}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                           <XAxis dataKey="name" fontSize={11} fontWeight={600} stroke="#64748b" tickLine={false} axisLine={false} dy={10} />
                           <YAxis width={45} fontSize={11} fontWeight={600} stroke="#64748b" domain={[0,100]} tickFormatter={v=>`${v}%`} tickLine={false} axisLine={false} />
                           <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius:'12px', border:'none', boxShadow:'0 4px 15px rgba(0,0,0,0.1)' }} formatter={(v)=>[`${v}%`, 'Pencapaian Pekan']} labelStyle={{fontWeight:'bold', color:'#334155'}} />
                           <Bar dataKey="pencapaian" fill="#3b82f6" radius={[6,6,0,0]} />
                        </BarChart>
                     </ResponsiveContainer>
                  </div>
               </div>

               {/* --- MONTH TO MONTH CHART --- */}
               <div className="bg-slate-50 rounded-2xl p-6 md:p-8 border border-slate-200">
                  <div className="flex justify-between items-center mb-2 border-b border-slate-200 pb-4">
                     <h3 className="text-slate-800 font-black text-base flex items-center gap-2"><BarChart2 size={18} className="text-green-500"/> Month-to-Month</h3>
                     <select value={mtmRange} onChange={e=>setMtmRange(Number(e.target.value))} className="text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-700 outline-none focus:border-green-500 cursor-pointer shadow-sm">
                        <option value={3}>3 Bln Terakhir</option>
                        <option value={6}>6 Bln Terakhir</option>
                        <option value={12}>1 Tahun Penuh</option>
                     </select>
                  </div>
                  <p className="text-[10px] text-slate-500 mb-6 italic">*Laporan jangka panjang yang menarik histori bulanan untuk mendeteksi siklus performa Anda.</p>
                  <div className="h-56">
                     <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={mtmData} margin={{top:10,right:10,left:0,bottom:0}}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                           <XAxis dataKey="bln" fontSize={11} fontWeight={600} stroke="#64748b" tickLine={false} axisLine={false} dy={10} />
                           <YAxis width={45} fontSize={11} fontWeight={600} stroke="#64748b" domain={[0,100]} tickFormatter={v=>`${v}%`} tickLine={false} axisLine={false} />
                           <RechartsTooltip contentStyle={{ borderRadius:'12px', border:'none', boxShadow:'0 4px 15px rgba(0,0,0,0.1)' }} formatter={(v,n)=>[`${v}%`, n==='skor'?'Skor Bulanan':'Trend Jangka Panjang']} labelStyle={{fontWeight:'bold', color:'#334155'}} />
                           <Line type="monotone" dataKey="skor" name="skor" stroke="#10b981" strokeWidth={4} dot={{r:5, fill:'#10b981', stroke:'#fff', strokeWidth:2}} activeDot={{r:7}} />
                           <Line type="linear" dataKey="trend" name="trend" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} />
                        </ComposedChart>
                     </ResponsiveContainer>
                  </div>
               </div>
            </div>

            <div className="mt-12 pt-6 border-t-2 border-slate-100 text-center leading-relaxed">
               <p className="text-slate-500 text-xs font-black tracking-widest uppercase">© 2026 TafkirCorp. Seluruh hak cipta milik ALLAAH SWT.</p>
               <p className="text-slate-400 text-[10px] mt-1 font-bold">Tracker IbadahKU Enterprise Edition (Ver 26.08.26 rev16)</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}