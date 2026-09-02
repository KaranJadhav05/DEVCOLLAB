import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Server, Database, Radio, RefreshCw, X, ShieldCheck,
  CheckCircle2, AlertTriangle, XCircle, ArrowRight, Cpu, HardDrive, Wifi
} from 'lucide-react';
import { systemAPI } from '../utils/api';

const SERVICE_ICONS = {
  auth: ShieldCheck,
  project: HardDrive,
  messaging: Radio,
  notification: Activity,
};

const SystemHealthModal = ({ isOpen, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await systemAPI.getStatus();
      setData(res);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message || 'Failed to connect to API Gateway');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 6000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 24, stiffness: 280 }}
          style={{
            background: 'var(--card-bg, #1a1a2e)',
            color: 'var(--text-main, #f1f5f9)',
            borderRadius: '1.25rem',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.12))',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.6)',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '2rem',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                padding: '0.65rem',
                borderRadius: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Server size={22} color="#fff" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Distributed System Monitor</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', margin: '0.2rem 0 0 0' }}>
                  Live microservices topology, node latencies, and IPC communication
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <button
                onClick={fetchStatus}
                disabled={loading}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                  color: 'inherit',
                  padding: '0.5rem 0.85rem',
                  borderRadius: '0.6rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
                {loading ? 'Polling...' : 'Refresh'}
              </button>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted, #94a3b8)',
                  cursor: 'pointer',
                  padding: '0.4rem',
                  borderRadius: '0.5rem',
                  display: 'flex',
                }}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#ef4444',
              padding: '0.85rem 1.2rem',
              borderRadius: '0.75rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              fontSize: '0.875rem',
            }}>
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Central API Gateway Card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15))',
            border: '1px solid rgba(168, 85, 247, 0.35)',
            borderRadius: '1rem',
            padding: '1.25rem',
            marginBottom: '1.5rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: '#22c55e',
                  boxShadow: '0 0 12px #22c55e',
                }} />
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>API Gateway (Reverse Proxy)</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
                    Port: 5000 • Ingress Traffic Controller & WebSocket Gateway
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Uptime: </span>
                  <strong>{data?.gateway?.uptimeSeconds || 0}s</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Updated: </span>
                  <strong>{lastUpdated || 'now'}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Microservices Nodes Grid */}
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #94a3b8)', marginBottom: '0.85rem' }}>
            Distributed Backend Nodes ({data?.nodes?.length || 4} Services)
          </h4>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}>
            {data?.nodes ? (
              data.nodes.map((node) => {
                const isOnline = node.status === 'ONLINE';
                const IconComponent = SERVICE_ICONS[node.id] || Server;

                return (
                  <div
                    key={node.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isOnline ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.3)'}`,
                      borderRadius: '0.9rem',
                      padding: '1.1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                          background: isOnline ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: isOnline ? '#22c55e' : '#ef4444',
                          padding: '0.45rem',
                          borderRadius: '0.5rem',
                          display: 'flex',
                        }}>
                          <IconComponent size={18} />
                        </div>
                        <div>
                          <h4 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0 }}>{node.name}</h4>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
                            Port: {node.port} • Node ID: {node.id}
                          </span>
                        </div>
                      </div>

                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.55rem',
                        borderRadius: '9999px',
                        background: isOnline ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: isOnline ? '#22c55e' : '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}>
                        {isOnline ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {node.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem 0.75rem', borderRadius: '0.5rem' }}>
                      <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Network Latency:</span>
                      <strong style={{ color: node.latencyMs < 50 ? '#22c55e' : '#eab308' }}>
                        {node.latencyMs} ms
                      </strong>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {node.routes.map((rt) => (
                        <span key={rt} style={{
                          fontSize: '0.7rem',
                          background: 'rgba(255, 255, 255, 0.06)',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '0.35rem',
                          fontFamily: 'monospace',
                          color: '#a78bfa',
                        }}>
                          {rt}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                Connecting to distributed nodes...
              </div>
            )}
          </div>

          {/* Inter-Process Communication (IPC) Network Map */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
            borderRadius: '1rem',
            padding: '1.25rem',
          }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #94a3b8)', marginBottom: '0.75rem' }}>
              Inter-Process Communication (IPC) & Streaming Protocols (Task 7, 10)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.8rem', background: 'rgba(0,0,0,0.25)', borderRadius: '0.5rem', fontSize: '0.8rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#60a5fa' }}>
                  <strong>Project Service (5002)</strong> <ArrowRight size={14} /> <strong>Notification Service (5004)</strong>
                </span>
                <span style={{ color: '#34d399', fontFamily: 'monospace', fontSize: '0.75rem' }}>HTTP REST IPC (Dispatch Alerts)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.8rem', background: 'rgba(0,0,0,0.25)', borderRadius: '0.5rem', fontSize: '0.8rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#c084fc' }}>
                  <strong>API Gateway (5000)</strong> <ArrowRight size={14} /> <strong>Messaging Service (5003)</strong>
                </span>
                <span style={{ color: '#34d399', fontFamily: 'monospace', fontSize: '0.75rem' }}>WebSocket Stream (Socket.IO + WebRTC)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.8rem', background: 'rgba(0,0,0,0.25)', borderRadius: '0.5rem', fontSize: '0.8rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fbbf24' }}>
                  <strong>Client Peers (P2P)</strong> <ArrowRight size={14} /> <strong>Peer WebRTC Connection</strong>
                </span>
                <span style={{ color: '#34d399', fontFamily: 'monospace', fontSize: '0.75rem' }}>RTCDataChannel (Direct File Transfer)</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SystemHealthModal;
