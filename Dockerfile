FROM node:24.16.0-alpine3.23 AS deps

WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml tsconfig.base.json nx.json /app/
COPY .yarn/releases /app/.yarn/releases
COPY .yarn/patches /app/.yarn/patches

COPY packages/twenty-shared/package.json /app/packages/twenty-shared/
COPY packages/twenty-server/package.json /app/packages/twenty-server/
COPY packages/twenty-server/patches /app/packages/twenty-server/patches
COPY packages/twenty-client-sdk/package.json /app/packages/twenty-client-sdk/
COPY packages/twenty-emails/package.json /app/packages/twenty-emails/
COPY packages/twenty-ui/package.json /app/packages/twenty-ui/
COPY packages/twenty-front/package.json /app/packages/twenty-front/
COPY packages/twenty-front-component-renderer/package.json /app/packages/twenty-front-component-renderer/
COPY packages/twenty-sdk/package.json /app/packages/twenty-sdk/

RUN yarn install && yarn cache clean

FROM deps AS build

COPY . /app

RUN npx nx build twenty-shared --skip-nx-cache
RUN npx nx build twenty-client-sdk --skip-nx-cache
RUN npx nx build twenty-emails --skip-nx-cache
RUN npx nx build twenty-server --skip-nx-cache

FROM node:24.16.0-alpine3.23 AS prod

WORKDIR /app

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/package.json /app/
COPY --from=build /app/yarn.lock /app/
COPY --from=build /app/.yarnrc.yml /app/
COPY --from=build /app/.yarn /app/.yarn
COPY --from=build /app/nx.json /app/
COPY --from=build /app/tsconfig.base.json /app/

COPY --from=build /app/packages/twenty-shared/dist /app/packages/twenty-shared/dist
COPY --from=build /app/packages/twenty-shared/package.json /app/packages/twenty-shared/

COPY --from=build /app/packages/twenty-client-sdk/dist /app/packages/twenty-client-sdk/dist
COPY --from=build /app/packages/twenty-client-sdk/package.json /app/packages/twenty-client-sdk/

COPY --from=build /app/packages/twenty-emails/dist /app/packages/twenty-emails/dist
COPY --from=build /app/packages/twenty-emails/package.json /app/packages/twenty-emails/

COPY --from=build /app/packages/twenty-server/dist /app/packages/twenty-server/dist
COPY --from=build /app/packages/twenty-server/package.json /app/packages/twenty-server/

EXPOSE 3000

CMD ["sh", "-c", "yarn nx run twenty-server:database:init:prod && node packages/twenty-server/dist/main"]
