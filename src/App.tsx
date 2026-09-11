import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, History, FileUp, RefreshCw, Copy, Check, AlertTriangle, 
  Package, ShieldAlert, CheckCircle2, ArrowRight 
} from 'lucide-react';

/* ================================================================= 편리한 내장 데이터 (D-S04) ================================================================= */
interface GradeItem {
  grade_id: string;
  grade_name: string;
  application: string;
  market: '내수' | '수출';
  currency: 'KRW' | 'USD';
  list_price: number;
  cost_per_kg: number;
  freight_per_kg: number;
  min_margin_pct: number;
  moq_kg: number;
  default_qty_kg: number;
  remark: string;
  [key: string]: any;
}

interface MasterData {
  meta: {
    version: string;
    base_date: string;
    default_fx_krw_per_usd: number;
  };
  grades: GradeItem[];
}

interface HistoryItem {
  id: number;
  timestamp: string;
  grade_id: string;
  grade_name: string;
  market: string;
  qty: number;
  discount: number;
  fx: number | string;
  revenue: number;
  margin: number;
  margin_pct: number;
  margin_state: string;
  moq_state: string;
}

const DEFAULT_MASTER: MasterData = {
  meta: {
    version: "1.0",
    base_date: "2026-08-27",
    default_fx_krw_per_usd: 1350
  },
  grades: [
    { grade_id: "G-01", grade_name: "범용 사출 그레이드", application: "범용 사출품", market: "내수", currency: "KRW", list_price: 2650, cost_per_kg: 2150, freight_per_kg: 0, min_margin_pct: 15.0, moq_kg: 1000, default_qty_kg: 5000, remark: "" },
    { grade_id: "G-02", grade_name: "자동차 램프용 내열 그레이드", application: "자동차 외장/램프", market: "내수", currency: "KRW", list_price: 3400, cost_per_kg: 2890, freight_per_kg: 0, min_margin_pct: 15.0, moq_kg: 2000, default_qty_kg: 10000, remark: "마진율 = 최소 마진 경계 → 정상" },
    { grade_id: "G-03", grade_name: "도광판용 광학 그레이드", application: "디스플레이 도광판", market: "수출", currency: "USD", list_price: 2.35, cost_per_kg: 2380, freight_per_kg: 0.08, min_margin_pct: 18.0, moq_kg: 5000, default_qty_kg: 20000, remark: "" },
    { grade_id: "G-04", grade_name: "고내후 옥외 간판 그레이드", application: "옥외 광고판", market: "수출", currency: "USD", list_price: 2.10, cost_per_kg: 2560, freight_per_kg: 0.08, min_margin_pct: 12.0, moq_kg: 5000, default_qty_kg: 5000, remark: "마진 미달 경고 1건" },
    { grade_id: "G-05", grade_name: "고유동 박막 그레이드", application: "박막 정밀 성형", market: "내수", currency: "KRW", list_price: 3050, cost_per_kg: 2410, freight_per_kg: 0, min_margin_pct: 18.0, moq_kg: 3000, default_qty_kg: 2500, remark: "수량 < MOQ 경고 1건" },
    { grade_id: "G-06", grade_name: "SMMA 투명 내충격 그레이드", application: "가전 외관 커버", market: "수출", currency: "USD", list_price: 2.55, cost_per_kg: 2290, freight_per_kg: 0.10, min_margin_pct: 15.0, moq_kg: 2000, default_qty_kg: 8000, remark: "" }
  ]
};

// 반올림 유틸 (HALF_UP)
const roundHalfUp = (val: number) => Math.round(val);
const roundDecimal = (val: number, scale = 2) => Number(Math.round(Number(val + 'e' + scale)) + 'e-' + scale);

