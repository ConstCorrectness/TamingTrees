// Import Three.js and types
import * as THREE from 'three';
import type { 
  GameState, 
  InitResponse, 
  PlantTreeResponse, 
  WaterTreeResponse, 
  HarvestTreeResponse, 
  BuySeedsResponse, 
  BuyLandResponse, 
  MovePlayerResponse, 
  ChatMessage,
  Player
} from '../shared/types/api';

// Game initialization and authentication
interface GameAuth {
  username: string;
  authToken: string;
}

let gameAuth: GameAuth | null = null;

// Global variables for mobile controls
let isMouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;
let movementJoystickActive = false;
let cameraJoystickActive = false;
let movementJoystickCenter = { x: 0, y: 0 };
let cameraJoystickCenter = { x: 0, y: 0 };

// Global variables
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let playerAvatar: THREE.Mesh;
let gameState: GameState | null = null;
let nearbyPlayers: Player[] = [];
let treeMeshes: THREE.Mesh[] = [];
let playerMeshes: THREE.Mesh[] = [];
let usernameLabels: Map<string, THREE.Sprite> = new Map();
let chatMessages: ChatMessage[] = [];
let chatUpdateInterval: NodeJS.Timeout | null = null;
let movementThrottle = 0;
let keys: Record<string, boolean> = {};

// UI Elements
let minimapCanvas: HTMLCanvasElement;

// Initialize game with authentication
async function initGame(auth: GameAuth): Promise<void> {
  console.log('Initializing game with auth:', auth);
  gameAuth = auth;
  
  // Create UI first
  createUI();
  
  // Initialize Three.js
  initThreeJS();
  
  // Start the game
  await fetchInitialGameState();
  animate();
}

// Function declarations (moved to top to avoid hoisting issues)
function handleMovement(): void {
  if (!playerAvatar || !gameState) return;

  const moveSpeed = 0.5; // Slower movement for massive world
  let moved = false;
  let newX = playerAvatar.position.x;
  let newZ = playerAvatar.position.z;

  if (keys['w'] || keys['arrowup']) {
    newZ -= moveSpeed;
    moved = true;
  }
  if (keys['s'] || keys['arrowdown']) {
    newZ += moveSpeed;
    moved = true;
  }
  if (keys['a'] || keys['arrowleft']) {
    newX -= moveSpeed;
    moved = true;
  }
  if (keys['d'] || keys['arrowright']) {
    newX += moveSpeed;
    moved = true;
  }
  if (keys['q']) {
    camera.rotation.y += 0.05;
    moved = true;
  }
  if (keys['e']) {
    camera.rotation.y -= 0.05;
    moved = true;
  }

  if (moved) {
    // Keep player within massive world bounds
    const worldBounds = 1000; // Half of world size (2000/2)
    newX = Math.max(-worldBounds, Math.min(worldBounds, newX));
    newZ = Math.max(-worldBounds, Math.min(worldBounds, newZ));
    
    // Update player position immediately for smooth movement
    playerAvatar.position.set(newX, 2, newZ);
    
    // Update camera to follow player with better angle for massive world
    camera.position.set(newX, 50, newZ + 100);
    camera.lookAt(newX, 0, newZ);
    
    // Throttle server updates to avoid spam
    movementThrottle++;
    if (movementThrottle >= 30) { // Update server every 30 frames (0.5 seconds at 60fps)
      movementThrottle = 0;
      movePlayer(newX, 0, newZ);
    }
  }
}

