// src/controllers/proxy.controller.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const portscanner = require('portscanner');
const Route = require('../models/Route'); 
// 🚨 Importa o pacote necessário para injeção segura de HTML
const injector = require('connect-inject'); 

const dynamicRouter = express.Router();
let activeRoutesCache = [];


/**
 * Função principal para buscar, verificar a saúde e configurar as rotas.
 */
const setupGatewayRoutes = async ({ PORT_CHECK_HOST }) => {
    
    // Define o host padrão (vps-host)
    const hostToCheck = PORT_CHECK_HOST || process.env.PORT_CHECK_HOST || '127.0.0.1';

    try {
        const newRoutes = await Route.find({ is_active: true });
        
        // Evita recarregar se nada mudou
        if (JSON.stringify(newRoutes) === JSON.stringify(activeRoutesCache)) {
            return; 
        }

        console.log(`\n🔄 Recarregando rotas. Rotas ativas encontradas: ${newRoutes.length}.`);
        activeRoutesCache = newRoutes;

        // Limpa o roteador
        dynamicRouter.stack = []; 

        await Promise.all(newRoutes.map(async (route) => {
            const { route_path, target_url, check_port } = route;

            // --- 1. Verificação de Porta ---
            let is_service_running = true;
            if (check_port) {
                const status = await portscanner.checkPortStatus(check_port, hostToCheck); 
                is_service_running = status === 'open';
            }

            if (!is_service_running) {
                console.warn(`[⚠️ INATIVO] Serviço para ${route_path} na porta ${check_port} está fechado. Rota ignorada.`);
                return; 
            }
            
            // --- 2. Configuração e Aplicação do Middleware de Proxy ---
            
            // 🚨 CRÍTICO: Configura o injetor para a rota atual
            // A tag <base> forçará o navegador a usar o prefixo do proxy (/service/backoffice/)
            const basePath = route_path.endsWith('/') ? route_path : route_path + '/';
            const baseTag = `<base href="${basePath}">`;

            // Cria uma instância do injetor de conteúdo
            const injectMiddleware = injector({
                // O conteúdo que será injetado
                snippet: baseTag,
                // Onde o conteúdo será injetado (logo após <head>)
                head: true, 
                // Permite o processamento de respostas já comprimidas (GZIP/Deflate)
                disable: false 
            });

            const proxyOptions = {
                target: target_url,
                
                // Corrige o cabeçalho Host.
                changeOrigin: true, 

                // Remove o prefixo do proxy antes de enviar ao serviço.
                // Ex: /service/backoffice/style.css -> /style.css
                pathRewrite: {
                    [`^${route_path}`]: '', 
                },
                
                // WebSockets
                ws: true,
                
                // 🚨 CRÍTICO: Intercepta a resposta para INJETAR a tag base
                onProxyRes: (proxyRes, req, res) => {
                    // Só injeta em documentos HTML
                    if (proxyRes.headers['content-type'] && proxyRes.headers['content-type'].includes('text/html')) {
                        // Passa o controle para o connect-inject, que lida com GZIP e injeção
                        injectMiddleware(req, res, () => {}); 
                    } else {
                        // Para todos os outros assets (CSS, JS, imagens), apenas encaminha o stream
                        proxyRes.pipe(res);
                    }
                },
                
                onProxyReq: (proxyReq, req, res) => {
                    console.log(`[PROXY] Redirecionando ${req.method} ${req.originalUrl} para ${target_url}`);
                },
            };

            // dynamicRouter.use(route_path, ...) garante que TODAS as sub-rotas sejam tratadas
            dynamicRouter.use(route_path, createProxyMiddleware(proxyOptions));
            console.log(`[✅ ATIVO] Rota configurada: ${route_path} -> ${target_url}`);
        })); 

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