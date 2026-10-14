// config.js - the ONLY file you edit to point the pages at your VMs.
// HOST = the machine that served this page (your vm-a).
const HOST = location.hostname || 'localhost';

window.CONFIG = {
  // Where each service lives. In Stage 5 you move payment to vm-b:
  // replace HOST in the payment line with vm-b's IP address, for example 'http://192.168.64.6:3003'
  services: {
    product: 'http://' + HOST + ':3001',
    cart:    'http://' + HOST + ':3002',
    payment: 'http://' + HOST + ':3003',
  },
  // Which VMs the monitor watches. Add vm-b in Stage 5 (remove the // and put its real IP).
  vms: [
    { name: 'vm-a', host: HOST },
    // { name: 'vm-b', host: '192.168.64.6' },
  ],
  alertCpuPct: 80,   // the monitor raises an alert at or above this CPU %
};
