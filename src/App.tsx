import React, { useState, useMemo, useEffect } from 'react';

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

// Simple SVG Icons
const IconPlus = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);

const IconTrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
);

const IconEdit = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
);

const IconSave = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
);

const IconX = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

const IconChart = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
);

export default function IbadahTracker() {
  const [activities, setActivities] = useState(() => {
    const saved = localStorage.getItem('ibadah_activities');
    return saved ? JSON.parse(saved) : DEFAULT_ACTIVITIES;
  });

  const [records, setRecords] = useState(() => {
    const saved = localStorage.getItem('ibadah_records');
    return saved ? JSON.parse(saved) : {};
  });

  const [newName, setNewName] = useState('');
  const [newTime, setNewTime] = useState('');
  
  // Edit State
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editTime, setEditTime] = useState('');
  
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  useEffect(() => {
    localStorage.setItem('ibadah_activities', JSON.stringify(activities));
  }, [activities]);

  useEffect(() => {
    localStorage.setItem('ibadah_records', JSON.stringify(records));
  }, [records]);

  // Menyesuaikan jumlah hari sesuai bulan & tahun (mendukung tahun kabisat)
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Helper mendapatkan nama hari singkat (Sen, Sel, dll)
  const getDayName = (day) => {
    const date = new Date(selectedYear, selectedMonth, day);
    return date.toLocaleDateString('id-ID', { weekday: 'short' });
  };

  // Helper to convert time to minutes starting from 02:00 AM
  const getSortableMinutes = (timeStr) => {
    let [hours, minutes] = timeStr.split(':').map(Number);
    // If time is 00:xx or 01:xx, consider it as the end of the day (add 24 hours)
    if (hours < 2) {
      hours += 24;
    }
    return (hours - 2) * 60 + minutes;
  };

  // Auto-sort activities based on custom time logic
  const sortedActivities = useMemo(() => {
    return [...activities].sort((a, b) => {
      return getSortableMinutes(a.time) - getSortableMinutes(b.time);
    });
  }, [activities]);

  const handleAddActivity = (e) => {
    e.preventDefault();
    if (!newName.trim() || !newTime) return;
    
    const newActivity = {
      id: Date.now(),
      name: newName,
      time: newTime
    };
    
    setActivities([...activities, newActivity]);
    setNewName('');
    setNewTime('');
  };

  const handleDeleteActivity = (id) => {
    setActivities(activities.filter(act => act.id !== id));
    // Clean up records for this activity
    const updatedRecords = { ...records };
    Object.keys(updatedRecords).forEach(key => {
      if (key.startsWith(`${id}-`)) {
        delete updatedRecords[key];
      }
    });
    setRecords(updatedRecords);
  };

  const handleEditClick = (act) => {
    setEditingId(act.id);
    setEditName(act.name);
    setEditTime(act.time);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditTime('');
  };

  const handleSaveEdit = (id) => {
    if (!editName.trim() || !editTime) return;
    setActivities(activities.map(act => 
      act.id === id ? { ...act, name: editName, time: editTime } : act
    ));
    setEditingId(null); // Tutup mode edit setelah simpan
  };

  // Membuat ID Unik berdasar Bulan dan Tahun 
  const getRecordKey = (activityId, day) => `${activityId}-${selectedYear}-${selectedMonth}-${day}`;

  const toggleRecord = (activityId, day) => {
    const key = getRecordKey(activityId, day);
    setRecords(prev => {
      const currentState = prev[key];
      const newRecords = { ...prev };
      
      // Siklus 3 State: Kosong -> Dilakukan (true) -> Tidak Dilakukan (false) -> Kosong
      if (currentState === undefined) {
        newRecords[key] = true; // State 1: Dilakukan (Hijau)
      } else if (currentState === true) {
        newRecords[key] = false; // State 2: Tidak dilakukan (Merah)
      } else {
        delete newRecords[key]; // State 3: Kosong (Reset)
      }
      
      return newRecords;
    });
  };

  const stats = useMemo(() => {
    const totalActivities = sortedActivities.length;
    if (totalActivities === 0) return { daily: [], weekly: [], monthly: 0, totalDone: 0, totalMissed: 0, mostFrequent: [], leastFrequent: [] };

    let globalDone = 0;
    let globalMissed = 0;
    const activityCounts = {};
    sortedActivities.forEach(act => activityCounts[act.id] = 0);

    // Daily Progress (%)
    const daily = daysArray.map(day => {
      let completed = 0;
      sortedActivities.forEach(act => {
        const state = records[getRecordKey(act.id, day)];
        if (state === true) {
          completed++;
          globalDone++;
          activityCounts[act.id]++;
        } else if (state === false) {
          globalMissed++;
        }
      });
      return { day, percentage: Math.round((completed / totalActivities) * 100) || 0 };
    });

    // Weekly Progress (%) - grouping days by 7
    const weeks = [
      { label: 'Pekan 1', days: daysArray.slice(0, 7) },
      { label: 'Pekan 2', days: daysArray.slice(7, 14) },
      { label: 'Pekan 3', days: daysArray.slice(14, 21) },
      { label: 'Pekan 4', days: daysArray.slice(21, 28) },
      { label: 'Pekan 5', days: daysArray.slice(28, daysInMonth) }
    ];

    const weekly = weeks.map(week => {
      let weekCompleted = 0;
      let weekTotal = week.days.length * totalActivities;
      week.days.forEach(day => {
        sortedActivities.forEach(act => {
          if (records[getRecordKey(act.id, day)] === true) weekCompleted++;
        });
      });
      return { 
        label: week.label, 
        percentage: weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0 
      };
    });

    // Monthly Progress (%) khusus bulan terpilih
    const monthly = Math.round((globalDone / (totalActivities * daysInMonth)) * 100) || 0;

    // Insight: Aktivitas Paling Sering & Paling Jarang
    let maxCount = -1;
    let minCount = 9999;
    
    Object.keys(activityCounts).forEach(id => {
      const count = activityCounts[id];
      if (count > maxCount) maxCount = count;
      if (count < minCount) minCount = count;
    });

    const mostFrequent = sortedActivities.filter(act => activityCounts[act.id] === maxCount).map(act => act.name);
    const leastFrequent = sortedActivities.filter(act => activityCounts[act.id] === minCount).map(act => act.name);

    return { 
      daily, 
      weekly, 
      monthly, 
      totalDone: globalDone, 
      totalMissed: globalMissed, 
      mostFrequent, 
      leastFrequent,
      maxCount,
      minCount
    };
  }, [sortedActivities, records, daysArray, selectedMonth, selectedYear, daysInMonth]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-emerald-700 flex items-center gap-2">
              <IconChart /> Tracker Ibadah & Hal Positif
            </h1>
            <p className="text-sm text-slate-500 mt-1">Pantau & evaluasi konsistensi ibadah Anda setiap bulannya.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            <div className="flex gap-2 w-full sm:w-auto">
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="flex-1 sm:flex-none px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium text-slate-700 bg-white cursor-pointer"
              >
                {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
              <input 
                type="number" 
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-24 px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium text-slate-700 bg-white"
                min="2000" max="2100"
              />
            </div>

            <div className="text-center px-4 py-2 bg-emerald-50 rounded-lg border border-emerald-100 w-full sm:w-auto">
              <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Progress Bulan Ini</div>
              <div className="text-2xl font-bold text-emerald-700">{stats.monthly}%</div>
            </div>
          </div>
        </div>

        {/* Top Controls: Add Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <form onSubmit={handleAddActivity} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nama Ibadah</label>
              <input 
                type="text" 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Cth: Tilawah Surat Al-Mulk"
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
            <div className="w-full sm:w-48">
              <label className="block text-sm font-medium text-slate-700 mb-1">Jam (Waktu)</label>
              <input 
                type="time" 
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
            <button 
              type="submit"
              disabled={!newName.trim() || !newTime}
              className="w-full sm:w-auto px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex justify-center items-center gap-2 h-[42px]"
            >
              <IconPlus /> Tambah
            </button>
          </form>
          <p className="text-xs text-slate-400 mt-3">*Aktivitas akan otomatis diurutkan mulai dari pukul 02:00 dini hari hingga larut malam.</p>
        </div>

        {}
        {/* Main Table (Excel Sheet Canvas) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="sticky left-0 z-20 bg-slate-100 border-b border-r border-slate-200 py-3 px-4 text-left font-semibold text-slate-700 min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    Aktivitas Ibadah dan Hal Positif
                  </th>
                  <th className="border-b border-r border-slate-200 py-3 px-3 font-semibold text-slate-700 whitespace-nowrap min-w-[80px]">
                    Waktu
                  </th>
                  {daysArray.map(day => (
                    <th key={day} className="border-b border-r border-slate-200 py-2 px-1 font-medium text-slate-600 min-w-[48px] text-center">
                      <div className="text-[10px] uppercase text-slate-400 mb-1">{getDayName(day)}</div>
                      <div className="text-sm">{day}</div>
                    </th>
                  ))}
                  <th className="border-b border-slate-200 py-3 px-3 font-semibold text-slate-700 min-w-[80px]">
                    Opsi
                  </th>
                </tr>
              </thead>
              {}
              <tbody>
                {sortedActivities.length === 0 ? (
                  <tr>
                    <td colSpan={daysInMonth + 3} className="py-8 text-center text-slate-500">
                      Belum ada aktivitas ibadah atau hal positif yang ditambahkan.
                    </td>
                  </tr>
                ) : (
                  sortedActivities.map((act, index) => {
                    let elapsedDays = 0;
                    const today = new Date();
                    
                    if (selectedYear < today.getFullYear() || (selectedYear === today.getFullYear() && selectedMonth < today.getMonth())) {
                      elapsedDays = daysInMonth; // Bulan lalu, hitung seluruh hari di bulan tersebut
                    } else if (selectedYear === today.getFullYear() && selectedMonth === today.getMonth()) {
                      elapsedDays = today.getDate(); // Bulan ini, hitung sampai hari ini
                    }
                    
                    // Hitung evaluasi hanya dari "pekan yang sudah berlalu" (setiap kelipatan 7 hari)
                    const elapsedWeeks = Math.floor(elapsedDays / 7);
                    const evaluatedDays = elapsedWeeks * 7;
                    
                    let doneCount = 0;
                    let filledCount = 0;
                    for (let day = 1; day <= evaluatedDays; day++) {
                      const state = records[getRecordKey(act.id, day)];
                      if (state === true) doneCount++;
                      if (state !== undefined) filledCount++;
                    }
                    
                    // Merah jika pelaksanaan kurang dari 50% dari total hari di pekan yang sudah berlalu
                    // DAN user sudah mulai mengisi tabel (filledCount > 0) agar tidak merah dari awal
                    const isUnderperforming = evaluatedDays > 0 && filledCount > 0 && (doneCount / evaluatedDays) < 0.5;
                    const defaultBg = index % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                    const nameCellClass = isUnderperforming ? 'bg-red-50 text-red-700' : `${defaultBg} text-slate-800`;

                    return (
                      <tr key={act.id} className={`hover:bg-emerald-50/30 transition-colors ${defaultBg}`}>
                        <td className={`sticky left-0 z-10 border-b border-r border-slate-200 py-2 px-4 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] font-medium ${nameCellClass}`}>
                          {editingId === act.id ? (
                            <input 
                              type="text" 
                              value={editName} 
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full px-2 py-1 rounded border border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm bg-white"
                              autoFocus
                            />
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <span>{act.name}</span>
                              {isUnderperforming && (
                                <span 
                                  title={`Perhatian: Pelaksanaan di bawah 50% dalam ${elapsedWeeks} pekan terakhir`} 
                                  className="flex-shrink-0 w-2 h-2 rounded-full bg-red-500 animate-pulse"
                                ></span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="border-b border-r border-slate-200 py-2 px-3 text-center text-emerald-600 font-semibold bg-emerald-50/30">
                          {editingId === act.id ? (
                            <input 
                              type="time" 
                              value={editTime} 
                              onChange={(e) => setEditTime(e.target.value)}
                              className="w-full px-1 py-1 rounded border border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm bg-white text-center"
                            />
                          ) : (
                            act.time
                          )}
                        </td>
                        {/* 3-State Click Mechanism */}
                        {daysArray.map(day => {
                          const state = records[getRecordKey(act.id, day)];
                          return (
                            <td 
                              key={day} 
                              onClick={() => toggleRecord(act.id, day)}
                              className="border-b border-r border-slate-200 py-2 px-1 text-center cursor-pointer transition-all hover:bg-slate-200/50"
                            >
                              <div className="flex justify-center items-center h-full min-h-[24px]">
                                {state === true && (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-sm"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                )}
                                {state === false && (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-sm"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td className="border-b border-slate-200 py-2 px-3 text-center">
                          {editingId === act.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <button 
                                onClick={() => handleSaveEdit(act.id)}
                                className="text-emerald-500 hover:text-emerald-700 transition-colors p-1 rounded hover:bg-emerald-50"
                                title="Simpan"
                              >
                                <IconSave />
                              </button>
                              <button 
                                onClick={handleCancelEdit}
                                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded hover:bg-slate-100"
                                title="Batal"
                              >
                                <IconX />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <button 
                                onClick={() => handleEditClick(act)}
                                className="text-blue-400 hover:text-blue-600 transition-colors p-1 rounded hover:bg-blue-50"
                                title="Edit aktivitas"
                              >
                                <IconEdit />
                              </button>
                              <button 
                                onClick={() => handleDeleteActivity(act.id)}
                                className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50"
                                title="Hapus aktivitas"
                              >
                                <IconTrash />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {}
        {/* Dashboard Graphics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Daily Graph */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 lg:col-span-2">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Grafik Progress Harian (%)</h2>
            <div className="h-48 flex items-end gap-1 sm:gap-2">
              {stats.daily.map((stat) => (
                <div key={stat.day} className="flex-1 flex flex-col items-center group">
                  <div className="w-full flex justify-center relative">
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 bg-slate-800 text-white text-xs rounded px-2 py-1 pointer-events-none transition-opacity z-10 whitespace-nowrap">
                      Hari {stat.day}: {stat.percentage}%
                    </div>
                    {/* Bar */}
                    <div 
                      className={`w-full max-w-[20px] rounded-t-sm transition-all duration-500 ${stat.percentage >= 80 ? 'bg-emerald-500' : stat.percentage >= 40 ? 'bg-amber-400' : 'bg-slate-200'}`}
                      style={{ height: `${Math.max(stat.percentage, 5)}%`, minHeight: '4px' }}
                    ></div>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-2">{stat.day}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-6 text-xs text-slate-500 justify-center border-t border-slate-100 pt-4">
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-200 rounded-sm"></div> Rendah (&lt;40%)</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-400 rounded-sm"></div> Sedang (40-79%)</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded-sm"></div> Tinggi (&ge;80%)</div>
            </div>
          </div>

          {/* Weekly Graph */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Progress Mingguan</h2>
            <div className="space-y-4">
              {stats.weekly.map((week, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{week.label}</span>
                    <span className="text-slate-500">{week.percentage}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5">
                    <div 
                      className="bg-emerald-500 h-2.5 rounded-full transition-all duration-700" 
                      style={{ width: `${week.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {}
          {/* Comparison Graph (Done vs Missed) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Perbandingan Status</h2>
            {stats.totalDone === 0 && stats.totalMissed === 0 ? (
              <div className="text-sm text-slate-500 text-center py-4 flex flex-col items-center">
                <IconChart />
                <span className="mt-2">Belum ada data bulan ini</span>
              </div>
            ) : (
              <div className="space-y-4 mt-8">
                <div className="flex items-end justify-between mb-2">
                  <div className="text-emerald-600">
                    <div className="text-3xl font-bold">{stats.totalDone}</div>
                    <div className="text-xs font-medium uppercase tracking-wider">Dilakukan</div>
                  </div>
                  <div className="text-red-500 text-right">
                    <div className="text-3xl font-bold">{stats.totalMissed}</div>
                    <div className="text-xs font-medium uppercase tracking-wider">Terlewat</div>
                  </div>
                </div>
                {/* Horizontal Stacked Bar */}
                <div className="w-full flex h-4 rounded-full overflow-hidden shadow-inner bg-slate-100">
                  <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${(stats.totalDone / (stats.totalDone + stats.totalMissed)) * 100}%` }}></div>
                  <div className="bg-red-500 transition-all duration-500" style={{ width: `${(stats.totalMissed / (stats.totalDone + stats.totalMissed)) * 100}%` }}></div>
                </div>
              </div>
            )}
          </div>

          {/* Insights (Most & Least) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 lg:col-span-2">
             <h2 className="text-lg font-bold text-slate-800 mb-4">Insight Aktivitas Bulan Ini</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {/* Most Frequent */}
               <div className="p-5 rounded-xl bg-emerald-50/70 border border-emerald-100/50 relative overflow-hidden">
                 <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1018 0 9 9 0 00-18 0z"></path></svg>
                   Paling Konsisten Dilakukan
                 </div>
                 {stats.mostFrequent.length > 0 && stats.maxCount > 0 ? (
                   <div>
                     <p className="font-semibold text-slate-800 text-lg leading-tight">{stats.mostFrequent.join(', ')}</p>
                     <p className="text-sm text-emerald-700 mt-2 font-medium bg-emerald-100 inline-block px-2 py-1 rounded-md">{stats.maxCount} kali tuntas</p>
                   </div>
                 ) : (
                   <p className="text-sm text-slate-500 italic">Data belum cukup.</p>
                 )}
               </div>
               
               {/* Least Frequent */}
               <div className="p-5 rounded-xl bg-red-50/70 border border-red-100/50 relative overflow-hidden">
                 <div className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                   Paling Sering Terlewat
                 </div>
                 {stats.leastFrequent.length > 0 && stats.maxCount > 0 ? (
                   <div>
                     <p className="font-semibold text-slate-800 text-lg leading-tight">{stats.leastFrequent.join(', ')}</p>
                     <p className="text-sm text-red-700 mt-2 font-medium bg-red-100 inline-block px-2 py-1 rounded-md">Hanya {stats.minCount} kali dilakukan</p>
                   </div>
                 ) : (
                   <p className="text-sm text-slate-500 italic">Data belum cukup.</p>
                 )}
               </div>
             </div>
          </div>

        </div>
        
      </div>
    </div>
  );
}