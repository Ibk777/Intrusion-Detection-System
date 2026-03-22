import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, 
  Activity, 
  AlertTriangle, 
  Lock, 
  Terminal, 
  Globe, 
  Cpu, 
  Search,
  RefreshCw,
  Eye,
  Zap,
  ChevronRight,
  Database,
  LogIn,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { format } from 'date-fns';
import { analyzeTraffic, TrafficLog, handleFirestoreError, OperationType } from './services/idsService';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, login, logout } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

// --- Mock Data & Constants ---
const STATS_DATA = [
  { time: '10:00', requests: 45, threats: 2 },
  { time: '11:00', requests: 52, threats: 1 },
  { time: '12:00', requests: 88, threats: 5 },
  { time: '13:00', requests: 65, threats: 3 },
  { time: '14:00', requests: 120, threats: 12 },
  { time: '15:00', requests: 95, threats: 4 },
  { time: '16:00', requests: 110, threats: 8 },
];

export default function App() {
  const [logs, setLogs] = useState<TrafficLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<TrafficLog | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [systemStatus, setSystemStatus] = useState<'active' | 'warning' | 'alert'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Real-time Logs
  useEffect(() => {
    if (!isAuthReady || !user) {
      setLogs([]);
      return;
    }

    const path = 'logs';
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(50));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TrafficLog[];
      setLogs(newLogs);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, path);
      setError("Permission denied. Only authorized admins can view logs.");
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  // Derived stats
  const stats = useMemo(() => {
    const critical = logs.filter(l => l.threatLevel === 'critical').length;
    const high = logs.filter(l => l.threatLevel === 'high').length;
    const total = logs.length;
    return { critical, high, total };
  }, [logs]);

  useEffect(() => {
    if (stats.critical > 0) setSystemStatus('alert');
    else if (stats.high > 0) setSystemStatus('warning');
    else setSystemStatus('active');
  }, [stats]);

  const handleSimulateAttack = async (type: 'sql' | 'xss' | 'brute') => {
    if (!user) {
      setError("Please sign in to simulate attacks and save logs.");
      return;
    }
    
    setIsAnalyzing(true);
    setError(null);
    let payload: any = {};
    let path = '/api/data';
    
    if (type === 'sql') {
      payload = { query: "SELECT * FROM users WHERE id = 1; DROP TABLE users;" };
      path = '/api/search';
    } else if (type === 'xss') {
      payload = { comment: "<script>alert('hacked')</script>" };
      path = '/api/comments';
    } else {
      payload = { username: 'admin', password: 'password123' };
      path = '/api/login';
    }

    const newLog: Partial<TrafficLog> = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      method: 'POST',
      path,
      ip: '127.0.0.1',
      userAgent: navigator.userAgent,
      payload
    };

    try {
      const analysis = await analyzeTraffic(newLog);
      const fullLog: TrafficLog = { ...newLog as TrafficLog, ...analysis };
      setSelectedLog(fullLog);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const filteredLogs = logs.filter(log => 
    log.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.ip.includes(searchQuery) ||
    (log.threatType && log.threatType.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Shield className="w-12 h-12 text-emerald-500 animate-pulse" />
          <p className="text-zinc-500 animate-pulse">Initializing Sentinel IDS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#E4E4E7] font-sans selection:bg-emerald-500/30">
      {/* --- Sidebar --- */}
      <aside className="fixed left-0 top-0 h-full w-64 border-r border-white/5 bg-[#0D0D0E] p-6 hidden lg:block">
        <div className="flex items-center gap-3 mb-10">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Shield className="w-6 h-6 text-emerald-500" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">SENTINEL <span className="text-emerald-500">IDS</span></h1>
        </div>

        <nav className="space-y-1">
          <NavItem icon={<Activity className="w-4 h-4" />} label="Dashboard" active />
          <NavItem icon={<Terminal className="w-4 h-4" />} label="Traffic Logs" />
          <NavItem icon={<AlertTriangle className="w-4 h-4" />} label="Threat Intelligence" />
          <NavItem icon={<Globe className="w-4 h-4" />} label="Network Map" />
          <NavItem icon={<Database className="w-4 h-4" />} label="Database" />
          <NavItem icon={<Lock className="w-4 h-4" />} label="Security Rules" />
        </nav>

        <div className="absolute bottom-8 left-6 right-6">
          {user ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-medium truncate">{user.email}</p>
                  <p className="text-[10px] text-zinc-500">Administrator</p>
                </div>
              </div>
              <button 
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs text-zinc-500 hover:text-red-500 transition-colors"
              >
                <LogOut className="w-3 h-3" />
                Sign Out
              </button>
            </div>
          ) : (
            <button 
              onClick={login}
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-all"
            >
              <LogIn className="w-4 h-4" />
              Sign In with Google
            </button>
          )}
        </div>
      </aside>

      {/* --- Main Content --- */}
      <main className="lg:ml-64 p-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h2 className="text-2xl font-semibold mb-1">Security Overview</h2>
            <p className="text-zinc-500 text-sm">Real-time intrusion detection and traffic analysis.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Search logs, IPs..."
                className="bg-[#151516] border border-white/5 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="p-2 bg-[#151516] border border-white/5 rounded-lg hover:bg-white/5 transition-colors">
              <RefreshCw className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </header>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-sm"
          >
            <AlertTriangle className="w-5 h-5" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-xs hover:underline">Dismiss</button>
          </motion.div>
        )}

        {!user && (
          <div className="mb-10 p-8 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 text-center">
            <Lock className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Restricted Access</h3>
            <p className="text-zinc-400 text-sm max-w-md mx-auto mb-6">
              Sentinel IDS logs are protected by enterprise-grade security rules. Please sign in with an authorized administrator account to view real-time traffic data.
            </p>
            <button 
              onClick={login}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-all inline-flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Authorize Access
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatCard 
            label="Total Requests" 
            value={stats.total.toString()} 
            icon={<Globe className="w-5 h-5 text-blue-500" />}
            trend="+12% from last hour"
          />
          <StatCard 
            label="Threats Detected" 
            value={(stats.high + stats.critical).toString()} 
            icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
            trend="High Priority"
            color="amber"
          />
          <StatCard 
            label="Critical Alerts" 
            value={stats.critical.toString()} 
            icon={<Zap className="w-5 h-5 text-red-500" />}
            trend="Action Required"
            color="red"
          />
          <StatCard 
            label="System Health" 
            value="98.2%" 
            icon={<Cpu className="w-5 h-5 text-emerald-500" />}
            trend="Stable"
            color="emerald"
          />
        </div>

        {/* Charts & Simulation */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          <div className="lg:col-span-2 bg-[#0D0D0E] border border-white/5 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                Traffic Activity
              </h3>
              <select className="bg-transparent text-xs text-zinc-500 border-none focus:ring-0 cursor-pointer">
                <option>Last 24 Hours</option>
                <option>Last 7 Days</option>
              </select>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={STATS_DATA}>
                  <defs>
                    <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#71717a', fontSize: 12}}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#71717a', fontSize: 12}}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#151516', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}
                    itemStyle={{ color: '#E4E4E7' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="requests" 
                    stroke="#10b981" 
                    fillOpacity={1} 
                    fill="url(#colorRequests)" 
                    strokeWidth={2}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="threats" 
                    stroke="#ef4444" 
                    fill="transparent" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#0D0D0E] border border-white/5 rounded-2xl p-6">
            <h3 className="font-medium mb-6 flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-500" />
              Attack Simulator
            </h3>
            <p className="text-sm text-zinc-500 mb-6">
              Test the AI detection engine by simulating common web attacks.
            </p>
            <div className="space-y-3">
              <SimulateButton 
                label="SQL Injection" 
                onClick={() => handleSimulateAttack('sql')} 
                disabled={isAnalyzing}
              />
              <SimulateButton 
                label="XSS Attack" 
                onClick={() => handleSimulateAttack('xss')} 
                disabled={isAnalyzing}
              />
              <SimulateButton 
                label="Brute Force" 
                onClick={() => handleSimulateAttack('brute')} 
                disabled={isAnalyzing}
              />
            </div>
            {isAnalyzing && (
              <div className="mt-6 flex items-center gap-3 text-xs text-emerald-500 animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Gemini AI analyzing payload...
              </div>
            )}
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-[#0D0D0E] border border-white/5 rounded-2xl overflow-hidden">
          <div className="p-6 border-bottom border-white/5 flex items-center justify-between">
            <h3 className="font-medium">Recent Traffic Logs</h3>
            <button className="text-xs text-emerald-500 hover:underline">Export CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-zinc-500 border-y border-white/5 bg-white/[0.02]">
                  <th className="px-6 py-4 font-medium">Timestamp</th>
                  <th className="px-6 py-4 font-medium">Method</th>
                  <th className="px-6 py-4 font-medium">Path</th>
                  <th className="px-6 py-4 font-medium">Source IP</th>
                  <th className="px-6 py-4 font-medium">Threat Level</th>
                  <th className="px-6 py-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <AnimatePresence mode="popLayout">
                  {filteredLogs.length > 0 ? filteredLogs.map((log) => (
                    <motion.tr 
                      key={log.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="px-6 py-4 text-zinc-400 font-mono text-xs">
                        {format(new Date(log.timestamp), 'HH:mm:ss')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                          log.method === 'GET' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'
                        }`}>
                          {log.method}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-zinc-300">
                        {log.path}
                      </td>
                      <td className="px-6 py-4 text-zinc-400">
                        {log.ip}
                      </td>
                      <td className="px-6 py-4">
                        <ThreatBadge level={log.threatLevel} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 group-hover:text-emerald-500 transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </motion.tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 italic">
                        {user ? "No logs found matching your search." : "Sign in to view traffic logs."}
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* --- Log Detail Modal --- */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setSelectedLog(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0D0D0E] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    selectedLog.threatLevel === 'critical' ? 'bg-red-500/10' : 
                    selectedLog.threatLevel === 'high' ? 'bg-amber-500/10' : 'bg-emerald-500/10'
                  }`}>
                    <Shield className={`w-5 h-5 ${
                      selectedLog.threatLevel === 'critical' ? 'text-red-500' : 
                      selectedLog.threatLevel === 'high' ? 'text-amber-500' : 'text-emerald-500'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold">Event Analysis</h3>
                    <p className="text-xs text-zinc-500">ID: {selectedLog.id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedLog(null)}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5 rotate-90" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Source IP</p>
                    <p className="font-mono text-sm">{selectedLog.ip}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Threat Type</p>
                    <p className="text-sm font-medium text-emerald-500">{selectedLog.threatType || 'None Detected'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">AI Analysis</p>
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-sm leading-relaxed text-zinc-300">
                    {selectedLog.analysis}
                  </div>
                </div>

                {selectedLog.payload && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Request Payload</p>
                    <pre className="p-4 rounded-xl bg-[#050505] border border-white/5 text-xs font-mono text-emerald-400 overflow-x-auto">
                      {JSON.stringify(selectedLog.payload, null, 2)}
                    </pre>
                  </div>
                )}

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">User Agent</p>
                  <p className="text-xs text-zinc-400 font-mono break-all">{selectedLog.userAgent}</p>
                </div>
              </div>

              <div className="p-6 bg-white/[0.02] border-t border-white/5 flex justify-end gap-3">
                <button 
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                >
                  Dismiss
                </button>
                <button className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors">
                  Block IP Address
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Subcomponents ---

function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <button className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all ${
      active 
        ? 'bg-emerald-500/10 text-emerald-500 font-medium' 
        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]'
    }`}>
      {icon}
      {label}
    </button>
  );
}

function StatCard({ label, value, icon, trend, color = 'zinc' }: { 
  label: string, 
  value: string, 
  icon: React.ReactNode, 
  trend: string,
  color?: 'zinc' | 'amber' | 'red' | 'emerald'
}) {
  const colorClasses = {
    zinc: 'text-zinc-500',
    amber: 'text-amber-500',
    red: 'text-red-500',
    emerald: 'text-emerald-500'
  };

  return (
    <div className="bg-[#0D0D0E] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors group">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-white/[0.03] rounded-lg group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <span className={`text-[10px] font-medium uppercase tracking-wider ${colorClasses[color]}`}>
          {trend}
        </span>
      </div>
      <p className="text-zinc-500 text-xs mb-1">{label}</p>
      <h4 className="text-2xl font-bold tracking-tight">{value}</h4>
    </div>
  );
}

function ThreatBadge({ level }: { level: TrafficLog['threatLevel'] }) {
  const styles = {
    low: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    medium: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    high: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    critical: 'bg-red-500/10 text-red-500 border-red-500/20'
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${styles[level]}`}>
      {level.toUpperCase()}
    </span>
  );
}

function SimulateButton({ label, onClick, disabled }: { label: string, onClick: () => void, disabled: boolean }) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-between px-4 py-3 bg-[#151516] border border-white/5 rounded-xl text-sm text-zinc-400 hover:text-white hover:border-emerald-500/30 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {label}
      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
    </button>
  );
}
