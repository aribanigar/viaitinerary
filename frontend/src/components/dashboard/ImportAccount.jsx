import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Info,
} from "lucide-react";
import { toast } from "react-toastify";
import DashboardLayout from "./DashboardLayout";
import { useAuth } from "../../context/AuthContext";
import {
  connectTravelAgency,
  runImportStep,
  finishTravelAgencyImport,
} from "../../api/accountImport";

const SITE = "viakashmiritinerary.in";

// What can be brought over, in the order it runs (catalog before the trips
// and packages that point at it).
const SECTIONS = [
  { key: "settings", label: "Agency settings & policies", hint: "Branding, contact details, bank details, terms. Only fields still empty here are filled." },
  { key: "destinations", label: "Destinations" },
  { key: "hotels", label: "Hotels & rate sheets" },
  { key: "vehicles", label: "Vehicles" },
  { key: "leads", label: "Lead inquiries" },
  { key: "trips", label: "Trips & itineraries", hint: "Every day, hotel stay, cab, price and payment total." },
  { key: "packages", label: "Packages" },
];

const zero = () => ({ created: 0, linked: 0, skipped: 0, failed: 0 });
const add = (a, b) => ({
  created: a.created + (b?.created || 0),
  linked: a.linked + (b?.linked || 0),
  skipped: a.skipped + (b?.skipped || 0),
  failed: a.failed + (b?.failed || 0),
});
const processed = (s) => s.created + s.linked + s.skipped + s.failed;

