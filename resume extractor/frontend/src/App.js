import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiZap, FiTarget, FiCode, FiShield, FiUploadCloud, FiCopy } from "react-icons/fi";
import "./App.css";

/* ----------------------
  API base URL
------------------------*/
const API = process.env.REACT_APP_API_URL || "https://resume-extractor-backend-ockg.onrender.com";

/* ----------------------
  Utility helpers
------------------------*/
const humanFileSize = (bytes) => {
  if (!bytes) return "0 B";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const sizes = ["B", "KB", "MB", "GB"];
  return (bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0) + " " + sizes[i];
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ----------------------
  Main App component
------------------------*/
export default function App() {
  const [jobRole, setJobRole] = useState("data analyst");
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  // Backend wake-up state
  const [backendReady, setBackendReady] = useState(false);
  const [backendChecking, setBackendChecking] = useState(true);

  const MAX_FILE_BYTES = 12 * 1024 * 1024; // 12MB per file

  /* ----------------------
    Health-check ping on mount
  ------------------------*/
  const pingBackend = useCallback(async () => {
    setBackendChecking(true);
    try {
      const res = await fetch(`${API}/health`, { method: "GET" });
      if (res.ok) {
        setBackendReady(true);
        setBackendChecking(false);
        return true;
      }
      setBackendReady(false);
      setBackendChecking(false);
      return false;
    } catch {
      setBackendReady(false);
      setBackendChecking(false);
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retryTimer;

    const check = async () => {
      const ok = await pingBackend();
      // If backend is cold, retry every 5 seconds until it wakes up
      if (!ok && !cancelled) {
        retryTimer = setInterval(async () => {
          const ready = await pingBackend();
          if (ready || cancelled) {
            clearInterval(retryTimer);
          }
        }, 5000);
      }
    };

    check();

    return () => {
      cancelled = true;
      if (retryTimer) clearInterval(retryTimer);
    };
  }, [pingBackend]);

  /* ----------------------
    Fetch with retry logic
  ------------------------*/
  const fetchWithRetry = async (url, options, retries = 1) => {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      if (retries > 0) {
        setStatusMessage("Retrying...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return fetchWithRetry(url, options, retries - 1);
      }
      throw err;
    }
  };

  /* ----------------------
    Batch upload handler
  ------------------------*/
  const handleBatchUpload = async (e) => {
    setError(null);
    setStatusMessage("");
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // quick validation
    const tooBig = files.find(f => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      setError(`File "${tooBig.name}" is too large (${humanFileSize(tooBig.size)}). Max ${humanFileSize(MAX_FILE_BYTES)}.`);
      return;
    }

    setLoading(true);
    setRankings([]);
    setStatusMessage("Preparing upload...");

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));

    try {
      setStatusMessage("Uploading & analyzing resumes...");
      const url = `${API}/batch-analyze?job_role=${encodeURIComponent(jobRole)}`;
      const res = await fetchWithRetry(url, { method: "POST", body: formData });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Server responded ${res.status}`);
      }
      const data = await res.json();
      const normalized = data.map((d, i) => ({
        ...d,
        score: clamp(Number(d.score || 0), 0, 100),
        id: d.id || `${d.name}-${i}`
      }));
      setRankings(normalized);
      setStatusMessage(`Analyzed ${normalized.length} resumes`);
    } catch (err) {
      console.error(err);
      setError("Upload failed. Check backend or network. " + (err.message || ""));
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
      setTimeout(() => setStatusMessage(""), 3000);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatusMessage("Copied to clipboard");
      setTimeout(() => setStatusMessage(""), 2000);
    } catch {
      setStatusMessage("Copy failed");
    }
  };

  const scrollToHero = () => {
    document.getElementById('hero').scrollIntoView({ behavior: 'smooth' });
  };

  // Determine if upload should be disabled
  const uploadDisabled = loading || (!backendReady && backendChecking);

  // Upload button label
  const getUploadLabel = () => {
    if (loading) return "Analyzing...";
    if (!backendReady && backendChecking) return "Waking up backend...";
    if (!backendReady) return "Backend offline — retry";
    return "Batch Upload & Match";
  };

  return (
    <div className="content-wrapper">
      <div className="ambient-glow"></div>

      {/* Navigation Bar */}
      <nav className="navbar">
        <div style={{ fontWeight: 900, fontSize: "1.2rem", letterSpacing: "1px" }}>
          RESUME<span className="text-gradient">EXTRACTOR</span>
        </div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#docs">API Docs</a>
          <a href="#pricing">Pricing</a>

          {/* Backend status indicator */}
          <div className="backend-status">
            <span
              className={`status-dot ${
                backendReady ? "status-ready" : backendChecking ? "status-waking" : "status-offline"
              }`}
            />
            <span className="status-text">
              {backendReady
                ? "Ready"
                : backendChecking
                ? "Waking up... (~30s)"
                : "Offline"}
            </span>
          </div>
        </div>
        <button className="btn-neon" onClick={scrollToHero}>
          Start Extracting <FiZap />
        </button>
      </nav>

      {/* Hero Section */}
      <section id="hero" className="hero">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.8 }}
        >
          Resume Parsing That <span className="text-gradient">Simply Works.</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          Turn messy PDFs and Word docs into clean, structured data in milliseconds. 
          Powered by state-of-the-art AI. No data mapping required.
        </motion.p>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} 
          animate={{ opacity: 1, scale: 1 }} 
          transition={{ duration: 0.8, delay: 0.4 }}
          style={{ position: 'relative', zIndex: 10, width: "100%", maxWidth: "800px", marginTop: "2rem" }}
        >
          {/* Uploader Dashboard directly in Hero */}
          <div className="glass-panel" style={{ padding: "2rem", borderRadius: "24px" }}>
            <div style={{ display: "flex", flexFlow: "column", gap: "1rem" }}>
              <div style={{ textAlign: "left" }}>
                <label style={{ display: "block", color: "var(--text-dim)", marginBottom: "0.5rem", fontSize: "0.9rem" }}>Job Requirement / Description</label>
                <textarea 
                  className="select-dark" 
                  style={{ width: "100%", height: "80px", padding: "12px", resize: "none" }} 
                  placeholder="Paste the Job Description here for semantic matching..."
                  value={jobRole} 
                  onChange={e => setJobRole(e.target.value)} 
                />
              </div>

              <div style={{ display: "flex", gap: "1rem" }}>
                <label
                  className={`btn-neon ${uploadDisabled ? "btn-disabled" : ""}`}
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    height: "48px",
                    cursor: uploadDisabled ? "not-allowed" : "pointer",
                    opacity: uploadDisabled ? 0.6 : 1,
                  }}
                >
                  <FiUploadCloud size={20} />
                  {getUploadLabel()}
                  <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.txt"
                    onChange={handleBatchUpload}
                    style={{ display: "none" }}
                    disabled={uploadDisabled}
                  />
                </label>
              </div>
            </div>

            {/* Status / Messages */}
            <div style={{ marginTop: "1rem", textAlign: "left", fontSize: "0.85rem", color: "var(--text-dim)", display: "flex", justifyContent: "space-between" }}>
              <div>{statusMessage || "Upload PDF or DOCX"}</div>
              {error && <div style={{ color: "#ff4d4d", fontWeight: "bold" }}>{error}</div>}
            </div>

            {/* Backend wake-up banner (shown only when cold) */}
            {!backendReady && backendChecking && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="wake-banner"
              >
                <span className="wake-spinner" />
                Backend waking up... This may take ~30 seconds on free tier.
              </motion.div>
            )}
          </div>
        </motion.div>
      </section>

      {/* Product Showcase */}
      {(rankings.length > 0 || loading) && (
        <section id="showcase" style={{ paddingTop: 0 }}>
          <div className="glass-panel uploader-panel">
            <h2 style={{ margin: "0 0 2rem 0", fontSize: "2rem" }}>Extraction <span className="text-gradient">Results</span></h2>
            
            <div className="results-panel">
              <AnimatePresence>
                {rankings.map((res, i) => {
                   const isTop = i === 0;
                   const percent = clamp(Number(res.score || 0), 0, 100);
                   const conf = res.confidence || 0.0;
                   const relLabel = conf > 0.7 ? "HIGH" : conf > 0.4 ? "MEDIUM" : "LOW";
                   const relColor = conf > 0.7 ? "#34d399" : conf > 0.4 ? "#fbbf24" : "#f87171";

                   // Hide placeholder/fallback explanation
                   const hasRealExplanation = res.explanation && 
                                            !res.explanation.includes("(Local Engine Mode)") && 
                                            res.explanation.trim().length > 0;
                   
                   // Clean match level
                   const hasMatchLevel = res.match_level && res.match_level !== "Unknown" && res.match_level.trim().length > 0;

                   return (
                     <motion.div 
                        initial={{ opacity: 0, y: 30 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        transition={{ delay: i * 0.1 }}
                        className={`result-card ${isTop ? 'result-card-top' : ''}`}
                        key={res.id || res.name}
                     >
                        {/* Header: Score & Meta */}
                        <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1.5rem" }}>
                          <div className="score-circle">
                            {Math.round(percent)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <h3 style={{ margin: 0 }}>{res.name}</h3>
                              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                {conf > 0 && (
                                  <span className="badge" style={{ borderColor: relColor, color: relColor }}>{relLabel} REL</span>
                                )}
                                {hasMatchLevel && (
                                  <span className={`badge ${res.match_level?.toLowerCase().replace(" ", "-")}`}>{res.match_level}</span>
                                )}
                              </div>
                            </div>
                            <div style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginTop: "4px" }}>
                              {res.email && res.email !== "N/A" && <span>{res.email}</span>}
                              {res.size > 0 && (
                                <span>{res.email && res.email !== "N/A" ? " • " : ""}{humanFileSize(res.size)}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Semantic Answer Section */}
                        {hasRealExplanation && (
                          <div className="analysis-box">
                            <label>AI EVALUATION</label>
                            <p>{res.explanation}</p>
                            {res.skills && res.skills.length > 0 && (
                              <div className="skills-tags">
                                {res.skills.map(s => <span key={s} className="skill-tag">{s.toUpperCase()}</span>)}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Grounding Sources Section */}
                        {res.retrieved_chunks && res.retrieved_chunks.length > 0 && (
                          <div className="sources-box">
                            <label>GROUNDING EVIDENCE (TOP CHUNKS)</label>
                            <div className="chunk-list">
                              {res.retrieved_chunks.map((c, idx) => (
                                <div key={idx} className="chunk-item">
                                  <span className="chunk-num">#{idx+1}</span>
                                  <span className="chunk-text">{c}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                     </motion.div>
                   )
                })}
              </AnimatePresence>
            </div>
          </div>
        </section>
      )}

      {/* Feature Grid */}
      <section id="features">
        <h2 style={{ textAlign: "center", fontSize: "2.5rem", marginBottom: "1rem" }}>Built for the <span className="text-gradient">Modern Stack</span></h2>
        <div className="features-grid">
          <div className="glass-panel feature-card">
            <FiZap className="feature-icon" />
            <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Lightning Fast</h3>
            <p style={{ color: "var(--text-dim)", lineHeight: 1.6 }}>Process hundreds of resumes in parallel using advanced asynchronous worker queues. Get results in milliseconds, not minutes.</p>
          </div>
          <div className="glass-panel feature-card">
            <FiTarget className="feature-icon" />
            <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>High Accuracy</h3>
            <p style={{ color: "var(--text-dim)", lineHeight: 1.6 }}>State-of-the-art NLP models correctly identify names, emails, and subtle skill variations with incredible precision.</p>
          </div>
          <div className="glass-panel feature-card">
            <FiCode className="feature-icon" />
            <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Developer Ready</h3>
            <p style={{ color: "var(--text-dim)", lineHeight: 1.6 }}>Clean JSON outputs, fully documented REST API endpoints, and webhooks make integration a breeze.</p>
          </div>
        </div>
      </section>

      {/* Data Privacy Section */}
      <section id="privacy" className="privacy-section">
        <FiShield className="shield-glow" />
        <h2 style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>Enterprise-Grade <span style={{ color: "var(--neon-purple)" }}>Security</span></h2>
        <p style={{ color: "var(--text-dim)", maxWidth: "600px", margin: "0 auto", lineHeight: 1.6, fontSize: "1.1rem" }}>
          Your candidates' data is securely processed in memory. No resumes are permanently stored, ensuring full compliance with GDPR and global privacy standards.
        </p>
      </section>
      
      <footer style={{ textAlign: "center", padding: "2rem", borderTop: "1px solid var(--glass-border)", color: "var(--text-dim)", fontSize: "0.9rem" }}>
        © 2026 Resume Extractor. All rights reserved.
      </footer>
    </div>
  );
}
