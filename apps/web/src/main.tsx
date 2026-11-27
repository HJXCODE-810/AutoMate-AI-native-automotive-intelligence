import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { healthResponseSchema, vehicleDetailResponseSchema, vehicleListResponseSchema, type CapabilityResult, type VehicleDetail, type VehicleSummary } from "@automate/domain";
import "./styles.css";

const powertrainNames = { petrol_ice: "Petrol", battery_electric: "Electric", diesel_ice: "Diesel" };
const names: Record<string, string> = {
  "vehicle.speed": "Vehicle speed", "vehicle.odometer": "Odometer", "vehicle.trip_distance": "Trip distance",
  "engine.rpm": "Engine speed", "engine.coolant_temperature": "Coolant temperature", "engine.oil_pressure": "Oil pressure",
  "engine.oil_level_status": "Oil level", "engine.load": "Engine load", "engine.fuel_level": "Fuel level", "engine.fuel_rate": "Fuel consumption rate",
  "transmission.temperature": "Transmission temperature", "electrical.system_voltage": "Low-voltage system",
  "electrical.module_communication_status": "Module communication", "brakes.abs_status": "Anti-lock braking",
  "brakes.wheel_speed_front_left": "Front-left wheel speed", "stability.esc_status": "Electronic stability control",
  "steering.eps_status": "Electric power steering", "steering.angle": "Steering angle", "tires.pressure_front_left": "Front-left tire pressure",
  "body.door_open_count": "Open doors", "body.seatbelt_driver": "Driver seatbelt", "ev.battery_state_of_charge": "Battery state of charge",
  "ev.pack_temperature": "Battery temperature", "ev.pack_voltage": "Traction battery voltage", "ev.pack_current": "Traction battery current",
  "ev.motor_temperature": "Motor temperature", "ev.regenerative_braking": "Regenerative braking",
  "adas.blind_spot_status": "Blind spot assistance", "suspension.ride_height_status": "Suspension ride height", "maintenance.service_due": "Service reminder",
};

function VehicleDrawing({ powertrain, large = false }: { powertrain: VehicleSummary["powertrain"]; large?: boolean }) {
  const suv = powertrain === "battery_electric";
  return <svg className={`vehicle-drawing ${large ? "large" : ""}`} viewBox="0 0 480 180" role="img" aria-label={`${powertrainNames[powertrain]} fictional vehicle illustration`}>
    <ellipse cx="241" cy="153" rx="191" ry="9" fill="currentColor" opacity=".1" />
    <path d={suv ? "M45 116 65 87 124 78 156 36 331 36 369 78 426 91 440 120 435 140H49Z" : "M43 117 68 96 125 87 177 45 301 45 363 87 420 102 439 124 432 141H47Z"} fill="currentColor" opacity=".9" />
    <path d={suv ? "M141 77 166 45H238V77ZM250 45H324L351 77H250Z" : "M144 86 183 54H238V86ZM250 54H296L340 86H250Z"} fill="#17211e" />
    <path d="M80 112H399M246 93V131" fill="none" stroke="#17211e" strokeWidth="2" opacity=".35" />
    <path d="M57 105H83L75 117H48M412 108H430" fill="none" stroke="#f2f5e9" strokeWidth="5" />
    <circle cx="126" cy="137" r="31" fill="#101817" /><circle cx="126" cy="137" r="17" fill="#9da99c" /><circle cx="126" cy="137" r="8" fill="#26332b" />
    <circle cx="365" cy="137" r="31" fill="#101817" /><circle cx="365" cy="137" r="17" fill="#9da99c" /><circle cx="365" cy="137" r="8" fill="#26332b" />
    {suv && <path d="M180 125H300" stroke="#17211e" strokeWidth="6" />}
  </svg>;
}

async function fetchJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error(`The catalog service returned ${response.status}. Check that the API is running and retry.`);
  return response.json();
}

type SimulationState = { id: string; vehicleProfileId: string; scenarioId: string; seed: number; tick: number; tickDurationMs: number; values: Record<string, number | string | boolean>; events: string[]; indicators: { id: string; severity: string; status: string; ruleId: string; explanation: string }[]; savedReport: boolean; notice: string; durability: "in_memory" | "postgresql" };
async function postJson(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error((result as { error?: { message?: string } }).error?.message ?? `Request failed (${response.status}).`);
  return result;
}

