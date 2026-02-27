const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define Paths
const sourceDir = path.join(__dirname, '..', 'dist', 'win-unpacked');
const destDir = 'D:\\PC Sync\\built\\autoslice';

console.log(`\n📦 AutoSlice Post-Build Script`);
console.log(`Copying built executable folder to sync directory...`);
console.log(`Source:      ${sourceDir}`);
console.log(`Destination: ${destDir}\n`);

// Check if source exists
if (!fs.existsSync(sourceDir)) {
    console.error(`❌ Source directory not found: ${sourceDir}`);
    console.error(`Make sure to run 'npm run build' before this script.`);
    process.exit(1);
}

// Function to safely copy directory recursively in Windows
function copyFolderSync(from, to) {
    if (!fs.existsSync(to)) {
        fs.mkdirSync(to, { recursive: true });
    }

    const files = fs.readdirSync(from);

    for (const file of files) {
        const fromPath = path.join(from, file);
        const toPath = path.join(to, file);
        const stat = fs.statSync(fromPath);

        if (stat.isDirectory()) {
            copyFolderSync(fromPath, toPath);
        } else {
            // Overwrite existing files
            fs.copyFileSync(fromPath, toPath);
        }
    }
}

try {
    copyFolderSync(sourceDir, destDir);
    console.log(`✅ Successfully copied built application to D:\\PC Sync\\built\\autoslice`);
} catch (error) {
    console.error(`❌ Failed to copy built application:`, error.message);
    process.exit(1);
}
