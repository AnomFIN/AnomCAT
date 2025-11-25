/**
 * AnomCAT v1.01 - Enterprise Crypto Dashboard
 * Main Application JavaScript
 * 
 * Core functionality for the AnomCAT crypto trading bot dashboard.
 * Handles global state management, currency toggle, portfolio updates,
 * and shared functionality across all pages.
 * 
 * @module AnomCAT
 * @version 1.01
 */

// ============================================
// Constants
// ============================================
const DAYS_PER_MONTH = 30.436875; // Average days per month (365.2425/12)
const SATOSHI_THRESHOLD = 0.00000001; // 1 satoshi minimum for updates
const DEFAULT_BTC_EUR_RATE = 45000; // Default BTC/EUR exchange rate
const CHART_DATA_URL = 'assets/data/chart-data.json';
const USERS_DATA_URL = 'assets/data/users.json';

// ============================================
// Global State Management
// ============================================
const AnomCAT = {
    // Currency state
    currency: 'BTC',
    btcToEurRate: DEFAULT_BTC_EUR_RATE,
    
    // Portfolio data
    portfolio: {
        btcBalance: 0,
        eurBalance: 0,
        initialBtc: 0,
        history: [],
        trades: []
    },
    
    // Bot settings
    bot: {
        active: false,
        monthlyReturn: 0.013, // 1.3% monthly return
        lastUpdate: Date.now()
    },
    
    // Update intervals
    intervals: {
        portfolio: null,
        chart: null
    },
    
    // Default chart data (loaded from JSON)
    defaultChartData: null,
    
    // Users data (loaded from JSON)
    usersData: null
};

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    AnomCAT.init();
});

AnomCAT.init = function() {
    this.loadFromStorage();
    this.loadDefaultData();
    this.initCurrencyToggle();
    this.initNavigation();
    this.updateAllDisplays();
    this.registerServiceWorker();
    
    // Start portfolio updates if on authenticated pages
    if (this.isAuthenticatedPage()) {
        this.startPortfolioUpdates();
    }
};

// ============================================
// Data Loading from JSON
// ============================================
AnomCAT.loadDefaultData = async function() {
    try {
        // Load chart data
        const chartResponse = await fetch(CHART_DATA_URL);
        if (chartResponse.ok) {
            this.defaultChartData = await chartResponse.json();
        }
    } catch (e) {
        console.log('Chart data will use generated values:', e.message);
    }
    
    try {
        // Load users data
        const usersResponse = await fetch(USERS_DATA_URL);
        if (usersResponse.ok) {
            this.usersData = await usersResponse.json();
        }
    } catch (e) {
        console.log('Users data not available:', e.message);
    }
};

AnomCAT.validateUser = function(email) {
    if (!this.usersData || !this.usersData.users) {
        // In demo mode, any email works
        return { valid: true, user: { email: email, name: 'Demo User' } };
    }
    
    const user = this.usersData.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user) {
        return { valid: true, user: user };
    }
    
    // In demo mode, still allow any email
    return { valid: true, user: { email: email, name: 'Guest User' } };
};

AnomCAT.getDefaultChartData = function() {
    if (this.defaultChartData && this.defaultChartData.portfolioHistory) {
        return this.defaultChartData.portfolioHistory.map(point => ({
            time: new Date(point.date).getTime(),
            value: this.currency === 'EUR' ? point.eurValue : point.btcValue
        }));
    }
    return null;
};

AnomCAT.getMonthlyPerformance = function() {
    if (this.defaultChartData && this.defaultChartData.monthlyPerformance) {
        return this.defaultChartData.monthlyPerformance;
    }
    return null;
};

AnomCAT.getTradingActivity = function() {
    if (this.defaultChartData && this.defaultChartData.tradingActivity) {
        return this.defaultChartData.tradingActivity;
    }
    return null;
};

AnomCAT.getDefaultSummary = function() {
    if (this.defaultChartData && this.defaultChartData.summary) {
        return this.defaultChartData.summary;
    }
    return null;
};

// ============================================
// Currency Toggle
// ============================================
AnomCAT.initCurrencyToggle = function() {
    const toggle = document.querySelector('.currency-toggle');
    if (!toggle) return;
    
    const btcBtn = toggle.querySelector('[data-currency="BTC"]');
    const eurBtn = toggle.querySelector('[data-currency="EUR"]');
    
    if (btcBtn && eurBtn) {
        btcBtn.addEventListener('click', () => this.setCurrency('BTC'));
        eurBtn.addEventListener('click', () => this.setCurrency('EUR'));
        this.updateCurrencyButtons();
    }
};