const ImportAccount = () => {
  const { token, user } = useAuth();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [session, setSession] = useState(null); // { handle, account, counts }
  const [selected, setSelected] = useState(() => new Set(SECTIONS.map((s) => s.key)));
  const [progress, setProgress] = useState({}); // key -> { state, stats }
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [notes, setNotes] = useState([]);
  const [errors, setErrors] = useState([]);
  const [problem, setProblem] = useState("");

  const isOwner = user?.role === "admin" || user?.role === "super_admin";

  const totals = useMemo(() => {
    const all = Object.values(progress).reduce((t, p) => add(t, p.stats), zero());
    return all;
  }, [progress]);

  const handleConnect = async (e) => {
    e.preventDefault();
    if (!password) return;
    setConnecting(true);
    setProblem("");
    try {
      const data = await connectTravelAgency(token, { email: user.email, password });
      setSession(data);
      setPassword("");
      setFinished(false);
      setProgress({});
      setNotes([]);
      setErrors([]);
    } catch (err) {
      setProblem(err.message || "Could not connect.");
    } finally {
      setConnecting(false);
    }
  };

  const toggle = (key) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const runImport = async () => {
    if (!session) return;
    setRunning(true);
    setProblem("");
    const order = SECTIONS.filter((s) => selected.has(s.key));
    try {
      for (const section of order) {
        let page = 1;
        let stats = zero();
        setProgress((p) => ({ ...p, [section.key]: { state: "running", stats } }));
        while (page) {
          const r = await runImportStep(token, { handle: session.handle, step: section.key, page });
          stats = add(stats, r.stats);
          if (r.notes?.length) setNotes((n) => [...n, ...r.notes]);
          if (r.errors?.length) setErrors((x) => [...x, ...r.errors]);
          setProgress((p) => ({ ...p, [section.key]: { state: r.next ? "running" : "done", stats } }));
          page = r.next;
        }
      }
      await finishTravelAgencyImport(token, session.handle).catch(() => {});
      setFinished(true);
      setSession(null);
      toast.success("Import finished");
    } catch (err) {
      setProgress((p) => {
        const next = { ...p };
        Object.keys(next).forEach((k) => {
          if (next[k].state === "running") next[k] = { ...next[k], state: "stopped" };
        });
        return next;
      });
      setProblem(err.message || "The import stopped.");
      if (err.status === 409) setSession(null); // reconnect to continue
    } finally {
      setRunning(false);
    }
  };

  const countOf = (key) => {
    const n = session?.counts?.[key];
    return key === "settings" ? null : typeof n === "number" ? n : null;
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 leading-tight flex items-center gap-3">
            <ArrowRightLeft className="w-7 h-7 text-slate-400" /> Import your account
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Have an account on {SITE} with this same email? Bring all of its data here: trips and their itineraries,
            hotels, vehicles, destinations, leads, packages and agency settings.
          </p>
        </div>

        {!isOwner ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Only the agency owner can import an account. Ask your admin to run it.
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 mb-6">
              <h2 className="text-base font-bold text-slate-900 mb-1">1. Sign in to {SITE}</h2>
              <p className="text-sm text-slate-500 mb-5">
                Use the same account you have there. It must be the agency owner's login with the email below.
              </p>

              {session ? (
                <div className="flex items-start gap-3 rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    Connected as <b>{session.account?.name || session.account?.email}</b> ({session.account?.email}).
                  </div>
                </div>
              ) : (
                <form onSubmit={handleConnect} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Email</label>
                    <input
                      value={user?.email || ""}
                      readOnly
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm font-semibold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Password on {SITE}</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="off"
                        className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-4 pr-11 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5">
                      <Lock className="w-3 h-3" /> Used once to open a read-only session there. It is not stored.
                    </p>
                  </div>
                  <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs text-amber-800">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>
                      {SITE} allows one sign-in at a time, so connecting here signs you out there. Just sign in again on{" "}
                      {SITE} afterwards. Nothing there is changed or deleted. Signed up there with Google? Set a password
                      with "Forgot password" on {SITE} first.
                    </span>
                  </div>
                  <button
                    type="submit"
                    disabled={connecting || !password}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#181c22] text-white hover:bg-black disabled:opacity-50 flex items-center gap-2"
                  >
                    {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Connect
                  </button>
                </form>
              )}
            </div>

            <div className={`rounded-2xl border border-slate-200 bg-white p-6 ${session || running || finished ? "" : "opacity-60"}`}>
              <h2 className="text-base font-bold text-slate-900 mb-1">2. Choose what to import</h2>
              <p className="text-sm text-slate-500 mb-5">
                Safe to run again: anything already imported, or already here (same trip code, same hotel name and city),
                is skipped. Your own edits here are never overwritten.
              </p>

              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
                {SECTIONS.map((s) => {
                  const p = progress[s.key];
                  const total = countOf(s.key);
                  const done = p ? processed(p.stats) : 0;
                  return (
                    <label key={s.key} className="flex items-start gap-3 px-4 py-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1 w-4 h-4 accent-[#181c22]"
                        checked={selected.has(s.key)}
                        disabled={running || !session}
                        onChange={() => toggle(s.key)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-bold text-slate-900">{s.label}</span>
                          <span className="text-xs font-semibold text-slate-400 shrink-0">
                            {p?.state === "running" && <Loader2 className="inline w-3.5 h-3.5 animate-spin mr-1" />}
                            {p
                              ? `${p.stats.created} added · ${p.stats.linked + p.stats.skipped} already here${p.stats.failed ? ` · ${p.stats.failed} failed` : ""}`
                              : total != null
                                ? `${total} on ${SITE}`
                                : ""}
                          </span>
                        </div>
                        {s.hint && <p className="text-xs text-slate-400 mt-0.5">{s.hint}</p>}
                        {p && total ? (
                          <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full bg-[#181c22] transition-all"
                              style={{ width: `${Math.min(100, p.state === "done" ? 100 : (done / total) * 100)}%` }}
                            />
                          </div>
                        ) : null}
                      </div>
                    </label>
                  );
                })}
              </div>

              {problem && (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{problem}</span>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  onClick={runImport}
                  disabled={!session || running || selected.size === 0}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#e7f63c] text-[#181c22] hover:bg-[#d4e42e] disabled:opacity-50 flex items-center gap-2"
                >
                  {running && <Loader2 className="w-4 h-4 animate-spin" />}
                  {running ? "Importing..." : "Import"}
                </button>
                {running && <span className="text-xs text-slate-400">Keep this page open until it finishes.</span>}
              </div>
            </div>

            {finished && (
              <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-6">
                <h2 className="text-base font-bold text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> Import finished
                </h2>
                <p className="text-sm text-emerald-800 mt-1">
                  {totals.created} added, {totals.linked + totals.skipped} were already here
                  {totals.failed ? `, ${totals.failed} could not be imported` : ""}. The session on {SITE} is closed: sign in
                  again there if you still use it.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to="/my-trips" className="px-3 py-1.5 rounded-lg bg-white text-xs font-bold text-slate-700 border border-emerald-100">Trips</Link>
                  <Link to="/accommodation" className="px-3 py-1.5 rounded-lg bg-white text-xs font-bold text-slate-700 border border-emerald-100">Hotels</Link>
                  <Link to="/lead-inquiries" className="px-3 py-1.5 rounded-lg bg-white text-xs font-bold text-slate-700 border border-emerald-100">Leads</Link>
                  <Link to="/packages" className="px-3 py-1.5 rounded-lg bg-white text-xs font-bold text-slate-700 border border-emerald-100">Packages</Link>
                </div>
              </div>
            )}

            {(notes.length > 0 || errors.length > 0) && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm">
                {notes.length > 0 && (
                  <>
                    <h3 className="font-bold text-slate-900 mb-2">Notes</h3>
                    <ul className="list-disc pl-5 space-y-1 text-slate-600 mb-4">
                      {[...new Set(notes)].map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  </>
                )}
                {errors.length > 0 && (
                  <>
                    <h3 className="font-bold text-slate-900 mb-2">Not imported</h3>
                    <ul className="list-disc pl-5 space-y-1 text-red-600">
                      {errors.slice(0, 50).map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ImportAccount;
