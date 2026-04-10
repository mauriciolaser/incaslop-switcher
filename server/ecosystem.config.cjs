module.exports = {
  apps: [
    {
      name: 'mechas-incaslop-online',
      script: 'src/app.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 20,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
