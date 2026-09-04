FROM node:24-alpine AS application

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

ARG APP_FILTER
ENV APP_FILTER=$APP_FILTER

RUN corepack enable

WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter "$APP_FILTER" build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "pnpm --filter \"$APP_FILTER\" start"]
