// public/script.js

const API_BASE_URL = window.location.origin;
const ADMIN_API = `${API_BASE_URL}/admin/routes`;
const ADMIN_DISCOVER_API = `${API_BASE_URL}/admin/discover`; 
const LOGIN_API = `${API_BASE_URL}/api/login`;

let TOKEN = localStorage.getItem('token') || null;

// Cache local
let routesCache = []; 
let availablePorts = [];

// --- Elementos DOM ---
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');
const routeForm = document.getElementById('route-form'); 
const routeTableBody = document.getElementById('route-table-body');
const themeToggle = document.getElementById('checkbox'); 

// Modal Elements
const customModal = document.getElementById('custom-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalIcon = document.getElementById('modal-icon');
const modalCloseBtn = document.getElementById('modal-close-btn');

// Dashboard Cards
const usedPortsCard = document.getElementById('used-ports');
const availablePortsCard = document.getElementById('available-ports');
const totalRoutesCard = document.getElementById('total-routes');


// --- LÓGICA DO TEMA (DARK MODE) ---

const initializeTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.checked = true;
    } else {
        document.body.classList.remove('dark-mode');
        themeToggle.checked = false;
    }
};

const toggleTheme = () => {
    if (themeToggle.checked) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
    }
};

// --- FUNÇÕES DE UTILIDADE E MODAL ---

/**
 * Exibe um modal customizado para sucesso ou erro.
 * @param {string} type 'success' ou 'error'
 * @param {string} title Título da mensagem
 * @param {string} message Conteúdo da mensagem
 */
const showModal = (type, title, message) => {
    // 1. Configura o conteúdo
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    
    // 2. Configura o ícone
    const iconClass = type === 'success' ? 'fas fa-check-circle' : 'fas fa-times-circle';
    modalIcon.className = `modal-icon ${type}`; 
    modalIcon.innerHTML = `<i class="${iconClass}"></i>`;
    
    // 3. Exibe o modal
    customModal.classList.add('visible');
    customModal.classList.remove('hidden');

    // 4. Adiciona listener de fechamento
    const closeModal = () => {
        customModal.classList.remove('visible');
        customModal.classList.add('hidden');
        modalCloseBtn.removeEventListener('click', closeModal);
    };
    
    modalCloseBtn.addEventListener('click', closeModal);
};


const showView = (viewId) => {
    if (viewId === 'login') {
        loginView.classList.remove('hidden');
        dashboardView.classList.add('hidden');
    } else {
        loginView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        loadDashboardData();
    }
};

const makeApiCall = async (url, method = 'GET', data = null) => {
    const headers = {
        'Content-Type': 'application/json',
    };

    const config = { method, headers, body: data ? JSON.stringify(data) : null };

    try {
        const response = await fetch(url, config);
        const result = await response.json();

        if (response.status === 401 || response.status === 403) {
            logout();
            return { error: true, message: "Sessão expirada. Faça login novamente." };
        }

        if (!response.ok) {
            throw new Error(result.message || result.error || 'Erro desconhecido');
        }

        return result;

    } catch (error) {
        console.error("Erro na API:", error);
        return { error: true, message: error.message };
    }
};

// --- 1. LÓGICA DE AUTENTICAÇÃO ---

const checkAuth = () => {
    if (TOKEN) {
        showView('dashboard');
    } else {
        showView('login');
    }
};

const login = async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    loginMessage.textContent = 'Autenticando...';

    const result = await makeApiCall(LOGIN_API, 'POST', { username, password });

    if (result.error) {
        loginMessage.textContent = result.message;
    } else {
        TOKEN = result.token; 
        localStorage.setItem('token', TOKEN);
        loginMessage.textContent = '';
        showView('dashboard');
    }
};

const logout = () => {
    TOKEN = null;
    localStorage.removeItem('token');
    showView('login');
    loginForm.reset();
};

// --- 2. DESCOBERTA DE SERVIÇOS E RENDERIZAÇÃO DE FORMULÁRIO ---

const fetchRoutes = async () => {
    const result = await makeApiCall(ADMIN_API); 
    return result;
};

const loadAvailablePorts = async () => {
    const result = await makeApiCall(ADMIN_DISCOVER_API); 
    if (result.error) {
        console.error("Erro ao descobrir portas:", result.message);
        availablePorts = [];
        return;
    }
    availablePorts = result;
    renderRouteForm();
};

