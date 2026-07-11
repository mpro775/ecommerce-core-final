FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src

ARG VITE_API_BASE_URL
ARG VITE_STOREFRONT_BASE_URL
ARG VITE_SF_VISUAL_BUILDER_ENABLED
ARG VITE_SF_ROLLOUT_STAGE

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_STOREFRONT_BASE_URL=${VITE_STOREFRONT_BASE_URL}
ENV VITE_SF_VISUAL_BUILDER_ENABLED=${VITE_SF_VISUAL_BUILDER_ENABLED}
ENV VITE_SF_ROLLOUT_STAGE=${VITE_SF_ROLLOUT_STAGE}

RUN npm run build

FROM nginx:1.27-alpine AS runner

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
