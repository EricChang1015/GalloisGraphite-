#!/usr/bin/env node
/* eslint-disable no-console */
/** Extend root filesystem after AWS EBS volume resize (requires sudo on target). */
import { execCommand, withJumpSsh } from "./lib/ssh-jump.mjs";
import { loadEnvLocal } from "./lib/supabase-env.mjs";

function sudoCmd(command, password) {
  const esc = password.replace(/'/g, "'\\''");
  return `echo '${esc}' | sudo -S ${command}`;
}

const env = loadEnvLocal();
const pass = env.SELF_HOST_SUPABASE_PASSWORD;
if (!pass) throw new Error("Missing SELF_HOST_SUPABASE_PASSWORD in .env.local");

await withJumpSsh({
  async onTarget(c) {
    console.log("=== Before ===");
    await execCommand(c, "df -h /; lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINTS /dev/nvme0n1");

    console.log("\n=== Partition layout ===");
    await execCommand(c, sudoCmd("parted /dev/nvme0n1 unit GB print free", pass));

    console.log("\n=== growpart /dev/nvme0n1 1 ===");
    await execCommand(c, sudoCmd("growpart /dev/nvme0n1 1", pass));

    console.log("\n=== resize2fs /dev/nvme0n1p1 ===");
    await execCommand(c, sudoCmd("resize2fs /dev/nvme0n1p1", pass));

    console.log("\n=== After ===");
    await execCommand(c, "df -h /; lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINTS /dev/nvme0n1");
  },
});

console.log("\n✓ Root filesystem extended.");
