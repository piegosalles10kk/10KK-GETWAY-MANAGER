// public/script.js

// === Configuração e Variáveis Globais ===

// NOVO: URL BASE DO GATEWAY
const BASE_GATEWAY_URL = 'https://piegosalles-backend.cloud/'; 

const API_BASE_URL = window.location.origin;
// CORREÇÃO: A base da API de Autenticação agora é APENAS /api
const AUTH_API = `${API_BASE_URL}/api`; 
const ADMIN_API = `${API_BASE_URL}/admin/routes`;
const ADMIN_DISCOVER_API = `${API_BASE_URL}/admin/discover`; 

let TOKEN = localStorage.getItem('token') || null;

// Cache local
let routesCache = []; 
let availablePorts = [];

// --- Elementos DOM ---
const views = {
    login: document.getElementById('login-view'),
    firstAccess: document.getElementById('first-access-view'),
    requestReset: document.getElementById('request-reset-view'),
    resetPassword: document.getElementById('reset-password-view'),
    dashboard: document.getElementById('dashboard-view'),
};

const forms = {
    login: document.getElementById('login-form'),
    firstAccess: document.getElementById('first-access-form'),
    requestReset: document.getElementById('request-reset-form'),
    resetPassword: document.getElementById('reset-password-form'),
};

const messages = {
    login: document.getElementById('login-message'),
    firstAccess: document.getElementById('first-access-message'),
    requestReset: document.getElementById('request-reset-message'),
    resetPassword: document.getElementById('reset-password-message'),
};

const authElements = {
    forgotPasswordLink: document.getElementById('forgot-password-link'),
    backToLoginFromRequest: document.getElementById('back-to-login-from-request'),
    resetTokenField: document.getElementById('reset-token-field'),
    resetInfo: document.getElementById('reset-info'),
    newPasswordInput: document.getElementById('new-password'),
    confirmNewPasswordInput: document.getElementById('confirm-new-password'),
    authControls: document.querySelector('.auth-controls')
};

// Outros Elementos
const routeForm = document.getElementById('route-form'); 
const routeTableBody = document.getElementById('route-table-body');
const themeToggle = document.getElementById('checkbox'); 

// NOVO: Elemento para alternar o modo de criação (local vs. externo)
const modeToggle = document.getElementById('mode-toggle'); 

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


// === LÓGICA DO TEMA (DARK MODE) ===

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


// === FUNÇÕES DE UTILIDADE E NAVEGAÇÃO ===

/**
 * Exibe um modal customizado.
 */
const showModal = (type, title, message) => {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    
    const iconClass = type === 'success' ? 'fas fa-check-circle' : 'fas fa-times-circle';
    modalIcon.className = `modal-icon ${type}`; 
    modalIcon.innerHTML = `<i class="${iconClass}"></i>`;
    
    customModal.classList.add('visible');
    customModal.classList.remove('hidden');

    const closeModal = () => {
        customModal.classList.remove('visible');
        customModal.classList.add('hidden');
        modalCloseBtn.removeEventListener('click', closeModal);
    };
    
    modalCloseBtn.addEventListener('click', closeModal);
};

/**
 * Esconde todas as views e mostra a view desejada.
 */
const showView = (viewName) => {
    Object.values(views).forEach(view => view.classList.add('hidden'));
    views[viewName]?.classList.remove('hidden');
    
    // Mostra/Esconde controles de autenticação/tema
    if (viewName === 'dashboard') {
        authElements.authControls.classList.remove('hidden');
    } else {
        authElements.authControls.classList.add('hidden');
    }
};

/**
 * Função utilitária para chamadas à API, tratando tokens e erros.
 */
const makeApiCall = async (url, method = 'GET', data = null, needsAuth = false) => {
    const headers = {
        'Content-Type': 'application/json',
    };

    if (needsAuth && TOKEN) {
        headers['Authorization'] = `Bearer ${TOKEN}`;
    }

    const config = { method, headers, body: data ? JSON.stringify(data) : null };

    try {
        const response = await fetch(url, config);
        const result = await response.json();

        if (response.status === 401 || response.status === 403) {
            // Se for chamada autenticada e falhar, desloga
            if (needsAuth) {
                logout();
            }
            // Retorna o erro, mesmo que o logout já tenha ocorrido
            return { error: true, message: result.message || "Acesso negado ou sessão expirada." };
        }

        if (!response.ok) {
            throw new Error(result.message || result.error || 'Erro desconhecido');
        }

        return result;

    } catch (error) {
        console.error("Erro na API:", error);
        // Trata erros de rede
        if (error.message.includes('Failed to fetch')) {
             return { error: true, message: "Erro de conexão com o servidor. Verifique se o backend está rodando." };
        }
        return { error: true, message: error.message };
    }
};


