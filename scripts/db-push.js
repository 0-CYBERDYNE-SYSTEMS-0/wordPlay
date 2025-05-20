#!/usr/bin/env node

const { exec } = require('child_process');

// Run drizzle-kit push
exec('npx drizzle-kit push:pg', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error executing drizzle-kit push: ${error.message}`);
    process.exit(1);
  }
  
  console.log(stdout);
  
  if (stderr) {
    console.error(stderr);
  }
  
  console.log('Database schema pushed successfully');
});