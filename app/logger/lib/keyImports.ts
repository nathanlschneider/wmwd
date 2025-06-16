import * as fs from "fs";

let privateKey: string;
try {
  privateKey = fs.readFileSync(
    process.cwd() + "/app/logger/lib/keys/private.pem",
    "utf8"
  );
} catch (error) {
  console.error("Failed to load private key:", error);
  process.exit(1); 
}

let publicKey: string;
try {
  publicKey = fs.readFileSync(
    process.cwd() + "/app/logger/lib/keys/public.pem",
    "utf8"
  );
} catch (error) {
  console.error("Failed to load public key:", error);
  process.exit(1);
}

export { privateKey, publicKey };