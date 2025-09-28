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
            
            // --- 2. Configuração do Middleware de Proxy ---
            
            const proxyOptions = {
                target: target_url,
                
                // Corrige o cabeçalho Host
                changeOrigin: true, 
                
                // Remove o prefixo do proxy antes de enviar ao serviço
                // Ex: /service/portfolio/style.css -> /style.css
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

                // Intercepta e modifica apenas respostas HTML
                selfHandleResponse: true,
                
                onProxyRes: (proxyRes, req, res) => {
                    let body = Buffer.alloc(0);
                    
                    // Coleta todos os chunks da resposta
                    proxyRes.on('data', (chunk) => {
                        body = Buffer.concat([body, chunk]);
                    });

                    proxyRes.on('end', () => {
                        const contentType = proxyRes.headers['content-type'] || '';
                        const url = req.url;
                        
                        // Copia os headers da resposta original (exceto os problemáticos)
                        Object.keys(proxyRes.headers).forEach(key => {
                            if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
                                res.setHeader(key, proxyRes.headers[key]);
                            }
                        });
                        
                        res.statusCode = proxyRes.statusCode;

                        // Detecta se é HTML (tanto para apps tradicionais quanto React)
                        const isHtmlContent = (
                            contentType.includes('text/html') || 
                            (proxyRes.statusCode === 200 && 
                             !url.includes('.') && 
                             body.toString().includes('<!DOCTYPE html'))
                        );

                        if (isHtmlContent) {
                            let htmlContent = body.toString();
                            
                            // Calcula o basePath correto
                            const basePath = route_path.endsWith('/') ? route_path : route_path + '/';
                            const baseTag = `<base href="${basePath}">`;
                            
                            console.log(`[HTML INJECT] 🎯 Processando HTML em ${req.originalUrl}`);
                            
                            // Para aplicações React, também precisamos ajustar o publicPath
                            const isReactApp = htmlContent.includes('react') || 
                                             htmlContent.includes('__webpack_require__') ||
                                             htmlContent.includes('bundle.js') ||
                                             htmlContent.includes('manifest.json');
                            
                            if (isReactApp) {
                                console.log(`[REACT] 📱 Detectada aplicação React em ${req.originalUrl}`);
                                
                                // Para React, ajusta URLs absolutos que começam com /
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
                            
                            // Define headers corretos para HTML
                            const buffer = Buffer.from(htmlContent, 'utf8');
                            res.setHeader('Content-Length', buffer.length);
                            res.setHeader('Content-Type', 'text/html; charset=utf-8');
                            res.end(buffer);
                            
                        } else {
                            // Para TODOS os outros arquivos (CSS, JS, imagens, JSON, etc)
                            console.log(`[ASSET] 📄 Servindo ${req.originalUrl} (${contentType || 'unknown'}) - ${body.length} bytes`);
                            
                            if (body.length > 0) {
                                res.setHeader('Content-Length', body.length);
                            }
                            
                            // Headers específicos para diferentes tipos de assets
                            if (contentType.includes('text/css')) {
                                res.setHeader('Content-Type', 'text/css; charset=utf-8');
                            } else if (contentType.includes('javascript') || url.endsWith('.js')) {
                                res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
                            } else if (contentType.includes('application/json') || url.endsWith('.json')) {
                                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                            } else if (url.includes('manifest.json')) {
                                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                            }
                            
                            res.end(body);
                        }
                    });

                    proxyRes.on('error', (err) => {
                        console.error(`[PROXY ERROR] ❌ Erro na resposta para ${req.originalUrl}:`, err.message);
                        if (!res.headersSent) {
                            res.status(502).json({
                                error: 'Bad Gateway',
                                message: 'Erro ao processar resposta do serviço'
                            });
                        }
                    });
                },
                
                onProxyReq: (proxyReq, req, res) => {
                    console.log(`[PROXY] 🔄 ${req.method} ${req.originalUrl} -> ${target_url}${req.url}`);
                    
                    // Remove header de encoding para evitar problemas
                    proxyReq.removeHeader('accept-encoding');
                    
                    // Adiciona headers úteis
                    proxyReq.setHeader('User-Agent', 'API-Gateway-Proxy/1.0');
                    proxyReq.setHeader('X-Forwarded-For', req.connection.remoteAddress);
                    proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
                    proxyReq.setHeader('X-Forwarded-Host', req.get('Host'));
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

            // Aplica o middleware de proxy na rota
            dynamicRouter.use(route_path, createProxyMiddleware(proxyOptions));
            console.log(`[✅ ATIVO] Rota configurada: ${route_path} -> ${target_url}`);
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
