from __future__ import annotations

from pathlib import Path

import streamlit as st

from health_monitoring import (
    METRICS,
    active_assessments,
    acknowledge_assessment,
    domain_status,
    initialize_db,
    latest_measurements,
    mark_sync_complete,
    measurement_history,
    pending_sync_count,
    record_measurement,
    seed_demo_data,
)


APP_DIR = Path(__file__).parent
DB_PATH = APP_DIR / "data" / "health_monitor.db"
CREW_MEMBER_ID = "crew-01"

st.set_page_config(page_title="ORBITAL // Crew health", page_icon="◉", layout="wide", initial_sidebar_state="expanded")

st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Space+Grotesk:wght@400;500;600;700&display=swap');
    :root { --ink:#102a2c; --muted:#5c7473; --paper:#f4f0e7; --panel:#fffdf7; --line:#d4d9cc; --mint:#b8e8cf; --coral:#ef806f; --amber:#efbd63; }
    html, body, [class*="css"] { font-family: 'Space Grotesk', sans-serif; color: var(--ink); }
    .stApp { background: radial-gradient(circle at 90% 0%, #dcebe1 0, transparent 32%), linear-gradient(135deg, #f4f0e7 0%, #eef3eb 52%, #e3ece3 100%); }
    [data-testid="stSidebar"] { background:#102a2c; border-right: 1px solid #244447; }
    [data-testid="stSidebar"] * { color:#eaf2e9 !important; }
    .block-container { padding-top: 2.4rem; max-width: 1440px; }
    .eyebrow { color:#5c7473; font-family:'DM Mono', monospace; font-size:.71rem; letter-spacing:.13em; text-transform:uppercase; }
    .hero { display:flex; justify-content:space-between; align-items:end; margin-bottom:1.4rem; }
    .hero h1 { font-size: clamp(2rem, 4vw, 3.7rem); line-height:.95; letter-spacing:-.06em; margin:.25rem 0 .7rem; font-weight:700; }
    .hero p { max-width: 660px; color:#5c7473; margin:0; font-size:1rem; }
    .mission-pill { background:#102a2c; color:#eaf2e9; padding:.75rem 1rem; border-radius:4px; font-family:'DM Mono',monospace; font-size:.72rem; letter-spacing:.05em; }
    .panel { background:rgba(255,253,247,.82); border:1px solid var(--line); border-radius:7px; padding:1.1rem 1.15rem; height:100%; box-shadow: 0 8px 22px rgba(16,42,44,.04); }
    .panel h3 { margin:.2rem 0 .8rem; font-size:1.05rem; letter-spacing:-.02em; }
    .status-dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:7px; }
    .normal { background:#55ab7b; } .watch { background:#d5972b; } .urgent, .critical { background:#da5d4b; }
    .domain-name { color:#5c7473; font-size:.75rem; font-family:'DM Mono',monospace; text-transform:uppercase; letter-spacing:.09em; }
    .domain-status { font-size:1.35rem; font-weight:600; margin:.35rem 0 .6rem; }
    .metric-label { color:#5c7473; font-size:.8rem; }
    .metric-value { font-size:1.8rem; font-weight:600; letter-spacing:-.04em; }
    .small { color:#5c7473; font-size:.78rem; }
    .alert-card { border-left:4px solid var(--coral); background:#fff8f3; padding:1rem 1.1rem; margin:.55rem 0; border-radius:0 6px 6px 0; }
    .alert-card.watch-card { border-left-color:var(--amber); background:#fffaf0; }
    .mono { font-family:'DM Mono', monospace; }
    .stButton > button { border-radius:4px; border:1px solid #9cb6aa; background:#e6f2e7; color:#102a2c; font-weight:600; }
    .stButton > button:hover { border-color:#102a2c; background:#cbe8d5; }
    div[data-testid="stMetric"] { background:rgba(255,253,247,.72); border:1px solid var(--line); padding:1rem; border-radius:6px; }
    </style>
    """,
    unsafe_allow_html=True,
)

initialize_db(DB_PATH)
seed_demo_data(DB_PATH)

with st.sidebar:
    st.markdown("<div class='eyebrow'>Orbital medical systems</div>", unsafe_allow_html=True)
    st.markdown("## Crew console")
    st.caption("Local operations mode")
    st.divider()
    st.markdown("**CREW MEMBER**")
    st.markdown("**A. RIVERA**  ·  CDR")
    st.markdown("Mission day 184  ·  LEO transit")
    st.divider()
    st.markdown("**SYSTEM STATUS**")
    st.markdown(f"🟢 Local store  ·  encrypted")
    st.markdown(f"🟠 {pending_sync_count(DB_PATH)} events queued")
    st.caption("Ground link last confirmed 02:14 UTC")
    if st.button("Mark queue ready for downlink", use_container_width=True):
        mark_sync_complete(DB_PATH)
        st.toast("Outbox marked confirmed for demo mode")
        st.rerun()
    st.divider()
    st.caption("Decision support only. Use approved mission procedures and contact the flight surgeon for urgent or worsening symptoms.")

latest = latest_measurements(DB_PATH, CREW_MEMBER_ID)
alerts = active_assessments(DB_PATH, CREW_MEMBER_ID)

st.markdown(
    """
    <div class='hero'>
      <div><div class='eyebrow'>Personal health telemetry / local time 06:42</div><h1>Stay ahead<br>of the drift.</h1><p>A calm, explainable read on the signals that matter today. Your data stays on this vehicle until the next confirmed downlink.</p></div>
      <div class='mission-pill'>MISSION DAY 184<br><span style='color:#b8e8cf'>● OFFLINE READY</span></div>
    </div>
    """,
    unsafe_allow_html=True,
)

status_text = "ACTION NEEDED" if alerts else "WITHIN BASELINE"
status_color = "#da5d4b" if alerts else "#55ab7b"
col_a, col_b, col_c, col_d = st.columns(4)
col_a.metric("Overall readiness", status_text)
col_b.metric("Open assessments", len(alerts))
col_c.metric("Signals current", f"{len(latest)} / {len(METRICS)}")
col_d.metric("Outbox", f"{pending_sync_count(DB_PATH)} queued")

st.markdown("### Mission health picture")
domains = [("Cardiovascular", "Pulse, pressure, oxygen"), ("Bone loading", "Resistive exercise trend"), ("Immune", "Symptoms and recovery"), ("Behavioral health", "Sleep, mood, stress")]
domain_columns = st.columns(4)
for column, (domain, subtitle) in zip(domain_columns, domains):
    status = domain_status(DB_PATH, domain)
    label = {"normal": "Within baseline", "watch": "Watch trend", "urgent": "Review now", "critical": "Review now"}[status]
    with column:
        st.markdown(f"<div class='panel'><div class='domain-name'><span class='status-dot {status}'></span>{domain}</div><div class='domain-status'>{label}</div><div class='small'>{subtitle}</div></div>", unsafe_allow_html=True)

st.write("")
overview_tab, trends_tab, checkin_tab, log_tab = st.tabs(["Today", "Trends", "Check-in", "Mission log"])

with overview_tab:
    left, right = st.columns([1.35, 1], gap="large")
    with left:
        st.markdown("### Attention queue")
        if not alerts:
            st.success("No open assessments. Continue scheduled monitoring.")
        for alert in alerts:
            metric = METRICS[alert["metric_code"]]
            card_class = "alert-card watch-card" if alert["status"] == "watch" else "alert-card"
            st.markdown(f"<div class='{card_class}'><div class='eyebrow'>{alert['status']} · {metric.domain}</div><strong>{metric.label} · {alert['value']:g} {metric.unit}</strong><br><span class='small'>{alert['rationale']}</span><br><br><span class='small'><b>Suggested next step:</b> {alert['guidance']}</span></div>", unsafe_allow_html=True)
            if st.button("Acknowledge and add to mission log", key=f"ack_{alert['id']}"):
                acknowledge_assessment(DB_PATH, alert["id"])
                st.rerun()
    with right:
        st.markdown("### Latest signals")
        for metric_code, metric in METRICS.items():
            measurement = latest.get(metric_code)
            if not measurement:
                continue
            value = float(measurement["value"])
            status = "normal" if metric.normal_low <= value <= metric.normal_high else "watch"
            st.markdown(f"<div style='display:flex;justify-content:space-between;border-bottom:1px solid #d4d9cc;padding:.65rem 0'><span><span class='status-dot {status}'></span><span class='metric-label'>{metric.label}</span></span><span class='mono'>{value:g} {metric.unit}</span></div>", unsafe_allow_html=True)
        st.caption("Green shows the configured baseline range. Amber indicates a signal that deserves attention, not a diagnosis.")

with trends_tab:
    st.markdown("### Seven-day trend review")
    selected_metric = st.selectbox("Signal", list(METRICS), format_func=lambda code: METRICS[code].label)
    history = measurement_history(DB_PATH, selected_metric, days=30, crew_member_id=CREW_MEMBER_ID)
    if history:
        chart_data = {"value": [row["value"] for row in history]}
        st.line_chart(chart_data, height=280)
        metric = METRICS[selected_metric]
        st.markdown(f"**Configured baseline:** {metric.normal_low:g}–{metric.normal_high:g} {metric.unit}  ·  **Source:** {metric.source}")
        st.caption("Trend review is based on recorded observations. Confirm unusual readings using the mission measurement procedure.")

with checkin_tab:
    st.markdown("### Record a crew check-in")
    st.caption("These values are private health observations stored locally and added to the downlink queue.")
    with st.form("crew_checkin"):
        checkin_col_a, checkin_col_b = st.columns(2)
        with checkin_col_a:
            mood = st.slider("Mood / coping", 1, 10, 7, help="1 = very difficult, 10 = doing well")
            stress = st.slider("Perceived stress", 1, 10, 4)
        with checkin_col_b:
            sleep = st.number_input("Sleep last opportunity (hours)", min_value=0.0, max_value=16.0, value=7.0, step=0.5)
            immune = st.slider("Immune symptom score", 0, 10, 0, help="0 = none, 10 = severe")
        notes = st.text_area("Optional private note", placeholder="What would help the next watch?")
        submitted = st.form_submit_button("Save local check-in", use_container_width=True)
    if submitted:
        record_measurement(DB_PATH, "mood_score", mood, notes=notes)
        record_measurement(DB_PATH, "perceived_stress", stress, notes=notes)
        record_measurement(DB_PATH, "sleep_duration", sleep, notes=notes)
        record_measurement(DB_PATH, "immune_symptom_score", immune, notes=notes)
        st.success("Check-in saved locally. The assessment queue has been refreshed.")
        st.rerun()

with log_tab:
    st.markdown("### Local event log")
    st.caption("The log is append-only at the domain level. Corrections create new observations rather than rewriting history.")
    for alert in active_assessments(DB_PATH, CREW_MEMBER_ID)[:8]:
        metric = METRICS[alert["metric_code"]]
        st.markdown(f"**{alert['created_at'][11:16]} UTC**  ·  {alert['status'].upper()}  ·  {metric.label}  ·  {alert['value']:g} {metric.unit}")
        st.caption(alert["rationale"])
