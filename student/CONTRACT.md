# The contract: what your services must do

Your services run in **vm-a** (Ubuntu Server). They answer web requests with **JSON**. The shop page (`web/index.html`) and the monitor (`web/monitor.html`) only work if your services follow this contract **exactly**. The checker `contract-check.js` tests it for you.

## Rules for all four programs

- Language: **Node.js 18 or newer, built-in modules only** (`http`, `fs`, `os`, ...). No `npm install`, no Express. Ubuntu 24.04 installs Node 18 with `sudo apt install -y nodejs`.
- Listen on `0.0.0.0` (all network interfaces), **not** only `127.0.0.1`. Otherwise other machines cannot reach it.
- Every response is JSON with header `Content-Type: application/json`.
- Every response (and every `OPTIONS` request) carries these CORS headers, so the browser page may call you from another port:
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type`
  - `OPTIONS` (any path) answers `204` with those headers.
- `GET /health` on every service returns `200` and `{"service": "<name>", "status": "ok"}`, without any simulated work. (Node runs your code on one thread: while a service is busy with other requests, `/health` has to wait its turn. That is normal.)
- Print one line per request in the terminal (time, method, path, status). You will read these logs during the exercise.
- A bad request must give a `400` with `{"error": "..."}`. The program must never crash.

## product service: port 3001

| Request | Answer |
|---|---|
| `GET /products` | `200` `{"products": [ {"id": "p1", "name": "USB-C cable 1 m", "price": 9.9}, ... ]}`. At least 3 products. `id` and `name` are strings, `price` is a number greater than 0. |
| `GET /products/<id>` | `200` with that one product object, or `404` `{"error": "product not found"}`. |

Simulated work: about **10 ms of CPU** per request (see "Simulated CPU work" below).

## cart service: port 3002

One shared cart, kept in memory.

| Request | Answer |
|---|---|
| `GET /cart` | `200` `{"items": [ {"productId": "p1", "qty": 2} ]}` |
| `POST /cart` with body `{"productId": "p1", "qty": 1}` | `201` and the whole cart as above. If the productId is already in the cart, **add** to its qty. `qty` must be an integer of 1 or more, otherwise `400`. |
| `DELETE /cart` | `200` `{"items": []}` |

Simulated work: about **5 ms of CPU** per request.

## payment service: port 3003

| Request | Answer |
|---|---|
| `POST /pay` with body `{"amount": 19.8, "card": "4242424242424242"}` | `200` `{"status": "approved", "id": "pay-1", "amount": 19.8}`. The id changes with every payment. |
| `POST /pay` with `amount` 0 or less, or a missing card (shorter than 4 characters) | `400` `{"status": "declined", "error": "..."}` |

Simulated work: about **30 ms of CPU** per request.

## agent: port 9100 (the monitor reads it)

| Request | Answer |
|---|---|
| `GET /metrics` | `200` `{"host": "vm-a", "cpuPct": 12.5, "memPct": 31.0, "load1": 0.2, "cores": 1}` |

- `cpuPct` = how busy **the whole VM** is, 0 to 100. Linux gives you this in `/proc/stat` (first line, `cpu`). Take two readings one second apart. Busy share = `1 - (idle change / total change)`, where idle = idle + iowait. A timer (`setInterval`) that updates it every second works well.
- `memPct` = `100 * (1 - MemAvailable / MemTotal)`, from `/proc/meminfo`.
- `load1` = first number in `/proc/loadavg`. `cores` = `os.cpus().length`.
- The agent does no simulated work.

## Simulated CPU work

Real shops do real work per request (database, encryption, ...). We simulate it with a loop that keeps the CPU busy for a number of milliseconds:

```js
function burn(ms) {
  const end = process.hrtime.bigint() + BigInt(Math.round(ms * 1e6));
  while (process.hrtime.bigint() < end) { /* busy */ }
}
```

Call `burn(30)` in payment, `burn(10)` in product, `burn(5)` in cart, **after** `/health` has been handled. This is what makes the load tests in Stage 4 meaningful: one payment process can serve at most 1000 / 30 = about 33 requests per second.

## Prompt you can paste into your AI assistant

> Write one Node.js program for Node 18, using only built-in modules (`http`, `fs`, `os`). No npm packages, no Express. Use `http.createServer`. Follow the contract below exactly: port, paths, JSON shapes, status codes, CORS headers, `/health`, one log line per request, and the simulated CPU work (the `burn` function). Listen on `0.0.0.0`. Never crash on a bad request. Accept an optional port number as the first command-line argument (`process.argv[2]`). [Paste the section for ONE service here.]

Ask for **one program per service** (`product.js`, `cart.js`, `payment.js`, `agent.js`). Run the checker after each one: `node contract-check.js <VM-IP>` (add `--agent` for the agent). Use the VM's own IP, not `localhost`: that also catches a program that listens only on 127.0.0.1.
