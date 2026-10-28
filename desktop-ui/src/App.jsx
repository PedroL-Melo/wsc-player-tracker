import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Trophy,
  Plus,
  Play,
  Square,
  RefreshCw,
  Shield,
  Calendar,
  TrendingUp,
  Edit3,
  Check,
  X,
  Monitor,
  ArrowRightLeft,
  UserPlus,
  ChevronsRight,
  Star,
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

/**
 * Cores autênticas das etiquetas de posição do World Soccer Champs
 */
function getWscPositionStyle(pos) {
  const p = (pos || 'AT').toUpperCase();
  if (p === 'GL' || p === 'GOL') {
    return { label: 'GL', bg: 'bg-[#D6B892] text-[#1A1612]' };
  }
  if (['ZG', 'ZAG', 'LD', 'LE', 'LAT', 'PD'].includes(p)) {
    return { label: p.slice(0, 2), bg: 'bg-[#E2D4A5] text-[#1A1812]' };
  }
  if (['VL', 'VOL', 'MO', 'MEI', 'MC'].includes(p)) {
    return { label: p === 'MEI' ? 'MO' : p.slice(0, 2), bg: 'bg-[#A6D6B8] text-[#102016]' };
  }
  return { label: p === 'ATA' ? 'AT' : p.slice(0, 2), bg: 'bg-[#B2C2E8] text-[#121829]' };
}

/**
 * Estilo de Carta EA Sports FC (Bronze, Prata, Ouro Raro e Especial Evolução)
 */
function getEaFcCardStyle(ovr) {
  const val = Number(ovr) || 60;
  if (val >= 85) {
    return {
      tierLabel: 'ESPECIAL',
      cardBg: 'bg-gradient-to-b from-[#10B981] via-[#047857] to-[#064E3B] border-[#6EE7B7]',
      textColor: 'text-white',
      subTextColor: 'text-emerald-100',
      dividerColor: 'border-emerald-300/40',
      statBoxBg: 'bg-black/25 text-white',
    };
  }
  if (val >= 75) {
    return {
      tierLabel: 'OURO',
      cardBg: 'bg-gradient-to-b from-[#FCE78C] via-[#DFAC26] to-[#9E6E0B] border-[#FEF08A]',
      textColor: 'text-[#211805]',
      subTextColor: 'text-[#3A2B09]',
      dividerColor: 'border-[#211805]/25',
      statBoxBg: 'bg-[#211805]/10 text-[#211805]',
    };
  }
  if (val >= 65) {
    return {
      tierLabel: 'PRATA',
      cardBg: 'bg-gradient-to-b from-[#E5EBF2] via-[#B4BFCF] to-[#778396] border-[#F8FAFC]',
      textColor: 'text-[#131822]',
      subTextColor: 'text-[#263042]',
      dividerColor: 'border-[#131822]/25',
      statBoxBg: 'bg-[#131822]/10 text-[#131822]',
    };
  }
  return {
    tierLabel: 'BRONZE',
    cardBg: 'bg-gradient-to-b from-[#D6926A] via-[#A15C38] to-[#5E3019] border-[#E7B190]',
    textColor: 'text-[#1E0E06]',
    subTextColor: 'text-[#33180A]',
    dividerColor: 'border-[#1E0E06]/25',
    statBoxBg: 'bg-black/15 text-[#FFF5EE]',
  };
}

