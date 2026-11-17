// Shared WebRTC setup for private order livestreams.
//
// Video flows directly between the artisan's and the customer's browsers.
// The API only relays the handshake, and it does so by polling, so we use
// "non-trickle" ICE: wait until all network candidates are gathered, then
// send one complete offer/answer instead of streaming candidates one by one.

// STUN is enough on most home/mobile networks. For strict networks (some
// office Wi-Fi, carrier-grade NAT) add a TURN server through env vars:
//   VITE_TURN_URL=turn:turn.example.com:3478
//   VITE_TURN_USERNAME=...   VITE_TURN_CREDENTIAL=...
function iceServers() {
  const servers = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const turn = import.meta.env.VITE_TURN_URL;
  if (turn) {
    servers.push({
      urls: turn,
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CREDENTIAL,
    });
  }
  return servers;
}

export const POLL_MS = 2000;

export function createPeer() {
  return new RTCPeerConnection({ iceServers: iceServers() });
}

// Resolves once ICE gathering finishes, or after `timeoutMs` with whatever
// candidates have been found so far (usually plenty).
function waitForIce(pc, timeoutMs = 4000) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    };
    const check = () => pc.iceGatheringState === 'complete' && done();
    const timer = setTimeout(done, timeoutMs);
    pc.addEventListener('icegatheringstatechange', check);
  });
}

// Plain { type, sdp } object, safe to JSON-encode for the API.
function plain(desc) {
  return { type: desc.type, sdp: desc.sdp };
}

export async function makeOffer(pc) {
  await pc.setLocalDescription(await pc.createOffer());
  await waitForIce(pc);
  return plain(pc.localDescription);
}

export async function makeAnswer(pc, offer) {
  await pc.setRemoteDescription(offer);
  await pc.setLocalDescription(await pc.createAnswer());
  await waitForIce(pc);
  return plain(pc.localDescription);
}

export function cameraErrorMessage(err) {
  if (!window.isSecureContext) {
    return 'The camera only works over HTTPS (or on localhost). Open the site through a secure address.';
  }
  if (err?.name === 'NotAllowedError') return 'Camera permission was denied. Allow it in your browser settings.';
  if (err?.name === 'NotFoundError') return 'No camera was found on this device.';
  return err?.message || 'Could not open the camera.';
}
