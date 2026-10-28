import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Trophy,
  Flame,
  Target,
  Activity,
  Plus,
  Play,
  Square,
  RefreshCw,
  Shield,
  Calendar,
  TrendingUp,
  Zap,
  Edit3,
  Check,
  X,
  Eye,
  Monitor,
  ArrowRightLeft,
  UserPlus,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

const API_BASE = 'http://127.0.0.1:8000';
const WS_URL = 'ws://127.0.0.1:8000/ws/live';

function getOverallTier(ovr) {
  const val = Number(ovr) || 60;
  if (val >= 85) {
    return {
      tierName: 'Esmeralda',
      frameBg: 'bg-gradient-to-b from-emerald-300 via-emerald-500 to-teal-800',
      innerBg: 'bg-gradient-to-b from-emerald-400 via-emerald-500 to-teal-700 text-slate-950',
      tagBg: 'bg-slate-950/85 text-emerald-300',
      accentColor: '#10b981',
    };
  }
  if (val >= 75) {
    return {
      tierName: 'Ouro',
      frameBg: 'bg-gradient-to-b from-amber-200 via-amber-400 to-yellow-700',
      innerBg: 'bg-gradient-to-b from-amber-300 via-amber-400 to-yellow-600 text-slate-950',
      tagBg: 'bg-slate-950/85 text-amber-300',
      accentColor: '#fbbf24',
    };
  }
  if (val >= 65) {
    return {
      tierName: 'Prata',
      frameBg: 'bg-gradient-to-b from-slate-100 via-slate-400 to-slate-600',
      innerBg: 'bg-gradient-to-b from-slate-200 via-slate-300 to-slate-500 text-slate-950',
      tagBg: 'bg-slate-950/85 text-slate-200',
      accentColor: '#cbd5e1',
    };
  }
  return {
    tierName: 'Bronze',
    frameBg: 'bg-gradient-to-b from-amber-600 via-orange-800 to-stone-900',
    innerBg: 'bg-gradient-to-b from-amber-700 via-orange-800 to-stone-900 text-amber-100',
    tagBg: 'bg-slate-950/80 text-amber-300',
    accentColor: '#d97706',
  };
}

function getEventMeta(event) {
  switch (event.event_type) {
    case 'GOAL':
      return {
        title: 'Gol marcado',
        detail: `Gols na temporada: ${event.old_value} → ${event.new_value}`,
        delta: `+${Number(event.new_value) - Number(event.old_value) || 1} gol`,
        dotColor: 'bg-emerald-400 ring-emerald-500/30',
        textColor: 'text-emerald-400',
        pillClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        bannerClass: 'bg-[#0D131F] border-emerald-500 text-white shadow-emerald-500/20',
        icon: Flame,
      };
    case 'ASSIST':
      return {
        title: 'Assistência registrada',
        detail: `Assistências na temporada: ${event.old_value} → ${event.new_value}`,
        delta: `+${Number(event.new_value) - Number(event.old_value) || 1} assist.`,
        dotColor: 'bg-cyan-400 ring-cyan-400/30',
        textColor: 'text-cyan-400',
        pillClass: 'bg-cyan-400/15 text-cyan-300 border-cyan-400/30',
        bannerClass: 'bg-[#0D131F] border-cyan-400 text-white shadow-cyan-400/20',
        icon: Target,
      };
    case 'OVR_UP':
      return {
        title: 'Evolução de Overall',
        detail: `Overall atualizado de ${event.old_value} para ${event.new_value}`,
        delta: `OVR ${event.new_value}`,
        dotColor: 'bg-amber-400 ring-amber-400/30',
        textColor: 'text-amber-400',
        pillClass: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
        bannerClass: 'bg-[#0D131F] border-amber-400 text-white shadow-amber-400/20',
        icon: TrendingUp,
      };
    case 'TRANSFER':
      return {
        title: 'Transferência de clube',
        detail: `${event.old_value} → ${event.new_value}`,
        delta: event.new_value,
        dotColor: 'bg-purple-400 ring-purple-400/30',
        textColor: 'text-purple-300',
        pillClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
        bannerClass: 'bg-[#0D131F] border-purple-400 text-white shadow-purple-500/20',
        icon: ArrowRightLeft,
      };
    default:
      return {
        title: event.event_type,
        detail: `${event.old_value || ''} → ${event.new_value || ''}`,
        delta: event.new_value,
        dotColor: 'bg-slate-400 ring-slate-500/30',
        textColor: 'text-slate-300',
        pillClass: 'bg-slate-800 text-slate-300 border-slate-700',
        bannerClass: 'bg-[#0D131F] border-slate-600 text-white',
        icon: Zap,
      };
  }
}