function renderMinimap(): void {
  if (!minimapCanvas || !gameState) return;
  
  const ctx = minimapCanvas.getContext('2d');
  if (!ctx) return;
  
  // Set background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);

  const canvasSize = 150; // Canvas size
  const viewRadius = 20; // Show 20 tiles radius around player (40x40 total)
  
  // Get player position
  const playerX = playerAvatar?.position.x || 0;
  const playerZ = playerAvatar?.position.z || 0;
  
  // Calculate view boundaries (smooth, not grid-based)
  const viewStartX = playerX - viewRadius;
  const viewStartZ = playerZ - viewRadius;
  const viewEndX = playerX + viewRadius;
  const viewEndZ = playerZ + viewRadius;
  
  // Scale factor for rendering
  const scale = canvasSize / (viewRadius * 2);
  
  // Calculate region and forest info
  const regionSize = 200; // Each region is 200x200 tiles
  const forestSize = 50;  // Each forest is 50x50 tiles
  
  const regionX = Math.floor(playerX / regionSize);
  const regionZ = Math.floor(playerZ / regionSize);
  const forestX = Math.floor(playerX / forestSize);
  const forestZ = Math.floor(playerZ / forestSize);
  
  const regionStartX = regionX * regionSize;
  const regionStartZ = regionZ * regionSize;
  const forestStartX = forestX * forestSize;
  const forestStartZ = forestZ * forestSize;
  
  // Draw roads (main paths every 50 tiles)
  ctx.strokeStyle = 'rgba(139, 69, 19, 0.8)'; // Brown roads
  ctx.lineWidth = 2;
  
  // Horizontal roads
  for (let x = Math.floor(viewStartX / 50) * 50; x <= viewEndX; x += 50) {
    const roadX = (x - viewStartX) * scale;
    if (roadX >= 0 && roadX <= canvasSize) {
      ctx.beginPath();
      ctx.moveTo(roadX, 0);
      ctx.lineTo(roadX, canvasSize);
      ctx.stroke();
    }
  }
  
  // Vertical roads
  for (let z = Math.floor(viewStartZ / 50) * 50; z <= viewEndZ; z += 50) {
    const roadZ = (z - viewStartZ) * scale;
    if (roadZ >= 0 && roadZ <= canvasSize) {
      ctx.beginPath();
      ctx.moveTo(0, roadZ);
      ctx.lineTo(canvasSize, roadZ);
      ctx.stroke();
    }
  }
  
  // Draw forest boundaries (every 50 tiles)
  ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)'; // Green forest boundaries
  ctx.lineWidth = 1;
  
  // Horizontal forest lines
  for (let x = Math.floor(viewStartX / 50) * 50; x <= viewEndX; x += 50) {
    const forestX = (x - viewStartX) * scale;
    if (forestX >= 0 && forestX <= canvasSize) {
      ctx.beginPath();
      ctx.moveTo(forestX, 0);
      ctx.lineTo(forestX, canvasSize);
      ctx.stroke();
    }
  }
  
  // Vertical forest lines
  for (let z = Math.floor(viewStartZ / 50) * 50; z <= viewEndZ; z += 50) {
    const forestZ = (z - viewStartZ) * scale;
    if (forestZ >= 0 && forestZ <= canvasSize) {
      ctx.beginPath();
      ctx.moveTo(0, forestZ);
      ctx.lineTo(canvasSize, forestZ);
      ctx.stroke();
    }
  }
  
  // Draw land plots in this area
  gameState.currentBiome.landPlots.forEach((plot: any) => {
    if (plot.x >= viewStartX && plot.x < viewEndX && 
        plot.z >= viewStartZ && plot.z < viewEndZ) {
      const x = (plot.x - viewStartX) * scale;
      const y = (plot.z - viewStartZ) * scale;
      const size = 8 * scale; // Plot size scaled down

      ctx.fillStyle = plot.ownerId === gameState!.player.id ? '#90EE90' : '#FFB6C1';
      ctx.fillRect(x - size/2, y - size/2, size, size);
      
      // Draw border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - size/2, y - size/2, size, size);
    }
  });

  // Draw trees with enhanced color coding
  gameState.trees.forEach((tree: any) => {
    if (tree.x >= viewStartX && tree.x < viewEndX && 
        tree.z >= viewStartZ && tree.z < viewEndZ) {
      const x = (tree.x - viewStartX) * scale;
      const y = (tree.z - viewStartZ) * scale;

      // Enhanced tree colors with different sizes
      let treeColor = '#8B4513'; // Default brown
      let treeSize = 1.5;
      
      switch (tree.type) {
        case 'oak':
          treeColor = '#8B4513'; // Dark brown trunk
          treeSize = 2;
          break;
        case 'pine':
          treeColor = '#228B22'; // Forest green
          treeSize = 1.8;
          break;
        case 'cherry':
          treeColor = '#FF69B4'; // Hot pink
          treeSize = 1.8;
          break;
        case 'maple':
          treeColor = '#FF4500'; // Orange red
          treeSize = 2;
          break;
        case 'birch':
          treeColor = '#F5F5DC'; // Beige
          treeSize = 1.5;
          break;
        case 'willow':
          treeColor = '#9ACD32'; // Yellow green
          treeSize = 1.8;
          break;
        case 'cedar':
          treeColor = '#2F4F4F'; // Dark slate gray
          treeSize = 2;
          break;
        case 'apple':
          treeColor = '#32CD32'; // Lime green
          treeSize = 1.8;
          break;
        default:
          treeColor = '#FFD700'; // Gold for unknown types
          treeSize = 1.5;
      }
      
      // Draw tree with glow effect
      ctx.shadowColor = treeColor;
      ctx.shadowBlur = 2;
      ctx.fillStyle = treeColor;
      ctx.beginPath();
      ctx.arc(x, y, treeSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0; // Reset shadow
    }
  });

  // Draw player with enhanced indicator
  if (playerAvatar) {
    const x = canvasSize / 2; // Always center the player
    const y = canvasSize / 2;
    
    // Player body
    ctx.fillStyle = '#FF0000';
    ctx.shadowColor = '#FF0000';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Player direction indicator with arrow
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const arrowLength = 8;
    const arrowX = x + Math.cos(camera?.rotation.y || 0) * arrowLength;
    const arrowY = y + Math.sin(camera?.rotation.y || 0) * arrowLength;
    ctx.lineTo(arrowX, arrowY);
    
    // Draw arrowhead
    const arrowAngle = Math.PI / 6; // 30 degrees
    const arrowSize = 4;
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(
      arrowX - Math.cos((camera?.rotation.y || 0) - arrowAngle) * arrowSize,
      arrowY - Math.sin((camera?.rotation.y || 0) - arrowAngle) * arrowSize
    );
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(
      arrowX - Math.cos((camera?.rotation.y || 0) + arrowAngle) * arrowSize,
      arrowY - Math.sin((camera?.rotation.y || 0) + arrowAngle) * arrowSize
    );
    ctx.stroke();
    ctx.shadowBlur = 0; // Reset shadow
  }
  
  // Draw coordinates with better styling
  ctx.fillStyle = 'white';
  ctx.font = 'bold 9px Arial';
  ctx.textAlign = 'left';
  ctx.shadowColor = 'black';
  ctx.shadowBlur = 2;
  
  // Region and Forest info
  ctx.fillText(`Region: (${regionX}, ${regionZ})`, 2, 12);
  ctx.fillText(`Forest: (${forestX}, ${forestZ})`, 2, 24);
  
  // Relative coordinates (within current view)
  const relativeX = Math.floor(playerX - viewStartX);
  const relativeZ = Math.floor(playerZ - viewStartZ);
  ctx.fillText(`Rel: (${relativeX}, ${relativeZ})`, 2, 36);
  
  // Absolute world coordinates
  ctx.textAlign = 'right';
  ctx.fillText(`World: (${Math.floor(playerX)}, ${Math.floor(playerZ)})`, canvasSize - 2, canvasSize - 2);
  
  // Reset shadow
  ctx.shadowBlur = 0;
}

