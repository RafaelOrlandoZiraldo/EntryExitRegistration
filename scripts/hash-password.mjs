import { randomBytes, webcrypto } from "node:crypto";

const password = process.argv[2];

if (!password) {
  console.error('Usage: npm run auth:hash -- "password"');
  process.exit(1);
}

const iterations = Number.parseInt(
  process.env.VITE_AUTH_PASSWORD_ITERATIONS ?? "310000",
  10
);

if (!Number.isInteger(iterations) || iterations <= 0) {
  console.error("VITE_AUTH_PASSWORD_ITERATIONS must be a positive integer.");
  process.exit(1);
}

const salt = randomBytes(16);
const passwordKey = await webcrypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(password),
  "PBKDF2",
  false,
  ["deriveBits"]
);
const derivedBits = await webcrypto.subtle.deriveBits(
  {
    name: "PBKDF2",
    hash: "SHA-256",
    salt,
    iterations
  },
  passwordKey,
  256
);

console.log(`VITE_AUTH_PASSWORD_SALT=${salt.toString("base64")}`);
console.log(
  `VITE_AUTH_PASSWORD_HASH=${Buffer.from(derivedBits).toString("base64")}`
);
console.log(`VITE_AUTH_PASSWORD_ITERATIONS=${iterations}`);
