// AnomCAT - Crypto Trading Bot Simulator
// Fully client-side implementation

class AnomCAT {
    constructor() {
        this.portfolio = {
            initial: 0,
            current: 0,
            history: [],
            trades: []
        };
        this.botActive = false;
        this.monthlyReturn = 0.013; // 1.3% per month
        this.lastUpdate = Date.now();
        this.currentFeed = 'mempool';
        
        this.init();
    }

    init() {
        this.loadFromStorage();
        this.setupEventListeners();
        this.startBot();
        this.startNetworkFeed();
        this.renderChart();
        this.updateUI();
        
        // Register service worker for PWA
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(err => {
                console.log('Service Worker registration failed:', err);
            });
        }
    }

    setupEventListeners() {
        // Deposit button
        document.getElementById('depositBtn').addEventListener('click', () => {
            this.handleDeposit();
        });

        // Feed tabs
        document.querySelectorAll('.feed-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchFeed(e.target.dataset.feed);
            });
        });

        // Enter key on deposit input
        document.getElementById('depositAmount').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleDeposit();
            }
        });
    }

    handleDeposit() {
        const amount = parseFloat(document.getElementById('depositAmount').value);
        
        if (isNaN(amount) || amount <= 0) {
            alert('Please enter a valid BTC amount');
            return;
        }

        if (this.portfolio.initial === 0) {
            this.portfolio.initial = amount;
            this.portfolio.current = amount;
            this.portfolio.history = [{
                time: Date.now(),
                value: amount
            }];
        } else {
            this.portfolio.current += amount;
        }

        this.botActive = true;
        this.lastUpdate = Date.now();
        
        document.getElementById('depositAmount').value = '';
        this.saveToStorage();
        this.updateUI();
        this.renderChart();

        // Simulate a trade
        this.simulateTrade('BUY', amount * 0.1);
    }

    startBot() {
        // Update portfolio value based on time elapsed
        setInterval(() => {
            if (this.botActive && this.portfolio.current > 0) {
                const now = Date.now();
                const elapsed = now - this.lastUpdate;
                const monthsElapsed = elapsed / (1000 * 60 * 60 * 24 * 30);
                
                // Calculate compounded growth
                const growth = this.portfolio.current * Math.pow(1 + this.monthlyReturn, monthsElapsed) - this.portfolio.current;
                
                if (growth > 0.00000001) { // Only update if meaningful growth
                    this.portfolio.current += growth;
                    this.lastUpdate = now;
                    
                    // Add to history
                    this.portfolio.history.push({
                        time: now,
                        value: this.portfolio.current
                    });

                    // Keep only last 100 data points
                    if (this.portfolio.history.length > 100) {
                        this.portfolio.history.shift();
                    }

                    this.saveToStorage();
                    this.updateUI();
                    this.renderChart();

                    // Randomly simulate trades
                    if (Math.random() > 0.7) {
                        const tradeAmount = this.portfolio.current * (Math.random() * 0.05 + 0.01);
                        const type = Math.random() > 0.5 ? 'BUY' : 'SELL';
                        this.simulateTrade(type, tradeAmount);
                    }
                }
            }
        }, 5000); // Update every 5 seconds
    }

    simulateTrade(type, amount) {
        const trade = {
            time: Date.now(),
            type: type,
            amount: amount,
            profit: Math.random() > 0.4 ? true : false
        };

        this.portfolio.trades.push(trade);

        // Keep only last 50 trades
        if (this.portfolio.trades.length > 50) {
            this.portfolio.trades.shift();
        }

        this.saveToStorage();
        this.updateUI();
    }

    updateUI() {
        // Portfolio value
        document.getElementById('portfolioValue').textContent = 
            this.formatBTC(this.portfolio.current);

        // Initial value
        document.getElementById('initialValue').textContent = 
            this.formatBTC(this.portfolio.initial);

        // Profit
        const profit = this.portfolio.current - this.portfolio.initial;
        const profitEl = document.getElementById('profitValue');
        profitEl.textContent = (profit >= 0 ? '+' : '') + this.formatBTC(profit);
        profitEl.className = 'portfolio-stat-value ' + (profit >= 0 ? 'gain' : 'loss');

        // ROI
        const roi = this.portfolio.initial > 0 
            ? ((this.portfolio.current - this.portfolio.initial) / this.portfolio.initial * 100) 
            : 0;
        const roiEl = document.getElementById('roiValue');
        roiEl.textContent = (roi >= 0 ? '+' : '') + roi.toFixed(2) + '%';
        roiEl.className = 'portfolio-stat-value ' + (roi >= 0 ? 'gain' : 'loss');

        // Bot status
        document.getElementById('botStatus').textContent = 
            this.botActive && this.portfolio.current > 0 ? 'ACTIVE' : 'IDLE';

        // Trades count
        document.getElementById('tradesCount').textContent = 
            this.portfolio.trades.length;

        // Win rate
        if (this.portfolio.trades.length > 0) {
            const wins = this.portfolio.trades.filter(t => t.profit).length;
            const winRate = (wins / this.portfolio.trades.length * 100).toFixed(1);
            document.getElementById('winRate').textContent = winRate + '%';
        }
    }

    renderChart() {
        const canvas = document.getElementById('chartCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const rect = canvas.parentElement.getBoundingClientRect();
        
        // Set canvas size
        canvas.width = rect.width - 32; // Account for padding
        canvas.height = rect.height - 32;

        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        if (this.portfolio.history.length < 2) {
            // Show placeholder
            ctx.strokeStyle = '#2a3564';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(0, height / 2);
            ctx.lineTo(width, height / 2);
            ctx.stroke();
            ctx.setLineDash([]);
            
            ctx.fillStyle = '#606080';
            ctx.font = '14px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText('Deposit BTC to start tracking', width / 2, height / 2 - 10);
            return;
        }

        // Get min/max values for scaling
        const values = this.portfolio.history.map(h => h.value);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const range = maxValue - minValue || 1;
        const padding = range * 0.1;

        // Draw grid
        ctx.strokeStyle = '#2a3564';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = (height / 4) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Draw chart line
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00f3ff';
        
        ctx.beginPath();
        this.portfolio.history.forEach((point, index) => {
            const x = (index / (this.portfolio.history.length - 1)) * width;
            const y = height - ((point.value - minValue + padding) / (range + padding * 2)) * height;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Draw gradient fill
        ctx.shadowBlur = 0;
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(0, 243, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 243, 255, 0)');
        ctx.fillStyle = gradient;
        
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fill();

        // Draw current value point
        const lastPoint = this.portfolio.history[this.portfolio.history.length - 1];
        const lastX = width;
        const lastY = height - ((lastPoint.value - minValue + padding) / (range + padding * 2)) * height;
        
        ctx.fillStyle = '#00f3ff';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00f3ff';
        ctx.beginPath();
        ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    startNetworkFeed() {
        // Simulate mempool and block feed
        this.updateNetworkFeed();
        
        setInterval(() => {
            this.updateNetworkFeed();
        }, 10000); // Update every 10 seconds
    }

    updateNetworkFeed() {
        const feedContent = document.getElementById('feedContent');
        
        if (this.currentFeed === 'mempool') {
            // Simulate mempool transactions
            const tx = this.generateMempoolTx();
            this.addFeedItem(tx.icon, tx.text);
        } else {
            // Simulate block confirmations
            const block = this.generateBlock();
            this.addFeedItem(block.icon, block.text);
        }

        // Keep only last 10 items
        const items = feedContent.querySelectorAll('.feed-item');
        if (items.length > 10) {
            items[0].remove();
        }
    }

    generateMempoolTx() {
        const txTypes = [
            { icon: '💸', text: 'New transaction: {amount} BTC | Fee: {fee} sat/vB' },
            { icon: '⚡', text: 'Lightning channel opened: {amount} BTC capacity' },
            { icon: '🔄', text: 'Transaction confirmed in mempool: {size} vB' },
            { icon: '📊', text: 'Mempool size: {size} MB | {count} pending transactions' }
        ];

        const type = txTypes[Math.floor(Math.random() * txTypes.length)];
        const amount = (Math.random() * 10 + 0.1).toFixed(4);
        const fee = Math.floor(Math.random() * 50 + 10);
        const size = Math.floor(Math.random() * 500 + 100);
        const mempoolSize = Math.floor(Math.random() * 100 + 50);
        const count = Math.floor(Math.random() * 50000 + 10000);

        return {
            icon: type.icon,
            text: type.text
                .replace('{amount}', amount)
                .replace('{fee}', fee)
                .replace('{size}', mempoolSize)
                .replace('{count}', count)
        };
    }

    generateBlock() {
        const blockHeight = 800000 + Math.floor(Math.random() * 10000);
        const txCount = Math.floor(Math.random() * 2000 + 1000);
        const reward = '6.25';
        
        const blockTypes = [
            { icon: '⛏️', text: `Block ${blockHeight} mined | ${txCount} transactions` },
            { icon: '✅', text: `Block confirmed: ${blockHeight} | Reward: ${reward} BTC` },
            { icon: '🔗', text: `New block: ${blockHeight} | Size: ${(Math.random() * 2 + 1).toFixed(2)} MB` }
        ];

        return blockTypes[Math.floor(Math.random() * blockTypes.length)];
    }

    addFeedItem(icon, text) {
        const feedContent = document.getElementById('feedContent');
        
        // Remove loading message if present
        const loadingMsg = feedContent.querySelector('.feed-text');
        if (loadingMsg && loadingMsg.textContent === 'Loading network data...') {
            feedContent.innerHTML = '';
        }

        const item = document.createElement('div');
        item.className = 'feed-item';
        item.innerHTML = `
            <span class="feed-icon">${icon}</span>
            <span class="feed-text">${text}</span>
            <span class="feed-time">${this.formatTime(Date.now())}</span>
        `;
        
        feedContent.appendChild(item);
        feedContent.scrollTop = feedContent.scrollHeight;
    }

    switchFeed(feed) {
        this.currentFeed = feed;
        
        // Update tab styles
        document.querySelectorAll('.feed-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.feed === feed) {
                tab.classList.add('active');
            }
        });

        // Clear feed content
        document.getElementById('feedContent').innerHTML = '';
        
        // Load new feed
        this.updateNetworkFeed();
    }

    formatBTC(value) {
        return value.toFixed(8) + ' BTC';
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    saveToStorage() {
        try {
            localStorage.setItem('anomcat_portfolio', JSON.stringify(this.portfolio));
            localStorage.setItem('anomcat_bot_active', this.botActive);
            localStorage.setItem('anomcat_last_update', this.lastUpdate);
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
    }

    loadFromStorage() {
        try {
            const portfolio = localStorage.getItem('anomcat_portfolio');
            if (portfolio) {
                this.portfolio = JSON.parse(portfolio);
            }

            const botActive = localStorage.getItem('anomcat_bot_active');
            if (botActive !== null) {
                this.botActive = botActive === 'true';
            }

            const lastUpdate = localStorage.getItem('anomcat_last_update');
            if (lastUpdate) {
                this.lastUpdate = parseInt(lastUpdate);
            }
        } catch (e) {
            console.error('Failed to load from localStorage:', e);
        }
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.anomcat = new AnomCAT();
    });
} else {
    window.anomcat = new AnomCAT();
}
