// src/controllers/admin.controller.js
const Route = require('../models/Route');
const portscanner = require('portscanner');
const { setupGatewayRoutes } = require('./proxy.controller'); 

// --- Configuração Centralizada do Host ---
const getHostAddress = () => process.env.PORT_CHECK_HOST || '127.0.0.1';


// --- Funções de Ajuda ---

const generateRandomPath = (length = 8) => {
    return Math.random().toString(36).substring(2, 2 + length);
};

/**
 * NOVA FUNÇÃO: Valida se uma URL é externa e válida
 */
const isValidExternalUrl = (url) => {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch (e) {
        return false;
    }
};

/**
 * Gera um array de portas de 1 a 5000 e adiciona portas específicas.
 * A porta 8000 (Gateway) e 27017 (MongoDB) são excluídas da lista de escaneamento.
 */
const generatePortScanRange = (limit = 5000) => {
    const ports = [];
    const PORTS_TO_EXCLUDE = [8000, 27017];
    const ADDITIONAL_PORTS = [19768]; // Sua porta do aaPanel

    // 1. Gera o range de 1 a 5000
    for (let i = 1; i <= limit; i++) { 
        if (!PORTS_TO_EXCLUDE.includes(i)) {
            ports.push(i);
        }
    }

    // 2. Adiciona portas específicas que estão fora do range (ex: 19768)
    ADDITIONAL_PORTS.forEach(port => {
        if (!ports.includes(port) && !PORTS_TO_EXCLUDE.includes(port)) {
            ports.push(port);
        }
    });

    return ports;
};

// --- Checagem de Saúde (Health Check) ---
const checkRouteHealth = async (routes) => {
    const HOST = getHostAddress();
    
    // Mapeia e executa todas as checagens em paralelo
    const routesWithHealth = await Promise.all(routes.map(async (route) => {
        let isHealthy = false;
        
        // AJUSTE: Rotas externas (check_port = 0) são sempre marcadas como healthy
        if (route.check_port === 0) {
            isHealthy = true;
        } else if (route.is_active && route.check_port) {
            try {
                // Checa a porta no Host usando o endereço correto
                const status = await portscanner.checkPortStatus(route.check_port, HOST);
                isHealthy = (status === 'open');
            } catch (e) {
                isHealthy = false; 
            }
        }

        // Retorna a rota com o novo campo 'is_healthy'
        return { 
            ...route.toObject(),
            is_healthy: isHealthy 
        };
    }));

    return routesWithHealth;
};


// --- CRUD DE ROTAS: Descoberta de Portas (Alterado) ---
const discoverAvailablePorts = async (req, res) => {
    try {
        // NOVO: Escaneia portas de 1 a 5000 + a porta 19768
        const ALL_PORTS_TO_CHECK = generatePortScanRange(5000); 
        const HOST = getHostAddress();
        
        const registeredRoutes = await Route.find().select('check_port');
        const registeredPorts = registeredRoutes.map(r => Number(r.check_port)); 
        
        const availableActivePorts = [];

        // Inicia o escaneamento sequencial das 5000+ portas
        for (const port of ALL_PORTS_TO_CHECK) {
            
            if (registeredPorts.includes(port)) {
                continue; 
            }
            
            const status = await portscanner.checkPortStatus(port, HOST);
            
            if (status === 'open') {
                availableActivePorts.push(port);
            }
        }

        res.status(200).json(availableActivePorts);

    } catch (error) {
        console.error("Erro na descoberta de portas:", error);
        res.status(500).json({ message: "Erro ao escanear portas." });
    }
};


/**
 * CREATE - Cria nova rota (Dinâmica ou Externa)
 */
