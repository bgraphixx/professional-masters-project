# --- Base: install deps ---
FROM node:20-slim AS deps

WORKDIR /frontend

# Copy dependencies manifest and lockfile
COPY package*.json ./

# Install packages deterministically and faster
RUN npm ci

# --- Dev stage: used by docker-compose.yml for local hot-reload ---
FROM deps AS dev

WORKDIR /frontend

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# --- Build stage: production static bundle ---
FROM deps AS build

WORKDIR /frontend

COPY . .

# Accept the API URL at build time (Vite bakes VITE_* vars into the bundle)
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# --- Serve stage ---
FROM nginx:1.27-alpine

COPY --from=build /frontend/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
