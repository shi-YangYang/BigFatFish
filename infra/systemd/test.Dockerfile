FROM bigfatfish:p6-local
USER root
RUN apt-get update && apt-get install -y --no-install-recommends systemd dbus libpam-systemd dbus-user-session && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /home/node/.local/opt/bigfatfish/bin /home/node/.config/systemd/user && cp -a /app/dist /app/node_modules /app/package.json /home/node/.local/opt/bigfatfish/ && cp /usr/local/bin/node /home/node/.local/opt/bigfatfish/bin/node
COPY infra/systemd/bigfatfish.service /home/node/.config/systemd/user/bigfatfish.service
RUN printf '#!/bin/sh\nexec "$(dirname "$0")/node" "$(dirname "$0")/../dist/runtime/src/main.js" "$@"\n' > /home/node/.local/opt/bigfatfish/bin/bigfatfishd && chmod +x /home/node/.local/opt/bigfatfish/bin/bigfatfishd && chown -R node:node /home/node/.local /home/node/.config && mkdir -p /var/lib/systemd/linger && touch /var/lib/systemd/linger/node
STOPSIGNAL SIGRTMIN+3
ENTRYPOINT ["/lib/systemd/systemd"]
CMD ["--system"]
