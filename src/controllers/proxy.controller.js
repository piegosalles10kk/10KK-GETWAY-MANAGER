// src/controllers/proxy.controller.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const portscanner = require('portscanner');
const Route = require('../models/Route'); 
const dynamicRouter = express.Router();
let activeRoutesCache = [];

// Função de Ajuda: Injeta a tag <base href="..."> no HTML
const injectBaseTag = (htmlContent, route_path) => {
    // Garante que o caminho termine em barra, ex: /service/minharota/
    const basePath = route_path.endsWith('/') ? route_path : route_path + '/';
    const baseTag = `<base href="${basePath}">`;
    
    // Injeta a tag <base> logo após a tag <head> de abertura (regex case-insensitive)
    return htmlContent.replace(/<head>/i, `<head>${baseTag}`);
};

/**
 * Função principal para buscar, verificar a saúde e configurar as rotas.
 */
const setupGatewayRoutes = async ({ PORT_CHECK_HOST }) => {
    
    const hostToCheck = PORT_CHECK_HOST || process.env.PORT_CHECK_HOST || '127.0.0.1';

    try {
        const newRoutes = await Route.find({ is_active: true });
        
        if (JSON.stringify(newRoutes) === JSON.stringify(activeRoutesCache)) {
            return; 
        }

        console.log(`\n🔄 Recarregando rotas. Rotas ativas encontradas: ${newRoutes.length}.`);
        activeRoutesCache = newRoutes;

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
            const proxyOptions = {
                target: target_url,
                changeOrigin: true, // Mantém a correção de Host Header
                
                // CRÍTICA: Intercepta a resposta para injetar a tag base no HTML
                onProxyRes: (proxyRes, req, res) => {
                    const contentType = proxyRes.headers['content-type'];
                    
                    // Somente processa documentos HTML
                    if (contentType && contentType.includes('text/html')) {
                        // 1. Remove o cabeçalho de compressão (se existir) para ler o corpo como string
                        delete proxyRes.headers['content-encoding']; 
                        
                        let body = [];
                        
                        // 2. Coleta o corpo da resposta em chunks
                        proxyRes.on('data', (chunk) => {
                            body.push(chunk);
                        });

                        // 3. Processa e envia a resposta modificada
                        proxyRes.on('end', () => {
                            try {
                                const buffer = Buffer.concat(body);
                                let html = buffer.toString('utf8');
                                
                                // INJEÇÃO: Adiciona a tag <base href="...">
                                html = injectBaseTag(html, route_path);

                                // Garante que o novo tamanho do corpo seja definido
                                res.setHeader('content-length', Buffer.byteLength(html));
                                res.end(html);
                            } catch (e) {
                                console.error("Erro ao processar HTML para injeção de base:", e);
                                res.end(Buffer.concat(body)); // Envia o original em caso de erro
                            }
                        });
                    } else {
                        // Para outros tipos de conteúdo (CSS, JS, imagens), enviamos o original
                        proxyRes.pipe(res);
                    }
                },
                
                onProxyReq: (proxyReq, req, res) => {
                    console.log(`[PROXY] Redirecionando ${req.method} ${req.originalUrl} para ${target_url}`);
                },
            };

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
