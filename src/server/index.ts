import express from 'express';
import { 
  InitResponse, 
  PlantTreeResponse, 
  WaterTreeResponse, 
  HarvestTreeResponse, 
  BuySeedsResponse,
  BuyLandResponse,
  MovePlayerResponse,
  GetNearbyPlayersResponse,
  GameState,
  Tree,
  TreeType,
  Player,
  LandPlot,
  Biome,
  BiomeType,
  Achievement,
  AchievementCategory
} from '../shared/types/api';
import { redis, reddit, createServer, context, getServerPort } from '@devvit/web/server';
import { createPost } from './core/post';

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

// World Configuration
const WORLD_WIDTH = 2000; // Total world width in tiles
const WORLD_HEIGHT = 4000; // Total world height in tiles
const PLOT_WIDTH = 10; // Individual plot width
const PLOT_HEIGHT = 20; // Individual plot height
const MAX_PLAYERS = 200; // Maximum number of players who can claim plots
const TILE_SIZE = 1; // Size of each tile in Three.js units

// Calculate grid dimensions
const GRID_WIDTH = Math.floor(WORLD_WIDTH / PLOT_WIDTH); // 200 plots wide
const GRID_HEIGHT = Math.floor(WORLD_HEIGHT / PLOT_HEIGHT); // 200 plots tall
const TOTAL_PLOTS = GRID_WIDTH * GRID_HEIGHT; // 40,000 total plots available

console.log(`World initialized: ${WORLD_WIDTH}x${WORLD_HEIGHT} tiles, ${GRID_WIDTH}x${GRID_HEIGHT} plots, ${TOTAL_PLOTS} total plots`);

// Game configuration
const TREE_TYPES: TreeType[] = ['oak', 'pine', 'cherry', 'maple', 'cedar'];
const GROWTH_TIME = 30000; // 30 seconds per growth stage
const MAX_TREES_PER_PLOT = 5;
const SEED_COST = 10;
const WATER_COST = 5;
const LAND_PLOT_COST = 100;
const BIOME_SIZE = WORLD_WIDTH; // Use world width as biome size
const MAX_PLAYERS_PER_BIOME = MAX_PLAYERS;

// Achievement definitions
const ACHIEVEMENTS: Record<string, Achievement> = {
  first_tree: {
    id: 'first_tree',
    name: 'First Steps',
    description: 'Plant your first tree',
    icon: '🌱',
    unlockedAt: 0,
    category: 'planting'
  },
  tree_master: {
    id: 'tree_master',
    name: 'Tree Master',
    description: 'Plant 50 trees',
    icon: '🌳',
    unlockedAt: 0,
    category: 'planting'
  },
  harvester: {
    id: 'harvester',
    name: 'Harvester',
    description: 'Harvest 25 trees',
    icon: '🌾',
    unlockedAt: 0,
    category: 'harvesting'
  },
  landowner: {
    id: 'landowner',
    name: 'Landowner',
    description: 'Own 5 land plots',
    icon: '🏡',
    unlockedAt: 0,
    category: 'economy'
  },
  explorer: {
    id: 'explorer',
    name: 'Explorer',
    description: 'Visit all biome types',
    icon: '🗺️',
    unlockedAt: 0,
    category: 'exploration'
  },
  social_butterfly: {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Meet 10 other players',
    icon: '🦋',
    unlockedAt: 0,
    category: 'social'
  },
  millionaire: {
    id: 'millionaire',
    name: 'Millionaire',
    description: 'Accumulate 10,000 coins',
    icon: '💰',
    unlockedAt: 0,
    category: 'economy'
  },
  master_gardener: {
    id: 'master_gardener',
    name: 'Master Gardener',
    description: 'Reach level 25',
    icon: '👨‍🌾',
    unlockedAt: 0,
    category: 'mastery'
  }
};

