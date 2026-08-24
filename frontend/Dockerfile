# deps: install dependencies
FROM node:20-slim AS deps

WORKDIR /frontend

COPY package*.json ./
RUN npm ci

# dev: used by docker-compose.dev.yml for local hot-reload
FROM deps AS dev

WORKDIR /frontend

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# build: production static bundle
FROM deps AS build

WORKDIR /frontend

COPY . .

# Vite bakes VITE_* vars into the bundle at build time
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /frontend/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
