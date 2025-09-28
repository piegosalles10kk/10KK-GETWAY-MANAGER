// src/controllers/proxy.controller.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const portscanner = require('portscanner');
const Route = require('../models/Route'); 
const dynamicRouter = express.Router();
let activeRoutesCache = [];

/**
 * Função principal para buscar, verificar a saúde e configurar as rotas.
 * Recebe a configuração PORT_CHECK_HOST via argumento (geralmente do app.js).
 */
const setupGatewayRoutes = async ({ PORT_CHECK_HOST }) => {
    
    // Define o host padrão, usando o argumento passado ou o ENV, com '127.0.0.1' como fallback final.
    const hostToCheck = PORT_CHECK_HOST || process.env.PORT_CHECK_HOST || '127.0.0.1';

    try {
        const newRoutes = await Route.find({ is_active: true });
        
        // Verifica se a lista de rotas mudou
        if (JSON.stringify(newRoutes) === JSON.stringify(activeRoutesCache)) {
            return; 
        }

        console.log(`\n🔄 Recarregando rotas. Rotas ativas encontradas: ${newRoutes.length}.`);
        activeRoutesCache = newRoutes;

        // Limpa o roteador para remover rotas antigas.
        dynamicRouter.stack = []; 

        // Usa Promise.all para executar os health checks em paralelo, melhorando a performance.
        await Promise.all(newRoutes.map(async (route) => {
            const { route_path, target_url, check_port } = route;

            // --- 1. Verificação de Porta (Health Check) ---
            let is_service_running = true;
            if (check_port) {
                // CORREÇÃO: Usa 'hostToCheck' para o portscanner
                const status = await portscanner.checkPortStatus(check_port, hostToCheck); 
                is_service_running = status === 'open';
            }

            if (!is_service_running) {
                console.warn(`[⚠️ INATIVO] Serviço para ${route_path} na porta ${check_port} está fechado. Rota ignorada.`);
                return; 
            }
            
            // --- 2. Configuração e Aplicação do Middleware de Proxy ---
            const proxyOptions = {
                target: target_url,
                changeOrigin: true, 
                // reescreve o caminho: ex: /service/chave/produtos -> /produtos no backend
                pathRewrite: {
                    [`^${route_path}`]: '/', 
                },
                onProxyReq: (proxyReq, req, res) => {
                    console.log(`[PROXY] Redirecionando ${req.method} ${req.originalUrl} para ${target_url}`);
                },
            };

            // Aplica o middleware de proxy no roteador dinâmico.
            dynamicRouter.use(route_path, createProxyMiddleware(proxyOptions));
            console.log(`[✅ ATIVO] Rota configurada: ${route_path} -> ${target_url}`);
        })); // Fim do Promise.all

    } catch (error) {
        console.error("Erro ao carregar e configurar as rotas do Gateway:", error);
    }
};

/**
 * Handler de Fallback 404 (quando nenhuma rota do proxy corresponde).
 */
const notFoundFallback = (req, res) => {
    res.status(404).send({ 
        error: "Route Not Found", 
        message: "A rota solicitada não foi encontrada na API Gateway." 
    });
};


module.exports = { 
    dynamicRouter, 
    setupGatewayRoutes,
    notFoundFallback
};