// Biome configurations
const BIOME_CONFIGS: Record<BiomeType, any> = {
  forest: {
    skyColor: '#87CEEB',
    groundColor: '#90EE90',
    fogColor: '#98FB98',
    fogDensity: 0.1
  },
  meadow: {
    skyColor: '#87CEFA',
    groundColor: '#F0E68C',
    fogColor: '#F5DEB3',
    fogDensity: 0.05
  },
  hills: {
    skyColor: '#B0C4DE',
    groundColor: '#8FBC8F',
    fogColor: '#D2B48C',
    fogDensity: 0.15
  },
  lake: {
    skyColor: '#4682B4',
    groundColor: '#20B2AA',
    fogColor: '#87CEEB',
    fogDensity: 0.2
  },
  mountain: {
    skyColor: '#708090',
    groundColor: '#696969',
    fogColor: '#A9A9A9',
    fogDensity: 0.3
  }
};

// Helper functions
function generateTreeId(): string {
  return `tree_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generatePlayerId(): string {
  return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateLandPlotId(): string {
  return `land_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Chat system
let chatMessages: ChatMessage[] = [];

function generateChatMessageId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function addChatMessage(playerId: string, username: string, message: string, type: 'player' | 'system' = 'player'): Promise<ChatMessage> {
  const chatMessage: ChatMessage = {
    id: generateChatMessageId(),
    playerId,
    username,
    message,
    timestamp: Date.now(),
    type
  };
  
  chatMessages.push(chatMessage);
  
  // Keep only last 100 messages
  if (chatMessages.length > 100) {
    chatMessages = chatMessages.slice(-100);
  }
  
  return chatMessage;
}

async function getRecentChatMessages(limit: number = 20): Promise<ChatMessage[]> {
  return chatMessages.slice(-limit);
}

// Grid allocation system
const claimedPlots = new Set<string>(); // Track claimed plot coordinates

function findAvailablePlot(): { gridX: number; gridZ: number } | null {
  // Try to find an available 10x20 plot
  for (let gridX = 0; gridX < GRID_WIDTH; gridX++) {
    for (let gridZ = 0; gridZ < GRID_HEIGHT; gridZ++) {
      const plotKey = `${gridX},${gridZ}`;
      if (!claimedPlots.has(plotKey)) {
        return { gridX, gridZ };
      }
    }
  }
  return null; // No available plots
}

function claimPlot(gridX: number, gridZ: number): boolean {
  const plotKey = `${gridX},${gridZ}`;
  if (claimedPlots.has(plotKey)) {
    return false; // Already claimed
  }
  
  if (claimedPlots.size >= MAX_PLAYERS) {
    return false; // World is full
  }
  
  claimedPlots.add(plotKey);
  return true;
}

function getPlotWorldCoordinates(gridX: number, gridZ: number): { 
  startX: number; 
  startZ: number; 
  endX: number; 
  endZ: number; 
  centerX: number; 
  centerZ: number; 
} {
  const startX = gridX * PLOT_WIDTH - WORLD_WIDTH / 2;
  const startZ = gridZ * PLOT_HEIGHT - WORLD_HEIGHT / 2;
  const endX = startX + PLOT_WIDTH;
  const endZ = startZ + PLOT_HEIGHT;
  const centerX = startX + PLOT_WIDTH / 2;
  const centerZ = startZ + PLOT_HEIGHT / 2;
  
  return { startX, startZ, endX, endZ, centerX, centerZ };
}

function calculateTreeGrowth(tree: Tree): number {
  const now = Date.now();
  const timeSincePlanted = now - tree.plantedAt;
  const timeSinceWatered = now - tree.lastWatered;
  
  // Trees grow faster when watered recently
  const waterBonus = timeSinceWatered < 60000 ? 1.5 : 1; // 50% bonus if watered within 1 minute
  
  const growthStages = Math.floor((timeSincePlanted * waterBonus) / GROWTH_TIME);
  return Math.min(growthStages, 5); // Max growth stage is 5
}

function calculateTreeHealth(tree: Tree): number {
  const now = Date.now();
  const timeSinceWatered = now - tree.lastWatered;
  
  // Health decreases over time if not watered
  const hoursSinceWatered = timeSinceWatered / (1000 * 60 * 60);
  const healthLoss = Math.max(0, hoursSinceWatered - 1) * 10; // Lose 10 health per hour after 1 hour
  
  return Math.max(0, 100 - healthLoss);
}

function getDefaultPlayer(username: string): Player {
  return {
    id: username, // Use username as ID for consistency
    username,
    avatar: '🌳',
    level: 1,
    experience: 0,
    coins: 200, // More starting coins
    redditGold: 0, // Starting Reddit Gold
    achievements: [],
    landPlots: [],
    position: { x: 0, y: 0, z: 0 },
    lastActive: Date.now(),
    premiumFeatures: {
      speedBoost: false,
      doubleXP: false,
      instantGrowth: false
    }
  };
}

function getDefaultBiome(): Biome {
  return {
    id: 'massive_world',
    name: 'The Eternal Forest',
    type: 'forest',
    maxPlayers: MAX_PLAYERS,
    landPlots: [], // Will be populated as players claim plots
    players: [],
    environment: {
      skyColor: '#87CEEB',
      groundColor: '#90EE90',
      fogColor: '#87CEEB'
    }
  };
}

function getDefaultGameState(player: Player, biome: Biome): GameState {
  return {
    player,
    currentBiome: biome,
    trees: [],
    resources: {
      seeds: 5,
      water: 10,
      fertilizer: 0,
      coins: player.coins
    },
    lastPlayed: Date.now()
  };
}

async function allocateStartingLand(player: Player, biome: Biome): Promise<void> {
  const availablePlot = findAvailablePlot();
  
  if (!availablePlot) {
    throw new Error('No available plots in the world');
  }
  
  const { gridX, gridZ } = availablePlot;
  const { startX, startZ, endX, endZ, centerX, centerZ } = getPlotWorldCoordinates(gridX, gridZ);
  
  // Claim the plot
  if (!claimPlot(gridX, gridZ)) {
    throw new Error('Failed to claim plot');
  }
  
  // Create land plot
  const landPlot: LandPlot = {
    id: generateLandPlotId(),
    x: centerX,
    z: centerZ,
    ownerId: player.id,
    biomeType: biome.type,
    trees: [],
    purchasedAt: Date.now(),
    price: 0 // Free starting land
  };
  
  // Add to biome and player
  biome.landPlots.push(landPlot);
  player.landPlots.push(landPlot.id);
  
  // Set player starting position to center of their plot
  player.position = { x: centerX, y: 0, z: centerZ };
  
  console.log(`Allocated plot (${gridX},${gridZ}) to player ${player.username} at (${centerX}, ${centerZ})`);
}

async function getPlayer(playerId: string): Promise<Player | null> {
  const playerJson = await redis.get(`player:${playerId}`);
  return playerJson ? JSON.parse(playerJson) : null;
}

async function savePlayer(player: Player): Promise<void> {
  await redis.set(`player:${player.id}`, JSON.stringify(player));
}

async function getBiome(biomeId: string): Promise<Biome | null> {
  const biomeJson = await redis.get(`biome:${biomeId}`);
  return biomeJson ? JSON.parse(biomeJson) : null;
}

async function saveBiome(biome: Biome): Promise<void> {
  await redis.set(`biome:${biome.id}`, JSON.stringify(biome));
}

async function getGameState(playerId: string): Promise<GameState | null> {
  const stateJson = await redis.get(`gameState:${playerId}`);
  return stateJson ? JSON.parse(stateJson) : null;
}

async function saveGameState(gameState: GameState): Promise<void> {
  gameState.lastPlayed = Date.now();
  await redis.set(`gameState:${gameState.player.id}`, JSON.stringify(gameState));
}

function checkAchievements(player: Player, action: string, count?: number): Achievement[] {
  const newAchievements: Achievement[] = [];
  const now = Date.now();

  // Check various achievement conditions
  if (action === 'plant_tree' && !player.achievements.find(a => a.id === 'first_tree')) {
    newAchievements.push({ ...ACHIEVEMENTS.first_tree, unlockedAt: now });
  }

  if (action === 'plant_tree' && count && count >= 50 && !player.achievements.find(a => a.id === 'tree_master')) {
    newAchievements.push({ ...ACHIEVEMENTS.tree_master, unlockedAt: now });
  }

  if (action === 'harvest_tree' && count && count >= 25 && !player.achievements.find(a => a.id === 'harvester')) {
    newAchievements.push({ ...ACHIEVEMENTS.harvester, unlockedAt: now });
  }

  if (action === 'buy_land' && player.landPlots.length >= 5 && !player.achievements.find(a => a.id === 'landowner')) {
    newAchievements.push({ ...ACHIEVEMENTS.landowner, unlockedAt: now });
  }

  if (player.coins >= 10000 && !player.achievements.find(a => a.id === 'millionaire')) {
    newAchievements.push({ ...ACHIEVEMENTS.millionaire, unlockedAt: now });
  }

  if (player.level >= 25 && !player.achievements.find(a => a.id === 'master_gardener')) {
    newAchievements.push({ ...ACHIEVEMENTS.master_gardener, unlockedAt: now });
  }

  return newAchievements;
}

function getNearbyPlayers(player: Player, biome: Biome, radius: number = 20): Player[] {
  return biome.players.filter(p => {
    if (p.id === player.id) return false;
    const distance = Math.sqrt(
      Math.pow(p.position.x - player.position.x, 2) +
      Math.pow(p.position.z - player.position.z, 2)
    );
    return distance <= radius;
  });
}

router.get<{ postId: string }, InitResponse | { status: string; message: string }>(
  '/api/init',
  async (_req, res): Promise<void> => {
    const { postId } = context;

    // Allow development mode without postId
    if (!postId) {
      console.log('Development mode: No postId found, using default');
    }

    try {
      let username = await reddit.getCurrentUsername();
      
      // Fallback for development mode when no Reddit context
      if (!username) {
        console.log('No Reddit username found, using development mode');
        username = 'dev_player';
      }

      // Try to get existing player
      let player = await getPlayer(username);
      let biome = await getBiome('massive_world');
      
      if (!biome) {
        biome = getDefaultBiome();
        await saveBiome(biome);
      }

      if (!player) {
        player = getDefaultPlayer(username);
        biome.players.push(player);
        
        // Allocate starting land for new player
        await allocateStartingLand(player, biome);
        
        await savePlayer(player);
        await saveBiome(biome);
      } else {
        // Update last active
        player.lastActive = Date.now();
        await savePlayer(player);
      }

      let gameState = await getGameState(player.id);
      if (!gameState) {
        gameState = getDefaultGameState(player, biome);
        await saveGameState(gameState);
      } else {
        // Update player and biome references
        gameState.player = player;
        gameState.currentBiome = biome;
        await saveGameState(gameState);
      }

      const nearbyPlayers = getNearbyPlayers(player, biome);

      res.json({
        type: 'init',
        postId: postId || 'dev_post',
        gameState,
        username,
        nearbyPlayers,
      });
    } catch (error) {
      console.error(`API Init Error for post ${postId}:`, error);
      let errorMessage = 'Unknown error during initialization';
      if (error instanceof Error) {
        errorMessage = `Initialization failed: ${error.message}`;
      }
      res.status(400).json({ status: 'error', message: errorMessage });
    }
  }
);

router.post<{ postId: string }, PlantTreeResponse | { status: string; message: string }, { treeType: TreeType; x: number; z: number }>(
  '/api/plant-tree',
  async (req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    try {
      const { treeType, x, z } = req.body;
      const gameState = await getGameState(req.body.playerId || '');
      
      if (!gameState) {
        res.status(404).json({
          status: 'error',
          message: 'Game state not found'
        });
        return;
      }

      const player = gameState.player;
      const biome = gameState.currentBiome;

      // Check if player owns land at this location
      const landPlot = biome.landPlots.find(plot => 
        Math.abs(plot.x - x) < 5 && Math.abs(plot.z - z) < 5 && plot.ownerId === player.id
      );

      if (!landPlot) {
        res.json({
          type: 'plant_tree',
          postId,
          gameState,
          success: false,
          message: 'You can only plant trees on your own land!'
        });
        return;
      }

      if (landPlot.trees.length >= MAX_TREES_PER_PLOT) {
        res.json({
          type: 'plant_tree',
          postId,
          gameState,
          success: false,
          message: 'This land plot is full!'
        });
        return;
      }

      if (gameState.resources.seeds <= 0) {
        res.json({
          type: 'plant_tree',
          postId,
          gameState,
          success: false,
          message: 'Not enough seeds!'
        });
        return;
      }

      const newTree: Tree = {
        id: generateTreeId(),
        type: treeType,
        x,
        y: 0,
        z,
        growthStage: 0,
        plantedAt: Date.now(),
        lastWatered: Date.now(),
        health: 100,
        ownerId: player.id
      };

      gameState.trees.push(newTree);
      landPlot.trees.push(newTree.id);
      gameState.resources.seeds -= 1;
      player.experience += 10;

      // Check for achievements
      const newAchievements = checkAchievements(player, 'plant_tree', gameState.trees.length);
      player.achievements.push(...newAchievements);

      await saveGameState(gameState);
      await savePlayer(player);
      await saveBiome(biome);

      res.json({
        type: 'plant_tree',
        postId,
        gameState,
        success: true,
        message: `Planted a ${treeType} tree!`,
        achievements: newAchievements
      });
    } catch (error) {
      console.error('Error planting tree:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to plant tree'
      });
    }
  }
);

