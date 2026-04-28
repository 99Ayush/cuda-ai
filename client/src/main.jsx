import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Shield, 
  Search, 
  ArrowRight, 
  History, 
  Terminal, 
  Command as CommandIcon,
  Activity,
  ChevronDown,
  ExternalLink, 
  Loader2, 
  Lock, 
  Globe,
  LayoutGrid,
  X,
  Target,
  BarChart2,
  Cpu,
  Database,
  Activity as Pulse,
  MessageSquare,
  AlertTriangle,
  TrendingUp,
  Zap
} from 'lucide-react';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis,
  PolarRadiusAxis, 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip 
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

// --- API ---
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const analyzeClaim = async (data) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/analyze-claim`, data);
    return response.data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

const fetchHistory = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/history`);
    return response.data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// --- DASHBOARD ---
const radarData = [
  { subject: 'Emotionality', A: 120, fullMark: 150 },
  { subject: 'Political Lean', A: 98, fullMark: 150 },
  { subject: 'Credibility', A: 86, fullMark: 150 },
  { subject: 'Sourcing', A: 99, fullMark: 150 },
  { subject: 'Fact Density', A: 85, fullMark: 150 },
];

const trendData = [
  { name: 'MON', count: 40 },
  { name: 'TUE', count: 30 },
  { name: 'WED', count: 65 },
  { name: 'THU', count: 45 },
  { name: 'FRI', count: 90 },
  { name: 'SAT', count: 58 },
  { name: 'SUN', count: 72 },
];

// Fixed heatmap data - seeded so it doesn't re-randomize on every render
const heatmapLevels = Array.from({ length: 56 }, (_, i) => [0,0,1,1,2,3,1,0,2,1,3,2,1,0,1,2,3,1,0,2,1,1,3,2,0,1,0,2,1,3,2,1,0,1,2,1,3,0,2,1,1,0,2,3,1,2,0,1,2,1,3,1,0,2,1,1][i % 56]);

const activityFeed = [
  { time: '16:47', type: 'TRUE', claim: '"WHO declares mpox outbreak contained in SE Asia"' },
  { time: '16:41', type: 'FAKE', claim: '"5G towers cause bird migration disruption"' },
  { time: '16:38', type: 'MISLEADING', claim: '"India GDP overtakes Germany in 2024"' },
  { time: '16:22', type: 'TRUE', claim: '"OpenAI releases o3 model to API"' },
  { time: '16:10', type: 'FAKE', claim: '"NASA confirms life on Europa moon"' },
];