// Function to manually trigger resize (useful for UI changes)
function triggerResize(): void {
  if (renderer && camera) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
  }
}

function toggleUI(): void {
  const toggleableElements = document.querySelectorAll('.ui-toggleable');
  const isHidden = toggleableElements[0]?.classList.contains('hidden');
  
  toggleableElements.forEach(element => {
    if (isHidden) {
      element.classList.remove('hidden');
    } else {
      element.classList.add('hidden');
    }
  });
  
  // Trigger resize after UI toggle to ensure proper canvas sizing
  setTimeout(() => triggerResize(), 100);
}

function showMessage(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  const messageElement = document.getElementById('message-display');
  if (!messageElement) return;
  
  messageElement.textContent = message;
  messageElement.className = `message ${type}`;
  messageElement.style.display = 'block';
  
  setTimeout(() => {
    messageElement.style.display = 'none';
  }, 3000);
}

// Export the init function as default
export default initGame;

// Animation loop
function animate(): void {
  requestAnimationFrame(animate);
  
  // Handle movement
  handleMovement();
  
  // Render minimap (throttled)
  if (movementThrottle % 30 === 0) {
    renderMinimap();
  }
  movementThrottle++;
  
  // Render the scene
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

// Create UI elements dynamically
function createUI(): void {
  const gameContainer = document.getElementById('game-container');
  if (!gameContainer) return;

  // Check if UI already exists
  if (gameContainer.querySelector('#game-canvas')) {
    console.log('UI already exists, skipping creation');
    return;
  }

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'game-canvas';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  gameContainer.appendChild(canvas);

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="title">🌳 Taming Trees 🌳</div>
    
    <button class="ui-toggle-btn" onclick="toggleUI()">⚙️</button>
    
    <div class="resources ui-toggleable">
      <div class="resource-item">
        <span class="resource-icon">💰</span>
        <span id="coins">0</span>
      </div>
      <div class="resource-item">
        <span class="resource-icon">🌱</span>
        <span id="seeds">0</span>
      </div>
      <div class="resource-item">
        <span class="resource-icon">💧</span>
        <span id="water">0</span>
      </div>
    </div>
    
    <div class="trees-info ui-toggleable">
      <div class="info-item">
        <span class="info-icon">🌳</span>
        <span id="tree-count">0</span>
      </div>
      <div class="info-item">
        <span class="info-icon">⭐</span>
        <span id="level">1</span>
      </div>
    </div>
    
    <div id="message-display" class="message" style="display: none;"></div>
    
    <div class="shop ui-toggleable">
      <h3>Shop</h3>
      <button onclick="buySeeds()">Buy Seeds (10 coins)</button>
      <button onclick="buyWater()">Buy Water (5 coins)</button>
      <button onclick="buyLand()">Buy Land (100 coins)</button>
    </div>
    
    <div class="achievements ui-toggleable">
      <h3>Achievements</h3>
      <div id="achievements-list"></div>
    </div>
    
    <div class="minimap-hud">
      <div class="minimap-title">Map</div>
      <div class="minimap-content">
        <canvas id="minimap-canvas" width="150" height="150"></canvas>
      </div>
    </div>
    
    <!-- Mobile Joystick Controls -->
    <div class="mobile-controls">
      <div class="joystick-container">
        <div class="joystick-movement" id="movement-joystick">
          <div class="joystick-knob" id="movement-knob"></div>
        </div>
        <div class="joystick-label">Move</div>
      </div>
      
      <div class="joystick-container">
        <div class="joystick-camera" id="camera-joystick">
          <div class="joystick-knob" id="camera-knob"></div>
        </div>
        <div class="joystick-label">Look</div>
      </div>
    </div>
    
    <div class="chat-system ui-toggleable">
      <div class="chat-header">
        <span>Chat</span>
        <span class="online-count" id="online-count">0 online</span>
      </div>
      <div class="chat-messages" id="chat-messages"></div>
      <div class="chat-input-container">
        <input type="text" id="chat-input" placeholder="Type a message..." maxlength="200">
        <button id="chat-send" onclick="sendChatMessage()">Send</button>
      </div>
    </div>
    
    <div class="instructions ui-toggleable">
      <h3>How to Play</h3>
      <ul>
        <li>Use WASD or Arrow Keys to move around</li>
        <li>Use Q and E to rotate camera (keyboard)</li>
        <li>Drag mouse to rotate camera (desktop)</li>
        <li>Use joysticks for movement and camera (mobile)</li>
        <li>Click on trees to water or harvest them</li>
        <li>Plant new trees on your land</li>
        <li>Buy more land to expand your forest</li>
        <li>Press Tab to toggle UI</li>
        <li>Press F for fullscreen</li>
        <li>Chat with other players!</li>
      </ul>
    </div>
  `;
  
  gameContainer.appendChild(overlay);
  
  // Get references to UI elements
  minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
  
  // Set up keyboard event listeners
  document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    
    if (e.key === 'Tab') {
      e.preventDefault();
      toggleUI();
    }
    
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      toggleFullscreen();
    }
    
    if (e.key === 'Enter' && document.activeElement?.id === 'chat-input') {
      e.preventDefault();
      sendChatMessage();
    }
  });
  
  document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });
  
  // Mobile touch controls
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let isTouching = false;
  
  document.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
    isTouching = true;
  });
  
  document.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isTouching) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    const deltaTime = Date.now() - touchStartTime;
    
    // Only process if touch has moved significantly
    if (deltaTime > 50 && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      // Determine movement direction based on touch direction
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal movement
        if (deltaX > 0) {
          keys['d'] = true;
          keys['a'] = false;
        } else {
          keys['a'] = true;
          keys['d'] = false;
        }
        keys['w'] = false;
        keys['s'] = false;
      } else {
        // Vertical movement
        if (deltaY > 0) {
          keys['s'] = true;
          keys['w'] = false;
        } else {
          keys['w'] = true;
          keys['s'] = false;
        }
        keys['a'] = false;
        keys['d'] = false;
      }
      
      // Update touch start position for continuous movement
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartTime = Date.now();
    }
  });
  
  document.addEventListener('touchend', (e) => {
    e.preventDefault();
    isTouching = false;
    // Clear all movement keys
    keys['w'] = false;
    keys['a'] = false;
    keys['s'] = false;
    keys['d'] = false;
  });
  
  // Mobile joystick controls
  let movementJoystickActive = false;
  let cameraJoystickActive = false;
  let movementJoystickCenter = { x: 0, y: 0 };
  let cameraJoystickCenter = { x: 0, y: 0 };
  
  // Movement joystick
  const movementJoystick = document.getElementById('movement-joystick');
  const movementKnob = document.getElementById('movement-knob');
  
  if (movementJoystick && movementKnob) {
    movementJoystick.addEventListener('touchstart', (e) => {
      e.preventDefault();
      movementJoystickActive = true;
      const rect = movementJoystick.getBoundingClientRect();
      movementJoystickCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    });
    
    movementJoystick.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!movementJoystickActive) return;
      
      const touch = e.touches[0];
      const deltaX = touch.clientX - movementJoystickCenter.x;
      const deltaY = touch.clientY - movementJoystickCenter.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const maxDistance = 25; // Half of joystick radius
      
      // Limit knob movement
      const clampedDistance = Math.min(distance, maxDistance);
      const angle = Math.atan2(deltaY, deltaX);
      
      const knobX = Math.cos(angle) * clampedDistance;
      const knobY = Math.sin(angle) * clampedDistance;
      
      movementKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;
      
      // Convert joystick input to movement
      const normalizedX = knobX / maxDistance;
      const normalizedY = knobY / maxDistance;
      
      // Update movement keys
      keys['w'] = normalizedY < -0.3;
      keys['s'] = normalizedY > 0.3;
      keys['a'] = normalizedX < -0.3;
      keys['d'] = normalizedX > 0.3;
    });
    
    movementJoystick.addEventListener('touchend', (e) => {
      e.preventDefault();
      movementJoystickActive = false;
      movementKnob.style.transform = 'translate(0px, 0px)';
      keys['w'] = false;
      keys['s'] = false;
      keys['a'] = false;
      keys['d'] = false;
    });
  }
  
  // Camera joystick
  const cameraJoystick = document.getElementById('camera-joystick');
  const cameraKnob = document.getElementById('camera-knob');
  
  if (cameraJoystick && cameraKnob) {
    cameraJoystick.addEventListener('touchstart', (e) => {
      e.preventDefault();
      cameraJoystickActive = true;
      const rect = cameraJoystick.getBoundingClientRect();
      cameraJoystickCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    });
    
    cameraJoystick.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!cameraJoystickActive) return;
      
      const touch = e.touches[0];
      const deltaX = touch.clientX - cameraJoystickCenter.x;
      const deltaY = touch.clientY - cameraJoystickCenter.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const maxDistance = 25; // Half of joystick radius
      
      // Limit knob movement
      const clampedDistance = Math.min(distance, maxDistance);
      const angle = Math.atan2(deltaY, deltaX);
      
      const knobX = Math.cos(angle) * clampedDistance;
      const knobY = Math.sin(angle) * clampedDistance;
      
      cameraKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;
      
      // Convert joystick input to camera rotation
      const normalizedX = knobX / maxDistance;
      const normalizedY = knobY / maxDistance;
      
      // Update camera rotation
      if (camera) {
        camera.rotation.y -= normalizedX * 0.02;
        camera.rotation.x -= normalizedY * 0.02;
        
        // Limit vertical rotation
        camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, camera.rotation.x));
      }
    });
    
    cameraJoystick.addEventListener('touchend', (e) => {
      e.preventDefault();
      cameraJoystickActive = false;
      cameraKnob.style.transform = 'translate(0px, 0px)';
    });
  }
}

// Initialize Three.js
function initThreeJS(): void {
  // Check if Three.js is already initialized
  if (scene && camera && renderer) {
    console.log('Three.js already initialized, skipping');
    return;
  }

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas not found');
    return;
  }
  
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 50, 100); // Higher camera for massive world
  camera.lookAt(0, 0, 0);
  
  renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  renderer.setPixelRatio(window.devicePixelRatio ?? 1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  
  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(50, 50, 50);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 500;
  directionalLight.shadow.camera.left = -100;
  directionalLight.shadow.camera.right = 100;
  directionalLight.shadow.camera.top = 100;
  directionalLight.shadow.camera.bottom = -100;
  scene.add(directionalLight);
  
  // Create terrain
  const terrain = createTerrain();
  scene.add(terrain);
  
  // Add some rocks scattered around
  addRocks();
  
  // Handle window resize
  window.addEventListener('resize', () => {
    triggerResize();
  });
  
  // Handle fullscreen changes
  document.addEventListener('fullscreenchange', () => {
    setTimeout(() => triggerResize(), 100);
  });
  
  // Mouse controls for camera rotation
  let isMouseDown = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  
  canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    canvas.style.cursor = 'grabbing';
  });
  
  canvas.addEventListener('mousemove', (e) => {
    if (isMouseDown) {
      const deltaX = e.clientX - lastMouseX;
      const deltaY = e.clientY - lastMouseY;
      
      // Rotate camera based on mouse movement
      camera.rotation.y -= deltaX * 0.002;
      camera.rotation.x -= deltaY * 0.002;
      
      // Limit vertical rotation
      camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, camera.rotation.x));
      
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }
  });
  
  canvas.addEventListener('mouseup', () => {
    isMouseDown = false;
    canvas.style.cursor = 'grab';
  });
  
  canvas.addEventListener('mouseleave', () => {
    isMouseDown = false;
    canvas.style.cursor = 'grab';
  });
  
  canvas.style.cursor = 'grab';
}

// Terrain with mountains for massive world
function createTerrain(): THREE.Mesh {
  const size = 2000; // Match server world size
  const segments = 200; // Higher detail for larger world
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  
  // Get position attribute
  const positions = geometry.attributes.position;
  if (!positions) return new THREE.Mesh();
  
  // Create height map with more dramatic terrain for massive world
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getY(i);
    
    // Multiple octaves of noise for realistic terrain
    let height = 0;
    
    // Large rolling hills (scaled for massive world)
    height += Math.sin(x * 0.01) * Math.cos(z * 0.01) * 15;
    height += Math.sin(x * 0.02) * Math.cos(z * 0.02) * 10;
    
    // Medium hills
    height += Math.sin(x * 0.05) * Math.cos(z * 0.05) * 5;
    height += Math.sin(x * 0.1) * Math.cos(z * 0.1) * 3;
    
    // Small details
    height += Math.sin(x * 0.2) * Math.cos(z * 0.2) * 1;
    
    // Add dramatic mountain peaks at edges
    const distFromCenter = Math.sqrt(x * x + z * z);
    if (distFromCenter > 500) {
      const mountainHeight = (distFromCenter - 500) * 0.1;
      height += mountainHeight;
      
      // Add some random peaks
      if (Math.random() > 0.8) {
        height += mountainHeight * 0.5;
      }
    }
    
    // Add some valleys
    if (Math.abs(x) < 200 && Math.abs(z) < 200) {
      height -= 3; // Central valley
    }
    
    positions.setZ(i, height);
  }
  
  geometry.computeVertexNormals();
  
  // Create a more varied material
  const material = new THREE.MeshLambertMaterial({ 
    color: 0x90EE90,
    side: THREE.DoubleSide
  });
  
  const terrain = new THREE.Mesh(geometry, material);
  terrain.rotation.x = -Math.PI / 2;
  terrain.receiveShadow = true;
  terrain.castShadow = true;
  
  return terrain;
}

// Add some rocks scattered around
function addRocks(): void {
  const rockGeometry = new THREE.SphereGeometry(0.5, 8, 6);
  const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
  
  for (let i = 0; i < 50; i++) {
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.position.set(
      (Math.random() - 0.5) * 1800, // Scatter across massive world
      Math.random() * 2,
      (Math.random() - 0.5) * 1800
    );
    rock.scale.setScalar(Math.random() * 0.5 + 0.5);
    rock.castShadow = true;
    scene.add(rock);
  }
}

// Fetch initial game state
async function fetchInitialGameState(): Promise<void> {
  try {
    console.log('Fetching initial game state...');
    const response = await fetch('/api/init', {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: InitResponse = await response.json();
    console.log('Received game state:', data);
    gameState = data.gameState;
    nearbyPlayers = data.nearbyPlayers;
    
    // Create player avatar
    createPlayerAvatar();
    
    // Render initial state
    renderTrees();
    renderLandPlots();
    renderNearbyPlayers();
    renderMinimap();
    
    // Load chat messages
    loadChatMessages();
    updateOnlineCount();
    
    // Set up chat update interval
    chatUpdateInterval = setInterval(() => {
      loadChatMessages();
    }, 2000);
    
    // Update UI
    updateUI();
    
    showMessage(`Welcome to the massive world, ${gameAuth?.username || 'Player'}!`, 'success');
    
  } catch (error) {
    console.error('Failed to fetch initial game state:', error);
    showMessage('Failed to load game. Please refresh the page.', 'error');
  }
}

// Create player avatar
function createPlayerAvatar(): void {
  if (!gameState || !scene) return;
  
  const geometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
  const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
  playerAvatar = new THREE.Mesh(geometry, material);
  
  playerAvatar.position.set(
    gameState.player.position.x,
    gameState.player.position.y + 1,
    gameState.player.position.z
  );
  
  playerAvatar.castShadow = true;
  scene.add(playerAvatar);
  
  // Create username label
  createUsernameLabel(gameAuth?.username || 'Player', playerAvatar.position);
}

// Create username label
function createUsernameLabel(username: string, position: THREE.Vector3): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return new THREE.Sprite();
  
  canvas.width = 256;
  canvas.height = 64;
  
  context.fillStyle = 'rgba(0, 0, 0, 0.8)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  
  context.fillStyle = 'white';
  context.font = '24px Arial';
  context.textAlign = 'center';
  context.fillText(username, canvas.width / 2, canvas.height / 2 + 8);
  
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(spriteMaterial);
  
  sprite.position.set(position.x, position.y + 3, position.z);
  sprite.scale.set(4, 1, 1);
  
  scene.add(sprite);
  return sprite;
}

// Render trees
function renderTrees(): void {
  if (!gameState || !scene) return;
  
  // Clear existing trees
  treeMeshes.forEach(mesh => scene.remove(mesh));
  treeMeshes = [];
  
  gameState.trees.forEach((tree: any) => {
    let geometry: THREE.BufferGeometry;
    
    switch (tree.type) {
      case 'oak':
        geometry = new THREE.ConeGeometry(0.5, tree.growthStage * 2, 8);
        break;
      case 'pine':
        geometry = new THREE.ConeGeometry(0.3, tree.growthStage * 1.5, 6);
        break;
      case 'cherry':
        geometry = new THREE.SphereGeometry(tree.growthStage * 0.8, 8, 6);
        break;
      default:
        geometry = new THREE.ConeGeometry(0.4, tree.growthStage * 1.8, 8);
    }
    
    const material = new THREE.MeshLambertMaterial({ 
      color: tree.type === 'oak' ? 0x8B4513 : 
             tree.type === 'pine' ? 0x228B22 : 
             tree.type === 'cherry' ? 0xFF69B4 : 0xFFD700
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(tree.x, tree.y, tree.z);
    mesh.castShadow = true;
    mesh.userData = { tree };
    
    scene.add(mesh);
    treeMeshes.push(mesh);
  });
}

// Render land plots
function renderLandPlots(): void {
  if (!gameState || !scene) return;
  
  gameState.currentBiome.landPlots.forEach((plot: any) => {
    const geometry = new THREE.PlaneGeometry(10, 20);
    const material = new THREE.MeshLambertMaterial({ 
      color: plot.ownerId === gameState!.player.id ? 0x90EE90 : 0xFFB6C1,
      transparent: true,
      opacity: 0.3
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(plot.x, 0.1, plot.z);
    mesh.rotation.x = -Math.PI / 2;
    
    scene.add(mesh);
  });
}

// Render nearby players
function renderNearbyPlayers(): void {
  if (!gameState || !scene) return;
  
  // Clear existing player meshes
  playerMeshes.forEach(mesh => scene.remove(mesh));
  playerMeshes = [];
  
  // Clear existing username labels
  usernameLabels.forEach(label => scene.remove(label));
  usernameLabels.clear();
  
  nearbyPlayers.forEach((player: any) => {
    if (player.id === gameState!.player.id) return; // Skip self
    
    const geometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
    const material = new THREE.MeshLambertMaterial({ color: 0x0000ff });
    const mesh = new THREE.Mesh(geometry, material);
    
    mesh.position.set(player.position.x, player.position.y + 1, player.position.z);
    mesh.castShadow = true;
    
    scene.add(mesh);
    playerMeshes.push(mesh);
    
    // Create username label
    const label = createUsernameLabel(player.username, mesh.position);
    usernameLabels.set(player.id, label);
  });
}

// Update UI
function updateUI(): void {
  if (!gameState) return;
  
  const coinsElement = document.getElementById('coins');
  const seedsElement = document.getElementById('seeds');
  const waterElement = document.getElementById('water');
  const treeCountElement = document.getElementById('tree-count');
  const levelElement = document.getElementById('level');
  const achievementsElement = document.getElementById('achievements-list');
  const shopElement = document.querySelector('.shop');
  
  if (coinsElement) coinsElement.textContent = gameState.player.coins.toString();
  if (seedsElement) seedsElement.textContent = gameState.resources.seeds.toString();
  if (waterElement) waterElement.textContent = gameState.resources.water.toString();
  if (treeCountElement) treeCountElement.textContent = gameState.trees.length.toString();
  if (levelElement) levelElement.textContent = gameState.player.level.toString();
  
  // Update achievements
  if (achievementsElement) {
    achievementsElement.innerHTML = gameState.player.achievements
      .map((achievement: any) => `
        <div class="achievement">
          <span class="achievement-icon">${achievement.icon}</span>
          <div class="achievement-info">
            <div class="achievement-name">${achievement.name}</div>
            <div class="achievement-desc">${achievement.description}</div>
          </div>
        </div>
      `).join('');
  }
  
  // Update shop
  if (shopElement) {
    const buySeedsBtn = shopElement.querySelector('button[onclick="buySeeds()"]');
    const buyWaterBtn = shopElement.querySelector('button[onclick="buyWater()"]');
    const buyLandBtn = shopElement.querySelector('button[onclick="buyLand()"]');
    
    if (buySeedsBtn) buySeedsBtn.textContent = `Buy Seeds (10 coins)`;
    if (buyWaterBtn) buyWaterBtn.textContent = `Buy Water (5 coins)`;
    if (buyLandBtn) buyLandBtn.textContent = `Buy Land (100 coins)`;
  }
}

// Chat functions
function sendChatMessage(): void {
  const input = document.getElementById('chat-input') as HTMLInputElement;
  if (!input || !input.value.trim()) return;
  
  const message = input.value.trim();
  input.value = '';
  
  fetch('/api/send-chat-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  }).catch(error => {
    console.error('Failed to send chat message:', error);
    showMessage('Failed to send message', 'error');
  });
}

function loadChatMessages(): void {
  fetch('/api/chat-messages')
    .then(response => response.json())
    .then(data => {
      chatMessages = data.messages;
      renderChatMessages();
    })
    .catch(error => console.error('Failed to load chat messages:', error));
}

function renderChatMessages(): void {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  
  container.innerHTML = chatMessages
    .slice(-20) // Show last 20 messages
    .map(msg => `
      <div class="chat-message ${msg.playerId === gameState?.player.id ? 'player' : 'other'}">
        <span class="username">${msg.username}:</span>
        <span class="message-text">${msg.message}</span>
        <span class="timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</span>
      </div>
    `).join('');
  
  container.scrollTop = container.scrollHeight;
}

function updateOnlineCount(): void {
  const countElement = document.getElementById('online-count');
  if (countElement && gameState) {
    countElement.textContent = `${nearbyPlayers.length + 1} online`;
  }
}

// Game action functions
async function plantTree(x: number, z: number): Promise<void> {
  if (!gameState) return;
  
  try {
    const response = await fetch('/api/plant-tree', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, z })
    });
    
    const data: PlantTreeResponse = await response.json();
    if (data.success) {
      gameState = data.gameState;
      renderTrees();
      updateUI();
      showMessage('Tree planted successfully!', 'success');
    } else {
      showMessage(data.message || 'Failed to plant tree', 'error');
    }
  } catch (error) {
    console.error('Failed to plant tree:', error);
    showMessage('Failed to plant tree', 'error');
  }
}

async function waterTree(treeId: string): Promise<void> {
  if (!gameState) return;
  
  try {
    const response = await fetch('/api/water-tree', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ treeId })
    });
    
    const data: WaterTreeResponse = await response.json();
    if (data.success) {
      gameState = data.gameState;
      renderTrees();
      updateUI();
      showMessage('Tree watered!', 'success');
    } else {
      showMessage(data.message || 'Failed to water tree', 'error');
    }
  } catch (error) {
    console.error('Failed to water tree:', error);
    showMessage('Failed to water tree', 'error');
  }
}

async function harvestTree(treeId: string): Promise<void> {
  if (!gameState) return;
  
  try {
    const response = await fetch('/api/harvest-tree', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ treeId })
    });
    
    const data: HarvestTreeResponse = await response.json();
    if (data.rewards) {
      gameState = data.gameState;
      renderTrees();
      updateUI();
      showMessage(`Harvested tree! +${data.rewards.coins} coins`, 'success');
    } else {
      showMessage('Failed to harvest tree', 'error');
    }
  } catch (error) {
    console.error('Failed to harvest tree:', error);
    showMessage('Failed to harvest tree', 'error');
  }
}

async function buySeeds(): Promise<void> {
  if (!gameState) return;
  
  try {
    const response = await fetch('/api/buy-seeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data: BuySeedsResponse = await response.json();
    if (data.success) {
      gameState = data.gameState;
      updateUI();
      showMessage('Seeds purchased!', 'success');
    } else {
      showMessage(data.message || 'Failed to buy seeds', 'error');
    }
  } catch (error) {
    console.error('Failed to buy seeds:', error);
    showMessage('Failed to buy seeds', 'error');
  }
}

async function buyWater(): Promise<void> {
  if (!gameState) return;
  
  try {
    const response = await fetch('/api/buy-water', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data: BuySeedsResponse = await response.json(); // Use same type as buy seeds
    if (data.success) {
      gameState = data.gameState;
      updateUI();
      showMessage('Water purchased!', 'success');
    } else {
      showMessage(data.message || 'Failed to buy water', 'error');
    }
  } catch (error) {
    console.error('Failed to buy water:', error);
    showMessage('Failed to buy water', 'error');
  }
}

async function buyLand(): Promise<void> {
  if (!gameState) return;
  
  try {
    const response = await fetch('/api/buy-land', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data: BuyLandResponse = await response.json();
    if (data.success) {
      gameState = data.gameState;
      renderLandPlots();
      updateUI();
      showMessage('Land purchased!', 'success');
    } else {
      showMessage(data.message || 'Failed to buy land', 'error');
    }
  } catch (error) {
    console.error('Failed to buy land:', error);
    showMessage('Failed to buy land', 'error');
  }
}

async function buyLandAtPosition(x: number, z: number): Promise<void> {
  if (!gameState) return;
  
  try {
    const response = await fetch('/api/buy-land', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, z })
    });
    
    const data: BuyLandResponse = await response.json();
    if (data.success) {
      gameState = data.gameState;
      renderLandPlots();
      updateUI();
      showMessage('Land purchased!', 'success');
    } else {
      showMessage(data.message || 'Failed to buy land', 'error');
    }
  } catch (error) {
    console.error('Failed to buy land:', error);
    showMessage('Failed to buy land', 'error');
  }
}

async function movePlayer(x: number, y: number, z: number): Promise<void> {
  if (!gameState) return;
  
  try {
    const response = await fetch('/api/move-player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y, z })
    });
    
    const data: MovePlayerResponse = await response.json();
    if (data.gameState) {
      gameState = data.gameState;
      renderNearbyPlayers();
      updateOnlineCount();
    }
  } catch (error) {
    console.error('Failed to move player:', error);
  }
}

// Handle tree clicks
function handleTreeClick(event: MouseEvent): void {
  if (!gameState) return;
  
const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  
  const intersects = raycaster.intersectObjects(treeMeshes);
  
  if (intersects.length > 0) {
    const clickedMesh = intersects[0]?.object as THREE.Mesh;
    const tree = clickedMesh?.userData?.tree;
    
    if (tree) {
      if (tree.growthStage >= 3) {
        harvestTree(tree.id);
      } else {
        waterTree(tree.id);
      }
    }
  }
}

// Handle canvas clicks
function handleCanvasClick(event: MouseEvent): void {
  if (!gameState) return;
  
  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  
  const intersects = raycaster.intersectObjects(treeMeshes);
  
  if (intersects.length > 0) {
    handleTreeClick(event);
  } else if (gameState) {
    // Check if clicking on empty land
    const groundIntersects = raycaster.intersectObject(scene.getObjectByName('terrain') || new THREE.Object3D());
    if (groundIntersects.length > 0) {
      const point = groundIntersects[0]?.point;
      if (point && gameState.resources.seeds > 0) {
        plantTree(point.x, point.z);
      } else {
        showMessage('You need seeds to plant trees!', 'error');
      }
    }
  }
}

// Fullscreen toggle
function toggleFullscreen(): void {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
  
  // Trigger resize after fullscreen change
  setTimeout(() => triggerResize(), 100);
}

// Make functions globally available for HTML onclick handlers
(window as any).buySeeds = buySeeds;
(window as any).buyWater = buyWater;
(window as any).buyLand = buyLand;
(window as any).buyLandAtPosition = buyLandAtPosition;
(window as any).toggleUI = toggleUI;
(window as any).toggleFullscreen = toggleFullscreen;
(window as any).sendChatMessage = sendChatMessage;

// Login screen functionality
function showLoginScreen(): void {
  const loginScreen = document.getElementById('login-screen');
  const gameContainer = document.getElementById('game-container');
  
  if (loginScreen && gameContainer) {
    loginScreen.classList.remove('hidden');
    gameContainer.classList.add('hidden');
  }
}

function hideLoginScreen(): void {
  const loginScreen = document.getElementById('login-screen');
  const gameContainer = document.getElementById('game-container');
  
  if (loginScreen && gameContainer) {
    loginScreen.classList.add('hidden');
    gameContainer.classList.remove('hidden');
  }
}

function setupLoginHandlers(): void {
  const usernameInput = document.getElementById('username-input') as HTMLInputElement;
  const loginBtn = document.getElementById('login-btn');
  const createAccountBtn = document.getElementById('create-account-btn');
  
  // Auto-fill username if available from Devvit context
  if (gameAuth?.username) {
    usernameInput.value = gameAuth.username;
  }
  
  // Login button handler
  loginBtn?.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    if (!username) {
      alert('Please enter your Reddit username');
      return;
    }
    
    // Validate username format (basic Reddit username validation)
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      alert('Please enter a valid Reddit username (letters, numbers, underscores, and hyphens only)');
      return;
    }
    
    try {
      // Show loading state
      loginBtn.textContent = '🌲 Entering Forest...';
      loginBtn.disabled = true;
      
      // Initialize game with username
      await initGameWithUsername(username);
      
      // Hide login screen and show game
      hideLoginScreen();
      
    } catch (error) {
      console.error('Login failed:', error);
      alert('Failed to enter the forest. Please try again.');
      
      // Reset button state
      loginBtn.textContent = '🌲 Enter Forest';
      loginBtn.disabled = false;
    }
  });
  
  // Create account button handler
  createAccountBtn?.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    if (!username) {
      alert('Please enter your desired Reddit username');
      return;
    }
    
    // Validate username format
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      alert('Please enter a valid Reddit username (letters, numbers, underscores, and hyphens only)');
      return;
    }
    
    try {
      // Show loading state
      createAccountBtn.textContent = '✨ Creating Account...';
      createAccountBtn.disabled = true;
      
      // Initialize game with new username
      await initGameWithUsername(username, true);
      
      // Hide login screen and show game
      hideLoginScreen();
      
    } catch (error) {
      console.error('Account creation failed:', error);
      alert('Failed to create account. Please try again.');
      
      // Reset button state
      createAccountBtn.textContent = '✨ Create New Account';
      createAccountBtn.disabled = false;
    }
  });
  
  // Enter key handler for username input
  usernameInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      loginBtn?.click();
    }
  });
}

async function initGameWithUsername(username: string, isNewUser: boolean = false): Promise<void> {
  // Update gameAuth with the username
  gameAuth = {
    username: username,
    authToken: gameAuth?.authToken || 'dev_token'
  };
  
  console.log(`${isNewUser ? 'Creating new account' : 'Logging in'} for user:`, username);
  
  // Create UI first, then initialize Three.js, then start the game
  createUI();
  initThreeJS();
  await fetchInitialGameState();
animate();
}

// Initialize and start
if (typeof window !== 'undefined') {
  // Check for authentication data from URL parameters (Devvit iframe mode)
  const urlParams = new URLSearchParams(window.location.search);
  const user = urlParams.get('user');
  const auth = urlParams.get('auth');
  
  if (user && auth) {
    // Devvit iframe mode with authentication - show login screen first
    console.log('Running in Devvit iframe mode with auth:', { user, auth });
    gameAuth = { username: user, authToken: auth };
    setupLoginHandlers();
    showLoginScreen();
  } else if ((window as any).gameAuth) {
    // Direct authentication object - show login screen first
    console.log('Running with direct auth object');
    gameAuth = (window as any).gameAuth;
    setupLoginHandlers();
    showLoginScreen();
  } else {
    // Fallback for direct access (development mode) - show login screen
    console.log('Running in fallback mode - showing login screen');
    gameAuth = null;
    setupLoginHandlers();
    showLoginScreen();
  }
}