router.post<{ postId: string }, BuyLandResponse | { status: string; message: string }, { x: number; z: number }>(
  '/api/buy-land',
  async (req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    try {
      const { x, z } = req.body;
      const gameState = await getGameState(req.body.playerId || '');
      
      if (!gameState) {
        res.status(404).json({
          status: 'error',
          message: 'Game state not found'
        });
        return;
      }

      const player = gameState.player;
      const biome = gameState.currentBiome;

      // Check if land is already owned
      const existingPlot = biome.landPlots.find(plot => 
        Math.abs(plot.x - x) < 10 && Math.abs(plot.z - z) < 10
      );

      if (existingPlot) {
        res.json({
          type: 'buy_land',
          postId,
          gameState,
          success: false,
          message: 'This land is already owned!'
        });
        return;
      }

      if (player.coins < LAND_PLOT_COST) {
        res.json({
          type: 'buy_land',
          postId,
          gameState,
          success: false,
          message: 'Not enough coins!'
        });
        return;
      }

      const newLandPlot: LandPlot = {
        id: generateLandPlotId(),
        x,
        z,
        ownerId: player.id,
        biomeType: biome.type,
        trees: [],
        purchasedAt: Date.now(),
        price: LAND_PLOT_COST
      };

      biome.landPlots.push(newLandPlot);
      player.landPlots.push(newLandPlot.id);
      player.coins -= LAND_PLOT_COST;
      gameState.resources.coins = player.coins;

      // Check for achievements
      const newAchievements = checkAchievements(player, 'buy_land', player.landPlots.length);
      player.achievements.push(...newAchievements);

      await saveGameState(gameState);
      await savePlayer(player);
      await saveBiome(biome);

      res.json({
        type: 'buy_land',
        postId,
        gameState,
        success: true,
        message: `Purchased land plot for ${LAND_PLOT_COST} coins!`,
        landPlot: newLandPlot,
        achievements: newAchievements
      });
    } catch (error) {
      console.error('Error buying land:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to buy land'
      });
    }
  }
);

