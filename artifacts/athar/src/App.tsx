import { useEffect, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowDownToLine, Check, CheckCircle2, Circle,
  Clock3, Cloud, Cpu, Database, RotateCcw, Server,
  ShieldCheck, Terminal, X, XCircle, Zap,
} from 'lucide-react';
import {
  CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';

type Phase = 'healthy' | 'deploying' | 'incident' | 'resolved';
type Pod = { name: string; memory: number; restarts: number; status: string; version: string; recovering?: boolean };
type Point = { time: string; apiA: number; apiB: number; apiC: number };
type EventTimer = ReturnType<typeof setTimeout>;
type TimelineEntry = { time: string; text: string };
type AnalysisSource = 'ai' | 'fallback';
type IncidentAnalysisAction = 'rollback' | 'restart' | 'scale_up_memory' | 'none';
type IncidentAnalysis = {
  root_cause_ar: string;
  confidence: number;
  evidence_ar: string[];
  action: IncidentAnalysisAction;
  action_target: string;
  explanation_ar: string;
};
type IncidentDeployment = { revision: number; version: string; status: string };
type IncidentEvidence = {
  metrics_summary: string;
  previous_logs: string[];
  events: string[];
  deploy_history: IncidentDeployment[];
};

const analysisActions: IncidentAnalysisAction[] = ['rollback', 'restart', 'scale_up_memory', 'none'];

function parseIncidentAnalysis(value: unknown): IncidentAnalysis | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const evidence = candidate.evidence_ar;
  if (
    typeof candidate.root_cause_ar !== 'string' ||
    candidate.root_cause_ar.length < 1 ||
    candidate.root_cause_ar.length > 2000 ||
    typeof candidate.confidence !== 'number' ||
    !Number.isInteger(candidate.confidence) ||
    candidate.confidence < 0 ||
    candidate.confidence > 100 ||
    !Array.isArray(evidence) ||
    evidence.length > 12 ||
    !evidence.every((item) => typeof item === 'string' && item.length <= 500) ||
    typeof candidate.action !== 'string' ||
    !analysisActions.includes(candidate.action as IncidentAnalysisAction) ||
    typeof candidate.action_target !== 'string' ||
    candidate.action_target.length > 200 ||
    typeof candidate.explanation_ar !== 'string' ||
    candidate.explanation_ar.length > 2000
  ) return null;
  return {
    root_cause_ar: candidate.root_cause_ar,
    confidence: candidate.confidence,
    evidence_ar: evidence,
    action: candidate.action as IncidentAnalysisAction,
    action_target: candidate.action_target,
    explanation_ar: candidate.explanation_ar,
  };
}

