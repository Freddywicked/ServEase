import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import AdminSidebar from '../components/AdminSidebar.jsx';
import { getAdminStats } from '../api/client';
import { useAuth } from '../context/auth_context';

const styles = {
  content: { padding: '24px 36px', boxSizing: 'border-box' },
  welcomeHeading: {
    fontFamily: "'Quicksand', sans-serif",
    fontWeight: 700,
    fontSize: 48,
    lineHeight: '100%',
    color: '#005FCA',
    margin: '0 0 4px',
  },
  welcomeSubtext: {
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 400,
    fontSize: 20,
    color: '#292727',
    margin: '0 0 20px',
  },
  statsRow: { display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 20 },
  statCard: {
    flex: '1 1 200px',
    maxWidth: 220,
    height: 132,
    borderRadius: 10,
    padding: '26px 24px',
    boxSizing: 'border-box',
    color: '#FFFFFF',
  },
  statLabel: {
    fontFamily: "'Quicksand', sans-serif",
    fontWeight: 700,
    fontSize: 16,
    margin: '0 0 12px',
  },
  statValue: {
    fontFamily: "'Quicksand', sans-serif",
    fontWeight: 700,
    fontSize: 24,
    margin: 0,
  },
  chartCard: {
    backgroundColor: '#C8E0FC',
    borderRadius: 10,
    padding: '22px 28px',
    boxSizing: 'border-box',
  },
  chartTitle: {
    fontFamily: "'Quicksand', sans-serif",
    fontWeight: 700,
    fontSize: 16,
    color: '#000000',
    margin: '0 0 16px',
  },
  chartEmpty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 240,
    fontFamily: "'Roboto', sans-serif",
    fontSize: 14,
    fontWeight: 500,
    color: '#817C7C',
  },
  axisLabel: {
    fontFamily: "'Roboto', sans-serif",
    fontSize: 12,
    fill: '#333333',
  },
};

// Card definitions (label + color) are layout, not data — the numeric values come from the backend.
const STAT_CARD_DEFS = [
  { key: 'totalUsers', label: 'Total Users', color: '#0255AF' },
  { key: 'activeUsers', label: 'Active Users', color: '#167713' },
  { key: 'customers', label: 'Customers', color: '#04A5A5' },
  { key: 'serviceProviders', label: 'Service Provider', color: '#021E79' },
  { key: 'pendingAccounts', label: 'Pending Accounts', color: '#F9C082' },
];

// Number of calendar days shown on the "User Registration Trend" chart (matches the 7-day span in the Figma design).
const TREND_DAYS = 7;

const CHART_WIDTH = 700;
const CHART_HEIGHT = 240;
const Y_STEP_COUNT = 5;

function formatCount(value) {
  return typeof value === 'number' ? value.toLocaleString() : '0';
}

// Builds a fixed set of day buckets ending today, then counts how many account-creation
// timestamps fall on each day. This turns raw "when did each user register" data into the
// { label, value } points the chart needs — nothing here is hard-coded sample data.
function buildRegistrationTrend(registrationDates, days) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    buckets.push({
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
      value: 0,
    });
  }

  const bucketByKey = new Map(buckets.map((b) => [b.key, b]));

  registrationDates.forEach((raw) => {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return;
    date.setHours(0, 0, 0, 0);
    const bucket = bucketByKey.get(date.toISOString().slice(0, 10));
    if (bucket) bucket.value += 1;
  });

  return buckets.map(({ label, value }) => ({ label, value }));
}

function RegistrationChart({ data, hasData }) {
  if (!hasData) {
    return <div style={styles.chartEmpty}>No registration data yet</div>;
  }

  const yMax = Math.max(...data.map((p) => p.value), 1);
  const yStep = Math.ceil(yMax / Y_STEP_COUNT / 10) * 10 || 1;
  const chartMax = yStep * Y_STEP_COUNT;

  const points = data.map((point, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * CHART_WIDTH + 40 : CHART_WIDTH / 2 + 40;
    const y = CHART_HEIGHT - (point.value / chartMax) * CHART_HEIGHT;
    return { ...point, x, y };
  });

  const linePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
  const gridValues = Array.from({ length: Y_STEP_COUNT + 1 }, (_, i) => i * yStep);

  return (
    <svg
      viewBox={`0 -10 ${CHART_WIDTH + 60} ${CHART_HEIGHT + 40}`}
      style={{ width: '100%', height: 'auto', overflow: 'visible' }}
    >
      {gridValues.map((value) => {
        const y = CHART_HEIGHT - (value / chartMax) * CHART_HEIGHT;
        return (
          <g key={value}>
            <text x={0} y={y + 4} style={styles.axisLabel}>{value}</text>
            <line
              x1={40}
              y1={y}
              x2={CHART_WIDTH + 40}
              y2={y}
              stroke="#DDDDDD"
              strokeWidth={1}
              strokeDasharray={value === 0 ? undefined : '4 4'}
            />
          </g>
        );
      })}

      <polyline
        points={linePoints}
        fill="none"
        stroke="#0255AF"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {points.map((p) => (
        <text key={p.label} x={p.x} y={CHART_HEIGHT + 24} textAnchor="middle" style={styles.axisLabel}>
          {p.label}
        </text>
      ))}
    </svg>
  );
}

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const [stats, setStats] = useState(null); // { totalUsers, activeUsers, customers, serviceProviders, pendingAccounts }
  const [registrationDates, setRegistrationDates] = useState(null); // ISO timestamps, one per recent registration
  const [error, setError] = useState('');

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;
    getAdminStats()
      .then((data) => {
        if (cancelled) return;
        setStats(data.stats);
        setRegistrationDates(data.registration_dates || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Couldn't load the dashboard data.");
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const hasRegistrationData = Array.isArray(registrationDates) && registrationDates.length > 0;
  const registrationTrend = useMemo(
    () => buildRegistrationTrend(registrationDates || [], TREND_DAYS),
    [registrationDates]
  );

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/customer/dashboard" replace />;

  const firstName = user.name?.trim().split(/\s+/)[0] || 'Admin';

  return (
    <AdminSidebar>
      <div style={styles.content}>
        <h1 style={styles.welcomeHeading}>Welcome, {firstName}!</h1>
        <p style={styles.welcomeSubtext}>Here&apos;s what&apos;s happening today.</p>

        {error && (
          <p style={{ color: '#E53935', fontFamily: "'Roboto', sans-serif", fontSize: 13, margin: '0 0 16px' }}>
            {error}
          </p>
        )}

        <div style={styles.statsRow}>
          {STAT_CARD_DEFS.map((card) => (
            <div key={card.key} style={{ ...styles.statCard, backgroundColor: card.color }}>
              <p style={styles.statLabel}>{card.label}</p>
              <p style={styles.statValue}>{formatCount(stats?.[card.key])}</p>
            </div>
          ))}
        </div>

        <div style={styles.chartCard}>
          <h2 style={styles.chartTitle}>User Registration Trend</h2>
          <RegistrationChart data={registrationTrend} hasData={hasRegistrationData} />
        </div>
      </div>
    </AdminSidebar>
  );
}