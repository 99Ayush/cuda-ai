FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# If you have a build step for frontend:
# RUN npm run build
EXPOSE 8080
CMD ["node", "server.js"]
