import * as THREE from 'three';
import { navigateTo } from '@devvit/client';
import {
  InitResponse,
  PlantTreeResponse,
  WaterTreeResponse,
  HarvestTreeResponse,
  BuySeedsResponse,
  BuyLandResponse,
  MovePlayerResponse,
  GameState,
  Tree,
  TreeType,
  Player,
  ChatMessage
} from '../shared/types/api';

// UI Elements
const titleElement = document.getElementById('title') as HTMLHeadingElement;
const resourcesElement = document.getElementById('resources') as HTMLDivElement;
const treesElement = document.getElementById('trees') as HTMLDivElement;
const shopElement = document.getElementById('shop') as HTMLDivElement;
const achievementsElement = document.getElementById('achievements') as HTMLDivElement;
const minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;

// Links
const docsLink = document.getElementById('docs-link');
const playtestLink = document.getElementById('playtest-link');
const discordLink = document.getElementById('discord-link');

docsLink?.addEventListener('click', () => navigateTo('https://developers.reddit.com/docs'));
playtestLink?.addEventListener('click', () => navigateTo('https://www.reddit.com/r/Devvit'));
discordLink?.addEventListener('click', () => navigateTo('https://discord.com/invite/R7yu2wh9Qz'));

// Game State
let currentPostId: string | null = null;
let gameState: GameState | null = null;
let treeMeshes: Map<string, THREE.Mesh> = new Map();
let playerMeshes: Map<string, THREE.Mesh> = new Map();
let landPlotMeshes: Map<string, THREE.Mesh> = new Map();
let playerAvatar: THREE.Mesh | null = null;

// UI State
let uiHidden = false;

// Movement controls
const keys: Record<string, boolean> = {};
let movementThrottle = 0;