// === LÓGICA DE AUTENTICAÇÃO E PRIMEIRO ACESSO ===

/**
 * 1. Verifica se há um token de reset na URL e navega para a view correta.
 */
const checkUrlForResetToken = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
        showView('resetPassword');
        authElements.resetTokenField.value = token;
        
        // Chamada: /api/password-reset/validate/:token
        const result = await makeApiCall(`${AUTH_API}/password-reset/validate/${token}`);

        if (result.error || !result.valid) {
            const message = result.message || 'Token inválido, expirado ou já utilizado.';
            showModal('error', '⚠️ Token Inválido', message);
            // Limpa o token da URL e volta para o login
            window.history.pushState({}, document.title, window.location.pathname);
            showView('login'); 
        } else {
            authElements.resetInfo.innerHTML = `Redefina a senha para o email: <strong>${result.email}</strong>`;
            messages.resetPassword.textContent = result.message;
        }
        return true;
    }
    return false;
};

/**
 * 2. Verifica status inicial do sistema e autentica.
 */
const checkAuth = async () => {
    // Se há token, tenta ir para o dashboard (assumindo que o token é válido)
    if (TOKEN) {
        showView('dashboard');
        loadDashboardData(); 
        return;
    }

    // Se a URL contiver um token de reset, processa a redefinição
    if (await checkUrlForResetToken()) {
        return;
    }

    // Verifica o status do primeiro acesso
    try {
        // Chamada: /api/first-access
        const result = await makeApiCall(`${AUTH_API}/first-access`);

        if (result.needsRegistration) {
            showView('firstAccess');
        } else {
            showView('login');
        }
    } catch (error) {
        // Erro de conexão com o backend
        showModal('error', '❌ Erro de Conexão', 'Não foi possível se conectar ao backend. Verifique o servidor.');
        showView('login');
    }
};

/**
 * 3. Trata o registro do primeiro usuário.
 */
forms.firstAccess.addEventListener('submit', async (e) => {
    e.preventDefault();
    displayMessage(messages.firstAccess, 'Registrando...', false);

    const name = document.getElementById('fa-name').value;
    const email = document.getElementById('fa-email').value;
    const username = document.getElementById('fa-username').value;
    const password = document.getElementById('fa-password').value;

    // Chamada: /api/register-first
    const result = await makeApiCall(`${AUTH_API}/register-first`, 'POST', { name, email, username, password });

    if (!result.error) {
        displayMessage(messages.firstAccess, result.message, false);
        // Redireciona para o login
        setTimeout(() => {
            showView('login');
            displayMessage(messages.login, "Administrador registrado. Faça login.", false);
        }, 3000);
    } else {
        displayMessage(messages.firstAccess, result.message, true);
    }
});

/**
 * 4. Trata o Login.
 */
forms.login.addEventListener('submit', async (e) => {
    e.preventDefault();
    displayMessage(messages.login, 'Entrando...', false);

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Chamada: /api/login
    const result = await makeApiCall(`${AUTH_API}/login`, 'POST', { username, password });

    if (!result.error) {
        TOKEN = result.token; 
        localStorage.setItem('token', TOKEN);
        displayMessage(messages.login, '', false);
        showView('dashboard');
        loadDashboardData();
    } else {
        displayMessage(messages.login, result.message || 'Erro de login.', true);
    }
});

/**
 * 5. Logout.
 */
const logout = () => {
    TOKEN = null;
    localStorage.removeItem('token');
    showView('login');
    forms.login.reset();
};


// === FLUXO DE RECUPERAÇÃO DE SENHA ===

/**
 * Navega para a view de solicitação de reset.
 */
authElements.forgotPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    showView('requestReset');
    messages.requestReset.textContent = '';
});

/**
 * Volta da solicitação de reset para a view de login.
 */
authElements.backToLoginFromRequest.addEventListener('click', (e) => {
    e.preventDefault();
    showView('login');
    messages.login.textContent = '';
});

/**
 * 6. Trata a solicitação de recuperação de senha.
 */