router.post<{ postId: string }, MovePlayerResponse | { status: string; message: string }, { x: number; y: number; z: number }>(
  '/api/move-player',
  async (req, res): Promise<void> => {
    const { postId } = context;
    
    // Handle development mode without postId
    if (!postId) {
      console.log('Move player request in development mode - no postId available');
    }

    try {
      const { x, y, z } = req.body;
      const gameState = await getGameState(req.body.playerId || '');
      
      if (!gameState) {
        res.status(404).json({
          status: 'error',
          message: 'Game state not found'
        });
        return;
      }

      const player = gameState.player;
      const biome = gameState.currentBiome;

      // Update player position
      player.position = { x, y, z };
      
      // Update player in biome
      const biomePlayerIndex = biome.players.findIndex(p => p.id === player.id);
      if (biomePlayerIndex !== -1) {
        biome.players[biomePlayerIndex] = player;
      }

      await saveGameState(gameState);
      await savePlayer(player);
      await saveBiome(biome);

      res.json({
        type: 'move_player',
        postId: postId || 'dev_post',
        gameState,
        position: { x, y, z }
      });
    } catch (error) {
      console.error('Error moving player:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to move player'
      });
    }
  }
);

router.get<{ postId: string }, GetNearbyPlayersResponse | { status: string; message: string }>(
  '/api/nearby-players',
  async (req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    try {
      const playerId = req.query.playerId as string;
      const gameState = await getGameState(playerId);
      
      if (!gameState) {
        res.status(404).json({
          status: 'error',
          message: 'Game state not found'
        });
        return;
      }

      const nearbyPlayers = getNearbyPlayers(gameState.player, gameState.currentBiome);

      res.json({
        type: 'nearby_players',
        postId,
        players: nearbyPlayers
      });
    } catch (error) {
      console.error('Error getting nearby players:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get nearby players'
      });
    }
  }
);

