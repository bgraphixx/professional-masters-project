FROM node:20-slim

WORKDIR /frontend

# Copy dependencies manifest and lockfile
COPY package*.json ./

# Install packages deterministically and faster
RUN npm ci

# Copy all source files
COPY . .

EXPOSE 5173

# Run Vite with host flag for Docker port mapping
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