function getEventMeta(event) {
  switch (event.event_type) {
    case 'GOAL':
      return {
        badge: '⚽ GOL',
        title: 'Gol registrado na súmula',
        detail: `Gols na temporada: ${event.old_value} → ${event.new_value}`,
        accent: 'bg-[#22C55E] text-[#091910]',
        borderLeft: 'border-l-[#22C55E]',
      };
    case 'ASSIST':
      return {
        badge: '👟 ASSIST',
        title: 'Assistência confirmada',
        detail: `Assistências na temporada: ${event.old_value} → ${event.new_value}`,
        accent: 'bg-[#38BDF8] text-[#082030]',
        borderLeft: 'border-l-[#38BDF8]',
      };
    case 'OVR_UP':
      return {
        badge: '★ OVR',
        title: 'Pontuação atualizada',
        detail: `Pontuação mudou de ${event.old_value} para ${event.new_value}`,
        accent: 'bg-[#FACC15] text-[#211805]',
        borderLeft: 'border-l-[#FACC15]',
      };
    case 'TRANSFER':
      return {
        badge: '⇄ CLUBE',
        title: 'Transferência confirmada',
        detail: `${event.old_value} → ${event.new_value}`,
        accent: 'bg-[#B2C2E8] text-[#121829]',
        borderLeft: 'border-l-[#B2C2E8]',
      };
    default:
      return {
        badge: 'INFO',
        title: event.event_type,
        detail: `${event.old_value || ''} → ${event.new_value || ''}`,
        accent: 'bg-slate-600 text-white',
        borderLeft: 'border-l-slate-500',
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
    position: 'AT',
    nationality: 'Brasil',
    target_window_title: '',
    club_name: '',
    age: 18,
    overall: 58,
  });

  const [newSeasonForm, setNewSeasonForm] = useState({
    club_name: '',
    increment_age: true,
  });

  const [isEditingCurrent, setIsEditingCurrent] = useState(false);
  const [editSeasonForm, setEditSeasonForm] = useState({
    club_name: '',
    age: 18,
    overall: 58,
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
    }, 4000);
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
        return { ...prev, target_window_title: mumu || list[0] || 'Android Device' };
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
      // ignora caso servidor esteja reiniciando
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
                badge: 'NOVA ÉPOCA',
                title: `Temporada #${payload.season?.season_number} iniciada`,
                detail: `${payload.season?.club_name} • Pontuação ${payload.season?.overall}`,
                accent: 'bg-[#22C55E] text-[#091910]',
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
      console.error('Erro ao alternar leitura:', err);
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
          club_name: newCareerForm.club_name.trim() || 'Ortri',
          age: Number(newCareerForm.age) || 18,
          overall: Number(newCareerForm.overall) || 58,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setShowNewCareerModal(false);
        setNewCareerForm({
          player_name: '',
          position: 'AT',
          nationality: 'Brasil',
          target_window_title: newCareerForm.target_window_title,
          club_name: '',
          age: 18,
          overall: 58,
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
      console.error('Erro ao salvar alterações:', err);
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
          badge: '🏆 TÍTULO',
          title: 'Troféu adicionado ao currículo',
          detail: `Total na temporada: ${nextTrophies}`,
          accent: 'bg-[#FACC15] text-[#211805]',
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

  const cardStyle = getEaFcCardStyle(currentSeason?.overall || 58);
  const posStyle = getWscPositionStyle(career?.position);
  const gaPerMatch =
    totals.matches > 0
      ? ((totals.goals + totals.assists) / totals.matches).toFixed(2)
      : '0.00';

  const chartData = seasons.map((s) => ({
    name: `T${s.season_number} (${s.age}a)`,
    club: s.club_name,
    Pontuação: s.overall,
    Gols: s.goals,
    Assistências: s.assists,
    Jogos: s.matches,
  }));

  return (
    <div className="min-h-screen flex flex-col text-slate-100 pitch-lines">
      {/* Linha divisória central do meio-campo no fundo */}
      <div className="fixed top-6 bottom-6 left-1/2 -translate-x-1/2 w-[2px] bg-white/[0.08] pointer-events-none z-0"></div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white/[0.12] pointer-events-none z-0"></div>

      {/* NOTIFICAÇÃO DE PARTIDA (ESTILO PLACAR DE TV / WSC) */}
      {liveToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-3.5 px-4 py-3 rounded-lg bg-[#1C213E] border-2 border-[#353D6B] shadow-2xl">
            <span className={`px-2.5 py-1 rounded text-xs font-extrabold tracking-wide ${liveToast.accent}`}>
              {liveToast.badge}
            </span>
            <div className="pr-3">
              <div className="text-sm font-bold text-white leading-tight">
                {liveToast.title}
              </div>
              <div className="text-xs text-slate-300">{liveToast.detail}</div>
            </div>
            <button
              onClick={() => setLiveToast(null)}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 1. TOP BAR INSPIRADA NO CABEÇALHO DO WORLD SOCCER CHAMPS */}
      <header className="sticky top-0 z-40 h-16 bg-[#111613]/95 backdrop-blur-md border-b-2 border-white/15 px-6 shadow-lg">
        <div className="max-w-[1540px] h-full mx-auto flex items-center justify-between gap-4">
          {/* Escudo do Clube Atual + Nome do Clube (Igual ao topo do WSC) */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-white p-1.5 flex items-center justify-center shadow">
              <div className="w-full h-full rounded-full border-2 border-[#0E5A45] flex overflow-hidden">
                <div className="w-1/2 h-full bg-[#0E5A45]"></div>
                <div className="w-1/2 h-full bg-white"></div>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-2xl font-extrabold tracking-wide text-white uppercase">
                  {currentSeason?.club_name || 'Modo Carreira'}
                </span>
                <span className="px-2 py-0.5 rounded bg-white/10 text-[11px] font-bold text-emerald-300">
                  WSC Tracker
                </span>
              </div>
            </div>
          </div>

          {/* Seletor de Jogador + Botão Novo Jogador */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center bg-[#1A221D] border border-white/15 rounded-lg px-3 py-1.5">
              <span className="text-xs font-semibold text-slate-300 mr-2">Carreira:</span>
              <select
                value={selectedCareerId || ''}
                onChange={(e) => setSelectedCareerId(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-2"
              >
                {careers.length === 0 && <option value="">Nenhum jogador criado</option>}
                {careers.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#141A17] text-white">
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
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#232E27] hover:bg-[#2E3C33] border border-white/15 text-xs font-bold text-white transition"
            >
              <UserPlus className="w-3.5 h-3.5 text-[#FACC15]" />
              Novo Jogador
            </button>
          </div>

          {/* Botão de Monitoramento no estilo do botão do WSC */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleWatcher}
              disabled={!selectedCareerId}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wider transition shadow ${
                isWatchingCurrent
                  ? 'bg-[#FACC15] hover:bg-[#EAB308] text-[#1C1404]'
                  : 'bg-[#22C55E] hover:bg-[#16A34A] text-[#07170D]'
              } disabled:opacity-40`}
            >
              {isWatchingCurrent ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-[#1C1404] animate-ping"></span>
                  Lendo o Jogo Ao Vivo
                  <Square className="w-3 h-3 fill-current ml-1" />
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Monitorar Emulador
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="relative z-10 flex-1 max-w-[1540px] w-full mx-auto px-6 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="flex items-center gap-3 text-slate-300 text-sm font-semibold">
              <RefreshCw className="w-5 h-5 text-[#FACC15] animate-spin" />
              Carregando carreira do jogador...
            </div>
          </div>
        ) : !career ? (
          <div className="bg-[#1A1F3D] border-2 border-[#2A325E] rounded-xl p-12 max-w-lg mx-auto my-12 text-center">
            <Trophy className="w-12 h-12 text-[#FACC15] mx-auto mb-3" />
            <h2 className="font-display text-3xl font-extrabold text-white uppercase mb-2">
              Comece sua Carreira no WSC
            </h2>
            <p className="text-sm text-slate-300 mb-6">
              Cadastre seu jogador e escolha a janela do emulador para registrar automaticamente
              os jogos, gols, assistências e evolução de pontuação.
            </p>
            <button
              onClick={() => {
                fetchWindows();
                setShowNewCareerModal(true);
              }}
              className="px-6 py-3 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-[#07170D] font-extrabold text-xs uppercase tracking-wider transition"
            >
              + Criar Jogador
            </button>
          </div>
        ) : (
          <>
            {/* 2. VESTIÁRIO DO JOGADOR: CARTA EA FC + PAINEL LIMPO SOFASCORE / WSC */}
            <section className="bg-[#121814]/90 backdrop-blur-xs border-2 border-white/15 rounded-xl p-6 shadow-2xl">
              <div className="flex flex-col xl:flex-row items-center xl:items-stretch gap-7">
                {/* CARTA FÍSICA ESTILO EA SPORTS FC (UT CARD) */}
                <div
                  className={`w-48 shrink-0 eafc-card border-2 p-3.5 flex flex-col justify-between shadow-xl ${cardStyle.cardBg} ${cardStyle.textColor}`}
                >
                  {/* Topo da Carta: OVR + Posição + Bandeira à esquerda | Ícone Camisa à direita */}
                  <div className="flex items-start justify-between relative z-10">
                    <div className="flex flex-col items-center leading-none">
                      <span className="font-display text-5xl font-extrabold tracking-tighter tabular-nums">
                        {currentSeason?.overall ?? 58}
                      </span>
                      <span className="font-display text-lg font-extrabold uppercase tracking-wider mt-0.5">
                        {posStyle.label}
                      </span>
                      <div className={`w-7 border-t my-1 ${cardStyle.dividerColor}`}></div>
                      {/* Mini Bandeira do Brasil estilo WSC */}
                      <div className="w-6 h-4 rounded-xs bg-[#16A34A] flex items-center justify-center border border-black/20 shadow-2xs">
                        <div className="w-3 h-2 bg-[#FACC15] rotate-45 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#1E3A8A]"></div>
                        </div>
                      </div>
                    </div>

                    {/* Silhueta / Camisa Número 10 */}
                    <div className="w-20 h-20 rounded-full bg-black/10 flex flex-col items-center justify-center border border-black/10">
                      <span className="font-display text-3xl font-extrabold opacity-85">
                        #{currentSeason?.season_number || 1}
                      </span>
                      <span className="text-[9px] font-extrabold uppercase tracking-widest opacity-70">
                        ÉPOCA
                      </span>
                    </div>
                  </div>

                  {/* Nome na Carta */}
                  <div className="my-2 text-center relative z-10">
                    <div className={`border-y py-1 ${cardStyle.dividerColor}`}>
                      <div className="font-display text-xl font-extrabold uppercase tracking-tight truncate px-1">
                        {career.player_name}
                      </div>
                    </div>
                  </div>

                  {/* Mini Atributos de Carreira na Base da Carta */}
                  <div className="grid grid-cols-2 gap-1.5 text-xs relative z-10">
                    <div className={`px-2 py-1 rounded flex items-center justify-between font-bold tabular-nums ${cardStyle.statBoxBg}`}>
                      <span className="opacity-75 text-[10px]">JOG</span>
                      <span>{totals.matches}</span>
                    </div>
                    <div className={`px-2 py-1 rounded flex items-center justify-between font-bold tabular-nums ${cardStyle.statBoxBg}`}>
                      <span className="opacity-75 text-[10px]">GOL</span>
                      <span>{totals.goals}</span>
                    </div>
                    <div className={`px-2 py-1 rounded flex items-center justify-between font-bold tabular-nums ${cardStyle.statBoxBg}`}>
                      <span className="opacity-75 text-[10px]">ASS</span>
                      <span>{totals.assists}</span>
                    </div>
                    <div className={`px-2 py-1 rounded flex items-center justify-between font-bold tabular-nums ${cardStyle.statBoxBg}`}>
                      <span className="opacity-75 text-[10px]">IDA</span>
                      <span>{currentSeason?.age ?? 18}</span>
                    </div>
                  </div>
                </div>

                {/* DADOS DO JOGADOR + BLOCOS DE ESTATÍSTICAS LIMPOS (SOFASCORE + WSC) */}
                <div className="flex-1 flex flex-col justify-between w-full space-y-5">
                  {/* Cabeçalho do Perfil */}
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
                    <div className="space-y-2">
                      {/* Linha de Selos autênticos do WSC */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-xs text-xs font-extrabold ${posStyle.bg}`}>
                          {posStyle.label}
                        </span>
                        <span className="px-2.5 py-0.5 rounded bg-white/10 text-xs font-bold text-slate-200">
                          {career.nationality || 'Brasil'}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-white/10 text-xs font-bold text-[#FACC15]">
                          <Star className="w-3.5 h-3.5 fill-[#DC2626] text-[#DC2626]" />
                          Auge OVR: {totals.peak_overall}
                        </span>
                        {/* Seta de Evolução verde clássica do treino do WSC */}
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-[#22C55E]/20 text-[#22C55E] text-xs font-extrabold">
                          <ChevronsRight className="w-4 h-4 stroke-[3]" />
                          Em Evolução
                        </span>
                      </div>

                      <h1 className="font-display text-4xl sm:text-5xl font-extrabold uppercase tracking-tight text-white leading-none">
                        {career.player_name}
                      </h1>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300 font-medium">
                        <span className="text-white font-bold">
                          Clube: <span className="text-[#FACC15]">{currentSeason?.club_name}</span>
                        </span>
                        <span>•</span>
                        <span>{currentSeason?.age} anos</span>
                        <span>•</span>
                        <span>Temporada #{currentSeason?.season_number}</span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <Monitor className="w-3.5 h-3.5" />
                          {career.target_window_title}
                        </span>
                      </div>
                    </div>

                    {/* Nota Sofascore / Média de Participações em Destaque */}
                    <div className="flex items-center gap-3 bg-[#0B0F0C] border border-white/10 rounded-xl p-3">
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-200">Média G+A / Jogo</div>
                        <div className="text-[11px] text-slate-400">
                          {totals.goal_contributions} participações diretas
                        </div>
                      </div>
                      <div className="w-14 h-14 rounded-lg bg-[#22C55E] text-[#07170D] flex items-center justify-center font-display text-3xl font-extrabold tabular-nums shadow">
                        {gaPerMatch}
                      </div>
                    </div>
                  </div>

                  {/* 4 Blocos de Resumo Limpos estilo Sofascore / WSC */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                    <div className="bg-[#0B0F0C] border border-white/10 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase">
                          Partidas Jogadas
                        </span>
                        <div className="font-display text-4xl font-extrabold text-white tabular-nums mt-0.5">
                          {totals.matches}
                        </div>
                        <span className="text-xs text-slate-400">
                          Temporada atual: <strong className="text-white">{currentSeason?.matches ?? 0}</strong>
                        </span>
                      </div>
                      <span className="text-2xl">👕</span>
                    </div>

                    <div className="bg-[#0B0F0C] border border-white/10 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-[#22C55E] uppercase">
                          Gols na Carreira
                        </span>
                        <div className="font-display text-4xl font-extrabold text-[#22C55E] tabular-nums mt-0.5">
                          {totals.goals}
                        </div>
                        <span className="text-xs text-slate-400">
                          Temporada atual: <strong className="text-white">{currentSeason?.goals ?? 0}</strong>
                        </span>
                      </div>
                      <span className="text-2xl">⚽</span>
                    </div>

                    <div className="bg-[#0B0F0C] border border-white/10 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-[#38BDF8] uppercase">
                          Assistências
                        </span>
                        <div className="font-display text-4xl font-extrabold text-[#38BDF8] tabular-nums mt-0.5">
                          {totals.assists}
                        </div>
                        <span className="text-xs text-slate-400">
                          Temporada atual: <strong className="text-white">{currentSeason?.assists ?? 0}</strong>
                        </span>
                      </div>
                      <span className="text-2xl">👟</span>
                    </div>

                    <div className="bg-[#0B0F0C] border border-white/10 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#FACC15] uppercase">
                            Troféus
                          </span>
                          <button
                            onClick={() => handleQuickAddTrophy(1)}
                            className="px-2 py-0.5 rounded bg-[#FACC15] hover:bg-[#EAB308] text-[#1C1404] text-[10px] font-extrabold transition"
                          >
                            +1
                          </button>
                        </div>
                        <div className="font-display text-4xl font-extrabold text-[#FACC15] tabular-nums mt-0.5">
                          {totals.trophies_count}
                        </div>
                        <span className="text-xs text-slate-400">
                          Temporada atual: <strong className="text-white">{currentSeason?.trophies_count ?? 0}</strong>
                        </span>
                      </div>
                      <span className="text-2xl">🏆</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. ÁREA PRINCIPAL: TABELA ESTILO WSC + GRÁFICOS SOFASCORE + SÚMULA AO VIVO */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Coluna Principal (8 colunas) */}
              <div className="lg:col-span-8 space-y-6">
                {/* TABELA DE TEMPORADAS COM O VISUAL EXATO DAS TABELAS DO WSC */}
                <section className="bg-[#121814]/90 backdrop-blur-xs border-2 border-white/15 rounded-xl p-5 shadow-2xl">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div>
                      <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide text-white">
                        Histórico de Temporadas
                      </h2>
                      <p className="text-xs text-slate-300">
                        Estatísticas acumuladas temporada a temporada no clube
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => setIsEditingCurrent((prev) => !prev)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#252C52] hover:bg-[#313A6B] text-xs font-bold text-slate-100 transition"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#FACC15]" />
                        {isEditingCurrent ? 'Fechar Edição' : 'Editar Temporada Atual'}
                      </button>

                      <button
                        onClick={() => {
                          setNewSeasonForm({
                            club_name: currentSeason?.club_name || '',
                            increment_age: true,
                          });
                          setShowNewSeasonModal(true);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-[#07170D] text-xs font-extrabold uppercase tracking-wide transition"
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                        Nova Temporada
                      </button>
                    </div>
                  </div>

                  {/* Edição Manual Rápida */}
                  {isEditingCurrent && currentSeason && (
                    <div className="mb-4 p-4 rounded-lg bg-[#12162E] border-2 border-[#FACC15]/50 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#FACC15] uppercase">
                          Editando Temporada #{currentSeason.season_number}
                        </span>
                        <span className="text-slate-300">
                          Se mudar o nome do clube, uma transferência será registrada no histórico
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-7 gap-2.5">
                        <div className="col-span-2">
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">
                            Clube
                          </label>
                          <input
                            type="text"
                            value={editSeasonForm.club_name}
                            onChange={(e) =>
                              setEditSeasonForm({ ...editSeasonForm, club_name: e.target.value })
                            }
                            className="w-full bg-[#181D38] border border-[#353E70] rounded px-2.5 py-1.5 text-xs font-bold text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">
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
                            className="w-full bg-[#181D38] border border-[#353E70] rounded px-2.5 py-1.5 text-xs font-bold text-white tabular-nums"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">
                            Pontuação
                          </label>
                          <input
                            type="number"
                            min={30}
                            max={99}
                            value={editSeasonForm.overall}
                            onChange={(e) =>
                              setEditSeasonForm({ ...editSeasonForm, overall: e.target.value })
                            }
                            className="w-full bg-[#181D38] border border-[#353E70] rounded px-2.5 py-1.5 text-xs font-bold text-[#FACC15] tabular-nums"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">
                            Jogos
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={editSeasonForm.matches}
                            onChange={(e) =>
                              setEditSeasonForm({ ...editSeasonForm, matches: e.target.value })
                            }
                            className="w-full bg-[#181D38] border border-[#353E70] rounded px-2.5 py-1.5 text-xs font-bold text-white tabular-nums"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">
                            Gols
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={editSeasonForm.goals}
                            onChange={(e) =>
                              setEditSeasonForm({ ...editSeasonForm, goals: e.target.value })
                            }
                            className="w-full bg-[#181D38] border border-[#353E70] rounded px-2.5 py-1.5 text-xs font-bold text-[#22C55E] tabular-nums"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">
                            Assist / Troféus
                          </label>
                          <div className="flex gap-1">
                            <input
                              type="number"
                              min={0}
                              value={editSeasonForm.assists}
                              onChange={(e) =>
                                setEditSeasonForm({ ...editSeasonForm, assists: e.target.value })
                              }
                              className="w-1/2 bg-[#181D38] border border-[#353E70] rounded px-2 py-1.5 text-xs font-bold text-[#38BDF8] tabular-nums"
                            />
                            <input
                              type="number"
                              min={0}
                              value={editSeasonForm.trophies_count}
                              onChange={(e) =>
                                setEditSeasonForm({
                                  ...editSeasonForm,
                                  trophies_count: e.target.value,
                                })
                              }
                              className="w-1/2 bg-[#181D38] border border-[#353E70] rounded px-2 py-1.5 text-xs font-bold text-[#FACC15] tabular-nums"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          onClick={() => setIsEditingCurrent(false)}
                          className="px-3 py-1.5 rounded bg-[#252C52] text-xs font-bold text-slate-200"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleSaveCurrentSeason}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#22C55E] text-[#07170D] text-xs font-extrabold"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Salvar Alterações
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Cabeçalho Cinza-Chumbo Recortado igual ao do WSC */}
                  <div className="overflow-x-auto">
                    <div className="min-w-[680px] space-y-1.5">
                      <div className="wsc-slant-header bg-[#353844] text-white px-5 py-2.5 grid grid-cols-12 items-center text-xs font-extrabold uppercase tracking-wider">
                        <div className="col-span-2">Época</div>
                        <div className="col-span-3">Clube</div>
                        <div className="col-span-1 text-center">IDA.</div>
                        <div className="col-span-2 text-center">PONTUAÇÃO</div>
                        <div className="col-span-1 text-center" title="Jogos">👕</div>
                        <div className="col-span-1 text-center" title="Gols">⚽</div>
                        <div className="col-span-1 text-center" title="Assistências">👟</div>
                        <div className="col-span-1 text-center" title="Troféus">🏆</div>
                      </div>

                      {/* Linhas da Tabela */}
                      {seasons.map((s) => {
                        const isCurrent = s.id === currentSeason?.id;
                        return (
                          <div
                            key={s.id}
                            className={`wsc-slant-row px-5 py-2.5 grid grid-cols-12 items-center text-sm font-bold tabular-nums transition ${
                              isCurrent
                                ? 'bg-[#BFC5D4] text-[#111526]'
                                : 'bg-[#9CA3B5] text-[#111526] opacity-90 hover:opacity-100'
                            }`}
                          >
                            <div className="col-span-2 flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-xs bg-[#181D38] text-white text-xs font-extrabold">
                                T{s.season_number}
                              </span>
                              {isCurrent && (
                                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-xs bg-[#16A34A] text-white">
                                  Atual
                                </span>
                              )}
                            </div>
                            <div className="col-span-3 font-extrabold text-[#111526] truncate">
                              {s.club_name}
                            </div>
                            <div className="col-span-1 text-center font-semibold">{s.age}</div>
                            <div className="col-span-2 flex items-center justify-center gap-1.5">
                              <Star className="w-3.5 h-3.5 fill-[#991B1B] text-[#991B1B]" />
                              <span className="font-extrabold">{s.overall}</span>
                            </div>
                            <div className="col-span-1 text-center">{s.matches}</div>
                            <div className="col-span-1 text-center font-extrabold text-[#0F5132]">
                              {s.goals}
                            </div>
                            <div className="col-span-1 text-center font-extrabold text-[#1E3A8A]">
                              {s.assists}
                            </div>
                            <div className="col-span-1 text-center font-extrabold">
                              {s.trophies_count > 0 ? `${s.trophies_count}` : '0'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {/* GRÁFICOS ESTILO SOFASCORE */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Gráfico 1: Evolução de Pontuação (OVR) */}
                  <section className="bg-[#121814]/90 backdrop-blur-xs border-2 border-white/15 rounded-xl p-5 shadow-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-white">
                          Evolução de Pontuação
                        </h3>
                        <p className="text-xs text-slate-300">
                          Crescimento do Overall a cada temporada
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded bg-white/10 text-xs font-extrabold text-[#FACC15]">
                        ★ {currentSeason?.overall ?? 58}
                      </span>
                    </div>

                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="wscOvr" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#FACC15" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#FACC15" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#223026" vertical={false} />
                          <XAxis
                            dataKey="name"
                            stroke="#94A3B8"
                            fontSize={11}
                            tickLine={false}
                            axisLine={{ stroke: '#223026' }}
                          />
                          <YAxis
                            domain={['dataMin - 3', 'dataMax + 3']}
                            stroke="#94A3B8"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0B0F0C',
                              borderColor: '#2E4033',
                              borderRadius: '8px',
                              fontSize: '12px',
                              color: '#FFFFFF',
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="Pontuação"
                            stroke="#FACC15"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#wscOvr)"
                            dot={{ r: 4, fill: '#FACC15', strokeWidth: 2, stroke: '#0B0F0C' }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </section>

                  {/* Gráfico 2: Gols e Assistências */}
                  <section className="bg-[#121814]/90 backdrop-blur-xs border-2 border-white/15 rounded-xl p-5 shadow-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-white">
                          Gols e Assistências
                        </h3>
                        <p className="text-xs text-slate-300">
                          Produção ofensiva por temporada
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-bold">
                        <span className="flex items-center gap-1.5 text-[#22C55E]">
                          <span className="w-2.5 h-2.5 rounded-xs bg-[#22C55E]"></span>
                          Gols
                        </span>
                        <span className="flex items-center gap-1.5 text-[#38BDF8]">
                          <span className="w-2.5 h-2.5 rounded-xs bg-[#38BDF8]"></span>
                          Assist.
                        </span>
                      </div>
                    </div>

                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#223026" vertical={false} />
                          <XAxis
                            dataKey="name"
                            stroke="#94A3B8"
                            fontSize={11}
                            tickLine={false}
                            axisLine={{ stroke: '#223026' }}
                          />
                          <YAxis
                            stroke="#94A3B8"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0B0F0C',
                              borderColor: '#2E4033',
                              borderRadius: '8px',
                              fontSize: '12px',
                              color: '#FFFFFF',
                            }}
                          />
                          <Bar dataKey="Gols" fill="#22C55E" radius={[4, 4, 0, 0]} maxBarSize={30} />
                          <Bar
                            dataKey="Assistências"
                            fill="#38BDF8"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={30}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                </div>
              </div>

              {/* Coluna Direita (4 colunas): Súmula de Lances da Carreira */}
              <div className="lg:col-span-4">
                <section className="bg-[#121814]/90 backdrop-blur-xs border-2 border-white/15 rounded-xl p-5 shadow-2xl h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                    <div>
                      <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide text-white">
                        Súmula da Carreira
                      </h2>
                      <p className="text-xs text-slate-300">
                        Atualizações registradas automaticamente após as partidas
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-white/10 text-xs font-bold text-slate-200 tabular-nums">
                      {recentEvents.length}
                    </span>
                  </div>

                  {recentEvents.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#0B0F0C] rounded-xl border border-white/10">
                      <span className="text-3xl mb-2">⚽</span>
                      <p className="text-sm font-bold text-white">
                        Aguardando fim da próxima partida
                      </p>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                        Deixe o monitoramento ativo. Quando aparecer a tabela de notas do jogo,
                        os gols e assistências serão registrados aqui automaticamente.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 overflow-y-auto max-h-[650px] pr-1">
                      {recentEvents.map((ev) => {
                        const meta = getEventMeta(ev);
                        const timeStr = ev.timestamp
                          ? new Date(ev.timestamp).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '';
                        return (
                          <div
                            key={ev.id}
                            className={`p-3.5 rounded-lg bg-[#0B0F0C] border border-white/10 border-l-4 ${meta.borderLeft} flex items-center justify-between gap-3`}
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded-xs text-[10px] font-extrabold uppercase ${meta.accent}`}
                                >
                                  {meta.badge}
                                </span>
                                <span className="text-xs font-bold text-white truncate">
                                  {meta.title}
                                </span>
                              </div>
                              <p className="text-xs text-slate-300 font-medium">{meta.detail}</p>
                            </div>
                            <span className="text-[11px] font-bold text-slate-400 tabular-nums shrink-0">
                              {timeStr}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </>
        )}
      </main>

      {/* MODAL: NOVO JOGADOR */}
      {showNewCareerModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#181D38] border-2 border-[#353E70] rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#272F59]">
              <div>
                <h3 className="font-display text-2xl font-extrabold uppercase text-white">
                  Novo Jogador no WSC
                </h3>
                <p className="text-xs text-slate-300">
                  Preencha os dados como aparecem na escalação do jogo
                </p>
              </div>
              <button
                onClick={() => setShowNewCareerModal(false)}
                className="p-1.5 rounded hover:bg-[#252C52] text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCareer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Nome do Jogador (exatamente como está no jogo)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Maicon Ramos"
                  value={newCareerForm.player_name}
                  onChange={(e) =>
                    setNewCareerForm({ ...newCareerForm, player_name: e.target.value })
                  }
                  className="w-full bg-[#10142C] border border-[#353E70] rounded-lg px-3.5 py-2.5 text-sm font-bold text-white focus:border-[#FACC15] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">Posição</label>
                  <select
                    value={newCareerForm.position}
                    onChange={(e) =>
                      setNewCareerForm({ ...newCareerForm, position: e.target.value })
                    }
                    className="w-full bg-[#10142C] border border-[#353E70] rounded-lg px-3 py-2.5 text-sm font-bold text-white"
                  >
                    <option value="AT">AT (Atacante)</option>
                    <option value="PE">PE (Ponta)</option>
                    <option value="PD">PD (Meia Dir.)</option>
                    <option value="MO">MO (Meia Ofensivo)</option>
                    <option value="VL">VL (Volante)</option>
                    <option value="ZG">ZG (Zagueiro)</option>
                    <option value="GL">GL (Goleiro)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    Nacionalidade
                  </label>
                  <input
                    type="text"
                    value={newCareerForm.nationality}
                    onChange={(e) =>
                      setNewCareerForm({ ...newCareerForm, nationality: e.target.value })
                    }
                    className="w-full bg-[#10142C] border border-[#353E70] rounded-lg px-3 py-2.5 text-sm font-bold text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    Clube Atual
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Ortri"
                    value={newCareerForm.club_name}
                    onChange={(e) =>
                      setNewCareerForm({ ...newCareerForm, club_name: e.target.value })
                    }
                    className="w-full bg-[#10142C] border border-[#353E70] rounded-lg px-3 py-2.5 text-sm font-bold text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    Idade (IDA.)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={45}
                    value={newCareerForm.age}
                    onChange={(e) => setNewCareerForm({ ...newCareerForm, age: e.target.value })}
                    className="w-full bg-[#10142C] border border-[#353E70] rounded-lg px-3 py-2.5 text-sm font-bold text-white tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    Pontuação (OVR)
                  </label>
                  <input
                    type="number"
                    min={30}
                    max={99}
                    value={newCareerForm.overall}
                    onChange={(e) =>
                      setNewCareerForm({ ...newCareerForm, overall: e.target.value })
                    }
                    className="w-full bg-[#10142C] border border-[#353E70] rounded-lg px-3 py-2.5 text-sm font-bold text-[#FACC15] tabular-nums"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-200">
                    Janela do Emulador
                  </label>
                  <button
                    type="button"
                    onClick={fetchWindows}
                    className="text-xs font-bold text-[#FACC15] hover:underline flex items-center gap-1"
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
                    className="w-full bg-[#10142C] border border-[#353E70] rounded-lg px-3 py-2.5 text-sm font-bold text-white"
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
                    placeholder="Ex: Android Device"
                    value={newCareerForm.target_window_title}
                    onChange={(e) =>
                      setNewCareerForm({
                        ...newCareerForm,
                        target_window_title: e.target.value,
                      })
                    }
                    className="w-full bg-[#10142C] border border-[#353E70] rounded-lg px-3 py-2.5 text-sm font-bold text-white"
                  />
                )}
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCareerModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#252C52] text-xs font-bold text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-[#07170D] text-xs font-extrabold uppercase"
                >
                  Criar Jogador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVA TEMPORADA */}
      {showNewSeasonModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#181D38] border-2 border-[#353E70] rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#272F59]">
              <div>
                <h3 className="font-display text-2xl font-extrabold uppercase text-white">
                  Iniciar Temporada #{(currentSeason?.season_number || 1) + 1}
                </h3>
                <p className="text-xs text-slate-300">
                  Fecha a temporada atual e zera os jogos, gols e assistências da nova época
                </p>
              </div>
              <button
                onClick={() => setShowNewSeasonModal(false)}
                className="p-1.5 rounded hover:bg-[#252C52] text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStartNewSeason} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Clube da Nova Temporada
                </label>
                <input
                  type="text"
                  value={newSeasonForm.club_name}
                  onChange={(e) =>
                    setNewSeasonForm({ ...newSeasonForm, club_name: e.target.value })
                  }
                  className="w-full bg-[#10142C] border border-[#353E70] rounded-lg px-3.5 py-2.5 text-sm font-bold text-white"
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newSeasonForm.increment_age}
                  onChange={(e) =>
                    setNewSeasonForm({ ...newSeasonForm, increment_age: e.target.checked })
                  }
                  className="w-4 h-4 accent-[#22C55E] rounded"
                />
                <span className="text-xs font-bold text-slate-200">
                  Somar +1 ano na idade do jogador
                </span>
              </label>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewSeasonModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#252C52] text-xs font-bold text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-[#07170D] text-xs font-extrabold uppercase"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