function SignalRow({ capability, value, sessionActive }: { capability: CapabilityResult; value: number | string | boolean | undefined; sessionActive: boolean }) {
  const signal = capability.definition;
  return <tr>
    <td><strong>{names[signal.id] ?? signal.id}</strong><code>{signal.id}</code></td>
    <td className="signal-type">{signal.valueType === "number" ? "Measurement" : signal.valueType === "enum" ? "System status" : "State"}</td>
    <td>{signal.unit === "degC" ? "°C" : signal.unit || "—"}</td>
    <td><span className={`status-tag ${capability.availability}`} title={capability.reason}>{capability.availability === "supported" ? "Configured" : capability.availability === "unsupported" ? "Unavailable" : "Unknown"}</span></td>
    <td>{capability.availability === "supported" && sessionActive && value !== undefined ? <><span className="reading-value">{String(value)}</span><small>Simulated</small></> : <><span className="no-reading">—</span><small>{capability.availability === "supported" ? "No session yet" : "Unavailable"}</small></>}</td>
  </tr>;
}

function App() {
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<VehicleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [health, setHealth] = useState<"checking" | "connected" | "offline">("checking");
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState("all");
  const [subsystem, setSubsystem] = useState("all");
  const [scenarioId, setScenarioId] = useState("");
  const [seed, setSeed] = useState("42");
  const [simulation, setSimulation] = useState<SimulationState | null>(null);
  const [simulationError, setSimulationError] = useState("");
  const [simulationBusy, setSimulationBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setHealth("checking");
    Promise.all([
      fetchJson("/api/health", controller.signal).then((body) => healthResponseSchema.parse(body)),
      fetchJson("/api/catalog/vehicles", controller.signal).then((body) => vehicleListResponseSchema.parse(body)),
    ]).then(([, list]) => {
      if (controller.signal.aborted) return;
      setVehicles(list.vehicles);
      setSelectedId((current) => list.vehicles.some((vehicle) => vehicle.id === current) ? current : list.vehicles[0]?.id ?? "");
      setHealth("connected");
    }).catch((failure: unknown) => {
      if (!controller.signal.aborted) { setError(failure instanceof Error ? failure.message : "Unable to load vehicle catalog."); setHealth("offline"); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    setDetail(null); setDetailError(""); setDetailLoading(true);
    fetchJson(`/api/catalog/vehicles/${encodeURIComponent(selectedId)}`, controller.signal)
      .then((body) => {
        const parsed = vehicleDetailResponseSchema.parse(body);
        if (parsed.vehicle.id !== selectedId) throw new Error("The catalog returned a different vehicle. Please retry.");
        if (!controller.signal.aborted) setDetail(parsed);
      }).catch((failure: unknown) => {
        if (!controller.signal.aborted) setDetailError(failure instanceof Error ? failure.message : "Unable to load profile.");
      }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selectedId, retry]);

  const selected = vehicles.find((vehicle) => vehicle.id === selectedId);
  const currentDetail = detail?.vehicle.id === selectedId ? detail : null;
  useEffect(() => {
    if (currentDetail && !currentDetail.scenarios.some((scenario) => scenario.id === scenarioId)) setScenarioId(currentDetail.scenarios[0]?.id ?? "");
  }, [currentDetail, scenarioId]);
  const filtered = useMemo(() => currentDetail?.capabilities.filter((entry) => {
    const search = `${entry.signalId} ${names[entry.signalId] ?? ""}`.toLowerCase();
    return search.includes(query.trim().toLowerCase())
      && (availability === "all" || (availability === "unavailable" ? entry.availability !== "supported" : entry.availability === "supported"))
      && (subsystem === "all" || entry.definition.subsystemId === subsystem);
  }) ?? [], [currentDetail, query, availability, subsystem]);

  function selectVehicle(id: string) { setSelectedId(id); setQuery(""); setAvailability("all"); setSubsystem("all"); setSimulation(null); setSimulationError(""); }
  async function startSimulation() {
    setSimulationBusy(true); setSimulationError("");
    try { setSimulation(await postJson("/api/sessions", { vehicleProfileId: selectedId, scenarioId, seed: Number(seed) }) as SimulationState); }
    catch (failure) { setSimulationError(failure instanceof Error ? failure.message : "Unable to start simulation."); }
    finally { setSimulationBusy(false); }
  }
  async function advanceSession(ticks: number) {
    if (!simulation) return;
    setSimulationBusy(true); setSimulationError("");
    try { setSimulation(await postJson(`/api/sessions/${encodeURIComponent(simulation.id)}/advance`, { ticks }) as SimulationState); }
    catch (failure) { setSimulationError(failure instanceof Error ? failure.message : "Unable to advance simulation."); }
    finally { setSimulationBusy(false); }
  }
  async function saveReport() {
    if (!simulation) return;
    setSimulationBusy(true); setSimulationError("");
    try { setSimulation(await postJson(`/api/sessions/${encodeURIComponent(simulation.id)}/report`, {}) as SimulationState); }
    catch (failure) { setSimulationError(failure instanceof Error ? failure.message : "Unable to save report."); }
    finally { setSimulationBusy(false); }
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="AutoMate OS home"><span className="brand-mark">a<span>.</span></span><span>AutoMate<span className="brand-os">OS</span></span></a>
      <nav aria-label="Main navigation"><a className="active" href="#garage">Vehicle laboratory</a><a href="#pipeline">The foundation</a></nav>
      <span className={`api-status ${health}`} role="status"><span />{health === "connected" ? "Catalog connected" : health === "checking" ? "Connecting" : "Service offline"}</span>
    </header>

    <main id="top">
      <section className="intro">
        <div><p className="eyebrow"><span className="accent-line" />AUTOMOTIVE INTELLIGENCE LAB</p><h1>Every vehicle.<br /><span>One shared language.</span></h1><p className="intro-copy">Explore the systems that make a vehicle work. Start with a fictional profile and discover the signals behind its dashboard.</p><a className="primary-link" href="#capabilities">Explore the signal registry</a></div>
        <div className="intro-aside"><span className="outline-word">LAB / 01</span><p>Built to understand.<br />Designed to investigate.</p><span className="stage-label">FOUNDATION · VEHICLE CAPABILITIES</span></div>
      </section>

      <aside className="simulation-banner"><span className="banner-label">SIMULATED</span><p>Educational vehicle profiles. <strong>Not a real vehicle diagnostic.</strong> All profile capabilities and numeric bounds are fictional.</p></aside>

      <section id="garage" className="garage" aria-labelledby="garage-heading">
        <div className="section-heading"><div><p className="eyebrow">YOUR STARTING POINT</p><h2 id="garage-heading">Choose your vehicle</h2></div><p>Three powertrains. One capability registry.</p></div>
        {loading && <p className="loading" role="status">Loading the vehicle catalog…</p>}
        {error && <div className="error-panel" role="alert"><strong>We couldn’t reach the catalog.</strong><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>Retry connection</button></div>}
        {!loading && !error && <div className="vehicle-grid">{vehicles.map((vehicle, index) => <button type="button" className={`vehicle-card ${selectedId === vehicle.id ? "selected" : ""}`} key={vehicle.id} aria-pressed={selectedId === vehicle.id} onClick={() => selectVehicle(vehicle.id)}>
          <div className="card-top"><span className="card-index">PROFILE / 0{index + 1}</span><span className="powertrain">{powertrainNames[vehicle.powertrain]}</span></div>
          <VehicleDrawing powertrain={vehicle.powertrain} />
          <div className="card-bottom"><div><h3>{vehicle.displayName}</h3><p>{vehicle.segment.replaceAll("_", " ")} · Fictional</p></div><span className="selected-mark" aria-hidden="true">{selectedId === vehicle.id ? "✓" : "+"}</span></div>
          <div className="card-meta"><span><strong>{vehicle.supportedCount}</strong> configured signals</span><span>{vehicle.unsupportedCount} unavailable</span></div>
        </button>)}</div>}
      </section>

      {selected && !error && <section className="profile-overview" aria-label="Selected profile overview">
        <div className="profile-identity"><p className="eyebrow">SELECTED PROFILE</p><h2>{selected.displayName}</h2><p>{powertrainNames[selected.powertrain]} architecture · Catalog {currentDetail?.catalogVersion ?? "…"}</p><span className="profile-code">{selected.id}</span></div>
        <div className="profile-count"><strong>{selected.supportedCount.toString().padStart(2, "0")}</strong><span>Configured signals</span><small>Defined for this simulation profile</small></div>
        <div className="profile-count"><strong>{selected.unsupportedCount.toString().padStart(2, "0")}</strong><span>Unavailable signals</span><small>No values will be invented</small></div>
        <div className="next-stage"><span className="stage-label">NEXT MILESTONE</span><h3>Bring the signals to life.</h3><p>The sensor engine comes next. Readings stay empty until simulation is implemented.</p></div>
      </section>}

      {selected && !error && <section className="simulator" aria-labelledby="simulator-heading">
        <div className="section-heading"><div><p className="eyebrow">NEXT MILESTONE · DETERMINISTIC SESSION</p><h2 id="simulator-heading">Run a virtual drive</h2></div><p>Seeded telemetry · rule based warnings</p></div>
        <div className="simulator-controls">
          <div><label htmlFor="scenario-choice">Scenario</label><select id="scenario-choice" value={scenarioId} onChange={(event) => { setScenarioId(event.target.value); setSimulation(null); }} disabled={simulationBusy || !currentDetail}>{currentDetail?.scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.id.replace(/-v1$/, "").replaceAll("-", " ")}</option>)}</select></div>
          <div><label htmlFor="simulation-seed">Replay seed</label><input id="simulation-seed" type="number" min="0" max="2147483647" value={seed} onChange={(event) => setSeed(event.target.value)} disabled={simulationBusy || Boolean(simulation)} /></div>
          {!simulation && <button type="button" onClick={startSimulation} disabled={simulationBusy || !scenarioId}>{simulationBusy ? "Starting…" : "Start simulation"}</button>}
          {simulation && <div className="session-actions"><button type="button" onClick={() => advanceSession(1)} disabled={simulationBusy}>Advance 1 tick</button><button type="button" onClick={() => advanceSession(5)} disabled={simulationBusy}>Advance 5</button><button type="button" onClick={saveReport} disabled={simulationBusy || simulation.savedReport}>{simulation.savedReport ? "Report saved" : "Save report"}</button><button className="quiet-button" type="button" onClick={() => { setSimulation(null); setSimulationError(""); }}>New session</button></div>}
        </div>
        {simulationError && <p className="sim-error" role="alert">{simulationError}</p>}
        {simulation && <div className="cluster" aria-live="polite">
          <div className="cluster-head"><div><span className="banner-label">SIMULATED SESSION</span><strong>{selected.displayName}</strong></div><span>Tick {simulation.tick} · Seed {simulation.seed}</span></div>
          <div className="cluster-readings">{["vehicle.speed", "engine.rpm", "ev.battery_state_of_charge", "electrical.system_voltage", "engine.coolant_temperature"].filter((id) => id in simulation.values).map((id) => <div className="reading-card" key={id}><span>{names[id]}</span><strong>{simulation.values[id]}<small>{currentDetail?.capabilities.find((entry) => entry.signalId === id)?.definition.unit === "degC" ? "°C" : currentDetail?.capabilities.find((entry) => entry.signalId === id)?.definition.unit}</small></strong></div>)}</div>
          <div className="cluster-lower"><div><h3>Instrument indicators</h3><div className="indicator-list">{simulation.indicators.map((indicator) => <div className={`indicator ${indicator.status}`} key={indicator.ruleId}><span>{indicator.id.replaceAll(".", " ")}</span><strong>{indicator.status === "active" ? "SIMULATED WARNING" : "CLEAR"}</strong><small>{indicator.explanation}</small></div>)}</div></div><div><h3>Event timeline</h3>{simulation.events.length ? simulation.events.map((event) => <p className="event-row" key={event}>{event.replaceAll("_", " ")} · Emitted in this scenario</p>) : <p className="muted-copy">No fault events emitted yet.</p>}<p className="sim-notice">{simulation.notice} Storage: {simulation.durability === "postgresql" ? "PostgreSQL; sessions and reports survive API restarts." : "in memory; sessions and reports clear when the API restarts."}</p></div></div>
        </div>}
      </section>}

      <section id="capabilities" className="capability-section" aria-labelledby="signals-heading">
        <div className="section-heading"><div><p className="eyebrow">UNDER THE HOOD</p><h2 id="signals-heading">Signal registry</h2></div><p>Capability definitions, with their limits in view.</p></div>
        {detailLoading && <p className="loading" role="status">Loading profile capabilities…</p>}
        {detailError && !error && <div className="error-panel" role="alert"><p>{detailError}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>Retry profile</button></div>}
        {currentDetail && !error && <>
          <div className="registry-toolbar">
            <div className="search-field"><label htmlFor="signal-search">Find a signal</label><input id="signal-search" type="search" placeholder="Search by name or signal ID" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
            <div className="filter-field"><label htmlFor="subsystem">System</label><select id="subsystem" value={subsystem} onChange={(event) => setSubsystem(event.target.value)}><option value="all">All systems</option>{currentDetail.subsystems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}</select></div>
            <div className="availability-filter" role="group" aria-label="Signal availability">{[["all", "All signals"], ["supported", "Configured"], ["unavailable", "Unavailable"]].map(([value, label]) => <button type="button" key={value} aria-pressed={availability === value} onClick={() => setAvailability(value!)}>{label}</button>)}</div>
          </div>
          <p className="results-count" role="status">{filtered.length} of {currentDetail.capabilities.length} signals · {selected?.displayName}</p>
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Vehicle capability table"><table><thead><tr><th scope="col">Signal</th><th scope="col">Type</th><th scope="col">Unit</th><th scope="col">Capability</th><th scope="col">Reading</th></tr></thead><tbody>{filtered.map((capability) => <SignalRow key={capability.signalId} capability={capability} value={simulation?.values[capability.signalId]} sessionActive={Boolean(simulation)} />)}</tbody></table></div>
          {filtered.length === 0 && <div className="empty-state"><h3>No signals match these filters.</h3><p>Try a different signal name or system.</p><button type="button" onClick={() => { setQuery(""); setSubsystem("all"); setAvailability("all"); }}>Clear filters</button></div>}
          <details className="catalog-notes"><summary>About these definitions and scenarios</summary><p>{currentDetail.rangeNotice}</p><p>“Configured” means the profile includes the signal. It does not mean a sensor was measured, or that a production vehicle exposes it.</p><p>Available scenario definitions: {currentDetail.scenarios.map((scenario) => scenario.id.replace(/-v1$/, "").replaceAll("-", " ")).join(", ")}. Session outputs and reports are synthetic. Storage is PostgreSQL when DATABASE_URL is configured; otherwise it is temporary process memory.</p></details>
        </>}
        {!selected && !loading && !error && <p>No fictional vehicle profiles are available.</p>}
      </section>

      <section id="pipeline" className="pipeline"><div><p className="eyebrow">A FOUNDATION THAT CONNECTS</p><h2>One profile. A consistent story.</h2><p>Capabilities decide what belongs. Scenarios will define what happens. Evidence will explain why.</p></div><ol><li><span>01</span><div><strong>Vehicle profile</strong><small>Fictional identity and powertrain</small></div></li><li><span>02</span><div><strong>Capability registry</strong><small>Explicit signal availability</small></div></li><li className="future"><span>03</span><div><strong>Deterministic simulation</strong><small>Next: reproducible readings and events</small></div></li></ol></section>
    </main>
    <footer><a className="footer-brand" href="#top">AutoMate OS</a><p>One Intelligent Platform. Every Vehicle.</p><span>FICTIONAL PROFILES · SYNTHETIC DATA</span></footer>
  </div>;
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(<StrictMode><App /></StrictMode>);
