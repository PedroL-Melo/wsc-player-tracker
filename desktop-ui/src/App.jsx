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
  Award,
  Edit3,
  Check,
  X,
  Eye,
  Monitor,
  Sparkles,
  ArrowRightLeft,
  ChevronRight,
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
  Legend,
} from 'recharts';

const API_BASE = 'http://127.0.0.1:8000';
const WS_URL = 'ws://127.0.0.1:8000/ws/live';

function getOverallTier(ovr) {
  const val = Number(ovr) || 60;
  if (val >= 85) {
    return {
      label: 'ELITE ESMERALDA',
      cardClass:
        'bg-gradient-to-br from-emerald-300 via-emerald-500 to-teal-700 border-emerald-200 text-slate-950 shadow-xl shadow-emerald-500/30 ring-2 ring-emerald-400/50',
      badgeClass: 'bg-slate-950/80 text-emerald-300 border-emerald-400/40',
    };
  }
  if (val >= 75) {
    return {
      label: 'OURO',
      cardClass:
        'bg-gradient-to-br from-amber-200 via-amber-400 to-yellow-600 border-amber-200 text-slate-950 shadow-xl shadow-amber-500/25',
      badgeClass: 'bg-slate-950/80 text-amber-300 border-amber-400/40',
    };
  }
  if (val >= 65) {
    return {
      label: 'PRATA',
      cardClass:
        'bg-gradient-to-br from-slate-200 via-slate-300 to-slate-500 border-slate-100 text-slate-950 shadow-lg shadow-slate-400/20',
      badgeClass: 'bg-slate-950/80 text-slate-200 border-slate-400/40',
    };
  }
  return {
    label: 'BRONZE',
    cardClass:
      'bg-gradient-to-br from-amber-700 via-orange-800 to-stone-900 border-amber-500/60 text-amber-100 shadow-lg shadow-amber-900/30',
    badgeClass: 'bg-slate-950/70 text-amber-300 border-amber-500/40',
  };
}

