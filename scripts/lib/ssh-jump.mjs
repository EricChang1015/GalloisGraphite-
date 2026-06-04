/**
 * SSH helper: connect to target host via jump (ProxyJump-style).
 * Reads credentials from .env.local — never log passwords.
 */
import { Client } from "ssh2";
import { loadEnvLocal } from "./supabase-env.mjs";

/**
 * @param {object} opts
 * @param {(conn: import('ssh2').Client) => void | Promise<void>} opts.onTarget
 */
export async function withJumpSsh({ onTarget }) {
  const env = loadEnvLocal();

  const proxyHost = env.SSH_PROXY_HOST;
  const proxyUser = env.SSH_PROXY_ACCOUNT;
  const proxyPass = env.SSH_PROXY_PASSWORD;
  const targetHost = env.SELF_HOST_SUPABASE_HOST;
  const targetUser = env.SELF_HOST_SUPABASE_ACCOUNT;
  const targetPass = env.SELF_HOST_SUPABASE_PASSWORD;

  for (const [k, v] of Object.entries({
    SSH_PROXY_HOST: proxyHost,
    SSH_PROXY_ACCOUNT: proxyUser,
    SSH_PROXY_PASSWORD: proxyPass,
    SELF_HOST_SUPABASE_HOST: targetHost,
    SELF_HOST_SUPABASE_ACCOUNT: targetUser,
    SELF_HOST_SUPABASE_PASSWORD: targetPass,
  })) {
    if (!v) throw new Error(`Missing ${k} in .env.local`);
  }

  const jump = new Client();
  const target = new Client();

  await new Promise((resolve, reject) => {
    jump
      .on("ready", () => {
        jump.forwardOut(
          "127.0.0.1",
          0,
          targetHost,
          22,
          (err, stream) => {
            if (err) {
              reject(err);
              return;
            }
            target
              .on("ready", resolve)
              .on("error", reject)
              .connect({
                sock: stream,
                username: targetUser,
                password: targetPass,
                readyTimeout: 30000,
              });
          },
        );
      })
      .on("error", reject)
      .connect({
        host: proxyHost,
        username: proxyUser,
        password: proxyPass,
        readyTimeout: 30000,
      });
  });

  try {
    await onTarget(target);
  } finally {
    target.end();
    jump.end();
  }
}

/**
 * Run a single shell command on target; streams stdout/stderr.
 * @param {import('ssh2').Client} conn
 * @param {string} command
 */
export function execCommand(conn, command, { quiet = false } = {}) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }
      let stdout = "";
      let stderr = "";
      stream
        .on("close", (code) => {
          if (code !== 0) {
            reject(
              new Error(
                `Command failed (exit ${code}): ${command}\n${stderr || stdout}`,
              ),
            );
            return;
          }
          resolve(stdout);
        })
        .on("data", (d) => {
          stdout += d.toString();
          if (!quiet) process.stdout.write(d);
        });
      stream.stderr.on("data", (d) => {
        stderr += d.toString();
        if (!quiet) process.stderr.write(d);
      });
    });
  });
}

/**
 * Upload a local file to remote path via SFTP.
 * @param {import('ssh2').Client} conn
 * @param {string} localPath
 * @param {string} remotePath
 */
export function uploadBuffer(conn, remotePath, data) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) {
        reject(err);
        return;
      }
      const stream = sftp.createWriteStream(remotePath);
      stream.on("close", () => {
        sftp.end();
        resolve(undefined);
      });
      stream.on("error", (writeErr) => {
        sftp.end();
        reject(writeErr);
      });
      stream.end(data);
    });
  });
}

export function uploadFile(conn, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) {
        reject(err);
        return;
      }
      sftp.fastPut(localPath, remotePath, (putErr) => {
        sftp.end();
        if (putErr) reject(putErr);
        else resolve(undefined);
      });
    });
  });
}
