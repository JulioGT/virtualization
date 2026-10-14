#!/usr/bin/env bash
# Starts product, cart, payment, the agent and the web server in the background (one VM).
# Stop them with:  bash stop-all.sh        Logs: ./logs/*.log
# Needs serve.js and web/ next to this script (copy them from the student folder).
cd "$(dirname "$0")"; mkdir -p logs
for s in product cart payment agent; do
  nohup node $s.js > logs/$s.log 2>&1 &
  echo $! > logs/$s.pid
done
nohup node serve.js 8080 web > logs/web.log 2>&1 &
echo $! > logs/web.pid
sleep 1; echo "started. Open http://<this VM's IP>:8080/index.html  (monitor: /monitor.html)"
