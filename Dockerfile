# 1. Imagem base: Usamos a versão 18 do Node.js
FROM node:18-alpine

# 2. Define o diretório de trabalho dentro do container
WORKDIR /app

# 3. Copia os arquivos de definição das dependências
COPY package*.json ./

# 4. Instala as dependências do projeto
RUN npm install

# 5. Copia todo o resto do código da aplicação (server.js e a pasta public)
COPY . .

# 6. Expõe a porta que a nossa aplicação usa
EXPOSE 3000

# 7. Comando final para iniciar a aplicação quando o container rodar
CMD [ "node", "server.js" ]