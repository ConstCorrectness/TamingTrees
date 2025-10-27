# Changelog

All notable changes to Taming Trees will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive README with logos and instructions
- Contributing guidelines
- Changelog documentation

## [1.0.0] - 2024-01-XX

### Added
- 🌳 **Core Game Features**
  - 3D forest environment with procedural terrain
  - 5 different tree types (Oak, Pine, Cherry, Maple, Cedar)
  - Land ownership system with grid-based plots
  - Resource management (coins, seeds, water, fertilizer)
  - Player progression with levels and experience

- 🎮 **Gameplay Mechanics**
  - Tree planting, watering, and harvesting
  - Achievement system with multiple categories
  - Multiplayer support for up to 5,000 players
  - Real-time minimap with player tracking
  - Land plot purchasing system

- 🌍 **3D World**
  - Procedural terrain generation with hills and mountains
  - Dynamic lighting and shadows
  - Scattered rocks and environmental details
  - Camera following system
  - Boundary constraints for player movement

- 🎨 **User Interface**
  - Responsive design for mobile and desktop
  - Toggleable UI system (Tab key or button)
  - Real-time resource display
  - Achievement progress tracking
  - Shop system for seeds and land
  - Instructions and help system

- 📱 **Mobile Support**
  - Touch controls for movement
  - Responsive layout adaptation
  - Mobile-optimized performance
  - Touch-friendly button sizes

- 🔧 **Technical Features**
  - Three.js 3D rendering
  - Redis data persistence
  - RESTful API endpoints
  - TypeScript type safety
  - Devvit Reddit integration

### Technical Details
- **Frontend**: Three.js, TypeScript, HTML5, CSS3
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: Redis in-memory store
- **Platform**: Reddit Devvit
- **Performance**: 60fps on desktop and mobile

### API Endpoints
- `POST /api/init` - Initialize player and game state
- `POST /api/plant-tree` - Plant tree at coordinates
- `POST /api/water-tree` - Water specific tree
- `POST /api/harvest-tree` - Harvest mature tree
- `POST /api/buy-seeds` - Purchase tree seeds
- `POST /api/buy-land` - Purchase land plot
- `POST /api/move-player` - Update player position
- `GET /api/nearby-players` - Get players in radius

### Game Balance
- Starting coins: 200
- Tree seed cost: 10 coins each
- Land plot cost: 50 coins
- Water cost: 1 per tree
- Growth stages: 5 levels
- Max trees per plot: 10
- World size: 200x200 units
- Player movement speed: 0.3 units/frame

### Known Issues
- None at initial release

### Future Plans
- Additional biomes (Desert, Arctic, Tropical)
- Building system (houses, workshops)
- Wildlife and creatures
- Weather system
- Audio and music
- Native mobile app
- Advanced customization options

---

## Version History

- **v1.0.0** - Initial release with core gameplay features
- **v0.9.0** - Beta testing phase
- **v0.8.0** - Alpha testing phase
- **v0.7.0** - Early development phase

---

## Release Notes

### v1.0.0 Release Notes
🎉 **Welcome to Taming Trees!** 

The first official release brings you a complete 3D forest management experience on Reddit. Plant magical trees, explore rolling hills and mountain peaks, and build your forest empire alongside other players.

**Key Highlights:**
- Immersive 3D world with procedural terrain
- 5 unique tree types to discover and grow
- Land ownership system for expansion
- Achievement system to track your progress
- Real-time multiplayer with up to 5,000 players
- Mobile and desktop support

**Getting Started:**
1. Use WASD or arrow keys to move around
2. Click "Buy Land" to purchase your first plot
3. Plant trees and water them regularly
4. Harvest mature trees for resources
5. Expand your forest and unlock achievements!

**Controls:**
- **Movement**: WASD / Arrow Keys
- **Toggle UI**: Tab key or toggle button
- **Interact**: Click on trees and UI elements
- **Mobile**: Touch controls for all interactions

Enjoy your forest adventure! 🌳✨
