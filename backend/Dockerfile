FROM node:20-slim

WORKDIR /app

COPY package*.json ./
# Install all deps (including devDeps) so tsc is available for the build step
RUN npm install

COPY . .
RUN npm run build

# Prune devDependencies after build to keep the final image lean
RUN npm prune --production

EXPOSE 8080

CMD ["npm", "start"]