const createRoute = async (req, res) => {
    try {
        const { name, check_port, route_path, target_url } = req.body;
        
        // Validação: Nome é obrigatório
        if (!name || !name.trim()) {
            return res.status(400).json({ message: "O nome da rota é obrigatório." });
        }
        
        // Validação: check_port é obrigatório
        if (check_port === undefined || check_port === null) {
            return res.status(400).json({ message: "A porta de verificação é obrigatória." });
        }
        
        const portNumber = parseInt(check_port, 10);
        
        // Validação: check_port deve ser número válido
        if (isNaN(portNumber) || portNumber < 0) {
            return res.status(400).json({ message: "Porta inválida." });
        }
        
        // ==========================================
        // MODO 1: ROTA EXTERNA (check_port = 0)
        // ==========================================
        if (portNumber === 0) {
            // Validações específicas para rota externa
            if (!route_path || !route_path.trim()) {
                return res.status(400).json({ message: "O caminho da rota é obrigatório para rotas externas." });
            }
            
            if (!target_url || !target_url.trim()) {
                return res.status(400).json({ message: "A URL de destino é obrigatória para rotas externas." });
            }
            
            // Valida formato da URL externa
            if (!isValidExternalUrl(target_url)) {
                return res.status(400).json({ 
                    message: "URL de destino inválida. Use formato completo: http:// ou https://" 
                });
            }
            
            // Normaliza o caminho da rota
            let normalizedPath = route_path.trim();
            if (!normalizedPath.startsWith('/')) {
                normalizedPath = '/' + normalizedPath;
            }
            
            // Checagem de conflito de caminho
            const existingPath = await Route.findOne({ route_path: normalizedPath });
            if (existingPath) {
                return res.status(400).json({ 
                    message: `O caminho "${normalizedPath}" já está em uso pela rota "${existingPath.name}".` 
                });
            }
            
            // Checagem de conflito de nome
            const existingName = await Route.findOne({ name: name.trim() });
            if (existingName) {
                return res.status(400).json({ 
                    message: `O nome "${name}" já está em uso.` 
                });
            }
            
            // Cria rota externa
            const newRoute = new Route({
                name: name.trim(),
                route_path: normalizedPath,
                target_url: target_url.trim(),
                check_port: 0, // Marca como externa
                is_active: true,
                is_healthy: true // Rotas externas sempre healthy
            });
            
            await newRoute.save();
            await setupGatewayRoutes({ PORT_CHECK_HOST: getHostAddress() });
            
            return res.status(201).json({
                message: `Rota externa "${name}" criada e Gateway reiniciado com sucesso.`,
                route: newRoute
            });
        }
        
        // ==========================================
        // MODO 2: ROTA DINÂMICA (check_port > 0)
        // ==========================================
        
        // Checagem de conflito de nome
        const existingName = await Route.findOne({ name: name.trim() });
        if (existingName) {
            return res.status(400).json({ 
                message: `O nome "${name}" já está em uso.` 
            });
        }
        
        // Checagem de conflito de porta
        const existingPort = await Route.findOne({ check_port: portNumber });
        if (existingPort) {
            return res.status(400).json({ 
                message: `A porta ${portNumber} já está registrada na rota "${existingPort.name}" (${existingPort.route_path}).` 
            });
        }
        
        // Gera caminho aleatório
        const newRoutePath = generateRandomPath();
        const generatedPath = `/service/${newRoutePath}`;
        
        // Monta a URL de destino com o host local
        const newTargetUrl = `http://${getHostAddress()}:${portNumber}`;
        
        // Cria rota dinâmica
        const newRoute = new Route({
            name: name.trim(),
            route_path: generatedPath,
            target_url: newTargetUrl,
            check_port: portNumber,
            is_active: true
        });
        
        await newRoute.save();
        await setupGatewayRoutes({ PORT_CHECK_HOST: getHostAddress() });
        
        return res.status(201).json({
            message: `Rota dinâmica "${name}" criada e Gateway reiniciado com sucesso.`,
            route: newRoute
        });
        
    } catch (err) {
        console.error('Erro ao criar rota:', err);
        res.status(500).json({ 
            message: "Erro ao criar rota.", 
            error: err.message 
        });
    }
};


// --- CRUD DE ROTAS: READ ---

const getAllRoutes = async (req, res) => {
    try {
        const routes = await Route.find();
        
        const routesWithHealth = await checkRouteHealth(routes);

        res.status(200).json(routesWithHealth);
    } catch (err) {
        res.status(500).json({ message: "Erro ao buscar rotas.", error: err.message });
    }
};

const getRouteById = async (req, res) => {
    try {
        const route = await Route.findById(req.params.id);
        if (!route) {
            return res.status(404).json({ message: "Rota não encontrada." });
        }
        res.status(200).json(route);
    } catch (err) {
        res.status(500).json({ message: "Erro ao buscar rota.", error: err.message });
    }
};


