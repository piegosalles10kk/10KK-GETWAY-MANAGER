# Usa uma imagem base oficial do Node.js, otimizada para estabilidade.
FROM node:20-alpine

# Define o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Copia os arquivos package.json e package-lock.json
COPY package*.json ./

# Instala as dependências do projeto
RUN npm ci --omit=dev

# Copia o restante do código da aplicação
COPY . .

# Expõe a porta que o seu servidor Express/Gateway usa internamente
EXPOSE 8000 

# Comando para iniciar a aplicação
CMD [ "npm", "start" ]