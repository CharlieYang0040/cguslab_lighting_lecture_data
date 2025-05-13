// drawing.js - 그리기 로직, 도구 제어, 슬라이드 간 그리기 내용 저장/복원 

(function() { // IIFE to encapsulate the drawing logic
    if (!document.getElementById('drawing-canvas')) {
        // If canvas doesn't exist (e.g. on a page not using this feature), do nothing.
        return;
    }

    // DOM Elements
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');
    const drawingToolbar = document.getElementById('drawing-toolbar');
    const toggleDrawModeBtn = document.getElementById('toggle-draw-mode');
    const closeDrawingToolbarBtn = document.getElementById('close-drawing-toolbar');

    const penToolBtn = document.getElementById('pen-tool');
    const eraserToolBtn = document.getElementById('eraser-tool');
    const colorPicker = document.getElementById('color-picker');
    const lineWidthRange = document.getElementById('line-width');
    const clearCanvasBtn = document.getElementById('clear-canvas');

    // Drawing state
    let isDrawingModeActive = false;
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let currentTool = 'pen'; // 'pen' or 'eraser'
    let currentColor = '#FF0000'; // Default to red as per HTML
    let currentLineWidth = 5;    // Default to 5 as per HTML

    const slideDrawings = new Map(); // To store drawings for each slide

    // --- Canvas Setup and Resizing ---
    function setupCanvas() {
        const slideContainer = document.getElementById('slide-container');
        const iframe = slideContainer.querySelector('iframe');
        const presentationContainer = document.getElementById('presentation-container');

        console.log('[drawing.js setupCanvas] Called'); // Log when called

        if (iframe && presentationContainer) {
            const iframeRect = iframe.getBoundingClientRect(); 
            const presentationContainerRect = presentationContainer.getBoundingClientRect();

            canvas.width = iframeRect.width;
            canvas.height = iframeRect.height;
            const calculatedLeft = iframeRect.left - presentationContainerRect.left;
            const calculatedTop = iframeRect.top - presentationContainerRect.top;
            canvas.style.left = calculatedLeft + 'px';
            canvas.style.top = calculatedTop + 'px';
            canvas.style.transform = 'none'; 

            console.log(`[drawing.js setupCanvas] iframeRect: L=${iframeRect.left}, T=${iframeRect.top}, W=${iframeRect.width}, H=${iframeRect.height}`);
            console.log(`[drawing.js setupCanvas] presentationContainerRect: L=${presentationContainerRect.left}, T=${presentationContainerRect.top}`);
            console.log(`[drawing.js setupCanvas] Canvas set to: W=${canvas.width}, H=${canvas.height}, Style L=${canvas.style.left}, Style T=${canvas.style.top}`);
        } else {
            // Fallback if iframe or presentationContainer not found
            const fallbackContainer = presentationContainer || slideContainer || document.body;
            const fallbackRect = fallbackContainer.getBoundingClientRect();
            canvas.width = fallbackRect.width;
            canvas.height = fallbackRect.height;
            canvas.style.left = (fallbackRect.left - (fallbackContainer.offsetParent ? fallbackContainer.offsetParent.getBoundingClientRect().left : 0)) + 'px';
            canvas.style.top = (fallbackRect.top - (fallbackContainer.offsetParent ? fallbackContainer.offsetParent.getBoundingClientRect().top : 0)) + 'px';
            canvas.style.transform = 'none';
            // console.log('Canvas setup (fallback):', canvas.width, canvas.height);
        }

        // Explicitly reset the context transform matrix
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Re-apply drawing properties as canvas context is reset when width/height changes
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentLineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.globalCompositeOperation = (currentTool === 'eraser') ? 'destination-out' : 'source-over';
        // Note: When canvas size changes, existing drawings need to be redrawn (scaled).
        // This is handled by `loadDrawing` being called after `setupCanvas`.
    }

    // --- Drawing Mode Toggle ---
    function toggleDrawMode(forceState) {
        isDrawingModeActive = (typeof forceState === 'boolean') ? forceState : !isDrawingModeActive;
        
        if (isDrawingModeActive) {
            setupCanvas(); // Setup canvas dimensions and context when activating
            canvas.style.display = 'block';
            drawingToolbar.style.display = 'flex'; // Use flex as per CSS
            toggleDrawModeBtn.classList.add('active'); // Indicate active state
        } else {
            canvas.style.display = 'none';
            drawingToolbar.style.display = 'none';
            toggleDrawModeBtn.classList.remove('active');
        }
    }

    toggleDrawModeBtn.addEventListener('click', () => toggleDrawMode());
    closeDrawingToolbarBtn.addEventListener('click', () => toggleDrawMode(false));

    // --- Drawing Event Handlers ---
    function getMousePos(e) {
        const rect = canvas.getBoundingClientRect(); 
        let scale = 1;
        const iframe = document.querySelector('#slide-container iframe');
        if (iframe && iframe.dataset.scaleFactor) {
            scale = parseFloat(iframe.dataset.scaleFactor);
        }
        
        const x_raw = e.clientX - rect.left;
        const y_raw = e.clientY - rect.top;
        const final_x = x_raw / scale;
        const final_y = y_raw / scale;

        console.log(`[drawing.js getMousePos] clientX/Y: (${e.clientX}, ${e.clientY}), canvasRect L/T: (${rect.left}, ${rect.top}), scale: ${scale}, raw x/y: (${x_raw.toFixed(2)}, ${y_raw.toFixed(2)}), final x/y: (${final_x.toFixed(2)}, ${final_y.toFixed(2)})`);

        return {
            x: final_x,
            y: final_y
        };
    }
    
    function getTouchPos(touchEvent) {
        const rect = canvas.getBoundingClientRect();
        let scale = 1;
        const iframe = document.querySelector('#slide-container iframe');
        if (iframe && iframe.dataset.scaleFactor) {
            scale = parseFloat(iframe.dataset.scaleFactor);
        }

        if (touchEvent.touches && touchEvent.touches.length > 0) {
            return {
                x: (touchEvent.touches[0].clientX - rect.left) / scale,
                y: (touchEvent.touches[0].clientY - rect.top) / scale
            };
        }
        return { x: 0, y: 0 }; 
    }

    function startDrawing(e) {
        if (!isDrawingModeActive) return;
        isDrawing = true;
        let pos;
        if (e.touches) {
            pos = getTouchPos(e);
        } else {
            pos = getMousePos(e);
        }
        [lastX, lastY] = [pos.x, pos.y];
        // ctx.beginPath(); // Start a new path for each stroke segment if desired, or keep it continuous
    }

    function draw(e) {
        if (!isDrawing || !isDrawingModeActive) return;
        e.preventDefault(); // Prevent scrolling while drawing on touch devices

        let pos;
        if (e.touches) {
            pos = getTouchPos(e);
        } else {
            pos = getMousePos(e);
        }

        ctx.beginPath(); // Crucial: begin new path segment
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        [lastX, lastY] = [pos.x, pos.y];
    }

    function stopDrawing() {
        if (!isDrawingModeActive) return;
        isDrawing = false;
        // ctx.beginPath(); // Reset path to prevent connecting future lines, if not done in startDrawing/draw
    }

    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // Touch events
    canvas.addEventListener('touchstart', (e) => {
        if (!isDrawingModeActive || e.touches.length !== 1) return;
        e.preventDefault(); // Important for preventing default touch actions like scroll/zoom
        startDrawing(e);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (!isDrawingModeActive || e.touches.length !== 1) return;
        e.preventDefault(); 
        draw(e);
    }, { passive: false });

    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);

    // --- Tool Implementation ---
    function setActiveTool(tool) {
        currentTool = tool;
        if (tool === 'pen') {
            penToolBtn.classList.add('active');
            eraserToolBtn.classList.remove('active');
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = currentColor; // Apply current color for pen
        } else if (tool === 'eraser') {
            penToolBtn.classList.remove('active');
            eraserToolBtn.classList.add('active');
            ctx.globalCompositeOperation = 'destination-out';
            // Eraser doesn't use strokeStyle for color, but its "color" is effectively transparent
            // The lineWidth still applies to the eraser size
        }
        ctx.lineWidth = currentLineWidth; // Ensure lineWidth is up-to-date for the tool
    }

    penToolBtn.addEventListener('click', () => setActiveTool('pen'));
    eraserToolBtn.addEventListener('click', () => setActiveTool('eraser'));

    colorPicker.addEventListener('input', (e) => {
        currentColor = e.target.value;
        if (currentTool === 'pen') { // Only change strokeStyle if pen is active
            ctx.strokeStyle = currentColor;
        }
    });

    lineWidthRange.addEventListener('input', (e) => {
        currentLineWidth = parseInt(e.target.value, 10);
        ctx.lineWidth = currentLineWidth;
    });

    clearCanvasBtn.addEventListener('click', () => {
        if (isDrawingModeActive) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Also remove the saved drawing for the current slide if one exists
            if (window.drawingUtils && typeof window.drawingUtils.getCurrentSlideId === 'function') {
                const currentSlideId = window.drawingUtils.getCurrentSlideId();
                if (currentSlideId) {
                    slideDrawings.delete(currentSlideId);
                    // console.log(`Cleared drawing and removed saved data for ${currentSlideId}`);
                }
            }
        }
    });

    // Initialize default tool state
    setActiveTool('pen');
    colorPicker.value = currentColor; // Ensure UI matches state
    lineWidthRange.value = currentLineWidth; // Ensure UI matches state

    // --- Save and Load Drawings ---
    function saveDrawing(slideId) {
        if (!slideId || !canvas) return;
        // console.log(`Attempting to save drawing for ${slideId}`);
        if (canvas.width > 0 && canvas.height > 0) {
            const dataURL = canvas.toDataURL(); // Get canvas content as image data
            slideDrawings.set(slideId, dataURL);
            // console.log(`Saved drawing for ${slideId}`, dataURL.substring(0, 50) + "...");
        } else {
            // console.warn(`Canvas not ready or has zero dimensions for ${slideId}. Drawing not saved.`);
        }
    }

    function loadDrawing(slideId) {
        if (!slideId || !canvas) return;
        // console.log(`Attempting to load drawing for ${slideId}`);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear before drawing

        if (slideDrawings.has(slideId)) {
            const dataURL = slideDrawings.get(slideId);
            // console.log(`Found drawing for ${slideId}. Loading...`, dataURL.substring(0, 50) + "...");
            const img = new Image();
            img.onload = () => {
                // console.log(`Image loaded for ${slideId}. Drawing to canvas, scaled to fit.`);
                // Draw the image scaled to the current canvas dimensions
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.onerror = (err) => {
                console.error('Error loading image data for slide:', slideId, err);
            };
            img.src = dataURL;
        } else {
            // console.log(`No saved drawing found for ${slideId}. Canvas will be clear.`);
            // Canvas is already cleared, so nothing more to do here.
        }
    }

    // --- Expose functions for external use (e.g., by index.html) ---
    window.drawingUtils = {
        setupCanvas: setupCanvas, // Expose setupCanvas function
        isDrawingActive: () => isDrawingModeActive, // Expose a way to check if drawing mode is active
        clearCanvasForSlideChange: () => {
             if (isDrawingModeActive) {
                // console.log("Clearing canvas for slide change (if needed by save/restore logic)");
                // This is now handled by loadDrawing which clears canvas first.
             }
        },
        saveDrawingForSlide: saveDrawing,    // Expose saveDrawing
        loadDrawingForSlide: loadDrawing,      // Expose loadDrawing
        // getCurrentSlideId will be provided by index.html when calling these.
    };

})(); // End of IIFE

    // Placeholder for resize handling - canvas needs to be re-setup
    // This should be triggered by the same events that trigger adaptIframeScale in index.html
    // For now, we call setupCanvas() when draw mode is activated.
    // A more robust solution would observe the iframe or slide-container for resize.
    // window.addEventListener('resize', () => { if (isDrawingModeActive) setupCanvas(); });
    // Or better, integrate with the ResizeObserver in index.html

    // TODO: Implement drawing save/restore on slide change
