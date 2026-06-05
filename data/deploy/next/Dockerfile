# Optional: bake standalone into an image (not used by default deploy).
# Default deploy mounts ./standalone via docker-compose volumes — see bootstrap.sh.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY standalone ./
COPY static ./.next/static
COPY public ./public
EXPOSE 3000
CMD ["node", "server.js"]
