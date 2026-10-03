<div align="center">

# ATHAR · أثر

### AI Incident Agent for Kubernetes

**From "something is wrong" to "here's why, here's the fix, approve?" in seconds.**

[Live Demo]( $$ )

</div>

---

## نبذة

**أثر** وكيل ذكي يساعد مهندسي DevOps و SRE وقت الأعطال. لما يوصل تنبيه، يجمع الأدلة من Metrics و Logs و Kubernetes Events و Deployment History في مكان واحد. بعدها يتتبّع العلاقات بين الخدمات عشان يوصل لمصدر المشكلة الحقيقي، مو بس الخدمة اللي طلع عليها التنبيه. ثم يقترح إجراءً آمنًا، وينتظر موافقة المهندس، ويتحقق إن الخدمة رجعت طبيعية.

> **ليش "أثر"؟** كل عطل يترك أثر. ونحن نتتبّع هذا الأثر لين نوصل لمصدره.

---

## 🚨 The Problem

When an incident hits production, the alert tells engineers **that** something is wrong, but not **why**.

- **The alerting service is often not the cause.** In microservices, Payment Service may fail because a service it depends on broke.
- **Evidence is scattered.** Engineers jump between Metrics, Logs, Kubernetes Events, Pods, Deployment History and service dependencies.
- **Correlation is manual.** Matching timestamps across tools takes time, and that raises **MTTR** (Mean Time To Resolution).
- **Full automation isn't trusted.** Teams won't let a black box change production on its own.

```
Traditional:
Alert → Engineer → Manual Investigation → Search Multiple Systems → Root Cause → Fix → Verification
```

---

## 💡 The Solution

ATHAR is an **intelligent layer on top of existing DevOps tools**, not a replacement for them.

```
ATHAR:
Alert → Automatic Evidence Collection → AI Root Cause Analysis → Engineer Approval → Safe Remediation → Automatic Verification
```

| # | Stage | What ATHAR does |
|---|---|---|
| 01 | **Alert Detection** | Receives the incident alert from Prometheus |
| 02 | **Evidence Retrieval** | Collects Metrics, Logs, Events and Deployment History automatically |
| 03 | **AI Analysis** | Correlates the evidence across services and identifies the root cause |
| 04 | **Response** | Recommends the safest fix, waits for approval, executes and verifies |

### What makes ATHAR different
- 🔗 **Traces dependencies** to reach the real source of the problem, not just the service that raised the alert
- 🧩 **Correlates evidence** from multiple sources together, instead of analyzing each one separately
- 🔁 **One loop** combines AI Investigation, Safe Remediation and Verification
- 🧑‍💻 **Human in the loop:** no sensitive action runs without the engineer's approval
- 🔍 **Explainable:** every conclusion comes with its evidence and a confidence score

---

## 🎬 Scenario: Payment Failures

```
        User
          │
          ▼
   Payment Service  🔴  ← Alert fires here
          │
          ▼
    Fraud Service   🟡  ← Real cause
          │
          ▼
        Redis
```

**What the engineer sees**
- Alert on Payment Service: error rate ↑, latency ↑, timeouts ↑
- Payment pods are running, CPU and memory are normal
- No new deployment on Payment Service

**What ATHAR discovers**
- Payment logs show: `Timeout calling Fraud Service`
- Fraud Service is running with no crashes, **but its latency jumped**
- The latency spike started right after a **new Fraud Service deployment**

**Causal chain**
```
Payment failures
      ▼
Payment Service: error rate ↑
      ▼
Timeout calling Fraud Service
      ▼
Fraud Service latency ↑
      ▼
Fraud Service new deployment
      ▼
ROOT CAUSE: regression introduced in the new Fraud Service version
```

**Recommended action:** Safe rollback of Fraud Service → engineer approves → ATHAR verifies that both Fraud and Payment have recovered.

> **The service that raised the alert ≠ the source of the problem.**

---

## 🏗️ Architecture

```
Prometheus Alert
       │
       ▼
 Incident Manager
       │
       ▼
  Data Collector ──► Prometheus API · Kubernetes API · Logs · Deployment History
       │
       ▼
 Evidence Package
       │
       ▼
    AI Agent ──► Root Cause Analysis + Confidence + Evidence
       │
       ▼
Recommended Remediation
       │
       ▼
Safety & Human Approval
       │
       ▼
  Kubernetes API (execute)
       │
       ▼
   Verification ──► Resolved ✅  /  Still bad → re-investigate or escalate
```

### Safety layer
- ✅ Engineer approval before any action
- ✅ Only allowed, pre-defined actions (rollback, restart, scale)
- ✅ Audit log of every decision and action
- ✅ Logs are treated as untrusted data, never as instructions to the AI

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Orchestration | **Kubernetes** |
| Monitoring & Alerts | **Prometheus** |
| AI | **Groq AI** |
| Data Sources | Metrics · Logs · Events · Deployment History |
| Execution | Kubernetes API |

---

## 🎯 Target Users

| Who | Value |
|---|---|
| **DevOps Engineers** | Less time investigating and responding to incidents |
| **SRE Teams** | Faster failure analysis in distributed systems |
| **Cloud & Platform Teams** | More stable services and infrastructure |

---

## 📈 Market Opportunity (Saudi Arabia)

| Market | 2025 | Forecast |
|---|---|---|
| DevOps | **$146.5M** | **$698M** by 2034 |
| Cloud Computing | **$5.1B** | **$14.6B** by 2030 |

<sub>Sources: IMARC Group (Saudi Arabia DevOps Market) · MarketsandMarkets (Saudi Arabia Cloud Computing Market)</sub>

---

## 🌱 Impact

**From investigation to response**
- Turns a manual, multi-step investigation into an automated one
- Cuts the time needed to collect and connect evidence
- Helps engineers reach the root cause faster

**Value that grows over time**
- Less repetitive work for DevOps teams
- Learns from past incident data
- Easy to extend with new monitoring sources and remediation actions

---

## 🔮 Roadmap

- **Predictive incidents:** use past incident data to build a predictive AI model, spot the patterns that come before failures, and alert before services are affected
- **Smart incident documentation:** after each incident, the AI writes the postmortem (problem, evidence, root cause, fix) and builds a team Knowledge Base
- **More incident types:** resource issues, configuration changes, network and dependency failures
- **More integrations:** additional observability, cloud and CI/CD tools

---

## 👥 Team

| Name | Role |
|---|---|
| **Lujain Alhassan** · لجين الحصان | Team Lead |
| **Muntaha Alnasser** · منتهى الناصر | Software Engineer |
| **Noura Abu Thnain** · نوره أبو ثنين | AI Expert |

<div align="center">

**ATHAR doesn't just tell you there's a problem. It tells you where it started, why it happened, and what the safe next step is.**

`Detect → Investigate → Understand → Remediate → Verify`

</div>
