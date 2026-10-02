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
  { time: 'الآن', apiA: 141, apiB: 138, apiC: 143 },
];
const stepNames = [
  'جمع Metrics من Prometheus',
  'جمع Logs (previous container)',
  'جمع Kubernetes Events',
  'فحص سجل النشر',
  'تحليل الأدلة وتحديد السبب الجذري',
];
const verifyNames = ['كل الـ Pods جاهزة', 'الإعادات متوقفة', 'الذاكرة طبيعية', 'نسبة الأخطاء طبيعية'];

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
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null);
  const [verifyCount, setVerifyCount] = useState(0);
  const [timeline, setTimeline] = useState<{ time: string; text: string }[]>([]);
  const timeoutHandles = useRef<EventTimer[]>([]);
  const intervalHandles = useRef<ReturnType<typeof setInterval>[]>([]);
  const simulationStarted = useRef(false);

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
  const addTimeline = (text: string, at?: number) => {
    const m = at ?? seconds;
    setTimeline((items) => [...items, { time: `14:${String(32 + Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, text }]);
  };

  const startSimulation = () => {
    if (simulationStarted.current) return;
    simulationStarted.current = true;
    clearTimers();
    setPhase('deploying');
    setSeconds(0);
    setAlertVisible(false);
    setStep(0);
    setRootReady(false);
    setEvidenceVisible(false);
    setDecision(null);
    setVerifyCount(0);
    setTimeline([{ time: '14:32:00', text: 'orders-api deployment updated v1 → v2 by ahmed' }]);
    setPods(initialPods.map((pod) => ({ ...pod, version: 'v2', name: pod.name.replace('7c9d8f6b4', '9f4bc8d7f') })));
    setChart(initialChart);

    const elapsed = { n: 0 };
    const ticker = setInterval(() => {
      elapsed.n += 1;
      setSeconds(elapsed.n);
      if (elapsed.n % 2 === 0) {
        const memory = Math.min(318, 148 + elapsed.n * 5.2);
        setPods((current) => current.map((pod, i) => ({
          ...pod,
          memory: Math.round(memory + [0, -9, 7][i]),
          restarts: elapsed.n > 9 ? Math.min(8, Math.floor((elapsed.n - 7) / 4) + 1) : 0,
          status: elapsed.n > 11 && i === 1 ? 'CrashLoopBackOff' : elapsed.n > 8 ? 'OOMKilled' : 'Running',
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

    // Investigator phases are staggered over the 40-second mock incident replay.
    [7, 14, 21, 28, 35].forEach((at, index) => {
      later(() => {
        setStep(index + 1);
        addTimeline(stepNames[index], at);
        if (index === 1) setEvidenceVisible(true);
        if (index === 4) {
          setRootReady(true);
          setEvidenceVisible(true);
          addTimeline('تم تحديد السبب الجذري بثقة 87%', at);
        }
      }, at * 1000);
    });
    later(() => {
      setPhase('incident');
      setAlertVisible(true);
      setPods((current) => current.map((pod) => ({ ...pod, status: pod.status === 'CrashLoopBackOff' ? pod.status : 'OOMKilled' })));
      addTimeline('تنبيه PodRestartingFrequently — restarts > 3 in 10m', 23);
    }, 23000);
  };

  const reset = () => {
    clearTimers();
    simulationStarted.current = false;
    setPhase('healthy');
    setPods(initialPods);
    setChart(initialChart);
    setSeconds(0);
    setAlertVisible(false);
    setStep(-1);
    setEvidenceTab('Metrics');
    setEvidenceVisible(false);
    setRootReady(false);
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
    addTimeline('رفض المشغّل Rollback — الحادثة ما زالت نشطة');
  };

  const badgePhase = phase === 'deploying' ? 'healthy' : phase;
  const statusLabel = badgePhase === 'healthy' ? 'Healthy' : badgePhase === 'incident' ? 'Incident' : 'Resolved';
  const maxMem = 340;

  return (
    <main className="app-shell" dir="rtl">
      <header className="topbar">
        <div className="brand" data-testid="brand-athar">
          <div className="brand-mark" aria-hidden="true">أ</div>
          <div><div className="brand-name">ATHAR</div><div className="brand-sub">أَثَر · INCIDENT RESPONSE</div></div>
        </div>
        <div className="header-actions">
          <div className="cluster-pill" data-testid="text-cluster"><span className="cluster-dot" /> <span dir="ltr">prod-cluster</span></div>
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
            <div className="eyebrow"><Activity size={13} /> PLATFORM OPERATIONS / LIVE WORKLOAD</div>
            <h1 className="page-title">مركز مراقبة الخدمات</h1>
            <p className="page-desc">مراقبة موارد الخدمة واستجابة أثر للحوادث — بيئة محاكاة محلية</p>
          </div>
          <div className="clock-block">CLUSTER / NAMESPACE<strong>prod-cluster <span style={{ color: '#53625f' }}>/</span> prod</strong></div>
        </section>

        {phase === 'incident' && alertVisible && <section className="incident-banner" role="alert" data-testid="alert-pod-restarting">
          <div className="alert-icon"><AlertTriangle size={16} /></div>
          <div className="alert-copy"><b>PodRestartingFrequently</b><span dir="ltr">orders-api</span> — restarts &gt; 3 in 10m · تجاوز حد الذاكرة <span dir="ltr">256Mi</span></div>
          <span className="sim-time" data-testid="text-simulation-time">T+{String(seconds).padStart(2, '0')}s</span>
        </section>}

        <div className="layout">
          <section className="main-column">
            <section className="panel" aria-label="حالة الخدمة">
              <div className="panel-head">
                <div className="panel-heading"><Server size={16} /><span>حالة الـ Pods</span></div>
                <div className="service-chip"><span className="cluster-dot" style={{ width: 6, height: 6 }} />orders-api <span style={{ color: '#64726f' }}>/</span> {pods[0].version}</div>
              </div>
              <div className="pod-grid">
                {pods.map((pod, index) => {
                  const isBad = phase === 'incident';
                  const isRecovering = phase === 'resolved' || (!!pod.recovering && phase === 'incident');
                  const statusClass = isBad ? (pod.status === 'Running' ? '' : 'bad') : isRecovering ? 'recovery' : '';
                  return <article className={`pod-card ${isBad && pod.status !== 'Running' ? 'unhealthy' : ''} ${isRecovering && phase !== 'resolved' ? 'recovering' : ''}`} key={pod.name} data-testid={`card-pod-${index + 1}`}>
                    <div className="pod-top">
                      <span className="pod-name">{pod.name}</span>
                      <span className={`pod-state ${statusClass}`}><i />{pod.status}</span>
                    </div>
                    <div className="pod-meta"><span>VERSION</span><b>{pod.version}</b><span>RESTARTS</span><b className={pod.restarts > 0 ? 'memory-value danger' : ''}>{pod.restarts}</b></div>
                    <div className="memory-row"><span>استخدام الذاكرة <span dir="ltr">/ 256Mi</span></span><span className={`memory-value ${pod.memory >= 256 ? 'danger' : ''}`}>{pod.memory}Mi</span></div>
                    <div className="memory-track"><div className={`memory-fill ${pod.memory >= 256 ? 'hot' : isRecovering ? 'safe' : ''}`} style={{ width: `${Math.min(100, pod.memory / 256 * 100)}%` }} /></div>
                    <div className="card-foot"><span>Pod {index + 1} <span dir="ltr">· namespace: prod</span></span><span dir="ltr">{pod.status === 'OOMKilled' ? 'exit 137' : pod.status === 'CrashLoopBackOff' ? 'back-off' : 'limit 256Mi'}</span></div>
                  </article>;
                })}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div className="panel-heading"><Activity size={16} /><span>استهلاك الذاكرة</span></div>
                <span className="panel-kicker">MEMORY / MiB · LAST 10 MIN</span>
              </div>
              <div className="chart-wrap" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chart} margin={{ top: 10, right: 12, bottom: 0, left: -14 }}>
                    <CartesianGrid stroke="#29363a" strokeDasharray="3 5" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: '#788783', fontSize: 9, fontFamily: 'monospace' }} axisLine={{ stroke: '#344247' }} tickLine={false} minTickGap={22} />
                    <YAxis domain={[0, maxMem]} ticks={[0, 64, 128, 192, 256, 320]} tick={{ fill: '#788783', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#172125', border: '1px solid #344448', borderRadius: 7, color: '#dae5e0', fontSize: 10 }} />
                    <ReferenceLine y={256} stroke="#e96f67" strokeDasharray="5 4" label={{ value: 'LIMIT 256Mi', fill: '#ef837a', position: 'insideTopRight', fontSize: 9 }} />
                    <Line type="monotone" dataKey="apiA" name="pod · 1" stroke="#5bd0a2" strokeWidth={2} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="apiB" name="pod · 2" stroke="#70aee8" strokeWidth={1.6} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="apiC" name="pod · 3" stroke="#d5b35f" strokeWidth={1.6} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-legend"><span className="legend-item"><i className="legend-line" />orders-api · pod 1</span><span className="legend-item"><i className="legend-line" style={{ background: '#70aee8' }} />pod 2</span><span className="legend-item"><i className="legend-line" style={{ background: '#d5b35f' }} />pod 3</span><span className="legend-item"><i className="legend-dash" />حد 256Mi</span></div>
            </section>

            <section className="panel">
              <div className="panel-head"><div className="panel-heading"><Database size={16} /><span>الأدلة التشخيصية</span></div><span className="panel-kicker">{evidenceVisible ? 'INCIDENT SNAPSHOT' : 'AWAITING INCIDENT'}</span></div>
              {!evidenceVisible ? <div className="evidence-placeholder"><Cloud size={20} /><span>ستظهر الأدلة عند بدء التحقيق<br /><span dir="ltr">Prometheus · Kubernetes · Deployment history</span></span></div> : <>
                <div className="evidence-tabs" role="tablist" aria-label="مصادر الأدلة">
                  {['Metrics', 'Logs', 'Events', 'Deployments'].map((tab) => <button key={tab} role="tab" aria-selected={evidenceTab === tab} className={`tab-btn ${evidenceTab === tab ? 'selected' : ''}`} data-testid={`tab-evidence-${tab.toLowerCase()}`} onClick={() => setEvidenceTab(tab)}>{tab}</button>)}
                </div>
                <div className="evidence-content" role="tabpanel" data-testid={`panel-evidence-${evidenceTab.toLowerCase()}`}>
                  {evidenceTab === 'Metrics' && <div className="log-lines"><div className="dim-line"># Prometheus · container_memory_working_set_bytes</div><div>14:32:12  pod/orders-api-9f4bc8d7f-k2m4p  <span className="bad-line">268Mi ↑ limit 256Mi</span></div><div>14:32:18  pod/orders-api-9f4bc8d7f-r8x1n  <span className="bad-line">281Mi ↑ limit 256Mi</span></div><div>baseline  v1 (10m avg)  140.6Mi  stable</div></div>}
                  {evidenceTab === 'Logs' && <div className="log-lines"><div className="dim-line">previous container · orders-api · v2</div><div>14:31:54 INFO  processing order batch size=128</div><div>14:32:07 WARN  heap usage reached 94% (241Mi)</div><div>14:32:12 ERROR allocation failed: memory limit exceeded</div><div className="bad-line">14:32:13 Killed</div></div>}
                  {evidenceTab === 'Events' && <><div className="event-row"><i className="event-bullet" /><div><span dir="ltr">OOMKilled</span> — Container exceeded memory limit<small>14:32:13 · Warning · orders-api-9f4bc8d7f-k2m4p</small></div></div><div className="event-row"><i className="event-bullet" /><div><span dir="ltr">Back-off restarting failed container</span><small>14:32:18 · Warning · kubelet / prod</small></div></div></>}
                  {evidenceTab === 'Deployments' && <><div className="deploy-row"><span className="deploy-rev">rev 5</span><div><span dir="ltr">orders-api v2</span><small>14:20:00 · ahmed · current</small></div><span className="deploy-label" style={{ color: '#ef827a' }}>نشط</span></div><div className="deploy-row"><span className="deploy-rev">rev 4</span><div><span dir="ltr">orders-api v1</span><small>13:48:22 · stable</small></div><span className="deploy-label">مستقر</span></div></>}
                </div>
              </>}
            </section>
          </section>

          <aside className="side-column">
            <section className="panel">
              <div className="panel-head"><div className="panel-heading"><Cpu size={16} /><span>وكيل أثر</span></div><span className="service-chip"><span className="cluster-dot" />{phase === 'healthy' ? 'IDLE' : phase === 'resolved' ? 'VERIFIED' : 'INVESTIGATING'}</span></div>
              <div className="agent-progress">{phase === 'healthy' ? 'AGENT / STANDING BY' : `INCIDENT ANALYSIS / ${Math.min(step, 5)} OF 5`}</div>
              <ol className="steps" aria-label="خطوات التحقيق">
                {stepNames.map((name, index) => {
                  const done = step > index;
                  const active = phase !== 'healthy' && phase !== 'resolved' && step === index;
                  return <li className={`step ${done ? 'done' : ''} ${active ? 'active' : ''}`} key={name} data-testid={`step-investigation-${index + 1}`}>
                    <span className="step-icon">{done ? <Check size={12} /> : active ? <span className="spinner" /> : <Circle size={9} />}</span><span>{name}</span>
                  </li>;
                })}
              </ol>
              {rootReady && phase === 'incident' && <div className="root-cause" data-testid="panel-root-cause">
                <div className="root-title"><AlertTriangle size={14} /> السبب الجذري</div>
                <p>تسريب ذاكرة في النسخة <span dir="ltr">v2</span>: بدأت حالات <span dir="ltr">OOMKilled</span> بعد 12 دقيقة من النشر، <span dir="ltr">v1</span> كانت مستقرة عند <span dir="ltr">~140Mi</span>.</p>
                <div className="confidence-row"><span>الثقة</span><div className="confidence-track"><i /></div><b dir="ltr" style={{ color: '#e6c777' }}>87%</b></div>
                <div className="evidence-list"><span className="evidence-tag">memory +112Mi</span><span className="evidence-tag">v1 baseline 140Mi</span><span className="evidence-tag">OOMKilled × 3</span><span className="evidence-tag">revision 5 / v2</span></div>
              </div>}
              {rootReady && phase === 'incident' && <div className="action-box" data-testid="panel-rollback-action">
                <div className="action-title"><ArrowDownToLine size={14} /> إجراء مقترح <span dir="ltr">· Rollback</span></div>
                <div style={{ fontSize: 10, color: '#91a29b', marginBottom: 9 }}>Rollback orders-api إلى revision 4 (v1)</div>
                <div className="command">kubectl rollout undo deployment/orders-api</div>
                <div className="checklist">
                  {['إجراء ضمن القائمة المسموحة', 'namespace: prod فقط', 'Dry-run ناجح', 'قابل للتراجع'].map((item) => <span className="check-item" key={item}><CheckCircle2 size={12} />{item}</span>)}
                </div>
                {decision === null ? <div className="decision-row">
                  <button className="header-btn approve" data-testid="button-approve-rollback" onClick={approveRollback}><Check size={13} /> موافقة وتنفيذ</button>
                  <button className="header-btn reject" data-testid="button-reject-rollback" onClick={rejectRollback}><X size={13} /> رفض</button>
                </div> : decision === 'rejected' ? <div className="decision-note rejected" data-testid="text-rollback-rejected"><XCircle size={13} style={{ verticalAlign: 'middle', marginLeft: 5 }} /> تم رفض الإجراء — الحادثة ما زالت نشطة، ولم يتم تنفيذ Rollback.</div> : <div className="decision-note approved" data-testid="text-rollback-approved"><CheckCircle2 size={13} style={{ verticalAlign: 'middle', marginLeft: 5 }} /> تمت الموافقة — يجري تنفيذ Rollback والتحقق من الخدمة.</div>}
              </div>}
              {decision === 'approved' && <div className="command-run" data-testid="text-executed-command">$ kubectl rollout undo deployment/orders-api</div>}
              {decision === 'approved' && <div className="verification" data-testid="panel-verification">
                <div className="verification-title"><ShieldCheck size={15} /> التحقق بعد Rollback</div>
                <div className="verify-list">{verifyNames.map((name, index) => <span className="verify-item" key={name}>{index < verifyCount ? <CheckCircle2 size={12} /> : <Circle size={12} color="#596a67" />}{name}</span>)}</div>
              </div>}
              {phase === 'resolved' && <div className="resolved-strip" data-testid="panel-resolved">
                <div><strong>تم حل الحادثة</strong><span>كل المؤشرات عادت إلى وضعها الطبيعي</span></div>
                <div className="mttr"><Clock3 size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />MTTR <b>~4 min</b><br /><span style={{ color: '#788a98' }}>manual ~45 min</span></div>
              </div>}
            </section>
            <section className="panel">
              <div className="panel-head"><div className="panel-heading"><Clock3 size={16} /><span>الخط الزمني للحادثة</span></div><span className="panel-kicker">TIMELINE</span></div>
              {timeline.length === 0 ? <div className="empty-timeline">لا توجد أحداث — النظام يعمل بشكل طبيعي</div> : <div className="timeline" data-testid="list-incident-timeline">
                {timeline.map((item, index) => <div className="timeline-row" key={`${item.time}-${index}`}><i className="timeline-dot" /><span className="timeline-time">{item.time}</span><span>{item.text}</span></div>)}
              </div>}
            </section>
            <div className="incident-intro"><Terminal size={12} style={{ verticalAlign: 'middle', marginLeft: 5 }} />LOCAL SIMULATION · NO CLUSTER CONNECTION</div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default App;