// Keep existing endpoints but update them to work with new system
router.post<{ postId: string }, WaterTreeResponse | { status: string; message: string }, { treeId: string }>(
  '/api/water-tree',
  async (req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    try {
      const { treeId } = req.body;
      const gameState = await getGameState(req.body.playerId || '');
      
      if (!gameState) {
        res.status(404).json({
          status: 'error',
          message: 'Game state not found'
        });
        return;
      }

      if (gameState.resources.water <= 0) {
        res.json({
          type: 'water_tree',
          postId,
          gameState,
          success: false,
          message: 'Not enough water!'
        });
        return;
      }

      const tree = gameState.trees.find(t => t.id === treeId);
      if (!tree) {
        res.json({
          type: 'water_tree',
          postId,
          gameState,
          success: false,
          message: 'Tree not found!'
        });
        return;
      }

      tree.lastWatered = Date.now();
      tree.health = Math.min(100, tree.health + 20);
      gameState.resources.water -= 1;
      gameState.player.experience += 5;

      await saveGameState(gameState);

      res.json({
        type: 'water_tree',
        postId,
        gameState,
        success: true,
        message: `Watered ${tree.type} tree!`
      });
    } catch (error) {
      console.error('Error watering tree:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to water tree'
      });
    }
  }
);

router.post<{ postId: string }, HarvestTreeResponse | { status: string; message: string }, { treeId: string }>(
  '/api/harvest-tree',
  async (req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    try {
      const { treeId } = req.body;
      const gameState = await getGameState(req.body.playerId || '');
      
      if (!gameState) {
        res.status(404).json({
          status: 'error',
          message: 'Game state not found'
        });
        return;
      }

      const treeIndex = gameState.trees.findIndex(t => t.id === treeId);
      if (treeIndex === -1) {
        res.status(404).json({
          status: 'error',
          message: 'Tree not found!'
        });
        return;
      }

      const tree = gameState.trees[treeIndex];
      if (tree.growthStage < 5) {
        res.json({
          type: 'harvest_tree',
          postId,
          gameState,
          rewards: { coins: 0, seeds: 0, experience: 0 }
        });
        return;
      }

      // Calculate rewards based on tree type and health
      const baseReward = { oak: 20, pine: 15, cherry: 25, maple: 18, cedar: 22 };
      const coins = Math.floor(baseReward[tree.type] * (tree.health / 100));
      const seeds = Math.floor(Math.random() * 3) + 1;
      const experience = Math.floor(coins * 0.5);

      gameState.player.coins += coins;
      gameState.resources.coins = gameState.player.coins;
      gameState.resources.seeds += seeds;
      gameState.player.experience += experience;
      gameState.trees.splice(treeIndex, 1);

      // Check for achievements
      const newAchievements = checkAchievements(gameState.player, 'harvest_tree', gameState.trees.length);
      gameState.player.achievements.push(...newAchievements);

      await saveGameState(gameState);
      await savePlayer(gameState.player);

    res.json({
        type: 'harvest_tree',
      postId,
        gameState,
        rewards: { coins, seeds, experience },
        achievements: newAchievements
      });
    } catch (error) {
      console.error('Error harvesting tree:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to harvest tree'
      });
    }
  }
);

