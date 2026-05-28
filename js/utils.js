// ==========================================
// utils.js - Math and Spatial Logic
// ==========================================

function updateMapBounds() {
    if (currentMap.type === 'bridge') {
        const bridgeHeight = 450;
        currentMap.left = 0;
        currentMap.right = canvas.width;
        currentMap.top = canvas.height / 2 - bridgeHeight / 2;
        currentMap.bottom = canvas.height / 2 + bridgeHeight / 2;
    } else {
        currentMap.left = 0;
        currentMap.right = canvas.width;
        currentMap.top = 0;
        currentMap.bottom = canvas.height;
    }
}

function resize() { 
    canvas.width = window.innerWidth; 
    canvas.height = window.innerHeight; 
    updateMapBounds(); 
}
window.addEventListener('resize', resize); 
resize();

function clampToBounds(obj, radius) {
    obj.x = Math.max(currentMap.left + radius, Math.min(currentMap.right - radius, obj.x));
    obj.y = Math.max(currentMap.top + radius, Math.min(currentMap.bottom - radius, obj.y));
}

function getVector(x1, y1, x2, y2) { 
    const dx = x2 - x1; 
    const dy = y2 - y1; 
    return [dx, dy, Math.hypot(dx, dy)]; 
}

function distToSegment(px, py, x1, y1, x2, y2) {
    let l2 = (x1-x2)*(x1-x2) + (y1-y2)*(y1-y2);
    if (l2 === 0) return Math.hypot(px-x1, py-y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2; 
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

function getNearestEnemyFromPoint(x, y, range, excludeList = []) {
    let nearest = null; 
    let minDist = range;
    for(const e of enemies) { 
        if (excludeList.includes(e)) continue; 
        const dist = Math.hypot(e.x - x, e.y - y); 
        if(dist < minDist) { minDist = dist; nearest = e; } 
    }
    return nearest;
}