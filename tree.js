const fs = require('fs');
const path = require('path');

function generateTree(dir, prefix = '', ignoreList = ['node_modules', '.git', 'dist', 'build']) {
  const files = fs.readdirSync(dir);
  const filteredFiles = files.filter(file => !ignoreList.includes(file) && !file.startsWith('.'));
  
  filteredFiles.forEach((file, index) => {
    const filePath = path.join(dir, file);
    const isLast = index === filteredFiles.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    
    console.log(prefix + connector + file);
    
    if (fs.statSync(filePath).isDirectory()) {
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      generateTree(filePath, newPrefix, ignoreList);
    }
  });
}

// Start from current directory
generateTree('.');