const renderRouteForm = (routeToEdit = null) => {
    routeForm.innerHTML = ''; 
    
    const nameValue = routeToEdit ? routeToEdit.name : '';
    const namePlaceholder = routeToEdit ? 'Nome da Rota' : 'Nome (ex: Service Produtos)';
    
    routeForm.innerHTML = `
        <input type="hidden" id="route-id" value="${routeToEdit ? routeToEdit._id : ''}">
        <input type="text" id="route_name" placeholder="${namePlaceholder}" value="${nameValue}" required>
    `;

    // Modo de EDIÇÃO
    if (routeToEdit) {
        routeForm.innerHTML += `
            <input type="text" id="route_path" placeholder="Caminho (ex: /api/service)" value="${routeToEdit.route_path}" required>
            <input type="url" id="target_url" placeholder="URL Destino (http://host:3000)" value="${routeToEdit.target_url}" required>
            <input type="number" id="check_port" placeholder="Porta p/ Health Check (3000)" value="${routeToEdit.check_port}" required>
            <div class="form-actions">
                <button type="submit" id="submit-btn-edit" class="action-btn primary-btn">Salvar Edição</button>
                <button type="button" id="cancel-btn-form" class="secondary-btn action-btn">Cancelar Edição</button>
            </div>
        `;
        document.getElementById('cancel-btn-form').addEventListener('click', handleCancelEdit);
        return;
    }

    // Modo de CRIAÇÃO DINÂMICA
    if (availablePorts.length > 0) {
        const defaultText = availablePorts.length > 0 
            ? 'Clique para selecionar um serviço ativo...'
            : 'Nenhum serviço ativo e não registrado foi encontrado.';
        
        routeForm.innerHTML += `
            <input type="hidden" id="check_port" value="">
            <div class="custom-select-container">
                <div class="custom-select-trigger">
                    <span id="selected-port-display">${defaultText}</span>
                    <i class="fas fa-chevron-down arrow"></i>
                </div>
                <div class="custom-options">
                    </div>
            </div>
            <button type="submit" id="submit-btn-create" class="action-btn primary-btn">Adicionar Rota Dinâmica</button>
        `;
        
        const optionsContainer = routeForm.querySelector('.custom-options');
        availablePorts.forEach(port => {
            const optionDiv = document.createElement('div');
            optionDiv.classList.add('custom-option');
            optionDiv.setAttribute('data-value', port);
            optionDiv.innerHTML = `<span class="port-label">Porta ${port}</span><span class="info-text">Serviço Rodando</span>`;
            optionsContainer.appendChild(optionDiv);
        });

        setupCustomDropdown();
    } else {
        routeForm.innerHTML += `
            <p class="error-message">Nenhum serviço ativo e não registrado foi encontrado nas portas monitoradas.</p>
            <p>Inicie um microserviço (ex: mock-service.js na porta 3001) e atualize a página.</p>
        `;
    }
};

const setupCustomDropdown = () => {
    const trigger = document.querySelector('.custom-select-trigger');
    const options = document.querySelector('.custom-options');
    const hiddenPortInput = document.getElementById('check_port');
    const displayElement = document.getElementById('selected-port-display');
    const allOptions = document.querySelectorAll('.custom-option');
    
    trigger.addEventListener('click', () => {
        options.style.display = options.style.display === 'block' ? 'none' : 'block';
        trigger.classList.toggle('active');
    });

    allOptions.forEach(option => {
        option.addEventListener('click', () => {
            const port = option.getAttribute('data-value');
            hiddenPortInput.value = port;
            displayElement.textContent = `Porta ${port} (Selecionada)`;
            
            allOptions.forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            
            options.style.display = 'none';
            trigger.classList.remove('active');
        });
    });

    document.addEventListener('click', (e) => {
        if (!trigger || !options) return;
        if (!trigger.contains(e.target) && !options.contains(e.target)) {
            options.style.display = 'none';
            trigger.classList.remove('active');
        }
    });
};


// --- 3. LÓGICA DO DASHBOARD E BUSCA ---

const loadDashboardData = async () => {
    const routes = await fetchRoutes();
    if (routes.error) return;
    
    routesCache = routes; 

    await loadAvailablePorts();
    
    // Atualiza os cards
    totalRoutesCard.textContent = routes.length;
    usedPortsCard.textContent = routes.filter(r => r.is_healthy).length; 
    availablePortsCard.textContent = availablePorts.length; 
    
    renderRoutesTable(routesCache);
    
    // Limpa a busca ao recarregar
    const searchInput = document.getElementById('route-search');
    if (searchInput) {
        searchInput.value = '';
    }
};