export default function App() {
  // 상태 관리
  const [activeTab, setActiveTab] = useState<'calc' | 'history' | 'master'>('calc');
  const [masterData, setMasterData] = useState<MasterData>(() => {
    const saved = localStorage.getItem('exs04.master.v1');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return DEFAULT_MASTER;
  });

  const [selectedGradeId, setSelectedGradeId] = useState<string>('G-01');
  const [qty, setQty] = useState<number | string>(5000);
  const [discount, setDiscount] = useState<number | string>(0);
  const [fx, setFx] = useState<number | string>(DEFAULT_MASTER.meta.default_fx_krw_per_usd);

  // 이력 관리
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('exs04.quotes.v1');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [];
  });

  const [copied, setCopied] = useState<boolean>(false);

  // 현재 선택된 그레이드 객체
  const currentGrade = useMemo(() => {
    return masterData.grades.find(g => g.grade_id === selectedGradeId) || masterData.grades[0];
  }, [masterData, selectedGradeId]);

  // 그레이드 변경 시 기본 수량 환율 초기화 연동
  useEffect(() => {
    if (currentGrade) {
      setQty(currentGrade.default_qty_kg);
    }
  }, [selectedGradeId]);

  // 입력 검증 (5.1)
  const validation = useMemo(() => {
    const qNum = Number(qty);
    const dNum = Number(discount);
    const fxNum = Number(fx);

    if (isNaN(qNum) || qNum <= 0) return { valid: false, error: '수량은 0보다 커야 합니다.', q: 0, d: 0, fx: 0 };
    if (isNaN(dNum) || dNum < 0 || dNum > 30) return { valid: false, error: '할인율은 0% ~ 30% 사이여야 합니다.', q: 0, d: 0, fx: 0 };
    if (currentGrade?.market === '수출' && (isNaN(fxNum) || fxNum <= 0)) return { valid: false, error: '유효한 환율을 입력하세요.', q: 0, d: 0, fx: 0 };

    return { valid: true, error: '', q: qNum, d: dNum, fx: fxNum };
  }, [qty, discount, fx, currentGrade]);

  // 금액 및 마진 산출 (5.2 ~ 5.6)
  const calculationResult = useMemo(() => {
    if (!validation.valid || !currentGrade) return null;

    const { q, d, fx: currentFx } = validation;
    const isDomestic = currentGrade.market === '내수';

    // 5.2 판가 환산 (KRW/kg)
    const p_krw_unrounded = isDomestic 
      ? currentGrade.list_price * (1 - d / 100)
      : currentGrade.list_price * currentFx * (1 - d / 100);

    // 5.3 금액 산출 (원 단위 반올림 HALF_UP)
    const rev_raw = q * p_krw_unrounded;
    const cost_raw = q * currentGrade.cost_per_kg;
    const freight_raw = isDomestic ? 0 : (q * currentGrade.freight_per_kg * currentFx);
    
    const revenue = roundHalfUp(rev_raw);
    const cost = roundHalfUp(cost_raw);
    const freight = roundHalfUp(freight_raw);
    
    // 반올림 오차 0을 위한 재산출 마진
    const margin = revenue - cost - freight;

    // 5.4 마진율 산출 (반올림 전 원값 기준)
    const margin_pct_raw = rev_raw !== 0 ? ( (rev_raw - cost_raw - freight_raw) / rev_raw ) * 100 : 0;
    const margin_pct = roundDecimal(margin_pct_raw, 2);

    // 5.5 최소 마진 판정
    const isMarginPassed = margin_pct >= currentGrade.min_margin_pct;

    // 최대 허용 할인율(d_max) 산출 코드 
    const p_krw_0 = isDomestic ? currentGrade.list_price : currentGrade.list_price * currentFx;
    const f_krw = isDomestic ? 0 : currentGrade.freight_per_kg * currentFx;
    const denominator = p_krw_0 * (1 - currentGrade.min_margin_pct / 100);
    let d_max = 0;
    if (denominator > 0) {
      d_max = (1 - (currentGrade.cost_per_kg + f_krw) / denominator) * 100;
    }
    d_max = Math.floor(d_max * 10) / 10; // 소수 1자리 내림

    // 5.6 MOQ 판정
    const isMoqPassed = q >= currentGrade.moq_kg;
    const moqDeficit = currentGrade.moq_kg - q;

    return {
      p_krw_unrounded,
      revenue,
      cost,
      freight,
      margin,
      margin_pct,
      isMarginPassed,
      d_max: d_max < 0 ? 0 : d_max,
      isMoqPassed,
      moqDeficit,
      isDomestic
    };
  }, [validation, currentGrade]);

  // 이력 저장 (5.7)
  const handleSaveHistory = () => {
    if (!calculationResult || !validation.valid) return;

    const newItem: HistoryItem = {
      id: Date.now(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      grade_id: currentGrade.grade_id,
      grade_name: currentGrade.grade_name,
      market: currentGrade.market,
      qty: validation.q,
      discount: validation.d,
      fx: calculationResult.isDomestic ? '-' : validation.fx,
      revenue: calculationResult.revenue,
      margin: calculationResult.margin,
      margin_pct: calculationResult.margin_pct,
      margin_state: calculationResult.isMarginPassed ? '정상' : '마진 미달',
      moq_state: calculationResult.isMoqPassed ? '정상' : 'MOQ 미달'
    };

    const updated = [newItem, ...history].slice(0, 100); // 최대 100건
    setHistory(updated);
    localStorage.setItem('exs04.quotes.v1', JSON.stringify(updated));
    alert('견적 이력이 저장되었습니다.');
  };

  // 클립보드 복사 (F-06)
  const handleCopyClipboard = () => {
    if (!calculationResult || !currentGrade) return;
    const text = `[견적 산출서 - ${currentGrade.grade_name} (${currentGrade.grade_id})]
- 시장구분: ${currentGrade.market}
- 수량: ${validation.q.toLocaleString()} kg (MOQ: ${currentGrade.moq_kg.toLocaleString()} kg)
- 할인율: ${validation.d}%
- 환율: ${calculationResult.isDomestic ? '내수 적용무관' : validation.fx + ' KRW/USD'}
- 매출액: ${calculationResult.revenue.toLocaleString()} KRW
- 매출원가: ${calculationResult.cost.toLocaleString()} KRW
- 물류운임: ${calculationResult.freight.toLocaleString()} KRW
- 영업마진: ${calculationResult.margin.toLocaleString()} KRW
- 마진율: ${calculationResult.margin_pct}% (최소기준: ${currentGrade.min_margin_pct}%)
- 판정: ${calculationResult.isMarginPassed && calculationResult.isMoqPassed ? '정상 견적' : '주의 필요 (마진/MOQ 미달)'}`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // 마스터 파일/텍스트 반입 처리 (F-01)
  const handleMasterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        let parsed: MasterData;
        if (file.name.endsWith('.json')) {
          parsed = JSON.parse(content);
        } else {
          // 간단한 CSV 파서 (탭 또는 쉼표)
          const lines = content.split('\n').filter(l => l.trim().length > 0);
          const headers = lines[0].split(/[,\t]/).map(h => h.trim().replace(/^["']|["']$/g, ''));
          const grades: GradeItem[] = [];
          for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(/[,\t]/).map(v => v.trim().replace(/^["']|["']$/g, ''));
            const rowObj: any = {};
            headers.forEach((h, idx) => {
              let val: any = vals[idx];
              if (val !== undefined && !isNaN(val) && val !== '') val = Number(val);
              rowObj[h] = val;
            });
            if (rowObj.grade_id) grades.push(rowObj as GradeItem);
          }
          parsed = { meta: { version: "1.1", base_date: new Date().toISOString().substring(0,10), default_fx_krw_per_usd: 1350 }, grades };
        }

        if (parsed && Array.isArray(parsed.grades) && parsed.grades.length > 0) {
          setMasterData(parsed);
          localStorage.setItem('exs04.master.v1', JSON.stringify(parsed));
          setSelectedGradeId(parsed.grades[0].grade_id);
          alert(`성공적으로 ${parsed.grades.length}개의 그레이드 마스터를 불러왔습니다.`);
          setActiveTab('calc');
        } else {
          alert('유효하지 않은 마스터 구조입니다.');
        }
      } catch (err: any) {
        alert('파일 파싱 중 오류가 발생했습니다: ' + err.message);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center p-4 sm:p-6 font-sans">
      {/* 상단 타이틀 및 네비게이션 */}
      <div className="w-full max-w-3xl bg-slate-800 border border-slate-700 rounded-2xl shadow-xl p-5 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-indigo-600 text-white text-xs font-bold px-2.5 py-1 rounded-md">PRD-S04</span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">그레이드별 견적·마진 계산기</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              수량·할인율·환율 기반 실시간 마진 검증 및 MOQ·최소마진 사전 경고 시스템
            </p>
          </div>
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700 self-stretch sm:self-auto">
            <button 
              onClick={() => setActiveTab('calc')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${activeTab === 'calc' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Calculator size={14} /> 견적 산출
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${activeTab === 'history' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <History size={14} /> 이력 ({history.length})
            </button>
            <button 
              onClick={() => setActiveTab('master')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${activeTab === 'master' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <FileUp size={14} /> 마스터 관리
            </button>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 영역 */}
      <div className="w-full max-w-3xl space-y-6">
        
        {/* ================= TAB 1: 견적 산출 화면 (S-01) ================= */}
        {activeTab === 'calc' && (
          <>
            {/* 1. 그레이드 선택 영역 */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                  <Package size={16} className="text-indigo-400" /> 제품 그레이드 선택
                </label>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${currentGrade.market === '내수' ? 'bg-slate-600 text-slate-200' : 'bg-blue-600 text-white'}`}>
                  {currentGrade.market} ({currentGrade.currency})
                </span>
              </div>

              <select 
                value={selectedGradeId}
                onChange={(e) => setSelectedGradeId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-indigo-500 transition"
              >
                {masterData.grades.map(g => (
                  <option key={g.grade_id} value={g.grade_id}>
                    [{g.grade_id}] {g.grade_name} — (용도: {g.application})
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs text-slate-400 bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                <div>기준단가: <span className="text-slate-200 font-bold">{currentGrade.list_price} {currentGrade.currency}/kg</span></div>
                <div>제조원가: <span className="text-slate-200 font-bold">{currentGrade.cost_per_kg.toLocaleString()} KRW</span></div>
                <div>최소마진율: <span className="text-slate-200 font-bold">{currentGrade.min_margin_pct}%</span></div>
                <div>기본MOQ: <span className="text-slate-200 font-bold">{currentGrade.moq_kg.toLocaleString()} kg</span></div>
              </div>
            </div>

            {/* 2. 조건 입력 폼 */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* 수량 */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">견적 수량 (kg)</label>
                <input 
                  type="number" 
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* 할인율 */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">할인율 (%) [0~30]</label>
                <input 
                  type="number" 
                  step="0.1"
                  min="0"
                  max="30"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* 환율 */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">환율 (KRW/USD)</label>
                <input 
                  type="number" 
                  value={fx}
                  disabled={currentGrade.market === '내수'}
                  onChange={(e) => setFx(e.target.value)}
                  className={`w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:border-indigo-500 ${currentGrade.market === '내수' ? 'opacity-40 cursor-not-allowed' : ''}`}
                />
              </div>
            </div>

            {/* 유효성 오류 알림 */}
            {!validation.valid && (
              <div className="bg-red-950/80 border border-red-800 text-red-200 p-4 rounded-xl text-sm flex items-center gap-2">
                <ShieldAlert size={18} className="text-red-400 shrink-0" />
                <span>{validation.error}</span>
              </div>
            )}

            {/* 3. 산출 결과 카드 (2x2 Grid + 마진율 강조) */}
            {calculationResult && validation.valid && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
                
                {/* 경고 배지 구역 (마진 미달 & MOQ 미달) */}
                <div className="flex flex-wrap gap-2">
                  {/* 마진 판정 배지 */}
                  {calculationResult.isMarginPassed ? (
                    <div className="flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-800 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold">
                      <CheckCircle2 size={14} /> 마진 정상 (기준 {currentGrade.min_margin_pct}% 이상)
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-red-950/80 border border-red-800 text-red-200 px-3 py-1.5 rounded-xl text-xs font-bold animate-pulse">
                      <AlertTriangle size={14} /> 마진 미달 경고! (현재 {calculationResult.margin_pct}% &lt; 기준 {currentGrade.min_margin_pct}%)
                      <span className="ml-1 bg-red-900 px-2 py-0.5 rounded text-[10px]">최대허용할인: {calculationResult.d_max}%</span>
                    </div>
                  )}

                  {/* MOQ 판정 배지 */}
                  {calculationResult.isMoqPassed ? (
                    <div className="flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-800 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold">
                      <CheckCircle2 size={14} /> MOQ 충족 ({calculationResult.isDomestic ? '내수' : '수출'} 기준 {currentGrade.moq_kg.toLocaleString()} kg)
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-amber-950/80 border border-amber-800 text-amber-200 px-3 py-1.5 rounded-xl text-xs font-bold">
                      <AlertTriangle size={14} /> MOQ 미달 경고 (부족량: {calculationResult.moqDeficit.toLocaleString()} kg)
                    </div>
                  )}
                </div>

                {/* 핵심 금액 카드 그리드 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-900/80 border border-slate-700/70 p-4 rounded-xl">
                    <span className="text-xs text-slate-400 font-semibold block mb-1">총 예상 매출액</span>
                    <span className="text-xl sm:text-2xl font-black text-indigo-400">
                      {calculationResult.revenue.toLocaleString()} <span className="text-xs font-normal text-slate-400">KRW</span>
                    </span>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-700/70 p-4 rounded-xl">
                    <span className="text-xs text-slate-400 font-semibold block mb-1">제조 원가합계</span>
                    <span className="text-xl sm:text-2xl font-black text-slate-200">
                      {calculationResult.cost.toLocaleString()} <span className="text-xs font-normal text-slate-400">KRW</span>
                    </span>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-700/70 p-4 rounded-xl">
                    <span className="text-xs text-slate-400 font-semibold block mb-1">물류 운임합계 ({currentGrade.market})</span>
                    <span className="text-xl sm:text-2xl font-black text-slate-200">
                      {calculationResult.freight.toLocaleString()} <span className="text-xs font-normal text-slate-400">KRW</span>
                    </span>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-700/70 p-4 rounded-xl">
                    <span className="text-xs text-slate-400 font-semibold block mb-1">영업 마진 (이익)</span>
                    <span className={`text-xl sm:text-2xl font-black ${calculationResult.margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {calculationResult.margin.toLocaleString()} <span className="text-xs font-normal text-slate-400">KRW</span>
                    </span>
                  </div>
                </div>

                {/* 마진율 게이지 하단 바 */}
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-3">
                  <div>
                    <span className="text-xs text-slate-400 block">산출 마진율 (Margin %)</span>
                    <div className={`text-2xl font-black ${calculationResult.isMarginPassed ? 'text-emerald-400' : 'text-red-400'}`}>
                      {calculationResult.margin_pct}%
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      onClick={handleCopyClipboard}
                      className="flex-1 sm:flex-none bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />} 
                      {copied ? '복사완료!' : '견적표 복사'}
                    </button>
                    <button 
                      onClick={handleSaveHistory}
                      className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/30"
                    >
                      이력 저장
                    </button>
                  </div>
                </div>

              </div>
            )}
          </>
        )}

        {/* ================= TAB 2: 견적 이력 화면 (S-02) ================= */}
        {activeTab === 'history' && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <History size={16} className="text-indigo-400" /> 저장된 견적 산출 이력 ({history.length}건)
              </h2>
              {history.length > 0 && (
                <button 
                  onClick={() => {
                    if(confirm('모든 이력을 삭제하시겠습니까?')) {
                      setHistory([]);
                      localStorage.removeItem('exs04.quotes.v1');
                    }
                  }}
                  className="text-xs text-red-400 hover:underline"
                >
                  전체 삭제
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                저장된 견적 이력이 없습니다. 견적 산출 화면에서 [이력 저장]을 실행해 보세요.
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {history.map(item => (
                  <div key={item.id} className="bg-slate-900 border border-slate-700/70 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-indigo-400">[{item.grade_id}] {item.grade_name}</span>
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">{item.market}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${item.margin_state === '정상' ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'}`}>
                          {item.margin_state}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${item.moq_state === '정상' ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'}`}>
                          {item.moq_state}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                        <span>수량: <strong className="text-slate-200">{item.qty.toLocaleString()} kg</strong></span>
                        <span>할인율: <strong className="text-slate-200">{item.discount}%</strong></span>
                        <span>매출: <strong className="text-slate-200">{item.revenue.toLocaleString()} KRW</strong></span>
                        <span>마진율: <strong className={item.margin_state === '정상' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{item.margin_pct}%</strong></span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">{item.timestamp}</div>
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedGradeId(item.grade_id);
                        setQty(item.qty);
                        setDiscount(item.discount);
                        if(item.fx !== '-') setFx(item.fx);
                        setActiveTab('calc');
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition self-end sm:self-center"
                    >
                      불러오기 <ArrowRight size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: 마스터 관리 화면 (S-03) ================= */}
        {activeTab === 'master' && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-6">
            <div className="border-b border-slate-700 pb-3">
              <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <FileUp size={16} className="text-indigo-400" /> 가격 마스터 관리 및 교체 (JSON / CSV 파일 업로드)
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                현재 총 {masterData.grades.length}개의 그레이드가 마스터에 등록되어 있습니다. (기준일: {masterData.meta.base_date})
              </p>
            </div>

            {/* 파일 업로드 폼 */}
            <div className="border-2 border-dashed border-slate-700 rounded-2xl p-6 text-center space-y-3 bg-slate-900/40">
              <FileUp size={32} className="mx-auto text-indigo-400" />
              <div>
                <p className="text-sm font-bold text-slate-200">새로운 마스터 파일 업로드</p>
                <p className="text-xs text-slate-400 mt-0.5">JSON 또는 CSV 형식을 지원합니다.</p>
              </div>
              <input 
                type="file" 
                accept=".json,.csv" 
                onChange={handleMasterUpload} 
                className="block w-full max-w-xs mx-auto text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
              />
            </div>

            {/* 기본 마스터 복원 버튼 */}
            <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-700">
              <div>
                <p className="text-xs font-bold text-slate-300">기본 내장 마스터로 초기화</p>
                <p className="text-[10px] text-slate-400">PRD 표준 예시 데이터 6종으로 재설정합니다.</p>
              </div>
              <button 
                onClick={() => {
                  setMasterData(DEFAULT_MASTER);
                  localStorage.setItem('exs04.master.v1', JSON.stringify(DEFAULT_MASTER));
                  setSelectedGradeId('G-01');
                  alert('기본 마스터로 복원되었습니다.');
                }}
                className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition"
              >
                <RefreshCw size={12} /> 초기화
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
