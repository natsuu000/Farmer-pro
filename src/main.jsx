import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight, Bell, Check, ChevronDown, CircleHelp, Clock3, CloudSun,
  FileText, Headphones, LayoutDashboard, MapPin, Menu, MessageSquare,
  MoveRight, Phone, Play, QrCode, Search, ShieldCheck, Sprout, Tractor,
  TrendingDown, Users, WalletCards, X
} from 'lucide-react';
import './styles.css';

const centres = [
  { name: 'APMC Nashik East', location: 'Nashik, Maharashtra', queue: 14, wait: 32, load: 64, tone: 'good' },
  { name: 'Pune Grain Yard', location: 'Pune, Maharashtra', queue: 41, wait: 92, load: 91, tone: 'busy' },
  { name: 'Sinnar Collection Hub', location: 'Nashik, Maharashtra', queue: 7, wait: 18, load: 38, tone: 'good' }
];

const stages = ['Slot booked', 'Checked in', 'Quality verification', 'Weighing', 'Procurement complete', 'Payment credited'];

function App() {
  const [role, setRole] = useState('farmer');
  const [activeTab, setActiveTab] = useState('Overview');
  const [queue, setQueue] = useState(12);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [stage, setStage] = useState(2);
  const [notice, setNotice] = useState('');
  const [mobileNav, setMobileNav] = useState(false);

  const flash = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2800);
  };

  const callNext = () => {
    setQueue((current) => Math.max(0, current - 1));
    flash('Next farmer called. Queue position updated live.');
  };

  const advanceStage = () => {
    setStage((current) => Math.min(stages.length - 1, current + 1));
    flash(stage >= 4 ? 'Payment status refreshed.' : `Status updated: ${stages[Math.min(stage + 1, stages.length - 1)]}.`);
  };

  const switchRole = (nextRole) => {
    setRole(nextRole);
    setActiveTab(nextRole === 'farmer' ? 'Overview' : nextRole === 'operator' ? 'Queue Desk' : 'Command Centre');
    setMobileNav(false);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" onClick={() => switchRole('farmer')} role="button" tabIndex="0">
          <span className="brand-mark"><Sprout size={21} strokeWidth={2.4} /></span>
          <span><strong>KrishiSetu</strong><small>Smart procurement</small></span>
        </div>
        <div className="prototype-badge"><span className="pulse-dot" /> SIH 2026 Prototype</div>
        <nav className={mobileNav ? 'main-nav open' : 'main-nav'}>
          {['Overview', 'Queue', 'Centres', 'Payments'].map((item) => <button key={item} className={activeTab === item ? 'nav-link active' : 'nav-link'} onClick={() => setActiveTab(item)}>{item}</button>)}
        </nav>
        <div className="header-actions">
          <button className="lang-select">EN <ChevronDown size={14} /></button>
          <button className="icon-button" aria-label="Notifications" onClick={() => flash('You have 3 new procurement updates.')}><Bell size={19} /><span className="notification-dot" /></button>
          <button className="profile-chip" onClick={() => flash('Demo profile: Ramesh Kumar')}><span>RK</span><ChevronDown size={14} /></button>
          <button className="menu-button" onClick={() => setMobileNav(!mobileNav)} aria-label="Open navigation"><Menu size={21} /></button>
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> PUBLIC SERVICE, SIMPLIFIED</p>
            <h1>Procurement<br /><em>without the wait.</em></h1>
            <p className="hero-subtitle">Book your slot, follow your queue, and get paid with confidence. A simpler way for India's farmers to plan their procurement day.</p>
            <div className="hero-actions"><button className="primary-button" onClick={() => setBookingOpen(true)}>Book a procurement slot <ArrowRight size={17} /></button><button className="text-button" onClick={() => setActiveTab('Queue')}><Play size={15} fill="currentColor" /> See how it works</button></div>
            <div className="trust-row"><ShieldCheck size={17} /><span>Demo data only</span><span className="trust-divider" /><span>No Aadhaar or bank details required</span></div>
          </div>
          <div className="hero-visual">
            <div className="sun-disc" />
            <div className="field-lines" />
            <div className="hero-ticket">
              <div className="ticket-top"><span className="live-label"><span className="pulse-dot green" /> LIVE QUEUE</span><span>05 SEP 2026</span></div>
              <div className="ticket-centre"><span className="mini-icon"><MapPin size={14} /></span><div><strong>APMC Nashik East</strong><small>Nashik, Maharashtra</small></div></div>
              <div className="ticket-stats"><div><small>Now serving</small><strong>KRS-1036</strong></div><div><small>Your position</small><strong className="accent-number">{queue}</strong></div><div><small>Est. wait</small><strong>~35 min</strong></div></div>
              <div className="queue-track"><span style={{ width: `${Math.max(18, 86 - queue * 2)}%` }} /></div><div className="queue-meta"><span>Queue moving smoothly</span><span>On schedule</span></div>
              <div className="ticket-foot"><div className="avatar-stack"><span>AS</span><span>PM</span><span>+{Math.max(0, queue - 2)}</span></div><span>Farmers ahead of you</span><QrCode size={32} strokeWidth={1.4} /></div>
            </div>
          </div>
        </section>

        <section className="metric-strip"><div><strong>42%</strong><span>less waiting time</span></div><div><strong>98%</strong><span>farmers notified</span></div><div><strong>31 min</strong><span>average queue wait</span></div><div><strong>84</strong><span>centres connected</span></div><small className="metric-note">Prototype simulation metrics</small></section>

        <section className="workspace-section">
          <div className="section-heading"><div><p className="eyebrow">YOUR PROCUREMENT DAY</p><h2>A clear view of what comes next.</h2></div><div className="role-switcher"><button className={role === 'farmer' ? 'selected' : ''} onClick={() => switchRole('farmer')}><Users size={16} /> Farmer view</button><button className={role === 'operator' ? 'selected' : ''} onClick={() => switchRole('operator')}><LayoutDashboard size={16} /> Centre operator</button><button className={role === 'admin' ? 'selected' : ''} onClick={() => switchRole('admin')}><ShieldCheck size={16} /> Admin</button></div></div>
          {role === 'farmer' && <FarmerWorkspace queue={queue} stage={stage} onBook={() => setBookingOpen(true)} onAdvance={advanceStage} activeTab={activeTab} />}
          {role === 'operator' && <OperatorWorkspace queue={queue} onCallNext={callNext} flash={flash} />}
          {role === 'admin' && <AdminWorkspace />}
        </section>

        <section className="how-section"><div className="section-heading compact"><div><p className="eyebrow">HOW KRISHISETU WORKS</p><h2>Four steps to a smoother day.</h2></div><button className="outline-button" onClick={() => setBookingOpen(true)}>Start a booking <MoveRight size={16} /></button></div><div className="steps-grid">{[['01', 'Register once', 'Create your demo farmer profile in under two minutes.'], ['02', 'Choose a slot', 'See live availability at nearby procurement centres.'], ['03', 'Follow your queue', 'Get updates so you arrive when it is your turn.'], ['04', 'Track your payment', 'Every milestone is visible, from weigh-in to credit.']].map(([number, title, copy]) => <div className="step-item" key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p><ArrowRight size={17} /></div>)}</div></section>

        <section className="centres-section"><div className="section-heading compact"><div><p className="eyebrow">FIND A BETTER TIME TO VISIT</p><h2>Live procurement centres.</h2></div><button className="text-button" onClick={() => flash('Centre map is available in the full demo.')} >View centre map <ArrowRight size={15} /></button></div><div className="centre-grid">{centres.map((centre) => <div className="centre-card" key={centre.name}><div className="centre-card-top"><span className={`status-pill ${centre.tone}`}><span /> {centre.tone === 'good' ? 'Low queue' : 'High queue'}</span><button className="icon-button muted" aria-label="Centre details"><ArrowRight size={16} /></button></div><h3>{centre.name}</h3><p><MapPin size={14} /> {centre.location}</p><div className="centre-card-stats"><div><small>Waiting</small><strong>{centre.wait} <small>min</small></strong></div><div><small>In queue</small><strong>{centre.queue}</strong></div><div><small>Capacity</small><strong>{centre.load}%</strong></div></div><div className="capacity-bar"><span style={{ width: `${centre.load}%` }} /></div><button className="card-action" onClick={() => { setBookingOpen(true); flash(`${centre.name} selected for booking.`); }}>Choose this centre <ArrowRight size={15} /></button></div>)}</div></section>
      </main>

      <footer className="footer"><div className="brand"><span className="brand-mark"><Sprout size={21} /></span><span><strong>KrishiSetu</strong><small>Smart Procurement Management</small></span></div><p>This application is a Smart India Hackathon 2026 prototype and is not an official Government of India service.</p><div className="footer-links"><button onClick={() => flash('Help centre opened.')}>Help & support</button><button onClick={() => flash('Privacy information opened.')}>Privacy</button></div></footer>

      {bookingOpen && <BookingModal confirmed={bookingConfirmed} onClose={() => { setBookingOpen(false); setBookingConfirmed(false); }} onConfirm={() => { setBookingConfirmed(true); flash('Booking confirmed. Token KRS-1048 generated.'); }} />}
      {notice && <div className="toast"><Check size={17} /> {notice}</div>}
    </div>
  );
}

