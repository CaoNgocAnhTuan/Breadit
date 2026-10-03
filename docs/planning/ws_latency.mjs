/**
 * Breadit WebSocket Latency Measurement (v2 — Automatic Auth)
 * 
 * Measures the round-trip time from sending a like action to receiving
 * the resulting Socket.IO notification event.
 * 
 * Prerequisites:
 *   npm install socket.io-client
 * 
 * Run:
 *   node docs/planning/ws_latency.mjs
 */

import { io } from 'socket.io-client';

const BACKEND_URL = 'http://localhost:4000';
const TARGET_POST_ID = 389; // ID of post owned by user8
const ITERATIONS = 10;     // Number of measurements to take

async function getCookie(email, password) {
  const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email} (${res.status})`);
  }
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error(`No Set-Cookie header in login response for ${email}`);
  }
  const match = setCookie.match(/breadit_session=([^;]+)/);
  if (!match) {
    throw new Error(`Could not find breadit_session in Set-Cookie header for ${email}`);
  }
  return match[1];
}

async function measureLatency() {
  console.log('Logging in test users...');
  
  // user1 will be the Actor (sends the HTTP like)
  const cookieActor = await getCookie('user1@example.com', 'password');
  
  // user8 will be the Recipient (receives notification via WebSocket on their post #389)
  const cookieRecipient = await getCookie('user8@example.com', 'password');

  console.log(`Actor cookie length: ${cookieActor?.length}`);
  console.log(`Recipient cookie length: ${cookieRecipient?.length}`);

  console.log('Connecting to Socket.IO as Recipient (user8)...');
  const socket = io(BACKEND_URL, {
    withCredentials: true,
    extraHeaders: {
      cookie: `breadit_session=${cookieRecipient}`,
      Cookie: `breadit_session=${cookieRecipient}`,
    },
    transports: ['websocket'],
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connect_error:', err);
  });

  socket.on('disconnect', (reason) => {
    console.warn('Socket disconnected. Reason:', reason);
  });

  await new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('connect_error', reject);
    setTimeout(() => reject(new Error('Connection timeout')), 5000);
  });

  console.log(`Connected. Socket ID: ${socket.id}`);

  // Join the recipient's room on the Socket.IO gateway
  console.log('Emitting newUser for user8...');
  socket.emit('newUser', 'user8');

  console.log(`Running ${ITERATIONS} iterations on Post #${TARGET_POST_ID}...\n`);

  const delays = [];

  for (let i = 0; i < ITERATIONS; i++) {
    const startTime = performance.now();

    // Actor likes Recipient's post
    const res = await fetch(
      `${BACKEND_URL}/api/posts/${TARGET_POST_ID}/like`,
      {
        method: 'POST',
        headers: {
          Cookie: `breadit_session=${cookieActor}`,
        },
      }
    );

    if (!res.ok) {
      console.warn(`  Iteration ${i + 1}: HTTP ${res.status} — skipping`);
      continue;
    }

    // Wait for the notification event to arrive via Recipient's socket
    const notifReceived = await new Promise((resolve) => {
      const handler = (data) => {
        resolve(data);
        socket.off('getNotification', handler);
      };
      socket.on('getNotification', handler);

      // Timeout after 2000ms
      setTimeout(() => {
        socket.off('getNotification', handler);
        resolve(null);
      }, 2000);
    });

    const elapsed = performance.now() - startTime;

    if (notifReceived) {
      delays.push(elapsed);
      console.log(`  [${i + 1}/${ITERATIONS}] Notification received in: ${elapsed.toFixed(2)} ms`);
    } else {
      console.log(`  [${i + 1}/${ITERATIONS}] No notification received within 2000ms`);
    }

    // Unlike post to reset state
    await fetch(`${BACKEND_URL}/api/posts/${TARGET_POST_ID}/like`, {
      method: 'POST',
      headers: { 
        Cookie: `breadit_session=${cookieActor}` 
      },
    });

    await new Promise((r) => setTimeout(r, 400));
  }

  socket.disconnect();

  if (delays.length === 0) {
    console.log('\nNo successful measurements. Check if post exists and users are seeded.');
    return;
  }

  const avg = delays.reduce((a, b) => a + b, 0) / delays.length;
  const sorted = [...delays].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  console.log('\n========================================');
  console.log('  WEBSOCKET NOTIFICATION LATENCY REPORT');
  console.log('  (Action emit → client notification received)');
  console.log('========================================');
  console.log(`  Samples : ${delays.length}`);
  console.log(`  Average : ${avg.toFixed(2)} ms`);
  console.log(`  Median  : ${p50.toFixed(2)} ms`);
  console.log(`  p95     : ${p95.toFixed(2)} ms`);
  console.log(`  Min     : ${min.toFixed(2)} ms`);
  console.log(`  Max     : ${max.toFixed(2)} ms`);
  console.log('========================================');
  console.log('\nCopy these numbers into Chapter 5 Evaluation.');
}

measureLatency().catch(console.error);