AnomCAT.setCurrency = function(currency) {
    if (currency === this.currency) return;
    
    this.currency = currency;
    this.saveToStorage();
    this.updateCurrencyButtons();
    this.updateAllDisplays();
    
    // Dispatch custom event for page-specific updates
    window.dispatchEvent(new CustomEvent('currencyChanged', { detail: { currency } }));
};

AnomCAT.updateCurrencyButtons = function() {
    const btcBtn = document.querySelector('[data-currency="BTC"]');
    const eurBtn = document.querySelector('[data-currency="EUR"]');
    
    if (btcBtn && eurBtn) {
        btcBtn.classList.toggle('active', this.currency === 'BTC');
        eurBtn.classList.toggle('active', this.currency === 'EUR');
    }
};

// ============================================
// Value Formatting
// ============================================
AnomCAT.formatBTC = function(value) {
    if (typeof value !== 'number' || isNaN(value)) value = 0;
    return value.toFixed(8) + ' BTC';
};

AnomCAT.formatEUR = function(value) {
    if (typeof value !== 'number' || isNaN(value)) value = 0;
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
};

AnomCAT.formatCurrency = function(btcValue) {
    if (this.currency === 'EUR') {
        return this.formatEUR(btcValue * this.btcToEurRate);
    }
    return this.formatBTC(btcValue);
};

AnomCAT.formatSecondaryCurrency = function(btcValue) {
    if (this.currency === 'BTC') {
        return this.formatEUR(btcValue * this.btcToEurRate);
    }
    return this.formatBTC(btcValue);
};

AnomCAT.btcToEur = function(btcValue) {
    return btcValue * this.btcToEurRate;
};

AnomCAT.eurToBtc = function(eurValue) {
    return eurValue / this.btcToEurRate;
};

// ============================================
// Display Updates
// ============================================
AnomCAT.updateAllDisplays = function() {
    // Update balance displays
    this.updateBalanceDisplays();
    
    // Update transaction displays
    this.updateTransactionDisplays();
    
    // Update stat displays
    this.updateStatDisplays();
    
    // Update chart if exists
    if (typeof this.updateChart === 'function') {
        this.updateChart();
    }
};

AnomCAT.updateBalanceDisplays = function() {
    // Main balance
    const mainBalance = document.querySelector('[data-balance="main"]');
    if (mainBalance) {
        mainBalance.textContent = this.formatCurrency(this.portfolio.btcBalance);
    }
    
    // Secondary balance
    const secondaryBalance = document.querySelector('[data-balance="secondary"]');
    if (secondaryBalance) {
        secondaryBalance.textContent = this.formatSecondaryCurrency(this.portfolio.btcBalance);
    }
    
    // Wallet total
    const walletTotal = document.querySelector('[data-wallet="total"]');
    if (walletTotal) {
        walletTotal.textContent = this.formatCurrency(this.portfolio.btcBalance);
    }
    
    // Wallet secondary
    const walletSecondary = document.querySelector('[data-wallet="secondary"]');
    if (walletSecondary) {
        walletSecondary.textContent = this.formatSecondaryCurrency(this.portfolio.btcBalance);
    }
    
    // Update all elements with data-btc-value attribute
    document.querySelectorAll('[data-btc-value]').forEach(el => {
        const btcValue = parseFloat(el.dataset.btcValue);
        el.textContent = this.formatCurrency(btcValue);
    });
    
    // Update all secondary displays
    document.querySelectorAll('[data-btc-secondary]').forEach(el => {
        const btcValue = parseFloat(el.dataset.btcSecondary);
        el.textContent = this.formatSecondaryCurrency(btcValue);
    });
};

AnomCAT.updateTransactionDisplays = function() {
    document.querySelectorAll('[data-transaction-amount]').forEach(el => {
        const btcValue = parseFloat(el.dataset.transactionAmount);
        el.textContent = this.formatCurrency(btcValue);
    });
};