router.post<{ postId: string }, BuySeedsResponse | { status: string; message: string }, { treeType: TreeType; quantity: number }>(
  '/api/buy-seeds',
  async (req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    try {
      const { treeType, quantity = 1 } = req.body;
      const gameState = await getGameState(req.body.playerId || '');
      
      if (!gameState) {
        res.status(404).json({
          status: 'error',
          message: 'Game state not found'
        });
        return;
      }

      const totalCost = SEED_COST * quantity;

      if (gameState.player.coins < totalCost) {
        res.json({
          type: 'buy_seeds',
          postId,
          gameState,
          success: false,
          message: 'Not enough coins!'
        });
        return;
      }

      gameState.player.coins -= totalCost;
      gameState.resources.coins = gameState.player.coins;
      gameState.resources.seeds += quantity;

      await saveGameState(gameState);
      await savePlayer(gameState.player);

    res.json({
        type: 'buy_seeds',
      postId,
        gameState,
        success: true,
        message: `Bought ${quantity} ${treeType} seeds!`
      });
    } catch (error) {
      console.error('Error buying seeds:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to buy seeds'
      });
    }
  }
);

// Chat API endpoints
router.post('/api/send-chat-message', async (req, res): Promise<void> => {
  try {
    const { postId, playerId, message }: SendChatMessageRequest = req.body;

    if (!postId || !playerId || !message) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required fields'
      });
      return;
    }

    if (message.length > 200) {
      res.status(400).json({
        status: 'error',
        message: 'Message too long (max 200 characters)'
      });
      return;
    }

    const player = await getPlayer(playerId);
    if (!player) {
      res.status(404).json({
        status: 'error',
        message: 'Player not found'
      });
      return;
    }

    const chatMessage = await addChatMessage(playerId, player.username, message, 'player');

    res.json({
      success: true,
      message: 'Message sent',
      chatMessage
    });
  } catch (error) {
    console.error('Error sending chat message:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send message'
    });
  }
});

