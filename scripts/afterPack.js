/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const WRAPPER = (binName) => `#!/bin/sh
# Launch the real Electron binary, starting a private D-Bus session first when
# the environment has no usable session bus (e.g. DBUS_SESSION_BUS_ADDRESS is
# unset or set to "disabled:"). Chromium needs a bus for dconf/portal access;
# without this the app still opens but logs connection errors and settings are
# not persisted.
HERE=$(dirname "$(readlink -f "$0")")
BIN="$HERE/${binName}"

needs_bus() {
  case "\${DBUS_SESSION_BUS_ADDRESS:-}" in
    disabled*|*disabled:*) return 0 ;;
  esac
  if [ -n "\${DBUS_SESSION_BUS_ADDRESS:-}" ]; then return 1; fi
  if [ -n "\${XDG_RUNTIME_DIR:-}" ] && [ -S "$XDG_RUNTIME_DIR/bus" ]; then return 1; fi
  return 0
}

if needs_bus; then
  if command -v dbus-run-session >/dev/null 2>&1; then
    exec dbus-run-session -- "$BIN" "$@"
  elif command -v dbus-launch >/dev/null 2>&1; then
    exec dbus-launch --exit-with-session "$BIN" "$@"
  fi
fi

exec "$BIN" "$@"
`;

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'linux') return;

  const appOutDir = context.appOutDir;
  const name = context.packager.executableName;
  const binPath = path.join(appOutDir, name);
  const realPath = path.join(appOutDir, `${name}-bin`);

  if (!fs.existsSync(binPath)) return;
  if (fs.existsSync(realPath)) return;

  fs.renameSync(binPath, realPath);
  fs.chmodSync(realPath, 0o755);
  fs.writeFileSync(binPath, WRAPPER(`${name}-bin`), { mode: 0o755 });
};
