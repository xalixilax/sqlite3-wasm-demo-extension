#!/usr/bin/env node
/**
 * Strip "export {};" statements from compiled JavaScript files
 * for Chrome extension compatibility
 */

const fs = require('fs');
const path = require('path');

function stripExports(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip jswasm directory
      if (file !== 'jswasm') {
        stripExports(filePath);
      }
    } else if (file.endsWith('.js')) {
      let content = fs.readFileSync(filePath, 'utf8');
      // Remove "export {};" statements (with or without spaces)
      content = content.replace(/^export\s*\{\s*\}\s*;?\s*$/gm, '');
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Stripped exports from ${filePath}`);
    }
  }
}

const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  stripExports(distDir);
  console.log('Export stripping complete!');
} else {
  console.error('dist directory not found');
  process.exit(1);
}
