# Runtime image — expects pre-built standalone output in build context (see deploy-uat-next.mjs).
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