forms.requestReset.addEventListener('submit', async (e) => {
    e.preventDefault();
    displayMessage(messages.requestReset, 'Enviando link...', false);

    const email = document.getElementById('reset-email').value;

    // Chamada: /api/password-reset/request
    const result = await makeApiCall(`${AUTH_API}/password-reset/request`, 'POST', { email });

    if (!result.error) {
        displayMessage(messages.requestReset, result.message, false);
    } else {
          // Se houve erro de rede/conexão, exibe o erro
        displayMessage(messages.requestReset, result.message, true);
    }
});

/**
 * 7. Trata a redefinição de senha.
 */
forms.resetPassword.addEventListener('submit', async (e) => {
    e.preventDefault();
    displayMessage(messages.resetPassword, 'Redefinindo senha...', false);

    const token = authElements.resetTokenField.value;
    const newPassword = authElements.newPasswordInput.value;
    const confirmNewPassword = authElements.confirmNewPasswordInput.value;

    if (newPassword !== confirmNewPassword) {
        displayMessage(messages.resetPassword, 'As senhas não coincidem.', true);
        return;
    }
    
    if (newPassword.length < 6) {
        displayMessage(messages.resetPassword, 'A senha deve ter no mínimo 6 caracteres.', true);
        return;
    }

    // Chamada: /api/password-reset/reset
    const result = await makeApiCall(`${AUTH_API}/password-reset/reset`, 'POST', { token, newPassword });

    if (!result.error) {
        displayMessage(messages.resetPassword, result.message, false);
        showModal('success', '✅ Sucesso!', result.message + ' Redirecionando para login...');
        
        // Redireciona para o login após o sucesso e limpa o token da URL
        setTimeout(() => {
            showView('login');
            window.history.pushState({}, document.title, window.location.pathname); 
            messages.login.textContent = '';
        }, 4000);
    } else {
        displayMessage(messages.resetPassword, result.message, true);
    }
});

// Helper para exibir mensagens de formulário (login, firstAccess, etc.)
const displayMessage = (element, message, isError = false) => {
    element.textContent = message;
    element.className = isError ? 'error-message' : 'success-message';
};


// === LÓGICA DO DASHBOARD E CRUD DE ROTAS ===

const fetchRoutes = async () => {
    // Rota de Admin: /admin/routes (não muda)
    return makeApiCall(ADMIN_API, 'GET', null, true); 
};

const loadAvailablePorts = async () => {
    // Rota de Admin: /admin/discover (não muda)
    const result = await makeApiCall(ADMIN_DISCOVER_API, 'GET', null, true); 
    if (result.error) {
        console.error("Erro ao descobrir portas:", result.message);
        availablePorts = [];
        return;
    }
    availablePorts = result;
    renderRouteForm();
};

const loadDashboardData = async () => {
    const routes = await fetchRoutes();
    if (routes.error) return;
    
    routesCache = routes; 

    await loadAvailablePorts();
    
    // Atualiza os cards
    totalRoutesCard.textContent = routes.length;
    // O is_healthy é um bom indicador para a contagem de portas usadas/online
    usedPortsCard.textContent = routes.filter(r => r.is_healthy).length; 
    availablePortsCard.textContent = availablePorts.length; 
    
    renderRoutesTable(routesCache);
    
    const searchInput = document.getElementById('route-search');
    if (searchInput) {
        searchInput.value = '';
    }
};

