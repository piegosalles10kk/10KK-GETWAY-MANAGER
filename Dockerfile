# Usa uma imagem base oficial do Node.js, otimizada para estabilidade.
FROM node:20-alpine

# Define o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Copia os arquivos package.json e package-lock.json
# Isso permite que a camada de instalação de dependências (npm install) seja cacheada
COPY package*.json ./

# Instala as dependências do projeto
# O 'npm ci' (clean install) é mais rápido e confiável em ambientes de CI/CD e Docker
RUN npm ci --omit=dev

# Copia o restante do código da aplicação
# Inclui arquivos como server.js, public/, config/, routes/, etc.
COPY . .

# Expõe a porta que o seu servidor Express/Gateway usa internamente
# (Você a mapeou para 1310 no docker-compose.yml)
EXPOSE 8080

# Comando para iniciar a aplicação (que deve ser o "start" definido no seu package.json)
CMD [ "npm", "start" ]