#!/bin/sh
set -eu
# A user service: no sudo, no changes to other services or global Node.
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
test -x "$HOME/.local/opt/bigfatfish/bin/bigfatfishd" || { echo 'Install the portable distribution in ~/.local/opt/bigfatfish first.' >&2; exit 1; }
mkdir -p "$HOME/.config/systemd/user" "$HOME/.config/bigfatfish"
cp "$HERE/bigfatfish.service" "$HOME/.config/systemd/user/bigfatfish.service"
systemctl --user daemon-reload
systemctl --user enable --now bigfatfish.service