function FarmerWorkspace({ queue, stage, onBook, onAdvance }) {
  return <div className="farmer-grid"><div className="booking-card main-card"><div className="card-label"><span className="live-label"><span className="pulse-dot green" /> NEXT PROCUREMENT VISIT</span><span className="date-label">12 SEP 2026</span></div><div className="booking-main"><div><h3>APMC Procurement Centre</h3><p><MapPin size={15} /> Nashik, Maharashtra</p></div><div className="booking-token"><small>YOUR TOKEN</small><strong>KRS-1048</strong></div></div><div className="booking-details"><div><small>Time slot</small><strong>10:30 – 11:00 AM</strong></div><div><small>Crop</small><strong>Wheat</strong></div><div><small>Expected quantity</small><strong>48 quintals</strong></div></div><div className="booking-footer"><div><span className="queue-number">{queue}</span><span><small>Queue position</small><strong>~35 min estimated wait</strong></span></div><button className="primary-button small" onClick={onBook}>Manage booking <ArrowRight size={15} /></button></div></div><div className="timeline-card main-card"><div className="card-title-row"><div><p className="eyebrow">PROCUREMENT TRACKER</p><h3>Today’s progress</h3></div><span className="status-pill processing"><span /> In progress</span></div><div className="timeline">{stages.map((item, index) => <div className={index <= stage ? 'timeline-item complete' : index === stage + 1 ? 'timeline-item current' : 'timeline-item'} key={item}><span className="timeline-dot">{index < stage ? <Check size={12} /> : index === stage ? <span /> : ''}</span><div><strong>{item}</strong>{index === 0 && <small>Booked on 04 Sep, 2026 at 09:42 AM</small>}{index === 1 && <small>Checked in at 10:12 AM</small>}{index === stage && <small>Being handled at the centre</small>}</div></div>)}</div><button className="text-button timeline-action" onClick={onAdvance}>{stage >= 5 ? 'Payment credited' : 'Simulate next update'} <ArrowRight size={15} /></button></div><div className="smart-card"><div className="smart-icon"><TrendingDown size={20} /></div><div><span className="eyebrow">SMART QUEUE INTELLIGENCE</span><h3>Save 42 minutes today.</h3><p>Sinnar Collection Hub has a shorter queue and an open <strong>11:30 AM slot.</strong></p><button className="text-button" onClick={onBook}>See recommendation <ArrowRight size={14} /></button></div></div><div className="payment-card main-card"><div className="card-title-row"><div><p className="eyebrow">PAYMENT STATUS</p><h3>₹96,000 <span className="muted-text">procurement value</span></h3></div><WalletCards size={23} /></div><div className="payment-status"><span className="status-pill processing"><span /> Processing</span><span>Expected credit within 2 working days</span></div><div className="transaction"><span>Transaction ID</span><strong>KRS-TXN-839201</strong></div></div></div>;
}

