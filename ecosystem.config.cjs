// pm2 konfiqurasiyası (plan bölmə 3, "Deploy: pm2 + Express-dən static serve").
// `.cjs` uzantısı — kök package.json-da "type":"module" var, pm2 CommonJS gözləyir.
// `script` birbaşa tsx-in CLI faylına işarə edir (Windows-da "npm"/"npx" kimi .CMD
// wrapper-ləri pm2 JS kimi parse etməyə çalışıb sintaksis xətası verir) —
// eyni, artıq sınaqdan keçmiş giriş nöqtəsi (`tsx src/main.ts`).
module.exports = {
  apps: [
    {
      name: "crypto-trend-agent",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "src/main.ts",
      interpreter: "node",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
