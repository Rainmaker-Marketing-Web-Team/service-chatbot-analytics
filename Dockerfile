FROM grafana/grafana:12.4

USER root

COPY grafana/entrypoint.sh /usr/local/bin/grafana-entrypoint.sh
COPY grafana/provisioning /etc/grafana/provisioning
COPY grafana/dashboards /var/lib/grafana/dashboards

RUN chmod +x /usr/local/bin/grafana-entrypoint.sh \
  && mkdir -p /etc/grafana/provisioning/datasources /var/lib/grafana/dashboards \
  && chown -R grafana:root /etc/grafana /var/lib/grafana /usr/local/bin/grafana-entrypoint.sh

USER grafana

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/grafana-entrypoint.sh"]
