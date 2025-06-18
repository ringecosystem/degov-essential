FROM node:22-alpine AS builder

COPY . /code
WORKDIR /code

RUN corepack enable pnpm
RUN \
  pnpm install \
  && npx prisma generate \
  && pnpm build

FROM node:22-alpine

WORKDIR /app

COPY --from=builder /code/build /app
COPY --from=builder /code/package.json /app/package.json
COPY --from=builder /code/scripts /app/scripts
COPY --from=builder /code/prisma /app/prisma

RUN corepack enable pnpm
RUN \
  pnpm install --prod --no-optional \
  && pnpm add -P prisma \
  && pnpm store prune

ENTRYPOINT ["scripts/start.sh"]
