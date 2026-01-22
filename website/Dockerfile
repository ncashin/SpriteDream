FROM node:20-alpine AS development-dependencies-env
COPY website /app
WORKDIR /app
RUN npm ci

FROM node:20-alpine AS production-dependencies-env
COPY website/package.json website/package-lock.json /app/
WORKDIR /app
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime-build-env
COPY runtime /app/runtime
WORKDIR /app/runtime
RUN npm ci && npm run build

FROM node:20-alpine AS build-env
COPY website /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
COPY --from=runtime-build-env /app/runtime/dist /app/runtime/dist
WORKDIR /app
RUN npm run build

FROM node:20-alpine
COPY website/package.json website/package-lock.json /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
COPY --from=runtime-build-env /app/runtime/dist /app/runtime/dist
COPY --from=runtime-build-env /app/runtime/source /app/runtime/source
WORKDIR /app
CMD ["npm", "run", "start"]