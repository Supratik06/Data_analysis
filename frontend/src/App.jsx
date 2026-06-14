import React, { useState, useEffect, useRef } from 'react';
import { 
  DollarSign, Plus, Trash2, ShieldAlert, CheckCircle2, AlertTriangle, 
  RefreshCw, LogOut, Download, FileText, ArrowRight, UserCheck, 
  HelpCircle, Calendar, Users, ListFilter, CreditCard, ChevronRight 
} from 'lucide-react';

const API_BASE = 'https://data-analysis-omek.vercel.app/api';

export default function App() {
  // Auth state
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [authError, setAuthError] = useState('');

  // App navigation
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeGroup, setActiveGroup] = useState(null);
  const [groups, setGroups] = useState([]);
  const [members, setMembers] = useState([]);

  // Data state
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [settlements, setSettlements] = useState([]);
  
  // Ledger filters
  const [searchDesc, setSearchDesc] = useState('');
  const [filterUser, setFilterUser] = useState('');

  // Expense form state
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCurrency, setExpCurrency] = useState('INR');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expPaidBy, setExpPaidBy] = useState('');
  const [expSplitType, setExpSplitType] = useState('equal');
  const [customSplits, setCustomSplits] = useState({}); // { userId: share/percentage }
  const [expNotes, setExpNotes] = useState('');
  const [isSettlementForm, setIsSettlementForm] = useState(false);
  const [expenseError, setExpenseError] = useState('');

  // Import wizard state
  const [importFile, setImportFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [importAnomalies, setImportAnomalies] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);
  const [usdRate, setUsdRate] = useState(83);
  const [importStep, setImportStep] = useState(0); // 0: upload, 1: rate, 2: duplicates/conflicts, 3: timeline, 4: formatting/errors, 5: review, 6: report
  const [resolutions, setResolutions] = useState({}); // { anomalyIndex: resolutionObj }
  const [importReport, setImportReport] = useState(null);
  const fileInputRef = useRef(null);

  // Initialize and check current user
  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      fetchCurrentUser();
      fetchGroups();
    } else {
      localStorage.removeItem('token');
      setUser(null);
    }
  }, [token]);

  useEffect(() => {
    if (activeGroup) {
      fetchExpenses();
      fetchBalances();
      fetchMembers();
    }
  }, [activeGroup]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setToken('');
      }
    } catch (err) {
      console.error(err);
      setToken('');
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch(`${API_BASE}/groups`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
        if (data.length > 0) setActiveGroup(data[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch(`${API_BASE}/groups/${activeGroup.id}/members`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchExpenses = async () => {
    try {
      const res = await fetch(`${API_BASE}/expenses?group_id=${activeGroup.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setExpenses(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBalances = async () => {
    try {
      const res = await fetch(`${API_BASE}/groups/${activeGroup.id}/balances`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBalances(data.balances);
        setSettlements(data.settlements);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
      } else {
        setAuthError(data.error || 'Login failed');
      }
    } catch (err) {
      setAuthError('Connection error to backend server');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, email: emailInput, password: passwordInput })
      });
      const data = await res.json();
      if (res.ok) {
        setIsRegisterMode(false);
        alert('Registration successful! Please login.');
      } else {
        setAuthError(data.error || 'Registration failed');
      }
    } catch (err) {
      setAuthError('Connection error to backend server');
    }
  };

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('token');
  };

  // Add manually logged Expense or Settlement
  const handleAddExpense = async (e) => {
    e.preventDefault();
    setExpenseError('');

    if (!expDesc || !expAmount || !expPaidBy) {
      setExpenseError('Please fill description, amount and payer.');
      return;
    }

    const amt = parseFloat(expAmount);
    if (isNaN(amt) || amt <= 0) {
      setExpenseError('Please enter a valid positive amount.');
      return;
    }

    // Prepare splits based on split type
    let finalSplits = [];
    if (isSettlementForm) {
      // Settlement: split matches 100% to receiver
      const receiverId = parseInt(expNotes); // Save receiverId in expNotes temporary field
      if (!receiverId) {
        setExpenseError('Please select payment receiver.');
        return;
      }
      finalSplits = [{ user_id: receiverId, amount: amt, share_value: 100 }];
    } else {
      if (expSplitType === 'equal') {
        const shareAmount = parseFloat((amt / members.length).toFixed(2));
        finalSplits = members.map(m => ({
          user_id: m.id,
          amount: shareAmount,
          share_value: 1
        }));
      } else if (expSplitType === 'percentage') {
        let totalPct = 0;
        members.forEach(m => {
          totalPct += parseFloat(customSplits[m.id] || 0);
        });
        if (Math.abs(totalPct - 100) > 0.01) {
          setExpenseError(`Total percentages must sum to 100% (currently ${totalPct}%).`);
          return;
        }
        finalSplits = members.map(m => ({
          user_id: m.id,
          amount: parseFloat((amt * (parseFloat(customSplits[m.id] || 0) / 100)).toFixed(2)),
          share_value: parseFloat(customSplits[m.id] || 0)
        }));
      } else if (expSplitType === 'share') {
        let totalShares = 0;
        members.forEach(m => {
          totalShares += parseFloat(customSplits[m.id] || 0);
        });
        if (totalShares <= 0) {
          setExpenseError('Total shares must be greater than 0.');
          return;
        }
        finalSplits = members.map(m => ({
          user_id: m.id,
          amount: parseFloat((amt * (parseFloat(customSplits[m.id] || 0) / totalShares)).toFixed(2)),
          share_value: parseFloat(customSplits[m.id] || 0)
        }));
      }
    }

    const payload = {
      group_id: activeGroup.id,
      description: isSettlementForm ? `Settlement: ${members.find(m => m.id === parseInt(expPaidBy))?.username} paid ${members.find(m => m.id === parseInt(expNotes))?.username}` : expDesc,
      paid_by_id: parseInt(expPaidBy),
      amount: amt,
      currency: expCurrency,
      date: expDate,
      split_type: isSettlementForm ? 'settlement' : expSplitType,
      splits: finalSplits,
      is_settlement: isSettlementForm,
      notes: isSettlementForm ? 'Manual Settlement Record' : expNotes
    };

    try {
      const res = await fetch(`${API_BASE}/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsAddingExpense(false);
        setExpDesc('');
        setExpAmount('');
        setExpNotes('');
        setCustomSplits({});
        fetchExpenses();
        fetchBalances();
      } else {
        const err = await res.json();
        setExpenseError(err.error || 'Failed to save expense');
      }
    } catch (err) {
      setExpenseError('Network error');
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      const res = await fetch(`${API_BASE}/expenses/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchExpenses();
        fetchBalances();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- CSV IMPORT WIZARD HANDLERS ---

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
    setIsAnalyzing(true);
    setImportStep(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/import/analyze`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setParsedRows(data.rows);
        setImportAnomalies(data.anomalies);
        
        // Initialize default resolutions
        const defaultResolutions = {};
        data.anomalies.forEach((a, index) => {
          if (a.type === 'DUPLICATE_ENTRY') {
            defaultResolutions[index] = { ...a, action: 'delete' }; // Delete duplicate
          } else if (a.type === 'CONFLICTING_ENTRY') {
            defaultResolutions[index] = { ...a, action: 'keep_b' }; // Keep Rohan's (Row 25) Thalassa dinner
          } else if (a.type === 'TIMELINE_VIOLATION_MEERA') {
            defaultResolutions[index] = { ...a, action: 'remove' }; // Remove Meera from post-leaving split
          } else if (a.type === 'TIMELINE_VIOLATION_SAM') {
            // Housewarming drinks on April 10: Sam was there, keep him. Electricity Apr on April 12: Sam hadn't moved in, remove him.
            const isDrinks = a.description?.toLowerCase().includes('drinks') || parsedRows.find(r => r.rowIndex === a.rowIndex)?.description?.toLowerCase().includes('drinks');
            defaultResolutions[index] = { ...a, action: isDrinks ? 'keep' : 'remove' }; 
          } else if (a.type === 'NON_GROUP_MEMBERS') {
            defaultResolutions[index] = { ...a, action: 'absorb_by_dev' }; // Dev absorbs Kabir's parasailing share
          } else if (a.type === 'INVALID_PERCENTAGE_SUM') {
            defaultResolutions[index] = { ...a, action: 'normalize', value: a.data.originalDetails };
          } else if (a.type === 'NAME_INCONSISTENCY') {
            defaultResolutions[index] = { ...a, action: 'map', value: a.data.suggested };
          } else if (a.type === 'SPLIT_WITH_NAME_INCONSISTENCY') {
            defaultResolutions[index] = { ...a, action: 'standardize', value: a.data.suggested };
          } else if (a.type === 'NON_STANDARD_DATE') {
            defaultResolutions[index] = { ...a, action: 'convert', value: a.data.suggested };
          } else if (a.type === 'AMBIGUOUS_DATE') {
            defaultResolutions[index] = { ...a, action: 'resolve', value: a.data.suggested };
          } else if (a.type === 'MISSING_PAID_BY') {
            defaultResolutions[index] = { ...a, action: 'assign', value: 'Aisha' }; // Default assign
          } else if (a.type === 'MISSING_CURRENCY') {
            defaultResolutions[index] = { ...a, action: 'assign', value: 'INR' };
          } else if (a.type === 'FLOAT_PRECISION') {
            defaultResolutions[index] = { ...a, action: 'round', value: a.data.suggested };
          } else if (a.type === 'ZERO_AMOUNT') {
            defaultResolutions[index] = { ...a, action: 'delete' };
          } else if (a.type === 'SETTLEMENT_LOGGED_AS_EXPENSE') {
            defaultResolutions[index] = { ...a, action: 'settle' };
          } else if (a.type === 'NEGATIVE_AMOUNT') {
            defaultResolutions[index] = { ...a, action: 'refund' };
          } else {
            defaultResolutions[index] = { ...a, action: 'keep' };
          }
        });
        setResolutions(defaultResolutions);
        setImportStep(1); // Proceed to Exchange Rate step
      } else {
        alert('Failed to analyze CSV file.');
      }
    } catch (err) {
      console.error(err);
      alert('Error uploading file');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateResolution = (index, updates) => {
    setResolutions(prev => ({
      ...prev,
      [index]: { ...prev[index], ...updates }
    }));
  };

  const handleCommitImport = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch(`${API_BASE}/import/commit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          rows: parsedRows,
          resolutions: Object.values(resolutions),
          exchangeRate: usdRate
        })
      });
      if (res.ok) {
        const data = await res.json();
        setImportReport(data.report);
        setImportStep(6); // Go to report page
        fetchExpenses();
        fetchBalances();
      } else {
        const err = await res.json();
        alert(`Import failed: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error during import commit');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const downloadReport = () => {
    if (!importReport) return;
    const txtContent = `IMPORT ANOMALY REPORT\n====================\n` +
      `File Name: Expenses Export.csv\n` +
      `Date of Ingestion: ${new Date().toLocaleString()}\n` +
      `Total Transactions Ingested: ${importReport.totalRowsIngested}\n` +
      `Total Anomalies Resolved: ${importReport.anomaliesResolved}\n\n` +
      `Actions Taken Log:\n` +
      importReport.actionsTaken.map((action, idx) => `${idx + 1}. ${action}`).join('\n');

    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'import_report.txt');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Rohan's balance drill down logic
  const handleBalanceClick = (username) => {
    setFilterUser(username);
    setSearchDesc('');
    setActiveTab('ledger');
  };

  // Filtered expenses for Ledger view
  const filteredExpenses = expenses.filter(e => {
    const matchDesc = e.description.toLowerCase().includes(searchDesc.toLowerCase()) || 
                      (e.notes && e.notes.toLowerCase().includes(searchDesc.toLowerCase()));
    
    if (!filterUser) return matchDesc;

    // Show if user paid or user is included in split
    const isPayer = e.paid_by_name?.toLowerCase() === filterUser.toLowerCase();
    const isSplitMember = e.splits?.some(s => s.username?.toLowerCase() === filterUser.toLowerCase());
    return matchDesc && (isPayer || isSplitMember);
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* --- TOP HEADER BAR --- */}
      <header className="glass-panel" style={{ 
        margin: '16px', padding: '12px 24px', display: 'flex', 
        justifyContent: 'space-between', alignItems: 'center', borderRadius: '12px' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            background: 'linear-gradient(135deg, #6366f1 0%, #a5b4fc 100%)', 
            padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' 
          }}>
            <DollarSign size={24} color="#000" strokeWidth={2.5} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800 }} className="gradient-text">EquiSplit</h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Premium Shared Expenses</p>
          </div>
        </div>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <nav style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => { setActiveTab('dashboard'); setFilterUser(''); }}
                className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              >
                <Users size={16} /> Dashboard
              </button>
              <button 
                onClick={() => { setActiveTab('ledger'); }}
                className={`btn ${activeTab === 'ledger' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              >
                <FileText size={16} /> Ledger
              </button>
              <button 
                onClick={() => { setActiveTab('import'); }}
                className={`btn ${activeTab === 'import' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              >
                <Download size={16} /> CSV Import
              </button>
            </nav>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '16px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user.username}</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{activeGroup?.name || 'No Group'}</p>
              </div>
              <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '6px', borderRadius: '8px' }}>
                <LogOut size={16} />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* --- AUTHENTICATION MODULE --- */}
      {!token ? (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 16px' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '32px' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Welcome to EquiSplit</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                {isRegisterMode ? 'Create a secure shared household account' : 'Sign in to access your flatmate group'}
              </p>
            </div>

            {authError && (
              <div className="badge badge-danger" style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <ShieldAlert size={16} />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={isRegisterMode ? handleRegister : handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>USERNAME</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Aisha"
                  value={usernameInput} 
                  onChange={e => setUsernameInput(e.target.value)} 
                  required
                />
              </div>

              {isRegisterMode && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>EMAIL ADDRESS</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="e.g. aisha@example.com"
                    value={emailInput} 
                    onChange={e => setEmailInput(e.target.value)} 
                    required
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>SECURE PASSWORD</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="••••••••"
                  value={passwordInput} 
                  onChange={e => setPasswordInput(e.target.value)} 
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: '8px' }}>
                {isRegisterMode ? 'Register Account' : 'Sign In'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.85rem' }}>
              <a 
                href="#" 
                onClick={(e) => { e.preventDefault(); setIsRegisterMode(!isRegisterMode); setAuthError(''); }}
                style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
              >
                {isRegisterMode ? 'Already have an account? Sign in' : 'Need an account? Register flatmate'}
              </a>
            </div>
            
            <div style={{ marginTop: '24px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <strong>Demo Credentials:</strong><br />
              Log in as flatmates using their names (e.g. <code>Aisha</code>, <code>Rohan</code>, <code>Priya</code>, <code>Meera</code>, <code>Sam</code>, <code>Dev</code>) with the default password: <code>password123</code>.
            </div>
          </div>
        </div>
      ) : (
        
        // --- APP MAIN INTERFACE ---
        <main style={{ flex: 1, padding: '0 16px 40px 16px', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
          
          {/* --- TAB 1: DASHBOARD --- */}
          {activeTab === 'dashboard' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Row 1: Net Balances Grid */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.4rem' }}>Group Balances Summary</h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Click on any flatmate's balance to drill down into their expense list</p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => { setIsAddingExpense(true); setIsSettlementForm(false); }} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                      <Plus size={16} /> Log Expense
                    </button>
                    <button onClick={() => { setIsAddingExpense(true); setIsSettlementForm(true); }} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                      <CreditCard size={16} /> Record Settlement
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '16px' }}>
                  {balances.map(b => {
                    const isCreditor = b.netBalance > 0.01;
                    const isDebtor = b.netBalance < -0.01;
                    return (
                      <div 
                        key={b.userId} 
                        className="glass-panel" 
                        onClick={() => handleBalanceClick(b.username)}
                        style={{ 
                          padding: '20px', 
                          borderRadius: '12px', 
                          cursor: 'pointer',
                          borderLeft: `4px solid ${isCreditor ? 'var(--success)' : isDebtor ? 'var(--danger)' : 'var(--text-dim)'}`
                        }}
                      >
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{b.username.toUpperCase()}</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '6px 0' }}>
                          ₹{Math.abs(b.netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h3>
                        <span className={`badge ${isCreditor ? 'badge-success' : isDebtor ? 'badge-danger' : 'badge-info'}`}>
                          {isCreditor ? 'Owed to them' : isDebtor ? 'They owe' : 'Settled up'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid-2">
                {/* Simplified Settlements: Aisha's Request */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <div style={{ background: 'var(--primary-glow)', padding: '6px', borderRadius: '8px' }}>
                      <UserCheck size={20} color="var(--primary)" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem' }}>Aisha's Debt Settlements</h3>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Greedy simplifier showing who pays whom and how much</p>
                    </div>
                  </div>

                  {settlements.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)' }}>
                      <CheckCircle2 size={36} style={{ strokeWidth: 1.5, marginBottom: '8px', color: 'var(--success)' }} />
                      <p style={{ fontSize: '0.9rem' }}>All balances are completely settled!</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {settlements.map((s, idx) => (
                        <div key={idx} style={{ 
                          display: 'flex', justifyItems: 'center', justifyContent: 'space-between', 
                          padding: '12px 16px', background: 'rgba(255,255,255,0.02)', 
                          border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px' 
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 600, color: '#ff6b6b' }}>{s.fromUsername}</span>
                            <ArrowRight size={14} color="var(--text-muted)" />
                            <span style={{ fontWeight: 600, color: '#51cf66' }}>{s.toUsername}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontWeight: 800 }}>₹{s.amount.toLocaleString('en-IN')}</span>
                            <button 
                              onClick={() => {
                                setIsAddingExpense(true);
                                setIsSettlementForm(true);
                                setExpPaidBy(s.fromUserId.toString());
                                setExpNotes(s.toUserId.toString()); // recipient
                                setExpAmount(s.amount.toString());
                                setExpDesc(`Settlement: ${s.fromUsername} paid ${s.toUsername}`);
                              }}
                              className="btn btn-primary" 
                              style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
                            >
                              Settle
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Info Card / Quick Stats */}
                <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Timeline & Split Policy Summary</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                      The household records transactions with specific temporal bounds:
                    </p>
                    <ul style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '10px', listStyleType: 'none' }}>
                      <li style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <ChevronRight size={16} color="var(--primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <span><strong>Meera</strong> left March 31, 2026. April expenses are automatically split excluding her.</span>
                      </li>
                      <li style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <ChevronRight size={16} color="var(--primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <span><strong>Sam</strong> joined April 15, 2026. Pre-April expenses exclude him completely.</span>
                      </li>
                      <li style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <ChevronRight size={16} color="var(--primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <span><strong>Trip Currencies</strong> are standardizing USD to INR (prefilled at 83.0 rate on import).</span>
                      </li>
                    </ul>
                  </div>

                  <div style={{ marginTop: '24px', background: 'var(--panel-border-glow)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                    <div style={{ display: 'flex', gap: '8px', color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                      <HelpCircle size={16} /> Need to reload base data?
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      If you haven't done it yet, navigate to the <strong>CSV Import</strong> tab, upload <code>Expenses Export.csv</code>, review anomalies, and run import to populate the DB.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- TAB 2: LEDGER --- */}
          {activeTab === 'ledger' && (
            <div className="glass-panel animate-fade-in" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '1.3rem' }}>Transaction Ledger</h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Detailed list of all shared household transactions and settlements</p>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {filterUser && (
                    <div className="badge badge-info" style={{ gap: '6px', fontSize: '0.8rem', padding: '6px 12px' }}>
                      Showing {filterUser}'s expenses
                      <button 
                        onClick={() => setFilterUser('')} 
                        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 800, paddingLeft: '4px' }}
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <div style={{ position: 'relative' }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Search description..." 
                      value={searchDesc}
                      onChange={e => setSearchDesc(e.target.value)}
                      style={{ padding: '8px 12px', fontSize: '0.85rem', width: '220px' }}
                    />
                  </div>
                </div>
              </div>

              {filteredExpenses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-dim)' }}>
                  <HelpCircle size={48} style={{ strokeWidth: 1, marginBottom: '12px' }} />
                  <p style={{ fontSize: '0.95rem' }}>No matching expenses found.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Paid By</th>
                        <th>Total Amount</th>
                        <th>INR Equivalent</th>
                        <th>Split Details</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses.map(e => {
                        const isSett = e.is_settlement === 1;
                        return (
                          <tr key={e.id} style={isSett ? { background: 'rgba(16, 185, 129, 0.02)' } : {}}>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Calendar size={14} color="var(--text-muted)" />
                                {new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </div>
                            </td>
                            <td>
                              <div>
                                <span style={{ fontWeight: 600, color: isSett ? 'var(--success)' : '#fff' }}>
                                  {e.description}
                                </span>
                                {e.notes && (
                                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {e.notes}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td>
                              <span style={{ fontWeight: 600 }}>{e.paid_by_name || 'Unassigned'}</span>
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              {e.currency} {e.amount.toLocaleString()}
                            </td>
                            <td style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                              ₹{e.amount_in_inr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '300px' }}>
                                {e.splits?.map(s => (
                                  <span key={s.id} className="badge badge-info" style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(255,255,255,0.03)', color: '#fff', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    {s.username}: ₹{s.amount.toLocaleString('en-IN')}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button onClick={() => handleDeleteExpense(e.id)} className="btn" style={{ padding: '6px', color: 'var(--danger)', background: 'none' }}>
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* --- TAB 3: CSV IMPORT WIZARD --- */}
          {activeTab === 'import' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* WIZARD TITLE & STEPS */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h2 style={{ fontSize: '1.4rem', marginBottom: '4px' }}>Spreadsheet Import Engine</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                  Upload the legacy CSV spreadsheet to analyze details, configure USD rates, and resolve consistency anomalies.
                </p>

                {/* Progress Indicators */}
                <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', overflowX: 'auto', paddingBottom: '10px' }}>
                  {['Upload File', 'Rate Setting', 'Duplicates & Conflicts', 'Timeline Bounds', 'Formatting & Errors', 'Review & Commit'].map((label, idx) => {
                    const stepNum = idx + 1;
                    const isActive = importStep === stepNum;
                    const isCompleted = importStep > stepNum || importStep === 6;
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '100px', flex: 1, position: 'relative' }}>
                        <div style={{ 
                          width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                          background: isCompleted ? 'var(--success)' : isActive ? 'var(--primary)' : 'rgba(255,255,255,0.05)', 
                          color: isCompleted || isActive ? '#fff' : 'var(--text-dim)',
                          fontWeight: 600, fontSize: '0.85rem', border: '1px solid rgba(255,255,255,0.1)', zIndex: 2
                        }}>
                          {isCompleted ? '✓' : stepNum}
                        </div>
                        <span style={{ fontSize: '0.75rem', marginTop: '6px', color: isActive ? '#fff' : 'var(--text-muted)', fontWeight: isActive ? 600 : 400, textAlign: 'center' }}>
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* STEP 0 & 1: UPLOAD & EXCHANGE RATE CONFIG */}
              {(importStep === 0 || importStep === 1) && (
                <div className="glass-panel" style={{ padding: '32px', textAlign: 'center' }}>
                  {importStep === 0 ? (
                    <div>
                      <Download size={48} style={{ strokeWidth: 1.5, color: 'var(--primary)', marginBottom: '16px' }} />
                      <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Select Expenses Export CSV</h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px', maxWidth: '450px', margin: '0 auto 24px auto' }}>
                        Choose the raw <code>Expenses Export.csv</code> file. The app will parse it to identify duplicates, conflicting double logs, negative refunds, currency conversions, and timeline gaps.
                      </p>

                      <input 
                        type="file" 
                        accept=".csv" 
                        onChange={handleFileUpload} 
                        style={{ display: 'none' }} 
                        ref={fileInputRef} 
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()} 
                        className="btn btn-primary" 
                        disabled={isAnalyzing}
                      >
                        {isAnalyzing ? (
                          <>
                            <RefreshCw size={16} className="animate-spin" /> Analyzing Spreadsheet...
                          </>
                        ) : 'Select CSV File'}
                      </button>
                    </div>
                  ) : (
                    <div style={{ maxWidth: '500px', margin: '0 auto', textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <DollarSign size={24} color="var(--primary)" />
                        <h3 style={{ fontSize: '1.2rem' }}>Priya's USD Rate conversion</h3>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                        Priya pointed out that the spreadsheet pretends a dollar is a rupee. We detected 4 transactions logged in USD (e.g. Goa booking, villa, etc.).
                        Please enter the USD to INR conversion rate to apply during ingestion:
                      </p>

                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>USD TO INR EXCHANGE RATE (1 USD = ? INR)</label>
                          <input 
                            type="number" 
                            className="form-input" 
                            value={usdRate}
                            onChange={e => setUsdRate(parseFloat(e.target.value) || 0)}
                            style={{ fontSize: '1.1rem', fontWeight: 700 }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <button onClick={() => setImportStep(0)} className="btn btn-secondary">Back</button>
                        <button onClick={() => setImportStep(2)} className="btn btn-primary">
                          Next Step <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: DUPLICATES & CONFLICTS RESOLUTION */}
              {importStep === 2 && (
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <AlertTriangle size={24} color="var(--accent)" />
                    <div>
                      <h3 style={{ fontSize: '1.2rem' }}>Duplicates & Conflicting Double Logs</h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Meera requires approving any row changes or deletions. Choose which row to keep.</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
                    {/* Filter and display duplicates */}
                    {importAnomalies.map((a, idx) => {
                      if (a.type !== 'DUPLICATE_ENTRY' && a.type !== 'CONFLICTING_ENTRY') return null;
                      const res = resolutions[idx];

                      return (
                        <div key={idx} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px', color: 'var(--accent)' }}>
                            {a.type === 'DUPLICATE_ENTRY' ? 'Duplicate Log Candidate' : 'Conflicting Entries logged by Different users'}
                          </div>
                          <p style={{ fontSize: '0.85rem', marginBottom: '12px' }}>{a.description}</p>
                          
                          <div style={{ display: 'flex', gap: '10px' }}>
                            {a.type === 'DUPLICATE_ENTRY' ? (
                              <>
                                <button 
                                  onClick={() => updateResolution(idx, { action: 'delete' })}
                                  className={`btn ${res?.action === 'delete' ? 'btn-danger' : 'btn-secondary'}`}
                                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                >
                                  Delete duplicate (Row {a.data.rowB})
                                </button>
                                <button 
                                  onClick={() => updateResolution(idx, { action: 'keep' })}
                                  className={`btn ${res?.action === 'keep' ? 'btn-success' : 'btn-secondary'}`}
                                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                >
                                  Keep both
                                </button>
                              </>
                            ) : (
                              <>
                                <button 
                                  onClick={() => updateResolution(idx, { action: 'keep_b' })}
                                  className={`btn ${res?.action === 'keep_b' ? 'btn-primary' : 'btn-secondary'}`}
                                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                >
                                  Keep Rohan (Row {a.data.rowB} - ₹2,450) & Discard Aisha
                                </button>
                                <button 
                                  onClick={() => updateResolution(idx, { action: 'keep_a' })}
                                  className={`btn ${res?.action === 'keep_a' ? 'btn-primary' : 'btn-secondary'}`}
                                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                >
                                  Keep Aisha (Row {a.data.rowA} - ₹2,400) & Discard Rohan
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {importAnomalies.filter(a => a.type === 'DUPLICATE_ENTRY' || a.type === 'CONFLICTING_ENTRY').length === 0 && (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>No duplicates or conflicts detected!</p>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <button onClick={() => setImportStep(1)} className="btn btn-secondary">Back</button>
                    <button onClick={() => setImportStep(3)} className="btn btn-primary">
                      Next Step <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: TIMELINE BOUNDS RESOLUTION */}
              {importStep === 3 && (
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <Calendar size={24} color="var(--primary)" />
                    <div>
                      <h3 style={{ fontSize: '1.2rem' }}>Membership Timeline Bounds</h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Sam's request: "I moved in mid-April. Why would March electricity affect my balance?"</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
                    {importAnomalies.map((a, idx) => {
                      if (a.type !== 'TIMELINE_VIOLATION_MEERA' && a.type !== 'TIMELINE_VIOLATION_SAM') return null;
                      const res = resolutions[idx];

                      return (
                        <div key={idx} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px', color: 'var(--primary)' }}>
                            Timeline Bounds Mismatch
                          </div>
                          <p style={{ fontSize: '0.85rem', marginBottom: '12px' }}>{a.description}</p>
                          
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button 
                              onClick={() => updateResolution(idx, { action: 'remove' })}
                              className={`btn ${res?.action === 'remove' ? 'btn-danger' : 'btn-secondary'}`}
                              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            >
                              Remove {a.data.member} from split & Re-split among active members
                            </button>
                            <button 
                              onClick={() => updateResolution(idx, { action: 'keep' })}
                              className={`btn ${res?.action === 'keep' ? 'btn-success' : 'btn-secondary'}`}
                              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            >
                              Keep in split anyway
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {importAnomalies.filter(a => a.type === 'TIMELINE_VIOLATION_MEERA' || a.type === 'TIMELINE_VIOLATION_SAM').length === 0 && (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>No timeline violations detected!</p>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <button onClick={() => setImportStep(2)} className="btn btn-secondary">Back</button>
                    <button onClick={() => setImportStep(4)} className="btn btn-primary">
                      Next Step <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: OTHER ERRORS & FORMATTING */}
              {importStep === 4 && (
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <ShieldAlert size={24} color="var(--primary)" />
                    <div>
                      <h3 style={{ fontSize: '1.2rem' }}>Formatting, Non-Members & Errors</h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Resolve missing payers, percentages not summing to 100%, and non-members.</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px', maxHeight: '400px', overflowY: 'auto', paddingRight: '6px' }}>
                    {importAnomalies.map((a, idx) => {
                      if (a.type === 'DUPLICATE_ENTRY' || a.type === 'CONFLICTING_ENTRY' || 
                          a.type === 'TIMELINE_VIOLATION_MEERA' || a.type === 'TIMELINE_VIOLATION_SAM' ||
                          a.type === 'USD_CURRENCY') return null; // already handled or informational
                      
                      const res = resolutions[idx];

                      return (
                        <div key={idx} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>
                            {a.type.replace(/_/g, ' ')}
                          </div>
                          <p style={{ fontSize: '0.85rem', marginBottom: '12px', color: 'var(--text-muted)' }}>{a.description}</p>
                          
                          {/* Render custom resolution inputs based on type */}
                          {a.type === 'NON_GROUP_MEMBERS' && (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button 
                                onClick={() => updateResolution(idx, { action: 'absorb_by_dev' })}
                                className={`btn ${res?.action === 'absorb_by_dev' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              >
                                Dev absorbs Kabir's share
                              </button>
                              <button 
                                onClick={() => updateResolution(idx, { action: 'add_temporary' })}
                                className={`btn ${res?.action === 'add_temporary' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              >
                                Add Kabir as temporary member
                              </button>
                              <button 
                                onClick={() => updateResolution(idx, { action: 'redistribute' })}
                                className={`btn ${res?.action === 'redistribute' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              >
                                Redistribute among other flatmates
                              </button>
                            </div>
                          )}

                          {a.type === 'MISSING_PAID_BY' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Assign Payer:</span>
                              <select 
                                className="form-input" 
                                value={res?.value || 'Aisha'} 
                                onChange={e => updateResolution(idx, { value: e.target.value })}
                                style={{ padding: '6px', fontSize: '0.8rem', width: '150px' }}
                              >
                                {['Aisha', 'Rohan', 'Priya', 'Meera', 'Sam', 'Dev'].map(name => (
                                  <option key={name} value={name}>{name}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {a.type === 'INVALID_PERCENTAGE_SUM' && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                onClick={() => updateResolution(idx, { action: 'normalize' })}
                                className={`btn ${res?.action === 'normalize' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              >
                                Normalize (Scale to 100%)
                              </button>
                            </div>
                          )}

                          {/* Suggested auto fixes for name formatting, dates etc */}
                          {(a.type === 'NAME_INCONSISTENCY' || a.type === 'SPLIT_WITH_NAME_INCONSISTENCY' || 
                            a.type === 'NON_STANDARD_DATE' || a.type === 'AMBIGUOUS_DATE' || 
                            a.type === 'FLOAT_PRECISION') && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--success)' }}>
                              Auto-fixing to: <strong>{res?.value}</strong>
                            </div>
                          )}

                          {a.type === 'SETTLEMENT_LOGGED_AS_EXPENSE' && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--success)' }}>
                              Auto-converting to settlement record (direct transfer).
                            </div>
                          )}

                          {a.type === 'NEGATIVE_AMOUNT' && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--success)' }}>
                              Auto-handling as negative refund expense.
                            </div>
                          )}

                          {a.type === 'ZERO_AMOUNT' && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                onClick={() => updateResolution(idx, { action: 'delete' })}
                                className={`btn ${res?.action === 'delete' ? 'btn-danger' : 'btn-secondary'}`}
                                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              >
                                Delete/Ignore (suggested)
                              </button>
                              <button 
                                onClick={() => updateResolution(idx, { action: 'keep' })}
                                className={`btn ${res?.action === 'keep' ? 'btn-success' : 'btn-secondary'}`}
                                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              >
                                Import with ₹0 amount
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <button onClick={() => setImportStep(3)} className="btn btn-secondary">Back</button>
                    <button onClick={() => setImportStep(5)} className="btn btn-primary">
                      Next Step <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 5: REVIEW & COMMIT */}
              {importStep === 5 && (
                <div className="glass-panel" style={{ padding: '32px', textAlign: 'center' }}>
                  <CheckCircle2 size={48} style={{ strokeWidth: 1.5, color: 'var(--success)', marginBottom: '16px' }} />
                  <h3 style={{ fontSize: '1.3rem', marginBottom: '8px' }}>Ready to Import Shared Expenses</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px auto' }}>
                    You have parsed the CSV file and configured resolutions for all 25 anomalies. Ready to write clean, normalized records into the SQLite database.
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '32px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', minWidth: '150px' }}>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TRANSACTIONS</p>
                      <h4 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{parsedRows.length}</h4>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', minWidth: '150px' }}>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>RESOLVED ANOMALIES</p>
                      <h4 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>
                        {Object.values(resolutions).length}
                      </h4>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '400px', margin: '0 auto' }}>
                    <button onClick={() => setImportStep(4)} className="btn btn-secondary">Back</button>
                    <button 
                      onClick={handleCommitImport} 
                      className="btn btn-primary"
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" /> Ingesting Data...
                        </>
                      ) : 'Confirm and Ingest'}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 6: IMPORT REPORT SUMMARY */}
              {importStep === 6 && importReport && (
                <div className="glass-panel animate-fade-in" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={24} color="var(--success)" />
                      <div>
                        <h3 style={{ fontSize: '1.2rem' }}>Import Ingestion Report</h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Audit log of all CSV parsing corrections and modifications</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={downloadReport} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                        <Download size={16} /> Download Report
                      </button>
                      <button onClick={() => { setImportStep(0); setActiveTab('dashboard'); }} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                        Done
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                    <div>
                      <div className="glass-panel" style={{ padding: '16px', marginBottom: '16px' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>STATUS</p>
                        <h4 style={{ fontSize: '1.1rem', color: 'var(--success)', marginTop: '4px' }}>Completed</h4>
                      </div>
                      <div className="glass-panel" style={{ padding: '16px', marginBottom: '16px' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>INGESTED ROWS</p>
                        <h4 style={{ fontSize: '1.1rem', marginTop: '4px' }}>{importReport.totalRowsIngested} Rows</h4>
                      </div>
                      <div className="glass-panel" style={{ padding: '16px' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>RESOLVED ANOMALIES</p>
                        <h4 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginTop: '4px' }}>{importReport.anomaliesResolved} Entries</h4>
                      </div>
                    </div>

                    <div className="glass-panel" style={{ padding: '20px' }}>
                      <h4 style={{ fontSize: '0.95rem', marginBottom: '12px' }}>Detailed Audit Log:</h4>
                      <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '6px' }}>
                        {importReport.actionsTaken.map((action, idx) => (
                          <div key={idx} style={{ 
                            fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 12px', 
                            background: 'rgba(255,255,255,0.02)', borderRadius: '6px', borderLeft: '3px solid var(--primary)'
                          }}>
                            {action}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </main>
      )}

      {/* --- ADD EXPENSE MODAL DIALOG --- */}
      {isAddingExpense && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100, padding: '16px'
        }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>
              {isSettlementForm ? 'Record Settlement Payment' : 'Log Shared Expense'}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              {isSettlementForm ? 'Record a direct debt clearance payment between two flatmates' : 'Add a new expense to be split among group members'}
            </p>

            {expenseError && (
              <div className="badge badge-danger" style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <ShieldAlert size={16} />
                <span>{expenseError}</span>
              </div>
            )}

            <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {!isSettlementForm && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>DESCRIPTION</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. WiFi Bill" 
                    value={expDesc} 
                    onChange={e => setExpDesc(e.target.value)} 
                    required 
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 2 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>AMOUNT</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="form-input" 
                    placeholder="0.00" 
                    value={expAmount} 
                    onChange={e => setExpAmount(e.target.value)} 
                    required 
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>CURRENCY</label>
                  <select className="form-input" value={expCurrency} onChange={e => setExpCurrency(e.target.value)}>
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                    {isSettlementForm ? 'SENDER (PAID BY)' : 'PAID BY'}
                  </label>
                  <select className="form-input" value={expPaidBy} onChange={e => setExpPaidBy(e.target.value)} required>
                    <option value="">Select flatmate</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.username}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>DATE</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={expDate} 
                    onChange={e => setExpDate(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              {isSettlementForm ? (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>RECIPIENT (PAID TO)</label>
                  <select 
                    className="form-input" 
                    value={expNotes} // Use expNotes temporarily
                    onChange={e => setExpNotes(e.target.value)} 
                    required
                  >
                    <option value="">Select recipient</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.username}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>SPLIT METHOD</label>
                    <select className="form-input" value={expSplitType} onChange={e => setExpSplitType(e.target.value)}>
                      <option value="equal">Split Equally</option>
                      <option value="percentage">Custom Percentages (%)</option>
                      <option value="share">Custom Shares (ratios)</option>
                    </select>
                  </div>

                  {(expSplitType === 'percentage' || expSplitType === 'share') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        Enter {expSplitType === 'percentage' ? 'percentages (sums to 100%)' : 'share coefficients'} per user:
                      </span>
                      {members.map(m => (
                        <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '0.85rem' }}>{m.username}</span>
                          <input 
                            type="number" 
                            className="form-input" 
                            placeholder="0"
                            value={customSplits[m.id] || ''}
                            onChange={e => setCustomSplits({
                              ...customSplits,
                              [m.id]: parseFloat(e.target.value) || 0
                            })}
                            style={{ width: '80px', padding: '6px', fontSize: '0.8rem', textAlign: 'right' }}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>NOTES & ATTACHMENTS</label>
                    <textarea 
                      className="form-input" 
                      placeholder="Optional details (e.g. details of items)..."
                      value={expNotes} 
                      onChange={e => setExpNotes(e.target.value)} 
                      style={{ minHeight: '60px', resize: 'vertical' }}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" onClick={() => setIsAddingExpense(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Transaction</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