export default function App() {
  const [careers, setCareers] = useState([]);
  const [selectedCareerId, setSelectedCareerId] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [watcher, setWatcher] = useState({
    is_running: false,
    active_career_id: null,
    target_window_title: null,
    target_player_name: null,
    last_known_state: null,
    last_raw_ocr: null,
  });
  const [wsConnected, setWsConnected] = useState(false);
  const [liveToast, setLiveToast] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showNewCareerModal, setShowNewCareerModal] = useState(false);
  const [showNewSeasonModal, setShowNewSeasonModal] = useState(false);
  const [openWindows, setOpenWindows] = useState([]);
  const [loadingWindows, setLoadingWindows] = useState(false);

  const [newCareerForm, setNewCareerForm] = useState({
    player_name: '',
    position: 'ATA',
    nationality: 'Brasil',
    target_window_title: '',
    club_name: '',
    age: 17,
    overall: 62,
  });

  const [newSeasonForm, setNewSeasonForm] = useState({
    club_name: '',
    increment_age: true,
  });

  const [isEditingCurrent, setIsEditingCurrent] = useState(false);
  const [editSeasonForm, setEditSeasonForm] = useState({
    club_name: '',
    age: 17,
    overall: 60,
    matches: 0,
    goals: 0,
    assists: 0,
    trophies_count: 0,
  });

  const selectedCareerIdRef = useRef(selectedCareerId);
  useEffect(() => {
    selectedCareerIdRef.current = selectedCareerId;
  }, [selectedCareerId]);

  const triggerToast = useCallback((toastObj) => {
    setLiveToast(toastObj);
    setTimeout(() => {
      setLiveToast((prev) => (prev?.id === toastObj.id ? null : prev));
    }, 4200);
  }, []);

  const fetchWindows = useCallback(async () => {
    setLoadingWindows(true);
    try {
      const res = await fetch(`${API_BASE}/windows`);
      const data = await res.json();
      const list = data.windows || [];
      setOpenWindows(list);
      setNewCareerForm((prev) => {
        if (prev.target_window_title) return prev;
        const mumu = list.find(
          (w) =>
            w.toLowerCase().includes('mumu') ||
            w.toLowerCase().includes('android') ||
            w.toLowerCase().includes('ldplayer') ||
            w.toLowerCase().includes('bluestacks')
        );
        return { ...prev, target_window_title: mumu || list[0] || 'MuMu Player' };
      });
    } catch (err) {
      console.error('Erro ao listar janelas:', err);
    } finally {
      setLoadingWindows(false);
    }
  }, []);

  const fetchDashboard = useCallback(async (careerId) => {
    if (!careerId) return;
    try {
      const res = await fetch(`${API_BASE}/careers/${careerId}/dashboard`);
      if (!res.ok) return;
      const data = await res.json();
      setDashboard(data);
      if (data.watcher) {
        setWatcher(data.watcher);
      }
      if (data.current_season) {
        setEditSeasonForm({
          club_name: data.current_season.club_name,
          age: data.current_season.age,
          overall: data.current_season.overall,
          matches: data.current_season.matches,
          goals: data.current_season.goals,
          assists: data.current_season.assists,
          trophies_count: data.current_season.trophies_count,
        });
      }
    } catch (err) {
      console.error('Erro ao buscar dashboard:', err);
    }
  }, []);

  const fetchCareers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/careers`);
      const data = await res.json();
      setCareers(data || []);
      if (data && data.length > 0) {
        const targetId = selectedCareerIdRef.current || data[0].id;
        setSelectedCareerId(targetId);
        await fetchDashboard(targetId);
      } else {
        setShowNewCareerModal(true);
        fetchWindows();
      }
    } catch (err) {
      console.error('Erro ao carregar carreiras:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchDashboard, fetchWindows]);

  const fetchWatcherStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/watcher/status`);
      if (res.ok) {
        const data = await res.json();
        setWatcher(data);
      }
    } catch (err) {
      // ignora silenciosamente se o servidor estiver reiniciando
    }
  }, []);

  useEffect(() => {
    fetchCareers();
    fetchWatcherStatus();
    const statusInterval = setInterval(fetchWatcherStatus, 3000);
    return () => clearInterval(statusInterval);
  }, [fetchCareers, fetchWatcherStatus]);

  useEffect(() => {
    if (selectedCareerId) {
      fetchDashboard(selectedCareerId);
    }
  }, [selectedCareerId, fetchDashboard]);

  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;
    let isUnmounted = false;

    function connectWs() {
      if (isUnmounted) return;
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'CONNECTED' && payload.watcher) {
            setWatcher(payload.watcher);
          } else if (payload.type === 'WATCHER_STATUS' && payload.data) {
            setWatcher(payload.data);
          } else if (payload.type === 'STATS_UPDATED') {
            if (payload.career_id === selectedCareerIdRef.current) {
              fetchDashboard(payload.career_id);
              fetchCareers();
              if (payload.events && payload.events.length > 0) {
                const latestEv = payload.events[payload.events.length - 1];
                const meta = getEventMeta(latestEv);
                triggerToast({
                  id: Date.now(),
                  ...meta,
                });
              }
            }
          } else if (payload.type === 'NEW_SEASON_CREATED') {
            if (payload.career_id === selectedCareerIdRef.current) {
              fetchDashboard(payload.career_id);
              fetchCareers();
              triggerToast({
                id: Date.now(),
                title: `Temporada #${payload.season?.season_number} iniciada`,
                detail: `${payload.season?.club_name} • Overall ${payload.season?.overall}`,
                bannerClass: 'bg-[#0D131F] border-emerald-400 text-white shadow-emerald-500/20',
                textColor: 'text-emerald-400',
                icon: Calendar,
              });
            }
          }
        } catch (e) {
          console.error('Erro ao processar mensagem WS:', e);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!isUnmounted) {
          reconnectTimeout = setTimeout(connectWs, 2500);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connectWs();

    return () => {
      isUnmounted = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [fetchCareers, fetchDashboard, triggerToast]);

  const handleToggleWatcher = async () => {
    if (!selectedCareerId) return;
    const isThisCareerWatching =
      watcher.is_running && watcher.active_career_id === selectedCareerId;
    try {
      if (isThisCareerWatching) {
        const res = await fetch(`${API_BASE}/watcher/stop`, { method: 'POST' });
        const data = await res.json();
        setWatcher(data);
      } else {
        const res = await fetch(`${API_BASE}/watcher/start/${selectedCareerId}`, {
          method: 'POST',
        });
        const data = await res.json();
        setWatcher(data);
      }
    } catch (err) {
      console.error('Erro ao alternar Watcher:', err);
    }
  };

  const handleCreateCareer = async (e) => {
    e.preventDefault();
    if (!newCareerForm.player_name.trim() || !newCareerForm.target_window_title.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/careers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: newCareerForm.player_name.trim(),
          position: newCareerForm.position,
          nationality: newCareerForm.nationality.trim() || 'Brasil',
          target_window_title: newCareerForm.target_window_title.trim(),
          club_name: newCareerForm.club_name.trim() || 'Clube Inicial',
          age: Number(newCareerForm.age) || 17,
          overall: Number(newCareerForm.overall) || 60,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setShowNewCareerModal(false);
        setNewCareerForm({
          player_name: '',
          position: 'ATA',
          nationality: 'Brasil',
          target_window_title: newCareerForm.target_window_title,
          club_name: '',
          age: 17,
          overall: 62,
        });
        await fetchCareers();
        setSelectedCareerId(created.career.id);
      }
    } catch (err) {
      console.error('Erro ao criar carreira:', err);
    }
  };

  const handleStartNewSeason = async (e) => {
    e.preventDefault();
    if (!selectedCareerId) return;
    try {
      const res = await fetch(`${API_BASE}/careers/${selectedCareerId}/new-season`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          club_name: newSeasonForm.club_name.trim() || null,
          increment_age: newSeasonForm.increment_age,
        }),
      });
      if (res.ok) {
        setShowNewSeasonModal(false);
        await fetchDashboard(selectedCareerId);
        await fetchCareers();
      }
    } catch (err) {
      console.error('Erro ao iniciar temporada:', err);
    }
  };

  const handleSaveCurrentSeason = async () => {
    if (!selectedCareerId) return;
    try {
      const res = await fetch(`${API_BASE}/careers/${selectedCareerId}/season/current`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          club_name: editSeasonForm.club_name.trim(),
          age: Number(editSeasonForm.age),
          overall: Number(editSeasonForm.overall),
          matches: Number(editSeasonForm.matches),
          goals: Number(editSeasonForm.goals),
          assists: Number(editSeasonForm.assists),
          trophies_count: Number(editSeasonForm.trophies_count),
        }),
      });
      if (res.ok) {
        setIsEditingCurrent(false);
        await fetchDashboard(selectedCareerId);
        await fetchCareers();
      }
    } catch (err) {
      console.error('Erro ao salvar alterações da temporada:', err);
    }
  };

  const handleQuickAddTrophy = async (delta = 1) => {
    if (!selectedCareerId || !dashboard?.current_season) return;
    const nextTrophies = Math.max(0, (dashboard.current_season.trophies_count || 0) + delta);
    try {
      await fetch(`${API_BASE}/careers/${selectedCareerId}/season/current`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trophies_count: nextTrophies }),
      });
      await fetchDashboard(selectedCareerId);
      await fetchCareers();
      if (delta > 0) {
        triggerToast({
          id: Date.now(),
          title: 'Troféu adicionado à galeria',
          detail: `Total na temporada atual: ${nextTrophies}`,
          bannerClass: 'bg-[#0D131F] border-amber-400 text-white shadow-amber-400/20',
          textColor: 'text-amber-400',
          icon: Trophy,
        });
      }
    } catch (err) {
      console.error('Erro ao atualizar troféus:', err);
    }
  };

  const career = dashboard?.career;
  const currentSeason = dashboard?.current_season;
  const seasons = dashboard?.seasons || [];
  const totals = dashboard?.totals || {
    seasons_count: 0,
    matches: 0,
    goals: 0,
    assists: 0,
    goal_contributions: 0,
    trophies_count: 0,
    peak_overall: 0,
    current_overall: 0,
  };
  const recentEvents = dashboard?.recent_events || [];

  const isWatchingCurrent =
    watcher.is_running && watcher.active_career_id === selectedCareerId;

  const overallTier = getOverallTier(currentSeason?.overall || 60);
  const gaPerMatch =
    totals.matches > 0
      ? ((totals.goals + totals.assists) / totals.matches).toFixed(2)
      : '0.00';

  const chartData = seasons.map((s) => ({
    name: `T${s.season_number} (${s.age}a)`,
    club: s.club_name,
    Overall: s.overall,
    Gols: s.goals,
    Assistências: s.assists,
    Jogos: s.matches,
  }));

  return (
    <div className="min-h-screen flex flex-col text-slate-100">
      {/* BANNER DE EVENTO EM TEMPO REAL (BROADCAST LOWER-THIRD / SCOREBUG ALERT) */}
      {liveToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 transition-all duration-300">
          <div
            className={`flex items-center gap-4 px-5 py-3 rounded-lg border-l-4 border bg-[#0D131F]/95 backdrop-blur-md shadow-2xl ${liveToast.bannerClass}`}
          >
            <div className="p-2 rounded-md bg-slate-900 border border-slate-800">
              {liveToast.icon && (
                <liveToast.icon className={`w-5 h-5 ${liveToast.textColor || 'text-emerald-400'}`} />
              )}
            </div>
            <div className="pr-4">
              <div className="font-display text-xl font-bold tracking-wide leading-none">
                {liveToast.title}
              </div>
              <div className="text-xs text-slate-300 mt-1">{liveToast.detail}</div>
            </div>
            <button
              onClick={() => setLiveToast(null)}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 1. BARRA DE CONTROLE DE TRANSMISSÃO (BROADCAST SCOREBUG HEADER) */}
      <header className="sticky top-0 z-40 h-14 bg-[#06090F]/95 backdrop-blur-md border-b border-[#1E2D45] px-6">
        <div className="max-w-[1600px] h-full mx-auto flex items-center justify-between gap-4">
          {/* Identidade do Sistema */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-emerald-500 flex items-center justify-center text-slate-950 font-display font-extrabold text-lg tracking-tighter">
              WSC
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className="font-display text-xl font-extrabold tracking-tight text-white">
                Career Telemetry
              </span>
              <span className="hidden sm:inline-block text-xs text-slate-400 border-l border-[#1E2D45] pl-2.5">
                Scouting & OCR em segundo plano
              </span>
            </div>
          </div>

          {/* Seletor de Carreira + Ação */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center bg-[#0D131F] border border-[#1E2D45] rounded-md px-3 py-1.5">
              <span className="text-xs text-slate-400 mr-2">Jogador:</span>
              <select
                value={selectedCareerId || ''}
                onChange={(e) => setSelectedCareerId(Number(e.target.value))}
                className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer pr-2"
              >
                {careers.length === 0 && <option value="">Nenhuma carreira registrada</option>}
                {careers.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#0D131F] text-white">
                    {c.player_name} ({c.position}) —{' '}
                    {c.current_season
                      ? `${c.current_season.club_name} • OVR ${c.current_season.overall}`
                      : 'Sem temporada'}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                fetchWindows();
                setShowNewCareerModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0D131F] hover:bg-[#162032] border border-[#1E2D45] text-xs font-semibold text-slate-200 transition"
            >
              <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
              Nova carreira
            </button>
          </div>

          {/* Status do Olho Biônico + WebSocket */}
          <div className="flex items-center gap-2.5">
            {isWatchingCurrent ? (
              <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-semibold text-emerald-300">
                  Olho Biônico ativo
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-[#0D131F] border border-[#1E2D45]">
                <span className="h-2 w-2 rounded-full bg-slate-500"></span>
                <span className="text-xs text-slate-400">Leitura em espera</span>
              </div>
            )}

            <button
              onClick={handleToggleWatcher}
              disabled={!selectedCareerId}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                isWatchingCurrent
                  ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold'
              } disabled:opacity-40`}
            >
              {isWatchingCurrent ? (
                <>
                  <Square className="w-3 h-3 fill-current" />
                  Pausar leitura
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  Ativar Olho Biônico
                </>
              )}
            </button>

            <div
              title={wsConnected ? 'Canal ao vivo conectado' : 'Reconectando ao servidor local'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-mono text-[11px] ${
                wsConnected
                  ? 'bg-[#0D131F] border-[#1E2D45] text-emerald-400'
                  : 'bg-rose-950/40 border-rose-800/50 text-rose-400'
              }`}
            >
              <Activity className="w-3 h-3" />
              {wsConnected ? 'WS' : 'OFF'}
            </div>
          </div>
        </div>
      </header>

      {/* ÁREA DE TRABALHO PRINCIPAL */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="flex items-center gap-3 text-slate-400 text-sm">
              <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
              Sincronizando banco de dados da carreira...
            </div>
          </div>
        ) : !career ? (
          <div className="bg-[#0D131F] border border-[#1E2D45] rounded-lg p-12 max-w-lg mx-auto my-12">
            <Trophy className="w-10 h-10 text-amber-400 mb-4" />
            <h2 className="font-display text-3xl font-bold text-white mb-2">
              Nenhuma carreira cadastrada
            </h2>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              Cadastre seu jogador e escolha a janela do emulador para que o leitor óptico
              registre partidas, gols, assistências e evolução de Overall automaticamente.
            </p>
            <button
              onClick={() => {
                fetchWindows();
                setShowNewCareerModal(true);
              }}
              className="px-5 py-2.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
            >
              Criar primeira carreira
            </button>
          </div>
        ) : (
          <>
            {/* 2. DOSSIÊ DO JOGADOR (HERO ASSIMÉTRICO + LEDGER DE TOTAIS) */}
            <section className="bg-[#0D131F] border border-[#1E2D45] rounded-lg overflow-hidden">
              <div className="grid grid-cols-1 xl:grid-cols-12">
                {/* Identidade + Escudo EA FC (7 colunas) */}
                <div className="xl:col-span-7 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  {/* O Elemento Memorável: Escudo Geométrico de Overall */}
                  <div className={`p-[2px] w-28 h-36 shrink-0 player-crest ${overallTier.frameBg}`}>
                    <div
                      className={`w-full h-full player-crest flex flex-col items-center justify-between pt-3 pb-5 px-2 ${overallTier.innerBg}`}
                    >
                      <span className="font-mono text-[11px] font-semibold tracking-tight opacity-85">
                        {career.position || 'ATA'}
                      </span>
                      <span className="font-display text-6xl font-extrabold italic leading-none tracking-tighter tabular-nums">
                        {currentSeason?.overall ?? '--'}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-sm ${overallTier.tagBg}`}
                      >
                        {overallTier.tierName}
                      </span>
                    </div>
                  </div>

                  {/* Dados de Identificação e Contexto */}
                  <div className="space-y-2.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2.5 py-0.5 rounded bg-[#162032] border border-[#1E2D45] text-slate-200 font-medium">
                        {career.nationality || 'Brasil'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/30 text-amber-300 font-medium tabular-nums">
                        Pico na carreira: OVR {totals.peak_overall}
                      </span>
                      <span className="px-2.5 py-0.5 rounded bg-[#06090F] border border-[#1E2D45] text-slate-400 font-mono text-[11px] flex items-center gap-1.5">
                        <Monitor className="w-3 h-3 text-cyan-400" />
                        {career.target_window_title}
                      </span>
                    </div>

                    <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-none">
                      {career.player_name}
                    </h1>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-300 pt-0.5">
                      <span className="flex items-center gap-1.5 font-semibold text-white">
                        <Shield className="w-4 h-4 text-emerald-400" />
                        {currentSeason?.club_name || 'Sem clube'}
                      </span>
                      <span className="text-slate-400 tabular-nums">
                        {currentSeason?.age ?? '--'} anos
                      </span>
                      <span className="text-emerald-400 font-semibold tabular-nums">
                        Temporada #{currentSeason?.season_number ?? 1}
                      </span>
                    </div>

                    {isWatchingCurrent && watcher.last_raw_ocr && (
                      <div className="pt-1">
                        <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#06090F] border border-[#1E2D45] font-mono text-[11px] text-slate-400">
                          <Eye className="w-3 h-3 text-emerald-400" />
                          Leitura óptica:{' '}
                          <strong className="text-emerald-300 font-normal">
                            {(watcher.last_raw_ocr.raw_row_tokens || []).join(' · ')}
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ledger Arquitetônico de Totais da Carreira (5 colunas com divisórias de 1px) */}
                <div className="xl:col-span-5 border-t xl:border-t-0 xl:border-l border-[#1E2D45] bg-[#090E17] grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[#1E2D45]">
                  <div className="p-4 flex flex-col justify-between">
                    <span className="text-xs text-slate-400">Jogos</span>
                    <div className="font-display text-4xl font-extrabold text-white tabular-nums my-1">
                      {totals.matches}
                    </div>
                    <span className="text-[11px] text-slate-500 tabular-nums">
                      {totals.seasons_count} {totals.seasons_count === 1 ? 'época' : 'épocas'}
                    </span>
                  </div>

                  <div className="p-4 flex flex-col justify-between">
                    <span className="text-xs text-emerald-400 font-medium">Gols</span>
                    <div className="font-display text-4xl font-extrabold text-emerald-400 tabular-nums my-1">
                      {totals.goals}
                    </div>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      Atual: {currentSeason?.goals ?? 0}
                    </span>
                  </div>

                  <div className="p-4 flex flex-col justify-between">
                    <span className="text-xs text-cyan-400 font-medium">Assistências</span>
                    <div className="font-display text-4xl font-extrabold text-cyan-400 tabular-nums my-1">
                      {totals.assists}
                    </div>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      Atual: {currentSeason?.assists ?? 0}
                    </span>
                  </div>

                  <div className="p-4 flex flex-col justify-between">
                    <span className="text-xs text-slate-300">Média G+A</span>
                    <div className="font-display text-4xl font-extrabold text-white tabular-nums my-1">
                      {gaPerMatch}
                    </div>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {totals.goal_contributions} part.
                    </span>
                  </div>

                  <div className="p-4 flex flex-col justify-between col-span-2 sm:col-span-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs text-amber-400 font-medium">Troféus</span>
                      <button
                        onClick={() => handleQuickAddTrophy(1)}
                        title="Somar 1 troféu na temporada atual"
                        className="px-1.5 py-0.5 rounded bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-amber-300 font-mono text-[10px] font-semibold transition"
                      >
                        +1
                      </button>
                    </div>
                    <div className="font-display text-4xl font-extrabold text-amber-400 tabular-nums my-1">
                      {totals.trophies_count}
                    </div>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      Atual: {currentSeason?.trophies_count ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. PAINEL DE TELEMETRIA + TABELA DE TEMPORADAS + LINHA DO TEMPO AO VIVO */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Coluna Esquerda (8 colunas): Telemetria Unificada e Histórico */}
              <div className="lg:col-span-8 space-y-6">
                {/* Painel Duplo de Gráficos Separados por Linha Estrutural */}
                <section className="bg-[#0D131F] border border-[#1E2D45] rounded-lg overflow-hidden">
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#1E2D45]">
                    {/* Gráfico 1: Curva de Overall */}
                    <div className="p-5">
                      <div className="flex items-baseline justify-between mb-4">
                        <div>
                          <h2 className="font-display text-xl font-bold text-white tracking-wide">
                            Progressão de Overall
                          </h2>
                          <p className="text-xs text-slate-400">
                            Evolução da classificação geral por temporada e idade
                          </p>
                        </div>
                        <span className="font-mono text-xs text-emerald-400 tabular-nums">
                          OVR {currentSeason?.overall ?? '--'}
                        </span>
                      </div>

                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="ovrFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="2 4" stroke="#162032" vertical={false} />
                            <XAxis
                              dataKey="name"
                              stroke="#64748b"
                              fontSize={11}
                              tickLine={false}
                              axisLine={{ stroke: '#1E2D45' }}
                            />
                            <YAxis
                              domain={['dataMin - 3', 'dataMax + 3']}
                              stroke="#64748b"
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#06090F',
                                borderColor: '#1E2D45',
                                borderRadius: '6px',
                                fontSize: '12px',
                                color: '#f8fafc',
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="Overall"
                              stroke="#10b981"
                              strokeWidth={2.5}
                              fillOpacity={1}
                              fill="url(#ovrFill)"
                              dot={{ r: 3.5, fill: '#10b981', strokeWidth: 2, stroke: '#06090F' }}
                              activeDot={{ r: 5, fill: '#fbbf24' }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Gráfico 2: Produção Ofensiva */}
                    <div className="p-5">
                      <div className="flex items-baseline justify-between mb-4">
                        <div>
                          <h2 className="font-display text-xl font-bold text-white tracking-wide">
                            Produção ofensiva por época
                          </h2>
                          <p className="text-xs text-slate-400">
                            Comparativo entre gols marcados e assistências
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-[11px]">
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            <span className="w-2 h-2 rounded-xs bg-emerald-500"></span>
                            Gols
                          </span>
                          <span className="flex items-center gap-1.5 text-cyan-400">
                            <span className="w-2 h-2 rounded-xs bg-cyan-400"></span>
                            Assist.
                          </span>
                        </div>
                      </div>

                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="2 4" stroke="#162032" vertical={false} />
                            <XAxis
                              dataKey="name"
                              stroke="#64748b"
                              fontSize={11}
                              tickLine={false}
                              axisLine={{ stroke: '#1E2D45' }}
                            />
                            <YAxis
                              stroke="#64748b"
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#06090F',
                                borderColor: '#1E2D45',
                                borderRadius: '6px',
                                fontSize: '12px',
                                color: '#f8fafc',
                              }}
                            />
                            <Bar
                              dataKey="Gols"
                              fill="#10b981"
                              radius={[3, 3, 0, 0]}
                              maxBarSize={28}
                            />
                            <Bar
                              dataKey="Assistências"
                              fill="#22d3ee"
                              radius={[3, 3, 0, 0]}
                              maxBarSize={28}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Registro de Temporadas (Season Ledger) */}
                <section className="bg-[#0D131F] border border-[#1E2D45] rounded-lg overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#1E2D45] flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="font-display text-xl font-bold text-white tracking-wide">
                        Histórico por temporada
                      </h2>
                      <p className="text-xs text-slate-400">
                        Desempenho detalhado por clube e ajustes manuais rápidos
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsEditingCurrent((prev) => !prev)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#162032] hover:bg-[#1E2D45] border border-[#1E2D45] text-xs font-semibold text-slate-200 transition"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                        {isEditingCurrent ? 'Fechar edição' : 'Ajustar temporada atual'}
                      </button>

                      <button
                        onClick={() => {
                          setNewSeasonForm({
                            club_name: currentSeason?.club_name || '',
                            increment_age: true,
                          });
                          setShowNewSeasonModal(true);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        Iniciar nova temporada
                      </button>
                    </div>
                  </div>

                  {/* Gaveta de Edição Rápida Inline */}
                  {isEditingCurrent && currentSeason && (
                    <div className="p-4 bg-[#06090F] border-b border-[#1E2D45] space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-amber-400">
                          Ajustando Temporada #{currentSeason.season_number}
                        </span>
                        <span className="text-slate-400">
                          Mudar o nome do clube registra automaticamente uma transferência
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-7 gap-2.5">
                        <div className="col-span-2">
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Clube atual
                          </label>
                          <input
                            type="text"
                            value={editSeasonForm.club_name}
                            onChange={(e) =>
                              setEditSeasonForm({ ...editSeasonForm, club_name: e.target.value })
                            }
                            className="w-full bg-[#0D131F] border border-[#1E2D45] rounded px-2.5 py-1.5 text-xs font-semibold text-white focus:border-emerald-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Idade</label>
                          <input
                            type="number"
                            min={15}
                            max={45}
                            value={editSeasonForm.age}
                            onChange={(e) =>
                              setEditSeasonForm({ ...editSeasonForm, age: e.target.value })
                            }
                            className="w-full bg-[#0D131F] border border-[#1E2D45] rounded px-2.5 py-1.5 text-xs font-semibold text-white tabular-nums"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Overall</label>
                          <input
                            type="number"
                            min={30}
                            max={99}
                            value={editSeasonForm.overall}
                            onChange={(e) =>
                              setEditSeasonForm({ ...editSeasonForm, overall: e.target.value })
                            }
                            className="w-full bg-[#0D131F] border border-[#1E2D45] rounded px-2.5 py-1.5 text-xs font-semibold text-amber-400 tabular-nums"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Jogos</label>
                          <input
                            type="number"
                            min={0}
                            value={editSeasonForm.matches}
                            onChange={(e) =>
                              setEditSeasonForm({ ...editSeasonForm, matches: e.target.value })
                            }
                            className="w-full bg-[#0D131F] border border-[#1E2D45] rounded px-2.5 py-1.5 text-xs font-semibold text-white tabular-nums"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Gols</label>
                          <input
                            type="number"
                            min={0}
                            value={editSeasonForm.goals}
                            onChange={(e) =>
                              setEditSeasonForm({ ...editSeasonForm, goals: e.target.value })
                            }
                            className="w-full bg-[#0D131F] border border-[#1E2D45] rounded px-2.5 py-1.5 text-xs font-semibold text-emerald-400 tabular-nums"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Assist. / Títulos
                          </label>
                          <div className="flex gap-1.5">
                            <input
                              type="number"
                              min={0}
                              title="Assistências"
                              value={editSeasonForm.assists}
                              onChange={(e) =>
                                setEditSeasonForm({ ...editSeasonForm, assists: e.target.value })
                              }
                              className="w-1/2 bg-[#0D131F] border border-[#1E2D45] rounded px-2 py-1.5 text-xs font-semibold text-cyan-400 tabular-nums"
                            />
                            <input
                              type="number"
                              min={0}
                              title="Troféus"
                              value={editSeasonForm.trophies_count}
                              onChange={(e) =>
                                setEditSeasonForm({
                                  ...editSeasonForm,
                                  trophies_count: e.target.value,
                                })
                              }
                              className="w-1/2 bg-[#0D131F] border border-[#1E2D45] rounded px-2 py-1.5 text-xs font-semibold text-amber-400 tabular-nums"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          onClick={() => setIsEditingCurrent(false)}
                          className="px-3 py-1.5 rounded bg-[#162032] text-xs text-slate-300"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleSaveCurrentSeason}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Salvar alterações
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tabela de Temporadas */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#1E2D45] bg-[#090E17] text-xs font-semibold text-slate-400">
                          <th className="py-2.5 px-4">Época</th>
                          <th className="py-2.5 px-4">Clube</th>
                          <th className="py-2.5 px-3 text-right">Idade</th>
                          <th className="py-2.5 px-3 text-right">Overall</th>
                          <th className="py-2.5 px-3 text-right">Jogos</th>
                          <th className="py-2.5 px-3 text-right text-emerald-400">Gols</th>
                          <th className="py-2.5 px-3 text-right text-cyan-400">Assist.</th>
                          <th className="py-2.5 px-3 text-right">G+A</th>
                          <th className="py-2.5 px-4 text-right text-amber-400">Troféus</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E2D45]/60 text-sm tabular-nums">
                        {seasons.map((s) => {
                          const isCurrent = s.id === currentSeason?.id;
                          return (
                            <tr
                              key={s.id}
                              className={`transition ${
                                isCurrent ? 'bg-emerald-500/[0.06]' : 'hover:bg-[#162032]/50'
                              }`}
                            >
                              <td className="py-3 px-4 font-mono text-xs">
                                <span
                                  className={
                                    isCurrent ? 'text-emerald-400 font-semibold' : 'text-slate-400'
                                  }
                                >
                                  #{s.season_number}
                                  {isCurrent && ' • atual'}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-semibold text-white">{s.club_name}</td>
                              <td className="py-3 px-3 text-right text-slate-300">{s.age}</td>
                              <td className="py-3 px-3 text-right">
                                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/30 text-amber-300">
                                  {s.overall}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right text-slate-200">{s.matches}</td>
                              <td className="py-3 px-3 text-right font-bold text-emerald-400">
                                {s.goals}
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-cyan-400">
                                {s.assists}
                              </td>
                              <td className="py-3 px-3 text-right font-semibold text-white">
                                {s.goals + s.assists}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-amber-400">
                                {s.trophies_count > 0 ? `${s.trophies_count} 🏆` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              {/* Coluna Direita (4 colunas): Linha do Tempo Contínua de Evolução */}
              <div className="lg:col-span-4">
                <section className="bg-[#0D131F] border border-[#1E2D45] rounded-lg h-full flex flex-col">
                  <div className="px-5 py-4 border-b border-[#1E2D45] flex items-baseline justify-between">
                    <div>
                      <h2 className="font-display text-xl font-bold text-white tracking-wide">
                        Linha do tempo ao vivo
                      </h2>
                      <p className="text-xs text-slate-400">
                        Eventos capturados automaticamente na temporada
                      </p>
                    </div>
                    <span className="font-mono text-xs text-slate-400 tabular-nums">
                      {recentEvents.length} reg.
                    </span>
                  </div>

                  {recentEvents.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                      <Eye className="w-8 h-8 text-slate-600 mb-3" />
                      <p className="text-sm font-semibold text-slate-300">
                        Nenhum evento registrado ainda
                      </p>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                        Mantenha o Olho Biônico ativo enquanto joga. Ao abrir a tabela de
                        estatísticas pós-jogo ou a tela de treinamento, os gols, assistências e
                        subidas de Overall aparecerão aqui.
                      </p>
                    </div>
                  ) : (
                    <div className="p-5 overflow-y-auto max-h-[680px]">
                      <div className="relative pl-5 border-l border-[#1E2D45] space-y-5">
                        {recentEvents.map((ev) => {
                          const meta = getEventMeta(ev);
                          const timeStr = ev.timestamp
                            ? new Date(ev.timestamp).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })
                            : '';
                          return (
                            <div key={ev.id} className="relative group">
                              {/* Marcador na espinha da linha do tempo */}
                              <span
                                className={`absolute -left-[25px] top-1 w-2.5 h-2.5 rounded-full ring-4 ${meta.dotColor}`}
                              ></span>

                              <div className="flex items-baseline justify-between gap-2">
                                <span className={`text-xs font-bold ${meta.textColor}`}>
                                  {meta.title}
                                </span>
                                <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                                  {timeStr}
                                </span>
                              </div>

                              <div className="mt-1 flex items-center justify-between gap-2">
                                <p className="text-xs text-slate-300">{meta.detail}</p>
                                <span
                                  className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 tabular-nums ${meta.pillClass}`}
                                >
                                  {meta.delta}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </div>
          </>
        )}
      </main>

      {/* MODAL: NOVA CARREIRA */}
      {showNewCareerModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0D131F] border border-[#1E2D45] rounded-lg max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-display text-2xl font-bold text-white">
                  Cadastrar nova carreira
                </h3>
                <p className="text-xs text-slate-400">
                  Informe os dados iniciais do jogador e vincule a janela do emulador
                </p>
              </div>
              <button
                onClick={() => setShowNewCareerModal(false)}
                className="p-1.5 rounded hover:bg-[#162032] text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCareer} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nome do jogador (como exibido na escalação do WSC)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Maicon Ramos"
                  value={newCareerForm.player_name}
                  onChange={(e) =>
                    setNewCareerForm({ ...newCareerForm, player_name: e.target.value })
                  }
                  className="w-full bg-[#06090F] border border-[#1E2D45] rounded-md px-3.5 py-2 text-sm font-semibold text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Posição</label>
                  <select
                    value={newCareerForm.position}
                    onChange={(e) =>
                      setNewCareerForm({ ...newCareerForm, position: e.target.value })
                    }
                    className="w-full bg-[#06090F] border border-[#1E2D45] rounded-md px-3 py-2 text-sm font-semibold text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="ATA">ATA (Atacante)</option>
                    <option value="PON">PON (Ponta)</option>
                    <option value="MEI">MEI (Meia)</option>
                    <option value="VOL">VOL (Volante)</option>
                    <option value="LAT">LAT (Lateral)</option>
                    <option value="ZAG">ZAG (Zagueiro)</option>
                    <option value="GOL">GOL (Goleiro)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nacionalidade
                  </label>
                  <input
                    type="text"
                    value={newCareerForm.nationality}
                    onChange={(e) =>
                      setNewCareerForm({ ...newCareerForm, nationality: e.target.value })
                    }
                    className="w-full bg-[#06090F] border border-[#1E2D45] rounded-md px-3 py-2 text-sm font-semibold text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Clube inicial
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Ortri"
                    value={newCareerForm.club_name}
                    onChange={(e) =>
                      setNewCareerForm({ ...newCareerForm, club_name: e.target.value })
                    }
                    className="w-full bg-[#06090F] border border-[#1E2D45] rounded-md px-3 py-2 text-sm font-semibold text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Idade inicial (15 a 45)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={45}
                    value={newCareerForm.age}
                    onChange={(e) => setNewCareerForm({ ...newCareerForm, age: e.target.value })}
                    className="w-full bg-[#06090F] border border-[#1E2D45] rounded-md px-3 py-2 text-sm font-semibold text-white tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Overall inicial (30 a 99)
                  </label>
                  <input
                    type="number"
                    min={30}
                    max={99}
                    value={newCareerForm.overall}
                    onChange={(e) =>
                      setNewCareerForm({ ...newCareerForm, overall: e.target.value })
                    }
                    className="w-full bg-[#06090F] border border-[#1E2D45] rounded-md px-3 py-2 text-sm font-semibold text-amber-400 tabular-nums"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-300">
                    Janela do emulador
                  </label>
                  <button
                    type="button"
                    onClick={fetchWindows}
                    className="text-xs font-semibold text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingWindows ? 'animate-spin' : ''}`} />
                    Atualizar lista
                  </button>
                </div>

                {openWindows.length > 0 ? (
                  <select
                    value={newCareerForm.target_window_title}
                    onChange={(e) =>
                      setNewCareerForm({
                        ...newCareerForm,
                        target_window_title: e.target.value,
                      })
                    }
                    className="w-full bg-[#06090F] border border-[#1E2D45] rounded-md px-3 py-2 text-sm font-semibold text-white focus:border-emerald-500 focus:outline-none"
                  >
                    {openWindows.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Ex: Android Device ou MuMu Player"
                    value={newCareerForm.target_window_title}
                    onChange={(e) =>
                      setNewCareerForm({
                        ...newCareerForm,
                        target_window_title: e.target.value,
                      })
                    }
                    className="w-full bg-[#06090F] border border-[#1E2D45] rounded-md px-3 py-2 text-sm font-semibold text-white"
                  />
                )}
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCareerModal(false)}
                  className="px-4 py-2 rounded-md bg-[#162032] text-xs font-semibold text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold"
                >
                  Salvar e iniciar carreira
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVA TEMPORADA */}
      {showNewSeasonModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0D131F] border border-[#1E2D45] rounded-lg max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-2xl font-bold text-white">
                  Iniciar temporada #{(currentSeason?.season_number || 1) + 1}
                </h3>
                <p className="text-xs text-slate-400">
                  Encerra a temporada #{currentSeason?.season_number} e zera os contadores da nova época
                </p>
              </div>
              <button
                onClick={() => setShowNewSeasonModal(false)}
                className="p-1.5 rounded hover:bg-[#162032] text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStartNewSeason} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Clube da nova temporada (altere caso tenha se transferido)
                </label>
                <input
                  type="text"
                  value={newSeasonForm.club_name}
                  onChange={(e) =>
                    setNewSeasonForm({ ...newSeasonForm, club_name: e.target.value })
                  }
                  className="w-full bg-[#06090F] border border-[#1E2D45] rounded-md px-3.5 py-2 text-sm font-semibold text-white"
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newSeasonForm.increment_age}
                  onChange={(e) =>
                    setNewSeasonForm({ ...newSeasonForm, increment_age: e.target.checked })
                  }
                  className="w-4 h-4 accent-emerald-500 rounded"
                />
                <span className="text-xs text-slate-200">
                  Avançar 1 ano na idade do jogador automaticamente
                </span>
              </label>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewSeasonModal(false)}
                  className="px-4 py-2 rounded-md bg-[#162032] text-xs font-semibold text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold"
                >
                  Confirmar nova temporada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
