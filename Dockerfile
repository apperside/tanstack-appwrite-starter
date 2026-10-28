# syntax=docker/dockerfile:1

# ---- build stage ----
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# BuildKit cache mount keeps the pnpm store between builds; store-dir is set
# explicitly (env) so the cache target matches regardless of pnpm defaults.
ENV npm_config_store_dir=/pnpm/store
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Public VITE_* values are inlined into the bundle by Vite at BUILD time, so
# they must be supplied as build args (see docker-compose.yml). They are set
# in this stage only and never reach the runtime image. Server secrets
# (APPWRITE_API_KEY, ...) must NOT be passed here.
ARG VITE_APPWRITE_ENDPOINT
ARG VITE_APPWRITE_PROJECT_ID
ARG VITE_APPWRITE_DATABASE_ID
ARG VITE_REQUIRE_EMAIL_VERIFICATION
ENV VITE_APPWRITE_ENDPOINT=$VITE_APPWRITE_ENDPOINT \
    VITE_APPWRITE_PROJECT_ID=$VITE_APPWRITE_PROJECT_ID \
    VITE_APPWRITE_DATABASE_ID=$VITE_APPWRITE_DATABASE_ID \
    VITE_REQUIRE_EMAIL_VERIFICATION=$VITE_REQUIRE_EMAIL_VERIFICATION

COPY . .
RUN pnpm build

# ---- runtime stage ----
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Nitro bundles its dependencies into .output, so nothing else is needed.
# Server env (APPWRITE_API_KEY, APP_URL, TRUSTED_PROXY_HOPS) is provided at
# runtime, e.g. via `env_file` in docker-compose.yml.
COPY --from=build --chown=node:node /app/.output ./.output

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
