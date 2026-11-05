import { useState, useEffect, useRef, lazy, Suspense } from "react";
import {
  MapPin,
  Plus,
  ArrowUpRight,
  Search,
  SlidersHorizontal,
  Check,
  ArrowRight,
  Camera,
  X,
  LoaderCircle,
  Leaf,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UserRound,
  Sparkles,
  Clock,
  ChevronLeft,
  ChevronRight,
  LocateFixed,
  AlertTriangle,
} from "lucide-react";
import { api, mediaUrl } from "./api";
const CityMap = lazy(() => import("./Map.jsx"));
export const categories = [
  "road",
  "sidewalk",
  "lighting",
  "waste",
  "water",
  "accessibility",
  "other",
];
const statuses = [
  "submitted",
  "reviewing",
  "in_progress",
  "resolved",
  "rejected",
];
export const label = (v) =>
  v?.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const date = (v) =>
  new Date(v).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const MapFallback = () => (
  <div className="map-loading">
    <LoaderCircle className="spin" /> Loading neighborhood map…
  </div>
);

function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, []);
  function key(e) {
    if (e.key === "Escape") onClose();
    if (e.key === "Tab") {
      const all = ref.current.querySelectorAll(
        'button,input,select,textarea,a[href],[tabindex="0"]',
      );
      const first = all[0],
        last = all[all.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        ref={ref}
        tabIndex={-1}
        onKeyDown={key}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={"modal " + (wide ? "wide" : "")}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Auth({ onClose, onUser }) {
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      onUser(
        await api("/auth/" + (register ? "register" : "login"), {
          method: "POST",
          body: JSON.stringify(body),
        }),
      );
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={register ? "Join your neighborhood" : "Welcome back"}
      onClose={onClose}
    >
      <p className="muted">A little attention can make a big difference.</p>
      <form onSubmit={submit} className="stack">
        {register && (
          <label>
            Your name
            <input
              name="name"
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
            />
          </label>
        )}
        <label>
          Email address
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            maxLength={254}
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            minLength={register ? 12 : 1}
            maxLength={128}
            autoComplete={register ? "new-password" : "current-password"}
          />
          {register && <small>Use at least 12 characters.</small>}
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" />
          ) : register ? (
            "Create account"
          ) : (
            "Sign in"
          )}
          <ArrowRight size={17} />
        </button>
      </form>
      <button
        className="text-button auth-switch"
        onClick={() => {
          setRegister(!register);
          setError("");
        }}
      >
        {register
          ? "Already have an account? Sign in"
          : "New here? Create an account"}
      </button>
    </Modal>
  );
}
function ReportForm({ onClose, onCreated }) {
  const [photo, setPhoto] = useState(null),
    [preview, setPreview] = useState(""),
    [values, setValues] = useState({
      title: "",
      description: "",
      category: "road",
      severity: "medium",
      jurisdiction: "new_brunswick",
      location: "",
      latitude: 40.495,
      longitude: -74.447,
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [aiBusy, setAiBusy] = useState(false),
    [suggestion, setSuggestion] = useState(null),
    [consent, setConsent] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [duplicates, setDuplicates] = useState([]),
    [ack, setAck] = useState(false);
  useEffect(() => {
    if (!photo) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  function change(key, value) {
    setValues((v) => ({ ...v, [key]: value }));
    setConfirmed(false);
    setAck(false);
    setDuplicates([]);
  }
  async function analyze() {
    if (!photo) return;
    setAiBusy(true);
    setError("");
    const form = new FormData();
    form.append("image", photo);
    form.append("consent", String(consent));
    try {
      setSuggestion(await api("/ai/suggest", { method: "POST", body: form }));
    } catch (e) {
      setError(e.message);
    } finally {
      setAiBusy(false);
    }
  }
  async function submit(e) {
    e.preventDefault();
    if (!photo) {
      setError("Please add a photo.");
      return;
    }
    setBusy(true);
    setError("");
    const form = new FormData();
    Object.entries(values).forEach(([k, v]) => form.append(k, String(v)));
    form.append("image", photo);
    form.append("confirmed", String(confirmed));
    form.append("duplicate_acknowledged", String(ack));
    try {
      await api("/reports", { method: "POST", body: form });
      onCreated();
      onClose();
    } catch (e) {
      setError(e.message);
      if (e.duplicates) setDuplicates(e.duplicates);
    } finally {
      setBusy(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      setError("Location is unavailable. Click the map to place a pin.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        change("latitude", p.coords.latitude);
        change("longitude", p.coords.longitude);
      },
      () =>
        setError(
          "Could not access your location. Click the map to place a pin.",
        ),
      { timeout: 10000 },
    );
  }
  return (
    <Modal title="Report a local issue" onClose={onClose} wide>
      <p className="muted">
        Notice it. Share it. Help your neighborhood move forward.
      </p>
      <form className="stack" onSubmit={submit}>
        <label className="upload">
          {preview ? (
            <img src={preview} alt="Your report photo preview" />
          ) : (
            <>
              <Camera size={30} />
              <strong>Add a photo</strong>
              <span>JPEG, PNG or WebP · up to 5 MB</span>
            </>
          )}
          <input
            aria-label="Report photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            onChange={(e) => {
              const f = e.target.files[0];
              if (f?.size > 5 * 1024 * 1024) {
                setError("Photo must be 5 MB or smaller.");
                e.target.value = "";
                return;
              }
              setPhoto(f);
              setConfirmed(false);
              setSuggestion(null);
              setAck(false);
            }}
          />
        </label>
        <div className="ai-box">
          <div>
            <Sparkles size={19} />
            <strong>A little help from AI</strong>
            <span className="tiny-tag">OPTIONAL</span>
          </div>
          <p>
            Get a category and description suggestion. You always make the final
            call.
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I agree to send this photo to Google Gemini for analysis.
          </label>
          <button
            type="button"
            className="secondary"
            disabled={!photo || !consent || aiBusy}
            onClick={analyze}
          >
            {aiBusy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Sparkles size={16} />
            )}
            Suggest report details
          </button>
        </div>
        {suggestion && (
          <div className="suggestion">
            <strong>Review AI suggestion</strong>
            <h3>{suggestion.title}</h3>
            <p>{suggestion.description}</p>
            <p>
              {label(suggestion.category)} · {label(suggestion.severity)}{" "}
              severity
            </p>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setValues((v) => ({
                  ...v,
                  ...Object.fromEntries(
                    ["title", "description", "category", "severity"].map(
                      (k) => [k, suggestion[k]],
                    ),
                  ),
                }));
                setSuggestion(null);
                setConfirmed(false);
              }}
            >
              Use these details
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setSuggestion(null)}
            >
              Dismiss
            </button>
          </div>
        )}
        <label>
          Title
          <input
            name="title"
            required
            minLength={3}
            maxLength={120}
            value={values.title}
            onChange={(e) => change("title", e.target.value)}
            placeholder="e.g. Broken sidewalk on College Avenue"
          />
        </label>
        <label>
          What did you notice?
          <textarea
            required
            minLength={10}
            maxLength={4000}
            rows={4}
            value={values.description}
            onChange={(e) => change("description", e.target.value)}
            placeholder="Describe the issue and how it affects people nearby."
          />
        </label>
        <div className="form-grid">
          <label>
            Category
            <select
              value={values.category}
              onChange={(e) => change("category", e.target.value)}
            >
              {categories.map((v) => (
                <option key={v} value={v}>
                  {label(v)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Severity
            <select
              value={values.severity}
              onChange={(e) => change("severity", e.target.value)}
            >
              {["low", "medium", "high"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Area
            <select
              value={values.jurisdiction}
              onChange={(e) => change("jurisdiction", e.target.value)}
            >
              <option value="new_brunswick">New Brunswick</option>
              <option value="rutgers">Rutgers campus</option>
            </select>
          </label>
          <label>
            Location name
            <input
              required
              minLength={3}
              maxLength={200}
              value={values.location}
              onChange={(e) => change("location", e.target.value)}
              placeholder="Street, intersection or building"
            />
          </label>
        </div>
        <div className="between">
          <strong>Pin the issue on the map</strong>
          <button className="text-button" type="button" onClick={locate}>
            <LocateFixed size={16} />
            Use my location
          </button>
        </div>
        <div className="picker-map">
          <Suspense fallback={<MapFallback />}>
            <CityMap
              position={[values.latitude, values.longitude]}
              focus={[values.latitude, values.longitude]}
              onPick={(p) => {
                change("latitude", Number(p.lat.toFixed(6)));
                change("longitude", Number(p.lng.toFixed(6)));
              }}
            />
          </Suspense>
        </div>
        <div className="form-grid">
          <label>
            Latitude
            <input
              aria-label="Latitude"
              type="number"
              min="40.40"
              max="40.58"
              step="any"
              required
              value={values.latitude}
              onChange={(e) => change("latitude", Number(e.target.value))}
            />
          </label>
          <label>
            Longitude
            <input
              aria-label="Longitude"
              type="number"
              min="-74.52"
              max="-74.36"
              step="any"
              required
              value={values.longitude}
              onChange={(e) => change("longitude", Number(e.target.value))}
            />
          </label>
        </div>
        {duplicates.length > 0 && (
          <div className="suggestion">
            <strong>There may already be a report here</strong>
            {duplicates.map((d) => (
              <p key={d.id}>
                #{d.id} · {d.title} · {d.distance_m} m away · {d.reason}
              </p>
            ))}
            <label className="check">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />
              I reviewed these reports and still want to submit this issue.
            </label>
          </div>
        )}
        <label className="check">
          <input
            type="checkbox"
            required
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I reviewed the photo, details and location. I understand the report
          and its location are public.
        </label>
        <p className="fine">
          Avoid faces, license plates and private information. This app does not
          contact departments or provide emergency response. For immediate
          danger, call 911.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy || !confirmed || !photo}>
          {busy ? <LoaderCircle className="spin" /> : <Plus size={18} />}Submit
          report
        </button>
      </form>
    </Modal>
  );
}
function Detail({ report, onClose, user, onUpdated }) {
  const [status, setStatus] = useState(report.status),
    [note, setNote] = useState(""),
    [approved, setApproved] = useState(report.route_approved),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/admin/reports/" + report.id, {
        method: "PATCH",
        body: JSON.stringify({ status, note, route_approved: approved }),
      });
      onUpdated();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={"Report #" + report.id} onClose={onClose} wide>
      <img
        className="detail-image"
        src={mediaUrl(report.image_url)}
        alt={report.title}
      />
      <div className="between">
        <span className={"badge " + report.status}>{label(report.status)}</span>
        <span className="muted">{date(report.created_at)}</span>
      </div>
      <h2>{report.title}</h2>
      <p className="detail-description">{report.description}</p>
      <p className="location">
        <MapPin size={16} />
        {report.location}
      </p>
      <p className="muted">
        {label(report.category)} · {label(report.severity)} severity ·{" "}
        {report.jurisdiction === "rutgers" ? "Rutgers" : "New Brunswick"}
      </p>
      {report.duplicate_of && (
        <p className="fine">
          Linked as a possible duplicate of report #{report.duplicate_of}.
        </p>
      )}
      <div className="route-box">
        <ShieldCheck size={22} />
        <div>
          <strong>{report.routing.department}</strong>
          <p>{report.routing.reason}</p>
          <a href={report.routing.url} target="_blank" rel="noreferrer">
            Department website <ArrowUpRight size={14} />
          </a>
          <small>
            {report.route_approved
              ? "Routing recommendation approved by an admin."
              : "Awaiting admin approval."}{" "}
            No department has been contacted by this app.
          </small>
        </div>
      </div>
      <h3>Status history</h3>
      <ol className="timeline">
        {report.history.map((h) => (
          <li key={h.id}>
            <span className="timeline-dot" />
            <div>
              <strong>{label(h.status)}</strong>
              <time>{date(h.created_at)}</time>
              <p>{h.note}</p>
            </div>
          </li>
        ))}
      </ol>
      {user?.is_admin && (
        <form className="stack admin-form" onSubmit={save}>
          <h3>Admin review</h3>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {statuses.map((v) => (
                <option value={v} key={v}>
                  {label(v)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Public update note
            <textarea
              required
              minLength={3}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
            />
            Approve routing recommendation (does not send a message)
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            Save update
          </button>
        </form>
      )}
    </Modal>
  );
}
function Profile({ user, onUser, onClose }) {
  const [name, setName] = useState(user.name),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Your profile" onClose={onClose}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            onUser(
              await api("/auth/me", {
                method: "PATCH",
                body: JSON.stringify({ name }),
              }),
            );
            onClose();
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Name
          <input
            value={name}
            minLength={2}
            maxLength={80}
            required
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Email
          <input value={user.email} disabled />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          Save profile
        </button>
      </form>
    </Modal>
  );
}
function ReportCard({ report, onSelect }) {
  return (
    <button className="report-card" onClick={() => onSelect(report)}>
      <div className="card-image">
        <img src={mediaUrl(report.image_url)} alt="" loading="lazy" />
        <span className={"badge " + report.status}>
          <i />
          {label(report.status)}
        </span>
      </div>
      <div className="card-content">
        <div className="card-meta">
          <span>{label(report.category)}</span>
          <span>#{String(report.id).padStart(4, "0")}</span>
        </div>
        <h3>{report.title}</h3>
        <p>
          <MapPin size={14} />
          {report.location}
        </p>
        <div className="card-foot">
          <span>{date(report.created_at)}</span>
          <span className={"severity " + report.severity}>
            <i />
            {label(report.severity)} priority
          </span>
        </div>
      </div>
    </button>
  );
}

export default function App() {
  const [user, setUser] = useState(null),
    [view, setView] = useState("explore"),
    [modal, setModal] = useState(null),
    [selected, setSelected] = useState(null),
    [reports, setReports] = useState([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0),
    [filters, setFilters] = useState({
      category: "",
      status: "",
      jurisdiction: "",
      severity: "",
      q: "",
    }),
    [search, setSearch] = useState(""),
    [showFilters, setShowFilters] = useState(false),
    [display, setDisplay] = useState("split");
  useEffect(() => {
    api("/auth/me")
      .then(setUser)
      .catch(() => {});
  }, []);
  useEffect(() => {
    const id = setTimeout(() => setFilters((f) => ({ ...f, q: search })), 350);
    return () => clearTimeout(id);
  }, [search]);
  useEffect(() => {
    setPage(1);
  }, [filters, view]);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams(
      Object.entries({ ...filters, page, page_size: 12 }).filter(
        ([, v]) => v !== "",
      ),
    );
    api(view === "mine" ? "/reports/mine" : "/reports?" + params)
      .then((data) => {
        if (live) {
          setReports(Array.isArray(data) ? data : data.items);
          setTotal(Array.isArray(data) ? data.length : data.total);
        }
      })
      .catch((e) => {
        if (live) {
          setError(e.message);
          setReports([]);
        }
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [filters, page, view, version]);
  const refresh = () => setVersion((v) => v + 1);
  function navigate(next) {
    if (next === "mine" && !user) {
      setModal("auth");
      return;
    }
    setView(next);
  }
  const stats = [
    [
      "01",
      "See something",
      "A pothole, a broken light, a path that needs care.",
    ],
    ["02", "Share the details", "Add a photo and a pin. AI can lend a hand."],
    ["03", "Follow the progress", "Keep an eye on updates, all in one place."],
  ];
  return (
    <>
      <header className="header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("explore");
          }}
        >
          <span className="brand-mark">
            <MapPin size={22} strokeWidth={2.5} />
          </span>
          <span>
            CityFix<span className="brand-nb">NB</span>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <button
            className={view === "explore" ? "nav-active" : ""}
            onClick={() => navigate("explore")}
          >
            Explore issues
          </button>
          <button
            className={view === "mine" ? "nav-active" : ""}
            onClick={() => navigate("mine")}
          >
            My reports
          </button>
          {user?.is_admin && (
            <button
              className={view === "admin" ? "nav-active" : ""}
              onClick={() => navigate("admin")}
            >
              Admin review
            </button>
          )}
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <button
                className="profile-button"
                aria-label="Open your profile"
                onClick={() => setModal("profile")}
              >
                <UserRound size={18} />
                <span>{user.name.split(" ")[0]}</span>
              </button>
              <button
                className="icon-button logout"
                title="Sign out"
                aria-label="Sign out"
                onClick={async () => {
                  try {
                    await api("/auth/logout", { method: "POST" });
                    setUser(null);
                    setView("explore");
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <button className="sign-in" onClick={() => setModal("auth")}>
              Sign in <ArrowUpRight size={15} />
            </button>
          )}
          <button
            className="primary small"
            onClick={() => setModal(user ? "report" : "auth")}
          >
            <Plus size={18} />
            Report an issue
          </button>
        </div>
      </header>
      <main>
        {view === "explore" && (
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow">
                <span />
                NEW BRUNSWICK + RUTGERS
              </div>
              <h1>
                A better block
                <br />
                starts with <em>you.</em>
              </h1>
              <p>
                Small problems deserve attention.
                <br />
                Spot an issue, share it, and help our community thrive.
              </p>
              <div className="hero-actions">
                <button
                  className="primary"
                  onClick={() => setModal(user ? "report" : "auth")}
                >
                  Make a difference <ArrowUpRight size={18} />
                </button>
                <a href="#neighborhood">
                  Explore the neighborhood <ArrowRight size={17} />
                </a>
              </div>
              <div className="community-note">
                <div className="mini-avatars">
                  <span>NB</span>
                  <span>RU</span>
                  <span>
                    <Leaf size={16} />
                  </span>
                </div>
                <span>
                  For our city. For our campus. <strong>For all of us.</strong>
                </span>
              </div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="art-grid" />
              <div className="river" />
              <div className="road road-one" />
              <div className="road road-two" />
              <div className="road road-three" />
              <div className="block b1" />
              <div className="block b2" />
              <div className="block b3" />
              <div className="block b4" />
              <div className="block b5" />
              <div className="park">
                <Leaf size={32} />
              </div>
              <div className="map-label label-one">COLLEGE AVENUE</div>
              <div className="map-label label-two">NEW BRUNSWICK</div>
              <div className="art-pin pin-one">
                <MapPin size={31} fill="#143f36" />
              </div>
              <div className="art-pin pin-two">
                <MapPin size={25} fill="#c28348" />
              </div>
              <div className="art-pin pin-three">
                <MapPin size={25} fill="#143f36" />
              </div>
              <div className="floating-card">
                <span className="resolved-circle">
                  <Check size={18} />
                </span>
                <div>
                  <strong>Good things happen</strong>
                  <span>when we look out for our block.</span>
                </div>
                <Leaf size={25} className="leaf" />
              </div>
              <div className="art-caption">
                <span />A LITTLE LOCAL CARE GOES A LONG WAY
              </div>
            </div>
          </section>
        )}
        <section id="neighborhood" className="neighborhood">
          <div className="section-top">
            <div>
              <div className="eyebrow">
                {view === "mine"
                  ? "YOUR CONTRIBUTIONS"
                  : view === "admin"
                    ? "COMMUNITY STEWARDSHIP"
                    : "THE NEIGHBORHOOD PULSE"}
              </div>
              <h2>
                {view === "mine"
                  ? "Your reports, in one place."
                  : view === "admin"
                    ? "Review. Route. Resolve."
                    : "Local issues. Shared progress."}
              </h2>
              <p>
                {view === "mine"
                  ? "Follow every issue you’ve brought to light."
                  : view === "admin"
                    ? "Select a report to review its history and publish an update."
                    : "See what’s happening around you and where a little care is needed."}
              </p>
            </div>
            <span className="live-label">
              <span />
              Community reporting
            </span>
          </div>
          {view !== "mine" && (
            <>
              <div className="toolbar">
                <div
                  className="filter-tabs"
                  aria-label="Filter by report status"
                >
                  {[
                    ["", "All issues"],
                    ["submitted", "Reported"],
                    ["in_progress", "In progress"],
                    ["resolved", "Resolved"],
                  ].map(([v, t]) => (
                    <button
                      key={v}
                      className={filters.status === v ? "active" : ""}
                      onClick={() => setFilters((f) => ({ ...f, status: v }))}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="search-controls">
                  <label className="search">
                    <Search size={17} />
                    <input
                      aria-label="Search issues"
                      placeholder="Search issues or places"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <button
                    className={"filter-button " + (showFilters ? "active" : "")}
                    onClick={() => setShowFilters(!showFilters)}
                    aria-expanded={showFilters}
                  >
                    <SlidersHorizontal size={17} />
                    Filters
                  </button>
                </div>
              </div>
              {showFilters && (
                <div className="extra-filters">
                  <label>
                    Category
                    <select
                      value={filters.category}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, category: e.target.value }))
                      }
                    >
                      <option value="">All categories</option>
                      {categories.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Area
                    <select
                      value={filters.jurisdiction}
                      onChange={(e) =>
                        setFilters((f) => ({
                          ...f,
                          jurisdiction: e.target.value,
                        }))
                      }
                    >
                      <option value="">All areas</option>
                      <option value="new_brunswick">New Brunswick</option>
                      <option value="rutgers">Rutgers</option>
                    </select>
                  </label>
                  <label>
                    Severity
                    <select
                      value={filters.severity}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, severity: e.target.value }))
                      }
                    >
                      <option value="">All severities</option>
                      {["low", "medium", "high"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      value={filters.status}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, status: e.target.value }))
                      }
                    >
                      <option value="">All statuses</option>
                      {statuses.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="text-button"
                    onClick={() => {
                      setFilters({
                        category: "",
                        status: "",
                        jurisdiction: "",
                        severity: "",
                        q: "",
                      });
                      setSearch("");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </>
          )}
          <div className="results-heading">
            <span>
              {loading
                ? "Finding local reports…"
                : `${total} ${total === 1 ? "issue" : "issues"} ${view === "mine" ? "submitted by you" : "found"}`}
            </span>
            {view !== "mine" && (
              <div className="view-toggle">
                <button
                  className={display === "split" ? "active" : ""}
                  aria-label="Show map and reports"
                  onClick={() => setDisplay("split")}
                >
                  <MapPin size={15} />
                  Map + list
                </button>
                <button
                  className={display === "list" ? "active" : ""}
                  aria-label="Show report list"
                  onClick={() => setDisplay("list")}
                >
                  <LayoutDashboard size={15} />
                  List
                </button>
              </div>
            )}
          </div>
          {error && (
            <div className="error" role="alert">
              <AlertTriangle size={18} />
              {error}
              <button onClick={refresh}>Try again</button>
            </div>
          )}
          <div
            className={
              "results " +
              (display === "split" && view !== "mine" ? "with-map" : "")
            }
          >
            <div className="report-list" aria-live="polite">
              {loading ? (
                <div className="empty">
                  <LoaderCircle className="spin" />
                  <h3>Checking the neighborhood</h3>
                </div>
              ) : reports.length ? (
                reports.map((r) => (
                  <ReportCard key={r.id} report={r} onSelect={setSelected} />
                ))
              ) : (
                <div className="empty">
                  <span className="empty-icon">
                    <Leaf size={27} />
                  </span>
                  <h3>
                    {error
                      ? "We couldn’t load reports"
                      : "A fresh start for this neighborhood"}
                  </h3>
                  <p>
                    {error
                      ? "Please try again in a moment."
                      : "No reports match this view. Be the first to bring an issue to light."}
                  </p>
                  {!error && (
                    <button
                      className="secondary"
                      onClick={() => setModal(user ? "report" : "auth")}
                    >
                      <Plus size={16} />
                      Report an issue
                    </button>
                  )}
                </div>
              )}
            </div>
            {display === "split" && view !== "mine" && (
              <div className="map-panel">
                <Suspense fallback={<MapFallback />}>
                  <CityMap reports={reports} onSelect={setSelected} />
                </Suspense>
                <div className="map-legend">
                  <span>
                    <i className="gold" />
                    Reported
                  </span>
                  <span>
                    <i className="teal" />
                    In progress
                  </span>
                  <span>
                    <i className="green" />
                    Resolved
                  </span>
                </div>
                <div className="map-note">
                  Showing up to 12 reports on this page
                </div>
              </div>
            )}
          </div>
          {view !== "mine" && total > 12 && (
            <div className="pagination">
              <button
                className="secondary"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              <span>
                Page {page} of {Math.ceil(total / 12)}
              </span>
              <button
                className="secondary"
                disabled={page >= Math.ceil(total / 12)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </section>
        {view === "explore" && (
          <section className="how">
            <div className="how-title">
              <div className="eyebrow">SMALL ACTIONS. REAL CHANGE.</div>
              <h2>
                A little care.
                <br />A better place.
              </h2>
            </div>
            {stats.map(([n, t, d]) => (
              <div className="step" key={n}>
                <span>{n}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </section>
        )}
      </main>
      <footer>
        <a className="brand" href="#">
          <span className="brand-mark">
            <MapPin size={19} />
          </span>
          CityFix<span className="brand-nb">NB</span>
        </a>
        <span>Made for the places we call home.</span>
        <span className="footer-note">
          Independent community project · Not an official city or Rutgers
          service
        </span>
      </footer>
      {modal === "auth" && (
        <Auth onClose={() => setModal(null)} onUser={setUser} />
      )}
      {modal === "report" && (
        <ReportForm onClose={() => setModal(null)} onCreated={refresh} />
      )}
      {modal === "profile" && user && (
        <Profile user={user} onUser={setUser} onClose={() => setModal(null)} />
      )}
      {selected && (
        <Detail
          report={selected}
          user={user}
          onClose={() => setSelected(null)}
          onUpdated={refresh}
        />
      )}
    </>
  );
}
