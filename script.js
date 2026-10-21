/**
 * CASAPI - FAMILY BUDGETING WEB APPLICATION
 * Modern, responsive Philippine household finance manager.
 * Featuring the unique Family Budget Impact Simulator & Essential Needs Protection Shield.
 * 
 * Built with HTML5, CSS3, and Vanilla JavaScript.
 */

// ==========================================================================
// 1. GLOBAL STATE & DEFAULT DEMO DATA
// ==========================================================================

const STORAGE_KEYS = {
  USERS: 'casapi_users',
  SESSION: 'casapi_session',
  FAMILY_SETTINGS: 'casapi_family_settings',
  MEMBERS: 'casapi_members',
  CATEGORIES: 'casapi_categories',
  INCOMES: 'casapi_incomes',
  EXPENSES: 'casapi_expenses',
  ESSENTIAL_NEEDS: 'casapi_essential_needs',
  SAVINGS_GOALS: 'casapi_savings_goals',
  VOTING_PROPOSALS: 'casapi_voting_proposals',
  THEME: 'casapi_theme'
};

// Default Category Definitions
const DEFAULT_CATEGORIES = [
  { id: 'cat-groceries', name: 'Food & Groceries', icon: 'fa-utensils', limit: 18000, isEssential: true },
  { id: 'cat-electricity', name: 'Electricity & Utilities', icon: 'fa-bolt', limit: 6500, isEssential: true },
  { id: 'cat-water', name: 'Water Utility', icon: 'fa-droplet', limit: 1500, isEssential: true },
  { id: 'cat-rent', name: 'Rent & Housing', icon: 'fa-house', limit: 12000, isEssential: true },
  { id: 'cat-transport', name: 'Transportation & Gas', icon: 'fa-bus', limit: 5000, isEssential: true },
  { id: 'cat-education', name: 'Education & Tuition', icon: 'fa-graduation-cap', limit: 6000, isEssential: true },
  { id: 'cat-health', name: 'Healthcare & Medicine', icon: 'fa-heart-pulse', limit: 4000, isEssential: true },
  { id: 'cat-internet', name: 'Internet & Telecom', icon: 'fa-wifi', limit: 2000, isEssential: true },
  { id: 'cat-entertainment', name: 'Entertainment & Outings', icon: 'fa-gamepad', limit: 3000, isEssential: false },
  { id: 'cat-shopping', name: 'Shopping & Dining Out', icon: 'fa-bag-shopping', limit: 3500, isEssential: false },
  { id: 'cat-others', name: 'Other Miscellaneous', icon: 'fa-ellipsis', limit: 2000, isEssential: false }
];

// App State Container
let AppState = {
  currentUser: null,
  settings: {
    familyName: 'The Santos Family',
    monthlyOverallBudget: 55000,
    votingThreshold: 1500,
    currencySymbol: '₱',
    activeMemberId: null
  },
  members: [],
  categories: [],
  incomes: [],
  expenses: [],
  essentialNeeds: [],
  savingsGoals: [],
  votingProposals: []
};

// Global Chart Instances (for clean canvas re-renders)
const ChartInstances = {
  dashComparison: null,
  dashCategories: null,
  reportsFlow: null,
  reportsCategory: null,
  reportsPriority: null,
  reportsTrend: null
};

// ==========================================================================
// 2. CRYPTOGRAPHIC & FORMATTING HELPERS
// ==========================================================================

/**
 * Hash string with SHA-256 for educational prototype client-side storage
 * Avoids storing plaintext passwords in localStorage.
 */
async function hashPassword(plainText) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(plainText);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    // Fallback pseudo-hash if Web Crypto API is unavailable in vintage environments
    let hash = 0;
    for (let i = 0; i < plainText.length; i++) {
      hash = (hash << 5) - hash + plainText.charCodeAt(i);
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(16);
  }
}

/**
 * Format numerical amount to Philippine Pesos (₱)
 * e.g., 12500 -> "₱12,500.00"
 */
function formatPHP(amount) {
  const num = Number(amount) || 0;
  return '₱' + num.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Format Date to readable string (e.g., "Oct 15, 2026")
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Generate unique random ID
 */
function generateId(prefix = 'item') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

// ==========================================================================
// 3. TOAST & CONFIRMATION NOTIFICATIONS
// ==========================================================================

function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'fa-circle-info';
  if (type === 'success') icon = 'fa-circle-check text-success';
  if (type === 'danger') icon = 'fa-triangle-exclamation text-danger';
  if (type === 'warning') icon = 'fa-triangle-exclamation text-warning';

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

let confirmCallback = null;
function openConfirmModal(title, message, onConfirm) {
  const modal = document.getElementById('confirm-modal');
  document.getElementById('confirm-modal-title').textContent = title;
  document.getElementById('confirm-modal-message').textContent = message;
  confirmCallback = onConfirm;
  modal.classList.remove('hidden');
}

function closeConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  modal.classList.add('hidden');
  confirmCallback = null;
}

// ==========================================================================
// 4. SEED SAMPLE FILIPINO FAMILY DEMO DATA
// ==========================================================================

async function loadDemoData(force = false) {
  const hasLoadedBefore = localStorage.getItem('casapi_initialized');
  if (hasLoadedBefore && !force) return;

  // Default User Account (Roberto Santos)
  const defaultPasswordHash = await hashPassword('Family123!');
  const demoUsers = [
    {
      name: 'Roberto Santos',
      familyName: 'The Santos Family',
      email: 'santos.family@demo.ph',
      passwordHash: defaultPasswordHash,
      createdAt: new Date().toISOString()
    }
  ];

  // Default Family Members
  const demoMembers = [
    { id: 'mem-1', name: 'Roberto Santos', role: 'Father / Head', avatarColor: '#059669', isPrimary: true },
    { id: 'mem-2', name: 'Maria Santos', role: 'Mother / Parent', avatarColor: '#0284c7', isPrimary: false },
    { id: 'mem-3', name: 'Juan Santos', role: 'Eldest Child', avatarColor: '#d97706', isPrimary: false },
    { id: 'mem-4', name: 'Carla Santos', role: 'Child / Student', avatarColor: '#8b5cf6', isPrimary: false }
  ];

  // Current Month String (YYYY-MM-DD)
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // Realistic Income Records
  const demoIncomes = [
    {
      id: generateId('inc'),
      source: 'IT Project Manager Salary (Roberto)',
      amount: 48000,
      date: `${year}-${month}-05`,
      memberId: 'mem-1',
      notes: 'Net monthly base payout'
    },
    {
      id: generateId('inc'),
      source: 'Online Home Bakery Sales (Maria)',
      amount: 17000,
      date: `${year}-${month}-10`,
      memberId: 'mem-2',
      notes: 'Weekend cake & pastry orders'
    }
  ];

  // Realistic Expense Records
  const demoExpenses = [
    { id: generateId('exp'), name: 'Meralco Electricity Bill', amount: 5200, category: 'cat-electricity', priority: 'essential', date: `${year}-${month}-08`, memberId: 'mem-1' },
    { id: generateId('exp'), name: 'Puregold Monthly Groceries', amount: 9800, category: 'cat-groceries', priority: 'essential', date: `${year}-${month}-06`, memberId: 'mem-2' },
    { id: generateId('exp'), name: 'Manila Water Utility', amount: 1150, category: 'cat-water', priority: 'essential', date: `${year}-${month}-09`, memberId: 'mem-1' },
    { id: generateId('exp'), name: 'PLDT Home Fiber Internet', amount: 1899, category: 'cat-internet', priority: 'essential', date: `${year}-${month}-04`, memberId: 'mem-1' },
    { id: generateId('exp'), name: 'Shell Gasoline / Fuel', amount: 3500, category: 'cat-transport', priority: 'essential', date: `${year}-${month}-07`, memberId: 'mem-1' },
    { id: generateId('exp'), name: 'School Books & Supplies', amount: 2400, category: 'cat-education', priority: 'essential', date: `${year}-${month}-03`, memberId: 'mem-3' },
    { id: generateId('exp'), name: 'Maintenance Vitamins & Pharmacy', amount: 1650, category: 'cat-health', priority: 'essential', date: `${year}-${month}-05`, memberId: 'mem-2' },
    { id: generateId('exp'), name: 'Jollibee Family Sunday Dinner', amount: 1450, category: 'cat-shopping', priority: 'nonessential', date: `${year}-${month}-10`, memberId: 'mem-1' },
    { id: generateId('exp'), name: 'Netflix & Spotify Plans', amount: 699, category: 'cat-entertainment', priority: 'nonessential', date: `${year}-${month}-02`, memberId: 'mem-3' }
  ];

  // Essential Needs Shield Targets (Quarantined Funds)
  const demoEssentialNeeds = [
    { id: generateId('need'), name: 'Meralco Electricity Target', targetAmount: 6500, category: 'cat-electricity', dueDay: 15 },
    { id: generateId('need'), name: 'Manila Water Target', targetAmount: 1500, category: 'cat-water', dueDay: 18 },
    { id: generateId('need'), name: 'House Rental / Mortgage', targetAmount: 12000, category: 'cat-rent', dueDay: 25 },
    { id: generateId('need'), name: 'Supermarket & Palengke Food', targetAmount: 18000, category: 'cat-groceries', dueDay: 30 },
    { id: generateId('need'), name: 'School Allowance & Tuition', targetAmount: 6000, category: 'cat-education', dueDay: 20 },
    { id: generateId('need'), name: 'Family Medical Fund', targetAmount: 4000, category: 'cat-health', dueDay: 28 }
  ];

  // Savings Goals
  const demoSavingsGoals = [
    {
      id: generateId('goal'),
      name: 'Emergency Fund (6 Months)',
      targetAmount: 100000,
      currentSaved: 42000,
      targetDate: `${year + 1}-12-31`,
      category: 'Emergency'
    },
    {
      id: generateId('goal'),
      name: 'College Tuition Fund (Juan & Carla)',
      targetAmount: 80000,
      currentSaved: 28500,
      targetDate: `${year + 1}-06-30`,
      category: 'Education'
    },
    {
      id: generateId('goal'),
      name: 'Palawan Summer Family Trip',
      targetAmount: 35000,
      currentSaved: 14000,
      targetDate: `${year + 1}-04-15`,
      category: 'Vacation'
    }
  ];

  // Family Purchase Voting Proposals
  const demoVotingProposals = [
    {
      id: generateId('prop'),
      title: 'Inverter Living Room Aircon (1.5 HP)',
      price: 24500,
      category: 'cat-electricity',
      priority: 'essential',
      proposedBy: 'Roberto Santos',
      date: `${year}-${month}-11`,
      reason: 'Our old window-type AC is 10 years old and consumes too much electricity. An inverter unit will lower our monthly Meralco bill by 30% and help the children study comfortably.',
      votes: [
        { memberId: 'mem-1', memberName: 'Roberto Santos', vote: 'approve', timestamp: new Date().toISOString() },
        { memberId: 'mem-2', memberName: 'Maria Santos', vote: 'cheaper', timestamp: new Date().toISOString() },
        { memberId: 'mem-3', memberName: 'Juan Santos', vote: 'approve', timestamp: new Date().toISOString() }
      ],
      comments: [
        { memberName: 'Maria Santos', text: 'I agree we need one, but Abenson has a 1.0 HP model on sale for ₱18,990! Should we check that out?' },
        { memberName: 'Roberto Santos', text: 'Good catch, Nanay! Let\'s test the ₱18,990 option in the Impact Simulator first.' }
      ],
      status: 'pending'
    }
  ];

  // Commit to Local Storage
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(demoUsers));
  localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(demoMembers));
  localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
  localStorage.setItem(STORAGE_KEYS.INCOMES, JSON.stringify(demoIncomes));
  localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(demoExpenses));
  localStorage.setItem(STORAGE_KEYS.ESSENTIAL_NEEDS, JSON.stringify(demoEssentialNeeds));
  localStorage.setItem(STORAGE_KEYS.SAVINGS_GOALS, JSON.stringify(demoSavingsGoals));
  localStorage.setItem(STORAGE_KEYS.VOTING_PROPOSALS, JSON.stringify(demoVotingProposals));
  localStorage.setItem(STORAGE_KEYS.FAMILY_SETTINGS, JSON.stringify({
    familyName: 'The Santos Family',
    monthlyOverallBudget: 55000,
    votingThreshold: 1500,
    currencySymbol: '₱',
    activeMemberId: 'mem-1'
  }));

  localStorage.setItem('casapi_initialized', 'true');
}

// ==========================================================================
// 5. DATA PERSISTENCE & STATE SYNCHRONIZATION
// ==========================================================================

function loadStateFromStorage() {
  try {
    const rawSettings = localStorage.getItem(STORAGE_KEYS.FAMILY_SETTINGS);
    if (rawSettings) AppState.settings = JSON.parse(rawSettings);

    const rawMembers = localStorage.getItem(STORAGE_KEYS.MEMBERS);
    AppState.members = rawMembers ? JSON.parse(rawMembers) : [];

    const rawCategories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    AppState.categories = rawCategories ? JSON.parse(rawCategories) : DEFAULT_CATEGORIES;

    const rawIncomes = localStorage.getItem(STORAGE_KEYS.INCOMES);
    AppState.incomes = rawIncomes ? JSON.parse(rawIncomes) : [];

    const rawExpenses = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    AppState.expenses = rawExpenses ? JSON.parse(rawExpenses) : [];

    const rawNeeds = localStorage.getItem(STORAGE_KEYS.ESSENTIAL_NEEDS);
    AppState.essentialNeeds = rawNeeds ? JSON.parse(rawNeeds) : [];

    const rawGoals = localStorage.getItem(STORAGE_KEYS.SAVINGS_GOALS);
    AppState.savingsGoals = rawGoals ? JSON.parse(rawGoals) : [];

    const rawProposals = localStorage.getItem(STORAGE_KEYS.VOTING_PROPOSALS);
    AppState.votingProposals = rawProposals ? JSON.parse(rawProposals) : [];

    const rawSession = localStorage.getItem(STORAGE_KEYS.SESSION);
    AppState.currentUser = rawSession ? JSON.parse(rawSession) : null;

    // Ensure active member is valid
    if (!AppState.settings.activeMemberId && AppState.members.length > 0) {
      AppState.settings.activeMemberId = AppState.members[0].id;
    }
  } catch (err) {
    console.error('Failed to load state from localStorage:', err);
  }
}

