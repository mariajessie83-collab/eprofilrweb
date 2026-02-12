// Shared Signature Pad Functionality
let canvas, ctx;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let strokeCount = 0;
let points = [];

window.initializeSignatureCanvas = () => {
    console.log('Initializing signature canvas...');
    
    let canvasElement = document.getElementById('signatureCanvas');
    
    if (!canvasElement) {
        console.log('Canvas not found, retrying in 200ms...');
        setTimeout(() => {
            canvasElement = document.getElementById('signatureCanvas');
            if (canvasElement) {
                initializeCanvas(canvasElement);
            }
        }, 200);
        return;
    }
    
    initializeCanvas(canvasElement);
};

function initializeCanvas(canvasElement) {
    if (canvasElement) {
        canvas = canvasElement;
        ctx = canvas.getContext('2d');
        strokeCount = 0;
        points = [];
        
        // Set canvas size
        canvas.width = canvasElement.offsetWidth || 500;
        canvas.height = canvasElement.offsetHeight || 200;
        
        // Set drawing style
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Pointer Events for versatility (Mouse, Touch, Stylus)
        canvas.addEventListener('pointerdown', (e) => {
            isDrawing = true;
            strokeCount++;
            points = [];
            
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            
            lastX = (e.clientX - rect.left) * scaleX;
            lastY = (e.clientY - rect.top) * scaleY;
            
            points.push({ x: lastX, y: lastY, pressure: e.pressure || 0.5 });
        });
        
        canvas.addEventListener('pointermove', (e) => {
            if (!isDrawing) return;
            
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            
            const currentX = (e.clientX - rect.left) * scaleX;
            const currentY = (e.clientY - rect.top) * scaleY;
            const pressure = e.pressure || 0.5;
            
            ctx.lineWidth = 1.5 + (pressure * 3);
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(currentX, currentY);
            ctx.stroke();
            
            lastX = currentX;
            lastY = currentY;
        });
        
        canvas.addEventListener('pointerup', () => { isDrawing = false; });
        canvas.addEventListener('pointerleave', () => { isDrawing = false; });
        
        // Prevent scrolling on touch
        canvas.addEventListener('touchstart', (e) => e.preventDefault());
        canvas.addEventListener('touchmove', (e) => e.preventDefault());
    }
}

window.clearSignature = () => {
    if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        strokeCount = 0;
    }
};

window.getSignatureData = () => {
    if (!canvas || strokeCount === 0) return '';
    return canvas.toDataURL('image/png').split(',')[1];
};