AnomCAT.updateStatDisplays = function() {
    // Initial value
    const initialEl = document.querySelector('[data-stat="initial"]');
    if (initialEl) {
        initialEl.textContent = this.formatCurrency(this.portfolio.initialBtc);
    }
    
    // Profit
    const profit = this.portfolio.btcBalance - this.portfolio.initialBtc;
    const profitEl = document.querySelector('[data-stat="profit"]');
    if (profitEl) {
        const sign = profit >= 0 ? '+' : '';
        profitEl.textContent = sign + this.formatCurrency(profit);
        profitEl.className = profit >= 0 ? 'stat-value text-success' : 'stat-value text-danger';
    }
    
    // ROI
    const roi = this.portfolio.initialBtc > 0 
        ? ((this.portfolio.btcBalance - this.portfolio.initialBtc) / this.portfolio.initialBtc * 100) 
        : 0;
    const roiEl = document.querySelector('[data-stat="roi"]');
    if (roiEl) {
        const sign = roi >= 0 ? '+' : '';
        roiEl.textContent = sign + roi.toFixed(2) + '%';
        roiEl.className = roi >= 0 ? 'stat-value text-success' : 'stat-value text-danger';
    }
    
    // Trades count
    const tradesEl = document.querySelector('[data-stat="trades"]');
    if (tradesEl) {
        tradesEl.textContent = this.portfolio.trades.length;
    }
    
    // Win rate
    if (this.portfolio.trades.length > 0) {
        const wins = this.portfolio.trades.filter(t => t.profit).length;
        const winRate = (wins / this.portfolio.trades.length * 100).toFixed(1);
        const winRateEl = document.querySelector('[data-stat="winrate"]');
        if (winRateEl) {
            winRateEl.textContent = winRate + '%';
        }
    }
    
    // Bot status
    const statusEl = document.querySelector('[data-stat="status"]');
    if (statusEl) {
        const isActive = this.bot.active && this.portfolio.btcBalance > 0;
        statusEl.textContent = isActive ? 'Active' : 'Idle';
        statusEl.className = isActive ? 'badge badge-success' : 'badge badge-warning';
    }
};

// ============================================
// Portfolio Management
// ============================================
AnomCAT.deposit = function(btcAmount) {
    if (isNaN(btcAmount) || btcAmount <= 0) {
        return false;
    }
    
    if (this.portfolio.initialBtc === 0) {
        this.portfolio.initialBtc = btcAmount;
        this.portfolio.btcBalance = btcAmount;
        this.portfolio.history = [{
            time: Date.now(),
            value: btcAmount
        }];
    } else {
        this.portfolio.btcBalance += btcAmount;
    }
    
    this.portfolio.eurBalance = this.btcToEur(this.portfolio.btcBalance);
    this.bot.active = true;
    this.bot.lastUpdate = Date.now();
    
    // Add deposit transaction
    this.addTransaction('deposit', btcAmount);
    
    this.saveToStorage();
    this.updateAllDisplays();
    
    return true;
};

AnomCAT.addTransaction = function(type, amount) {
    const transaction = {
        id: Date.now(),
        time: Date.now(),
        type: type,
        amount: amount,
        profit: type === 'trade' ? Math.random() > 0.4 : null
    };
    
    this.portfolio.trades.unshift(transaction);
    
    // Keep only last 100 transactions
    if (this.portfolio.trades.length > 100) {
        this.portfolio.trades = this.portfolio.trades.slice(0, 100);
    }
    
    this.saveToStorage();
};

AnomCAT.startPortfolioUpdates = function() {
    // Clear existing intervals
    if (this.intervals.portfolio) {
        clearInterval(this.intervals.portfolio);
    }
    
    // Update portfolio every 5 seconds
    this.intervals.portfolio = setInterval(() => {
        this.updatePortfolio();
    }, 5000);
};

AnomCAT.updatePortfolio = function() {
    if (!this.bot.active || this.portfolio.btcBalance <= 0) return;
    
    const now = Date.now();
    const elapsed = now - this.bot.lastUpdate;
    const monthsElapsed = elapsed / (1000 * 60 * 60 * 24 * DAYS_PER_MONTH);
    
    // Calculate compounded growth
    const growth = this.portfolio.btcBalance * (Math.pow(1 + this.bot.monthlyReturn, monthsElapsed) - 1);
    
    if (growth > SATOSHI_THRESHOLD) {
        this.portfolio.btcBalance += growth;
        this.portfolio.eurBalance = this.btcToEur(this.portfolio.btcBalance);
        this.bot.lastUpdate = now;
        
        // Add to history
        this.portfolio.history.push({
            time: now,
            value: this.portfolio.btcBalance
        });
        
        // Keep only last 100 data points
        if (this.portfolio.history.length > 100) {
            this.portfolio.history.shift();
        }
        
        // Random trade simulation
        if (Math.random() > 0.7) {
            const tradeAmount = this.portfolio.btcBalance * (Math.random() * 0.05 + 0.01);
            this.addTransaction('trade', tradeAmount);
        }
        
        this.saveToStorage();
        this.updateAllDisplays();
    }
};

