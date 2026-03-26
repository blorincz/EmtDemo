import { useEffect, useState, type SubmitEvent, useCallback } from "react";
import "./App.css";

type Incident = {
  patientName: string;
  incidentAt: string;
  location: string;
  crewMember: string;
  notes: string;
  pulse: number;
  systolic: number;
  diastolic: number;
  temperatureC: number;
  respiratoryRate: number;
  spo2: number;
};

const QUEUE_KEY = "emt-offline-queue";

const getApiBase = () =>
  import.meta.env.VITE_API_BASE_URL ?? "https://localhost:7112";

// Default values for a new incident
const getDefaultIncident = (): Incident => ({
  patientName: "",
  incidentAt: new Date().toISOString().slice(0, 16),
  location: "",
  crewMember: "",
  notes: "",
  pulse: 80,
  systolic: 120,
  diastolic: 80,
  temperatureC: 36.7,
  respiratoryRate: 16,
  spo2: 98,
});

function App() {
  const [incident, setIncident] = useState<Incident>(getDefaultIncident());
  const [userMessage, setUserMessage] = useState("Ready"); // User-facing status message
  const [queue, setQueue] = useState<Incident[]>([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadQueue = useCallback(() => {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [] as Incident[];
    try {
      return JSON.parse(raw) as Incident[];
    } catch {
      return [] as Incident[];
    }
  }, []);

  const saveQueue = useCallback((items: Incident[]) => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
    setQueue(items);
  }, []);

  // Update user message based on current state
  const updateUserMessage = useCallback(() => {
    if (!online) {
      setUserMessage("Offline mode - incidents will be queued");
    } else if (apiAvailable === false) {
      if (queue.length > 0) {
        setUserMessage(
          `API unavailable - ${queue.length} incident(s) queued waiting for API`,
        );
      } else {
        setUserMessage("API unavailable - cannot submit incidents");
      }
    } else if (isSyncing) {
      setUserMessage("Syncing queued incidents...");
    } else if (queue.length > 0) {
      setUserMessage(
        `${queue.length} incident(s) queued - will sync when API available`,
      );
    } else if (apiAvailable === true) {
      setUserMessage("Ready - API available");
    } else if (apiAvailable === null) {
      setUserMessage("Checking API availability...");
    } else {
      setUserMessage("Ready");
    }
  }, [online, apiAvailable, queue.length, isSyncing]);

  // Check if API is available using health endpoint
  const checkApiAvailability = useCallback(async () => {
    try {
      setUserMessage("Checking API availability...");

      const cacheBuster = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      const response = await fetch(
        `${getApiBase()}/api/health?_=${cacheBuster}`,
        {
          method: "GET",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Accept: "application/json",
          },
          signal: controller.signal,
          cache: "no-store",
          mode: "cors",
        },
      );

      clearTimeout(timeoutId);

      // Check if we got a proper JSON response from the API
      const contentType = response.headers.get("content-type");
      const isJsonResponse =
        contentType !== null && contentType.includes("application/json");
      const isAvailable = isJsonResponse && response.ok;

      setApiAvailable(isAvailable);

      if (isAvailable) {
        console.log("API health check passed");
      } else {
        console.log("API health check failed - invalid response");
      }

      return isAvailable;
    } catch (error) {
      // Network error, timeout, or connection refused means API is unavailable
      console.log("API health check failed:", error);
      setApiAvailable(false);
      return false;
    }
  }, []);

  const syncQueue = useCallback(async () => {
    const items = loadQueue();
    if (!items.length) return;

    // Check if API is available before syncing
    const apiIsAvailable = await checkApiAvailability();
    if (!apiIsAvailable) {
      updateUserMessage();
      return;
    }

    setIsSyncing(true);
    const api = `${getApiBase()}/api/incidents`;
    let syncedCount = 0;

    try {
      for (const item of items) {
        try {
          const response = await fetch(api, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-cache",
            },
            body: JSON.stringify({
              ...item,
              incidentAt: new Date(item.incidentAt).toISOString(),
            }),
          });

          if (response.ok) {
            syncedCount++;
          } else {
            console.error(
              "Failed to sync item, server responded with:",
              response.status,
            );
            break;
          }
        } catch (error) {
          console.error("Failed to sync item:", error);
          break;
        }
      }

      if (syncedCount > 0) {
        const remainingItems = items.slice(syncedCount);
        saveQueue(remainingItems);
        setUserMessage(
          `Synced ${syncedCount} incident(s)${remainingItems.length ? `, ${remainingItems.length} remaining` : ""}`,
        );

        // Clear success message after 3 seconds
        setTimeout(() => updateUserMessage(), 3000);
      }
    } catch (error) {
      console.error("Sync failed", error);
      setUserMessage("Sync failed - will retry later");
      setTimeout(() => updateUserMessage(), 3000);
    } finally {
      setIsSyncing(false);
    }
  }, [loadQueue, checkApiAvailability, saveQueue, updateUserMessage]);

  useEffect(() => {
    setQueue(loadQueue());

    // Initial API check
    checkApiAvailability().then(() => updateUserMessage());

    const onOnline = async () => {
      setOnline(true);
      setUserMessage("Back online - checking API...");
      const apiAvailable = await checkApiAvailability();
      if (apiAvailable) {
        await syncQueue();
      }
      updateUserMessage();
    };

    const onOffline = () => {
      setOnline(false);
      setApiAvailable(false);
      setUserMessage("Offline mode - incidents will be queued");
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // Periodically check API availability when online (every 30 seconds)
    let apiCheckInterval: ReturnType<typeof setInterval>;
    if (navigator.onLine) {
      apiCheckInterval = setInterval(async () => {
        const available = await checkApiAvailability();
        if (available && loadQueue().length > 0) {
          await syncQueue();
        }
        updateUserMessage();
      }, 30000);
    }

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if (apiCheckInterval) clearInterval(apiCheckInterval);
    };
  }, [loadQueue, checkApiAvailability, syncQueue, updateUserMessage]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }
  }, []);

  // Update user message whenever relevant state changes
  useEffect(() => {
    updateUserMessage();
  }, [updateUserMessage]);

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();

    if (isSubmitting) return;
    setIsSubmitting(true);

    const payload = {
      ...incident,
      incidentAt: new Date(incident.incidentAt).toISOString(),
    };

    // Check if we can submit online
    if (!navigator.onLine || apiAvailable === false) {
      const updated = [...loadQueue(), payload];
      saveQueue(updated);
      setUserMessage(
        `Saved offline (${queue.length + 1} queued); will sync when API available`,
      );
      resetForm();
      setIsSubmitting(false);
      setTimeout(() => updateUserMessage(), 3000);
      return;
    }

    // Try to submit online
    try {
      const response = await fetch(`${getApiBase()}/api/incidents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Save failed");

      setUserMessage("Incident submitted successfully");
      await syncQueue();
      resetForm();
      setTimeout(() => updateUserMessage(), 3000);
    } catch (error) {
      // Check if it's a network error
      const isNetworkError =
        error instanceof TypeError &&
        (error.message === "Failed to fetch" ||
          error.message === "NetworkError when attempting to fetch resource");

      if (isNetworkError) {
        setApiAvailable(false);
      }

      // Queue it offline
      const updated = [...loadQueue(), payload];
      saveQueue(updated);
      setUserMessage(
        isNetworkError
          ? "API unavailable - incident queued"
          : "Submit failed - incident queued",
      );
      resetForm();
      setTimeout(() => updateUserMessage(), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setIncident(getDefaultIncident());
  };

  const manualSync = async () => {
    if (!navigator.onLine) {
      setUserMessage("Cannot sync - device is offline");
      setTimeout(() => updateUserMessage(), 3000);
      return;
    }

    setUserMessage("Checking API availability...");
    const apiIsAvailable = await checkApiAvailability();

    if (!apiIsAvailable) {
      setUserMessage("Cannot sync - API is not responding");
      setTimeout(() => updateUserMessage(), 3000);
      return;
    }

    await syncQueue();
  };

  // Determine badge display (kept simple for badge)
  const getStatusColor = () => {
    if (!online) return "offline";
    if (apiAvailable === false) return "api-unavailable";
    if (queue.length > 0) return "has-queue";
    return "online";
  };

  const getStatusMessage = () => {
    if (!online) return "Offline Mode";
    if (apiAvailable === false) return "API Unavailable";
    if (isSyncing) return "Syncing...";
    if (queue.length > 0) return `${queue.length} queued`;
    return "Ready";
  };

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="kicker">EMT Offline PWA</p>
          <h1>Rugged Tablet Incident Capture</h1>
          <p>
            Capture patient details and vital signs. Works offline and syncs
            when online.
          </p>
        </div>
        <div className="hero-badge">
          <div className={`badge ${getStatusColor()}`}>
            {getStatusMessage()}
          </div>
        </div>
      </header>

      <section className="card">
        <h2>Patient & Incident</h2>
        <form onSubmit={submit} className="form-grid">
          <label>
            Patient Name
            <input
              value={incident.patientName}
              onChange={(e) =>
                setIncident((s) => ({ ...s, patientName: e.target.value }))
              }
              required
              disabled={isSubmitting}
            />
          </label>

          <label>
            Incident Date/Time
            <input
              type="datetime-local"
              value={incident.incidentAt}
              onChange={(e) =>
                setIncident((s) => ({ ...s, incidentAt: e.target.value }))
              }
              required
              disabled={isSubmitting}
            />
          </label>

          <label>
            Location
            <input
              value={incident.location}
              onChange={(e) =>
                setIncident((s) => ({ ...s, location: e.target.value }))
              }
              required
              disabled={isSubmitting}
            />
          </label>

          <label>
            Crew Member
            <input
              value={incident.crewMember}
              onChange={(e) =>
                setIncident((s) => ({ ...s, crewMember: e.target.value }))
              }
              required
              disabled={isSubmitting}
            />
          </label>

          <label>
            Notes
            <textarea
              value={incident.notes}
              onChange={(e) =>
                setIncident((s) => ({ ...s, notes: e.target.value }))
              }
              disabled={isSubmitting}
            />
          </label>

          <label>
            Pulse
            <input
              type="number"
              value={incident.pulse}
              onChange={(e) =>
                setIncident((s) => ({ ...s, pulse: Number(e.target.value) }))
              }
              required
              disabled={isSubmitting}
            />
          </label>

          <label>
            Systolic
            <input
              type="number"
              value={incident.systolic}
              onChange={(e) =>
                setIncident((s) => ({ ...s, systolic: Number(e.target.value) }))
              }
              required
              disabled={isSubmitting}
            />
          </label>

          <label>
            Diastolic
            <input
              type="number"
              value={incident.diastolic}
              onChange={(e) =>
                setIncident((s) => ({
                  ...s,
                  diastolic: Number(e.target.value),
                }))
              }
              required
              disabled={isSubmitting}
            />
          </label>

          <label>
            Temp (°C)
            <input
              type="number"
              step="0.1"
              value={incident.temperatureC}
              onChange={(e) =>
                setIncident((s) => ({
                  ...s,
                  temperatureC: Number(e.target.value),
                }))
              }
              required
              disabled={isSubmitting}
            />
          </label>

          <label>
            Resp Rate
            <input
              type="number"
              value={incident.respiratoryRate}
              onChange={(e) =>
                setIncident((s) => ({
                  ...s,
                  respiratoryRate: Number(e.target.value),
                }))
              }
              required
              disabled={isSubmitting}
            />
          </label>

          <label>
            SpO2
            <input
              type="number"
              value={incident.spo2}
              onChange={(e) =>
                setIncident((s) => ({ ...s, spo2: Number(e.target.value) }))
              }
              required
              disabled={isSubmitting}
            />
          </label>

          <div className="form-buttons">
            <button className="submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Incident"}
            </button>
            <button
              className="reset"
              type="button"
              onClick={resetForm}
              disabled={isSubmitting}
            >
              Reset Form
            </button>
            {queue.length > 0 && (
              <button
                className="sync"
                type="button"
                onClick={manualSync}
                disabled={isSyncing || !online}
              >
                {isSyncing ? "Syncing..." : `Sync Queue (${queue.length})`}
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card">
        <h2>Status & Queue</h2>
        <div className="status-details">
          <p>
            <strong>Status:</strong> {userMessage}
          </p>
          <p>
            <strong>Network:</strong> {online ? "Online" : "Offline"}
          </p>
          <p>
            <strong>API:</strong>{" "}
            {apiAvailable === null
              ? "Checking..."
              : apiAvailable
                ? "Available"
                : "Unavailable"}
          </p>
          <p>
            <strong>Queued incidents:</strong> {queue.length}
          </p>
        </div>

        {queue.length > 0 && (
          <>
            <h3>Pending Incidents</h3>
            <ul className="queue-list">
              {queue.map((inc, idx) => (
                <li key={`${inc.patientName}-${idx}-${inc.incidentAt}`}>
                  <strong>{inc.patientName}</strong> -{" "}
                  {new Date(inc.incidentAt).toLocaleString()}
                  <br />
                  <small>
                    {inc.location} | {inc.crewMember}
                  </small>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}

export default App;
