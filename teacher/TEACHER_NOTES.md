# Services on VMs: teacher notes (S13, Thu 15 Oct)

## What students do (summary)
Each student has their own Ubuntu Server VMs (`vm-a`, `vm-b`) in UTM or Parallels. In `vm-a` they run three services (product, cart, payment) that answer with JSON, plus an agent that reports the VM's real CPU and memory. A shop page (`index.html`) and a monitor page (`monitor.html`) call them. They load the VM until the monitor alerts at 80% CPU, then move payment to `vm-b`, break it, and explain what happened.

**Objective (your wording):** students can explain how VMs host services. Concretely: what runs on which VM, how busy a VM is (and the 80% alert), what breaks when a service or a whole VM fails, and why a second VM changes that.

## What is in the folders
- `student/`: give this to students (vm-check.sh, CONTRACT.md, contract-check.js, load.js, serve.js, web/ with the two pages and config.js).
- `teacher/reference/`: working services and agent in Node (product.js, cart.js, payment.js, agent.js, svc.js, serve.js, start-all.sh, stop-all.sh; start-all.sh also needs the student `web/` folder next to it). Hand these out only if a student is stuck (the students are meant to write them with AI).
- The presentation (19 slides, speaker notes in Spanish with timings) is a separate Slides artifact (link in the chat). It replaces any one-page brief.
- Students copy files into their VMs with `scp` over SSH from their laptop (that is why an SSH server is a requirement; `vm-check.sh` warns if it is missing). I did not test scp from Windows laptops.

## What I tested (and how)
Real processes, real HTTP, real browser (headless Chromium), on one Ubuntu 24.04 machine with 2 cores. The services, checker and load tool were run with **Node 18.19.1** (the version Ubuntu 24.04's `nodejs` package has, per ubuntuupdates.org) and the shop/monitor test also passed with it:
- `contract-check.js` passes on the reference services and agent (all checks). It **fails** with clear hints on a broken service and on a stopped one (I tested both).
- Shop page: add to cart, pay, cart clears; with payment stopped only the payment panel shows an error (products and cart keep working); with product stopped only the product panel fails; pointing `config.js` at a second payment instance works.
- Monitor page: shows CPU, memory and service status; reports an unreachable VM; raises the 80% alert when CPU stays at or above 80% for two samples; logs the recovery.
- Capacity: one payment process tops out at about 33 requests/s (1000 ms ÷ 30 ms); above that, latency rises from about 35 ms to over 1.5 s. Measured CPU slope was about 1.6% machine-wide per request/s on 2 cores (the model predicts 1.5%). In the test the load generator shared the machine, which inflated readings. In class it runs from another VM.
- `vm-check.sh` runs here; its port and SSH detection was tested with real listeners (SSH WARN when nothing listens on 22, PASS when something does).

## What I did NOT test (please read)
- **UTM or Parallels:** I have no access to them. Everything about VM creation, cloning, network modes and reachability between laptop and VMs is general knowledge, not tested.
- **1 vCPU:** I measured on 2 cores. On a 1 vCPU VM the model says about 3% VM CPU per payment request/s, so about 26.7 req/s should reach 80%. That is arithmetic from the measured slope, not a measurement. The `vCPUs` line in `vm-check.sh` warns above 2.
- **Ubuntu Server defaults:** Node is normally NOT installed on a fresh Ubuntu Server; students install it with `sudo apt install -y nodejs`. `vm-check.sh` checks node (18+) and curl and prints the fix. I have not verified what a given UTM/Parallels Ubuntu image already contains.
- **Student code written by AI:** I only tested my reference code. The checker is the safety net; some AI versions will fail checks (most likely CORS, the 25 ms simulated work, or listening only on 127.0.0.1).
- **Student laptops' browsers:** only headless Chromium was tested. The pages use `fetch` and `AbortController`, which current browsers support.
- Node versions other than 18.19.1 (tested) and 22 (also run here) were not tested. Student AI code may use newer APIs; the checker is the safety net.
- The numbers (10/5/30 ms of CPU per request, ports, product names and prices) are mine, made up for the exercise.

## Risks you should know about, in order of likelihood
1. **Laptop cannot reach the VM** (network mode). The home test in `vm-check.sh` is there to catch it before class. Fix to try: switch the VM to Bridged and test again.
2. **Two VMs cannot talk to each other** (Stage 5). Quick test from vm-b: `curl http://<vm-a IP>:3003/health`. If it fails and Ubuntu's firewall is active (`sudo ufw status`), allow the ports; I did not verify the firewall state on a default install.
3. **Cloned VMs with the same identity.** `vm-check.sh` prints the first 8 characters of `/etc/machine-id`; they must differ between vm-a and vm-b. If they match and both VMs get the same IP, resetting the machine-id is the commonly given fix; I have not verified it for UTM or Parallels.
4. **Home setup not done.** Plan: students who arrive without a working vm-a pair up with one who has.
5. **AI code that doesn't match the contract.** Give them the reference file for that service.
6. **Too much for 95 minutes.** Stages 3 to 5 are in priority order. If time is short, drop the agent/monitor (Stage 3) and keep load plus the second VM: use `top` or `uptime` in vm-a to see CPU instead.

## Run sheet (about 2 h, including 10 min break)
| Min | What |
|---|---|
| 0–15 | Presentation: hook question, objective, architecture, contract, capacity arithmetic. |
| 15–25 | Stage 1: vm-check on both VMs, copy files, laptop→VM test. |
| 25–55 | Stage 2: write the three services with AI, run the checker until it passes, open the shop page. |
| 55–70 | Stage 3: agent + monitor page. |
| 70–80 | Break (10 min). |
| 80–95 | Stage 4: load from vm-b, fill the table. |
| 95–115 | Stage 5: payment on vm-b, load again, stop it, observe. |
| 115–120 | Hand in the worksheet (pen and paper, as in your course rules). |

You can shift the break. If 95 minutes of work are really 85, trim Stage 2.

## Answers for the debrief
- **Capacity:** one payment process: 1000 / 30 = 33.3 req/s at 100%; 80% is 26.7 req/s. These come from the simulated 30 ms.
- **What 50 req/s of payment needs:** 50 / 26.7 = 1.9, so 2 processes under the 80% rule. To survive losing one (N+1): 3. If each is on its own 1 vCPU VM, that is 3 VMs.
- **Single point of failure:** everything in vm-a: if vm-a stops, shop, cart and payment all stop. With payment on vm-b, a stop of vm-a leaves payment alive but the shop can't use it; a stop of vm-b leaves the shop usable except for paying.
- **Stopped service vs dead VM:** a stopped service on a living VM answers "refused" at once. A dead VM never answers, so the caller waits until its timeout (the shop page waits 2.5 s). This is standard network behaviour, from general knowledge, not from your decks.
- **Link to your course:** this is the hands-on version of the S02 question about 30 microservices on 30 machines (I rely on COURSE_CONTEXT for that wording; I have not re-read S02).
