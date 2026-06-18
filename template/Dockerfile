# Hold instance — build + run.
FROM node:22-alpine AS base
RUN npm i -g pnpm@9
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS run
ENV NODE_ENV=production
ENV PORT=3100
COPY --from=build /app ./
EXPOSE 3100
# Ensure the auth schema exists and is locked down, then start.
CMD ["sh", "-c", "node db/run.mjs db/auth-schema.sql db/harden-auth.sql && pnpm start"]