// --- CRUD DE ROTAS: UPDATE (Corrigido para Rotas Externas) ---

const updateRoute = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, route_path, target_url, check_port, is_active } = req.body;
        
        // Busca a rota existente
        const existingRoute = await Route.findById(id);
        if (!existingRoute) {
            return res.status(404).json({ message: "Rota não encontrada." });
        }
        
        // Validações básicas
        if (!name || !name.trim()) {
            return res.status(400).json({ message: "O nome da rota é obrigatório." });
        }
        
        if (!route_path || !route_path.trim()) {
            return res.status(400).json({ message: "O caminho da rota é obrigatório." });
        }
        
        if (!target_url || !target_url.trim()) {
            return res.status(400).json({ message: "A URL de destino é obrigatória." });
        }
        
        if (check_port === undefined || check_port === null) {
            return res.status(400).json({ message: "A porta de verificação é obrigatória." });
        }
        
        const portNumber = parseInt(check_port, 10);
        
        if (isNaN(portNumber) || portNumber < 0) {
            return res.status(400).json({ message: "Porta inválida." });
        }
        
        // Se for rota externa (porta 0), valida a URL
        if (portNumber === 0 && !isValidExternalUrl(target_url)) {
            return res.status(400).json({ 
                message: "URL de destino inválida. Use formato completo: http:// ou https://" 
            });
        }
        
        // Normaliza o caminho
        let normalizedPath = route_path.trim();
        if (!normalizedPath.startsWith('/')) {
            normalizedPath = '/' + normalizedPath;
        }
        
        // Checagem de conflito de nome (exceto a própria rota)
        const nameConflict = await Route.findOne({ 
            name: name.trim(), 
            _id: { $ne: id } 
        });
        if (nameConflict) {
            return res.status(400).json({ 
                message: `O nome "${name}" já está em uso por outra rota.` 
            });
        }
        
        // Checagem de conflito de caminho (exceto a própria rota)
        const pathConflict = await Route.findOne({ 
            route_path: normalizedPath, 
            _id: { $ne: id } 
        });
        if (pathConflict) {
            return res.status(400).json({ 
                message: `O caminho "${normalizedPath}" já está em uso pela rota "${pathConflict.name}".` 
            });
        }
        
        // Checagem de conflito de porta (exceto a própria rota e se não for externa)
        if (portNumber > 0) {
            const portConflict = await Route.findOne({ 
                check_port: portNumber, 
                _id: { $ne: id } 
            });
            if (portConflict) {
                return res.status(400).json({ 
                    message: `A porta ${portNumber} já está registrada na rota "${portConflict.name}".` 
                });
            }
        }
        
        // Atualiza a rota
        existingRoute.name = name.trim();
        existingRoute.route_path = normalizedPath;
        existingRoute.target_url = target_url.trim();
        existingRoute.check_port = portNumber;
        existingRoute.is_active = is_active !== undefined ? is_active : true;
        
        // Se mudou para rota externa, marca como healthy
        if (portNumber === 0) {
            existingRoute.is_healthy = true;
        }
        
        await existingRoute.save();
        await setupGatewayRoutes({ PORT_CHECK_HOST: getHostAddress() });
        
        res.status(200).json({
            message: `Rota "${name}" atualizada e Gateway reiniciado com sucesso.`,
            route: existingRoute
        });
        
    } catch (err) {
        console.error('Erro ao atualizar rota:', err);
        res.status(500).json({ 
            message: "Erro ao atualizar rota.", 
            error: err.message 
        });
    }
};


// --- CRUD DE ROTAS: DELETE ---

const deleteRoute = async (req, res) => {
    try {
        const deletedRoute = await Route.findByIdAndDelete(req.params.id);

        if (!deletedRoute) {
            return res.status(404).json({ message: "Rota não encontrada." });
        }
        
        await setupGatewayRoutes({ PORT_CHECK_HOST: getHostAddress() });

        res.status(200).json({ message: "Rota deletada e Gateway reiniciado com sucesso." });
    } catch (err) {
        res.status(500).json({ message: "Erro ao deletar rota.", error: err.message });
    }
};


module.exports = {
    discoverAvailablePorts, 
    createRoute,             
    getAllRoutes, 
    getRouteById,
    updateRoute,
    deleteRoute
};