const renderRouteForm = (routeToEdit = null) => {
    routeForm.innerHTML = ''; 
    
    // NOVO: Define o modo de criação: false (Dinâmico/Porta) | true (Externo/URL)
    const isExternalMode = routeToEdit ? false : (modeToggle ? modeToggle.checked : false);

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
            <input type="url" id="target_url" placeholder="URL Destino (http://host:3000 ou URL Externa)" value="${routeToEdit.target_url}" required>
            <input type="number" id="check_port" placeholder="Porta p/ Health Check (0 para Externo)" value="${routeToEdit.check_port}" required>
            <div class="form-actions">
                <button type="submit" id="submit-btn-edit" class="action-btn primary-btn">Salvar Edição</button>
                <button type="button" id="cancel-btn-form" class="secondary-btn action-btn">Cancelar Edição</button>
            </div>
        `;
        document.getElementById('cancel-btn-form').addEventListener('click', handleCancelEdit);
        return;
    }

    // Modo de CRIAÇÃO

    if (isExternalMode) {
        // NOVO: MODO DE CRIAÇÃO EXTERNA (URL COMPLETA)
        routeForm.innerHTML += `
            <input type="text" id="route_path" placeholder="Caminho (ex: /api/externa)" required>
            <input type="url" id="target_url" placeholder="URL Destino COMPLETA (ex: https://api.terceiros.com/v1)" required>
            <input type="hidden" id="check_port" value="0"> <button type="submit" id="submit-btn-create" class="action-btn primary-btn">Adicionar Rota Externa</button>
        `;

    } else if (availablePorts.length > 0) {
        // MODO CRIAÇÃO DINÂMICA (Porta Local)
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
        // Mensagem de erro se não houver portas ativas E não estiver em modo externo
        routeForm.innerHTML += `
            <p class="error-message">Nenhum serviço ativo e não registrado foi encontrado nas portas monitoradas.</p>
            <p>Inicie um microserviço e atualize a página.</p>
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
        
        // NOVO: Torna o caminho clicável
        const fullRouteUrl = `${BASE_GATEWAY_URL}${route_path.startsWith('/') ? route_path.substring(1) : route_path}`;
        const routePathDisplay = route_path 
            ? `<a href="${fullRouteUrl}" target="_blank" class="route-link">${BASE_GATEWAY_URL}<b>${route_path}</b></a>`
            : 'N/A';
            
        // NOVO: Mostra o URL de destino na coluna da URL
        const targetUrlDisplay = check_port == 0 ? `(EXT) ${target_url}` : target_url;

        const row = routeTableBody.insertRow();
        row.innerHTML = `
            <td><span class="status-dot ${statusClass}"></span>${statusText}</td>
            <td><strong>${name}</strong></td> 
            <td>${routePathDisplay}</td>
            <td>${targetUrlDisplay}</td>
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
    const checkPortElement = document.getElementById('check_port');
    
    let data = { name }; 
    let result;

    if (id) {
        // MODO EDIÇÃO
        data.route_path = document.getElementById('route_path').value;
        data.target_url = document.getElementById('target_url').value;
        data.check_port = parseInt(checkPortElement.value, 10);
        data.is_active = true;
        
        result = await makeApiCall(`${ADMIN_API}/${id}`, 'PUT', data, true);

    } else {
        // MODO CRIAÇÃO

        if (!checkPortElement || checkPortElement.value === "") {
            showModal('error', 'Atenção!', "Selecione uma porta ativa ou mude para o modo URL Externa e preencha os campos.");
            return;
        }

        const checkPortValue = parseInt(checkPortElement.value, 10);

        if (checkPortValue === 0) {
             // MODO CRIAÇÃO EXTERNA
             data.route_path = document.getElementById('route_path').value;
             data.target_url = document.getElementById('target_url').value;
             data.check_port = 0; // Marcar como 0
             data.is_active = true; 
        } else {
            // MODO CRIAÇÃO DINÂMICA (Porta Local)
            data.check_port = checkPortValue;
        }

        // Validação adicional para o modo externo
        if (checkPortValue === 0 && (!data.route_path || !data.target_url)) {
             showModal('error', 'Atenção!', "Caminho da Rota e URL Destino são obrigatórios para rotas externas.");
             return;
        }
        
        result = await makeApiCall(ADMIN_API, 'POST', data, true); 
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
    if (!confirm("Tem certeza que deseja excluir esta rota? Isso a removerá do Gateway.")) return;

    const result = await makeApiCall(`${ADMIN_API}/${id}`, 'DELETE', null, true); // Requer Autenticação

    if (!result.error) {
        showModal('success', 'Sucesso!', result.message);
        loadDashboardData();
    } else {
        showModal('error', 'Erro ao Excluir', result.message);
    }
};


// === INICIALIZAÇÃO E EVENT LISTENERS GERAIS ===

// 1. Theme Toggle
themeToggle.addEventListener('change', toggleTheme);

// 2. Login/Logout
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
    checkAuth(); // Inicia a verificação de status do sistema
    
    // NOVO: Listener para o Toggle Mode
    if (modeToggle) {
        modeToggle.addEventListener('change', () => {
            renderRouteForm(); // Redesenha o formulário ao mudar o modo
        });
    }
    
    const searchInput = document.getElementById('route-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterRoutes(e.target.value);
        });
    }
});