// src/controllers/admin.controller.js
const Route = require('../models/Route');
const portscanner = require('portscanner');
const { setupGatewayRoutes } = require('./proxy.controller'); 

// --- Configuração Centralizada do Host ---
// Garante que o HOST seja pego da variável de ambiente, com fallback para localhost (127.0.0.1 é preferível)
const getHostAddress = () => process.env.PORT_CHECK_HOST || '127.0.0.1';


// --- Funções de Ajuda ---

const generateRandomPath = (length = 8) => {
    return Math.random().toString(36).substring(2, 2 + length);
};

/**
 * Gera um array de portas de 1 até o limite especificado.
 * O limite de 5000 é usado para cobrir a maioria dos serviços comuns e personalizados.
 */
const generatePortScanRange = (limit = 5000) => {
    const ports = [];
    // Começamos em 1, pois portas muito baixas (ex: 1 a 10) são raras para aplicações
    // mas incluídas para cobrir a faixa de 5000
    for (let i = 1; i <= limit; i++) { 
        // Excluímos portas conhecidas do Gateway/DB para evitar listar a si mesmo
        if (i !== 8000 && i !== 27017) {
            ports.push(i);
        }
    }
    return ports;
};

// --- Checagem de Saúde (Health Check) ---
const checkRouteHealth = async (routes) => {
    const HOST = getHostAddress();
    
    // Mapeia e executa todas as checagens em paralelo
    const routesWithHealth = await Promise.all(routes.map(async (route) => {
        let isHealthy = false;
        
        if (route.is_active && route.check_port) {
            try {
                // Checa a porta no Host usando o endereço correto (vps-host ou 127.0.0.1)
                const status = await portscanner.checkPortStatus(route.check_port, HOST);
                isHealthy = (status === 'open');
            } catch (e) {
                // Em caso de erro de conexão, assume-se que está offline
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
        // NOVO: Escaneia todas as portas de 1 a 5000
        const ALL_PORTS_TO_CHECK = generatePortScanRange(5000); 
        const HOST = getHostAddress();
        
        const registeredRoutes = await Route.find().select('check_port');
        // Converte para Number para garantir comparação correta
        const registeredPorts = registeredRoutes.map(r => Number(r.check_port)); 
        
        const availableActivePorts = [];

        // Esta iteração fará o Health Check em 5000 portas. 
        // O desempenho dependerá da biblioteca portscanner.
        for (const port of ALL_PORTS_TO_CHECK) {
            // Verifica se a porta já está registrada antes de escanear
            if (registeredPorts.includes(port)) {
                continue; 
            }
            
            // O escaneamento da porta é feito no Host (vps-host)
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


// --- CRUD DE ROTAS: CREATE (Corrigido Target URL) ---

const createRoute = async (req, res) => {
    try {
        const { name, check_port } = req.body; 

        if (!check_port || !name) {
             return res.status(400).json({ message: "O nome da rota e a porta para o serviço (check_port) são obrigatórios." });
        }
        
        const newRoutePath = generateRandomPath();
        
        // CORREÇÃO: Usa o endereço HOST real (vps-host ou 127.0.0.1)
        const newTargetUrl = `http://${getHostAddress()}:${check_port}`;
        
        // Checagem de Conflito de Nome
        const existingName = await Route.findOne({ name });
        if(existingName) {
            return res.status(400).json({ message: `O nome "${name}" já está em uso.` });
        }

        // Checagem de Conflito de Porta
        const existingPort = await Route.findOne({ check_port });
        if(existingPort) {
            return res.status(400).json({ message: `A porta ${check_port} já está registrada na rota ${existingPort.route_path}.` });
        }

        const newRoute = new Route({
            name: name, 
            route_path: `/service/${newRoutePath}`, 
            target_url: newTargetUrl,
            check_port: check_port,
            is_active: true
        });
        
        await newRoute.save();
        
        // O setupGatewayRoutes precisa ser atualizado com o HOST correto
        await setupGatewayRoutes({ PORT_CHECK_HOST: getHostAddress() });
        
        res.status(201).json({ 
            message: "Rota criada e Gateway reiniciado com sucesso.", 
            route: newRoute 
        });

    } catch (err) {
        res.status(500).json({ message: "Erro ao criar rota.", error: err.message });
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


// --- CRUD DE ROTAS: UPDATE (Corrigido) ---

const updateRoute = async (req, res) => {
    try {
        // Checa unicidade do nome no update
        if (req.body.name) {
            const existingName = await Route.findOne({ name: req.body.name, _id: { $ne: req.params.id } });
            if (existingName) {
                return res.status(400).json({ message: `O nome "${req.body.name}" já está em uso por outra rota.` });
            }
        }
        
        // Se a porta for alterada, o target_url precisa ser recalculado
        if (req.body.check_port) {
            req.body.target_url = `http://${getHostAddress()}:${req.body.check_port}`;
        }

        const updatedRoute = await Route.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        
        if (!updatedRoute) {
            return res.status(404).json({ message: "Rota não encontrada." });
        }
        
        await setupGatewayRoutes({ PORT_CHECK_HOST: getHostAddress() });

        res.status(200).json({ message: "Rota atualizada e Gateway reiniciado com sucesso.", route: updatedRoute });
    } catch (err) {
        res.status(500).json({ message: "Erro ao atualizar rota.", error: err.message });
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
