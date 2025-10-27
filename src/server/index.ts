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

// Game configuration
const TREE_TYPES: TreeType[] = ['oak', 'pine', 'cherry', 'maple', 'cedar'];
const GROWTH_TIME = 30000; // 30 seconds per growth stage
const MAX_TREES_PER_PLOT = 5;
const SEED_COST = 10;
const WATER_COST = 5;
const LAND_PLOT_COST = 100;
const BIOME_SIZE = 100; // 100x100 grid
const MAX_PLAYERS_PER_BIOME = 5000;

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

function getRandomPosition(): { x: number; y: number; z: number } {
  return {
    x: (Math.random() - 0.5) * BIOME_SIZE,
    y: 0,
    z: (Math.random() - 0.5) * BIOME_SIZE
  };
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
    id: 'forest_biome_1',
    name: 'Ancient Forest',
    type: 'forest',
    maxPlayers: MAX_PLAYERS_PER_BIOME,
    landPlots: [],
    players: [],
    environment: BIOME_CONFIGS.forest
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
  // Find an empty spot for starting land
  let attempts = 0;
  let x = 0, z = 0;
  
  while (attempts < 100) {
    x = Math.floor((Math.random() - 0.5) * 40) * 10; // Grid-aligned positions
    z = Math.floor((Math.random() - 0.5) * 40) * 10;
    
    // Check if this spot is available
    const existingPlot = biome.landPlots.find(plot => 
      Math.abs(plot.x - x) < 10 && Math.abs(plot.z - z) < 10
    );
    
    if (!existingPlot) {
      break;
    }
    
    attempts++;
  }
  
  // Create starting land plot
  const startingLandPlot: LandPlot = {
    id: `land_${player.id}_start`,
    x,
    z,
    ownerId: player.id,
    biomeType: biome.type,
    trees: [],
    purchasedAt: Date.now(),
    price: 0 // Free starting land
  };
  
  biome.landPlots.push(startingLandPlot);
  player.landPlots.push(startingLandPlot.id);
  
  // Set player position to their starting land
  player.position = { x, y: 0, z };
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

    if (!postId) {
      console.error('API Init Error: postId not found in devvit context');
      res.status(400).json({
        status: 'error',
        message: 'postId is required but missing from context',
      });
      return;
    }

    try {
      const username = await reddit.getCurrentUsername();
      if (!username) {
        res.status(400).json({
          status: 'error',
          message: 'Could not get username',
        });
        return;
      }

      // Try to get existing player
      let player = await getPlayer(username);
      let biome = await getBiome('forest_biome_1');
      
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
        postId: postId,
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
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
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
        postId,
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

app.use(router);

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(getServerPort());