function getEventMeta(event) {
  switch (event.event_type) {
    case 'GOAL':
      return {
        title: 'GOL MARCADO!',
        subtitle: `Gols na temporada: ${event.old_value} → ${event.new_value}`,
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/30',
        toastBg: 'from-emerald-600/95 via-emerald-700/95 to-slate-900/95 border-emerald-400',
        icon: Flame,
      };
    case 'ASSIST':
      return {
        title: 'ASSISTÊNCIA!',
        subtitle: `Assistências na temporada: ${event.old_value} → ${event.new_value}`,
        color: 'text-cyan-400',
        bg: 'bg-cyan-500/10 border-cyan-500/30',
        toastBg: 'from-cyan-600/95 via-sky-700/95 to-slate-900/95 border-cyan-400',
        icon: Target,
      };
    case 'OVR_UP':
      return {
        title: 'EVOLUÇÃO DE OVERALL!',
        subtitle: `Overall subiu de ${event.old_value} para ${event.new_value}`,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/30',
        toastBg: 'from-amber-500/95 via-yellow-600/95 to-slate-900/95 border-amber-300',
        icon: TrendingUp,
      };
    case 'TRANSFER':
      return {
        title: 'TRANSFERÊNCIA DE CLUBE!',
        subtitle: `${event.old_value} → ${event.new_value}`,
        color: 'text-purple-400',
        bg: 'bg-purple-500/10 border-purple-500/30',
        toastBg: 'from-purple-600/95 via-indigo-700/95 to-slate-900/95 border-purple-400',
        icon: ArrowRightLeft,
      };
    default:
      return {
        title: event.event_type,
        subtitle: `${event.old_value || ''} → ${event.new_value || ''}`,
        color: 'text-slate-300',
        bg: 'bg-slate-800/60 border-slate-700',
        toastBg: 'from-slate-800 to-slate-900 border-slate-600',
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

  // Modais
  const [showNewCareerModal, setShowNewCareerModal] = useState(false);
  const [showNewSeasonModal, setShowNewSeasonModal] = useState(false);
  const [openWindows, setOpenWindows] = useState([]);
  const [loadingWindows, setLoadingWindows] = useState(false);

  // Form Nova Carreira
  const [newCareerForm, setNewCareerForm] = useState({
    player_name: '',
    position: 'ATA',
    nationality: 'Brasil',
    target_window_title: '',
    club_name: '',
    age: 17,
    overall: 62,
  });

  // Form Nova Temporada
  const [newSeasonForm, setNewSeasonForm] = useState({
    club_name: '',
    increment_age: true,
  });

  // Edição Rápida Inline da Temporada Atual
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
    }, 4500);
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
      // ignora silenciosamente se backend estiver reiniciando
    }
  }, []);

  // Inicialização
  useEffect(() => {
    fetchCareers();
    fetchWatcherStatus();
    const statusInterval = setInterval(fetchWatcherStatus, 3000);
    return () => clearInterval(statusInterval);
  }, [fetchCareers, fetchWatcherStatus]);

  // Quando troca a carreira selecionada
  useEffect(() => {
    if (selectedCareerId) {
      fetchDashboard(selectedCareerId);
    }
  }, [selectedCareerId, fetchDashboard]);

  // Conexão WebSocket com auto-reconexão
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
                title: `TEMPORADA #${payload.season?.season_number} INICIADA!`,
                subtitle: `Clube: ${payload.season?.club_name} | OVR: ${payload.season?.overall}`,
                toastBg: 'from-emerald-600/95 via-teal-700/95 to-slate-900/95 border-emerald-400',
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

  // Handlers
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
      console.error('Erro ao criar nova temporada:', err);
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
      console.error('Erro ao atualizar temporada atual:', err);
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
          title: 'TROFÉU CONQUISTADO! 🏆',
          subtitle: `Total na temporada: ${nextTrophies}`,
          toastBg: 'from-amber-500/95 via-yellow-600/95 to-slate-900/95 border-amber-300',
          icon: Trophy,
        });
      }
    } catch (err) {
      console.error('Erro ao ajustar troféu:', err);
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
    seasonLabel: `Temp ${s.season_number}`,
    club: s.club_name,
    Overall: s.overall,
    Gols: s.goals,
    Assistências: s.assists,
    Jogos: s.matches,
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      {/* TOAST ANIMADO AO VIVO */}
      {liveToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div
            className={`flex items-center gap-4 px-6 py-3.5 rounded-2xl border-2 bg-gradient-to-r shadow-2xl ${liveToast.toastBg}`}
          >
            <div className="p-2.5 bg-slate-950/60 rounded-xl">
              {liveToast.icon && <liveToast.icon className="w-7 h-7 text-white" />}
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-white/80">
                Evento Detectado Ao Vivo
              </div>
              <div className="text-lg font-extrabold text-white tracking-tight">
                {liveToast.title}
              </div>
              <div className="text-xs font-medium text-white/90">{liveToast.subtitle}</div>
            </div>
            <button
              onClick={() => setLiveToast(null)}
              className="ml-2 p-1 rounded-lg hover:bg-black/20 text-white/80"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 1. BARRA SUPERIOR DE CONTROLE (HEADER) */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Título */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Trophy className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-white">
                  WSC <span className="text-emerald-400">CAREER TRACKER</span>
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/30">
                  PRO STREAMER
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Monitoramento Autônomo via Visão Computacional (Zero-Click OCR)
              </p>
            </div>
          </div>

          {/* Seletor de Carreira + Botão Nova Carreira */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
              <span className="text-xs text-slate-400 mr-2 font-medium">Carreira:</span>
              <select
                value={selectedCareerId || ''}
                onChange={(e) => setSelectedCareerId(Number(e.target.value))}
                className="bg-transparent text-sm font-bold text-white focus:outline-none cursor-pointer pr-2"
              >
                {careers.length === 0 && <option value="">Nenhuma carreira criada</option>}
                {careers.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                    {c.player_name} ({c.position}) —{' '}
                    {c.current_season
                      ? `${c.current_season.club_name} [OVR ${c.current_season.overall}]`
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
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-100 transition"
            >
              <UserPlus className="w-4 h-4 text-emerald-400" />
              + Nova Carreira
            </button>
          </div>

          {/* Indicador Ao Vivo do Watcher + Botão Start/Stop */}
          <div className="flex items-center gap-3">
            {isWatchingCurrent ? (
              <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <Eye className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-extrabold tracking-wider text-emerald-400">
                  OLHO BIÔNICO ATIVO
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800">
                <span className="h-2 w-2 rounded-full bg-slate-500"></span>
                <span className="text-xs font-semibold text-slate-400">WATCHER PAUSADO</span>
              </div>
            )}

            <button
              onClick={handleToggleWatcher}
              disabled={!selectedCareerId}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide transition shadow-lg ${
                isWatchingCurrent
                  ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
              } disabled:opacity-40`}
            >
              {isWatchingCurrent ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Pausar Monitoramento
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Iniciar Olho Biônico
                </>
              )}
            </button>

            <div
              title={wsConnected ? 'WebSocket Conectado' : 'WebSocket Desconectado'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold ${
                wsConnected
                  ? 'bg-slate-900/90 border-slate-800 text-emerald-400'
                  : 'bg-rose-950/40 border-rose-800/50 text-rose-400'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              {wsConnected ? 'LIVE' : 'OFF'}
            </div>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              <p className="text-sm text-slate-400 font-medium">
                Carregando motor WSC Player Career Tracker...
              </p>
            </div>
          </div>
        ) : !career ? (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-12 text-center max-w-xl mx-auto my-12">
            <Trophy className="w-14 h-14 text-amber-400 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-white mb-2">
              Comece sua Carreira no World Soccer Champs
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              Crie o perfil do seu jogador e selecione a janela do MuMu Player para ativar o
              rastreamento automático de gols, assistências e evolução de Overall.
            </p>
            <button
              onClick={() => {
                fetchWindows();
                setShowNewCareerModal(true);
              }}
              className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm transition"
            >
              + Criar Primeira Carreira
            </button>
          </div>
        ) : (
          <>
            {/* 2. HERO CARD DO JOGADOR (ESTILO EA FC / SOFASCORE) */}
            <section className="relative overflow-hidden bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl">
              {/* Glow decorativo de fundo */}
              <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
              <div className="pointer-events-none absolute -bottom-24 -right-24 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl"></div>

              <div className="relative flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
                {/* Bloco Esquerdo: Badge Gigante de Overall + Dados do Jogador */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-6">
                  {/* Badge Gigante EA FC */}
                  <div
                    className={`w-28 h-32 rounded-2xl border-2 flex flex-col items-center justify-center shrink-0 transition-transform duration-300 hover:scale-105 ${overallTier.cardClass}`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
                      OVERALL
                    </span>
                    <span className="text-5xl font-black tracking-tighter leading-none my-1">
                      {currentSeason?.overall ?? '--'}
                    </span>
                    <span
                      className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${overallTier.badgeClass}`}
                    >
                      {overallTier.label}
                    </span>
                  </div>

                  {/* Informações Principais do Jogador */}
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black tracking-wider">
                        {career.position || 'ATA'}
                      </span>
                      <span className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold">
                        🌍 {career.nationality || 'Brasil'}
                      </span>
                      <span className="px-3 py-1 rounded-lg bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-bold">
                        Pico OVR: {totals.peak_overall}
                      </span>
                      <span className="px-3 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-slate-400 text-xs font-medium flex items-center gap-1.5">
                        <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                        {career.target_window_title}
                      </span>
                    </div>

                    <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                      {career.player_name}
                    </h2>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <Shield className="w-4 h-4 text-emerald-400" />
                        <span>{currentSeason?.club_name || 'Sem Clube'}</span>
                      </div>
                      <span className="text-slate-600">•</span>
                      <div className="font-semibold text-slate-300">
                        Idade:{' '}
                        <span className="text-white font-bold">
                          {currentSeason?.age ?? '--'} anos
                        </span>
                      </div>
                      <span className="text-slate-600">•</span>
                      <div className="font-semibold text-slate-300">
                        Temporada Atual:{' '}
                        <span className="text-emerald-400 font-bold">
                          #{currentSeason?.season_number ?? 1}
                        </span>
                      </div>
                    </div>

                    {/* Telemetria OCR em Tempo Real */}
                    {isWatchingCurrent && watcher.last_raw_ocr && (
                      <div className="pt-1 flex items-center gap-2 text-xs text-slate-400">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">
                          OCR: {(watcher.last_raw_ocr.raw_row_tokens || []).join(' | ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bloco Direito: 5 Cards de Resumo da Carreira (Totais Somados) */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full xl:w-auto">
                  <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl px-4 py-3.5 min-w-[125px]">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Total Jogos
                    </div>
                    <div className="text-2xl font-black text-white mt-1">{totals.matches}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {totals.seasons_count} temp.
                    </div>
                  </div>

                  <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl px-4 py-3.5 min-w-[125px]">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5" /> Total Gols
                    </div>
                    <div className="text-2xl font-black text-emerald-400 mt-1">
                      {totals.goals}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Temp atual: {currentSeason?.goals ?? 0}
                    </div>
                  </div>

                  <div className="bg-slate-950/80 border border-cyan-400/30 rounded-xl px-4 py-3.5 min-w-[125px]">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                      <Target className="w-3.5 h-3.5" /> Assistências
                    </div>
                    <div className="text-2xl font-black text-cyan-400 mt-1">
                      {totals.assists}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Temp atual: {currentSeason?.assists ?? 0}
                    </div>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl px-4 py-3.5 min-w-[125px]">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Média G+A
                    </div>
                    <div className="text-2xl font-black text-white mt-1">{gaPerMatch}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {totals.goal_contributions} part. diretas
                    </div>
                  </div>

                  <div className="bg-slate-950/80 border border-amber-400/40 rounded-xl px-4 py-3.5 min-w-[135px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5" /> Troféus
                      </span>
                      <button
                        onClick={() => handleQuickAddTrophy(1)}
                        title="Adicionar +1 Troféu na temporada atual"
                        className="px-1.5 py-0.5 rounded bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 text-[10px] font-black transition"
                      >
                        +1 🏆
                      </button>
                    </div>
                    <div className="text-2xl font-black text-amber-400 mt-1">
                      {totals.trophies_count}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Temp atual: {currentSeason?.trophies_count ?? 0}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. GRID CENTRAL: GRÁFICOS + TABELA DE TEMPORADAS + FEED AO VIVO */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Coluna Principal (8/12): Gráficos e Tabela */}
              <div className="lg:col-span-8 space-y-6">
                {/* Linha de Gráficos Recharts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Gráfico 1: Evolução de Overall */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-400" />
                          Evolução de Overall
                        </h3>
                        <p className="text-xs text-slate-400">
                          Crescimento por temporada e idade
                        </p>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        OVR Atual: {currentSeason?.overall ?? '--'}
                      </span>
                    </div>

                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="ovrGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis
                            dataKey="name"
                            stroke="#94a3b8"
                            fontSize={11}
                            tickLine={false}
                          />
                          <YAxis
                            domain={['dataMin - 3', 'dataMax + 3']}
                            stroke="#94a3b8"
                            fontSize={11}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0f172a',
                              borderColor: '#334155',
                              borderRadius: '12px',
                              color: '#f8fafc',
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="Overall"
                            stroke="#10b981"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#ovrGradient)"
                            dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#020617' }}
                            activeDot={{ r: 6, fill: '#fbbf24' }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Gráfico 2: Produção Ofensiva (Gols vs Assistências) */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                          <Flame className="w-4 h-4 text-amber-400" />
                          Produção Ofensiva
                        </h3>
                        <p className="text-xs text-slate-400">
                          Comparativo de Gols e Assistências por temporada
                        </p>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-cyan-400/10 text-cyan-300 border border-cyan-400/20">
                        Total G+A: {totals.goal_contributions}
                      </span>
                    </div>

                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis
                            dataKey="name"
                            stroke="#94a3b8"
                            fontSize={11}
                            tickLine={false}
                          />
                          <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0f172a',
                              borderColor: '#334155',
                              borderRadius: '12px',
                              color: '#f8fafc',
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          <Bar
                            dataKey="Gols"
                            fill="#10b981"
                            radius={[6, 6, 0, 0]}
                            maxBarSize={36}
                          />
                          <Bar
                            dataKey="Assistências"
                            fill="#22d3ee"
                            radius={[6, 6, 0, 0]}
                            maxBarSize={36}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Tabela de Temporadas (SeasonLog) + Edição Rápida Inline */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-400" />
                        Histórico de Temporadas
                      </h3>
                      <p className="text-xs text-slate-400">
                        Registro completo por temporada com edição rápida da temporada atual
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => setIsEditingCurrent((prev) => !prev)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 transition"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                        {isEditingCurrent ? 'Cancelar Edição' : 'Editar Temp. Atual'}
                      </button>

                      <button
                        onClick={() => {
                          setNewSeasonForm({
                            club_name: currentSeason?.club_name || '',
                            increment_age: true,
                          });
                          setShowNewSeasonModal(true);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold transition shadow-lg shadow-emerald-500/15"
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                        + Nova Temporada
                      </button>
                    </div>
                  </div>

                  {/* Painel de Edição Rápida Inline (PATCH /careers/{id}/season/current) */}
                  {isEditingCurrent && currentSeason && (
                    <div className="mb-5 p-4 rounded-xl bg-slate-950/90 border border-amber-400/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                          Edição Rápida Manual — Temporada #{currentSeason.season_number}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Altere o clube (gera evento de Transferência), troféus ou corrija estatísticas
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-7 gap-3">
                        <div className="col-span-2">
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                            Clube Atual
                          </label>
                          <input
                            type="text"
                            value={editSeasonForm.club_name}
                            onChange={(e) =>
                              setEditSeasonForm({ ...editSeasonForm, club_name: e.target.value })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                            Idade
                          </label>
                          <input
                            type="number"
                            min={15}
                            max={45}
                            value={editSeasonForm.age}
                            onChange={(e) =>
                              setEditSeasonForm({ ...editSeasonForm, age: e.target.value })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                            Overall
                          </label>
                          <input
                            type="number"
                            min={30}
                            max={99}
                            value={editSeasonForm.overall}
                            onChange={(e) =>
                              setEditSeasonForm({ ...editSeasonForm, overall: e.target.value })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-amber-400"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                            Jogos
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={editSeasonForm.matches}
                            onChange={(e) =>
                              setEditSeasonForm({ ...editSeasonForm, matches: e.target.value })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                            Gols
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={editSeasonForm.goals}
                            onChange={(e) =>
                              setEditSeasonForm({ ...editSeasonForm, goals: e.target.value })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-400"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                            Assist. / Troféus
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
                              className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-cyan-400"
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
                              className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-amber-400"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          onClick={() => setIsEditingCurrent(false)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold text-slate-300"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleSaveCurrentSeason}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Salvar Alterações
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tabela */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          <th className="py-3 px-3">Temp</th>
                          <th className="py-3 px-3">Clube</th>
                          <th className="py-3 px-3 text-center">Idade</th>
                          <th className="py-3 px-3 text-center">OVR</th>
                          <th className="py-3 px-3 text-center">Jogos</th>
                          <th className="py-3 px-3 text-center text-emerald-400">Gols</th>
                          <th className="py-3 px-3 text-center text-cyan-400">Assist.</th>
                          <th className="py-3 px-3 text-center">G+A</th>
                          <th className="py-3 px-3 text-center text-amber-400">Troféus</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-sm">
                        {seasons.map((s) => {
                          const isCurrent = s.id === currentSeason?.id;
                          return (
                            <tr
                              key={s.id}
                              className={`transition ${
                                isCurrent
                                  ? 'bg-emerald-500/5 font-semibold'
                                  : 'hover:bg-slate-800/40'
                              }`}
                            >
                              <td className="py-3 px-3">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold ${
                                    isCurrent
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-slate-800 text-slate-300'
                                  }`}
                                >
                                  #{s.season_number}
                                  {isCurrent && ' (Atual)'}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-bold text-white">{s.club_name}</td>
                              <td className="py-3 px-3 text-center text-slate-300">{s.age}</td>
                              <td className="py-3 px-3 text-center">
                                <span className="px-2.5 py-0.5 rounded-md bg-amber-400/15 border border-amber-400/30 text-amber-300 font-extrabold text-xs">
                                  {s.overall}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center font-semibold text-slate-200">
                                {s.matches}
                              </td>
                              <td className="py-3 px-3 text-center font-extrabold text-emerald-400">
                                {s.goals}
                              </td>
                              <td className="py-3 px-3 text-center font-extrabold text-cyan-400">
                                {s.assists}
                              </td>
                              <td className="py-3 px-3 text-center font-bold text-white">
                                {s.goals + s.assists}
                              </td>
                              <td className="py-3 px-3 text-center font-bold text-amber-400">
                                {s.trophies_count > 0 ? `🏆 ${s.trophies_count}` : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Coluna Lateral Direita (4/12): Feed de Evolução Ao Vivo (EvolutionEvent) */}
              <div className="lg:col-span-4">
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                        <Zap className="w-4 h-4 text-emerald-400" />
                        Feed de Evolução Ao Vivo
                      </h3>
                      <p className="text-xs text-slate-400">
                        Últimos 20 eventos capturados em tempo real
                      </p>
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300">
                      {recentEvents.length} eventos
                    </span>
                  </div>

                  {recentEvents.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4 border border-dashed border-slate-800 rounded-xl">
                      <Eye className="w-10 h-10 text-slate-600 mb-3" />
                      <p className="text-sm font-bold text-slate-300">
                        Aguardando eventos da carreira...
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Assim que o Olho Biônico detectar um gol, assistência ou subida de
                        Overall no emulador, ele aparecerá aqui instantaneamente!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 overflow-y-auto max-h-[680px] pr-1">
                      {recentEvents.map((ev) => {
                        const meta = getEventMeta(ev);
                        const IconComponent = meta.icon;
                        const timeStr = ev.timestamp
                          ? new Date(ev.timestamp).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })
                          : '';
                        return (
                          <div
                            key={ev.id}
                            className={`p-3.5 rounded-xl border flex items-start gap-3.5 transition ${meta.bg}`}
                          >
                            <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 shrink-0">
                              <IconComponent className={`w-4 h-4 ${meta.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-xs font-extrabold ${meta.color}`}>
                                  {meta.title}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  {timeStr}
                                </span>
                              </div>
                              <p className="text-xs text-slate-200 font-semibold mt-0.5 truncate">
                                {meta.subtitle}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* MODAL: NOVA CARREIRA */}
      {showNewCareerModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Criar Nova Carreira</h3>
                  <p className="text-xs text-slate-400">
                    Configure seu jogador e a janela do emulador
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewCareerModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCareer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                  Nome ou Sobrenome do Jogador (como aparece no WSC) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Endrick, Silva, Pedro..."
                  value={newCareerForm.player_name}
                  onChange={(e) =>
                    setNewCareerForm({ ...newCareerForm, player_name: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Posição
                  </label>
                  <select
                    value={newCareerForm.position}
                    onChange={(e) =>
                      setNewCareerForm({ ...newCareerForm, position: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:border-emerald-500 focus:outline-none"
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
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Nacionalidade
                  </label>
                  <input
                    type="text"
                    value={newCareerForm.nationality}
                    onChange={(e) =>
                      setNewCareerForm({ ...newCareerForm, nationality: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Clube Inicial
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Palmeiras"
                    value={newCareerForm.club_name}
                    onChange={(e) =>
                      setNewCareerForm({ ...newCareerForm, club_name: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Idade Inicial (15 - 45)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={45}
                    value={newCareerForm.age}
                    onChange={(e) => setNewCareerForm({ ...newCareerForm, age: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm font-bold text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                    Overall Inicial (30 - 99)
                  </label>
                  <input
                    type="number"
                    min={30}
                    max={99}
                    value={newCareerForm.overall}
                    onChange={(e) =>
                      setNewCareerForm({ ...newCareerForm, overall: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm font-bold text-amber-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase text-slate-300">
                    Janela do Emulador (GET /windows) *
                  </label>
                  <button
                    type="button"
                    onClick={fetchWindows}
                    className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingWindows ? 'animate-spin' : ''}`} />
                    Atualizar Janelas
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:border-emerald-500 focus:outline-none"
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
                    placeholder="Ex: MuMu Player"
                    value={newCareerForm.target_window_title}
                    onChange={(e) =>
                      setNewCareerForm({
                        ...newCareerForm,
                        target_window_title: e.target.value,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm font-bold text-white"
                  />
                )}
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCareerModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-emerald-500/20"
                >
                  Criar Carreira e Temporada 1
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVA TEMPORADA */}
      {showNewSeasonModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Iniciar Nova Temporada</h3>
                  <p className="text-xs text-slate-400">
                    Fecha a temporada #{currentSeason?.season_number} e zera os contadores
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewSeasonModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStartNewSeason} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                  Clube da Nova Temporada (Mude se houve transferência)
                </label>
                <input
                  type="text"
                  value={newSeasonForm.club_name}
                  onChange={(e) =>
                    setNewSeasonForm({ ...newSeasonForm, club_name: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white"
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
                <span className="text-xs font-bold text-slate-200">
                  Incrementar idade automaticamente (+1 ano)
                </span>
              </label>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewSeasonModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold"
                >
                  Confirmar Temporada #{(currentSeason?.season_number || 1) + 1}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