// Three.js Setup
const canvas = document.getElementById('bg') as HTMLCanvasElement;
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 25, 35);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
renderer.setPixelRatio(window.devicePixelRatio ?? 1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Terrain with mountains
function createTerrain(): THREE.Mesh {
  const size = 200;
  const segments = 100;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  
  // Get position attribute
  const positions = geometry.attributes.position;
  if (!positions) return new THREE.Mesh();
  
  // Create height map with more dramatic terrain
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getY(i);
    
    // Multiple octaves of noise for realistic terrain
    let height = 0;
    
    // Large rolling hills
    height += Math.sin(x * 0.03) * Math.cos(z * 0.03) * 8;
    height += Math.sin(x * 0.05) * Math.cos(z * 0.05) * 5;
    
    // Medium hills
    height += Math.sin(x * 0.1) * Math.cos(z * 0.1) * 3;
    height += Math.sin(x * 0.15) * Math.cos(z * 0.15) * 2;
    
    // Small details
    height += Math.sin(x * 0.2) * Math.cos(z * 0.2) * 1;
    
    // Add dramatic mountain peaks at edges
    const distFromCenter = Math.sqrt(x * x + z * z);
    if (distFromCenter > 50) {
      const mountainHeight = (distFromCenter - 50) * 0.3;
      height += mountainHeight;
      
      // Add some random peaks
      if (Math.random() > 0.7) {
        height += mountainHeight * 0.5;
      }
    }
    
    // Add some valleys
    if (Math.abs(x) < 30 && Math.abs(z) < 30) {
      height -= 2; // Central valley
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

const ground = createTerrain();
scene.add(ground);

// Add some rocks scattered around
function addRocks(): void {
  const rockGeometry = new THREE.SphereGeometry(0.5, 8, 6);
  const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
  
  for (let i = 0; i < 20; i++) {
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.position.set(
      (Math.random() - 0.5) * 180,
      0.5,
      (Math.random() - 0.5) * 180
    );
    rock.scale.setScalar(Math.random() * 0.5 + 0.5);
    rock.castShadow = true;
    scene.add(rock);
  }
}

addRocks();

// Tree materials for different types
const treeMaterials: Record<TreeType, THREE.MeshLambertMaterial> = {
  oak: new THREE.MeshLambertMaterial({ color: 0x8B4513 }), // Brown
  pine: new THREE.MeshLambertMaterial({ color: 0x228B22 }), // Forest green
  cherry: new THREE.MeshLambertMaterial({ color: 0xFFB6C1 }), // Light pink
  maple: new THREE.MeshLambertMaterial({ color: 0xFF4500 }), // Orange red
  cedar: new THREE.MeshLambertMaterial({ color: 0x2F4F4F }) // Dark slate gray
};

// Tree geometries for different growth stages
const treeGeometries = [
  new THREE.SphereGeometry(0.2, 8, 8), // Seed
  new THREE.ConeGeometry(0.5, 1, 8), // Sapling
  new THREE.ConeGeometry(1, 2, 8), // Young tree
  new THREE.ConeGeometry(1.5, 3, 8), // Growing tree
  new THREE.ConeGeometry(2, 4, 8), // Mature tree
  new THREE.ConeGeometry(2.5, 5, 8) // Fully grown tree
];

// Player avatar geometry
const playerGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.5, 8);
const playerMaterial = new THREE.MeshLambertMaterial({ color: 0x4169E1 }); // Royal blue

// Username label system
const usernameLabels: Map<string, THREE.Object3D> = new Map();

function createUsernameLabel(username: string, playerId: string): THREE.Object3D {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return new THREE.Object3D();

  // Set canvas size
  canvas.width = 256;
  canvas.height = 64;

  // Draw username background
  context.fillStyle = 'rgba(0, 0, 0, 0.8)';
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Draw username text
  context.fillStyle = '#FFFFFF';
  context.font = 'bold 24px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(username, canvas.width / 2, canvas.height / 2);

  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  // Create sprite material
  const spriteMaterial = new THREE.SpriteMaterial({ 
    map: texture,
    transparent: true,
    alphaTest: 0.1
  });

  // Create sprite
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(4, 1, 1);
  sprite.position.set(0, 2.5, 0);
  sprite.userData = { playerId, username };

  return sprite;
}

// Land plot geometry
const landPlotGeometry = new THREE.PlaneGeometry(10, 10);
const landPlotMaterial = new THREE.MeshLambertMaterial({ 
  color: 0x90EE90, 
  transparent: true, 
  opacity: 0.3 
});

// Resize handler
window.addEventListener('resize', () => {
  const { innerWidth, innerHeight } = window;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Raycaster for tree interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Initialize game
async function fetchInitialGameState(): Promise<void> {
  try {
    const response = await fetch('/api/init');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = (await response.json()) as InitResponse;
    if (data.type === 'init') {
      gameState = data.gameState;
      currentPostId = data.postId;
      titleElement.textContent = `Welcome, ${data.username}! 🌳`;
      
      // Update biome environment
      updateBiomeEnvironment(gameState.currentBiome);
      
      // Create player avatar
      createPlayerAvatar();
      
      updateUI();
      renderTrees();
      renderLandPlots();
      renderNearbyPlayers(data.nearbyPlayers);
      renderMinimap();
      
      // Initialize chat
      await loadChatMessages();
      updateOnlineCount();
      
      // Start chat update interval
      if (chatUpdateInterval) {
        clearInterval(chatUpdateInterval);
      }
      chatUpdateInterval = setInterval(loadChatMessages, 2000); // Update every 2 seconds
      
      // Auto-hide UI after 5 seconds to give players time to read instructions
      setTimeout(() => {
        if (!uiHidden) {
          toggleUI();
        }
      }, 5000);
    } else {
      showMessage('Error loading game state', 'error');
    }
  } catch (err) {
    console.error('Error fetching initial game state:', err);
    showMessage('Error loading game', 'error');
  }
}

// Update biome environment
function updateBiomeEnvironment(biome: any): void {
  scene.background = new THREE.Color(biome.environment.skyColor);
  
  // Add fog
  scene.fog = new THREE.Fog(
    new THREE.Color(biome.environment.fogColor),
    20,
    100
  );
}

// Create player avatar
function createPlayerAvatar(): void {
  if (playerAvatar) {
    scene.remove(playerAvatar);
  }
  
  playerAvatar = new THREE.Mesh(playerGeometry, playerMaterial);
  playerAvatar.position.set(0, 1, 0);
  playerAvatar.castShadow = true;
  scene.add(playerAvatar);
}

// Update UI elements
function updateUI(): void {
  if (!gameState) return;

  // Update resources
  resourcesElement.innerHTML = `
    <div class="resource">
      <span class="resource-icon">🌱</span>
      <span class="resource-value">${gameState.resources.seeds}</span>
    </div>
    <div class="resource">
      <span class="resource-icon">💧</span>
      <span class="resource-value">${gameState.resources.water}</span>
    </div>
    <div class="resource">
      <span class="resource-icon">🪙</span>
      <span class="resource-value">${gameState.resources.coins}</span>
    </div>
    <div class="resource">
      <span class="resource-icon">⭐</span>
      <span class="resource-value">${gameState.player.experience}</span>
    </div>
  `;

  // Update trees count
  treesElement.innerHTML = `
    <div class="tree-count">🌲 Trees: ${gameState.trees.length}</div>
    <div class="level">Level: ${gameState.player.level}</div>
    <div class="land-count">🏡 Land: ${gameState.player.landPlots.length}</div>
  `;

  // Update achievements
  achievementsElement.innerHTML = `
    <div class="achievements-section">
      <h3>🏆 Achievements (${gameState.player.achievements.length})</h3>
      <div class="achievements-list">
        ${gameState.player.achievements.map(achievement => `
          <div class="achievement">
            <span class="achievement-icon">${achievement.icon}</span>
            <div class="achievement-info">
              <div class="achievement-name">${achievement.name}</div>
              <div class="achievement-desc">${achievement.description}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Update shop
  shopElement.innerHTML = `
    <div class="shop-section">
      <h3>🌱 Buy Seeds</h3>
      <div class="seed-options">
        ${(['oak', 'pine', 'cherry', 'maple', 'cedar'] as TreeType[]).map(type => `
          <button class="seed-btn" data-type="${type}" onclick="buySeeds('${type}')">
            ${type.charAt(0).toUpperCase() + type.slice(1)} (10🪙)
          </button>
        `).join('')}
      </div>
    </div>
    <div class="actions-section">
      <button class="action-btn" onclick="plantTreeAtPosition()">🌱 Plant Tree</button>
      <button class="action-btn" onclick="waterAllTrees()">💧 Water All</button>
      <button class="action-btn" onclick="buyLandAtPosition()">🏡 Buy Land</button>
    </div>
  `;
}

// Render trees in 3D scene
function renderTrees(): void {
  if (!gameState) return;

  // Clear existing trees
  treeMeshes.forEach(mesh => scene.remove(mesh));
  treeMeshes.clear();

  // Add trees to scene
  gameState.trees.forEach(tree => {
    const geometry = treeGeometries[tree.growthStage];
    const material = treeMaterials[tree.type];
    const mesh = new THREE.Mesh(geometry, material);
    
    // Calculate height based on geometry type
    let height = 0;
    if (geometry instanceof THREE.ConeGeometry) {
      height = geometry.parameters.height || 1;
    } else if (geometry instanceof THREE.SphereGeometry) {
      height = geometry.parameters.radius || 0.5;
    }
    
    mesh.position.set(tree.x, tree.y + height / 2, tree.z);
    mesh.castShadow = true;
    mesh.userData = { treeId: tree.id, tree };
    
    scene.add(mesh);
    treeMeshes.set(tree.id, mesh);
  });
}

// Render land plots
function renderLandPlots(): void {
  if (!gameState) return;

  // Clear existing land plots
  landPlotMeshes.forEach(mesh => scene.remove(mesh));
  landPlotMeshes.clear();

  // Add land plots to scene
  gameState.currentBiome.landPlots.forEach(plot => {
    const mesh = new THREE.Mesh(landPlotGeometry, landPlotMaterial);
    mesh.position.set(plot.x, 0.01, plot.z);
    mesh.rotation.x = -Math.PI / 2;
    mesh.userData = { plotId: plot.id, plot };
    
    // Color based on ownership
    if (plot.ownerId === gameState!.player.id) {
      mesh.material.color = new THREE.Color(0x90EE90); // Light green for owned
    } else {
      mesh.material.color = new THREE.Color(0xFFB6C1); // Light pink for others
    }
    
    scene.add(mesh);
    landPlotMeshes.set(plot.id, mesh);
  });
}

// Render nearby players
function renderNearbyPlayers(players: Player[]): void {
  // Clear existing player meshes and labels
  playerMeshes.forEach(mesh => scene.remove(mesh));
  playerMeshes.clear();
  
  usernameLabels.forEach(label => scene.remove(label));
  usernameLabels.clear();

  // Add player meshes with username labels
  players.forEach(player => {
    const mesh = new THREE.Mesh(playerGeometry, playerMaterial.clone());
    mesh.position.set(player.position.x, player.position.y + 1, player.position.z);
    mesh.material.color = new THREE.Color(0xFF6B6B); // Different color for other players
    mesh.castShadow = true;
    mesh.userData = { playerId: player.id, player };
    
    scene.add(mesh);
    playerMeshes.set(player.id, mesh);
    
    // Add username label
    const usernameLabel = createUsernameLabel(player.username, player.id);
    usernameLabel.position.set(player.position.x, player.position.y + 3, player.position.z);
    scene.add(usernameLabel);
    usernameLabels.set(player.id, usernameLabel);
  });
}

// Render minimap
function renderMinimap(): void {
  if (!gameState || !minimapCanvas) return;

  const ctx = minimapCanvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
  
  // Set background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);

  const mapSize = 200; // Canvas size
  const worldSize = 200; // World size
  const scale = mapSize / worldSize;

  // Draw land plots
  gameState.currentBiome.landPlots.forEach(plot => {
    const x = (plot.x + worldSize / 2) * scale;
    const y = (plot.z + worldSize / 2) * scale;
    const size = 10 * scale;

    ctx.fillStyle = plot.ownerId === gameState!.player.id ? '#90EE90' : '#FFB6C1';
    ctx.fillRect(x - size/2, y - size/2, size, size);
    
    // Draw border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - size/2, y - size/2, size, size);
  });

  // Draw trees
  gameState.trees.forEach(tree => {
    const x = (tree.x + worldSize / 2) * scale;
    const y = (tree.z + worldSize / 2) * scale;
    
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw player position
  if (playerAvatar) {
    const x = (playerAvatar.position.x + worldSize / 2) * scale;
    const y = (playerAvatar.position.z + worldSize / 2) * scale;
    
    ctx.fillStyle = '#4169E1';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw direction indicator
    ctx.strokeStyle = '#4169E1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 8);
    ctx.stroke();
  }

  // Draw other players
  gameState.currentBiome.players.forEach(player => {
    if (player.id === gameState!.player.id) return;
    
    const x = (player.position.x + worldSize / 2) * scale;
    const y = (player.position.z + worldSize / 2) * scale;
    
    ctx.fillStyle = '#FF6B6B';
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Toggle UI visibility
function toggleUI(): void {
  uiHidden = !uiHidden;
  const toggleBtn = document.getElementById('ui-toggle-btn') as HTMLButtonElement;
  const toggleableElements = document.querySelectorAll('.ui-toggleable');
  const overlay = document.querySelector('.overlay') as HTMLElement;
  
  if (uiHidden) {
    // Hide UI elements
    toggleableElements.forEach(element => {
      element.classList.add('hidden');
    });
    toggleBtn.textContent = '🎮 Show UI';
    toggleBtn.style.background = 'linear-gradient(135deg, #4CAF50, #66BB6A)';
    overlay.classList.add('fullscreen');
  } else {
    // Show UI elements
    toggleableElements.forEach(element => {
      element.classList.remove('hidden');
    });
    toggleBtn.textContent = '🎮 Hide UI';
    toggleBtn.style.background = 'linear-gradient(135deg, #FF6B6B, #FF8E8E)';
    overlay.classList.remove('fullscreen');
  }
}

// Chat system
let chatMessages: ChatMessage[] = [];
let chatUpdateInterval: NodeJS.Timeout | null = null;

// Send chat message
async function sendChatMessage(): Promise<void> {
  const chatInput = document.getElementById('chat-input') as HTMLInputElement;
  const message = chatInput.value.trim();
  
  if (!message || !gameState || !currentPostId) return;
  
  try {
    const response = await fetch('/api/send-chat-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId: currentPostId,
        playerId: gameState.player.id,
        message
      })
    });
    
    if (response.ok) {
      chatInput.value = '';
      await loadChatMessages();
    } else {
      showMessage('Failed to send message', 'error');
    }
  } catch (err) {
    console.error('Error sending chat message:', err);
    showMessage('Failed to send message', 'error');
  }
}

// Load chat messages
async function loadChatMessages(): Promise<void> {
  try {
    const response = await fetch('/api/chat-messages?limit=20');
    if (response.ok) {
      const data = await response.json();
      chatMessages = data.messages;
      renderChatMessages();
    }
  } catch (err) {
    console.error('Error loading chat messages:', err);
  }
}

// Render chat messages
function renderChatMessages(): void {
  const chatMessagesElement = document.getElementById('chat-messages') as HTMLDivElement;
  if (!chatMessagesElement) return;
  
  chatMessagesElement.innerHTML = '';
  
  chatMessages.forEach(msg => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${msg.playerId === gameState?.player.id ? 'player' : 'other'}`;
    
    const timestamp = new Date(msg.timestamp).toLocaleTimeString();
    
    messageDiv.innerHTML = `
      <span class="username">${msg.username}:</span>
      <span class="message-text">${msg.message}</span>
      <span class="timestamp">${timestamp}</span>
    `;
    
    chatMessagesElement.appendChild(messageDiv);
  });
  
  // Scroll to bottom
  chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
}

// Show message to user
function showMessage(text: string, type: 'success' | 'error' | 'info' = 'info'): void {
  const messageElement = document.getElementById('message') as HTMLDivElement;
  if (messageElement) {
    messageElement.textContent = text;
    messageElement.className = `message ${type}`;
    messageElement.style.display = 'block';
    
    setTimeout(() => {
      messageElement.style.display = 'none';
    }, 3000);
  }
}

// Update online count
function updateOnlineCount(): void {
  const onlineCountElement = document.getElementById('online-count') as HTMLSpanElement;
  if (onlineCountElement && gameState) {
    onlineCountElement.textContent = gameState.currentBiome.players.length.toString();
  }
}

// Plant tree at current position
async function plantTreeAtPosition(): Promise<void> {
  if (!gameState || !currentPostId || !playerAvatar) return;

  const treeTypes: TreeType[] = ['oak', 'pine', 'cherry', 'maple', 'cedar'];
  const randomType = treeTypes[Math.floor(Math.random() * treeTypes.length)];

  try {
    const response = await fetch('/api/plant-tree', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        treeType: randomType,
        x: playerAvatar.position.x,
        z: playerAvatar.position.z,
        playerId: gameState.player.id
      }),
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = (await response.json()) as PlantTreeResponse;
    
    if (data.success) {
      gameState = data.gameState;
      updateUI();
      renderTrees();
      renderLandPlots();
      renderMinimap();
      showMessage(data.message, 'success');
      
      // Show achievements if any
      if (data.achievements && data.achievements.length > 0) {
        data.achievements.forEach(achievement => {
          showMessage(`🏆 Achievement Unlocked: ${achievement.name}!`, 'success');
        });
      }
    } else {
      showMessage(data.message, 'error');
    }
  } catch (err) {
    console.error('Error planting tree:', err);
    showMessage('Failed to plant tree', 'error');
  }
}

// Buy land at current position
async function buyLandAtPosition(): Promise<void> {
  if (!gameState || !currentPostId || !playerAvatar) return;

  try {
    const response = await fetch('/api/buy-land', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        x: playerAvatar.position.x,
        z: playerAvatar.position.z,
        playerId: gameState.player.id
      }),
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = (await response.json()) as BuyLandResponse;
    
    if (data.success) {
      gameState = data.gameState;
      updateUI();
      renderLandPlots();
      showMessage(data.message, 'success');
      
      // Show achievements if any
      if (data.achievements && data.achievements.length > 0) {
        data.achievements.forEach(achievement => {
          showMessage(`🏆 Achievement Unlocked: ${achievement.name}!`, 'success');
        });
      }
    } else {
      showMessage(data.message, 'error');
    }
  } catch (err) {
    console.error('Error buying land:', err);
    showMessage('Failed to buy land', 'error');
  }
}

// Water all trees
async function waterAllTrees(): Promise<void> {
  if (!gameState || !currentPostId) return;

  const treesToWater = gameState.trees.filter(tree => tree.health < 100);
  if (treesToWater.length === 0) {
    showMessage('All trees are healthy!', 'info');
    return;
  }

  let wateredCount = 0;
  for (const tree of treesToWater) {
    if (gameState.resources.water <= 0) break;
    
    try {
      const response = await fetch('/api/water-tree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          treeId: tree.id,
          playerId: gameState.player.id
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as WaterTreeResponse;
        if (data.success) {
          gameState = data.gameState;
          wateredCount++;
        }
      }
    } catch (err) {
      console.error('Error watering tree:', err);
    }
  }

  updateUI();
  renderTrees();
  showMessage(`Watered ${wateredCount} trees!`, 'success');
}

// Buy seeds
async function buySeeds(treeType: TreeType): Promise<void> {
  if (!gameState || !currentPostId) return;

  try {
    const response = await fetch('/api/buy-seeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        treeType, 
        quantity: 1,
        playerId: gameState.player.id
      }),
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = (await response.json()) as BuySeedsResponse;
    
    if (data.success) {
      gameState = data.gameState;
      updateUI();
      showMessage(data.message, 'success');
    } else {
      showMessage(data.message, 'error');
    }
  } catch (err) {
    console.error('Error buying seeds:', err);
    showMessage('Failed to buy seeds', 'error');
  }
}

// Move player
async function movePlayer(x: number, y: number, z: number): Promise<void> {
  if (!gameState || !currentPostId || !playerAvatar) return;

  try {
    const response = await fetch('/api/move-player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        x, y, z,
        playerId: gameState.player.id
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as MovePlayerResponse;
      gameState = data.gameState;
      playerAvatar.position.set(x, y + 1, z);
      
      // Update camera to follow player
      camera.position.set(x, y + 15, z + 25);
      camera.lookAt(x, y, z);
    }
  } catch (err) {
    console.error('Error moving player:', err);
  }
}

// Handle tree clicks
function handleTreeClick(event: PointerEvent): void {
  // Check if clicking on UI elements first
  const target = event.target as HTMLElement;
  if (target.closest('.shop') || target.closest('.achievements') || target.closest('.resources') || target.closest('.trees-info')) {
    return; // Don't handle tree clicks when clicking on UI
  }

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(Array.from(treeMeshes.values()));

  if (intersects.length > 0 && intersects[0]) {
    const clickedMesh = intersects[0].object as THREE.Mesh;
    const userData = clickedMesh.userData;
    
    if (userData && userData.tree) {
      const tree = userData.tree as Tree;
      
      if (tree.growthStage >= 5) {
        harvestTree(tree.id);
      } else {
        waterTree(tree.id);
      }
    }
  }
}

// Water individual tree
async function waterTree(treeId: string): Promise<void> {
  if (!gameState || !currentPostId) return;

  try {
    const response = await fetch('/api/water-tree', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        treeId,
        playerId: gameState.player.id
      }),
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = (await response.json()) as WaterTreeResponse;
    
    if (data.success) {
      gameState = data.gameState;
      updateUI();
      renderTrees();
      showMessage(data.message, 'success');
    } else {
      showMessage(data.message, 'error');
    }
  } catch (err) {
    console.error('Error watering tree:', err);
    showMessage('Failed to water tree', 'error');
  }
}

// Harvest tree
async function harvestTree(treeId: string): Promise<void> {
  if (!gameState || !currentPostId) return;

  try {
    const response = await fetch('/api/harvest-tree', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        treeId,
        playerId: gameState.player.id
      }),
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = (await response.json()) as HarvestTreeResponse;
    
    gameState = data.gameState;
    updateUI();
    renderTrees();
    
    if (data.rewards.coins > 0) {
      showMessage(`Harvested! +${data.rewards.coins}🪙 +${data.rewards.seeds}🌱 +${data.rewards.experience}⭐`, 'success');
      
      // Show achievements if any
      if (data.achievements && data.achievements.length > 0) {
        data.achievements.forEach(achievement => {
          showMessage(`🏆 Achievement Unlocked: ${achievement.name}!`, 'success');
        });
      }
    } else {
      showMessage('Tree not ready for harvest yet!', 'info');
    }
  } catch (err) {
    console.error('Error harvesting tree:', err);
    showMessage('Failed to harvest tree', 'error');
  }
}

// Keyboard controls
document.addEventListener('keydown', (event) => {
  keys[event.key.toLowerCase()] = true;
  
  // Toggle UI with Tab key
  if (event.key === 'Tab') {
    event.preventDefault();
    toggleUI();
  }
  
  // Fullscreen with F key
  if (event.key === 'f' || event.key === 'F') {
    event.preventDefault();
    toggleFullscreen();
  }
  
  // Send chat message with Enter key
  if (event.key === 'Enter') {
    const chatInput = document.getElementById('chat-input') as HTMLInputElement;
    if (chatInput && chatInput === document.activeElement) {
      event.preventDefault();
      sendChatMessage();
    }
  }
});

document.addEventListener('keyup', (event) => {
  keys[event.key.toLowerCase()] = false;
});

// Fullscreen functionality
function toggleFullscreen(): void {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.log('Error attempting to enable fullscreen:', err);
    });
  } else {
    document.exitFullscreen();
  }
}

// Movement system
function handleMovement(): void {
  if (!playerAvatar || !gameState) return;

  const moveSpeed = 0.3;
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

  if (moved) {
    // Keep player within bounds (-90 to 90 for a 200x200 world with padding)
    newX = Math.max(-90, Math.min(90, newX));
    newZ = Math.max(-90, Math.min(90, newZ));
    
    // Update player position immediately for smooth movement
    playerAvatar.position.set(newX, 2, newZ);
    
    // Update camera to follow player with better angle
    camera.position.set(newX, 25, newZ + 35);
    camera.lookAt(newX, 0, newZ);
    
    // Throttle server updates to avoid spam
    movementThrottle++;
    if (movementThrottle >= 10) { // Update server every 10 frames
      movementThrottle = 0;
      movePlayer(newX, 0, newZ);
    }
  }
}

// Animation loop
function animate(): void {
  requestAnimationFrame(animate);

  // Handle movement
  handleMovement();

  // Rotate trees slightly
  treeMeshes.forEach(mesh => {
    mesh.rotation.y += 0.01;
  });

  // Rotate player avatars slightly
  playerMeshes.forEach(mesh => {
    mesh.rotation.y += 0.005;
  });

  if (playerAvatar) {
    playerAvatar.rotation.y += 0.005;
  }

  // Update minimap every few frames
  if (Math.floor(Date.now() / 100) % 3 === 0) {
    renderMinimap();
  }

  renderer.render(scene, camera);
}

// Event listeners
window.addEventListener('pointerdown', handleTreeClick);

// Make functions globally available for HTML onclick handlers
(window as any).plantTreeAtPosition = plantTreeAtPosition;
(window as any).waterAllTrees = waterAllTrees;
(window as any).buySeeds = buySeeds;
(window as any).buyLandAtPosition = buyLandAtPosition;
(window as any).toggleUI = toggleUI;
(window as any).toggleFullscreen = toggleFullscreen;
(window as any).sendChatMessage = sendChatMessage;

// Initialize and start
void fetchInitialGameState();
animate();
