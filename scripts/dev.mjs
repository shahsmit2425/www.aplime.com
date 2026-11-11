import { spawn } from "node:child_process";
const launch = (entry, env) =>
  spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "watch", entry], {
    stdio: "inherit",
    env: { ...process.env, ...env },
    windowsHide: true,
  });
const children = [
  launch("apps/api/server.ts", {
    PORT: "3001",
    API_URL: "http://127.0.0.1:3001",
  }),
  launch("apps/web/server.ts", {
    PORT: "5173",
    API_URL: "http://127.0.0.1:3001",
  }),
];
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    for (const c of children) c.kill();
    process.exit();
  });
