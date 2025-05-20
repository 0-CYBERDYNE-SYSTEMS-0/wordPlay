#!/usr/bin/env node

// This script is used to initialize the database by running migrations
// and creating initial seed data

const { execSync } = require('child_process');

console.log('Initializing database...');

try {
  // First run drizzle-kit to generate migrations
  console.log('Generating database migrations...');
  execSync('npx drizzle-kit generate:pg', { stdio: 'inherit' });
  
  // Then push the schema to the database
  console.log('Pushing schema to database...');
  execSync('npx drizzle-kit push:pg', { stdio: 'inherit' });
  
  console.log('Database initialized successfully!');
} catch (error) {
  console.error('Failed to initialize database:', error);
  process.exit(1);
}