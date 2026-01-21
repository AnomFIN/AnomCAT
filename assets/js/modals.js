/**
 * AnomCAT v1.03 - Transaction Modals
 * Handles Send, Receive, Swap, and Buy modal functionality
 */

// Modal utility functions
const AnomModals = {
    // Show toast notification
    showToast(message, type = 'success') {
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-icon">
                    ${type === 'success' ? '✓' : '✕'}
                </div>
                <div class="toast-message">${message}</div>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
    
    // Create and show a modal
    createModal(id, title, content, onConfirm) {
        // Remove existing modal if any
        const existing = document.getElementById(id);
        if (existing) {
            existing.remove();
        }
        
        const modal = document.createElement('div');
        modal.id = id;
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-container">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="modal-close" data-close>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Show modal
        setTimeout(() => modal.classList.add('show'), 10);
        
        // Close handlers
        const closeModal = () => {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        };
        
        modal.querySelector('[data-close]').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // Confirm handler
        if (onConfirm) {
            const confirmBtn = modal.querySelector('[data-confirm]');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', () => {
                    onConfirm(modal);
                    closeModal();
                });
            }
        }
        
        return modal;
    },
    
    // Send Modal
    showSendModal() {
        const accounts = JSON.parse(localStorage.getItem('accounts') || '[]');
        const accountOptions = accounts.map(a => 
            `<option value="${a.id}">${a.name} (${a.btc_balance.toFixed(8)} BTC)</option>`
        ).join('');
        
        const content = `
            <form id="sendForm">
                <div class="modal-form-group">
                    <label class="modal-form-label" data-i18n="modals.send.from">${t('modals.send.from') || 'Lähettäjä'}</label>
                    <select class="modal-form-select" id="sendFromAccount" required>
                        ${accountOptions}
                    </select>
                </div>
                
                <div class="modal-form-group">
                    <label class="modal-form-label" data-i18n="modals.send.to">${t('modals.send.to') || 'Vastaanottaja'}</label>
                    <select class="modal-form-select" id="sendToAccount" required>
                        ${accountOptions}
                    </select>
                </div>
                
                <div class="modal-form-group">
                    <label class="modal-form-label" data-i18n="modals.send.amount">${t('modals.send.amount') || 'Määrä'} (BTC)</label>
                    <div class="quick-amounts">
                        <button type="button" class="quick-amount-btn" data-percent="25">25%</button>
                        <button type="button" class="quick-amount-btn" data-percent="50">50%</button>
                        <button type="button" class="quick-amount-btn" data-percent="100">100%</button>
                    </div>
                    <input type="number" class="modal-form-input" id="sendAmount" placeholder="0.00000000" step="0.00000001" min="0.00000001" required>
                </div>
                
                <div class="modal-footer">
                    <button type="button" class="modal-btn modal-btn-secondary" data-close>${t('actions.cancel') || 'Peruuta'}</button>
                    <button type="submit" class="modal-btn modal-btn-primary" data-confirm>${t('modals.send.confirm') || 'Vahvista lähetys'}</button>
                </div>
            </form>
        `;
        
        const modal = this.createModal('sendModal', t('modals.send.title') || 'Lähetä BTC', content);
        
        // Quick amount buttons
        modal.querySelectorAll('[data-percent]').forEach(btn => {
            btn.addEventListener('click', function() {
                const percent = parseFloat(this.dataset.percent);
                const fromId = modal.querySelector('#sendFromAccount').value;
                const accounts = JSON.parse(localStorage.getItem('accounts') || '[]');
                const fromAccount = accounts.find(a => a.id === fromId);
                
                if (fromAccount) {
                    const amount = (fromAccount.btc_balance * percent / 100).toFixed(8);
                    modal.querySelector('#sendAmount').value = amount;
                }
                
                // Update active state
                modal.querySelectorAll('[data-percent]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            });
        });
        
        // Form submission
        modal.querySelector('#sendForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const fromId = modal.querySelector('#sendFromAccount').value;
            const toId = modal.querySelector('#sendToAccount').value;
            const amount = parseFloat(modal.querySelector('#sendAmount').value);
            
            if (fromId === toId) {
                this.showToast(t('validation.error') || 'Virhe: Sama tili', 'error');
                return;
            }
            
            try {
                AnomCAT.sendTransaction(fromId, toId, amount);
                this.showToast(t('notifications.sendSuccess') || 'Lähetys onnistui!', 'success');
                
                // Update displays
                if (typeof updateCatDisplay === 'function') {
                    updateCatDisplay();
                }
                AnomCAT.updateAllDisplays();
                
                modal.classList.remove('show');
                setTimeout(() => modal.remove(), 300);
            } catch (error) {
                this.showToast(t('validation.insufficientFunds') || 'Varat eivät riitä', 'error');
            }
        });
    },
    
    // Receive Modal
    showReceiveModal() {
        const accounts = JSON.parse(localStorage.getItem('accounts') || '[]');
        const mainAccount = accounts.find(a => a.id === 'main');
        const address = mainAccount ? (mainAccount.address || 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh') : 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
        
        const content = `
            <div class="qr-code-container">
                <div class="qr-code-placeholder">QR Code</div>
            </div>
            
            <div class="modal-form-group">
                <label class="modal-form-label" data-i18n="modals.receive.address">${t('modals.receive.address') || 'Vastaanotto-osoite'}</label>
                <div class="address-display">
                    <div class="address-text" id="receiveAddress">${address}</div>
                    <button class="address-copy-btn" id="copyAddressBtn">${t('modals.receive.copy') || 'Kopioi'}</button>
                </div>
            </div>
            
            <div class="modal-footer">
                <button type="button" class="modal-btn modal-btn-primary" data-close>${t('actions.close') || 'Sulje'}</button>
            </div>
        `;
        
        const modal = this.createModal('receiveModal', t('modals.receive.title') || 'Vastaanota BTC', content);
        
        // Copy address
        modal.querySelector('#copyAddressBtn').addEventListener('click', () => {
            const address = modal.querySelector('#receiveAddress').textContent;
            navigator.clipboard.writeText(address).then(() => {
                this.showToast(t('notifications.addressCopied') || 'Osoite kopioitu!', 'success');
            });
        });
    },
    
    // Swap Modal
    showSwapModal() {
        const content = `
            <form id="swapForm">
                <div class="modal-form-group">
                    <label class="modal-form-label" data-i18n="modals.swap.from">${t('modals.swap.from') || 'Vaihda'}</label>
                    <select class="modal-form-select" id="swapFromToken">
                        <option value="BTC">Bitcoin (BTC)</option>
                        <option value="ETH">Ethereum (ETH)</option>
                        <option value="USDT">Tether (USDT)</option>
                    </select>
                </div>
                
                <div class="modal-form-group">
                    <label class="modal-form-label" data-i18n="modals.swap.amount">${t('modals.swap.amount') || 'Määrä'}</label>
                    <input type="number" class="modal-form-input" id="swapAmount" placeholder="0.00000000" step="0.00000001" min="0.00000001" required>
                </div>
                
                <div class="modal-form-group">
                    <label class="modal-form-label" data-i18n="modals.swap.to">${t('modals.swap.to') || 'Vastaanota'}</label>
                    <select class="modal-form-select" id="swapToToken">
                        <option value="ETH">Ethereum (ETH)</option>
                        <option value="BTC">Bitcoin (BTC)</option>
                        <option value="USDT">Tether (USDT)</option>
                    </select>
                </div>
                
                <div class="modal-footer">
                    <button type="button" class="modal-btn modal-btn-secondary" data-close>${t('actions.cancel') || 'Peruuta'}</button>
                    <button type="submit" class="modal-btn modal-btn-primary" data-confirm>${t('modals.swap.confirm') || 'Suorita swap (demo)'}</button>
                </div>
            </form>
        `;
        
        const modal = this.createModal('swapModal', t('modals.swap.title') || 'Vaihda tokenit', content);
        
        modal.querySelector('#swapForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const fromToken = modal.querySelector('#swapFromToken').value;
            const toToken = modal.querySelector('#swapToToken').value;
            const amount = parseFloat(modal.querySelector('#swapAmount').value);
            
            if (fromToken === toToken) {
                this.showToast(t('validation.error') || 'Virhe: Sama token', 'error');
                return;
            }
            
            try {
                AnomCAT.swapTransaction(fromToken, toToken, amount);
                this.showToast(t('notifications.swapSuccess') || 'Vaihto onnistui!', 'success');
                
                modal.classList.remove('show');
                setTimeout(() => modal.remove(), 300);
            } catch (error) {
                this.showToast(t('validation.error') || 'Virhe tapahtui', 'error');
            }
        });
    },
    
    // Buy Modal
    showBuyModal() {
        const content = `
            <form id="buyForm">
                <div class="modal-form-group">
                    <label class="modal-form-label" data-i18n="modals.buy.amount">${t('modals.buy.amount') || 'Määrä'} (BTC)</label>
                    <div class="quick-amounts">
                        <button type="button" class="quick-amount-btn" data-amount="0.001">0.001 BTC</button>
                        <button type="button" class="quick-amount-btn" data-amount="0.01">0.01 BTC</button>
                        <button type="button" class="quick-amount-btn" data-amount="0.1">0.1 BTC</button>
                    </div>
                    <input type="number" class="modal-form-input" id="buyAmount" placeholder="0.00000000" step="0.00000001" min="0.00000001" required>
                </div>
                
                <div class="modal-form-group">
                    <label class="modal-form-label" data-i18n="modals.buy.payment">${t('modals.buy.payment') || 'Maksutapa'}</label>
                    <select class="modal-form-select" id="buyPayment">
                        <option value="card">Luottokortti</option>
                        <option value="bank">Pankkisiirto</option>
                        <option value="paypal">PayPal</option>
                    </select>
                </div>
                
                <div class="modal-footer">
                    <button type="button" class="modal-btn modal-btn-secondary" data-close>${t('actions.cancel') || 'Peruuta'}</button>
                    <button type="submit" class="modal-btn modal-btn-primary" data-confirm>${t('modals.buy.confirm') || 'Vahvista osto'}</button>
                </div>
            </form>
        `;
        
        const modal = this.createModal('buyModal', t('modals.buy.title') || 'Osta BTC', content);
        
        // Quick amount buttons
        modal.querySelectorAll('[data-amount]').forEach(btn => {
            btn.addEventListener('click', function() {
                modal.querySelector('#buyAmount').value = this.dataset.amount;
                modal.querySelectorAll('[data-amount]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            });
        });
        
        modal.querySelector('#buyForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const amount = parseFloat(modal.querySelector('#buyAmount').value);
            const payment = modal.querySelector('#buyPayment').value;
            
            try {
                AnomCAT.receiveTransaction('main', amount);
                this.showToast(t('notifications.depositSuccess') || 'Osto onnistui!', 'success');
                
                AnomCAT.updateAllDisplays();
                
                modal.classList.remove('show');
                setTimeout(() => modal.remove(), 300);
            } catch (error) {
                this.showToast(t('validation.error') || 'Virhe tapahtui', 'error');
            }
        });
    }
};

// Make globally available
window.AnomModals = AnomModals;
