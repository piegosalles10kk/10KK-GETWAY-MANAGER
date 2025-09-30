// ========================================
// CONFIGURAÇÃO E CONSTANTES
// ========================================

const CONFIG = {
    BASE_GATEWAY_URL: 'https://piegosalles-backend.cloud/',
    API_BASE_URL: window.location.origin,
    get AUTH_API() { return `${this.API_BASE_URL}/api`; },
    get ADMIN_API() { return `${this.API_BASE_URL}/admin/routes`; },
    get DISCOVER_API() { return `${this.API_BASE_URL}/admin/discover`; }
};

// ========================================
// GERENCIAMENTO DE ESTADO
// ========================================

const State = {
    token: localStorage.getItem('token') || null,
    routes: [],
    availablePorts: [],
    
    setToken(token) {
        this.token = token;
        localStorage.setItem('token', token);
    },
    
    clearToken() {
        this.token = null;
        localStorage.removeItem('token');
    },
    
    setRoutes(routes) {
        this.routes = routes;
    },
    
    setAvailablePorts(ports) {
        this.availablePorts = ports;
    }
};

// ========================================
// GERENCIAMENTO DE DOM
// ========================================

const DOM = {
    // Views
    views: {
        login: document.getElementById('login-view'),
        firstAccess: document.getElementById('first-access-view'),
        requestReset: document.getElementById('request-reset-view'),
        resetPassword: document.getElementById('reset-password-view'),
        dashboard: document.getElementById('dashboard-view')
    },
    
    // Forms
    forms: {
        login: document.getElementById('login-form'),
        firstAccess: document.getElementById('first-access-form'),
        requestReset: document.getElementById('request-reset-form'),
        resetPassword: document.getElementById('reset-password-form'),
        route: document.getElementById('route-form')
    },
    
    // Messages
    messages: {
        login: document.getElementById('login-message'),
        firstAccess: document.getElementById('first-access-message'),
        requestReset: document.getElementById('request-reset-message'),
        resetPassword: document.getElementById('reset-password-message')
    },
    
    // Elements
    authControls: document.querySelector('.auth-controls'),
    logoutBtn: document.getElementById('logout-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    modeToggle: document.getElementById('mode-toggle'),
    
    routesTableBody: document.getElementById('routes-table-body'),
    routeSearch: document.getElementById('route-search'),
    
    // Cards
    usedPortsCard: document.getElementById('used-ports'),
    availablePortsCard: document.getElementById('available-ports'),
    totalRoutesCard: document.getElementById('total-routes'),
    
    // Modal
    modal: document.getElementById('modal'),
    modalIcon: document.getElementById('modal-icon'),
    modalTitle: document.getElementById('modal-title'),
    modalMessage: document.getElementById('modal-message'),
    modalClose: document.getElementById('modal-close'),
    
    // Auth links
    forgotPasswordLink: document.getElementById('forgot-password-link'),
    backToLoginLink: document.getElementById('back-to-login'),
    
    // Reset
    resetToken: document.getElementById('reset-token'),
    resetInfo: document.getElementById('reset-info')
};

// ========================================
// UTILIDADES DE API
// ========================================

const API = {
    async call(url, method = 'GET', data = null, needsAuth = false) {
        const headers = { 'Content-Type': 'application/json' };
        
        if (needsAuth && State.token) {
            headers['Authorization'] = `Bearer ${State.token}`;
        }
        
        const config = {
            method,
            headers,
            body: data ? JSON.stringify(data) : null
        };
        
        try {
            const response = await fetch(url, config);
            const result = await response.json();
            
            if (response.status === 401 || response.status === 403) {
                if (needsAuth) {
                    Auth.logout();
                }
                return { error: true, message: result.message || 'Acesso negado ou sessão expirada.' };
            }
            
            if (!response.ok) {
                throw new Error(result.message || result.error || 'Erro desconhecido');
            }
            
            return result;
            
        } catch (error) {
            console.error('Erro na API:', error);
            
            if (error.message.includes('Failed to fetch')) {
                return { error: true, message: 'Erro de conexão com o servidor.' };
            }
            
            return { error: true, message: error.message };
        }
    }
};

// ========================================
// GERENCIAMENTO DE TEMA
// ========================================

const Theme = {
    init() {
        const savedTheme = localStorage.getItem('theme');
        
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            DOM.themeToggle.checked = true;
        }
        
        DOM.themeToggle.addEventListener('change', () => this.toggle());
    },
    
    toggle() {
        if (DOM.themeToggle.checked) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
        }
    }
};