router.get('/api/chat-messages', async (req, res): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const messages = await getRecentChatMessages(limit);

    res.json({
      success: true,
      messages
    });
  } catch (error) {
    console.error('Error getting chat messages:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get messages'
    });
  }
});

router.post('/internal/on-app-install', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      status: 'success',
      message: `Post created in subreddit ${context.subredditName} with id ${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

router.post('/internal/menu/post-create', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

// Devvit Custom Post Type Configuration
// Note: Custom post types are handled by Devvit framework automatically

// Add custom post type for 3D world
// app.addCustomPostType({
//   name: '3D Forest World',
//   description: 'Enter the magical 3D forest world',
//   render: async (context) => {
//     const { reddit } = context;
//     
//     // Get user info after authentication
//     const user = await reddit.getCurrentUser();
//     
//     return {
//       type: 'custom',
//       body: `
//         <div style="width: 100%; height: 100vh; position: relative;">
//           <iframe 
//             id="3d-world-frame"
//             src="/3d-world?user=${user.username}&auth=${context.authToken}"
//             style="width: 100%; height: 100%; border: none;"
//             allow="fullscreen; webgl; gamepad"
//             sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
//           ></iframe>
//           
//           <!-- Loading overlay -->
//           <div id="loading-overlay" style="
//             position: absolute;
//             top: 0;
//             left: 0;
//             width: 100%;
//             height: 100%;
//             background: linear-gradient(135deg, #1e3c72, #2a5298);
//             display: flex;
//             flex-direction: column;
//             justify-content: center;
//             align-items: center;
//             color: white;
//             font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
//             z-index: 1000;
//           ">
//             <div style="text-align: center;">
//               <h1 style="font-size: 2.5rem; margin-bottom: 1rem; color: #90EE90;">
//                 🌳 Taming Trees 🌳
//               </h1>
//               <p style="font-size: 1.2rem; margin-bottom: 2rem; opacity: 0.9;">
//                 Welcome to the magical forest, ${user.username}!
//               </p>
//               <div style="
//                 width: 50px;
//                 height: 50px;
//                 border: 3px solid rgba(144, 238, 144, 0.3);
//                 border-top: 3px solid #90EE90;
//                 border-radius: 50%;
//                 animation: spin 1s linear infinite;
//                 margin: 0 auto;
//               "></div>
//               <p style="margin-top: 1rem; opacity: 0.7;">
//                 Loading your forest...
//               </p>
//             </div>
//           </div>
//           
//           <style>
//             @keyframes spin {
//               0% { transform: rotate(0deg); }
//               100% { transform: rotate(360deg); }
//             }
//           </style>
//           
//           <script>
//             // Hide loading overlay when iframe loads
//             document.getElementById('3d-world-frame').onload = function() {
//               setTimeout(() => {
//                 document.getElementById('loading-overlay').style.display = 'none';
//               }, 2000);
//             };
//             
//             // Handle iframe communication
//             window.addEventListener('message', function(event) {
//               if (event.origin !== window.location.origin) return;
//               
//               if (event.data.type === 'game-ready') {
//                 document.getElementById('loading-overlay').style.display = 'none';
//               }
//             });
//           </script>
//         </div>
//       `
//     };
//   },
// });

// Serve 3D world iframe
router.get('/3d-world', async (req, res): Promise<void> => {
  try {
    const { user, auth } = req.query;
    
    if (!user || !auth) {
      res.status(400).send('Missing user or auth parameters');
      return;
    }
    
    // Serve the 3D world HTML with authentication
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Taming Trees - 3D World</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            color: rgba(255, 255, 255, 0.87);
            background-color: #0f0f0f;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
          }
          
          #app {
            width: 100%;
            height: 100vh;
            overflow: hidden;
          }
          
          #game-container {
            width: 100%;
            height: 100%;
            position: relative;
          }
          
          #loading-screen {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #1e3c72, #2a5298);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: white;
            z-index: 1000;
          }
          
          .loading-spinner {
            width: 50px;
            height: 50px;
            border: 3px solid rgba(144, 238, 144, 0.3);
            border-top: 3px solid #90EE90;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 1rem;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          .loading-text {
            font-size: 1.2rem;
            opacity: 0.9;
            text-align: center;
          }
          
          .welcome-text {
            font-size: 2rem;
            color: #90EE90;
            margin-bottom: 1rem;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div id="app">
          <div id="game-container">
            <div id="loading-screen">
              <div class="welcome-text">🌳 Welcome to Taming Trees! 🌳</div>
              <div class="loading-spinner"></div>
              <div class="loading-text">Loading your forest, ${user}...</div>
            </div>
          </div>
        </div>
        
        <script>
          // Authentication data
          window.gameAuth = {
            username: '${user}',
            authToken: '${auth}',
            timestamp: Date.now()
          };
          
          // Notify parent when ready
          function notifyParent() {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({
                type: 'game-ready',
                username: '${user}'
              }, '*');
            }
          }
          
          // Load the 3D world
          async function loadGame() {
            try {
              // Import the main game module
              const { default: initGame } = await import('./main.js');
              
              // Initialize the game with authentication
              await initGame(window.gameAuth);
              
              // Hide loading screen
              document.getElementById('loading-screen').style.display = 'none';
              
              // Notify parent
              notifyParent();
              
            } catch (error) {
              console.error('Failed to load game:', error);
              document.getElementById('loading-screen').innerHTML = 
                '<div class="welcome-text">❌ Error Loading Game</div>' +
                '<div class="loading-text">Please refresh the page</div>';
            }
          }
          
          // Start loading
          loadGame();
        </script>
        
        <script type="module" src="./main.js"></script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error serving 3D world:', error);
    res.status(500).send('Error loading 3D world');
  }
});

app.use(router);

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(getServerPort());