const initialPods: Pod[] = [
  { name: 'orders-api-7c9d8f6b4-k2m4p', memory: 141, restarts: 0, status: 'Running', version: 'v1' },
  { name: 'orders-api-7c9d8f6b4-r8x1n', memory: 138, restarts: 0, status: 'Running', version: 'v1' },
  { name: 'orders-api-7c9d8f6b4-w5q7c', memory: 143, restarts: 0, status: 'Running', version: 'v1' },
];
const initialChart: Point[] = [
  { time: '-10m', apiA: 137, apiB: 141, apiC: 139 },
  { time: '-8m', apiA: 140, apiB: 138, apiC: 142 },
  { time: '-6m', apiA: 142, apiB: 140, apiC: 138 },
  { time: '-4m', apiA: 139, apiB: 143, apiC: 141 },
  { time: '-2m', apiA: 141, apiB: 139, apiC: 140 },
  { time: '0m', apiA: 141, apiB: 138, apiC: 143 },
];
const stepNames = [
  'جمع مقاييس الذاكرة من Prometheus',
  'قراءة سجلات الحاوية السابقة',
  'فحص أحداث Kubernetes',
  'مراجعة سجل النشر',
  'تحليل الأدلة وتحديد السبب الجذري',
];
const evidenceTabs = [
  { id: 'Metrics', label: 'المقاييس' },
  { id: 'Logs', label: 'السجلات' },
  { id: 'Events', label: 'الأحداث' },
  { id: 'Deployments', label: 'عمليات النشر' },
];
const verifyNames = ['كل الـ Pods جاهزة', 'الإعادات متوقفة', 'الذاكرة طبيعية', 'نسبة الأخطاء طبيعية'];
const fallbackAnalysis: IncidentAnalysis = {
  root_cause_ar: 'ارتفع استهلاك الذاكرة في النسخة v2 تدريجيًا وتجاوز حد 256Mi؛ بينما ظل متوسط النسخة v1 مستقرًا قرب 140Mi.',
  confidence: 87,
  evidence_ar: ['ارتفاع الذاكرة بمقدار 112Mi', 'متوسط v1 المستقر: 140Mi', 'إنهاء 3 حاويات بسبب الذاكرة', 'النشر الحالي revision 5 · v2'],
  action: 'rollback',
  action_target: 'deployment/orders-api · revision 4',
  explanation_ar: 'تزامن تجاوز حد الذاكرة مع النسخة المنشورة حديثًا، وتؤكد السجلات السابقة فشل تخصيص الذاكرة.',
};
const incidentEvidence: IncidentEvidence = {
  metrics_summary: 'بعد نشر revision 5 (v2)، ارتفع container_memory_working_set_bytes من خط أساس 140.6Mi إلى 268Mi و281Mi، متجاوزًا حد 256Mi. حدث ذلك خلال نحو 12 دقيقة من النشر.',
  previous_logs: [
    '14:31:40 INFO processing order batch size=128',
    '14:31:47 WARN heap usage reached 94% (241Mi)',
    '14:31:53 ERROR allocation failed: memory limit exceeded',
    '14:31:54 Killed',
  ],
  events: [
    '14:31:54 Warning OOMKilled pod/orders-api-9f4bc8d7f-k2m4p',
    '14:31:59 Warning Back-off restarting failed container; kubelet / prod',
  ],
  deploy_history: [
    { revision: 5, version: 'v2', status: 'current' },
    { revision: 4, version: 'v1', status: 'stable' },
  ],
};
const actionLabels: Record<IncidentAnalysis['action'], string> = {
  rollback: 'العودة إلى إصدار سابق',
  restart: 'إعادة التشغيل',
  scale_up_memory: 'زيادة حد الذاكرة',
  none: 'لا حاجة إلى إجراء',
};
const BIDI_RUN = /([A-Za-z0-9+][A-Za-z0-9_.:/+-]*(?:\s+[A-Za-z0-9+][A-Za-z0-9_.:/+-]*)*)/g;

function mixedText(text: string) {
  return text.split(BIDI_RUN).map((part, index) =>
    /[A-Za-z0-9]/.test(part) ? <bdi key={index} dir="ltr">{part}</bdi> : part,
  );
}