// ========================================
// GERENCIAMENTO DE VIEWS
// ========================================

const ViewManager = {
    show(viewName) {
        Object.values(DOM.views).forEach(view => view.classList.add('hidden'));
        DOM.views[viewName]?.classList.remove('hidden');
        
        if (viewName === 'dashboard') {
            DOM.authControls.classList.remove('hidden');
        } else {
            DOM.authControls.classList.add('hidden');
        }
    }
};

// ========================================
// MODAL
// ========================================

const Modal = {
    show(type, title, message) {
        DOM.modalTitle.textContent = title;
        DOM.modalMessage.textContent = message;
        
        const iconClass = type === 'success' ? 'fas fa-check-circle' : 'fas fa-times-circle';
        DOM.modalIcon.className = `modal-icon ${type}`;
        DOM.modalIcon.innerHTML = `<i class="${iconClass}"></i>`;
        
        DOM.modal.classList.remove('hidden');
        DOM.modal.classList.add('visible');
    },
    
    hide() {
        DOM.modal.classList.remove('visible');
        DOM.modal.classList.add('hidden');
    },
    
    init() {
        DOM.modalClose.addEventListener('click', () => this.hide());
    }
};

// ========================================
// AUTENTICAÇÃO
// ========================================

const Auth = {
    async checkInitialStatus() {
        if (State.token) {
            ViewManager.show('dashboard');
            Dashboard.load();
            return;
        }
        
        if (await this.checkResetToken()) {
            return;
        }
        
        try {
            const result = await API.call(`${CONFIG.AUTH_API}/first-access`);
            
            if (result.needsRegistration) {
                ViewManager.show('firstAccess');
            } else {
                ViewManager.show('login');
            }
        } catch (error) {
            Modal.show('error', 'Erro de Conexão', 'Não foi possível conectar ao servidor.');
            ViewManager.show('login');
        }
    },
    
    async checkResetToken() {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        if (!token) return false;
        
        ViewManager.show('resetPassword');
        DOM.resetToken.value = token;
        
        const result = await API.call(`${CONFIG.AUTH_API}/password-reset/validate/${token}`);
        
        if (result.error || !result.valid) {
            Modal.show('error', 'Token Inválido', result.message || 'Token inválido ou expirado.');
            window.history.pushState({}, document.title, window.location.pathname);
            ViewManager.show('login');
        } else {
            DOM.resetInfo.innerHTML = `Redefina a senha para: <strong>${result.email}</strong>`;
        }
        
        return true;
    },
    
    async registerFirst(formData) {
        this.showMessage('firstAccess', 'Registrando...', false);
        
        const result = await API.call(`${CONFIG.AUTH_API}/register-first`, 'POST', formData);
        
        if (!result.error) {
            this.showMessage('firstAccess', result.message, false);
            setTimeout(() => {
                ViewManager.show('login');
                this.showMessage('login', 'Administrador registrado. Faça login.', false);
            }, 2000);
        } else {
            this.showMessage('firstAccess', result.message, true);
        }
    },
    
    async login(credentials) {
        this.showMessage('login', 'Entrando...', false);
        
        const result = await API.call(`${CONFIG.AUTH_API}/login`, 'POST', credentials);
        
        if (!result.error) {
            State.setToken(result.token);
            this.showMessage('login', '', false);
            ViewManager.show('dashboard');
            Dashboard.load();
        } else {
            this.showMessage('login', result.message || 'Erro de login.', true);
        }
    },
    
    logout() {
        State.clearToken();
        ViewManager.show('login');
        DOM.forms.login.reset();
    },
    
    async requestReset(email) {
        this.showMessage('requestReset', 'Enviando link...', false);
        
        const result = await API.call(`${CONFIG.AUTH_API}/password-reset/request`, 'POST', { email });
        
        this.showMessage('requestReset', result.message, result.error);
    },
    
    async resetPassword(data) {
        this.showMessage('resetPassword', 'Redefinindo senha...', false);
        
        const result = await API.call(`${CONFIG.AUTH_API}/password-reset/reset`, 'POST', data);
        
        if (!result.error) {
            this.showMessage('resetPassword', result.message, false);
            Modal.show('success', 'Sucesso!', result.message + ' Redirecionando...');
            
            setTimeout(() => {
                ViewManager.show('login');
                window.history.pushState({}, document.title, window.location.pathname);
            }, 3000);
        } else {
            this.showMessage('resetPassword', result.message, true);
        }
    },
    
    showMessage(type, message, isError) {
        const element = DOM.messages[type];
        element.textContent = message;
        element.className = isError ? 'message error' : 'message success';
    }
};