function saveState(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Failed to save ${key}:`, err);
  }
}

// ==========================================================================
// 6. FINANCIAL COMPUTATION ENGINE
// ==========================================================================

const FinancialEngine = {
  /**
   * Total income for current month
   */
  getTotalMonthlyIncome() {
    return AppState.incomes.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  },

  /**
   * Total expenses recorded this month
   */
  getTotalMonthlyExpenses() {
    return AppState.expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  },

  /**
   * Essential expenses spent so far
   */
  getEssentialExpensesSpent() {
    return AppState.expenses
      .filter(item => item.priority === 'essential')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  },

  /**
   * Non-essential expenses spent so far
   */
  getNonEssentialExpensesSpent() {
    return AppState.expenses
      .filter(item => item.priority === 'nonessential')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  },

  /**
   * Remaining overall family budget
   */
  getRemainingBudget() {
    const cap = Number(AppState.settings.monthlyOverallBudget) || 0;
    const spent = this.getTotalMonthlyExpenses();
    return Math.max(0, cap - spent);
  },

  /**
   * Total funds accumulated across all savings goals
   */
  getTotalSavings() {
    return AppState.savingsGoals.reduce((sum, g) => sum + (Number(g.currentSaved) || 0), 0);
  },

  /**
   * Total Essential Reserve Target
   */
  getTotalEssentialTarget() {
    return AppState.essentialNeeds.reduce((sum, n) => sum + (Number(n.targetAmount) || 0), 0);
  },

  /**
   * Calculate Remaining Reserved Funds needed for rest of month.
   * Compares each essential target against actual spend in that category.
   */
  getRemainingEssentialReservedNeeded() {
    return AppState.essentialNeeds.reduce((sum, need) => {
      const spentInCat = AppState.expenses
        .filter(e => e.category === need.category)
        .reduce((catSum, e) => catSum + (Number(e.amount) || 0), 0);

      const target = Number(need.targetAmount) || 0;
      const remainingForThisNeed = Math.max(0, target - spentInCat);
      return sum + remainingForThisNeed;
    }, 0);
  },

  /**
   * Truly Discretionary "Safe-to-Spend" Cash:
   * Remaining Budget minus Remaining Essential Reserves
   */
  getSafeToSpendCash() {
    const remainingBudget = this.getRemainingBudget();
    const remainingEssentialReserves = this.getRemainingEssentialReservedNeeded();
    return Math.max(0, remainingBudget - remainingEssentialReserves);
  },

  /**
   * Spending aggregated by Category ID
   */
  getSpendingByCategory() {
    const breakdown = {};
    AppState.categories.forEach(cat => { breakdown[cat.id] = 0; });
    AppState.expenses.forEach(exp => {
      if (breakdown[exp.category] !== undefined) {
        breakdown[exp.category] += Number(exp.amount) || 0;
      } else {
        breakdown[exp.category] = Number(exp.amount) || 0;
      }
    });
    return breakdown;
  },

  /**
   * Spending by Family Member ID
   */
  getSpendingByMember() {
    const breakdown = {};
    AppState.members.forEach(m => { breakdown[m.id] = 0; });
    AppState.expenses.forEach(exp => {
      if (breakdown[exp.memberId] !== undefined) {
        breakdown[exp.memberId] += Number(exp.amount) || 0;
      }
    });
    return breakdown;
  },

  /**
   * Income by Family Member ID
   */
  getIncomeByMember() {
    const breakdown = {};
    AppState.members.forEach(m => { breakdown[m.id] = 0; });
    AppState.incomes.forEach(inc => {
      if (breakdown[inc.memberId] !== undefined) {
        breakdown[inc.memberId] += Number(inc.amount) || 0;
      }
    });
    return breakdown;
  }
};

// ==========================================================================
// 7. BUDGET IMPACT SIMULATOR ENGINE (FLAGSHIP FEATURE)
// ==========================================================================

const SimulatorEngine = {
  /**
   * Run simulation on a proposed purchase price & priority
   * Uses real, saved financial state (no fabricated numbers).
   */
  simulatePurchase(price, priority = 'nonessential') {
    const purchasePrice = Number(price) || 0;
    const curRemainingBudget = FinancialEngine.getRemainingBudget();
    const curEssentialReservesNeeded = FinancialEngine.getRemainingEssentialReservedNeeded();
    const curSafeToSpend = FinancialEngine.getSafeToSpendCash();

    // Calculations post-purchase
    const afterRemainingBudget = curRemainingBudget - purchasePrice;
    const afterSafeToSpend = curSafeToSpend - purchasePrice;

    // Safety checks
    const fitsWithinOverallBudget = afterRemainingBudget >= 0;
    const protectsEssentialReserves = purchasePrice <= curSafeToSpend;
    const keepsSavingsIntact = afterRemainingBudget >= 2000; // Leaves at least ₱2,000 breathing buffer

    let verdict = 'safe';
    let title = 'Within Budget & Safe to Purchase';
    let badge = 'Within Budget';
    let explanation = '';

    if (!fitsWithinOverallBudget) {
      verdict = 'danger';
      badge = 'Exceeds Budget';
      title = 'Deficit Warning: Exceeds Monthly Family Budget!';
      explanation = `This purchase will push your family budget into a deficit of ${formatPHP(Math.abs(afterRemainingBudget))}. Immediate cutbacks would be required.`;
    } else if (!protectsEssentialReserves) {
      verdict = 'danger';
      badge = 'May Affect Essential Expenses';
      title = 'Critical Warning: May Affect Essential Needs Shield!';
      explanation = `While your overall balance appears positive, spending this amount will dip ${formatPHP(Math.abs(afterSafeToSpend))} into money quarantined for Meralco, Rent, Groceries, or Tuition!`;
    } else if (priority === 'nonessential' && purchasePrice > curSafeToSpend * 0.55) {
      verdict = 'caution';
      badge = 'Consider a Cheaper Option';
      title = 'Caution: Takes Over 55% of Discretionary Cash';
      explanation = `This purchase consumes ${Math.round((purchasePrice / curSafeToSpend) * 100)}% of your remaining free-to-spend buffer. We strongly suggest checking a cheaper alternative or submitting it to Family Voting.`;
    } else {
      verdict = 'safe';
      badge = 'Within Budget';
      title = 'Approved: Safe & Within Family Budget';
      explanation = `Your family can safely afford this purchase! All upcoming essential bills (${formatPHP(curEssentialReservesNeeded)}) remain 100% protected, leaving ${formatPHP(Math.max(0, afterSafeToSpend))} in discretionary cushion.`;
    }

    return {
      purchasePrice,
      curRemainingBudget,
      afterRemainingBudget,
      curEssentialReservesNeeded,
      curSafeToSpend,
      afterSafeToSpend,
      fitsWithinOverallBudget,
      protectsEssentialReserves,
      keepsSavingsIntact,
      verdict,
      badge,
      title,
      explanation
    };
  }
};

// ==========================================================================
// 8. VIEW ROUTER & NAVIGATION
// ==========================================================================

function initNavigation() {
  const navButtons = document.querySelectorAll('.nav-link[data-view]');
  navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const viewId = btn.getAttribute('data-view');
      navigateToView(viewId);

      // Close mobile sidebar if open
      closeMobileSidebar();
    });
  });

  // Topbar & In-page quick action buttons
  document.getElementById('quick-open-simulator-btn')?.addEventListener('click', () => {
    navigateToView('view-simulator');
  });

  document.getElementById('manage-bills-link')?.addEventListener('click', () => {
    navigateToView('view-essential-needs');
  });

  document.getElementById('view-all-tx-link')?.addEventListener('click', () => {
    navigateToView('view-expenses');
  });

  // Mobile drawer controls
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const sidebarClose = document.getElementById('sidebar-close-btn');

  mobileToggle?.addEventListener('click', openMobileSidebar);
  sidebarBackdrop?.addEventListener('click', closeMobileSidebar);
  sidebarClose?.addEventListener('click', closeMobileSidebar);

  // Active family member switcher dropdown in sidebar
  const activeMemberSelect = document.getElementById('active-member-select');
  activeMemberSelect?.addEventListener('change', (e) => {
    AppState.settings.activeMemberId = e.target.value;
    saveState(STORAGE_KEYS.FAMILY_SETTINGS, AppState.settings);
    updateActiveMemberUI();
    renderVotingView(); // re-render voting to update active voter status
    showToast(`Now browsing as ${getActiveMember()?.name}`, 'info');
  });
}

function openMobileSidebar() {
  document.getElementById('app-sidebar')?.classList.add('open');
  document.getElementById('sidebar-backdrop')?.classList.add('active');
}

function closeMobileSidebar() {
  document.getElementById('app-sidebar')?.classList.remove('open');
  document.getElementById('sidebar-backdrop')?.classList.remove('active');
}

function navigateToView(viewId) {
  // Update nav link active classes
  document.querySelectorAll('.nav-link[data-view]').forEach(link => {
    if (link.getAttribute('data-view') === viewId) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Toggle view visibility
  document.querySelectorAll('.app-view').forEach(view => {
    if (view.id === viewId) {
      view.classList.add('active');
    } else {
      view.classList.remove('active');
    }
  });

  // Update Topbar Title
  const viewTitles = {
    'view-dashboard': 'Dashboard',
    'view-income': 'Income Management',
    'view-expenses': 'Expense Management',
    'view-budget': 'Family Budget Limits',
    'view-members': 'Family Members',
    'view-simulator': 'Budget Impact Simulator',
    'view-essential-needs': 'Essential Needs Protection Shield',
    'view-voting': 'Family Purchase Voting',
    'view-savings': 'Savings Goals',
    'view-reports': 'Reports & Financial Analytics',
    'view-settings': 'Settings & Preferences'
  };
  const titleEl = document.getElementById('topbar-page-title');
  if (titleEl && viewTitles[viewId]) {
    titleEl.textContent = viewTitles[viewId];
  }

  // Trigger page-specific re-renders
  if (viewId === 'view-dashboard') renderDashboardView();
  if (viewId === 'view-income') renderIncomeView();
  if (viewId === 'view-expenses') renderExpenseView();
  if (viewId === 'view-budget') renderBudgetView();
  if (viewId === 'view-members') renderMembersView();
  if (viewId === 'view-simulator') renderSimulatorView();
  if (viewId === 'view-essential-needs') renderEssentialNeedsView();
  if (viewId === 'view-voting') renderVotingView();
  if (viewId === 'view-savings') renderSavingsView();
  if (viewId === 'view-reports') renderReportsView();
  if (viewId === 'view-settings') renderSettingsView();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getActiveMember() {
  return AppState.members.find(m => m.id === AppState.settings.activeMemberId) || AppState.members[0];
}

function updateActiveMemberUI() {
  const activeMember = getActiveMember();
  if (!activeMember) return;

  const select = document.getElementById('active-member-select');
  if (select) {
    select.innerHTML = AppState.members.map(m => `
      <option value="${m.id}" ${m.id === activeMember.id ? 'selected' : ''}>
        ${m.name} (${m.role})
      </option>
    `).join('');
  }

  // Update Voting page badge
  const voterLabel = document.getElementById('voting-current-member-name');
  if (voterLabel) voterLabel.textContent = `${activeMember.name} (${activeMember.role})`;

  // Update Sidebar user card
  const sidebarName = document.getElementById('sidebar-user-name');
  const sidebarAvatar = document.getElementById('sidebar-user-avatar');
  if (sidebarName) sidebarName.textContent = activeMember.name;
  if (sidebarAvatar) {
    sidebarAvatar.style.backgroundColor = activeMember.avatarColor || '#10b981';
    sidebarAvatar.innerHTML = `<i class="fa-solid fa-user"></i>`;
  }
}

// ==========================================================================
// 9. AUTHENTICATION & SESSION MANAGEMENT
// ==========================================================================

function initAuth() {
  const authSection = document.getElementById('auth-section');
  const appSection = document.getElementById('app-section');

  const tabLoginBtn = document.getElementById('tab-login-btn');
  const tabSignupBtn = document.getElementById('tab-signup-btn');
  const loginContainer = document.getElementById('login-form-container');
  const signupContainer = document.getElementById('signup-form-container');

  const linkToSignup = document.getElementById('link-to-signup');
  const linkToLogin = document.getElementById('link-to-login');

  // Tab switching
  function showLogin() {
    tabLoginBtn?.classList.add('active');
    tabSignupBtn?.classList.remove('active');
    loginContainer?.classList.remove('hidden');
    signupContainer?.classList.add('hidden');
  }

  function showSignup() {
    tabSignupBtn?.classList.add('active');
    tabLoginBtn?.classList.remove('active');
    signupContainer?.classList.remove('hidden');
    loginContainer?.classList.add('hidden');
  }

  tabLoginBtn?.addEventListener('click', showLogin);
  tabSignupBtn?.addEventListener('click', showSignup);
  linkToSignup?.addEventListener('click', showSignup);
  linkToLogin?.addEventListener('click', showLogin);

  // Toggle Password visibility
  setupPasswordToggle('login-password', 'toggle-login-password');
  setupPasswordToggle('signup-password', 'toggle-signup-password');
  setupPasswordToggle('signup-confirm-password', 'toggle-signup-confirm-password');

  // Login Form Submission
  const loginForm = document.getElementById('login-form');
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(['login-email-error', 'login-password-error']);

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    let hasError = false;
    if (!email || !isValidEmail(email)) {
      setError('login-email-error', 'Please enter a valid email address.');
      hasError = true;
    }
    if (!password) {
      setError('login-password-error', 'Password is required.');
      hasError = true;
    }
    if (hasError) return;

    // Validate against stored users
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      setError('login-email-error', 'No family account found with this email.');
      return;
    }

    const hashedInput = await hashPassword(password);
    if (user.passwordHash !== hashedInput) {
      setError('login-password-error', 'Incorrect password. Try again.');
      return;
    }

    // Success: Establish Session
    const session = {
      email: user.email,
      name: user.name,
      familyName: user.familyName || 'The Santos Family',
      loggedInAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    AppState.currentUser = session;

    showToast(`Welcome back, ${user.name}!`, 'success');
    loginForm.reset();
    renderAppSession();
  });

  // Quick One-Click Demo Login
  document.getElementById('quick-demo-login-btn')?.addEventListener('click', () => {
    const session = {
      email: 'santos.family@demo.ph',
      name: 'Roberto Santos',
      familyName: 'The Santos Family',
      loggedInAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    AppState.currentUser = session;
    showToast('Logged in as Roberto Santos (Demo Mode)', 'success');
    renderAppSession();
  });

  // Sign-Up Form Submission
  const signupForm = document.getElementById('signup-form');
  signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(['signup-name-error', 'signup-family-name-error', 'signup-email-error', 'signup-password-error', 'signup-confirm-error']);

    const name = document.getElementById('signup-name').value.trim();
    const familyName = document.getElementById('signup-family-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;

    let hasError = false;
    if (!name) { setError('signup-name-error', 'Full name is required.'); hasError = true; }
    if (!familyName) { setError('signup-family-name-error', 'Family name is required.'); hasError = true; }
    if (!email || !isValidEmail(email)) { setError('signup-email-error', 'Valid email is required.'); hasError = true; }
    if (!password || password.length < 6) { setError('signup-password-error', 'Password must be at least 6 characters.'); hasError = true; }
    if (password !== confirmPassword) { setError('signup-confirm-error', 'Passwords do not match.'); hasError = true; }

    if (hasError) return;

    // Check existing email
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      setError('signup-email-error', 'This email is already registered.');
      return;
    }

    // Hash password & store
    const passwordHash = await hashPassword(password);
    const newUser = {
      name,
      familyName,
      email,
      passwordHash,
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    // Update family settings
    AppState.settings.familyName = familyName;
    saveState(STORAGE_KEYS.FAMILY_SETTINGS, AppState.settings);

    // Auto-create administrator member
    const newMember = {
      id: generateId('mem'),
      name,
      role: 'Family Head / Administrator',
      avatarColor: '#059669',
      isPrimary: true
    };
    AppState.members.unshift(newMember);
    AppState.settings.activeMemberId = newMember.id;
    saveState(STORAGE_KEYS.MEMBERS, AppState.members);
    saveState(STORAGE_KEYS.FAMILY_SETTINGS, AppState.settings);

    // Automatically establish session
    const session = { email, name, familyName, loggedInAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    AppState.currentUser = session;

    showToast('Family account created successfully!', 'success');
    signupForm.reset();
    renderAppSession();
  });

  // Forgot Password Simulation Modal
  const forgotTrigger = document.getElementById('forgot-password-trigger');
  const forgotModal = document.getElementById('forgot-password-modal');
  const closeForgotBtn = document.getElementById('close-forgot-modal');
  const cancelResetBtn = document.getElementById('cancel-reset-btn');
  const submitResetBtn = document.getElementById('submit-reset-btn');

  forgotTrigger?.addEventListener('click', () => forgotModal?.classList.remove('hidden'));
  closeForgotBtn?.addEventListener('click', () => forgotModal?.classList.add('hidden'));
  cancelResetBtn?.addEventListener('click', () => forgotModal?.classList.add('hidden'));

  submitResetBtn?.addEventListener('click', async () => {
    const email = document.getElementById('reset-email').value.trim();
    const newPassword = document.getElementById('reset-new-password').value;

    if (!email || !isValidEmail(email)) {
      showToast('Enter a valid email address.', 'danger');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      showToast('Password must be at least 6 characters.', 'danger');
      return;
    }

    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

    if (userIndex === -1) {
      showToast('No account registered with that email.', 'danger');
      return;
    }

    users[userIndex].passwordHash = await hashPassword(newPassword);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    showToast('Password successfully reset! You can now log in.', 'success');
    forgotModal?.classList.add('hidden');
    document.getElementById('reset-email').value = '';
    document.getElementById('reset-new-password').value = '';
  });

  // Logout Handlers
  document.getElementById('sidebar-logout-btn')?.addEventListener('click', handleLogout);
  document.getElementById('settings-logout-btn')?.addEventListener('click', handleLogout);
}

function handleLogout() {
  openConfirmModal('Confirm Logout', 'Are you sure you want to end your family budgeting session?', () => {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    AppState.currentUser = null;
    showToast('You have been logged out.', 'info');
    renderAppSession();
    closeConfirmModal();
  });
}

function renderAppSession() {
  const authSection = document.getElementById('auth-section');
  const appSection = document.getElementById('app-section');

  const session = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSION) || 'null');
  AppState.currentUser = session;

  if (session) {
    authSection?.classList.add('hidden');
    appSection?.classList.remove('hidden');

    // Update User info in headers & sidebar
    const greetingEl = document.getElementById('dashboard-welcome-heading');
    if (greetingEl) greetingEl.textContent = `Magandang araw, ${session.name}! 👋`;

    const sidebarFamilyName = document.getElementById('sidebar-family-name');
    if (sidebarFamilyName) sidebarFamilyName.textContent = AppState.settings.familyName || 'The Santos Family';

    const sidebarUserName = document.getElementById('sidebar-user-name');
    const sidebarUserEmail = document.getElementById('sidebar-user-email');
    if (sidebarUserName) sidebarUserName.textContent = session.name;
    if (sidebarUserEmail) sidebarUserEmail.textContent = session.email;

    updateActiveMemberUI();
    renderAllViews();
  } else {
    authSection?.classList.remove('hidden');
    appSection?.classList.add('hidden');
  }
}

function setupPasswordToggle(inputId, toggleBtnId) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(toggleBtnId);
  if (!input || !btn) return;

  btn.addEventListener('click', () => {
    const isPassword = input.getAttribute('type') === 'password';
    input.setAttribute('type', isPassword ? 'text' : 'password');
    btn.innerHTML = isPassword
      ? `<i class="fa-regular fa-eye-slash"></i>`
      : `<i class="fa-regular fa-eye"></i>`;
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setError(elementId, msg) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = msg;
}

function clearErrors(elementIds) {
  elementIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

// ==========================================================================
// 10. RENDER VIEW 1: DASHBOARD
// ==========================================================================

function renderDashboardView() {
  const totalIncome = FinancialEngine.getTotalMonthlyIncome();
  const totalExpenses = FinancialEngine.getTotalMonthlyExpenses();
  const remainingBudget = FinancialEngine.getRemainingBudget();
  const totalSavings = FinancialEngine.getTotalSavings();
  const overallCap = Number(AppState.settings.monthlyOverallBudget) || 55000;
  const safeToSpend = FinancialEngine.getSafeToSpendCash();
  const essentialReservesNeeded = FinancialEngine.getRemainingEssentialReservedNeeded();

  // Metric 1: Income
  document.getElementById('dash-total-income').textContent = formatPHP(totalIncome);
  document.getElementById('dash-income-count-text').textContent = `${AppState.incomes.length} contributing sources`;
  document.getElementById('nav-income-badge').textContent = formatPHP(totalIncome);

  // Metric 2: Expenses
  document.getElementById('dash-total-expenses').textContent = formatPHP(totalExpenses);
  const essentialSpent = FinancialEngine.getEssentialExpensesSpent();
  const essentialPct = totalExpenses > 0 ? Math.round((essentialSpent / totalExpenses) * 100) : 0;
  document.getElementById('dash-expense-essential-ratio').textContent = `Essential: ${formatPHP(essentialSpent)} (${essentialPct}%)`;
  document.getElementById('nav-expense-badge').textContent = formatPHP(totalExpenses);

  // Metric 3: Remaining Budget
  const budgetEl = document.getElementById('dash-remaining-budget');
  budgetEl.textContent = formatPHP(remainingBudget);
  budgetEl.className = `metric-value ${remainingBudget > 0 ? 'text-success' : 'text-danger'}`;
  const budgetUsagePct = overallCap > 0 ? Math.min(100, Math.round((totalExpenses / overallCap) * 100)) : 0;
  document.getElementById('dash-budget-utilization').textContent = `${budgetUsagePct}% of monthly cap used`;

  // Metric 4: Savings
  document.getElementById('dash-total-savings').textContent = formatPHP(totalSavings);
  document.getElementById('dash-savings-goals-count').textContent = `${AppState.savingsGoals.length} Active Goals`;

  // Safe to Spend Banner
  document.getElementById('dash-safe-spend-value').textContent = formatPHP(safeToSpend);
  document.getElementById('dash-safe-spend-math').textContent =
    `Remaining Budget (${formatPHP(remainingBudget)}) − Essential Shield Buffer (${formatPHP(essentialReservesNeeded)}) =`;
  
  const safeStatusEl = document.getElementById('dash-safe-spend-status');
  if (safeToSpend > 5000) {
    safeStatusEl.textContent = 'Protected & High Buffer';
    safeStatusEl.className = 'text-xs font-bold text-success';
  } else if (safeToSpend > 0) {
    safeStatusEl.textContent = 'Protected & Moderate';
    safeStatusEl.className = 'text-xs font-bold text-warning';
  } else {
    safeStatusEl.textContent = 'Shield Under Pressure';
    safeStatusEl.className = 'text-xs font-bold text-danger';
  }

  // Budget Progress Bar
  const progressBar = document.getElementById('dash-budget-progress-bar');
  const spentPct = overallCap > 0 ? Math.round((totalExpenses / overallCap) * 100) : 0;
  progressBar.style.width = `${Math.min(100, spentPct)}%`;
  progressBar.className = `progress-bar-fill ${spentPct >= 95 ? 'danger' : spentPct >= 75 ? 'warning' : ''}`;

  document.getElementById('dash-progress-spent-text').textContent = `Spent: ${formatPHP(totalExpenses)}`;
  document.getElementById('dash-progress-percent-text').textContent = `${spentPct}%`;
  document.getElementById('dash-progress-limit-text').textContent = `Cap: ${formatPHP(overallCap)}`;

  const statusTag = document.getElementById('dash-budget-status-tag');
  if (spentPct >= 100) {
    statusTag.textContent = 'Budget Exceeded';
    statusTag.className = 'status-tag danger';
  } else if (spentPct >= 80) {
    statusTag.textContent = 'Approaching Cap';
    statusTag.className = 'status-tag warning';
  } else {
    statusTag.textContent = 'On Track';
    statusTag.className = 'status-tag on-track';
  }

  // Render Upcoming Bills Widget
  renderDashboardUpcomingBills();

  // Render Recent Transactions Widget
  renderDashboardRecentTx();

  // Render Dashboard Charts
  renderDashboardCharts();

  // Update member count badge
  document.getElementById('nav-member-count').textContent = AppState.members.length;

  // Update voting pending badge
  const pendingVotes = AppState.votingProposals.filter(p => p.status === 'pending').length;
  document.getElementById('nav-voting-pending-badge').textContent = pendingVotes;
}

function renderDashboardUpcomingBills() {
  const container = document.getElementById('dash-upcoming-bills-list');
  if (!container) return;

  if (AppState.essentialNeeds.length === 0) {
    container.innerHTML = `<p class="text-sm text-muted text-center py-4">No bills configured in Essential Shield.</p>`;
    return;
  }

  const spendByCat = FinancialEngine.getSpendingByCategory();

  container.innerHTML = AppState.essentialNeeds.slice(0, 4).map(need => {
    const spentSoFar = spendByCat[need.category] || 0;
    const isPaid = spentSoFar >= need.targetAmount;
    const cat = AppState.categories.find(c => c.id === need.category);

    return `
      <div class="bill-item ${!isPaid ? 'due-soon' : ''}">
        <div class="bill-info">
          <div class="bill-icon">
            <i class="fa-solid ${cat ? cat.icon : 'fa-receipt'}"></i>
          </div>
          <div class="bill-details">
            <h5>${need.name}</h5>
            <span>Target: ${formatPHP(need.targetAmount)} • Due: Day ${need.dueDay || '15'}</span>
          </div>
        </div>
        <div class="bill-amount-col">
          <span class="bill-amount">${formatPHP(Math.max(0, need.targetAmount - spentSoFar))}</span>
          <span class="bill-status ${isPaid ? 'text-success' : 'text-warning'}">
            ${isPaid ? 'Covered / Paid' : 'Reserved in Shield'}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

function renderDashboardRecentTx() {
  const container = document.getElementById('dash-recent-tx-list');
  if (!container) return;

  // Merge incomes & expenses into single list sorted by date descending
  const txList = [
    ...AppState.incomes.map(i => ({ ...i, type: 'income', title: i.source })),
    ...AppState.expenses.map(e => ({ ...e, type: 'expense', title: e.name }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  if (txList.length === 0) {
    container.innerHTML = `<p class="text-sm text-muted text-center py-4">No recent transactions recorded.</p>`;
    return;
  }

  container.innerHTML = txList.map(tx => {
    const member = AppState.members.find(m => m.id === tx.memberId);
    const isIncome = tx.type === 'income';

    return `
      <div class="tx-item">
        <div class="tx-item-left">
          <div class="tx-item-icon ${isIncome ? 'income' : 'expense'}">
            <i class="fa-solid ${isIncome ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
          </div>
          <div class="tx-item-details">
            <h5>${tx.title}</h5>
            <span>${formatDate(tx.date)} • ${member ? member.name : 'Family'}</span>
          </div>
        </div>
        <div class="tx-item-right">
          <span class="tx-amount ${isIncome ? 'income' : 'expense'}">
            ${isIncome ? '+' : '-'} ${formatPHP(tx.amount)}
          </span>
          <span class="tx-member-tag">${tx.category ? getCategoryName(tx.category) : 'Income'}</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderDashboardCharts() {
  const isDark = document.body.classList.contains('dark-theme');
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#334155' : '#f1f5f9';

  // Chart 1: Comparison Bar Chart
  const ctxCompare = document.getElementById('chart-dash-comparison')?.getContext('2d');
  if (ctxCompare) {
    if (ChartInstances.dashComparison) ChartInstances.dashComparison.destroy();

    const income = FinancialEngine.getTotalMonthlyIncome();
    const expenses = FinancialEngine.getTotalMonthlyExpenses();
    const cap = Number(AppState.settings.monthlyOverallBudget) || 55000;

    ChartInstances.dashComparison = new Chart(ctxCompare, {
      type: 'bar',
      data: {
        labels: ['Family Income', 'Actual Spent', 'Budget Limit'],
        datasets: [{
          label: 'Amount (₱)',
          data: [income, expenses, cap],
          backgroundColor: ['#10b981', '#ef4444', '#0284c7'],
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => ` ${formatPHP(item.raw)}`
            }
          }
        },
        scales: {
          x: { ticks: { color: textColor }, grid: { display: false } },
          y: {
            ticks: {
              color: textColor,
              callback: (val) => '₱' + (val / 1000) + 'k'
            },
            grid: { color: gridColor }
          }
        }
      }
    });
  }

  // Chart 2: Category Distribution Doughnut
  const ctxCat = document.getElementById('chart-dash-categories')?.getContext('2d');
  if (ctxCat) {
    if (ChartInstances.dashCategories) ChartInstances.dashCategories.destroy();

    const spendingByCat = FinancialEngine.getSpendingByCategory();
    const categoriesWithSpend = AppState.categories.filter(c => (spendingByCat[c.id] || 0) > 0);

    const labels = categoriesWithSpend.map(c => c.name);
    const data = categoriesWithSpend.map(c => spendingByCat[c.id] || 0);

    const palette = ['#10b981', '#059669', '#0284c7', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b', '#14b8a6', '#ef4444'];

    ChartInstances.dashCategories = new Chart(ctxCat, {
      type: 'doughnut',
      data: {
        labels: labels.length > 0 ? labels : ['No Spending Yet'],
        datasets: [{
          data: data.length > 0 ? data : [1],
          backgroundColor: data.length > 0 ? palette.slice(0, labels.length) : ['#e2e8f0'],
          borderWidth: 2,
          borderColor: isDark ? '#1e293b' : '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, color: textColor, font: { size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: (item) => ` ${item.label}: ${formatPHP(item.raw)}`
            }
          }
        },
        cutout: '68%'
      }
    });
  }
}

// ==========================================================================
// 11. RENDER VIEW 2: INCOME MANAGEMENT
// ==========================================================================

function renderIncomeView() {
  const totalIncome = FinancialEngine.getTotalMonthlyIncome();
  document.getElementById('income-summary-total').textContent = formatPHP(totalIncome);
  document.getElementById('income-summary-count').textContent = AppState.incomes.length;

  // Determine Primary Earner
  const incomeByMember = FinancialEngine.getIncomeByMember();
  let maxEarnerId = null;
  let maxAmount = 0;
  for (const [id, amt] of Object.entries(incomeByMember)) {
    if (amt > maxAmount) {
      maxAmount = amt;
      maxEarnerId = id;
    }
  }
  const primaryEarner = AppState.members.find(m => m.id === maxEarnerId);
  document.getElementById('income-summary-primary').textContent = primaryEarner ? `${primaryEarner.name} (${formatPHP(maxAmount)})` : 'None';

  // Populate Member Filter
  const memberFilter = document.getElementById('income-member-filter');
  const curVal = memberFilter.value;
  memberFilter.innerHTML = `<option value="all">All Family Members</option>` +
    AppState.members.map(m => `<option value="${m.id}" ${m.id === curVal ? 'selected' : ''}>${m.name}</option>`).join('');

  // Filter & Search Table Rows
  const search = document.getElementById('income-search-input')?.value.toLowerCase() || '';
  const selectedMember = memberFilter.value;

  const filteredIncomes = AppState.incomes.filter(inc => {
    const matchesSearch = inc.source.toLowerCase().includes(search) || (inc.notes && inc.notes.toLowerCase().includes(search));
    const matchesMember = selectedMember === 'all' || inc.memberId === selectedMember;
    return matchesSearch && matchesMember;
  });

  const tbody = document.getElementById('income-table-body');
  const emptyState = document.getElementById('income-empty-state');

  if (filteredIncomes.length === 0) {
    tbody.innerHTML = '';
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
    tbody.innerHTML = filteredIncomes.map(inc => {
      const member = AppState.members.find(m => m.id === inc.memberId);
      return `
        <tr>
          <td>
            <strong>${inc.source}</strong>
            ${inc.notes ? `<div class="text-xs text-muted">${inc.notes}</div>` : ''}
          </td>
          <td>
            <span class="member-pill">
              <span class="member-avatar-mini" style="background-color: ${member ? member.avatarColor : '#10b981'}">
                <i class="fa-solid fa-user"></i>
              </span>
              ${member ? member.name : 'Unknown'}
            </span>
          </td>
          <td>${formatDate(inc.date)}</td>
          <td class="font-bold text-success font-mono">${formatPHP(inc.amount)}</td>
          <td>
            <div class="action-buttons">
              <button type="button" class="btn-table-icon" onclick="editIncome('${inc.id}')" title="Edit">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button type="button" class="btn-table-icon delete" onclick="deleteIncome('${inc.id}')" title="Delete">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }
}

// Income Form & Modal Handlers
function initIncomeHandlers() {
  const modal = document.getElementById('modal-income');
  const openBtn = document.getElementById('open-add-income-modal-btn');
  const emptyBtn = document.getElementById('empty-add-income-btn');
  const quickBtn = document.getElementById('quick-add-income-btn');
  const form = document.getElementById('form-income');

  function openAddModal() {
    form.reset();
    document.getElementById('income-edit-id').value = '';
    document.getElementById('modal-income-title').textContent = 'Add Income Record';
    document.getElementById('income-date').value = new Date().toISOString().split('T')[0];

    // Populate Member select
    const select = document.getElementById('income-member');
    select.innerHTML = AppState.members.map(m => `
      <option value="${m.id}" ${m.id === AppState.settings.activeMemberId ? 'selected' : ''}>
        ${m.name} (${m.role})
      </option>
    `).join('');

    clearErrors(['income-source-error', 'income-amount-error', 'income-date-error']);
    modal.classList.remove('hidden');
  }

  openBtn?.addEventListener('click', openAddModal);
  emptyBtn?.addEventListener('click', openAddModal);
  quickBtn?.addEventListener('click', openAddModal);

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    clearErrors(['income-source-error', 'income-amount-error', 'income-date-error']);

    const editId = document.getElementById('income-edit-id').value;
    const source = document.getElementById('income-source').value.trim();
    const amount = Number(document.getElementById('income-amount').value);
    const date = document.getElementById('income-date').value;
    const memberId = document.getElementById('income-member').value;

    let hasError = false;
    if (!source) { setError('income-source-error', 'Source description is required.'); hasError = true; }
    if (!amount || amount <= 0) { setError('income-amount-error', 'Enter a valid amount greater than 0.'); hasError = true; }
    if (!date) { setError('income-date-error', 'Date received is required.'); hasError = true; }

    if (hasError) return;

    if (editId) {
      const idx = AppState.incomes.findIndex(i => i.id === editId);
      if (idx !== -1) {
        AppState.incomes[idx] = { ...AppState.incomes[idx], source, amount, date, memberId };
        showToast('Income record updated.', 'success');
      }
    } else {
      const newIncome = { id: generateId('inc'), source, amount, date, memberId };
      AppState.incomes.unshift(newIncome);
      showToast('New income added.', 'success');
    }

    saveState(STORAGE_KEYS.INCOMES, AppState.incomes);
    modal.classList.add('hidden');
    renderIncomeView();
    renderDashboardView();
  });

  // Filter input listeners
  document.getElementById('income-search-input')?.addEventListener('input', renderIncomeView);
  document.getElementById('income-member-filter')?.addEventListener('change', renderIncomeView);
}

window.editIncome = function(id) {
  const inc = AppState.incomes.find(i => i.id === id);
  if (!inc) return;

  const modal = document.getElementById('modal-income');
  document.getElementById('income-edit-id').value = inc.id;
  document.getElementById('income-source').value = inc.source;
  document.getElementById('income-amount').value = inc.amount;
  document.getElementById('income-date').value = inc.date;
  document.getElementById('modal-income-title').textContent = 'Edit Income Record';

  const select = document.getElementById('income-member');
  select.innerHTML = AppState.members.map(m => `
    <option value="${m.id}" ${m.id === inc.memberId ? 'selected' : ''}>
      ${m.name} (${m.role})
    </option>
  `).join('');

  modal.classList.remove('hidden');
};

window.deleteIncome = function(id) {
  openConfirmModal('Delete Income', 'Are you sure you want to remove this income record?', () => {
    AppState.incomes = AppState.incomes.filter(i => i.id !== id);
    saveState(STORAGE_KEYS.INCOMES, AppState.incomes);
    showToast('Income record deleted.', 'info');
    closeConfirmModal();
    renderIncomeView();
    renderDashboardView();
  });
};

// ==========================================================================
// 12. RENDER VIEW 3: EXPENSE MANAGEMENT
// ==========================================================================

function renderExpenseView() {
  const totalSpent = FinancialEngine.getTotalMonthlyExpenses();
  const essentialSpent = FinancialEngine.getEssentialExpensesSpent();
  const nonEssentialSpent = FinancialEngine.getNonEssentialExpensesSpent();

  document.getElementById('expense-summary-total').textContent = formatPHP(totalSpent);
  document.getElementById('expense-summary-essential').textContent = formatPHP(essentialSpent);
  document.getElementById('expense-summary-nonessential').textContent = formatPHP(nonEssentialSpent);

  // Render Category Quick Chips Carousel
  renderCategorySpendChips();

  // Populate Dropdown Filters
  populateCategorySelect('expense-category-filter', true);
  populateMemberSelect('expense-member-filter', true);

  // Filter list
  const search = document.getElementById('expense-search-input')?.value.toLowerCase() || '';
  const selectedCat = document.getElementById('expense-category-filter')?.value || 'all';
  const selectedMember = document.getElementById('expense-member-filter')?.value || 'all';
  const selectedPriority = document.getElementById('expense-priority-filter')?.value || 'all';

  const filteredExpenses = AppState.expenses.filter(exp => {
    const matchesSearch = exp.name.toLowerCase().includes(search);
    const matchesCat = selectedCat === 'all' || exp.category === selectedCat;
    const matchesMember = selectedMember === 'all' || exp.memberId === selectedMember;
    const matchesPriority = selectedPriority === 'all' || exp.priority === selectedPriority;
    return matchesSearch && matchesCat && matchesMember && matchesPriority;
  });

  const tbody = document.getElementById('expense-table-body');
  const emptyState = document.getElementById('expense-empty-state');

  if (filteredExpenses.length === 0) {
    tbody.innerHTML = '';
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
    tbody.innerHTML = filteredExpenses.map(exp => {
      const member = AppState.members.find(m => m.id === exp.memberId);
      const cat = AppState.categories.find(c => c.id === exp.category);
      const isEssential = exp.priority === 'essential';

      return `
        <tr>
          <td>
            <strong>${exp.name}</strong>
          </td>
          <td>
            <span class="inline-flex items-center gap-1">
              <i class="fa-solid ${cat ? cat.icon : 'fa-receipt'} text-muted mr-1"></i>
              ${cat ? cat.name : 'Other'}
            </span>
          </td>
          <td>
            <span class="status-tag ${isEssential ? 'on-track' : 'warning'}">
              ${isEssential ? 'Essential Need' : 'Non-Essential'}
            </span>
          </td>
          <td>
            <span class="member-pill">
              <span class="member-avatar-mini" style="background-color: ${member ? member.avatarColor : '#10b981'}">
                <i class="fa-solid fa-user"></i>
              </span>
              ${member ? member.name : 'Family'}
            </span>
          </td>
          <td>${formatDate(exp.date)}</td>
          <td class="font-bold text-danger font-mono">${formatPHP(exp.amount)}</td>
          <td>
            <div class="action-buttons">
              <button type="button" class="btn-table-icon" onclick="editExpense('${exp.id}')" title="Edit">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button type="button" class="btn-table-icon delete" onclick="deleteExpense('${exp.id}')" title="Delete">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }
}

function renderCategorySpendChips() {
  const container = document.getElementById('expense-category-chips');
  if (!container) return;

  const spendByCat = FinancialEngine.getSpendingByCategory();

  container.innerHTML = AppState.categories.map(cat => {
    const spent = spendByCat[cat.id] || 0;
    return `
      <div class="category-chip">
        <div class="category-chip-icon">
          <i class="fa-solid ${cat.icon}"></i>
        </div>
        <div>
          <div class="category-chip-name">${cat.name}</div>
          <div class="category-chip-amount">${formatPHP(spent)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function initExpenseHandlers() {
  const modal = document.getElementById('modal-expense');
  const openBtn = document.getElementById('open-add-expense-modal-btn');
  const emptyBtn = document.getElementById('empty-add-expense-btn');
  const quickBtn = document.getElementById('quick-add-expense-btn');
  const form = document.getElementById('form-expense');

  function openAddModal() {
    form.reset();
    document.getElementById('expense-edit-id').value = '';
    document.getElementById('modal-expense-title').textContent = 'Add Expense Record';
    document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];

    populateCategorySelect('expense-category', false);
    populateMemberSelect('expense-member', false);

    clearErrors(['expense-name-error', 'expense-amount-error', 'expense-date-error']);
    modal.classList.remove('hidden');
  }

  openBtn?.addEventListener('click', openAddModal);
  emptyBtn?.addEventListener('click', openAddModal);
  quickBtn?.addEventListener('click', openAddModal);

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    clearErrors(['expense-name-error', 'expense-amount-error', 'expense-date-error']);

    const editId = document.getElementById('expense-edit-id').value;
    const name = document.getElementById('expense-name').value.trim();
    const amount = Number(document.getElementById('expense-amount').value);
    const date = document.getElementById('expense-date').value;
    const category = document.getElementById('expense-category').value;
    const priority = document.getElementById('expense-priority').value;
    const memberId = document.getElementById('expense-member').value;

    let hasError = false;
    if (!name) { setError('expense-name-error', 'Expense title is required.'); hasError = true; }
    if (!amount || amount <= 0) { setError('expense-amount-error', 'Enter a valid amount greater than 0.'); hasError = true; }
    if (!date) { setError('expense-date-error', 'Date paid is required.'); hasError = true; }

    if (hasError) return;

    if (editId) {
      const idx = AppState.expenses.findIndex(e => e.id === editId);
      if (idx !== -1) {
        AppState.expenses[idx] = { ...AppState.expenses[idx], name, amount, date, category, priority, memberId };
        showToast('Expense updated successfully.', 'success');
      }
    } else {
      const newExpense = { id: generateId('exp'), name, amount, date, category, priority, memberId };
      AppState.expenses.unshift(newExpense);
      showToast('Expense added.', 'success');
    }

    saveState(STORAGE_KEYS.EXPENSES, AppState.expenses);
    modal.classList.add('hidden');
    renderExpenseView();
    renderDashboardView();
  });

  // Filter input listeners
  document.getElementById('expense-search-input')?.addEventListener('input', renderExpenseView);
  document.getElementById('expense-category-filter')?.addEventListener('change', renderExpenseView);
  document.getElementById('expense-member-filter')?.addEventListener('change', renderExpenseView);
  document.getElementById('expense-priority-filter')?.addEventListener('change', renderExpenseView);
}

window.editExpense = function(id) {
  const exp = AppState.expenses.find(e => e.id === id);
  if (!exp) return;

  const modal = document.getElementById('modal-expense');
  document.getElementById('expense-edit-id').value = exp.id;
  document.getElementById('expense-name').value = exp.name;
  document.getElementById('expense-amount').value = exp.amount;
  document.getElementById('expense-date').value = exp.date;
  document.getElementById('expense-priority').value = exp.priority;
  document.getElementById('modal-expense-title').textContent = 'Edit Expense Record';

  populateCategorySelect('expense-category', false, exp.category);
  populateMemberSelect('expense-member', false, exp.memberId);

  modal.classList.remove('hidden');
};

window.deleteExpense = function(id) {
  openConfirmModal('Delete Expense', 'Are you sure you want to remove this expense record?', () => {
    AppState.expenses = AppState.expenses.filter(e => e.id !== id);
    saveState(STORAGE_KEYS.EXPENSES, AppState.expenses);
    showToast('Expense deleted.', 'info');
    closeConfirmModal();
    renderExpenseView();
    renderDashboardView();
  });
};

// ==========================================================================
// 13. RENDER VIEW 4: FAMILY BUDGET MANAGEMENT
// ==========================================================================

function renderBudgetView() {
  const overallCap = Number(AppState.settings.monthlyOverallBudget) || 55000;
  const totalSpent = FinancialEngine.getTotalMonthlyExpenses();
  const remaining = FinancialEngine.getRemainingBudget();
  const pct = overallCap > 0 ? Math.round((totalSpent / overallCap) * 100) : 0;

  document.getElementById('budget-view-overall-cap').textContent = formatPHP(overallCap);
  document.getElementById('budget-view-spent').textContent = formatPHP(totalSpent);
  document.getElementById('budget-view-remaining').textContent = formatPHP(remaining);
  document.getElementById('budget-view-percentage').textContent = `${pct}%`;

  const bar = document.getElementById('budget-view-overall-progress');
  bar.style.width = `${Math.min(100, pct)}%`;
  bar.className = `progress-bar-fill ${pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : ''}`;

  // Category Cards Grid
  const container = document.getElementById('category-budget-cards-container');
  if (!container) return;

  const spendByCat = FinancialEngine.getSpendingByCategory();

  container.innerHTML = AppState.categories.map(cat => {
    const spent = spendByCat[cat.id] || 0;
    const limit = Number(cat.limit) || 0;
    const catRemaining = Math.max(0, limit - spent);
    const catPct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    const isOver = spent > limit;
    const isWarning = catPct >= 80 && !isOver;

    return `
      <div class="category-budget-card ${isOver ? 'over-budget' : ''}">
        <div>
          <div class="cat-budget-header">
            <div class="cat-budget-title">
              <div class="cat-icon-circle">
                <i class="fa-solid ${cat.icon}"></i>
              </div>
              <div>
                <strong>${cat.name}</strong>
                <div class="text-xs text-muted">${cat.isEssential ? 'Essential Shield' : 'Discretionary'}</div>
              </div>
            </div>
            <button type="button" class="btn btn-xs btn-outline" onclick="openEditCategoryLimitModal('${cat.id}')">
              <i class="fa-solid fa-pen"></i> Limit
            </button>
          </div>

          <div class="cat-budget-amounts">
            <span class="cat-budget-spent ${isOver ? 'text-danger' : ''}">Spent: ${formatPHP(spent)}</span>
            <span class="cat-budget-limit">Cap: ${formatPHP(limit)}</span>
          </div>

          <div class="progress-bar-track">
            <div class="progress-bar-fill ${isOver ? 'danger' : isWarning ? 'warning' : ''}" style="width: ${Math.min(100, catPct)}%;"></div>
          </div>
        </div>

        <div class="flex justify-between items-center mt-3 text-xs">
          <span class="${isOver ? 'text-danger font-bold' : isWarning ? 'text-warning font-bold' : 'text-muted'}">
            ${isOver ? `Over budget by ${formatPHP(spent - limit)}!` : `${catPct}% used (${formatPHP(catRemaining)} left)`}
          </span>
          <span class="status-tag ${isOver ? 'danger' : isWarning ? 'warning' : 'on-track'}">
            ${isOver ? 'Exceeded' : isWarning ? 'Warning' : 'Good'}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

function initBudgetHandlers() {
  // Modal: Overall Budget
  const modalOverall = document.getElementById('modal-overall-budget');
  const openOverallBtn = document.getElementById('open-overall-budget-modal-btn');
  const formOverall = document.getElementById('form-overall-budget');

  openOverallBtn?.addEventListener('click', () => {
    document.getElementById('modal-budget-input').value = AppState.settings.monthlyOverallBudget;
    modalOverall.classList.remove('hidden');
  });

  formOverall?.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = Number(document.getElementById('modal-budget-input').value);
    if (val && val > 0) {
      AppState.settings.monthlyOverallBudget = val;
      saveState(STORAGE_KEYS.FAMILY_SETTINGS, AppState.settings);
      showToast('Overall monthly budget updated.', 'success');
      modalOverall.classList.add('hidden');
      renderBudgetView();
      renderDashboardView();
    }
  });

  // Modal: Category Budget Limit
  const modalCat = document.getElementById('modal-category-budget');
  const formCat = document.getElementById('form-category-budget');

  formCat?.addEventListener('submit', (e) => {
    e.preventDefault();
    const catId = document.getElementById('category-budget-id').value;
    const limit = Number(document.getElementById('category-budget-limit-input').value);

    const idx = AppState.categories.findIndex(c => c.id === catId);
    if (idx !== -1 && limit >= 0) {
      AppState.categories[idx].limit = limit;
      saveState(STORAGE_KEYS.CATEGORIES, AppState.categories);
      showToast(`${AppState.categories[idx].name} spending limit updated.`, 'success');
      modalCat.classList.add('hidden');
      renderBudgetView();
    }
  });
}

window.openEditCategoryLimitModal = function(catId) {
  const cat = AppState.categories.find(c => c.id === catId);
  if (!cat) return;

  const modal = document.getElementById('modal-category-budget');
  document.getElementById('category-budget-id').value = cat.id;
  document.getElementById('modal-category-budget-subtitle').textContent = `Set limit for ${cat.name}`;
  document.getElementById('category-budget-name-label').textContent = `${cat.name} Monthly Limit (₱)`;
  document.getElementById('category-budget-limit-input').value = cat.limit;
  modal.classList.remove('hidden');
};

// ==========================================================================
// 14. RENDER VIEW 5: FAMILY MEMBERS
// ==========================================================================

function renderMembersView() {
  const container = document.getElementById('family-members-container');
  if (!container) return;

  const spendByMember = FinancialEngine.getSpendingByMember();
  const incomeByMember = FinancialEngine.getIncomeByMember();

  container.innerHTML = AppState.members.map(member => {
    const income = incomeByMember[member.id] || 0;
    const spent = spendByMember[member.id] || 0;
    const isActive = member.id === AppState.settings.activeMemberId;

    return `
      <div class="member-card">
        ${isActive ? `<span class="status-tag on-track absolute top-3 right-3">Current Active</span>` : ''}
        <div class="member-avatar-lg" style="background-color: ${member.avatarColor || '#059669'};">
          <i class="fa-solid fa-user"></i>
        </div>
        <h3 class="member-name-heading">${member.name}</h3>
        <span class="member-role-badge">${member.role}</span>

        <div class="member-financials-row">
          <div class="member-fin-cell">
            <span class="member-fin-label">Income Added</span>
            <span class="member-fin-val text-success">${formatPHP(income)}</span>
          </div>
          <div class="member-fin-cell">
            <span class="member-fin-label">Expenses Logged</span>
            <span class="member-fin-val text-danger">${formatPHP(spent)}</span>
          </div>
        </div>

        <div class="member-card-actions">
          <button type="button" class="btn btn-xs ${isActive ? 'btn-primary' : 'btn-outline'} flex-1" onclick="switchActiveMember('${member.id}')">
            ${isActive ? 'Active Member' : 'Switch to Member'}
          </button>
          <button type="button" class="btn btn-xs btn-outline" onclick="editFamilyMember('${member.id}')" title="Edit">
            <i class="fa-solid fa-pen"></i>
          </button>
          ${AppState.members.length > 1 ? `
            <button type="button" class="btn btn-xs btn-outline-danger" onclick="deleteFamilyMember('${member.id}')" title="Delete">
              <i class="fa-solid fa-trash"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function initMemberHandlers() {
  const modal = document.getElementById('modal-family-member');
  const openBtn = document.getElementById('open-add-member-modal-btn');
  const form = document.getElementById('form-family-member');

  openBtn?.addEventListener('click', () => {
    form.reset();
    document.getElementById('member-edit-id').value = '';
    document.getElementById('modal-member-title').textContent = 'Add Family Member';
    modal.classList.remove('hidden');
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const editId = document.getElementById('member-edit-id').value;
    const name = document.getElementById('member-name').value.trim();
    const role = document.getElementById('member-role').value;
    const avatarColor = document.getElementById('member-color').value;

    if (!name) {
      showToast('Member name is required.', 'danger');
      return;
    }

    if (editId) {
      const idx = AppState.members.findIndex(m => m.id === editId);
      if (idx !== -1) {
        AppState.members[idx] = { ...AppState.members[idx], name, role, avatarColor };
        showToast('Member profile updated.', 'success');
      }
    } else {
      const newMember = { id: generateId('mem'), name, role, avatarColor, isPrimary: false };
      AppState.members.push(newMember);
      showToast(`Added ${name} to family profiles.`, 'success');
    }

    saveState(STORAGE_KEYS.MEMBERS, AppState.members);
    modal.classList.add('hidden');
    updateActiveMemberUI();
    renderMembersView();
    renderDashboardView();
  });
}

window.switchActiveMember = function(memberId) {
  AppState.settings.activeMemberId = memberId;
  saveState(STORAGE_KEYS.FAMILY_SETTINGS, AppState.settings);
  updateActiveMemberUI();
  renderMembersView();
  renderVotingView();
  showToast(`Switched active profile to ${getActiveMember()?.name}`, 'info');
};

window.editFamilyMember = function(memberId) {
  const member = AppState.members.find(m => m.id === memberId);
  if (!member) return;

  const modal = document.getElementById('modal-family-member');
  document.getElementById('member-edit-id').value = member.id;
  document.getElementById('member-name').value = member.name;
  document.getElementById('member-role').value = member.role;
  document.getElementById('member-color').value = member.avatarColor || '#10b981';
  document.getElementById('modal-member-title').textContent = 'Edit Family Member';
  modal.classList.remove('hidden');
};

window.deleteFamilyMember = function(memberId) {
  if (AppState.members.length <= 1) {
    showToast('Cannot delete the only family member profile.', 'warning');
    return;
  }
  openConfirmModal('Delete Member', 'Are you sure you want to remove this family member profile?', () => {
    AppState.members = AppState.members.filter(m => m.id !== memberId);
    if (AppState.settings.activeMemberId === memberId) {
      AppState.settings.activeMemberId = AppState.members[0].id;
    }
    saveState(STORAGE_KEYS.MEMBERS, AppState.members);
    saveState(STORAGE_KEYS.FAMILY_SETTINGS, AppState.settings);
    showToast('Member profile removed.', 'info');
    closeConfirmModal();
    updateActiveMemberUI();
    renderMembersView();
  });
};

// ==========================================================================
// 15. RENDER VIEW 6: BUDGET IMPACT SIMULATOR (Flagship Interaction)
// ==========================================================================

let lastSimulationResult = null;
let simulatedComparisonTiers = [];

function renderSimulatorView() {
  populateCategorySelect('sim-category', false);

  // Initialize baseline readout
  const curRemaining = FinancialEngine.getRemainingBudget();
  const curReserves = FinancialEngine.getRemainingEssentialReservedNeeded();
  const curSafeToSpend = FinancialEngine.getSafeToSpendCash();

  document.getElementById('sim-cur-remaining').textContent = formatPHP(curRemaining);
  document.getElementById('sim-purchase-deduction').textContent = '- ₱0.00';
  document.getElementById('sim-after-remaining').textContent = formatPHP(curRemaining);
  document.getElementById('sim-reserved-bills').textContent = formatPHP(curReserves);
  document.getElementById('sim-savings-target').textContent = formatPHP(FinancialEngine.getTotalSavings());
  document.getElementById('sim-discretionary-after').textContent = formatPHP(curSafeToSpend);

  // Check if form has inputs, run live simulation
  const priceInput = document.getElementById('sim-item-price');
  if (priceInput && Number(priceInput.value) > 0) {
    runSimulator();
  }
}

function initSimulatorHandlers() {
  const form = document.getElementById('simulator-form');
  const priceInput = document.getElementById('sim-item-price');
  const prioritySelect = document.getElementById('sim-priority');
  const resetBtn = document.getElementById('sim-reset-btn');
  const submitToVotingBtn = document.getElementById('sim-submit-to-voting-btn');
  const compareTiersBtn = document.getElementById('sim-add-compare-btn');

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    runSimulator();
  });

  // Real-time live recalculation as user types the price
  priceInput?.addEventListener('input', () => {
    if (Number(priceInput.value) >= 0) {
      runSimulator();
    }
  });

  prioritySelect?.addEventListener('change', () => {
    if (Number(priceInput.value) >= 0) {
      runSimulator();
    }
  });

  resetBtn?.addEventListener('click', () => {
    form.reset();
    lastSimulationResult = null;
    document.getElementById('sim-comparison-container')?.classList.add('hidden');
    renderSimulatorView();
    resetVerdictBanner();
  });

  // Push directly to Family Purchase Voting
  submitToVotingBtn?.addEventListener('click', () => {
    if (!lastSimulationResult) return;

    const itemName = document.getElementById('sim-item-name').value.trim() || 'Simulated Planned Purchase';
    const itemPrice = lastSimulationResult.purchasePrice;
    const itemCat = document.getElementById('sim-category').value;
    const itemPriority = document.getElementById('sim-priority').value;
    const activeMember = getActiveMember();

    const newProposal = {
      id: generateId('prop'),
      title: itemName,
      price: itemPrice,
      category: itemCat,
      priority: itemPriority,
      proposedBy: activeMember.name,
      date: new Date().toISOString().split('T')[0],
      reason: `Evaluated in Budget Impact Simulator. Verdict: ${lastSimulationResult.badge}. Discretionary cash impact: ${formatPHP(lastSimulationResult.afterSafeToSpend)}.`,
      votes: [
        { memberId: activeMember.id, memberName: activeMember.name, vote: 'approve', timestamp: new Date().toISOString() }
      ],
      comments: [
        { memberName: activeMember.name, text: `I tested this in the Simulator: ${lastSimulationResult.title}. Let's vote!` }
      ],
      status: 'pending'
    };

    AppState.votingProposals.unshift(newProposal);
    saveState(STORAGE_KEYS.VOTING_PROPOSALS, AppState.votingProposals);

    showToast(`"${itemName}" submitted to Family Purchase Voting!`, 'success');
    navigateToView('view-voting');
  });

  // Compare 3 Tiers Side-by-Side
  compareTiersBtn?.addEventListener('click', () => {
    const basePrice = Number(priceInput.value) || 15000;
    const tierBudget = Math.round(basePrice * 0.6);
    const tierMid = Math.round(basePrice);
    const tierPremium = Math.round(basePrice * 1.5);

    const compContainer = document.getElementById('sim-comparison-container');
    compContainer.classList.remove('hidden');

    const resBudget = SimulatorEngine.simulatePurchase(tierBudget);
    const resMid = SimulatorEngine.simulatePurchase(tierMid);
    const resPremium = SimulatorEngine.simulatePurchase(tierPremium);

    compContainer.innerHTML = `
      <div class="comparison-option-card" onclick="selectComparisonPrice(${tierBudget})">
        <span class="option-label">Option A (Budget)</span>
        <div class="option-price-val font-mono">${formatPHP(tierBudget)}</div>
        <span class="option-verdict-pill status-tag ${resBudget.verdict === 'safe' ? 'on-track' : resBudget.verdict === 'caution' ? 'warning' : 'danger'}">
          ${resBudget.badge}
        </span>
      </div>

      <div class="comparison-option-card selected" onclick="selectComparisonPrice(${tierMid})">
        <span class="option-label">Option B (Mid-Range)</span>
        <div class="option-price-val font-mono">${formatPHP(tierMid)}</div>
        <span class="option-verdict-pill status-tag ${resMid.verdict === 'safe' ? 'on-track' : resMid.verdict === 'caution' ? 'warning' : 'danger'}">
          ${resMid.badge}
        </span>
      </div>

      <div class="comparison-option-card" onclick="selectComparisonPrice(${tierPremium})">
        <span class="option-label">Option C (Premium)</span>
        <div class="option-price-val font-mono">${formatPHP(tierPremium)}</div>
        <span class="option-verdict-pill status-tag ${resPremium.verdict === 'safe' ? 'on-track' : resPremium.verdict === 'caution' ? 'warning' : 'danger'}">
          ${resPremium.badge}
        </span>
      </div>
    `;

    showToast('Tiers generated: Click any card to apply that price to the live simulator.', 'info');
  });
}

window.selectComparisonPrice = function(price) {
  const priceInput = document.getElementById('sim-item-price');
  if (priceInput) {
    priceInput.value = price;
    runSimulator();
  }
};

function runSimulator() {
  const priceInput = document.getElementById('sim-item-price');
  const price = Number(priceInput.value);
  const priority = document.getElementById('sim-priority')?.value || 'nonessential';

  if (!price || price <= 0) {
    resetVerdictBanner();
    return;
  }

  const result = SimulatorEngine.simulatePurchase(price, priority);
  lastSimulationResult = result;

  // Update Right Panel Readout
  document.getElementById('sim-cur-remaining').textContent = formatPHP(result.curRemainingBudget);
  document.getElementById('sim-purchase-deduction').textContent = `- ${formatPHP(result.purchasePrice)}`;
  
  const afterRemEl = document.getElementById('sim-after-remaining');
  afterRemEl.textContent = formatPHP(result.afterRemainingBudget);
  afterRemEl.className = `impact-value font-mono ${result.afterRemainingBudget >= 0 ? 'text-success' : 'text-danger'}`;

  document.getElementById('sim-reserved-bills').textContent = formatPHP(result.curEssentialReservesNeeded);

  const discEl = document.getElementById('sim-discretionary-after');
  discEl.textContent = formatPHP(result.afterSafeToSpend);
  discEl.className = `impact-value font-mono ${result.afterSafeToSpend >= 0 ? 'text-success' : 'text-danger'}`;

  // Update Verdict Banner
  const banner = document.getElementById('sim-verdict-banner');
  const tag = document.getElementById('sim-verdict-tag');
  const title = document.getElementById('sim-verdict-title');
  const explanation = document.getElementById('sim-verdict-text');
  const icon = document.getElementById('sim-verdict-icon');

  banner.className = `verdict-banner mt-4 ${result.verdict}`;
  tag.textContent = result.badge;
  title.textContent = result.title;
  explanation.textContent = result.explanation;

  if (result.verdict === 'safe') {
    icon.className = 'icon-circle success';
    icon.innerHTML = `<i class="fa-solid fa-circle-check"></i>`;
  } else if (result.verdict === 'caution') {
    icon.className = 'icon-circle primary';
    icon.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i>`;
  } else {
    icon.className = 'icon-circle danger';
    icon.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>`;
  }

  // Update Checklist
  updateChecklist('check-item-budget', result.fitsWithinOverallBudget, 'Fits within monthly budget');
  updateChecklist('check-item-essentials', result.protectsEssentialReserves, 'Protects essential reserves (Electricity, Rent, Groceries)');
  updateChecklist('check-item-savings', result.keepsSavingsIntact, 'Keeps savings targets protected');

  // Enable Push to Voting button
  const submitVotingBtn = document.getElementById('sim-submit-to-voting-btn');
  if (submitVotingBtn) submitVotingBtn.disabled = false;
}

function updateChecklist(itemId, passed, label) {
  const el = document.getElementById(itemId);
  if (!el) return;

  el.className = passed ? 'passed' : 'failed';
  el.innerHTML = `
    <i class="fa-solid ${passed ? 'fa-circle-check' : 'fa-circle-xmark'} check-icon"></i>
    <span>${label}</span>
  `;
}

function resetVerdictBanner() {
  const banner = document.getElementById('sim-verdict-banner');
  const tag = document.getElementById('sim-verdict-tag');
  const title = document.getElementById('sim-verdict-title');
  const explanation = document.getElementById('sim-verdict-text');
  const icon = document.getElementById('sim-verdict-icon');

  banner.className = 'verdict-banner mt-4';
  tag.textContent = 'Ready to Simulate';
  title.textContent = 'Enter a planned purchase to see recommendations.';
  explanation.textContent = 'The simulator checks your remaining budget, guarantees your essential needs reserves, and ensures savings goals aren\'t jeopardized.';
  
  icon.className = 'icon-circle success';
  icon.innerHTML = `<i class="fa-solid fa-chart-pie"></i>`;

  const submitVotingBtn = document.getElementById('sim-submit-to-voting-btn');
  if (submitVotingBtn) submitVotingBtn.disabled = true;

  ['check-item-budget', 'check-item-essentials', 'check-item-savings'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.className = '';
      el.innerHTML = `<i class="fa-solid fa-circle-question check-icon"></i> <span>Ready to evaluate</span>`;
    }
  });
}

// ==========================================================================
// 16. RENDER VIEW 7: ESSENTIAL NEEDS PROTECTION SHIELD
// ==========================================================================

function renderEssentialNeedsView() {
  const totalReserved = FinancialEngine.getTotalEssentialTarget();
  const spendByCat = FinancialEngine.getSpendingByCategory();

  let totalSpentOnEssentials = 0;
  AppState.essentialNeeds.forEach(need => {
    totalSpentOnEssentials += (spendByCat[need.category] || 0);
  });

  const remainingReservedNeeded = FinancialEngine.getRemainingEssentialReservedNeeded();

  document.getElementById('shield-total-reserved').textContent = formatPHP(totalReserved);
  document.getElementById('shield-total-spent').textContent = formatPHP(totalSpentOnEssentials);
  document.getElementById('shield-total-remaining').textContent = formatPHP(remainingReservedNeeded);

  const container = document.getElementById('essential-needs-container');
  if (!container) return;

  container.innerHTML = AppState.essentialNeeds.map(need => {
    const cat = AppState.categories.find(c => c.id === need.category);
    const spentSoFar = spendByCat[need.category] || 0;
    const target = Number(need.targetAmount) || 0;
    const remainingNeed = Math.max(0, target - spentSoFar);
    const pct = target > 0 ? Math.round((spentSoFar / target) * 100) : 0;
    const isCovered = spentSoFar >= target;

    return `
      <div class="essential-card">
        <div>
          <div class="essential-card-header">
            <div class="essential-card-title">
              <h4>${need.name}</h4>
              <span>Category: ${cat ? cat.name : 'Essential'} • Due: Day ${need.dueDay || '15'}</span>
            </div>
            <div class="cat-icon-circle">
              <i class="fa-solid ${cat ? cat.icon : 'fa-shield-halved'}"></i>
            </div>
          </div>

          <div class="essential-stat-row">
            <span>Target Reserved:</span>
            <strong class="font-mono">${formatPHP(target)}</strong>
          </div>
          <div class="essential-stat-row">
            <span>Paid / Spent:</span>
            <span class="text-danger font-mono">${formatPHP(spentSoFar)}</span>
          </div>
          <div class="essential-stat-row border-top pt-1">
            <span>Remaining Reserve:</span>
            <strong class="text-primary font-mono">${formatPHP(remainingNeed)}</strong>
          </div>

          <div class="progress-bar-track mt-3">
            <div class="progress-bar-fill ${isCovered ? '' : 'warning'}" style="width: ${Math.min(100, pct)}%;"></div>
          </div>
        </div>

        <div class="flex justify-between items-center mt-4">
          <span class="status-tag ${isCovered ? 'on-track' : 'warning'}">
            ${isCovered ? 'Bill Covered / Satisfied' : 'Quarantined in Shield'}
          </span>
          <div class="action-buttons">
            <button type="button" class="btn-table-icon" onclick="editEssentialNeed('${need.id}')" title="Edit">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button type="button" class="btn-table-icon delete" onclick="deleteEssentialNeed('${need.id}')" title="Delete">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function initEssentialNeedsHandlers() {
  const modal = document.getElementById('modal-essential-need');
  const openBtn = document.getElementById('open-add-essential-need-modal-btn');
  const form = document.getElementById('form-essential-need');

  openBtn?.addEventListener('click', () => {
    form.reset();
    document.getElementById('essential-need-edit-id').value = '';
    document.getElementById('modal-essential-need-title').textContent = 'Add Essential Need';
    populateCategorySelect('essential-need-category', false);
    modal.classList.remove('hidden');
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const editId = document.getElementById('essential-need-edit-id').value;
    const name = document.getElementById('essential-need-name').value.trim();
    const targetAmount = Number(document.getElementById('essential-need-target').value);
    const category = document.getElementById('essential-need-category').value;
    const dueDay = Number(document.getElementById('essential-need-due').value) || 15;

    if (!name || targetAmount <= 0) {
      showToast('Please provide a valid bill name and target amount.', 'danger');
      return;
    }

    if (editId) {
      const idx = AppState.essentialNeeds.findIndex(n => n.id === editId);
      if (idx !== -1) {
        AppState.essentialNeeds[idx] = { ...AppState.essentialNeeds[idx], name, targetAmount, category, dueDay };
        showToast('Essential need target updated.', 'success');
      }
    } else {
      const newNeed = { id: generateId('need'), name, targetAmount, category, dueDay };
      AppState.essentialNeeds.push(newNeed);
      showToast('New obligation quarantined in Shield.', 'success');
    }

    saveState(STORAGE_KEYS.ESSENTIAL_NEEDS, AppState.essentialNeeds);
    modal.classList.add('hidden');
    renderEssentialNeedsView();
    renderDashboardView();
  });
}

window.editEssentialNeed = function(id) {
  const need = AppState.essentialNeeds.find(n => n.id === id);
  if (!need) return;

  const modal = document.getElementById('modal-essential-need');
  document.getElementById('essential-need-edit-id').value = need.id;
  document.getElementById('essential-need-name').value = need.name;
  document.getElementById('essential-need-target').value = need.targetAmount;
  document.getElementById('essential-need-due').value = need.dueDay || 15;
  document.getElementById('modal-essential-need-title').textContent = 'Edit Essential Need';

  populateCategorySelect('essential-need-category', false, need.category);
  modal.classList.remove('hidden');
};

window.deleteEssentialNeed = function(id) {
  openConfirmModal('Delete Essential Need', 'Remove this reserved need from the protection shield?', () => {
    AppState.essentialNeeds = AppState.essentialNeeds.filter(n => n.id !== id);
    saveState(STORAGE_KEYS.ESSENTIAL_NEEDS, AppState.essentialNeeds);
    showToast('Essential need removed.', 'info');
    closeConfirmModal();
    renderEssentialNeedsView();
    renderDashboardView();
  });
};

// ==========================================================================
// 17. RENDER VIEW 8: FAMILY PURCHASE VOTING
// ==========================================================================

function renderVotingView() {
  const threshold = Number(AppState.settings.votingThreshold) || 1500;
  document.getElementById('voting-threshold-display').textContent = formatPHP(threshold);

  const activeMember = getActiveMember();
  document.getElementById('voting-current-member-name').textContent = activeMember ? `${activeMember.name} (${activeMember.role})` : 'Roberto Santos';

  const container = document.getElementById('voting-proposals-list');
  const emptyState = document.getElementById('voting-empty-state');

  if (AppState.votingProposals.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  container.innerHTML = AppState.votingProposals.map(proposal => {
    const totalVotes = proposal.votes ? proposal.votes.length : 0;
    const approveCount = proposal.votes ? proposal.votes.filter(v => v.vote === 'approve').length : 0;
    const rejectCount = proposal.votes ? proposal.votes.filter(v => v.vote === 'reject').length : 0;
    const cheaperCount = proposal.votes ? proposal.votes.filter(v => v.vote === 'cheaper').length : 0;

    // Check current active member's cast vote
    const myVoteObj = proposal.votes ? proposal.votes.find(v => v.memberId === activeMember.id) : null;
    const myVote = myVoteObj ? myVoteObj.vote : null;

    // Determine status badge
    let statusClass = 'warning';
    let statusLabel = 'Under Family Review';
    if (proposal.status === 'approved') {
      statusClass = 'on-track';
      statusLabel = 'Approved by Family';
    } else if (proposal.status === 'rejected') {
      statusClass = 'danger';
      statusLabel = 'Rejected';
    } else if (proposal.status === 'completed') {
      statusClass = 'on-track';
      statusLabel = 'Purchased & Logged';
    }

    return `
      <div class="proposal-card">
        <div class="proposal-card-header">
          <div class="proposal-title-col">
            <h3>${proposal.title}</h3>
            <div class="proposal-meta-tags">
              <span>Proposed by <strong>${proposal.proposedBy}</strong></span>
              <span>•</span>
              <span>${formatDate(proposal.date)}</span>
              <span>•</span>
              <span class="status-tag ${statusClass}">${statusLabel}</span>
            </div>
          </div>
          <div class="text-right">
            <span class="proposal-price-badge">${formatPHP(proposal.price)}</span>
            <div class="text-xs text-muted">${getCategoryName(proposal.category)}</div>
          </div>
        </div>

        ${proposal.reason ? `
          <div class="proposal-reason-box">
            <strong>Family Justification:</strong> "${proposal.reason}"
          </div>
        ` : ''}

        <!-- Interactive Voting Bar -->
        <div class="voting-actions-bar">
          <div class="vote-buttons-group">
            <button type="button" class="btn-vote ${myVote === 'approve' ? 'active-approve' : ''}" onclick="castVote('${proposal.id}', 'approve')">
              <i class="fa-solid fa-thumbs-up"></i> Approve
            </button>
            <button type="button" class="btn-vote ${myVote === 'reject' ? 'active-reject' : ''}" onclick="castVote('${proposal.id}', 'reject')">
              <i class="fa-solid fa-thumbs-down"></i> Reject
            </button>
            <button type="button" class="btn-vote ${myVote === 'cheaper' ? 'active-cheaper' : ''}" onclick="castVote('${proposal.id}', 'cheaper')">
              <i class="fa-solid fa-tag"></i> Suggest Cheaper
            </button>
          </div>

          <div class="vote-tallies-display">
            <span class="tally-chip approve">👍 ${approveCount} Approve</span>
            <span class="tally-chip reject">👎 ${rejectCount} Reject</span>
            <span class="tally-chip cheaper">💡 ${cheaperCount} Cheaper</span>
          </div>
        </div>

        <!-- Comments Thread -->
        <div class="proposal-comments-section">
          <div class="comments-header">Family Discussion (${proposal.comments ? proposal.comments.length : 0} messages):</div>
          <div class="comments-list">
            ${proposal.comments && proposal.comments.length > 0 ? proposal.comments.map(c => `
              <div class="comment-bubble">
                <span class="comment-author">${c.memberName}:</span>
                <span>${c.text}</span>
              </div>
            `).join('') : '<div class="text-xs text-muted italic">No comments yet. Start the conversation!</div>'}
          </div>

          <div class="comment-input-row">
            <input type="text" id="comment-input-${proposal.id}" class="form-control form-control-sm" placeholder="Add suggestion or feedback as ${activeMember.name}...">
            <button type="button" class="btn btn-sm btn-outline-primary" onclick="submitProposalComment('${proposal.id}')">
              Send
            </button>
            ${proposal.status === 'approved' ? `
              <button type="button" class="btn btn-sm btn-success" onclick="convertProposalToExpense('${proposal.id}')">
                <i class="fa-solid fa-check"></i> Mark Purchased
              </button>
            ` : ''}
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteProposal('${proposal.id}')" title="Delete Proposal">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function initVotingHandlers() {
  const modal = document.getElementById('modal-propose-purchase');
  const openBtn = document.getElementById('open-propose-purchase-modal-btn');
  const emptyBtn = document.getElementById('empty-propose-btn');
  const form = document.getElementById('form-propose-purchase');

  function openModal() {
    form.reset();
    populateCategorySelect('vote-item-category', false);
    modal.classList.remove('hidden');
  }

  openBtn?.addEventListener('click', openModal);
  emptyBtn?.addEventListener('click', openModal);

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('vote-item-name').value.trim();
    const price = Number(document.getElementById('vote-item-price').value);
    const category = document.getElementById('vote-item-category').value;
    const reason = document.getElementById('vote-item-reason').value.trim();
    const activeMember = getActiveMember();

    if (!title || price <= 0) {
      showToast('Please enter an item name and valid price.', 'danger');
      return;
    }

    const newProposal = {
      id: generateId('prop'),
      title,
      price,
      category,
      priority: 'nonessential',
      proposedBy: activeMember.name,
      date: new Date().toISOString().split('T')[0],
      reason,
      votes: [
        { memberId: activeMember.id, memberName: activeMember.name, vote: 'approve', timestamp: new Date().toISOString() }
      ],
      comments: [],
      status: 'pending'
    };

    AppState.votingProposals.unshift(newProposal);
    saveState(STORAGE_KEYS.VOTING_PROPOSALS, AppState.votingProposals);

    showToast(`Purchase proposal for "${title}" posted for family voting.`, 'success');
    modal.classList.add('hidden');
    renderVotingView();
  });
}

window.castVote = function(proposalId, voteType) {
  const proposal = AppState.votingProposals.find(p => p.id === proposalId);
  if (!proposal) return;

  const activeMember = getActiveMember();
  if (!proposal.votes) proposal.votes = [];

  // Prevent duplicate vote by the same member: update if already voted
  const existingVoteIndex = proposal.votes.findIndex(v => v.memberId === activeMember.id);
  if (existingVoteIndex !== -1) {
    proposal.votes[existingVoteIndex].vote = voteType;
    proposal.votes[existingVoteIndex].timestamp = new Date().toISOString();
  } else {
    proposal.votes.push({
      memberId: activeMember.id,
      memberName: activeMember.name,
      vote: voteType,
      timestamp: new Date().toISOString()
    });
  }

  // Automatic majority resolution evaluation
  const totalFamily = AppState.members.length;
  const approves = proposal.votes.filter(v => v.vote === 'approve').length;
  const rejects = proposal.votes.filter(v => v.vote === 'reject').length;

  if (approves > totalFamily / 2) {
    proposal.status = 'approved';
  } else if (rejects > totalFamily / 2) {
    proposal.status = 'rejected';
  } else {
    proposal.status = 'pending';
  }

  saveState(STORAGE_KEYS.VOTING_PROPOSALS, AppState.votingProposals);
  showToast(`Vote recorded as ${activeMember.name}: ${voteType.toUpperCase()}`, 'info');
  renderVotingView();
};

window.submitProposalComment = function(proposalId) {
  const input = document.getElementById(`comment-input-${proposalId}`);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const proposal = AppState.votingProposals.find(p => p.id === proposalId);
  if (!proposal) return;

  if (!proposal.comments) proposal.comments = [];
  const activeMember = getActiveMember();

  proposal.comments.push({
    memberName: activeMember.name,
    text,
    timestamp: new Date().toISOString()
  });

  saveState(STORAGE_KEYS.VOTING_PROPOSALS, AppState.votingProposals);
  input.value = '';
  renderVotingView();
};

window.convertProposalToExpense = function(proposalId) {
  const proposal = AppState.votingProposals.find(p => p.id === proposalId);
  if (!proposal) return;

  openConfirmModal('Log as Expense', `Mark "${proposal.title}" as officially purchased and deduct ${formatPHP(proposal.price)} from family expenses?`, () => {
    const activeMember = getActiveMember();
    const newExpense = {
      id: generateId('exp'),
      name: proposal.title,
      amount: proposal.price,
      category: proposal.category,
      priority: proposal.priority || 'nonessential',
      date: new Date().toISOString().split('T')[0],
      memberId: activeMember.id
    };

    AppState.expenses.unshift(newExpense);
    proposal.status = 'completed';

    saveState(STORAGE_KEYS.EXPENSES, AppState.expenses);
    saveState(STORAGE_KEYS.VOTING_PROPOSALS, AppState.votingProposals);

    showToast(`Logged "${proposal.title}" to household expenses!`, 'success');
    closeConfirmModal();
    renderVotingView();
    renderExpenseView();
    renderDashboardView();
  });
};

window.deleteProposal = function(proposalId) {
  openConfirmModal('Delete Proposal', 'Remove this purchase proposal from voting history?', () => {
    AppState.votingProposals = AppState.votingProposals.filter(p => p.id !== proposalId);
    saveState(STORAGE_KEYS.VOTING_PROPOSALS, AppState.votingProposals);
    showToast('Proposal deleted.', 'info');
    closeConfirmModal();
    renderVotingView();
  });
};

// ==========================================================================
// 18. RENDER VIEW 9: SAVINGS GOALS
// ==========================================================================

function renderSavingsView() {
  const totalSaved = FinancialEngine.getTotalSavings();
  const totalTarget = AppState.savingsGoals.reduce((sum, g) => sum + (Number(g.targetAmount) || 0), 0);
  const overallProgress = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  document.getElementById('savings-summary-total').textContent = formatPHP(totalSaved);
  document.getElementById('savings-summary-target').textContent = formatPHP(totalTarget);
  document.getElementById('savings-summary-progress').textContent = `${overallProgress}%`;

  const container = document.getElementById('savings-goals-container');
  const emptyState = document.getElementById('savings-empty-state');

  if (AppState.savingsGoals.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  container.innerHTML = AppState.savingsGoals.map(goal => {
    const current = Number(goal.currentSaved) || 0;
    const target = Number(goal.targetAmount) || 0;
    const remaining = Math.max(0, target - current);
    const pct = target > 0 ? Math.round((current / target) * 100) : 0;
    const isCompleted = current >= target;

    return `
      <div class="goal-card">
        <div>
          <div class="goal-card-header">
            <div class="goal-icon-box">
              <i class="fa-solid fa-piggy-bank"></i>
            </div>
            <div class="goal-title-wrap flex-1 ml-3">
              <h4>${goal.name}</h4>
              <span class="goal-target-date">Target: ${formatDate(goal.targetDate)}</span>
            </div>
            <span class="status-tag ${isCompleted ? 'on-track' : 'warning'}">
              ${isCompleted ? 'Goal Reached! 🎉' : `${pct}%`}
            </span>
          </div>

          <div class="goal-numbers-row">
            <span class="goal-saved-current">${formatPHP(current)}</span>
            <span class="goal-target-total">of ${formatPHP(target)}</span>
          </div>

          <div class="progress-bar-track">
            <div class="progress-bar-fill ${isCompleted ? '' : 'warning'}" style="width: ${Math.min(100, pct)}%;"></div>
          </div>

          <div class="text-xs text-muted mt-2">
            ${isCompleted ? 'Congratulations! You achieved this family target.' : `Remaining: ${formatPHP(remaining)} needed`}
          </div>
        </div>

        <div class="goal-actions-row">
          <button type="button" class="btn btn-sm btn-primary flex-1" onclick="openContributeGoalModal('${goal.id}')">
            <i class="fa-solid fa-plus"></i> Contribute
          </button>
          <button type="button" class="btn btn-sm btn-outline" onclick="editSavingsGoal('${goal.id}')" title="Edit">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteSavingsGoal('${goal.id}')" title="Delete">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function initSavingsHandlers() {
  // Modal: Create Goal
  const modal = document.getElementById('modal-savings-goal');
  const openBtn = document.getElementById('open-add-goal-modal-btn');
  const emptyBtn = document.getElementById('empty-add-goal-btn');
  const form = document.getElementById('form-savings-goal');

  function openModal() {
    form.reset();
    document.getElementById('goal-edit-id').value = '';
    document.getElementById('modal-goal-title').textContent = 'Create Savings Goal';
    modal.classList.remove('hidden');
  }

  openBtn?.addEventListener('click', openModal);
  emptyBtn?.addEventListener('click', openModal);

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const editId = document.getElementById('goal-edit-id').value;
    const name = document.getElementById('goal-name').value.trim();
    const targetAmount = Number(document.getElementById('goal-target').value);
    const currentSaved = Number(document.getElementById('goal-current').value) || 0;
    const targetDate = document.getElementById('goal-date').value;

    if (!name || targetAmount <= 0 || !targetDate) {
      showToast('Please fill out all required goal fields.', 'danger');
      return;
    }

    if (editId) {
      const idx = AppState.savingsGoals.findIndex(g => g.id === editId);
      if (idx !== -1) {
        AppState.savingsGoals[idx] = { ...AppState.savingsGoals[idx], name, targetAmount, currentSaved, targetDate };
        showToast('Savings goal updated.', 'success');
      }
    } else {
      const newGoal = { id: generateId('goal'), name, targetAmount, currentSaved, targetDate };
      AppState.savingsGoals.push(newGoal);
      showToast(`Goal "${name}" created!`, 'success');
    }

    saveState(STORAGE_KEYS.SAVINGS_GOALS, AppState.savingsGoals);
    modal.classList.add('hidden');
    renderSavingsView();
    renderDashboardView();
  });

  // Modal: Contribute to Goal
  const modalContrib = document.getElementById('modal-contribute-goal');
  const formContrib = document.getElementById('form-contribute-goal');

  formContrib?.addEventListener('submit', (e) => {
    e.preventDefault();
    const goalId = document.getElementById('contribute-goal-id').value;
    const amount = Number(document.getElementById('contribute-amount').value);
    const memberId = document.getElementById('contribute-member').value;

    if (!amount || amount <= 0) {
      showToast('Enter a valid contribution amount.', 'danger');
      return;
    }

    const goal = AppState.savingsGoals.find(g => g.id === goalId);
    if (goal) {
      goal.currentSaved = (Number(goal.currentSaved) || 0) + amount;
      saveState(STORAGE_KEYS.SAVINGS_GOALS, AppState.savingsGoals);

      const member = AppState.members.find(m => m.id === memberId);
      showToast(`Added ${formatPHP(amount)} contribution from ${member ? member.name : 'family'} to "${goal.name}"!`, 'success');
      modalContrib.classList.add('hidden');
      renderSavingsView();
      renderDashboardView();
    }
  });
}

window.openContributeGoalModal = function(goalId) {
  const goal = AppState.savingsGoals.find(g => g.id === goalId);
  if (!goal) return;

  const modal = document.getElementById('modal-contribute-goal');
  document.getElementById('contribute-goal-id').value = goal.id;
  document.getElementById('modal-contribute-goal-name').textContent = `Target: ${goal.name}`;
  document.getElementById('contribute-amount').value = '';

  populateMemberSelect('contribute-member', false);
  modal.classList.remove('hidden');
};

window.editSavingsGoal = function(goalId) {
  const goal = AppState.savingsGoals.find(g => g.id === goalId);
  if (!goal) return;

  const modal = document.getElementById('modal-savings-goal');
  document.getElementById('goal-edit-id').value = goal.id;
  document.getElementById('goal-name').value = goal.name;
  document.getElementById('goal-target').value = goal.targetAmount;
  document.getElementById('goal-current').value = goal.currentSaved;
  document.getElementById('goal-date').value = goal.targetDate;
  document.getElementById('modal-goal-title').textContent = 'Edit Savings Goal';
  modal.classList.remove('hidden');
};

window.deleteSavingsGoal = function(goalId) {
  openConfirmModal('Delete Goal', 'Are you sure you want to remove this savings goal?', () => {
    AppState.savingsGoals = AppState.savingsGoals.filter(g => g.id !== goalId);
    saveState(STORAGE_KEYS.SAVINGS_GOALS, AppState.savingsGoals);
    showToast('Savings goal removed.', 'info');
    closeConfirmModal();
    renderSavingsView();
    renderDashboardView();
  });
};

// ==========================================================================
// 19. RENDER VIEW 10: REPORTS AND ANALYTICS
// ==========================================================================

function renderReportsView() {
  const totalIncome = FinancialEngine.getTotalMonthlyIncome();
  const totalExpenses = FinancialEngine.getTotalMonthlyExpenses();
  const essentialSpent = FinancialEngine.getEssentialExpensesSpent();
  const nonEssentialSpent = FinancialEngine.getNonEssentialExpensesSpent();
  const overallCap = Number(AppState.settings.monthlyOverallBudget) || 55000;

  // Metric 1: Net Savings Rate
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netSavings / totalIncome) * 100)) : 0;
  document.getElementById('report-savings-rate').textContent = `${savingsRate}%`;

  // Metric 2: Essential Needs Ratio
  const essentialRatio = totalExpenses > 0 ? Math.round((essentialSpent / totalExpenses) * 100) : 0;
  document.getElementById('report-essential-ratio').textContent = `${essentialRatio}%`;

  // Metric 3: Budget Adherence
  const adherence = overallCap > 0 ? Math.round((totalExpenses / overallCap) * 100) : 0;
  document.getElementById('report-budget-adherence').textContent = `${adherence}%`;

  // Metric 4: Discretionary Spending
  document.getElementById('report-discretionary-amount').textContent = formatPHP(nonEssentialSpent);

  renderReportsCharts();
}

function renderReportsCharts() {
  const isDark = document.body.classList.contains('dark-theme');
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#334155' : '#f1f5f9';

  // Chart 1: Cash Flow
  const ctxFlow = document.getElementById('chart-reports-flow')?.getContext('2d');
  if (ctxFlow) {
    if (ChartInstances.reportsFlow) ChartInstances.reportsFlow.destroy();
    ChartInstances.reportsFlow = new Chart(ctxFlow, {
      type: 'bar',
      data: {
        labels: ['Total Income', 'Total Expenses', 'Net Balance'],
        datasets: [{
          data: [
            FinancialEngine.getTotalMonthlyIncome(),
            FinancialEngine.getTotalMonthlyExpenses(),
            FinancialEngine.getTotalMonthlyIncome() - FinancialEngine.getTotalMonthlyExpenses()
          ],
          backgroundColor: ['#10b981', '#ef4444', '#0284c7'],
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: item => ` ${formatPHP(item.raw)}` } }
        },
        scales: {
          x: { ticks: { color: textColor }, grid: { display: false } },
          y: {
            ticks: { color: textColor, callback: val => '₱' + (val / 1000) + 'k' },
            grid: { color: gridColor }
          }
        }
      }
    });
  }

  // Chart 2: Category Breakdown
  const ctxCat = document.getElementById('chart-reports-category')?.getContext('2d');
  if (ctxCat) {
    if (ChartInstances.reportsCategory) ChartInstances.reportsCategory.destroy();
    const spendByCat = FinancialEngine.getSpendingByCategory();
    const activeCats = AppState.categories.filter(c => (spendByCat[c.id] || 0) > 0);

    ChartInstances.reportsCategory = new Chart(ctxCat, {
      type: 'doughnut',
      data: {
        labels: activeCats.map(c => c.name),
        datasets: [{
          data: activeCats.map(c => spendByCat[c.id]),
          backgroundColor: ['#10b981', '#059669', '#0284c7', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b', '#14b8a6', '#ef4444'],
          borderColor: isDark ? '#1e293b' : '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, color: textColor, font: { size: 10 } } },
          tooltip: { callbacks: { label: item => ` ${item.label}: ${formatPHP(item.raw)}` } }
        }
      }
    });
  }

  // Chart 3: Essential vs Non-Essential
  const ctxPriority = document.getElementById('chart-reports-priority')?.getContext('2d');
  if (ctxPriority) {
    if (ChartInstances.reportsPriority) ChartInstances.reportsPriority.destroy();
    ChartInstances.reportsPriority = new Chart(ctxPriority, {
      type: 'pie',
      data: {
        labels: ['Essential Needs', 'Discretionary Wants'],
        datasets: [{
          data: [FinancialEngine.getEssentialExpensesSpent(), FinancialEngine.getNonEssentialExpensesSpent()],
          backgroundColor: ['#0284c7', '#f59e0b'],
          borderColor: isDark ? '#1e293b' : '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor } },
          tooltip: { callbacks: { label: item => ` ${item.label}: ${formatPHP(item.raw)}` } }
        }
      }
    });
  }

  // Chart 4: Spending Trends
  const ctxTrend = document.getElementById('chart-reports-trend')?.getContext('2d');
  if (ctxTrend) {
    if (ChartInstances.reportsTrend) ChartInstances.reportsTrend.destroy();
    ChartInstances.reportsTrend = new Chart(ctxTrend, {
      type: 'line',
      data: {
        labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct (Current)'],
        datasets: [
          {
            label: 'Monthly Income',
            data: [58000, 60000, 62000, 61000, 65000, FinancialEngine.getTotalMonthlyIncome()],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.35,
            fill: true
          },
          {
            label: 'Monthly Spending',
            data: [26500, 31000, 29000, 27500, 32000, FinancialEngine.getTotalMonthlyExpenses()],
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            tension: 0.35,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor } },
          tooltip: { callbacks: { label: item => ` ${item.dataset.label}: ${formatPHP(item.raw)}` } }
        },
        scales: {
          x: { ticks: { color: textColor }, grid: { display: false } },
          y: {
            ticks: { color: textColor, callback: val => '₱' + (val / 1000) + 'k' },
            grid: { color: gridColor }
          }
        }
      }
    });
  }
}

function initReportsHandlers() {
  document.getElementById('reports-month-filter')?.addEventListener('change', () => {
    showToast('Report data updated for selected month.', 'info', 1500);
    renderReportsView();
  });
  document.getElementById('reports-year-filter')?.addEventListener('change', () => {
    showToast('Report data updated for selected year.', 'info', 1500);
    renderReportsView();
  });
}

// ==========================================================================
// 20. RENDER VIEW 11: SETTINGS & PREFERENCES
// ==========================================================================

function renderSettingsView() {
  document.getElementById('settings-family-name').value = AppState.settings.familyName || 'The Santos Family';
  document.getElementById('settings-overall-budget').value = AppState.settings.monthlyOverallBudget || 55000;
  document.getElementById('settings-voting-threshold').value = AppState.settings.votingThreshold || 1500;

  const session = AppState.currentUser;
  if (session) {
    document.getElementById('settings-account-name').textContent = session.name;
    document.getElementById('settings-account-email').textContent = session.email;
  }
}

function initSettingsHandlers() {
  const form = document.getElementById('settings-family-form');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const familyName = document.getElementById('settings-family-name').value.trim();
    const budget = Number(document.getElementById('settings-overall-budget').value);
    const threshold = Number(document.getElementById('settings-voting-threshold').value);

    if (familyName) AppState.settings.familyName = familyName;
    if (budget > 0) AppState.settings.monthlyOverallBudget = budget;
    if (threshold > 0) AppState.settings.votingThreshold = threshold;

    saveState(STORAGE_KEYS.FAMILY_SETTINGS, AppState.settings);
    showToast('Household settings saved successfully.', 'success');
    renderAppSession();
  });

  // Theme Toggles
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });

  // Reload Demo Data Button
  document.getElementById('btn-reload-demo-data')?.addEventListener('click', () => {
    openConfirmModal('Reset Demo Data', 'Reset all transactions, budgets, and savings back to default Filipino family sample data?', async () => {
      await loadDemoData(true);
      loadStateFromStorage();
      closeConfirmModal();
      showToast('Sample Filipino family data reloaded!', 'success');
      renderAllViews();
    });
  });

  // Clear All Storage Button
  document.getElementById('btn-clear-all-data')?.addEventListener('click', () => {
    openConfirmModal('Clear All Storage', 'Are you sure? This will wipe all local data and log you out.', () => {
      localStorage.clear();
      AppState = {
        currentUser: null,
        settings: { familyName: 'The Santos Family', monthlyOverallBudget: 55000, votingThreshold: 1500, currencySymbol: '₱', activeMemberId: null },
        members: [], categories: DEFAULT_CATEGORIES, incomes: [], expenses: [], essentialNeeds: [], savingsGoals: [], votingProposals: []
      };
      closeConfirmModal();
      showToast('All storage cleared.', 'info');
      renderAppSession();
    });
  });
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-theme');
  localStorage.setItem(STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
  
  // Re-render charts to adjust text and grid contrast
  renderDashboardCharts();
  renderReportsCharts();
}

function loadTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
}

// ==========================================================================
// 21. HELPER UI UTILITIES
// ==========================================================================

function populateCategorySelect(elementId, includeAllOption = false, selectedId = null) {
  const select = document.getElementById(elementId);
  if (!select) return;

  let options = includeAllOption ? `<option value="all">All Categories</option>` : '';
  options += AppState.categories.map(c => `
    <option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>
      ${c.name} (${c.isEssential ? 'Essential' : 'Non-Essential'})
    </option>
  `).join('');

  select.innerHTML = options;
}

function populateMemberSelect(elementId, includeAllOption = false, selectedId = null) {
  const select = document.getElementById(elementId);
  if (!select) return;

  const activeId = selectedId || AppState.settings.activeMemberId;
  let options = includeAllOption ? `<option value="all">All Family Members</option>` : '';
  options += AppState.members.map(m => `
    <option value="${m.id}" ${m.id === activeId ? 'selected' : ''}>
      ${m.name} (${m.role})
    </option>
  `).join('');

  select.innerHTML = options;
}

function getCategoryName(categoryId) {
  const cat = AppState.categories.find(c => c.id === categoryId);
  return cat ? cat.name : 'Uncategorized';
}

function initModalClosers() {
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close-modal');
      document.getElementById(modalId)?.classList.add('hidden');
    });
  });

  // Close when clicking modal backdrop
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.add('hidden');
      }
    });
  });

  // Close when pressing Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(modal => {
        modal.classList.add('hidden');
      });
      closeConfirmModal();
    }
  });

  document.getElementById('confirm-cancel-btn')?.addEventListener('click', closeConfirmModal);
  document.getElementById('confirm-ok-btn')?.addEventListener('click', () => {
    if (typeof confirmCallback === 'function') confirmCallback();
  });
}

function renderAllViews() {
  renderDashboardView();
  renderIncomeView();
  renderExpenseView();
  renderBudgetView();
  renderMembersView();
  renderSimulatorView();
  renderEssentialNeedsView();
  renderVotingView();
  renderSavingsView();
  renderReportsView();
  renderSettingsView();
}

// ==========================================================================
// 22. APPLICATION ENTRYPOINT
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Load Theme
  loadTheme();

  // Load Seed Demo Data on first boot
  await loadDemoData(false);

  // Initialize State from LocalStorage
  loadStateFromStorage();

  // Initialize Global Handlers & Subsystems
  initAuth();
  initNavigation();
  initModalClosers();
  initIncomeHandlers();
  initExpenseHandlers();
  initBudgetHandlers();
  initMemberHandlers();
  initSimulatorHandlers();
  initEssentialNeedsHandlers();
  initVotingHandlers();
  initSavingsHandlers();
  initReportsHandlers();
  initSettingsHandlers();

  // Check Active Session
  renderAppSession();
});