function OperatorWorkspace({ queue, onCallNext, flash }) {
  const [checked, setChecked] = useState(84);
  return <div className="operator-view"><div className="operator-topline"><div><p className="eyebrow">NASHIK EAST · OPERATOR DESK</p><h3>Good morning, Meera.</h3></div><span className="live-label"><span className="pulse-dot green" /> System live</span></div><div className="operator-stats">{[['Total bookings', '126'], ['Checked in', String(checked)], ['Waiting', String(queue + 17)], ['Completed', '48'], ['Centre capacity', '78%']].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div><div className="operator-main"><div className="queue-panel main-card"><div className="card-title-row"><div><p className="eyebrow">LIVE QUEUE</p><h3>Farmers waiting today</h3></div><div className="search-field"><Search size={15} /><input placeholder="Search token" /></div></div><div className="queue-row active-row"><span className="queue-token active">KRS-1048</span><div><strong>Ramesh Kumar</strong><small>Wheat · 48 quintals · 10:30 AM</small></div><span className="queue-state">Next in line</span><button className="icon-button" onClick={onCallNext} aria-label="Call next farmer"><MoveRight size={18} /></button></div>{[['KRS-1049', 'Sunita Patil', 'Soybean · 32 quintals', '10:30 AM'], ['KRS-1050', 'Mohan Yadav', 'Wheat · 40 quintals', '11:00 AM'], ['KRS-1051', 'Kavita Shinde', 'Maize · 26 quintals', '11:00 AM']].map(([token, name, crop, time]) => <div className="queue-row" key={token}><span className="queue-token">{token}</span><div><strong>{name}</strong><small>{crop} · {time}</small></div><span className="queue-state neutral">Waiting</span><button className="icon-button" onClick={() => flash(`${token} details opened.`)} aria-label={`Open ${token}`}><ArrowRight size={17} /></button></div>)}<button className="primary-button call-next" onClick={onCallNext}><Phone size={16} /> Call next farmer <span>({queue > 0 ? `KRS-10${36 + queue}` : 'Queue clear'})</span></button></div><div className="operator-actions main-card"><p className="eyebrow">CURRENT FARMER</p><h3>Ramesh Kumar</h3><p><MapPin size={14} /> Village Songaon · Wheat</p><div className="operator-step"><span className="step-check"><Check size={13} /></span><div><strong>Checked in</strong><small>10:12 AM</small></div></div><div className="operator-step current"><span className="step-check"><span /></span><div><strong>Quality verification</strong><small>Ready to begin</small></div></div><button className="primary-button small full" onClick={() => { setChecked((value) => value + 1); flash('Quality verification marked complete.'); }}><Check size={15} /> Mark verification complete</button><button className="outline-button small full" onClick={() => flash('No-show flag added to KRS-1048.')}>Flag as no-show</button></div></div></div>;
}

function AdminWorkspace() { return <div className="admin-view"><div className="admin-heading"><div><p className="eyebrow">NATIONAL OPERATIONS SNAPSHOT</p><h3>Command centre</h3><p>Performance across connected procurement centres · 05 September 2026</p></div><button className="outline-button small"><FileText size={15} /> Export report</button></div><div className="admin-stats">{[['24,582', 'Total farmers', '↑ 12.4%'], ['1,284', 'Active bookings', '↑ 8.2%'], ['8,492 q', 'Today’s procurement', '↑ 18.7%'], ['₹12.4 Cr', 'Payments processed', '↑ 6.1%']].map(([value, label, change]) => <div className="admin-stat" key={label}><span className="stat-icon"><TrendingDown size={17} /></span><strong>{value}</strong><small>{label}</small><em>{change}</em></div>)}</div><div className="admin-chart-grid"><div className="chart-card main-card"><div className="card-title-row"><div><p className="eyebrow">WEEKLY BOOKINGS</p><h3>Farmer demand is rising steadily</h3></div><span className="chart-legend"><i /> Bookings</span></div><div className="bar-chart">{[42, 55, 48, 70, 64, 83, 91].map((height, index) => <div className="bar-column" key={index}><span style={{ height: `${height}%` }} /><small>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</small></div>)}</div></div><div className="ranking-card main-card"><p className="eyebrow">CENTRE PERFORMANCE</p><h3>Best performing centres</h3>{centres.map((centre, index) => <div className="ranking-row" key={centre.name}><span>0{index + 1}</span><div><strong>{centre.name}</strong><small>{centre.wait} min avg. wait</small></div><em>{centre.load}%</em></div>)}</div></div></div>; }

function BookingModal({ confirmed, onClose, onConfirm }) {
  const [slot, setSlot] = useState('10:30 – 11:00 AM');
  return <div className="modal-backdrop"><div className="booking-modal"><button className="close-button" onClick={onClose} aria-label="Close"><X size={19} /></button>{confirmed ? <div className="confirmation"><span className="confirmation-icon"><Check size={29} /></span><p className="eyebrow">BOOKING CONFIRMED</p><h2>Your place is saved.</h2><p>Your digital token is ready. Arrive 10 minutes before your slot.</p><div className="token-pass"><div><small>KRISHISETU TOKEN</small><strong>KRS-1048</strong></div><QrCode size={48} strokeWidth={1.2} /></div><button className="primary-button full" onClick={onClose}>Back to dashboard</button></div> : <><p className="eyebrow">NEW PROCUREMENT BOOKING</p><h2>Choose a time that works.</h2><p className="modal-subtitle">Live availability for APMC Nashik East.</p><div className="form-field"><label>Procurement centre</label><div className="select-field"><MapPin size={15} /> APMC Nashik East <ChevronDown size={15} /></div></div><div className="form-field"><label>Crop and expected quantity</label><div className="split-fields"><div className="select-field">Wheat <ChevronDown size={15} /></div><div className="input-field">48 <span>quintals</span></div></div></div><div className="form-field"><label>Available time slots · 12 September 2026</label><div className="slot-grid">{['09:00 – 09:30 AM', '09:30 – 10:00 AM', '10:00 – 10:30 AM', '10:30 – 11:00 AM'].map((item, index) => <button className={slot === item ? 'slot selected' : 'slot'} key={item} onClick={() => setSlot(item)}><span>{item}</span><small className={index === 1 ? 'limited' : ''}>{index === 1 ? 'Limited' : 'Available'}</small></button>)}</div></div><div className="modal-summary"><span>Selected slot</span><strong>{slot}</strong></div><button className="primary-button full" onClick={onConfirm}>Confirm booking <ArrowRight size={16} /></button></>}</div></div>;
}

createRoot(document.getElementById('root')).render(<App />);
