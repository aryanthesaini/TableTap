#!/usr/bin/env bash
# Runs the backend with an embedded PostgreSQL 16 (no Docker / no local Postgres needed).
# Data lives in ./data/postgres — delete that folder to reset the demo data.
set -euo pipefail
cd "$(dirname "$0")"
if [ -z "${JAVA_HOME:-}" ] && [ -d /usr/lib/jvm/java-21-openjdk-amd64 ]; then
  export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
fi
exec mvn -q spring-boot:test-run -Dspring-boot.test-run.main-class=com.platform.LocalDevApplication "$@"
