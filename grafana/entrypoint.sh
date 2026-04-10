#!/bin/sh

set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

urldecode() {
  printf '%b' "$(printf '%s' "$1" | sed 's/+/ /g; s/%/\\x/g')"
}

trim_scheme="${DATABASE_URL#postgresql://}"
trim_scheme="${trim_scheme#postgres://}"
trim_query="${trim_scheme%%\?*}"

credentials="${trim_query%@*}"
location_and_db="${trim_query#*@}"

db_user_raw="${credentials%%:*}"
db_password_raw="${credentials#*:}"

db_host_port="${location_and_db%%/*}"
db_name_raw="${location_and_db#*/}"

db_host="${db_host_port%%:*}"
db_port="${db_host_port#*:}"

if [ "$db_port" = "$db_host_port" ]; then
  db_port="5432"
fi

db_name="$(urldecode "${db_name_raw}")"
db_user="$(urldecode "${db_user_raw}")"
db_password="$(urldecode "${db_password_raw}")"

cat > /etc/grafana/provisioning/datasources/chatbot-postgres.yaml <<EOF
apiVersion: 1

datasources:
  - name: Service Chatbot Postgres
    uid: chatbot_postgres
    type: postgres
    access: proxy
    isDefault: true
    editable: false
    url: ${db_host}:${db_port}
    user: ${db_user}
    secureJsonData:
      password: ${db_password}
    jsonData:
      database: ${db_name}
      sslmode: require
      maxOpenConns: 25
      maxIdleConns: 5
      maxIdleConnsAuto: true
      connMaxLifetime: 14400
      postgresVersion: 1500
      timescaledb: false
EOF

exec /run.sh
