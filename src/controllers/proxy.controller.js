// src/controllers/proxy.controller.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const portscanner = require('portscanner');
const Route = require('../models/Route'); 

const dynamicRouter = express.Router();
let activeRoutesCache = [];

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
            const { route_path, target_url, check_port, name } = route;

            // --- 1. Verificação de Porta ---
            let is_service_running = true;
            if (check_port) {
                const status = await portscanner.checkPortStatus(check_port, hostToCheck); 
                is_service_running = status === 'open';
            }

            if (!is_service_running) {
                console.warn(`[⚠️ INATIVO] Serviço "${name}" para ${route_path} na porta ${check_port} está fechado. Rota ignorada.`);
                return; 
            }
            
            // --- 2. Configuração do Middleware de Proxy ---
            
            const proxyOptions = {
                target: target_url,
                changeOrigin: true,
                
                // Remove o prefixo do proxy antes de enviar ao serviço
                pathRewrite: {
                    [`^${route_path}`]: '', 
                },
                
                // WebSockets support
                ws: true,
                
                // Headers para melhor compatibilidade
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
                    'Cache-Control': 'no-cache',
                },

                // CORREÇÃO PRINCIPAL: Detectar requisições que NÃO são HTML para não interceptar
                selfHandleResponse: false, // Desativamos por padrão
                
                // Middleware que decide se deve interceptar a resposta
                onProxyReq: (proxyReq, req, res) => {
                    console.log(`[PROXY] 🔄 ${req.method} ${req.originalUrl} -> ${target_url}${req.url}`);
                    
                    // Remove header de encoding
                    proxyReq.removeHeader('accept-encoding');
                    
                    // Adiciona headers úteis
                    proxyReq.setHeader('User-Agent', 'API-Gateway-Proxy/1.0');
                    proxyReq.setHeader('X-Forwarded-For', req.connection.remoteAddress);
                    proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
                    proxyReq.setHeader('X-Forwarded-Host', req.get('Host'));
                    
                    // IMPORTANTE: Para POST/PUT com body, precisamos garantir que o content-length está correto
                    if (req.body && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
                        const bodyData = JSON.stringify(req.body);
                        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                        proxyReq.write(bodyData);
                    }
                },

                onError: (err, req, res) => {
                    console.error(`[PROXY ERROR] ❌ Erro de conexão ${req.originalUrl}:`, err.message);
                    if (!res.headersSent) {
                        res.status(502).json({
                            error: 'Bad Gateway',
                            message: 'Erro ao conectar com o serviço de destino',
                            target: target_url,
                            details: err.message
                        });
                    }
                }
            };

            // SOLUÇÃO: Criar um middleware wrapper que intercepta APENAS respostas HTML
            const proxyMiddleware = createProxyMiddleware(proxyOptions);
            
            dynamicRouter.use(route_path, (req, res, next) => {
                // Armazena o método write original
                const originalWrite = res.write;
                const originalEnd = res.end;
                const chunks = [];

                // Intercepta apenas se for GET (navegação de páginas HTML)
                const shouldInterceptHTML = req.method === 'GET';

                if (shouldInterceptHTML) {
                    res.write = function(chunk) {
                        chunks.push(Buffer.from(chunk));
                        return true;
                    };

                    res.end = function(chunk) {
                        if (chunk) {
                            chunks.push(Buffer.from(chunk));
                        }

                        const body = Buffer.concat(chunks);
                        const contentType = res.getHeader('content-type') || '';
                        
                        // Apenas modifica HTML
                        if (contentType.includes('text/html')) {
                            let htmlContent = body.toString();
                            
                            const basePath = route_path.endsWith('/') ? route_path : route_path + '/';
                            const baseTag = `<base href="${basePath}">`;
                            
                            console.log(`[HTML INJECT] 🎯 Processando HTML em ${req.originalUrl}`);
                            
                            // Detecta React
                            const isReactApp = htmlContent.includes('react') || 
                                             htmlContent.includes('__webpack_require__') ||
                                             htmlContent.includes('bundle.js') ||
                                             htmlContent.includes('manifest.json');
                            
                            if (isReactApp) {
                                console.log(`[REACT] 📱 Detectada aplicação React em ${req.originalUrl}`);
                                htmlContent = htmlContent.replace(
                                    /(\s)(href|src)=["']\/(?!\/)/g,
                                    `$1$2="${basePath}`
                                );
                            }
                            
                            // Injeta a tag base
                            if (htmlContent.includes('<head>')) {
                                htmlContent = htmlContent.replace(
                                    /<head>/i, 
                                    `<head>\n    ${baseTag}`
                                );
                            } else if (htmlContent.includes('<html>')) {
                                htmlContent = htmlContent.replace(
                                    /<html([^>]*)>/i,
                                    `<html$1>\n<head>\n    ${baseTag}\n</head>`
                                );
                            }
                            
                            const buffer = Buffer.from(htmlContent, 'utf8');
                            res.setHeader('Content-Length', buffer.length);
                            originalEnd.call(res, buffer);
                        } else {
                            // Para não-HTML, envia direto
                            originalEnd.call(res, body);
                        }
                    };
                }

                // Executa o proxy
                proxyMiddleware(req, res, next);
            });

            console.log(`[✅ ATIVO] Rota "${name}" configurada: ${route_path} -> ${target_url}`);
        })); 

    } catch (error) {
        console.error("❌ Erro ao carregar e configurar as rotas do Gateway:", error);
    }
};

/**
 * Handler de Fallback 404 (quando nenhuma rota do proxy corresponde).
 */
const notFoundFallback = (req, res) => {
    res.status(404).json({ 
        error: "Route Not Found", 
        message: "A rota solicitada não foi encontrada na API Gateway.",
        requested_path: req.originalUrl
    });
};

module.exports = { 
    dynamicRouter, 
    setupGatewayRoutes,
    notFoundFallback
};