const filterRoutes = (searchTerm) => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
    
    if (!lowerCaseSearchTerm) {
        renderRoutesTable(routesCache);
        return;
    }

    const filteredRoutes = routesCache.filter(route => {
        const name = (route.name || '').toLowerCase();
        const routePath = (route.route_path || '').toLowerCase();
        const targetUrl = (route.target_url || '').toLowerCase();
        const checkPort = (route.check_port || '').toString();

        return name.includes(lowerCaseSearchTerm) ||
               routePath.includes(lowerCaseSearchTerm) ||
               targetUrl.includes(lowerCaseSearchTerm) ||
               checkPort.includes(lowerCaseSearchTerm);
    });

    renderRoutesTable(filteredRoutes);
};


// --- 4. RENDERIZAÇÃO E CRUD ---

const renderRoutesTable = (routes) => {
    routeTableBody.innerHTML = ''; 

    if (routes.length === 0) {
        routeTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 20px;">Nenhuma rota encontrada com os filtros atuais.</td></tr>';
        return;
    }

    routes.forEach(route => {
        const { _id, name, route_path, target_url, check_port, is_active, is_healthy } = route; 

        let statusClass = 'gray';
        let statusText = 'Inativa';

        if (is_active) {
            if (is_healthy) { 
                statusClass = 'green';
                statusText = 'Online (Rodando)';
            } else {
                statusClass = 'red';
                statusText = 'Offline (Cadastrada)';
            }
        }

        const row = routeTableBody.insertRow();
        row.innerHTML = `
            <td><span class="status-dot ${statusClass}"></span>${statusText}</td>
            <td><strong>${name}</strong></td> 
            <td>${route_path}</td>
            <td>${target_url}</td>
            <td>${check_port}</td>
            <td>
                <button class="action-btn edit-btn" data-id="${_id}">Editar</button>
                <button class="action-btn delete-btn" data-id="${_id}">Excluir</button>
            </td>
        `;
    });
};


const handleFormSubmit = async (e) => {
    e.preventDefault();

    const id = document.getElementById('route-id').value;
    const name = document.getElementById('route_name').value;
    
    let data = { name }; 
    let result;

    if (id) {
        // MODO EDIÇÃO
        data.route_path = document.getElementById('route_path').value;
        data.target_url = document.getElementById('target_url').value;
        data.check_port = parseInt(document.getElementById('check_port').value, 10);
        data.is_active = true;
        
        result = await makeApiCall(`${ADMIN_API}/${id}`, 'PUT', data);

    } else {
        // MODO CRIAÇÃO DINÂMICA
        const checkPortElement = document.getElementById('check_port');
        if (!checkPortElement || !checkPortElement.value) {
            showModal('error', 'Atenção!', "Selecione uma porta ativa para registrar o serviço.");
            return;
        }

        data.check_port = parseInt(checkPortElement.value, 10);
        
        result = await makeApiCall(ADMIN_API, 'POST', data);
    }


    if (!result.error) {
        const routeName = result.route ? result.route.name : data.name;
        showModal('success', 'Sucesso!', `Rota "${routeName}" salva e Gateway reiniciado.`);
        
        handleCancelEdit();
        loadDashboardData();
    } else {
        showModal('error', 'Erro na Operação', result.message);
    }
};

const handleEdit = (id) => {
    const routeToEdit = routesCache.find(r => r._id === id); 
    if (!routeToEdit) return;

    renderRouteForm(routeToEdit);
};

const handleCancelEdit = () => {
    renderRouteForm(null); 
}

const handleDelete = async (id) => {
    // Mantemos o confirm nativo por ser o único ponto que exige "sim/não"
    if (!confirm("Tem certeza que deseja excluir esta rota? Isso a removerá do Gateway.")) return;

    const result = await makeApiCall(`${ADMIN_API}/${id}`, 'DELETE');

    if (!result.error) {
        showModal('success', 'Sucesso!', result.message);
        loadDashboardData();
    } else {
        showModal('error', 'Erro ao Excluir', result.message);
    }
};


// --- INICIALIZAÇÃO E EVENT LISTENERS ---

// 1. Theme Toggle
themeToggle.addEventListener('change', toggleTheme);

// 2. Login/Logout
loginForm.addEventListener('submit', login);
document.getElementById('logout-button').addEventListener('click', logout);

// 3. CRUD: Delegação de eventos para o formulário e tabela
routeForm.addEventListener('submit', handleFormSubmit);

routeTableBody.addEventListener('click', (e) => {
    const target = e.target;
    const id = target.dataset.id;
    
    if (target.classList.contains('edit-btn')) {
        handleEdit(id);
    } else if (target.classList.contains('delete-btn')) {
        handleDelete(id);
    }
});

// 4. Busca em Tempo Real e Inicialização
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme(); 
    checkAuth();
    
    const searchInput = document.getElementById('route-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterRoutes(e.target.value);
        });
    }
});