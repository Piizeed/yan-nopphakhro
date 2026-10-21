FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATABASE_PATH=/app/data/members.sqlite
COPY package.json server.mjs membership.mjs subscriptions.mjs premium.mjs slip-verifier.mjs ./
COPY public ./public
COPY licenses ./licenses
COPY scripts/admin.mjs ./scripts/admin.mjs
COPY THIRD_PARTY_NOTICES.md ./
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