function incidentTime(elapsedSeconds: number) {
  const total = 14 * 3600 + 31 * 60 + 37 + elapsedSeconds;
  const hours = Math.floor(total / 3600) % 24;
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function App() {
  const [phase, setPhase] = useState<Phase>('healthy');
  const [pods, setPods] = useState<Pod[]>(initialPods);
  const [chart, setChart] = useState<Point[]>(initialChart);
  const [seconds, setSeconds] = useState(0);
  const [alertVisible, setAlertVisible] = useState(false);
  const [step, setStep] = useState(-1);
  const [evidenceTab, setEvidenceTab] = useState('Metrics');
  const [evidenceVisible, setEvidenceVisible] = useState(false);
  const [rootReady, setRootReady] = useState(false);
  const [analysis, setAnalysis] = useState<IncidentAnalysis | null>(null);
  const [analysisSource, setAnalysisSource] = useState<AnalysisSource | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null);
  const [verifyCount, setVerifyCount] = useState(0);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const timeoutHandles = useRef<EventTimer[]>([]);
  const intervalHandles = useRef<ReturnType<typeof setInterval>[]>([]);
  const simulationStarted = useRef(false);
  const simulationElapsed = useRef(0);
  const analysisGeneration = useRef(0);

  useEffect(() => {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
    document.title = 'أثر ATHAR — عمليات المنصة';
  }, []);

  const clearTimers = () => {
    timeoutHandles.current.forEach(clearTimeout);
    intervalHandles.current.forEach(clearInterval);
    timeoutHandles.current = [];
    intervalHandles.current = [];
  };
  const later = (fn: () => void, delay: number) => {
    timeoutHandles.current.push(setTimeout(fn, delay));
  };
  const addTimeline = (text: string, at = simulationElapsed.current) => {
    setTimeline((items) => [...items, { time: incidentTime(at), text }]);
  };

  const runRootCauseAnalysis = async (runId: number) => {
    const controller = new AbortController();
    const timeoutHandle = window.setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incidentEvidence),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Analysis failed (${response.status})`);
      const result = parseIncidentAnalysis(await response.json());
      if (!result) throw new Error('Invalid incident analysis response');
      if (runId !== analysisGeneration.current) return;
      setAnalysis(result);
      setAnalysisSource('ai');
      setRootReady(true);
      setStep(5);
      setEvidenceVisible(true);
      addTimeline('اكتمل تحليل الذكاء الاصطناعي للأدلة', simulationElapsed.current);
    } catch {
      if (runId !== analysisGeneration.current) return;
      setAnalysis(fallbackAnalysis);
      setAnalysisSource('fallback');
      setRootReady(true);
      setStep(5);
      setEvidenceVisible(true);
      addTimeline('تعذر التحليل المباشر؛ عُرضت النتيجة الاحتياطية', simulationElapsed.current);
    } finally {
      window.clearTimeout(timeoutHandle);
    }
  };

  const startSimulation = () => {
    if (simulationStarted.current) return;
    simulationStarted.current = true;
    clearTimers();
    analysisGeneration.current += 1;
    const runId = analysisGeneration.current;
    simulationElapsed.current = 0;
    setPhase('deploying');
    setSeconds(0);
    setAlertVisible(false);
    setStep(-1);
    setRootReady(false);
    setAnalysis(null);
    setAnalysisSource(null);
    setEvidenceVisible(false);
    setDecision(null);
    setVerifyCount(0);
    setTimeline([{ time: '14:20:00', text: 'تم نشر النسخة v2 للخدمة orders-api' }]);
    setPods(initialPods.map((pod) => ({ ...pod, version: 'v2', name: pod.name.replace('7c9d8f6b4', '9f4bc8d7f') })));
    setChart(initialChart);

    const elapsed = { n: 0 };
    const ticker = setInterval(() => {
      elapsed.n += 1;
      simulationElapsed.current = elapsed.n;
      setSeconds(elapsed.n);
      if (elapsed.n % 2 === 0) {
        const memory = Math.min(318, 148 + elapsed.n * 5.2);
        setPods((current) => current.map((pod, i) => ({
          ...pod,
          memory: Math.round(memory + [0, -9, 7][i]),
          restarts: elapsed.n > 9 ? Math.min(8, Math.floor((elapsed.n - 7) / 4) + 1) : 0,
          status: Math.round(memory + [0, -9, 7][i]) >= 256
            ? elapsed.n >= 24 && i === 1 ? 'CrashLoopBackOff' : 'OOMKilled'
            : 'Running',
        })));
        setChart((current) => [...current.slice(-9), {
          time: `+${elapsed.n}s`,
          apiA: Math.min(318, 148 + elapsed.n * 5.2),
          apiB: Math.min(318, 140 + elapsed.n * 5.5),
          apiC: Math.min(318, 145 + elapsed.n * 5.1),
        }]);
      }
      if (elapsed.n >= 40) clearInterval(ticker);
    }, 1000);
    intervalHandles.current.push(ticker);

    later(() => addTimeline('بدأ استهلاك الذاكرة بالارتفاع بعد النشر', 5), 5000);
    later(() => addTimeline('أُنهيت الحاوية بعد تجاوز حد الذاكرة OOMKilled', 20), 20000);
    later(() => {
      setPhase('incident');
      setAlertVisible(true);
      setPods((current) => current.map((pod) => ({
        ...pod,
        status: pod.status === 'CrashLoopBackOff' ? pod.status : 'OOMKilled',
      })));
      addTimeline('أُطلق التنبيه PodRestartingFrequently بعد تكرار إعادة التشغيل', 23);
    }, 23000);

    [24, 27, 30, 33, 36].forEach((at, index) => {
      later(() => {
        setStep(index);
        addTimeline(stepNames[index], at);
        if (index === 1) setEvidenceVisible(true);
        if (index === 4) {
          setEvidenceVisible(true);
          void runRootCauseAnalysis(runId);
        }
      }, at * 1000);
    });
  };

  const reset = () => {
    clearTimers();
    analysisGeneration.current += 1;
    simulationStarted.current = false;
    simulationElapsed.current = 0;
    setPhase('healthy');
    setPods(initialPods);
    setChart(initialChart);
    setSeconds(0);
    setAlertVisible(false);
    setStep(-1);
    setEvidenceTab('Metrics');
    setEvidenceVisible(false);
    setRootReady(false);
    setAnalysis(null);
    setAnalysisSource(null);
    setDecision(null);
    setVerifyCount(0);
    setTimeline([]);
  };

  const approveRollback = () => {
    if (decision || phase !== 'incident') return;
    intervalHandles.current.forEach(clearInterval);
    intervalHandles.current = [];
    setDecision('approved');
    addTimeline('وافق المشغّل على Rollback إلى revision 4');
    setPods((current) => current.map((pod, i) => ({ ...pod, status: 'Terminating', recovering: true, memory: pod.memory })));
    addTimeline('kubectl rollout undo deployment/orders-api');
    [0, 1, 2].forEach((index) => {
      later(() => {
        setPods((current) => current.map((pod, i) => i === index
          ? { ...initialPods[i], status: 'Running', recovering: true }
          : pod));
        setChart((current) => [...current, {
          time: `rollback-${index + 1}`,
          apiA: index === 0 ? 142 : 230 - index * 18,
          apiB: index <= 1 ? 140 : 186,
          apiC: index <= 2 ? 143 : 190,
        }]);
        setVerifyCount(index + 1);
        addTimeline(`Pod ${index + 1}/3 عاد إلى v1 — Running`, seconds + index * 2);
        if (index === 2) {
          later(() => {
            setPods(initialPods);
            setChart((current) => [...current, { time: 'stable', apiA: 141, apiB: 138, apiC: 143 }]);
            setPhase('resolved');
            setVerifyCount(4);
            addTimeline('التحقق اكتمل — الحادثة محلولة', seconds + 9);
          }, 1800);
        }
      }, (index + 1) * 2300);
    });
  };

  const rejectRollback = () => {
    if (decision || phase !== 'incident') return;
    setDecision('rejected');
    addTimeline('رفض المشغّل إجراء Rollback — الحادثة ما زالت نشطة');
  };

  const badgePhase = phase === 'deploying' ? 'healthy' : phase;
  const statusLabel = badgePhase === 'healthy' ? 'سليم' : badgePhase === 'incident' ? 'حادث' : 'مستقر';
  const maxMem = 340;

  return (
    <main className="app-shell" dir="rtl">
      <header className="topbar">
        <div className="brand" data-testid="brand-athar">
          <div className="brand-mark" aria-hidden="true">أ</div>
          <div><div className="brand-name">ATHAR</div><div className="brand-sub">أَثَر · الاستجابة للحوادث</div></div>
        </div>
        <div className="header-actions">
          <div className="cluster-pill" data-testid="text-cluster"><span className="cluster-dot" /> <bdi dir="ltr">prod-cluster</bdi></div>
          <div className={`status-pill ${badgePhase}`} data-testid="status-incident"><span className="cluster-dot" style={{ background: badgePhase === 'incident' ? '#f2766e' : badgePhase === 'resolved' ? '#83b9f4' : undefined }} />{statusLabel}</div>
          <button className="header-btn primary" data-testid="button-simulate-incident" onClick={startSimulation} disabled={phase !== 'healthy'}>
            <Zap size={14} /> محاكاة حادثة
          </button>
          <button className="header-btn reset" data-testid="button-reset" onClick={reset}>
            <RotateCcw size={14} /> إعادة ضبط
          </button>
        </div>
      </header>

      <div className="container">
        <section className="page-intro">
          <div>
            <div className="eyebrow"><Activity size={13} /> تشغيل المنصة / الخدمات النشطة</div>
            <h1 className="page-title">مركز مراقبة الخدمات</h1>
            <p className="page-desc">مراقبة موارد الخدمة واستجابة أثر للحوادث — بيئة محاكاة محلية</p>
          </div>
          <div className="clock-block"><span>العنقود / النطاق</span><strong><bdi dir="ltr">prod-cluster / prod</bdi></strong></div>
        </section>

        {phase === 'incident' && alertVisible && <section className="incident-banner" role="alert" data-testid="alert-pod-restarting">
          <div className="alert-icon"><AlertTriangle size={16} /></div>
          <div className="alert-copy">
            <b className="alert-title">تنبيه تكرار إعادة تشغيل الحاوية</b>
            <span>الخدمة <bdi dir="ltr">orders-api</bdi> — أُطلق التنبيه <bdi dir="ltr">PodRestartingFrequently</bdi> بعد أكثر من <bdi dir="ltr">3</bdi> إعادات خلال <bdi dir="ltr">10m</bdi>، مع تجاوز حد الذاكرة <bdi dir="ltr">256Mi</bdi>.</span>
          </div>
          <bdi className="sim-time" dir="ltr" data-testid="text-simulation-time">T+{String(seconds).padStart(2, '0')}s</bdi>
        </section>}

        <div className="layout">
          <section className="main-column">
            <section className="panel" aria-label="حالة الخدمة">
              <div className="panel-head">
                <div className="panel-heading"><Server size={16} /><span>حالة <bdi dir="ltr">Pods</bdi></span></div>
                <div className="service-chip"><span className="cluster-dot" style={{ width: 6, height: 6 }} /><bdi dir="ltr">orders-api / {pods[0].version}</bdi></div>
              </div>
              <div className="pod-grid">
                {pods.map((pod, index) => {
                  const isBad = phase === 'incident';
                  const isRecovering = phase === 'resolved' || (!!pod.recovering && phase === 'incident');
                  const statusClass = isBad ? (pod.status === 'Running' ? '' : 'bad') : isRecovering ? 'recovery' : '';
                  return <article className={`pod-card ${isBad && pod.status !== 'Running' ? 'unhealthy' : ''} ${isRecovering && phase !== 'resolved' ? 'recovering' : ''}`} key={pod.name} data-testid={`card-pod-${index + 1}`}>
                    <div className="pod-top">
                      <bdi className="pod-name" dir="ltr" title={pod.name}>{pod.name}</bdi>
                      <span className={`pod-state ${statusClass}`}><i /><bdi dir="ltr">{pod.status}</bdi></span>
                    </div>
                    <div className="pod-meta"><span>الإصدار</span><bdi dir="ltr">{pod.version}</bdi><span>الإعادات</span><bdi className={pod.restarts > 0 ? 'memory-value danger' : 'memory-value'} dir="ltr">{pod.restarts}</bdi></div>
                    <div className="memory-row"><span>استخدام الذاكرة <bdi dir="ltr">/ 256Mi</bdi></span><bdi className={`memory-value ${pod.memory >= 256 ? 'danger' : ''}`} dir="ltr">{pod.memory}Mi</bdi></div>
                    <div className="memory-track"><div className={`memory-fill ${pod.memory >= 256 ? 'hot' : isRecovering ? 'safe' : ''}`} style={{ width: `${Math.min(100, pod.memory / 256 * 100)}%` }} /></div>
                    <div className="card-foot"><span><bdi dir="ltr">Pod {index + 1}</bdi> · النطاق <bdi dir="ltr">prod</bdi></span><bdi dir="ltr">{pod.status === 'OOMKilled' ? 'exit 137' : pod.status === 'CrashLoopBackOff' ? 'back-off' : 'limit 256Mi'}</bdi></div>
                  </article>;
                })}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div className="panel-heading"><Activity size={16} /><span>استهلاك الذاكرة</span></div>
                <span className="panel-kicker">الذاكرة <bdi dir="ltr">MiB</bdi> · آخر 10 دقائق</span>
              </div>
              <div className="chart-wrap" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chart} margin={{ top: 10, right: 12, bottom: 12, left: 0 }}>
                    <CartesianGrid stroke="#29363a" strokeDasharray="3 5" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: '#788783', fontSize: 9, fontFamily: 'monospace' }} axisLine={{ stroke: '#344247' }} tickLine={false} minTickGap={22} label={{ value: 'الوقت', position: 'insideBottomRight', offset: -2, fill: '#788783', fontSize: 9 }} />
                    <YAxis domain={[0, maxMem]} ticks={[0, 64, 128, 192, 256, 320]} tick={{ fill: '#788783', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} label={{ value: 'الذاكرة (MiB)', angle: -90, position: 'insideLeft', fill: '#788783', fontSize: 9 }} />
                    <Tooltip contentStyle={{ background: '#172125', border: '1px solid #344448', borderRadius: 7, color: '#dae5e0', fontSize: 10 }} />
                    <ReferenceLine y={256} stroke="#e96f67" strokeDasharray="5 4" label={{ value: 'حد 256Mi', fill: '#ef837a', position: 'insideTopRight', fontSize: 9 }} />
                    <Line type="monotone" dataKey="apiA" name="Pod · 1" stroke="#5bd0a2" strokeWidth={2} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="apiB" name="Pod · 2" stroke="#70aee8" strokeWidth={1.6} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="apiC" name="Pod · 3" stroke="#d5b35f" strokeWidth={1.6} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-legend">
                <span className="legend-item"><i className="legend-line" /><bdi dir="ltr">orders-api · Pod 1</bdi></span>
                <span className="legend-item"><i className="legend-line" style={{ background: '#70aee8' }} /><bdi dir="ltr">Pod 2</bdi></span>
                <span className="legend-item"><i className="legend-line" style={{ background: '#d5b35f' }} /><bdi dir="ltr">Pod 3</bdi></span>
                <span className="legend-item"><i className="legend-dash" />حد <bdi dir="ltr">256Mi</bdi></span>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head"><div className="panel-heading"><Database size={16} /><span>الأدلة التشخيصية</span></div><span className="panel-kicker">{evidenceVisible ? 'ملخص الحادثة' : 'بانتظار الحادثة'}</span></div>
              {!evidenceVisible ? <div className="evidence-placeholder"><Cloud size={20} /><span>ستظهر الأدلة عند بدء التحقيق<br /><span><bdi dir="ltr">Prometheus · Kubernetes</bdi> · سجل النشر</span></span></div> : <>
                <div className="evidence-tabs" role="tablist" aria-label="مصادر الأدلة">
                  {evidenceTabs.map((tab) => <button key={tab.id} role="tab" aria-selected={evidenceTab === tab.id} className={`tab-btn ${evidenceTab === tab.id ? 'selected' : ''}`} data-testid={`tab-evidence-${tab.id.toLowerCase()}`} onClick={() => setEvidenceTab(tab.id)}>{tab.label}</button>)}
                </div>
                <div className="evidence-content" role="tabpanel" data-testid={`panel-evidence-${evidenceTab.toLowerCase()}`}>
                  {evidenceTab === 'Metrics' && <div className="log-lines" dir="ltr"><div className="dim-line"># Prometheus · container_memory_working_set_bytes</div><div>14:31:52  pod/orders-api-9f4bc8d7f-k2m4p  <span className="bad-line">268Mi ↑ limit 256Mi</span></div><div>14:31:56  pod/orders-api-9f4bc8d7f-r8x1n  <span className="bad-line">281Mi ↑ limit 256Mi</span></div><div>baseline  v1 (10m avg)  140.6Mi  stable</div></div>}
                  {evidenceTab === 'Logs' && <div className="log-lines" dir="ltr"><div className="dim-line">previous container · orders-api · v2</div><div>14:31:40 INFO  processing order batch size=128</div><div>14:31:47 WARN  heap usage reached 94% (241Mi)</div><div>14:31:53 ERROR allocation failed: memory limit exceeded</div><div className="bad-line">14:31:54 Killed</div></div>}
                  {evidenceTab === 'Events' && <><div className="event-row"><i className="event-bullet" /><div><bdi dir="ltr">OOMKilled</bdi> — تجاوزت الحاوية حد الذاكرة<small dir="ltr">14:31:54 · Warning · orders-api-9f4bc8d7f-k2m4p</small></div></div><div className="event-row"><i className="event-bullet" /><div>تأخر إعادة تشغيل الحاوية بعد فشلها<small dir="ltr">14:31:59 · Warning · kubelet / prod</small></div></div></>}
                  {evidenceTab === 'Deployments' && <><div className="deploy-row"><bdi className="deploy-rev" dir="ltr">revision 5</bdi><div><bdi dir="ltr">orders-api v2</bdi><small dir="ltr">14:20:00 · الحالة: الحالية</small></div><span className="deploy-label" style={{ color: '#ef827a' }}>نشط</span></div><div className="deploy-row"><bdi className="deploy-rev" dir="ltr">revision 4</bdi><div><bdi dir="ltr">orders-api v1</bdi><small dir="ltr">13:48:22 · الحالة: مستقرة</small></div><span className="deploy-label">مستقر</span></div></>}
                </div>
              </>}
            </section>
          </section>

          <aside className="side-column">
            <section className="panel">
              <div className="panel-head"><div className="panel-heading"><Cpu size={16} /><span>وكيل أثر</span></div><span className="service-chip agent-chip"><span className="cluster-dot" />{phase === 'healthy' ? 'جاهز' : phase === 'resolved' ? 'تم التحقق' : 'قيد التحقيق'}</span></div>
              <div className="agent-progress">{phase === 'healthy' ? 'الوكيل بانتظار الحادثة' : phase === 'deploying' ? 'محاكاة الحادثة قيد التشغيل' : `تحقيق الحادثة · ${Math.max(0, Math.min(step, 5))} من 5`}</div>
              <ol className="steps" aria-label="خطوات التحقيق">
                {stepNames.map((name, index) => {
                  const done = step > index;
                  const active = phase !== 'healthy' && phase !== 'resolved' && step === index;
                  return <li className={`step ${done ? 'done' : ''} ${active ? 'active' : ''}`} key={name} data-testid={`step-investigation-${index + 1}`}>
                    <span className="step-icon">{done ? <Check size={12} /> : active ? <span className="spinner" /> : <Circle size={9} />}</span><span>{mixedText(name)}</span>
                  </li>;
                })}
              </ol>
              {rootReady && phase === 'incident' && <div className="root-cause" data-testid="panel-root-cause">
                <div className="root-title">
                  <AlertTriangle size={14} />
                  <span>السبب الجذري</span>
                  {analysisSource && <span className={`analysis-badge ${analysisSource}`} data-testid="text-analysis-source">{analysisSource === 'ai' ? 'تحليل بالذكاء الاصطناعي' : 'نتيجة احتياطية'}</span>}
                </div>
                {analysis && <>
                  <p>{mixedText(analysis.root_cause_ar)}</p>
                  <div className="confidence-row"><span>الثقة</span><div className="confidence-track"><i style={{ width: `${analysis.confidence}%` }} /></div><bdi dir="ltr" style={{ color: '#e6c777' }}>{analysis.confidence}%</bdi></div>
                  <div className="evidence-list">{analysis.evidence_ar.map((item, index) => <span className="evidence-tag" key={`${item}-${index}`}>{mixedText(item)}</span>)}</div>
                  <div className="analysis-recommendation" data-testid="text-analysis-recommendation">
                    <div><span>توصية التحليل:</span> <strong>{actionLabels[analysis.action]}</strong></div>
                    <bdi dir="ltr">{analysis.action_target}</bdi>
                  </div>
                  <p className="analysis-explanation">{mixedText(analysis.explanation_ar)}</p>
                </>}
              </div>}
              {rootReady && phase === 'incident' && <div className="action-box" data-testid="panel-rollback-action">
                <div className="action-title"><ArrowDownToLine size={14} /> إجراء متاح للموافقة <bdi dir="ltr">· Rollback</bdi></div>
                <div style={{ fontSize: 10, color: '#91a29b', marginBottom: 9 }}>{mixedText('تراجع محاكى إلى revision 4 للخدمة orders-api (v1)')}</div>
                <div className="command">kubectl rollout undo deployment/orders-api</div>
                <div className="checklist">
                  {['إجراء ضمن القائمة المسموحة', 'النطاق prod فقط', 'Dry-run ناجح', 'قابل للتراجع'].map((item) => <span className="check-item" key={item}><CheckCircle2 size={12} />{mixedText(item)}</span>)}
                </div>
                {decision === null ? <div className="decision-row">
                  <button className="header-btn approve" data-testid="button-approve-rollback" onClick={approveRollback}><Check size={13} /> موافقة وتنفيذ</button>
                  <button className="header-btn reject" data-testid="button-reject-rollback" onClick={rejectRollback}><X size={13} /> رفض</button>
                </div> : decision === 'rejected' ? <div className="decision-note rejected" data-testid="text-rollback-rejected"><XCircle size={13} style={{ verticalAlign: 'middle', marginLeft: 5 }} /> تم رفض الإجراء — الحادثة ما زالت نشطة، ولم يتم تنفيذ <bdi dir="ltr">Rollback</bdi>.</div> : <div className="decision-note approved" data-testid="text-rollback-approved"><CheckCircle2 size={13} style={{ verticalAlign: 'middle', marginLeft: 5 }} /> تمت الموافقة — يجري تنفيذ <bdi dir="ltr">Rollback</bdi> والتحقق من الخدمة.</div>}
              </div>}
              {decision === 'approved' && <div className="command-run" data-testid="text-executed-command">$ kubectl rollout undo deployment/orders-api</div>}
              {decision === 'approved' && <div className="verification" data-testid="panel-verification">
                <div className="verification-title"><ShieldCheck size={15} /> التحقق بعد <bdi dir="ltr">Rollback</bdi></div>
                <div className="verify-list">{verifyNames.map((name, index) => <span className="verify-item" key={name}>{index < verifyCount ? <CheckCircle2 size={12} /> : <Circle size={12} color="#596a67" />}{mixedText(name)}</span>)}</div>
              </div>}
              {phase === 'resolved' && <div className="resolved-strip" data-testid="panel-resolved">
                <div><strong>تم حل الحادثة</strong><span>كل المؤشرات عادت إلى وضعها الطبيعي</span></div>
                <div className="mttr"><Clock3 size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />زمن الاستعادة <bdi dir="ltr">~4</bdi> دقائق<br /><span style={{ color: '#788a98' }}>يدويًا <bdi dir="ltr">~45</bdi> دقيقة</span></div>
              </div>}
            </section>
            <section className="panel">
              <div className="panel-head"><div className="panel-heading"><Clock3 size={16} /><span>تسلسل أحداث الحادثة</span></div><span className="panel-kicker">الخط الزمني</span></div>
              {timeline.length === 0 ? <div className="empty-timeline">لا توجد أحداث — النظام يعمل بشكل طبيعي</div> : <div className="timeline" data-testid="list-incident-timeline">
                {timeline.map((item, index) => <div className="timeline-row" key={`${item.time}-${index}`}><i className="timeline-dot" /><bdi className="timeline-time" dir="ltr">{item.time}</bdi><span>{mixedText(item.text)}</span></div>)}
              </div>}
            </section>
            <div className="incident-intro"><Terminal size={12} style={{ verticalAlign: 'middle', marginLeft: 5 }} />محاكاة محلية · لا يوجد اتصال فعلي بالعنقود</div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default App;