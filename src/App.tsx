import React, { useState, useEffect, useMemo, useRef } from 'react';
import { signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { 
  TrendingUp, RotateCcw, Trophy, 
  Target, Banknote, AlertCircle, Scissors, 
  ArrowRightCircle, Star, Shield, 
  Gamepad2, ClipboardList, ChevronDown, CheckCircle2,
  XCircle, CheckCircle, Loader2, Plus, Trash2, ChevronUp,
  User, History, PlusCircle, Clock, Calendar as CalendarIcon, Coins, ArrowBigRightDash, 
  ArrowRight
} from 'lucide-react';

// --- Assets Visuais de Casas de Aposta ---
const BetanoIcon = () => (
  <div className="flex items-center gap-1.5 bg-[#FF7324]/10 px-2 py-0.5 rounded-lg border border-[#FF7324]/20 shadow-sm">
    <div className="w-3 h-3 bg-[#FF7324] rounded-full flex items-center justify-center">
      <span className="text-[8px] text-white font-black">B</span>
    </div>
    <span className="text-[8px] font-black text-[#FF7324] tracking-tighter uppercase">Betano</span>
  </div>
);

const EstrelaIcon = () => (
  <div className="flex items-center gap-1.5 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/20 shadow-sm">
    <Star size={10} className="fill-amber-500 text-amber-600" />
    <span className="text-[8px] font-black text-amber-600 tracking-tighter uppercase">Estrela</span>
  </div>
);

const SportingbetIcon = () => (
  <div className="flex items-center gap-1.5 bg-[#003272]/10 px-2 py-0.5 rounded border border-[#003272]/20 shadow-sm">
    <div className="w-3 h-3 bg-[#003272] rounded-sm flex items-center justify-center">
      <span className="text-[8px] text-white font-black">S</span>
    </div>
    <span className="text-[8px] font-black text-[#003272] tracking-tighter uppercase">Sporting</span>
  </div>
);

// --- Utilitários de Formatação ---
const fCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const nToWords = (n) => {
  if (n <= 0) return "Zero reais";
  const units = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const teens = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const hundreds = ["", "cem", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  const fmt = (num) => {
    let out = "";
    if (num === 100) return "cem";
    if (num > 100) { out += (num < 200 ? "cento" : hundreds[Math.floor(num / 100)]); num %= 100; if (num > 0) out += " e "; }
    if (num >= 20) { out += tens[Math.floor(num / 10)]; num %= 10; if (num > 0) out += " e " + units[num]; }
    else if (num >= 10) { out += teens[num - 10]; }
    else if (num > 0) { out += units[num]; }
    return out;
  };

  const intP = Math.floor(n);
  const decP = Math.round((n - intP) * 100);
  let res = "";
  if (intP > 0) {
    if (intP >= 1000) {
      const thou = Math.floor(intP / 1000); const rem = intP % 1000;
      res += (thou === 1 ? "" : fmt(thou)) + " mil";
      if (rem > 0) res += (rem < 100 ? " e " : " ") + fmt(rem);
    } else { res += fmt(intP); }
    res += integerPartWord(intP);
  }
  if (decP > 0) { if (res !== "") res += " e "; res += fmt(decP); res += decP === 1 ? " centavo" : " centavos"; }
  return res.charAt(0).toUpperCase() + res.slice(1);
};

const integerPartWord = (n) => n === 1 ? " real" : " reais";

const MONTHS = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
const DAYS_OF_WEEK = ["DOMINGO", "SEGUNDA-FEIRA", "TERÇA-FEIRA", "QUARTA-FEIRA", "QUINTA-FEIRA", "SEXTA-FEIRA", "SÁBADO"];

const App = () => {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [curMonth, setCurMonth] = useState(new Date().getMonth());
  const [history, setHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedBet, setExpandedBet] = useState(null);

  const dayRefs = useRef({});
  const now = new Date();
  const todayDate = now.getDate();
  const todayMonth = now.getMonth();
  const todayDayName = DAYS_OF_WEEK[now.getDay()];
  const todayMonthName = MONTHS[now.getMonth()];

  const appId = typeof __app_id !== 'undefined' ? __app_id : 'bet-manager-final-v11';

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    if (!loading && curMonth === todayMonth && dayRefs.current[todayDate]) {
      setTimeout(() => {
        dayRefs.current[todayDate].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 1000); 
    }
  }, [loading, curMonth, todayDate, todayMonth]);

  useEffect(() => {
    if (!auth) return;
    const startAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
          await signInWithCustomToken(auth, __initial_auth_token);
        } catch (e) {
          console.error(e);
        }
      } else {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.error("Auth error:", e);
          if (e.code === 'auth/admin-restricted-operation' || e.code === 'auth/operation-not-allowed') {
            setAuthError(true);
          }
        }
      }
    };
    startAuth();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (!u && !authError) setLoading(false);
    });
  }, [auth, authError]);

  const saveHistory = (h) => {
    setHistory(h);
    if (!user) return;
    const path = `artifacts/${appId}/users/${user.uid}/settings/history`;
    setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'history'), h)
      .catch(e => handleFirestoreError(e, OperationType.WRITE, path));
  };

  useEffect(() => {
    if (!user || !db) return;
    setLoading(true);
    const path = `artifacts/${appId}/users/${user.uid}/settings/history`;
    const historyRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'history');
    return onSnapshot(historyRef, (s) => {
      if (s.exists()) setHistory(s.data());
      else {
        const initialDays = Array.from({ length: 31 }, (_, i) => ({
          day: i + 1, status: 'pending', withdrawal: 0, protectCapital: false, bets: (i + 1 === 26) ? [
            { match: "BRASIL X FRANÇA", house: 'Betano', odd: 1.57, stake: 3.13, status: 'won' },
            { match: "MÚLTIPLA 3 JOGOS", house: 'EstrelaBet', odd: 3.04, stake: 0.50, status: 'won' },
            { match: "COMBO 8 FAVORITOS", house: 'Sportingbet', odd: 9.33, stake: 1.07, status: 'lost' }
          ] : []
        }));
        const initialData = { [`${curMonth}_2026`]: { days: initialDays, settings: { stake: 4.70, odd: 1.40 } } };
        setHistory(initialData);
        setDoc(historyRef, initialData).catch(e => handleFirestoreError(e, OperationType.WRITE, path));
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  }, [user, db, appId, curMonth]);

  const monthKey = `${curMonth}_2026`;
  const mData = history[monthKey] || { 
    days: Array.from({ length: 31 }, (_, i) => ({ day: i + 1, status: 'pending', withdrawal: 0, protectCapital: false, bets: [] })),
    settings: { stake: 4.70, odd: 1.40 }
  };

  const calcDays = useMemo(() => {
    let results = []; 
    let nextStake = 0; 
    let foundStart = false;
    
    // Sugestões por casa
    let lastHouseWins = [];

    for (let i = 0; i < 31; i++) {
      const d = mData.days[i];
      const dayNum = i + 1;
      const isToday = dayNum === todayDate && curMonth === todayMonth;
      const hasBets = d.bets && d.bets.length > 0;

      if (!foundStart && (hasBets || isToday)) {
          foundStart = true;
          nextStake = hasBets ? d.bets.reduce((acc, b) => acc + (b.stake || 0), 0) : mData.settings.stake;
      }

      let currentStake = hasBets ? d.bets.reduce((acc, b) => acc + (b.stake || 0), 0) : (foundStart ? nextStake : 0);
      
      let totalReturn = 0;
      let currentDayWins = [];

      if (hasBets) {
        totalReturn = d.bets.reduce((acc, b) => {
          if (b.status === 'won') {
            const ret = (b.stake || 0) * (b.odd || 1);
            currentDayWins.push({ house: b.house, amount: ret, odd: b.odd });
            return acc + ret;
          }
          return acc;
        }, 0);
      } else {
        totalReturn = currentStake * mData.settings.odd;
      }

      const profit = totalReturn - currentStake;
      const withdrawal = d.withdrawal || 0;

      results.push({ 
        ...d, 
        stake: currentStake, 
        ret: totalReturn, 
        profit,
        suggestedBets: lastHouseWins.length > 0 ? lastHouseWins : [
           { house: 'Betano', amount: nextStake * 0.7, odd: 1.57 },
           { house: 'EstrelaBet', amount: nextStake * 0.3, odd: 3.04 }
        ],
        suggestedStake: nextStake
      });

      // Se o dia teve vitórias, o próximo plano de ação será baseado nelas
      if (hasBets && currentDayWins.length > 0) {
          lastHouseWins = currentDayWins;
      }

      if (d.status === 'lost') {
        nextStake = 0;
        lastHouseWins = [];
      } else if (foundStart) {
        if (d.protectCapital) nextStake = Math.max(0, profit - withdrawal);
        else nextStake = Math.max(0, totalReturn - withdrawal);
      }
    }
    return results;
  }, [mData, todayDate, todayMonth, curMonth]);

  const stats = useMemo(() => ({
    totalW: mData.days.reduce((a, d) => a + (d.withdrawal || 0), 0),
    proj: calcDays[30].ret
  }), [mData, calcDays]);

  const updDay = (idx, up) => {
    const h = { ...history }; const ds = [...mData.days];
    ds[idx] = { ...ds[idx], ...up };
    h[monthKey] = { ...mData, days: ds };
    saveHistory(h);
  };

  const updBetStatus = (dIdx, bIdx, status) => {
    const b = [...mData.days[dIdx].bets];
    b[bIdx].status = status;
    updDay(dIdx, { bets: b });
  };

  if (!authReady || loading) {
    if (authError) {
      return (
        <div className="h-screen bg-[#FDFBF7] flex flex-col items-center justify-center gap-6 p-6 text-center">
          <AlertCircle size={48} className="text-red-500" />
          <h1 className="text-2xl font-black text-zinc-800">Ação Necessária no Firebase</h1>
          <p className="text-zinc-600 max-w-md">
            Para usar o aplicativo sem exigir login do Google, você precisa habilitar a autenticação <strong>Anônima</strong> no painel do Firebase.
          </p>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 text-left space-y-3">
            <p className="text-sm font-bold text-zinc-800">Siga estes passos:</p>
            <ol className="text-sm text-zinc-600 list-decimal pl-4 space-y-2">
              <li>Acesse o <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-amber-600 underline">Console do Firebase</a>.</li>
              <li>Selecione o projeto deste aplicativo.</li>
              <li>No menu lateral, clique em <strong>Autenticação</strong> (Authentication) e depois na aba <strong>Sign-in method</strong> (Método de login).</li>
              <li>Clique em <strong>Adicionar novo provedor</strong> (Add new provider).</li>
              <li>Selecione <strong>Anônimo</strong> (Anonymous) e ative a chave.</li>
              <li>Clique em <strong>Salvar</strong> e recarregue esta página.</li>
            </ol>
          </div>
        </div>
      );
    }
    return <div className="h-screen bg-[#FDFBF7] flex items-center justify-center"><Loader2 className="animate-spin text-amber-500" size={40} /></div>;
  }

  if (!user && !authError) {
    return <div className="h-screen bg-[#FDFBF7] flex items-center justify-center"><Loader2 className="animate-spin text-amber-500" size={40} /></div>;
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-zinc-900 font-sans selection:bg-amber-400 pb-40">
      
      {/* HEADER (Baseado na sua imagem) */}
      <header className="px-6 py-8 flex items-center justify-between">
        <div className="flex items-center gap-5">
           <div className="w-16 h-16 bg-[#F8F1D4] rounded-2xl flex items-center justify-center border-2 border-white shadow-[0_8px_15px_rgba(0,0,0,0.05)] relative overflow-hidden">
              <div className="flex flex-col items-center">
                 <TrendingUp size={24} className="text-[#899763] -mb-1" strokeWidth={3} />
                 <div className="flex gap-1">
                    <div className="w-4 h-4 bg-[#D9C496] rounded-sm flex items-center justify-center"><div className="w-1 h-1 bg-white rounded-full"></div></div>
                    <div className="w-4 h-4 bg-[#D9C496] rounded-sm"></div>
                 </div>
              </div>
           </div>

           <div className="flex flex-col">
              <h1 className="text-2xl font-black italic tracking-tighter text-[#334155]/70 flex items-baseline leading-none">
                 BET<span className="text-[#334155] font-black">MANAGER</span>
              </h1>
              <div className="flex items-center gap-2 mt-1">
                 <p className="text-[10px] font-black text-zinc-800 uppercase tracking-widest leading-none">
                    {todayDayName}, {todayDate} DE {todayMonthName}
                 </p>
                 <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_red]"></div>
              </div>
           </div>
        </div>

        <div className="flex items-center gap-5">
           <div className="bg-[#1E293B]/5 rounded-[2rem] p-1 border border-white shadow-xl">
              <div className="bg-[#1E293B] rounded-[1.8rem] px-8 py-3 shadow-inner flex flex-col items-center">
                 <span className="text-[8px] text-zinc-400 font-black uppercase tracking-[0.2em] mb-1">PROJEÇÃO FINAL</span>
                 <span className="text-2xl font-black text-white leading-none tracking-tighter">{fCurrency(stats.proj)}</span>
              </div>
           </div>
           <div className="w-14 h-14 rounded-full border-4 border-white shadow-xl bg-gradient-to-b from-zinc-100 to-zinc-300 flex items-center justify-center">
              <User size={28} className="text-zinc-500" />
           </div>
        </div>
      </header>

      {/* Meses */}
      <nav className="px-6 mb-10 overflow-x-auto no-scrollbar">
        <div className="flex bg-[#E2E8F0]/30 p-2 rounded-[2.5rem] border border-white shadow-sm gap-2">
           {MONTHS.map((m, i) => (
             <button key={m} onClick={() => setCurMonth(i)} className={`px-10 py-3 rounded-[2rem] text-[10px] font-black uppercase transition-all whitespace-nowrap ${curMonth === i ? 'bg-[#F8F1D4] text-zinc-800 shadow-md border-b-2 border-[#D9C496]' : 'text-zinc-500'}`}>
                {m}
             </button>
           ))}
        </div>
      </nav>

      <main className="px-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Sidebar */}
        <aside className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-white p-8 shadow-2xl shadow-zinc-200/50">
             <h3 className="text-[11px] font-black uppercase text-zinc-400 mb-8 flex items-center gap-3 border-b-2 border-zinc-50 pb-4 tracking-widest">
               <History size={18} className="text-amber-500" /> SETUP ATUAL
             </h3>
             <div className="space-y-8">
                <div className="bg-zinc-50 p-5 rounded-3xl border border-zinc-100 shadow-inner">
                   <label className="text-[10px] text-zinc-400 font-black uppercase block mb-2 text-center tracking-widest">BANCA BASE</label>
                   <input type="number" value={mData.settings.stake} onChange={(e) => { const h = {...history}; h[monthKey] = {...mData, settings: {...mData.settings, stake: Number(e.target.value)}}; saveHistory(h); }} className="w-full bg-transparent text-zinc-900 font-black text-3xl text-center focus:outline-none" />
                </div>
                <div className="bg-zinc-50 p-5 rounded-3xl border border-zinc-100 shadow-inner">
                   <label className="text-[10px] text-zinc-400 font-black uppercase block mb-2 text-center tracking-widest">ODD PADRÃO</label>
                   <input type="number" step="0.1" value={mData.settings.odd} onChange={(e) => { const h = {...history}; h[monthKey] = {...mData, settings: {...mData.settings, odd: Number(e.target.value)}}; saveHistory(h); }} className="w-full bg-transparent text-zinc-900 font-black text-3xl text-center focus:outline-none" />
                </div>
             </div>
          </div>
          <button onClick={() => dayRefs.current[todayDate]?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="w-full py-6 bg-white border border-white rounded-[2.5rem] text-[12px] font-black uppercase tracking-widest text-zinc-600 hover:text-amber-600 transition-all flex items-center justify-center gap-4 shadow-2xl">
            <Clock size={20} className="text-amber-500" /> IR PARA HOJE
          </button>
        </aside>

        {/* Grid Principal */}
        <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
           {calcDays.map((d, i) => {
              const isToday = d.day === todayDate && curMonth === todayMonth;
              const totalSuggestedReturn = d.suggestedBets.reduce((acc, b) => acc + (b.amount * b.odd), 0);

              return (
                <div key={i} ref={el => dayRefs.current[d.day] = el} className={`rounded-[3.5rem] border-4 transition-all flex flex-col overflow-hidden relative shadow-2xl ${d.status === 'won' ? 'bg-[#ECFDF5] border-white' : d.status === 'lost' ? 'bg-[#FEF2F2] border-white' : isToday ? 'bg-white border-[#F8F1D4] ring-8 ring-[#F8F1D4]/10 scale-[1.03] z-10 shadow-emerald-900/5' : 'bg-white border-white'}`}>
                  
                  <div className={`p-8 flex justify-between items-center border-b-2 ${isToday ? 'bg-[#F8F1D4]/30 border-[#F8F1D4]' : 'border-zinc-50'}`}>
                     <span className={`text-[12px] font-black px-6 py-2 rounded-full shadow-md ${d.status === 'won' ? 'bg-emerald-500 text-white' : d.status === 'lost' ? 'bg-red-500 text-white' : isToday ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                       {isToday ? 'HOJE' : `DIA ${d.day < 10 ? '0' : ''}${d.day}`}
                     </span>
                     <div className="flex gap-3">
                        <button onClick={() => updDay(i, { protectCapital: !d.protectCapital })} className={`p-3 rounded-full transition-all ${d.protectCapital ? 'bg-amber-100 text-amber-600 shadow-inner' : 'bg-zinc-50 text-zinc-300'}`}>
                          <Shield size={22} />
                        </button>
                        <button onClick={() => updDay(i, { status: 'pending' })} className="p-3 rounded-full bg-zinc-50 text-zinc-300 hover:text-zinc-600 transition-all">
                          <RotateCcw size={22} />
                        </button>
                     </div>
                  </div>

                  <div className="p-10 flex-1 space-y-8">
                     {d.bets && d.bets.length > 0 ? (
                        <div className="space-y-5">
                           <div className="flex items-center justify-between text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em]">
                              <span>REGISTOS DE ENTRADA</span>
                              <button onClick={() => { const b=d.bets||[]; updDay(i, {bets: [...b, {match:'NOVA ENTRADA', house:'Betano', odd:1.40, stake:0, status:'pending'}]}); }} className="text-amber-600 flex items-center gap-1 font-black"><PlusCircle size={16} /> ADD</button>
                           </div>
                           <div className="space-y-4 max-h-[600px] overflow-y-auto no-scrollbar pr-1">
                              {d.bets.map((bet, bIdx) => {
                                 const isExpanded = expandedBet && expandedBet[0] === i && expandedBet[1] === bIdx;
                                 const betReturn = (bet.stake || 0) * (bet.odd || 0);
                                 return (
                                   <div key={bIdx} className={`rounded-[2.5rem] border-2 transition-all shadow-sm ${bet.status === 'won' ? 'bg-white border-emerald-100' : bet.status === 'lost' ? 'bg-white border-red-100' : 'bg-zinc-50 border-zinc-100'}`}>
                                      <div className="p-6 cursor-pointer" onClick={() => setExpandedBet(isExpanded ? null : [i, bIdx])}>
                                         <div className="flex justify-between items-start mb-5">
                                            {bet.house === 'Betano' ? <BetanoIcon /> : bet.house === 'EstrelaBet' ? <EstrelaIcon /> : <SportingbetIcon />}
                                            <div className="flex flex-col items-end gap-1.5">
                                               <div className="flex flex-col items-end leading-none border-b border-zinc-100 pb-2 w-full">
                                                  <span className="text-[8px] text-zinc-400 font-black uppercase">Entrada</span>
                                                  <span className="text-[12px] font-black text-zinc-800 leading-none">{fCurrency(bet.stake)}</span>
                                               </div>
                                               <div className="flex flex-col items-end leading-none pt-1">
                                                  <span className="text-[8px] text-zinc-400 font-black uppercase">Retorno</span>
                                                  <span className="text-[13px] font-black text-emerald-600 font-mono italic">@ {bet.odd} → {fCurrency(betReturn)}</span>
                                               </div>
                                            </div>
                                         </div>
                                         <div className="flex justify-between items-center pt-4 border-t border-zinc-100/50">
                                            <p className="text-[12px] font-black text-zinc-800 truncate uppercase italic tracking-tighter">{bet.match}</p>
                                            <ChevronDown size={18} className={`text-zinc-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                         </div>
                                      </div>
                                      {isExpanded && (
                                         <div className="px-6 pb-8 space-y-5 animate-in fade-in slide-in-from-top-2 border-t border-zinc-50 bg-white">
                                            <div className="grid grid-cols-2 gap-4 mt-5">
                                               <button onClick={() => updBetStatus(i, bIdx, 'won')} className={`py-4 rounded-3xl text-[10px] font-black uppercase transition-all shadow-md ${bet.status === 'won' ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-white border border-zinc-100 text-zinc-300'}`}>GANHOU ✅</button>
                                               <button onClick={() => updBetStatus(i, bIdx, 'lost')} className={`py-4 rounded-3xl text-[10px] font-black uppercase transition-all shadow-md ${bet.status === 'lost' ? 'bg-red-500 text-white shadow-red-200' : 'bg-white border border-zinc-100 text-zinc-300'}`}>PERDEU ❌</button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                               <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-3xl shadow-inner text-right">
                                                  <label className="text-[8px] text-zinc-400 font-black block mb-1">STAKE</label>
                                                  <input type="number" value={bet.stake || ''} onChange={(e) => { const b=[...d.bets]; b[bIdx].stake=Number(e.target.value); updDay(i, {bets: b}); }} className="w-full bg-transparent text-zinc-900 font-black text-base text-right focus:outline-none" />
                                               </div>
                                               <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-3xl shadow-inner text-right">
                                                  <label className="text-[8px] text-zinc-400 font-black block mb-1">ODD</label>
                                                  <input type="number" step="0.01" value={bet.odd || ''} onChange={(e) => { const b=[...d.bets]; b[bIdx].odd=Number(e.target.value); updDay(i, {bets: b}); }} className="w-full bg-transparent text-emerald-600 font-black text-base text-right focus:outline-none" />
                                               </div>
                                            </div>
                                            <button onClick={() => { const b=d.bets.filter((_, idx)=>idx!==bIdx); updDay(i, {bets:b}); }} className="w-full py-3 bg-red-50 text-red-500 text-[10px] font-black uppercase rounded-2xl border border-red-100">EXCLUIR BILHETE</button>
                                         </div>
                                      )}
                                   </div>
                                 );
                              })}
                           </div>
                        </div>
                     ) : (
                        <div className="flex flex-col items-center justify-center py-6 bg-amber-50/50 border-4 border-dashed border-amber-100 rounded-[3rem] shadow-inner relative overflow-hidden">
                           <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12"><ArrowBigRightDash size={80} /></div>
                           <ArrowBigRightDash size={48} className="mb-4 text-amber-500 animate-pulse" strokeWidth={3} />
                           <h4 className="text-[12px] font-black uppercase text-amber-900 tracking-widest mb-4 border-b border-amber-200 pb-2">PLANO DE ALAVANCAGEM</h4>
                           
                           <div className="w-full px-8 space-y-3">
                              {d.suggestedBets.map((sb, sIdx) => (
                                 <div key={sIdx} className="bg-white rounded-3xl p-4 shadow-lg border border-amber-50">
                                    <div className="flex justify-between items-center mb-1">
                                       {sb.house === 'Betano' ? <BetanoIcon /> : <EstrelaIcon />}
                                       <span className="text-[11px] font-black text-emerald-600 font-mono italic">@ {sb.odd}</span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                       <div className="flex flex-col">
                                          <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-tighter">Entrada</span>
                                          <span className="text-[14px] font-black text-zinc-900 leading-none">{fCurrency(sb.amount)}</span>
                                       </div>
                                       <div className="flex flex-col items-end">
                                          <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-tighter">Retorno</span>
                                          <span className="text-[14px] font-black text-[#899763] leading-none">{fCurrency(sb.amount * sb.odd)}</span>
                                       </div>
                                    </div>
                                 </div>
                              ))}
                              
                              <div className="pt-4 border-t-2 border-dashed border-amber-100 mt-2">
                                 <div className="flex justify-between items-center text-[#334155]">
                                    <span className="text-[10px] font-black uppercase tracking-widest">TOTAL ALAVANCAGEM</span>
                                    <span className="text-lg font-black text-[#334155]">{fCurrency(d.suggestedStake)}</span>
                                 </div>
                                 <div className="flex justify-between items-center mt-1 text-emerald-600">
                                    <span className="text-[9px] font-bold uppercase">META DE RETORNO</span>
                                    <span className="text-xl font-black">{fCurrency(totalSuggestedReturn)}</span>
                                 </div>
                              </div>
                           </div>
                           <p className="mt-6 text-[8px] font-bold text-amber-600 uppercase italic px-10 text-center leading-tight">Mande o print das entradas para validar o plano composto.</p>
                        </div>
                     )}
                  </div>

                  {/* Footer Card */}
                  <div className={`p-10 border-t-4 space-y-8 ${isToday ? 'bg-[#F8F1D4]/30 border-[#F8F1D4]' : 'bg-zinc-50/20 border-zinc-50'}`}>
                     <div className="flex flex-col gap-6">
                        <div className="flex justify-between items-end border-b-2 border-zinc-100 pb-6">
                           <div className="flex flex-col">
                              <p className="text-[10px] text-zinc-400 font-black uppercase mb-1 tracking-widest">ENTRADA DO DIA</p>
                              <p className="text-2xl font-black text-zinc-900 leading-none tracking-tighter">{fCurrency(d.stake)}</p>
                              <span className="text-[8px] text-zinc-400 italic font-bold uppercase mt-2">{nToWords(d.stake)}</span>
                           </div>
                           <div className="text-right flex flex-col">
                              <p className="text-[10px] text-zinc-400 font-black uppercase mb-1 tracking-widest">RETORNO GANHO</p>
                              <p className={`text-2xl font-black tracking-tighter leading-none ${d.status === 'won' ? 'text-emerald-600 drop-shadow-md' : 'text-zinc-800'}`}>{fCurrency(d.ret)}</p>
                              <span className="text-[8px] text-zinc-400 italic font-bold uppercase mt-2">{nToWords(d.ret)}</span>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                           <button onClick={() => updDay(i, { status: 'won' })} className={`py-6 rounded-[2.5rem] text-[14px] font-black uppercase transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-4 ${d.status === 'won' ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-white text-emerald-600 border-2 border-emerald-100'}`}><CheckCircle size={28} /> GREEN</button>
                           <button onClick={() => updDay(i, { status: 'lost' })} className={`py-6 rounded-[2.5rem] text-[14px] font-black uppercase transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-4 ${d.status === 'lost' ? 'bg-red-600 text-white shadow-red-200' : 'bg-white text-red-600 border-2 border-red-100'}`}><XCircle size={28} /> RED</button>
                        </div>
                     </div>

                     <div className="pt-8 border-t-4 border-dotted border-zinc-100">
                        <div className="flex justify-between items-center mb-4 leading-none px-2">
                           <span className="flex items-center gap-2 text-[11px] font-black uppercase text-amber-600 tracking-[0.2em]"><Scissors size={18} /> SANGRIA MANUAL</span>
                           {d.withdrawal > 0 && <span className="text-[14px] font-black text-amber-700 italic">-{fCurrency(d.withdrawal)}</span>}
                        </div>
                        <div className="bg-white rounded-[2.5rem] border border-zinc-100 shadow-inner p-6 focus-within:ring-4 ring-amber-50 transition-all">
                           <input type="number" value={d.withdrawal || ''} onChange={(e) => updDay(i, { withdrawal: Number(e.target.value) })} placeholder="VALOR PARA SAQUE" className="w-full bg-transparent text-center text-2xl font-black text-zinc-900 focus:outline-none placeholder:text-zinc-200" />
                        </div>
                     </div>
                  </div>
                </div>
              );
           })}
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; background-color: #FDFBF7; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        input[type=number]::-webkit-inner-spin-button { appearance: none; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        main > div > div { animation: fadeIn 0.9s cubic-bezier(0.23, 1, 0.32, 1) forwards; }
      `}} />
    </div>
  );
};

export default App;
