#!/bin/bash
set -e

echo "*****"
echo "** Application preparing to start up... Hi!"
echo "** Local time         :$(date -Is)"
echo "** SERVICE_NAME       :${SERVICE_NAME}"
echo "*****"

if [ -d "/app" ]
then
  pushd /app

  if [ "$PRISMA_MIGRATION" = "ENABLE" ]
  then
    echo "+Running prisma migrations (caches will be cleared) - disable with .env entry PRISMA_MIGRATION=DISABLE"
    npm run db:migrate:prod
  else
    echo "+Skipping prisma migrations - enable with .env entry PRISMA_MIGRATION=ENABLE"
  fi

  if [ "$PRISMA_GENERATE" = "ENABLE" ]
  then
    echo "+Running prisma generate - disable with PRISMA_GENERATE .env entry =DISABLE"
    npm run db:generate
  else
    echo "+Skipping prisma generate - enable with .env entry PRISMA_GENERATE=ENABLE"
  fi

  popd
fi

if [ "${1#-}" != "${1}" ] || [ -z "$(command -v "${1}")" ]
then
  set -- node "$@"
fi

exec "$@"