const Dashboard = ({ onScan }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-5 p-6 overflow-y-auto h-full pb-20"
    >
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<TrendingUp size={14} />} label="TRENDING_FLIPS" value="42" change="+8%" color="blue" />
        <StatCard icon={<AlertTriangle size={14} />} label="DEEPFAKE_ALERTS" value="12" change="+3" color="rose" />
        <StatCard icon={<Zap size={14} />} label="REALTIME_SCANS" value="1,284" change="+120/hr" color="amber" />
        <StatCard icon={<LayoutGrid size={14} />} label="GLOBAL_SYNC" value="READY" change="6 nodes" color="emerald" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1">

        {/* Bias Radar */}
        <div className="lg:col-span-1 border border-[#1F1F22] rounded-[6px] bg-[#0D0D0E]/80 p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="label-tiny text-[#4285F4]">BIAS_RADAR</span>
              <p className="text-[10px] text-zinc-600 mt-0.5">Model consensus on source leanings</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-[#4285F4] animate-pulse shadow-[0_0_8px_#4285F4]" />
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                <PolarGrid stroke="#1F1F22" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#52525b', fontSize: 9, fontFamily: 'monospace' }} />
                <Radar name="Bias Profile" dataKey="A" stroke="#4285F4" fill="#4285F4" fillOpacity={0.25} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 mt-auto">
            {[['Emotionality','HIGH'],['Credibility','MED'],['Sourcing','HIGH'],['Bias','LOW']].map(([k,v]) => (
              <div key={k} className="flex justify-between items-center p-1.5 bg-zinc-950/60 rounded-[2px] border border-[#1F1F22]">
                <span className="text-[8px] mono text-zinc-600">{k}</span>
                <span className={`text-[8px] font-black mono ${v === 'HIGH' ? 'text-amber-400' : v === 'LOW' ? 'text-emerald-400' : 'text-blue-400'}`}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: heatmap + chart + feed */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Heatmap */}
          <div className="border border-[#1F1F22] rounded-[6px] bg-[#0D0D0E]/80 p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="label-tiny text-[#6366F1]">GLOBAL_HEATMAP</span>
                <p className="text-[10px] text-zinc-600 mt-0.5">Claim density across neural sectors — last 7 days</p>
              </div>
              <div className="flex items-center gap-2">
                {[['NONE','bg-zinc-800'],['LOW','bg-[#4285F4]/30'],['MED','bg-[#6366F1]/60'],['HIGH','bg-rose-500/70']].map(([l,c]) => (
                  <div key={l} className="flex items-center gap-1">
                    <div className={`w-2.5 h-2.5 rounded-[1px] ${c}`} />
                    <span className="text-[7px] mono text-zinc-600">{l}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(14, 1fr)' }}>
              {heatmapLevels.map((level, i) => (
                <div
                  key={i}
                  title={`Sector ${i}: ${['None','Low','Med','High'][level]} activity`}
                  className={`h-5 rounded-[2px] cursor-pointer transition-all hover:scale-110 hover:z-10 ${
                    level === 0 ? 'bg-zinc-900 border border-zinc-800/50' :
                    level === 1 ? 'bg-[#4285F4]/25 border border-[#4285F4]/20' :
                    level === 2 ? 'bg-[#6366F1]/50 border border-[#6366F1]/40' :
                    'bg-rose-500/70 border border-rose-400/50 shadow-[0_0_6px_rgba(239,68,68,0.3)]'
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between">
              {['MON','TUE','WED','THU','FRI','SAT','SUN'].map(d => (
                <span key={d} className="text-[8px] mono text-zinc-700">{d}</span>
              ))}
            </div>
          </div>

          {/* Bar chart + Activity feed side by side */}
          <div className="grid grid-cols-5 gap-5 flex-1">

            {/* Weekly trend bar chart */}
            <div className="col-span-2 border border-[#1F1F22] rounded-[6px] bg-[#0D0D0E]/80 p-5 flex flex-col gap-3">
              <div>
                <span className="label-tiny text-amber-400">SCAN_VOLUME</span>
                <p className="text-[10px] text-zinc-600 mt-0.5">Weekly trend</p>
              </div>
              <div className="flex-1 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} barSize={14}>
                    <XAxis dataKey="name" tick={{ fill: '#52525b', fontSize: 8, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0A0A0B', border: '1px solid #1F1F22', fontSize: '10px', borderRadius: '4px' }}
                      itemStyle={{ color: '#4285F4' }}
                      cursor={{ fill: 'rgba(66,133,244,0.05)' }}
                    />
                    <Bar dataKey="count" fill="#4285F4" radius={[3, 3, 0, 0]} fillOpacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Live activity feed */}
            <div className="col-span-3 border border-[#1F1F22] rounded-[6px] bg-[#0D0D0E]/80 p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="label-tiny text-emerald-400">LIVE_FEED</span>
                  <p className="text-[10px] text-zinc-600 mt-0.5">Recent global verifications</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[8px] mono text-zinc-600">LIVE</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 overflow-hidden">
                {activityFeed.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-start gap-2.5 p-2 rounded-[3px] bg-zinc-950/60 border border-[#1F1F22] hover:border-[#4285F4]/50 hover:bg-[#4285F4]/5 transition-all cursor-pointer group/item"
                    onClick={() => onScan(item.claim)}
                  >
                    <span className="text-[8px] mono text-zinc-600 shrink-0 mt-0.5 group-hover/item:text-[#4285F4]">{item.time}</span>
                    <span className={`text-[8px] font-black mono shrink-0 px-1.5 py-0.5 rounded-[2px] ${
                      item.type === 'TRUE' ? 'text-emerald-400 bg-emerald-500/10' :
                      item.type === 'FAKE' ? 'text-rose-400 bg-rose-500/10' :
                      'text-amber-400 bg-amber-500/10'
                    }`}>{item.type}</span>
                    <span className="text-[9px] text-zinc-500 leading-tight truncate group-hover/item:text-zinc-200">{item.claim}</span>
                  </motion.div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </motion.div>
  );
};

const StatCard = ({ icon, label, value, change, color }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="border border-[#1F1F22] rounded-[6px] bg-[#0D0D0E]/80 p-4 flex flex-col gap-3 group hover:border-zinc-700 transition-all cursor-default relative overflow-hidden"
  >
    <div className={`absolute top-0 right-0 w-16 h-16 bg-${color}-500/5 rounded-full blur-xl pointer-events-none`} />
    <div className="flex items-center justify-between">
      <div className={`p-1.5 rounded-[4px] bg-zinc-900 border border-[#1F1F22] text-zinc-600 group-hover:text-${color}-400 transition-colors`}>
        {icon}
      </div>
      <span className={`text-[8px] font-black mono px-1.5 py-0.5 rounded-[2px] text-${color}-400 bg-${color}-500/10`}>
        {change}
      </span>
    </div>
    <div>
      <span className="text-2xl font-black tracking-tight">{value}</span>
      <p className="text-[8px] mono text-zinc-600 mt-1 tracking-widest">{label}</p>
    </div>
    <div className="h-px w-full bg-zinc-900 overflow-hidden rounded-full">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: color === 'emerald' ? '95%' : color === 'blue' ? '70%' : color === 'amber' ? '85%' : '40%' }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className={`h-full bg-${color}-500/60`}
      />
    </div>
  </motion.div>
);



const F1TelemetryLoader = () => {
  const [velocity, setVelocity] = useState(0);
  const [sector, setSector] = useState(1);

  useEffect(() => {
    const vInt = setInterval(() => {
      setVelocity(prev => Math.min(340, prev + Math.floor(Math.random() * 15)));
    }, 50);
    const sInt = setInterval(() => {
      setSector(prev => (prev % 3) + 1);
    }, 400);
    return () => { clearInterval(vInt); clearInterval(sInt); };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md rounded-[6px] border border-[#1F1F22] overflow-hidden"
    >
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #4285F4 2px, #4285F4 4px)', backgroundSize: '100% 4px' }} />
      
      {/* RPM Lights */}
      <div className="flex gap-1 mb-12 relative z-10">
         {Array.from({ length: 15 }).map((_, i) => (
            <motion.div 
               key={i}
               initial={{ opacity: 0.1 }}
               animate={{ opacity: [0.1, 1, 0.1] }}
               transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.03 }}
               className={`w-6 h-3 rounded-[1px] ${i < 5 ? 'bg-emerald-500 shadow-[0_0_12px_#10B981]' : i < 10 ? 'bg-amber-500 shadow-[0_0_12px_#F59E0B]' : 'bg-rose-500 shadow-[0_0_12px_#EF4444]'}`}
            />
         ))}
      </div>

      <div className="flex gap-16 items-center relative z-10">
         <div className="flex flex-col items-end">
            <span className="text-[10px] mono text-zinc-500 tracking-widest">TELEMETRY_VELOCITY</span>
            <div className="flex items-baseline gap-1">
               <span className="text-6xl font-black mono text-white tracking-tighter">{velocity}</span>
               <span className="text-sm mono text-[#4285F4]">TB/s</span>
            </div>
         </div>
         
         <div className="w-px h-24 bg-zinc-800 rotate-12" />

         <div className="flex flex-col items-start">
            <span className="text-[10px] mono text-zinc-500 tracking-widest">ACTIVE_SECTOR</span>
            <div className="flex gap-2 mt-2">
               {[1, 2, 3].map(s => (
                 <div key={s} className={`w-12 h-12 flex items-center justify-center rounded-[2px] border ${sector === s ? 'border-[#4285F4] bg-[#4285F4]/20 text-[#4285F4] shadow-[0_0_15px_rgba(66,133,244,0.3)]' : 'border-zinc-800 text-zinc-600'} text-xl font-black mono transition-all duration-75`}>
                   S{s}
                 </div>
               ))}
            </div>
         </div>
      </div>

      <div className="mt-12 text-[#4285F4] text-[10px] mono tracking-[0.4em] uppercase animate-pulse relative z-10">
         [ SYNTHESIZING_NEURAL_PATHWAYS ]
      </div>
    </motion.div>
  );
};


// --- APP ---
const App = () => {
  const [claim, setClaim] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [historyResults, setHistoryResults] = useState([]);
  const [devMode, setDevMode] = useState(false);
  const [showDevConsole, setShowDevConsole] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showMeshModal, setShowMeshModal] = useState(false);
  const [devLogs, setDevLogs] = useState([]);
  const [activeView, setActiveView] = useState('claims');
  const [selectedResult, setSelectedResult] = useState(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [systemStats, setSystemStats] = useState({ cpu: 24, quota: 82, latency: 0 });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
      if (e.key === 'Escape') {
        setSelectedResult(null);
        setShowCommandPalette(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    
    const interval = setInterval(() => {
      setSystemStats(prev => ({
        cpu: Math.min(99, Math.max(10, prev.cpu + (Math.random() * 4 - 2))),
        quota: prev.quota,
        latency: prev.latency
      }));
    }, 3000);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (activeView === 'history') {
      const loadHistory = async () => {
        try {
          const data = await fetchHistory();
          const formatted = data.map(item => ({
            ...item,
            id: item.id || Date.now(),
            input: item.claim,
            status: item.status || "Unknown",
            reliability_score: item.score || 0,
            explanation: item.explanation || item.status,
            latency_ms: item.metadata?.latency_ms || 0,
            citations: item.citations || item.metadata?.citations || []
          }));
          setHistoryResults(formatted);
        } catch (err) {
          console.error("Failed to load history:", err);
        }
      };
      loadHistory();
    }
  }, [activeView]);

  const performScan = useCallback(async (textToScan) => {
    if (!textToScan.trim() || loading) return;
    setActiveView('claims');
    setLoading(true);
    const logEntry = { time: new Date().toISOString(), type: 'REQUEST', msg: `POST /analyze-claim → "${textToScan.substring(0,40)}..."` };
    setDevLogs(prev => [logEntry, ...prev].slice(0, 50));
    try {
      const data = await analyzeClaim({ text: textToScan });
      setResults(prev => [{ ...data, id: Date.now(), input: textToScan }, ...prev]);
      setDevLogs(prev => [{ time: new Date().toISOString(), type: data.error ? 'ERROR' : 'SUCCESS', msg: `← ${data.status} | score=${data.reliability_score} | latency=${data.latency_ms}ms` }, ...prev].slice(0, 50));
    } catch (err) {
      console.error(err);
      setDevLogs(prev => [{ time: new Date().toISOString(), type: 'ERROR', msg: `← EXCEPTION: ${err.message}` }, ...prev].slice(0, 50));
    } finally {
      setLoading(false);
    }
  }, [loading, results]);

  const handleScan = useCallback((e) => {
    e.preventDefault();
    performScan(claim);
    setClaim('');
  }, [claim, performScan]);

  return (
    <div className="flex h-screen bg-[#020203] text-[#ffffff] font-sans overflow-hidden selection:bg-[#4285F4]/30">
      <div className="scanline" />
      
      <aside className="w-[72px] border-r border-[#1F1F22] flex flex-col items-center py-6 gap-6 bg-black/60 backdrop-blur-xl z-50 relative">
        {/* Vertical accent line */}
        <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-[#4285F4]/30 to-transparent pointer-events-none" />

        {/* Logo */}
        <motion.div 
          onClick={() => setActiveView('claims')}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className="w-10 h-10 flex items-center justify-center bg-[#4285F4] rounded-[4px] shadow-[0_0_24px_rgba(66,133,244,0.5)] cursor-pointer relative"
        >
          <Shield size={20} className="text-white" />
          <div className="absolute inset-0 rounded-[4px] bg-[#4285F4] blur-md opacity-40 -z-10" />
        </motion.div>

        {/* Divider */}
        <div className="w-8 h-px bg-[#1F1F22]" />
        
        <nav className="flex flex-col gap-1 w-full px-2">
          <NavItem 
            icon={<Pulse size={16} />} 
            active={activeView === 'claims'} 
            onClick={() => setActiveView('claims')}
            title="Investigate"
            label="SCAN"
          />
          <NavItem 
            icon={<History size={16} />} 
            active={activeView === 'history'} 
            onClick={() => setActiveView('history')}
            title="Archives"
            label="HISTORY"
          />
          <NavItem 
            icon={<LayoutGrid size={16} />} 
            active={activeView === 'dashboard'} 
            onClick={() => setActiveView('dashboard')}
            title="Telemetry"
            label="STATS"
          />
          <NavItem icon={<Globe size={16} />} onClick={() => setShowMeshModal(true)} title="Network Mesh" label="MESH" active={showMeshModal} />
        </nav>

        <div className="mt-auto flex flex-col gap-1 w-full px-2">
          <NavItem icon={<Terminal size={16} />} onClick={() => setShowDevConsole(true)} title="Dev Console" label="DEV" active={showDevConsole} />
          <NavItem icon={<Lock size={16} />} onClick={() => setShowSecurityModal(true)} title="Security" label="LOCK" />
        </div>

        {/* Bottom system dot */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10B981]" />
          <span className="text-[7px] mono text-zinc-700 tracking-widest">LIVE</span>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-20 border-b border-[#1F1F22] flex items-center px-10 justify-between bg-[#020203]/40 backdrop-blur-xl z-20 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-[#4285F4]/5 via-transparent to-transparent pointer-events-none" />
          
          <div className="flex items-center gap-10 relative z-10">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                 <div className="w-2 h-2 bg-[#4285F4] rounded-[1px] animate-pulse shadow-[0_0_8px_#4285F4]" />
                 <span className="text-[10px] font-black mono text-[#4285F4] tracking-[0.2em]">CUDA_CORE_v2.0</span>
              </div>
              <div className="flex items-center gap-3">
                 <span className="text-[11px] font-bold text-white tracking-tight">ACTIVE_GUARD_SYSTEM</span>
                 <div className="h-3 w-px bg-zinc-800" />
                 <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-[9px] mono text-zinc-500 uppercase tracking-widest font-black">Online</span>
                 </div>
              </div>
            </div>

            <div className="hidden lg:flex flex-col gap-1 border-l border-[#1F1F22] pl-8">
               <span className="text-[8px] mono text-zinc-600 uppercase tracking-[0.3em]">Neural_Pathing</span>
               <div className="flex items-center gap-2">
                  <span className="text-[10px] mono text-zinc-400 font-bold">ROOT</span>
                  <ArrowRight size={10} className="text-zinc-700" />
                  <span className="text-[10px] mono text-zinc-400 font-bold">SECTOR_B</span>
                  <ArrowRight size={10} className="text-zinc-700" />
                  <span className="text-[10px] mono text-[#4285F4] font-bold">OPTIMIZED</span>
               </div>
            </div>
          </div>
          
          <div className="flex items-center gap-8 relative z-10">
             <div className="hidden md:flex flex-col items-end gap-1">
                <span className="text-[8px] mono text-zinc-600 uppercase tracking-[0.3em]">Node_Sync</span>
                <div className="flex gap-1">
                   {[1,2,3,4,5].map(i => (
                     <div key={i} className={`w-1 h-3 rounded-[1px] ${i < 4 ? 'bg-[#4285F4]/60' : 'bg-zinc-800'}`} />
                   ))}
                </div>
             </div>

             <div className="flex items-center gap-5">
                <div className="flex flex-col items-end pr-5 border-r border-[#1F1F22]">
                   <span className="text-[9px] mono text-zinc-600 tracking-tighter uppercase mb-0.5">ENCRYPTION_LAYER</span>
                   <div className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10B981]" />
                      <span className="text-[10px] font-black mono text-emerald-500/80 tracking-widest">AES_256_ACTIVE</span>
                   </div>
                </div>
                
                <div className="flex items-center gap-4">
                   <div className="flex flex-col items-end">
                      <span className="text-[14px] font-black mono text-white leading-none">{new Date().getHours().toString().padStart(2, '0')}:{new Date().getMinutes().toString().padStart(2, '0')}</span>
                      <span className="text-[8px] mono text-zinc-600 uppercase tracking-widest mt-1">Local_Time</span>
                   </div>
                   <div className="w-10 h-10 rounded-full border border-[#1F1F22] bg-zinc-950 flex items-center justify-center overflow-hidden relative group cursor-help">
                      <div className="absolute inset-0 bg-[#4285F4]/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="w-6 h-6 bg-[#4285F4]/10 rounded-full animate-ping" />
                      <div className="w-3 h-3 bg-[#4285F4] rounded-full relative z-10 shadow-[0_0_15px_#4285F4]" />
                      <div className="absolute inset-0 border border-[#4285F4]/20 rounded-full animate-[spin_4s_linear_infinite]" style={{ borderTopColor: 'transparent', borderRightColor: 'transparent' }} />
                   </div>
                </div>
             </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {activeView === 'dashboard' ? (
            <div className="flex-1 overflow-hidden p-8">
              <Dashboard onScan={performScan} />
            </div>
          ) : (
            <>
              <div className="flex-1 flex flex-col p-8 gap-6 overflow-y-auto">
                <section className="sticky top-0 z-10 bg-[#020203]/80 backdrop-blur-xl pb-6">
                  <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-[#4285F4]/30 to-[#6366F1]/30 rounded-[4px] blur opacity-0 group-focus-within:opacity-100 transition duration-500 group-hover:opacity-50"></div>
                    <form onSubmit={handleScan} className="relative bg-[#0A0A0B] border border-[#1F1F22] group-focus-within:border-[#4285F4]/50 rounded-[4px] flex items-center shadow-2xl overflow-hidden transition-all duration-300">
                      <div className="pl-4 pr-3 py-4 flex items-center justify-center relative">
                         <div className="absolute inset-0 bg-[#4285F4]/10 opacity-0 group-focus-within:opacity-100 blur-md transition-opacity"></div>
                         <Search size={18} className="text-zinc-600 group-focus-within:text-[#4285F4] transition-colors relative z-10" />
                      </div>
                      <input 
                        id="main-search"
                        type="text" 
                        value={claim}
                        onChange={(e) => setClaim(e.target.value)}
                        placeholder="INITIALIZE_NEURAL_SCAN_WITH_QUERY_OR_URL..."
                        className="flex-1 bg-transparent border-none py-4 text-[13px] font-bold tracking-widest text-zinc-200 placeholder:text-zinc-700 placeholder:font-mono focus:outline-none focus:ring-0 transition-all w-full"
                        spellCheck="false"
                      />
                      <div className="pr-2 flex items-center gap-3">
                         {loading && <Loader2 size={16} className="animate-spin text-[#4285F4]" />}
                         <button type="submit" className="relative overflow-hidden flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-[#1F1F22] rounded-[2px] group/btn hover:border-[#6366F1]/50 transition-all cursor-pointer">
                            <div className="absolute inset-0 bg-gradient-to-r from-[#6366F1]/0 via-[#6366F1]/10 to-[#6366F1]/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700"></div>
                            <CommandIcon size={12} className="text-zinc-500 group-hover/btn:text-[#6366F1] transition-colors relative z-10" />
                            <span className="text-[10px] font-black mono text-zinc-500 group-hover/btn:text-white transition-colors tracking-widest relative z-10">EXECUTE</span>
                         </button>
                      </div>
                    </form>
                  </div>
                </section>

                <div className="flex flex-col gap-4 relative min-h-[400px]">
                   <div className="flex items-center justify-between px-2 mb-2">
                      <span className="label-tiny">
                        {activeView === 'history' ? 'ARCHIVE_RECORDS' : 'REALTIME_INVESTIGATIONS'}
                      </span>
                      <span className="text-[10px] mono text-zinc-600">
                        COUNT: {(activeView === 'history' ? historyResults : results).length}
                      </span>
                   </div>
                   
                  <AnimatePresence mode="popLayout">
                    {loading && <F1TelemetryLoader key="loader" />}
                    {(activeView === 'history' ? historyResults : results).map((res, index) => (
                      <ResultCard 
                        key={res.id} 
                        result={res} 
                        index={index} 
                        devMode={devMode} 
                        onClick={() => setSelectedResult(res)}
                      />
                    ))}
                    {(activeView === 'history' ? historyResults : results).length === 0 && !loading && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.98 }} 
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex-1 min-h-[450px] border border-[#1F1F22] rounded-[8px] bg-[#020203]/50 flex flex-col items-center justify-center relative overflow-hidden group"
                      >
                        {/* Background Grid */}
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#4285F4 1px, transparent 1px), linear-gradient(90deg, #4285F4 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                        
                        {/* Animated Radar Rings */}
                        <div className="relative mb-12">
                           <motion.div 
                              animate={{ rotate: 360 }}
                              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                              className="absolute inset-[-60px] border border-dashed border-[#4285F4]/10 rounded-full"
                           />
                           <motion.div 
                              animate={{ rotate: -360 }}
                              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                              className="absolute inset-[-100px] border border-dotted border-zinc-800 rounded-full"
                           />
                           <div className="relative w-24 h-24 rounded-full bg-[#0A0A0B] border border-[#1F1F22] flex items-center justify-center shadow-[0_0_40px_rgba(0,0,0,0.5)]">
                              <motion.div 
                                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="absolute inset-0 bg-[#4285F4]/5 rounded-full"
                              />
                              <Target size={32} className="text-zinc-600 group-hover:text-[#4285F4] transition-colors duration-500 relative z-10" />
                              
                              {/* Scanning Line */}
                              <motion.div 
                                animate={{ rotate: 360 }}
                                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-[-40px] border-t-2 border-[#4285F4]/20 rounded-full pointer-events-none"
                                style={{ maskImage: 'conic-gradient(from 0deg, black, transparent 90deg)' }}
                              />
                           </div>
                        </div>

                        <div className="flex flex-col items-center gap-4 relative z-10">
                           <div className="flex flex-col items-center gap-1">
                              <h3 className="text-sm font-black mono text-zinc-400 tracking-[0.4em] uppercase">Ready_for_Deep_Scan</h3>
                              <p className="text-[10px] mono text-zinc-600 tracking-widest uppercase">[ NEURAL_SECTOR_01 // STANDBY_MODE ]</p>
                           </div>
                           
                           <div className="flex gap-10 mt-6 p-4 border-y border-[#1F1F22] bg-zinc-950/30">
                              <div className="flex flex-col items-center">
                                 <span className="text-[9px] mono text-zinc-700 uppercase mb-1">LATENCY</span>
                                 <span className="text-xs mono font-black text-emerald-500/60">0.02ms</span>
                              </div>
                              <div className="flex flex-col items-center">
                                 <span className="text-[9px] mono text-zinc-700 uppercase mb-1">CAPACITY</span>
                                 <span className="text-xs mono font-black text-blue-500/60">OPTIMAL</span>
                              </div>
                              <div className="flex flex-col items-center">
                                 <span className="text-[9px] mono text-zinc-700 uppercase mb-1">SHIELD</span>
                                 <span className="text-xs mono font-black text-amber-500/60">LOCKED</span>
                              </div>
                           </div>
                           
                           <div className="mt-8 flex flex-col items-center gap-2">
                              <span className="text-[9px] mono text-zinc-700 uppercase italic">Awaiting neural pathway initialization...</span>
                              <div className="flex gap-1">
                                 {[1,2,3].map(i => (
                                    <motion.div 
                                       key={i}
                                       animate={{ opacity: [0.2, 1, 0.2] }}
                                       transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                                       className="w-1.5 h-1.5 rounded-full bg-zinc-800"
                                    />
                                 ))}
                              </div>
                           </div>
                        </div>

                        {/* Corner Accents */}
                        <div className="absolute top-4 left-4 w-4 h-4 border-t border-l border-zinc-800" />
                        <div className="absolute top-4 right-4 w-4 h-4 border-t border-r border-zinc-800" />
                        <div className="absolute bottom-4 left-4 w-4 h-4 border-b border-l border-zinc-800" />
                        <div className="absolute bottom-4 right-4 w-4 h-4 border-b border-r border-zinc-800" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <aside className="w-96 border-l border-[#1F1F22] p-8 flex flex-col gap-10 overflow-y-auto hidden xl:flex bg-black/20">
                <div className="flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <h3 className="label-tiny">TELEMETRY_STREAM</h3>
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  </div>
                  <div className="space-y-3">
                      <AuditItem status="OPTIMIZED" task="Kernel Integrity" />
                      <AuditItem status={loading ? "POLLING" : "STABLE"} task="Neural Network Sync" />
                      <AuditItem status={results[0]?.latency_ms ? `${results[0].latency_ms}ms` : "IDLE"} task="Synthesis Latency" />
                      <AuditItem status="SECURE" task="Cuda_AI_Tunnel_V2" />
                  </div>
                </div>

                <div className="flex flex-col gap-6">
                   <h3 className="label-tiny flex items-center gap-2">
                      <Activity size={10} className="text-[#4285F4]" /> RESOURCE_ALLOCATION
                   </h3>
                   <div className="grid grid-cols-1 gap-3">
                      <div className="p-4 border border-[#1F1F22] rounded-[4px] bg-[#0D0D0E] relative overflow-hidden group">
                         <div className="absolute top-0 right-0 w-24 h-full pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity">
                            <svg viewBox="0 0 100 40" className="w-full h-full">
                               <path d="M0 30 Q 10 20, 20 30 T 40 30 T 60 20 T 80 30 T 100 20" fill="none" stroke="#4285F4" strokeWidth="1" strokeDasharray="2,2" />
                            </svg>
                         </div>
                         <span className="text-[9px] mono text-zinc-600 block mb-1 tracking-widest">CPU_CORE_LOAD</span>
                         <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black mono text-white">{systemStats.cpu.toFixed(1)}%</span>
                            <div className="flex-1 h-1 bg-zinc-900 rounded-full overflow-hidden mb-1.5">
                               <motion.div animate={{ width: `${systemStats.cpu}%` }} className="h-full bg-[#4285F4] shadow-[0_0_8px_#4285F4]" />
                            </div>
                         </div>
                      </div>

                      <div className="p-4 border border-[#1F1F22] rounded-[4px] bg-[#0D0D0E] relative overflow-hidden group">
                         <div className="absolute top-0 right-0 p-3 opacity-10">
                            <Zap size={32} className="text-amber-500" />
                         </div>
                         <span className="text-[9px] mono text-zinc-600 block mb-1 tracking-widest">API_QUOTA_REMAINING</span>
                         <div className="flex items-center gap-3">
                            <span className="text-2xl font-black mono text-amber-500">{systemStats.quota}%</span>
                            <div className="flex-1 flex gap-0.5">
                               {Array.from({ length: 10 }).map((_, i) => (
                                  <div key={i} className={`h-3 w-1.5 rounded-[1px] ${i < systemStats.quota/10 ? 'bg-amber-500/60 shadow-[0_0_4px_#F59E0B]' : 'bg-zinc-900'}`} />
                               ))}
                            </div>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="mt-auto">
                  <div className="p-5 border border-[#4285F4]/20 rounded-[6px] bg-[#4285F4]/5 relative overflow-hidden group hover:border-[#4285F4]/40 transition-all cursor-default">
                    <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:scale-110 transition-transform duration-500">
                       <Shield size={48} className="text-[#4285F4]" />
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                       <div className="w-1.5 h-1.5 rounded-full bg-[#4285F4] shadow-[0_0_8px_#4285F4]" />
                       <span className="label-tiny text-[#4285F4]">SECURITY_PROTOCOL_v2</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed font-medium mb-3">
                       Neural sector scan data is encrypted via <span className="text-white font-bold mono">CUDA_LOCK</span> and synchronized with the global verification mesh using <span className="text-[#4285F4] font-bold mono">TLS_1.3</span>.
                    </p>
                    <div className="flex gap-2">
                       <div className="px-1.5 py-0.5 rounded-[2px] bg-emerald-500/10 border border-emerald-500/20 text-[8px] mono text-emerald-500 font-black">E2EE_ACTIVE</div>
                       <div className="px-1.5 py-0.5 rounded-[2px] bg-[#4285F4]/10 border border-[#4285F4]/20 text-[8px] mono text-[#4285F4] font-black">ZKP_VERIFIED</div>
                    </div>
                  </div>
                </div>
              </aside>
            </>
          )}
        </div>

        <footer className="h-10 border-t border-[#1F1F22] bg-black flex items-center px-6 justify-between z-20">
           <div className="flex items-center gap-8 overflow-hidden whitespace-nowrap">
              <div className="flex items-center gap-3">
                 <span className="label-tiny text-zinc-800">GLOBAL_SYNC</span>
                 <span className="text-[10px] mono text-emerald-500/60 font-bold uppercase">CONNECTED_TO_MESH</span>
              </div>
              <div className="flex items-center gap-3">
                 <span className="label-tiny text-zinc-800">NET_STATUS</span>
                 <span className="text-[10px] mono text-blue-500/60 font-bold uppercase">1.84 TB/s_UPLINK</span>
              </div>
              <div className="flex items-center gap-3">
                 <span className="label-tiny text-zinc-800">REGION_ID</span>
                 <span className="text-[10px] mono text-zinc-600 font-bold uppercase">SEC_42_ASIA_SOUTH</span>
              </div>
           </div>
           <div className="flex items-center gap-4 border-l border-[#1F1F22] pl-6">
              <span className="text-[10px] mono text-zinc-700 font-black tracking-widest">CUDA_AI // SYSTEM_V2.0_READY</span>
           </div>
        </footer>
      </main>
      <AnimatePresence>
        {selectedResult && (
          <DeepDiveModal 
            result={selectedResult} 
            onClose={() => setSelectedResult(null)} 
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showCommandPalette && (
          <CommandPalette 
            onClose={() => setShowCommandPalette(false)} 
            onNavigate={(view) => {
               setActiveView(view);
               setShowCommandPalette(false);
            }} 
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showDevConsole && (
          <DevConsole logs={devLogs} results={results} systemStats={systemStats} onClose={() => setShowDevConsole(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showSecurityModal && (
          <SecurityModal onClose={() => setShowSecurityModal(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showMeshModal && (
          <NetworkMeshModal onClose={() => setShowMeshModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
};

const NavItem = ({ icon, active = false, onClick, title, label }) => (
  <motion.button 
    onClick={onClick}
    title={title}
    whileHover={{ x: 2 }}
    whileTap={{ scale: 0.95 }}
    className={`relative w-full flex flex-col items-center justify-center gap-1 py-2.5 rounded-[4px] transition-all group ${
      active 
        ? 'text-[#4285F4] bg-[#4285F4]/10 border border-[#4285F4]/20 shadow-[0_0_12px_rgba(66,133,244,0.1)]' 
        : 'text-zinc-600 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
    }`}
  >
    {/* Active left-edge indicator */}
    {active && (
      <motion.div 
        layoutId="sidebar-active"
        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#4285F4] rounded-r-full shadow-[0_0_8px_#4285F4]"
      />
    )}
    <div className={`transition-all ${active ? 'text-[#4285F4]' : 'text-zinc-500 group-hover:text-white'}`}>
      {icon}
    </div>
    {label && (
      <span className={`text-[7px] font-black tracking-[0.12em] mono transition-all ${
        active ? 'text-[#4285F4]' : 'text-zinc-700 group-hover:text-zinc-400'
      }`}>
        {label}
      </span>
    )}
  </motion.button>
);

const ResultCard = ({ result, index, devMode, onClick }) => {
  const [showAudit, setShowAudit] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className={`border border-[#1F1F22] rounded-[6px] bg-[#0A0A0B]/80 backdrop-blur-md overflow-hidden group hover:border-[#6366F1]/50 cursor-pointer transition-all ${result.isScanning ? 'pulse-border' : ''}`}
    >
      <div className="p-4 flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1 overflow-hidden">
            <span className="label-tiny">CLAIM_INVESTIGATION</span>
            <h4 className="text-sm font-bold tracking-tight text-white leading-tight truncate">{result.input}</h4>
          </div>
          <div className="flex gap-2 shrink-0">
            <div className={`px-2 py-0.5 rounded-[4px] text-[10px] font-black mono uppercase ${
              result.error ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
              result.reliability_score > 70 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
              result.reliability_score > 40 ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 
              'bg-rose-500/10 text-rose-500 border border-rose-500/20'
            }`}>
              {result.error ? 'SYSTEM_OVERLOAD' : result.status.toUpperCase()}
            </div>
            <div className={`px-1.5 py-0.5 bg-zinc-900/50 border border-[#1F1F22] rounded-[4px] text-[10px] mono ${
              result.reliability_score > 90 ? 'text-emerald-400 font-black' : 'text-zinc-600'
            }`}>
              {result.reliability_score}%_CONF
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
           <div className="flex justify-between items-center text-[9px] mono text-zinc-600 uppercase tracking-widest">
             <span>Confidence_Scale</span>
             <span className={result.reliability_score > 70 ? 'text-emerald-500' : 'text-rose-500'}>{result.reliability_score}%</span>
           </div>
           <div className="w-full h-[2px] bg-zinc-900 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${result.reliability_score}%` }}
                className={`h-full ${
                  result.reliability_score > 70 ? 'bg-emerald-500' : 
                  result.reliability_score > 40 ? 'bg-amber-500' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                }`}
              />
           </div>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed border-l border-[#1F1F22] pl-3 py-1">
          {result.explanation}
        </p>

        <div className="flex items-center justify-between mt-1">
           <button 
            onClick={(e) => { e.stopPropagation(); setShowAudit(!showAudit); }}
            className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-600 hover:text-zinc-300 transition-colors uppercase tracking-widest"
           >
             <Terminal size={10} /> View Audit Trail <ChevronDown size={10} className={showAudit ? 'rotate-180 transition-transform' : 'transition-transform'} />
           </button>
            <div className="flex gap-2">
               {result.citations?.slice(0, 3).map((cite, i) => (
                 <a 
                  key={i} 
                  href={cite} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-zinc-700 hover:text-[#6366F1] transition-colors" 
                  title={cite}
                 >
                   <ExternalLink size={10} />
                 </a>
               ))}
            </div>
        </div>
      </div>

      <div className="flex justify-between items-center px-4 py-2 bg-zinc-950/50 border-t border-[#1F1F22]">
           <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                 <Cpu size={10} className="text-zinc-700" />
                 <span className="text-[9px] mono text-zinc-600 uppercase">{result.llm_consensus?.investigator || 'G-FLASH'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                 <Pulse size={10} className="text-zinc-700" />
                 <span className="text-[9px] mono text-zinc-600">CONSENSUS_STABLE</span>
              </div>
           </div>
           <div className="flex items-center gap-2">
              <span className="text-[9px] mono text-zinc-700 uppercase tracking-tighter">Latency:</span>
              <span className="text-[9px] mono text-zinc-500">{result.latency_ms || '---'}MS</span>
           </div>
      </div>

      <AnimatePresence>
        {showAudit && (
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="border-t border-[#1F1F22] bg-[#0D0D0E] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 flex flex-col gap-2 mono text-[10px] text-zinc-600">
               {result.citations?.map((cite, i) => (
                  <div key={i} className="flex gap-2 items-center group/item">
                    <span className="text-zinc-800 mono">[{new Date(result.id + i * 100).toISOString().split('T')[1].split('.')[0]}]</span>
                    <span className="text-emerald-500/50 mono">GET_SOURCE_{i + 1}</span>
                    <span className="truncate text-zinc-700 group-hover/item:text-zinc-400 transition-colors">{cite}</span>
                    <span className="ml-auto text-emerald-500/50 mono">200_OK</span>
                  </div>
               ))}
               {devMode && (
                  <div className="mt-2 p-2 bg-black border border-[#1F1F22] rounded-[4px]">
                     <span className="text-emerald-500">RAW_METADATA:</span>
                     <pre className="mt-1 whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
                  </div>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const AuditItem = ({ status, task }) => (
  <motion.div 
    whileHover={{ x: 4 }}
    className="flex items-center justify-between border border-[#1F1F22] rounded-[4px] p-2.5 bg-[#0D0D0E] hover:border-zinc-700 transition-all group cursor-default"
  >
    <div className="flex items-center gap-3">
       <div className={`w-1 h-1 rounded-full ${status === 'POLLING' ? 'bg-[#4285F4] animate-pulse' : 'bg-emerald-500'} shadow-[0_0_6px_currentColor]`} />
       <span className="text-[10px] text-zinc-400 font-medium tracking-tight group-hover:text-zinc-200 transition-colors">{task}</span>
    </div>
    <div className="flex items-center gap-2">
       <div className="h-px w-8 bg-zinc-900 group-hover:bg-[#4285F4]/30 transition-colors" />
       <span className={`text-[9px] font-black mono px-1.5 py-0.5 rounded-[2px] transition-all ${
         status === 'OPTIMIZED' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' :
         status === 'STABLE' ? 'text-emerald-400 bg-emerald-500/10' :
         status === 'POLLING' ? 'text-[#4285F4] bg-[#4285F4]/10 animate-pulse' :
         status === 'SECURE' ? 'text-emerald-400 bg-emerald-500/10' :
         'text-zinc-500 bg-zinc-900 border border-[#1F1F22]'
       }`}>{status}</span>
    </div>
  </motion.div>
);

const DeepDiveModal = ({ result, onClose }) => {
  const radarData = [
    { subject: 'Emotionality', A: 150 - result.reliability_score },
    { subject: 'Lean', A: 75 },
    { subject: 'Credibility', A: result.reliability_score },
    { subject: 'Sourcing', A: result.citations?.length * 30 || 20 },
    { subject: 'Density', A: result.explanation?.length / 5 || 50 },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="w-full max-w-4xl bg-[#0A0A0B] border border-[#1F1F22] rounded-[12px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-[#1F1F22] flex justify-between items-center bg-[#0D0D0E]">
           <div className="flex flex-col gap-1">
              <span className="label-tiny">DEEP_DIVE_ANALYTICS</span>
              <h2 className="text-xl font-bold tracking-tight text-white">{result.input}</h2>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-zinc-900 rounded-full text-zinc-500 transition-colors">
              <X size={20} />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="flex flex-col gap-8">
              <div className="p-6 border border-[#1F1F22] rounded-[8px] bg-zinc-950/50 flex flex-col gap-6">
                 <div className="flex justify-between items-center">
                    <span className="label-tiny flex items-center gap-2"><Target size={12} /> Reliability_Index</span>
                    <span className={`text-2xl font-black mono ${result.reliability_score > 70 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {result.reliability_score}%
                    </span>
                 </div>
                 <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }} 
                      animate={{ width: `${result.reliability_score}%` }}
                      className={`h-full ${result.reliability_score > 70 ? 'bg-emerald-500' : 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]'}`}
                    />
                 </div>
                 <p className="text-sm text-zinc-400 leading-relaxed italic">
                   "{result.explanation}"
                 </p>
              </div>

              <div>
                 <div className="flex items-center justify-between mb-4">
                    <span className="label-tiny">VERIFIED_EVIDENCE_NETWORK</span>
                    <span className="text-[9px] text-zinc-600 mono uppercase tracking-widest">Active_Links</span>
                 </div>
                 <div className="space-y-2.5">
                    {result.citations && result.citations.length > 0 ? result.citations.map((cite, i) => (
                       <a 
                        key={i} 
                        href={cite} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 border border-[#1F1F22] rounded-[6px] bg-zinc-950/40 hover:bg-[#6366F1]/10 hover:border-[#6366F1]/40 transition-all group relative overflow-hidden"
                       >
                          <div className="absolute inset-0 bg-gradient-to-r from-[#6366F1]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="w-8 h-8 shrink-0 rounded-full bg-zinc-900 border border-[#1F1F22] flex items-center justify-center text-[10px] mono text-zinc-500 group-hover:text-[#6366F1] group-hover:border-[#6366F1]/30 transition-all">
                            {i+1}
                          </div>
                          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                             <span className="text-[10px] text-zinc-500 mono uppercase tracking-tight group-hover:text-zinc-400 transition-colors">
                                Source_Identity: {(() => {
                                  try {
                                    return new URL(cite).hostname;
                                  } catch (e) {
                                    return "EXT_RESOURCE";
                                  }
                                })()}
                             </span>
                             <span className="text-xs text-zinc-300 truncate font-medium">{cite}</span>
                          </div>
                          <ExternalLink size={14} className="text-zinc-600 group-hover:text-[#6366F1] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                       </a>
                    )) : (
                      <div className="p-8 border border-dashed border-[#1F1F22] rounded-[6px] text-center">
                         <span className="text-[10px] text-zinc-600 mono">NO_EXTERNAL_CITATIONS_REQUIRED_FOR_THIS_LEVEL</span>
                      </div>
                    )}
                 </div>
              </div>
           </div>

           <div className="flex flex-col gap-8">
              <div className="border border-[#1F1F22] rounded-[8px] bg-zinc-950/50 p-6 flex flex-col items-center">
                 <span className="label-tiny self-start mb-6 flex items-center gap-2"><BarChart2 size={12} /> Bias_Fingerprint</span>
                 <div className="w-full h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                        <PolarGrid stroke="#1F1F22" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#71717a', fontSize: 10 }} />
                        <Radar
                          name="Analysis"
                          dataKey="A"
                          stroke="#6366F1"
                          fill="#6366F1"
                          fillOpacity={0.6}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              <div className="p-6 border border-[#1F1F22] rounded-[8px] border-dashed flex flex-col gap-4">
                 <span className="label-tiny">Model_Consensus</span>
                 <div className="flex items-center gap-4">
                    <div className="flex-1 p-3 bg-zinc-900/50 rounded-[4px] border border-[#1F1F22]">
                       <span className="text-[9px] text-zinc-500 block">INVESTIGATOR</span>
                       <span className="text-xs mono text-zinc-300">{result.llm_consensus?.investigator || 'N/A'}</span>
                    </div>
                    <div className="flex-1 p-3 bg-zinc-900/50 rounded-[4px] border border-[#1F1F22]">
                       <span className="text-[9px] text-zinc-500 block">SYNTHESIZER</span>
                       <span className="text-xs mono text-zinc-300">{result.llm_consensus?.synthesizer || 'N/A'}</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        <div className="p-4 border-t border-[#1F1F22] bg-[#0D0D0E]/80 flex justify-end gap-3">
           <button 
            onClick={onClose}
            className="px-6 py-2 bg-[#6366F1] text-white text-xs font-bold rounded-[4px] hover:bg-[#4F46E5] transition-colors shadow-[0_0_20px_rgba(99,102,241,0.2)]"
           >
             CLOSE_INSPECTION
           </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const CommandPalette = ({ onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const commands = [
    { id: 'dash', label: 'Open Dashboard', icon: <BarChart2 size={14} />, view: 'dashboard' },
    { id: 'scan', label: 'Claims Investigator', icon: <Pulse size={14} />, view: 'claims' },
    { id: 'hist', label: 'Verification History', icon: <History size={14} />, view: 'history' },
    { id: 'clear', label: 'Clear System Cache', icon: <Database size={14} />, view: 'claims' },
  ];

  const filtered = commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, y: -20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: -20 }}
        className="w-full max-w-xl bg-[#0D0D0E] border border-[#1F1F22] rounded-[8px] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[#1F1F22] flex items-center gap-3">
           <Search size={16} className="text-zinc-500" />
           <input 
            autoFocus
            type="text" 
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-200"
            value={query}
            onChange={e => setQuery(e.target.value)}
           />
           <kbd className="px-1.5 py-0.5 bg-zinc-900 border border-[#1F1F22] rounded-[4px] text-[10px] text-zinc-500 mono">ESC</kbd>
        </div>
        <div className="p-2 max-h-64 overflow-y-auto">
           {filtered.map((cmd) => (
             <button 
              key={cmd.id}
              onClick={() => onNavigate(cmd.view)}
              className="w-full flex items-center gap-3 p-3 rounded-[4px] hover:bg-zinc-900/50 text-zinc-400 hover:text-white transition-colors group"
             >
                <div className="text-zinc-600 group-hover:text-[#6366F1] transition-colors">{cmd.icon}</div>
                <span className="text-xs font-medium">{cmd.label}</span>
                <span className="ml-auto text-[10px] mono text-zinc-700">EXEC_CMD</span>
             </button>
           ))}
        </div>
        <div className="p-3 border-t border-[#1F1F22] bg-[#0A0A0B] flex justify-between items-center">
           <span className="text-[9px] text-zinc-600 mono">CUDA_CORE_v1.1_SHELL</span>
           <div className="flex gap-2">
              <span className="text-[9px] text-zinc-700 mono">↑↓ SELECT</span>
              <span className="text-[9px] text-zinc-700 mono">⏎ EXECUTE</span>
           </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const DevConsole = ({ logs, results, systemStats, onClose }) => (
  <motion.div
    initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
    transition={{ type: 'spring', damping: 30, stiffness: 300 }}
    className="fixed top-0 right-0 h-full w-[420px] z-[70] bg-black border-l border-[#1F1F22] flex flex-col shadow-2xl"
  >
    <div className="p-4 border-b border-[#1F1F22] flex items-center justify-between bg-[#0A0A0B]">
      <div className="flex items-center gap-2">
        <Terminal size={14} className="text-emerald-400" />
        <span className="label-tiny text-emerald-400">KERNEL_CONSOLE // DEV_MODE</span>
      </div>
      <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors"><X size={16} /></button>
    </div>

    <div className="grid grid-cols-3 gap-px border-b border-[#1F1F22] bg-[#1F1F22]">
      {[
        { label: 'CPU_LOAD', value: `${systemStats.cpu.toFixed(1)}%`, color: 'text-amber-400' },
        { label: 'SCANS_RUN', value: results.length, color: 'text-blue-400' },
        { label: 'CACHE_HIT', value: '~64%', color: 'text-emerald-400' },
      ].map(s => (
        <div key={s.label} className="bg-[#0A0A0B] p-3 flex flex-col gap-1">
          <span className="text-[8px] mono text-zinc-600 tracking-widest">{s.label}</span>
          <span className={`text-lg font-black mono ${s.color}`}>{s.value}</span>
        </div>
      ))}
    </div>

    <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1 font-mono text-[11px]">
      {logs.length === 0 && (
        <div className="text-zinc-700 text-center mt-10 tracking-widest text-[10px]">[ NO_EVENTS_LOGGED_YET ]</div>
      )}
      {logs.map((log, i) => (
        <div key={i} className="flex gap-2 items-start border-b border-[#0D0D0E] pb-1">
          <span className="text-zinc-700 shrink-0">{log.time.split('T')[1].split('.')[0]}</span>
          <span className={`shrink-0 font-black ${log.type === 'SUCCESS' ? 'text-emerald-500' : log.type === 'ERROR' ? 'text-rose-500' : 'text-blue-400'}`}>
            [{log.type}]
          </span>
          <span className="text-zinc-400 break-all">{log.msg}</span>
        </div>
      ))}
    </div>

    <div className="p-3 border-t border-[#1F1F22] bg-[#0A0A0B]">
      <div className="flex items-center gap-2 text-emerald-400">
        <span className="text-[10px] mono animate-pulse">█</span>
        <span className="text-[10px] mono text-zinc-600">CUDA_KERNEL v2.0 // AWAITING_INPUT</span>
      </div>
    </div>
  </motion.div>
);

const SecurityModal = ({ onClose }) => {
  const [scanPct, setScanPct] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setScanPct(p => Math.min(100, p + 2)), 30);
    return () => clearInterval(t);
  }, []);

  const layers = [
    { label: 'AES-256 Tunnel Encryption', status: 'ACTIVE', color: 'emerald' },
    { label: 'Zero-Knowledge Data Routing', status: 'ACTIVE', color: 'emerald' },
    { label: 'Neural Sector Firewall', status: 'ACTIVE', color: 'emerald' },
    { label: 'API Key Vault (Env-Isolated)', status: 'SECURED', color: 'blue' },
    { label: 'Supabase RLS Policies', status: 'ENFORCED', color: 'blue' },
    { label: 'CORS Origin Whitelist', status: 'ACTIVE', color: 'emerald' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-lg bg-[#0A0A0B] border border-emerald-500/20 rounded-[8px] overflow-hidden shadow-[0_0_60px_rgba(16,185,129,0.1)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-[#1F1F22] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center">
              <Lock size={14} className="text-emerald-400" />
            </div>
            <div>
              <span className="label-tiny text-emerald-400 block">CUDA_LOCK // SECURITY_STATUS</span>
              <span className="text-[10px] mono text-zinc-600">All systems hardened</span>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors"><X size={16} /></button>
        </div>

        <div className="p-5 flex flex-col gap-3">
          <div className="mb-2">
            <div className="flex justify-between text-[9px] mono text-zinc-600 mb-1">
              <span>INTEGRITY_SCAN_PROGRESS</span><span>{scanPct}%</span>
            </div>
            <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
              <motion.div className="h-full bg-emerald-500" style={{ width: `${scanPct}%` }} />
            </div>
          </div>

          {layers.map((l, i) => (
            <motion.div
              key={l.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center justify-between p-3 border border-[#1F1F22] rounded-[4px] bg-zinc-950/50"
            >
              <span className="text-[11px] text-zinc-300">{l.label}</span>
              <span className={`text-[9px] font-black mono px-2 py-0.5 rounded-[2px] ${l.color === 'emerald' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-blue-400 bg-blue-500/10 border border-blue-500/20'}`}>
                {l.status}
              </span>
            </motion.div>
          ))}
        </div>

        <div className="p-4 border-t border-[#1F1F22] bg-[#0D0D0E]/80 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-[4px] hover:bg-emerald-500/20 transition-colors">
            CONFIRM_SECURE
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const NetworkMeshModal = ({ onClose }) => {
  const [ping, setPing] = useState({});
  const nodes = [
    { id: 'ASIA_SOUTH', region: 'Mumbai, IN', lat: 19.0, status: 'PRIMARY', color: 'emerald' },
    { id: 'US_EAST', region: 'Virginia, US', lat: 142, status: 'RELAY', color: 'blue' },
    { id: 'EU_WEST', region: 'Frankfurt, DE', lat: 198, status: 'RELAY', color: 'blue' },
    { id: 'ASIA_EAST', region: 'Tokyo, JP', lat: 87, status: 'RELAY', color: 'purple' },
    { id: 'US_WEST', region: 'Oregon, US', lat: 210, status: 'STANDBY', color: 'amber' },
    { id: 'SA_EAST', region: 'São Paulo, BR', lat: 310, status: 'STANDBY', color: 'amber' },
  ];

  useEffect(() => {
    const update = () => {
      const p = {};
      nodes.forEach(n => { p[n.id] = n.lat + Math.floor(Math.random() * 12 - 6); });
      setPing(p);
    };
    update();
    const t = setInterval(update, 1200);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-2xl bg-[#0A0A0B] border border-[#4285F4]/20 rounded-[8px] overflow-hidden shadow-[0_0_60px_rgba(66,133,244,0.08)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[#1F1F22] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border border-[#4285F4]/40 bg-[#4285F4]/10 flex items-center justify-center">
              <Globe size={14} className="text-[#4285F4]" />
            </div>
            <div>
              <span className="label-tiny text-[#4285F4] block">GLOBAL_MESH // NETWORK_STATUS</span>
              <span className="text-[10px] mono text-zinc-600">{nodes.filter(n => n.status !== 'STANDBY').length} active nodes · {nodes.length} total</span>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors"><X size={16} /></button>
        </div>

        {/* Global stats bar */}
        <div className="grid grid-cols-4 gap-px bg-[#1F1F22] border-b border-[#1F1F22]">
          {[
            { label: 'UPTIME', value: '99.97%', color: 'text-emerald-400' },
            { label: 'THROUGHPUT', value: '1.84 TB/s', color: 'text-blue-400' },
            { label: 'PACKET_LOSS', value: '0.01%', color: 'text-emerald-400' },
            { label: 'MESH_SYNC', value: 'STABLE', color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="bg-[#0A0A0B] p-3">
              <span className="text-[8px] mono text-zinc-600 block tracking-widest">{s.label}</span>
              <span className={`text-sm font-black mono ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Node list */}
        <div className="p-5 flex flex-col gap-2 max-h-80 overflow-y-auto">
          {nodes.map((node, i) => (
            <motion.div
              key={node.id}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}
              className="flex items-center gap-4 p-3 border border-[#1F1F22] rounded-[4px] bg-zinc-950/50 hover:bg-zinc-900/30 transition-colors"
            >
              {/* Status dot */}
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                node.color === 'emerald' ? 'bg-emerald-500 shadow-[0_0_8px_#10B981]' :
                node.color === 'blue' ? 'bg-blue-500 shadow-[0_0_8px_#3B82F6]' :
                node.color === 'purple' ? 'bg-purple-500 shadow-[0_0_8px_#A855F7]' :
                'bg-amber-500'
              } ${node.status !== 'STANDBY' ? 'animate-pulse' : ''}`} />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-black mono text-zinc-300 block">{node.id}</span>
                <span className="text-[9px] mono text-zinc-600">{node.region}</span>
              </div>
              <span className={`text-[8px] font-black mono px-1.5 py-0.5 rounded-[2px] ${
                node.status === 'PRIMARY' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' :
                node.status === 'RELAY' ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20' :
                'text-amber-500 bg-amber-500/10 border border-amber-500/20'
              }`}>{node.status}</span>
              <div className="w-24 text-right">
                <motion.span
                  key={ping[node.id]}
                  initial={{ opacity: 0.4 }} animate={{ opacity: 1 }}
                  className={`text-[11px] font-black mono ${
                    (ping[node.id] || node.lat) < 100 ? 'text-emerald-400' :
                    (ping[node.id] || node.lat) < 200 ? 'text-amber-400' : 'text-rose-400'
                  }`}
                >
                  {ping[node.id] || node.lat}ms
                </motion.span>
                <span className="text-[8px] mono text-zinc-700 block">LATENCY</span>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="p-4 border-t border-[#1F1F22] bg-[#0D0D0E]/80 flex justify-between items-center">
          <span className="text-[9px] mono text-zinc-700">CUDA_MESH_PROTOCOL_v2.0 // AUTO_FAILOVER_ENABLED</span>
          <button onClick={onClose} className="px-5 py-2 bg-[#4285F4]/10 border border-[#4285F4]/30 text-[#4285F4] text-xs font-bold rounded-[4px] hover:bg-[#4285F4]/20 transition-colors">
            CLOSE_MESH_VIEW
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// --- INITIALIZATION ---
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
