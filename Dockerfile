# wordPlay — production image (API + built client on one port)
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# public/ holds the uploads dir the server writes to (mount a volume here)
COPY --from=build /app/public ./public
EXPOSE 5001
CMD ["node", "dist/index.js"]
