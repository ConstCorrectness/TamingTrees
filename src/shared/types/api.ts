export type TreeType = 'oak' | 'pine' | 'cherry' | 'maple' | 'cedar';

export type Tree = {
  id: string;
  type: TreeType;
  x: number;
  y: number;
  z: number;
  growthStage: number; // 0-5 (seed to mature)
  plantedAt: number;
  lastWatered: number;
  health: number; // 0-100
  ownerId: string;
};

export type LandPlot = {
  id: string;
  x: number;
  z: number;
  ownerId: string;
  biomeType: BiomeType;
  trees: string[]; // Tree IDs
  purchasedAt: number;
  price: number;
};

export type BiomeType = 'forest' | 'meadow' | 'hills' | 'lake' | 'mountain';

export type Player = {
  id: string;
  username: string;
  avatar: string;
  level: number;
  experience: number;
  coins: number;
  achievements: Achievement[];
  landPlots: string[]; // Land plot IDs
  position: { x: number; y: number; z: number };
  lastActive: number;
};

export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: number;
  category: AchievementCategory;
};

export type AchievementCategory = 'planting' | 'harvesting' | 'exploration' | 'social' | 'economy' | 'mastery';

export type Biome = {
  id: string;
  name: string;
  type: BiomeType;
  maxPlayers: number;
  landPlots: LandPlot[];
  players: Player[];
  environment: {
    skyColor: string;
    groundColor: string;
    fogColor: string;
    fogDensity: number;
  };
};

export type GameState = {
  player: Player;
  currentBiome: Biome;
  trees: Tree[];
  resources: {
    seeds: number;
    water: number;
    fertilizer: number;
    coins: number;
  };
  lastPlayed: number;
};

export type InitResponse = {
  type: "init";
  postId: string;
  gameState: GameState;
  username: string;
  nearbyPlayers: Player[];
};

export type PlantTreeResponse = {
  type: "plant_tree";
  postId: string;
  gameState: GameState;
  success: boolean;
  message: string;
  achievements?: Achievement[];
};

export type WaterTreeResponse = {
  type: "water_tree";
  postId: string;
  gameState: GameState;
  success: boolean;
  message: string;
  achievements?: Achievement[];
};

export type HarvestTreeResponse = {
  type: "harvest_tree";
  postId: string;
  gameState: GameState;
  rewards: {
    coins: number;
    seeds: number;
    experience: number;
  };
  achievements?: Achievement[];
};

export type BuySeedsResponse = {
  type: "buy_seeds";
  postId: string;
  gameState: GameState;
  success: boolean;
  message: string;
};

export type BuyLandResponse = {
  type: "buy_land";
  postId: string;
  gameState: GameState;
  success: boolean;
  message: string;
  landPlot?: LandPlot;
};

export type MovePlayerResponse = {
  type: "move_player";
  postId: string;
  gameState: GameState;
  position: { x: number; y: number; z: number };
};

export type GetNearbyPlayersResponse = {
  type: "nearby_players";
  postId: string;
  players: Player[];
};
