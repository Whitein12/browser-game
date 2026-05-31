const fs = require('fs');
try {
    const data = JSON.parse(fs.readFileSync('data/classes.json', 'utf8'));
    fs.writeFileSync('val_result.txt', 'Valid JSON, keys: ' + Object.keys(data).join(', '));
} catch (e) {
    fs.writeFileSync('val_result.txt', 'Error: ' + e.message);
}
