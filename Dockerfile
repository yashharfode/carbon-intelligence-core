# Use official Node.js lightweight Alpine image
FROM node:20-alpine

# Set production environment
ENV NODE_ENV=production

# Set working directory inside container
WORKDIR /usr/src/app

# Copy dependency files
COPY package*.json ./

# Install production-only dependencies
RUN npm install --omit=dev

# Copy application source code (excluding items in .dockerignore)
COPY . .

# Cloud Run defaults to exposing port 8080
EXPOSE 8080

# Command to boot the Express orchestrator
CMD [ "npm", "start" ]
