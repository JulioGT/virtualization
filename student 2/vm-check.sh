#!/usr/bin/env bash
# vm-check.sh  -  run this INSIDE your Ubuntu Server VM:   bash vm-check.sh
# It only reads information. It does not change anything.

ok()   { echo "  [PASS] $1"; }
warn() { echo "  [WARN] $1"; }
bad()  { echo "  [FAIL] $1"; FAILS=$((FAILS+1)); }
FAILS=0

# listening PORT: true if something is listening on that TCP port (reads /proc/net/tcp, no extra tools needed)
listening() {
  local hex files=() f; hex=$(printf '%04X' "$1")
  for f in /proc/net/tcp /proc/net/tcp6; do [ -r "$f" ] && files+=("$f"); done
  [ ${#files[@]} -gt 0 ] || return 1
  awk -v h="$hex" '$4=="0A" && substr($2, length($2)-3, 4)==h {f=1} END{exit !f}' "${files[@]}" 2>/dev/null
}

echo "== VM check =="
HOST=$(hostname)
echo "hostname : $HOST"

. /etc/os-release 2>/dev/null
echo "system   : ${PRETTY_NAME:-unknown}   ($(uname -m))"
echo "vCPUs    : $(nproc)"
RAM_MB=$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo)
echo "RAM      : ${RAM_MB} MB"
echo "disk free: $(df -h --output=avail / | tail -1 | tr -d ' ') on /"
IPS=$(hostname -I 2>/dev/null)
echo "IP(s)    : ${IPS:-none}"
MID=$(cut -c1-8 /etc/machine-id 2>/dev/null)
echo "machine-id (first 8 chars): ${MID:-unknown}   <- must be DIFFERENT on each of your VMs"
echo

echo "== Requirements =="
[ "$ID" = "ubuntu" ] && ok "Ubuntu detected" || warn "This is not Ubuntu (${ID:-unknown}). The lab was written for Ubuntu Server."

if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null)
  if [ "${NODE_MAJOR:-0}" -ge 18 ]; then
    ok "node $(node -v) (18 or newer needed)"
  else
    bad "node is older than 18: $(node -v). (Ubuntu 22.04 installs v12 with apt.) Fix at home with internet:  curl -fsSL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh && sudo -E bash nodesource_setup.sh && sudo apt install -y nodejs"
  fi
else
  bad "node not found. Fix at home with internet:  sudo apt update && sudo apt install -y nodejs   (then run  node -v : it must be 18 or newer; if it is older, see the line printed when that happens)"
fi

command -v curl >/dev/null 2>&1 && ok "curl is installed" || bad "curl not found. Fix at home with internet:  sudo apt update && sudo apt install -y curl"

N=$(nproc)
if [ "$N" -le 2 ]; then ok "vCPUs = $N (1 or 2 recommended)"; else warn "vCPUs = $N. The load tests will need much more load to reach 80% CPU. Recommended: 1 or 2."; fi

if [ "$RAM_MB" -ge 900 ]; then ok "RAM = ${RAM_MB} MB"; else warn "RAM = ${RAM_MB} MB (about 1024 MB recommended)"; fi

if [ -n "$IPS" ] && echo "$IPS" | grep -qvE '^127\.'; then ok "the VM has an IP address"; else bad "no IP address. Check the VM network mode (see slides)."; fi

if listening 22; then
  ok "an SSH server is running (port 22): you can open a terminal on this VM from your laptop"
else
  warn "no SSH server found. You need it to copy files from your laptop. Fix at home:  sudo apt update && sudo apt install -y openssh-server"
fi

for p in 3001 3002 3003 8080 9100; do
  if listening "$p"; then warn "port $p is already in use (stop the program that uses it)"; fi
done

echo
if [ "$FAILS" -eq 0 ]; then
  echo "RESULT: PASS (no FAIL lines). Now do the laptop test below."
else
  echo "RESULT: $FAILS FAIL line(s). Fix them, then run this script again."
fi

FIRST_IP=$(echo "$IPS" | awk '{print $1}')
cat <<MSG

== Laptop -> VM test (do this once, at home) ==
1. In THIS VM run:
   node -e "require('http').createServer((q,r)=>r.end('hello from '+require('os').hostname())).listen(8000,'0.0.0.0')"
2. In your LAPTOP browser open:   http://${FIRST_IP:-<VM-IP>}:8000
   You should see: hello from <this VM's name>
3. Stop the server in the VM with Ctrl+C.
If the page does not open, your VM network mode does not let the laptop reach the VM (see the slides).
MSG
exit $FAILS
