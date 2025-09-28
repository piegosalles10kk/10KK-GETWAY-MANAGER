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
                // Ex: /service/backoffice/style.css -> /style.css
                pathRewrite: {
                    [`^${route_path}`]: '', 
                },
                
                // WebSockets
                ws: true,
                
                // Headers customizados
                headers: {
                    'X-Forwarded-Proto': 'http',
                    'X-Forwarded-Host': 'localhost',
                },

                // Intercepta a resposta para modificar conteúdo HTML
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
                        
                        // Copia os headers da resposta original
                        Object.keys(proxyRes.headers).forEach(key => {
                            // Remove headers que podem causar problemas com proxy
                            if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
                                res.setHeader(key, proxyRes.headers[key]);
                            }
                        });
                        
                        res.statusCode = proxyRes.statusCode;

                        // Se for HTML, injeta a tag base para corrigir URLs relativos
                        if (contentType.includes('text/html') && !url.includes('.')) {
                            let htmlContent = body.toString();
                            
                            // Calcula o basePath correto - sempre com barra no final
                            const basePath = route_path.endsWith('/') ? route_path : route_path + '/';
                            const baseTag = `<base href="${basePath}">`;
                            
                            // Debug log
                            console.log(`[HTML INJECT] Injetando base href="${basePath}" em ${req.originalUrl}`);
                            
                            // Injeta a tag base logo após <head>
                            if (htmlContent.includes('<head>')) {
                                htmlContent = htmlContent.replace(
                                    /<head>/i, 
                                    `<head>\n    ${baseTag}`
                                );
                            } else if (htmlContent.includes('<html>')) {
                                // Se não tem <head>, adiciona no início do HTML
                                htmlContent = htmlContent.replace(
                                    /<html([^>]*)>/i,
                                    `<html$1>\n<head>\n    ${baseTag}\n</head>`
                                );
                            } else {
                                // Fallback: adiciona no início do documento
                                htmlContent = `<!DOCTYPE html>\n<html><head>${baseTag}</head><body>\n${htmlContent}\n</body></html>`;
                            }
                            
                            // Define o Content-Length correto
                            const buffer = Buffer.from(htmlContent, 'utf8');
                            res.setHeader('Content-Length', buffer.length);
                            res.setHeader('Content-Type', 'text/html; charset=utf-8');
                            res.end(buffer);
                        } else {
                            // Para outros tipos de conteúdo (CSS, JS, imagens), envia sem modificação
                            console.log(`[ASSET] Servindo ${req.originalUrl} como ${contentType}`);
                            res.setHeader('Content-Length', body.length);
                            res.end(body);
                        }
                    });

                    proxyRes.on('error', (err) => {
                        console.error(`[PROXY ERROR] Erro na resposta para ${req.originalUrl}:`, err.message);
                        res.status(502).json({
                            error: 'Bad Gateway',
                            message: 'Erro ao processar resposta do serviço'
                        });
                    });
                },
                
                onProxyReq: (proxyReq, req, res) => {
                    console.log(`[PROXY] Redirecionando ${req.method} ${req.originalUrl} para ${target_url}`);
                    
                    // Remove headers problemáticos
                    proxyReq.removeHeader('accept-encoding');
                },

                onError: (err, req, res) => {
                    console.error(`[PROXY ERROR] Erro ao proxificar ${req.originalUrl}:`, err.message);
                    res.status(502).json({
                        error: 'Bad Gateway',
                        message: 'Erro ao conectar com o serviço de destino',
                        target: target_url
                    });
                }
            };

            // Aplica o middleware de proxy na rota
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
