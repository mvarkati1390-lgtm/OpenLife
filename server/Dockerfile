FROM node:20-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production
ENV PORT=3000
# Koyeb's free instance has no persistent volume; /tmp is intentionally temporary.
ENV DB_FILE=/tmp/openlife.db
EXPOSE 3000
CMD ["npm","start"]