// ========================================
// DASHBOARD
// ========================================

const Dashboard = {
    async load() {
        const routes = await this.fetchRoutes();
        if (routes.error) return;
        
        State.setRoutes(routes);
        
        await this.loadAvailablePorts();
        this.updateCards();
        this.renderRoutesTable(State.routes);
        RouteForm.render();
        
        if (DOM.routeSearch) {
            DOM.routeSearch.value = '';
        }
    },
    
    async fetchRoutes() {
        return API.call(CONFIG.ADMIN_API, 'GET', null, true);
    },
    
    async loadAvailablePorts() {
        const result = await API.call(CONFIG.DISCOVER_API, 'GET', null, true);
        
        if (result.error) {
            console.error('Erro ao descobrir portas:', result.message);
            State.setAvailablePorts([]);
        } else {
            State.setAvailablePorts(result);
        }
    },
    
    updateCards() {
        const routes = State.routes;
        
        DOM.totalRoutesCard.textContent = routes.length;
        DOM.usedPortsCard.textContent = routes.filter(r => r.is_healthy).length;
        DOM.availablePortsCard.textContent = State.availablePorts.length;
    },
    
    renderRoutesTable(routes) {
        DOM.routesTableBody.innerHTML = '';
        
        if (routes.length === 0) {
            DOM.routesTableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: var(--color-text-secondary);">
                        Nenhuma rota encontrada.
                    </td>
                </tr>
            `;
            return;
        }
        
        routes.forEach(route => {
            const row = this.createRouteRow(route);
            DOM.routesTableBody.appendChild(row);
        });
    },
    
    createRouteRow(route) {
        const { _id, name, route_path, target_url, check_port, is_active, is_healthy } = route;
        
        let statusClass = 'inactive';
        let statusText = 'Inativa';
        
        if (is_active) {
            if (is_healthy) {
                statusClass = 'online';
                statusText = 'Online';
            } else {
                statusClass = 'offline';
                statusText = 'Offline';
            }
        }
        
        const fullUrl = `${CONFIG.BASE_GATEWAY_URL}${route_path.startsWith('/') ? route_path.substring(1) : route_path}`;
        const pathDisplay = route_path 
            ? `<a href="${fullUrl}" target="_blank" class="route-link">${CONFIG.BASE_GATEWAY_URL}<strong>${route_path}</strong></a>`
            : 'N/A';
        
        const targetDisplay = check_port == 0 ? `<span style="color: var(--color-warning);">(EXT)</span> ${target_url}` : target_url;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <span class="status-badge status-${statusClass}">
                    <span class="status-dot"></span>
                    ${statusText}
                </span>
            </td>
            <td><strong>${name}</strong></td>
            <td>${pathDisplay}</td>
            <td>${targetDisplay}</td>
            <td>${check_port}</td>
            <td>
                <button class="btn btn-warning btn-edit" data-id="${_id}">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn btn-danger btn-delete" data-id="${_id}">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </td>
        `;
        
        return row;
    },
    
    filterRoutes(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        
        if (!term) {
            this.renderRoutesTable(State.routes);
            return;
        }
        
        const filtered = State.routes.filter(route => {
            return (route.name || '').toLowerCase().includes(term) ||
                   (route.route_path || '').toLowerCase().includes(term) ||
                   (route.target_url || '').toLowerCase().includes(term) ||
                   (route.check_port || '').toString().includes(term);
        });
        
        this.renderRoutesTable(filtered);
    }
};

// ========================================
// FORMULÁRIO DE ROTAS
// ========================================

const RouteForm = {
    currentEdit: null,
    
    render(routeToEdit = null) {
        this.currentEdit = routeToEdit;
        DOM.forms.route.innerHTML = '';
        
        if (routeToEdit) {
            this.renderEditMode(routeToEdit);
        } else {
            this.renderCreateMode();
        }
    },
    
    renderEditMode(route) {
        DOM.forms.route.innerHTML = `
            <input type="hidden" id="route-id" value="${route._id}">
            <input type="text" id="route-name" placeholder="Nome da Rota" value="${route.name}" required>
            <input type="text" id="route-path" placeholder="Caminho (ex: /api/service)" value="${route.route_path}" required>
            <input type="url" id="target-url" placeholder="URL Destino" value="${route.target_url}" required>
            <input type="number" id="check-port" placeholder="Porta Check" value="${route.check_port}" required>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" id="cancel-edit">
                    <i class="fas fa-times"></i> Cancelar
                </button>
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-save"></i> Salvar Alterações
                </button>
            </div>
        `;
        
        document.getElementById('cancel-edit').addEventListener('click', () => this.render());
    },
    
    renderCreateMode() {
        const isExternal = DOM.modeToggle ? DOM.modeToggle.checked : false;
        
        DOM.forms.route.innerHTML = `
            <input type="text" id="route-name" placeholder="Nome (ex: Service Produtos)" required>
        `;
        
        if (isExternal) {
            DOM.forms.route.innerHTML += `
                <input type="text" id="route-path" placeholder="Caminho (ex: /api/externa)" required>
                <input type="url" id="target-url" placeholder="URL Completa (ex: https://api.terceiros.com)" required>
                <input type="hidden" id="check-port" value="0">
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-plus"></i> Adicionar Rota Externa
                </button>
            `;
        } else if (State.availablePorts.length > 0) {
            this.renderPortSelector();
        } else {
            DOM.forms.route.innerHTML += `
                <p class="message error">Nenhum serviço ativo encontrado. Inicie um microserviço ou mude para modo externo.</p>
            `;
        }
    },
    
    renderPortSelector() {
        DOM.forms.route.innerHTML += `
            <input type="hidden" id="check-port">
            <div class="custom-select-wrapper">
                <div class="custom-select-trigger">
                    <span id="port-display">Selecione um serviço ativo...</span>
                    <i class="fas fa-chevron-down"></i>
                </div>
                <div class="custom-options">
                    ${State.availablePorts.map(port => `
                        <div class="custom-option" data-port="${port}">
                            <span class="port-label">Porta ${port}</span>
                            <span class="port-info">Serviço Rodando</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            <button type="submit" class="btn btn-primary">
                <i class="fas fa-plus"></i> Adicionar Rota Dinâmica
            </button>
        `;
        
        this.setupPortSelector();
    },
    
    setupPortSelector() {
        const trigger = DOM.forms.route.querySelector('.custom-select-trigger');
        const options = DOM.forms.route.querySelector('.custom-options');
        const portInput = document.getElementById('check-port');
        const display = document.getElementById('port-display');
        
        trigger.addEventListener('click', () => {
            const isOpen = options.style.display === 'block';
            options.style.display = isOpen ? 'none' : 'block';
            trigger.classList.toggle('active', !isOpen);
        });
        
        DOM.forms.route.querySelectorAll('.custom-option').forEach(option => {
            option.addEventListener('click', () => {
                const port = option.dataset.port;
                portInput.value = port;
                display.textContent = `Porta ${port} (Selecionada)`;
                
                DOM.forms.route.querySelectorAll('.custom-option').forEach(o => 
                    o.classList.remove('selected')
                );
                option.classList.add('selected');
                
                options.style.display = 'none';
                trigger.classList.remove('active');
            });
        });
        
        document.addEventListener('click', (e) => {
            if (trigger && !trigger.contains(e.target) && !options.contains(e.target)) {
                options.style.display = 'none';
                trigger.classList.remove('active');
            }
        });
    },
    
    async submit(e) {
        e.preventDefault();
        
        const id = document.getElementById('route-id')?.value;
        const name = document.getElementById('route-name').value;
        const checkPort = document.getElementById('check-port');
        
        let data = { name };
        let result;
        
        if (id) {
            // Modo Edição
            data.route_path = document.getElementById('route-path').value;
            data.target_url = document.getElementById('target-url').value;
            data.check_port = parseInt(checkPort.value, 10);
            data.is_active = true;
            
            result = await API.call(`${CONFIG.ADMIN_API}/${id}`, 'PUT', data, true);
        } else {
            // Modo Criação
            if (!checkPort || checkPort.value === '') {
                Modal.show('error', 'Atenção!', 'Selecione uma porta ou preencha todos os campos.');
                return;
            }
            
            const portValue = parseInt(checkPort.value, 10);
            
            if (portValue === 0) {
                data.route_path = document.getElementById('route-path').value;
                data.target_url = document.getElementById('target-url').value;
                data.check_port = 0;
                data.is_active = true;
                
                if (!data.route_path || !data.target_url) {
                    Modal.show('error', 'Atenção!', 'Preencha todos os campos para rotas externas.');
                    return;
                }
            } else {
                data.check_port = portValue;
            }
            
            result = await API.call(CONFIG.ADMIN_API, 'POST', data, true);
        }
        
        if (!result.error) {
            const routeName = result.route ? result.route.name : data.name;
            Modal.show('success', 'Sucesso!', `Rota "${routeName}" salva com sucesso.`);
            
            this.render();
            Dashboard.load();
        } else {
            Modal.show('error', 'Erro', result.message);
        }
    }
};

// ========================================
// GERENCIAMENTO DE ROTAS (CRUD)
// ========================================

const RouteManager = {
    async edit(id) {
        const route = State.routes.find(r => r._id === id);
        if (!route) return;
        
        RouteForm.render(route);
        
        // Scroll suave até o formulário
        DOM.forms.route.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    
    async delete(id) {
        const route = State.routes.find(r => r._id === id);
        if (!route) return;
        
        if (!confirm(`Tem certeza que deseja excluir a rota "${route.name}"?`)) {
            return;
        }
        
        const result = await API.call(`${CONFIG.ADMIN_API}/${id}`, 'DELETE', null, true);
        
        if (!result.error) {
            Modal.show('success', 'Sucesso!', result.message);
            Dashboard.load();
        } else {
            Modal.show('error', 'Erro', result.message);
        }
    }
};

// ========================================
// EVENT LISTENERS
// ========================================

const EventListeners = {
    init() {
        // Auth Events
        DOM.forms.login.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            Auth.login({ username, password });
        });
        
        DOM.forms.firstAccess.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = {
                name: document.getElementById('fa-name').value,
                email: document.getElementById('fa-email').value,
                username: document.getElementById('fa-username').value,
                password: document.getElementById('fa-password').value
            };
            Auth.registerFirst(formData);
        });
        
        DOM.forms.requestReset.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('reset-email').value;
            Auth.requestReset(email);
        });
        
        DOM.forms.resetPassword.addEventListener('submit', (e) => {
            e.preventDefault();
            const token = DOM.resetToken.value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            if (newPassword !== confirmPassword) {
                Auth.showMessage('resetPassword', 'As senhas não coincidem.', true);
                return;
            }
            
            if (newPassword.length < 6) {
                Auth.showMessage('resetPassword', 'A senha deve ter no mínimo 6 caracteres.', true);
                return;
            }
            
            Auth.resetPassword({ token, newPassword });
        });
        
        // Navigation Events
        DOM.forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            ViewManager.show('requestReset');
            Auth.showMessage('requestReset', '', false);
        });
        
        DOM.backToLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            ViewManager.show('login');
            Auth.showMessage('login', '', false);
        });
        
        DOM.logoutBtn.addEventListener('click', () => Auth.logout());
        
        // Route Form Events
        DOM.forms.route.addEventListener('submit', (e) => RouteForm.submit(e));
        
        // Mode Toggle
        if (DOM.modeToggle) {
            DOM.modeToggle.addEventListener('change', () => RouteForm.render());
        }
        
        // Table Events (Event Delegation)
        DOM.routesTableBody.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;
            
            const id = target.dataset.id;
            
            if (target.classList.contains('btn-edit')) {
                RouteManager.edit(id);
            } else if (target.classList.contains('btn-delete')) {
                RouteManager.delete(id);
            }
        });
        
        // Search Events
        if (DOM.routeSearch) {
            DOM.routeSearch.addEventListener('input', (e) => {
                Dashboard.filterRoutes(e.target.value);
            });
        }
    }
};

// ========================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ========================================

const App = {
    async init() {
        console.log('🚀 Iniciando 10KK Gateway Manager...');
        
        // Inicializa módulos
        Theme.init();
        Modal.init();
        EventListeners.init();
        
        // Verifica autenticação
        await Auth.checkInitialStatus();
        
        console.log('✅ Aplicação inicializada com sucesso!');
    }
};

// ========================================
// INICIALIZAÇÃO QUANDO O DOM ESTIVER PRONTO
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});