// ============================================
// Navigation
// ============================================
AnomCAT.initNavigation = function() {
    // Highlight current page in bottom nav
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    document.querySelectorAll('.nav-item').forEach(item => {
        const href = item.getAttribute('href');
        if (href === currentPage || (currentPage === '' && href === 'home.html')) {
            item.classList.add('active');
        }
    });
};

AnomCAT.isAuthenticatedPage = function() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const authPages = ['login.html', 'register.html', 'index.html'];
    return !authPages.includes(currentPage);
};

// ============================================
// Storage
// ============================================
AnomCAT.saveToStorage = function() {
    try {
        localStorage.setItem('anomcat_portfolio', JSON.stringify(this.portfolio));
        localStorage.setItem('anomcat_bot', JSON.stringify(this.bot));
        localStorage.setItem('anomcat_currency', this.currency);
    } catch (e) {
        console.error('Failed to save to localStorage:', e);
    }
};

AnomCAT.loadFromStorage = function() {
    try {
        const portfolio = localStorage.getItem('anomcat_portfolio');
        if (portfolio) {
            this.portfolio = JSON.parse(portfolio);
        }
        
        const bot = localStorage.getItem('anomcat_bot');
        if (bot) {
            this.bot = JSON.parse(bot);
        }
        
        const currency = localStorage.getItem('anomcat_currency');
        if (currency) {
            this.currency = currency;
        }
    } catch (e) {
        console.error('Failed to load from localStorage:', e);
    }
};

AnomCAT.clearStorage = function() {
    try {
        localStorage.removeItem('anomcat_portfolio');
        localStorage.removeItem('anomcat_bot');
        localStorage.removeItem('anomcat_currency');
        
        // Reset to defaults
        this.currency = 'BTC';
        this.portfolio = {
            btcBalance: 0,
            eurBalance: 0,
            initialBtc: 0,
            history: [],
            trades: []
        };
        this.bot = {
            active: false,
            monthlyReturn: 0.013,
            lastUpdate: Date.now()
        };
    } catch (e) {
        console.error('Failed to clear localStorage:', e);
    }
};

// ============================================
// Service Worker
// ============================================
AnomCAT.registerServiceWorker = function() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.log('Service Worker registration failed:', err);
        });
    }
};

// ============================================
// Utilities
// ============================================
AnomCAT.formatDate = function(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

AnomCAT.formatTime = function(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
};

AnomCAT.formatDateTime = function(timestamp) {
    return this.formatDate(timestamp) + ' ' + this.formatTime(timestamp);
};

AnomCAT.formatRelativeTime = function(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return minutes + 'm ago';
    if (hours < 24) return hours + 'h ago';
    if (days < 7) return days + 'd ago';
    
    return this.formatDate(timestamp);
};

// ============================================
// Chart Utilities (used by pages with charts)
// ============================================
AnomCAT.generateChartData = function(days = 30) {
    // First, try to use loaded JSON data
    const defaultData = this.getDefaultChartData();
    if (defaultData && defaultData.length > 0) {
        return defaultData;
    }
    
    // If we have user history data, use it
    if (this.portfolio.history.length > 1) {
        return this.portfolio.history.map(point => ({
            time: point.time,
            value: this.currency === 'EUR' ? point.value * this.btcToEurRate : point.value
        }));
    }
    
    // Generate fallback data for display
    const data = [];
    const now = Date.now();
    const startValue = this.portfolio.initialBtc || 1;
    let currentValue = startValue;
    
    for (let i = days; i >= 0; i--) {
        const time = now - (i * 24 * 60 * 60 * 1000);
        // Simulate growth with some variance
        const dailyReturn = this.bot.monthlyReturn / 30;
        const variance = (Math.random() - 0.5) * dailyReturn * 0.5;
        currentValue *= (1 + dailyReturn + variance);
        
        data.push({
            time: time,
            value: this.currency === 'EUR' ? currentValue * this.btcToEurRate : currentValue
        });
    }
    
    return data;
};

// Make AnomCAT globally available
window.AnomCAT = AnomCAT;
