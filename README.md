# 🌳 Taming Trees 🌳

<div align="center">

![Taming Trees Logo](https://img.shields.io/badge/🌳-Taming%20Trees-90EE90?style=for-the-badge&logoColor=white)

**A Magical Forest Management Game on Reddit**

[![Devvit](https://img.shields.io/badge/Built%20with-Devvit-FF4500?style=flat-square&logo=reddit)](https://devvit.dev)
[![Three.js](https://img.shields.io/badge/3D-Three.js-000000?style=flat-square&logo=threedotjs)](https://threejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io)

</div>

---

## 🎮 Game Overview

**Taming Trees** is an immersive 3D forest management game built for Reddit using Devvit. Players explore a procedurally generated world, plant magical trees, manage resources, and build their own forest empire while interacting with other players in a shared biome.

### ✨ Key Features

- 🌲 **3D Forest Environment** - Explore rolling hills, valleys, and mountain peaks
- 🌱 **Tree Management** - Plant, water, and harvest 5 different tree types
- 🏡 **Land Ownership** - Purchase land plots to expand your forest
- 🏆 **Achievement System** - Unlock rewards as you progress
- 👥 **Multiplayer** - Share the world with up to 5,000 players
- 🗺️ **Real-time Minimap** - Navigate with an interactive map
- 📱 **Mobile & Desktop** - Responsive design for all devices

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Redis server (for data persistence)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ConstCorrectness/tamingtrees.git
   cd tamingtrees
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.template .env
   # Edit .env with your Redis connection details
   ```

4. **Start Redis server**
   ```bash
   # Using Docker
   docker run -d -p 6379:6379 redis:alpine
   
   # Or install locally
   # macOS: brew install redis && brew services start redis
   # Ubuntu: sudo apt install redis-server && sudo systemctl start redis
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Deploy to Reddit**
   ```bash
   npm run deploy
   ```

---

## 🎯 How to Play

### 🎮 Controls

| Action | Desktop | Mobile |
|--------|---------|--------|
| **Move** | WASD / Arrow Keys | Touch Controls |
| **Toggle UI** | Tab Key | Toggle Button |
| **Interact** | Click Trees | Tap Trees |
| **Plant Tree** | Click "Plant Tree" | Tap "Plant Tree" |

### 🌱 Gameplay Loop

1. **🏃 Explore** - Use WASD to move around the 3D world
2. **🏡 Claim Land** - Purchase land plots to plant trees
3. **🌲 Plant Trees** - Choose from 5 magical tree types
4. **💧 Water Trees** - Keep your trees healthy for growth
5. **🌾 Harvest** - Collect resources when trees mature
6. **🏆 Achieve** - Unlock achievements and level up
7. **👥 Socialize** - Meet other players in the shared biome

### 🌳 Tree Types

| Tree | Cost | Growth Time | Special Properties |
|------|------|------------|-------------------|
| 🌳 **Oak** | 10🪙 | 5 stages | High durability |
| 🌲 **Pine** | 10🪙 | 5 stages | Fast growth |
| 🌸 **Cherry** | 10🪙 | 5 stages | Beautiful blooms |
| 🍁 **Maple** | 10🪙 | 5 stages | Seasonal colors |
| 🌲 **Cedar** | 10🪙 | 5 stages | Mountain variety |

### 🏆 Achievement Categories

- 🌱 **Gardener** - Planting achievements
- 💧 **Hydration** - Watering achievements  
- 🏡 **Landowner** - Land purchase achievements
- 🌲 **Forester** - Tree management achievements
- 👥 **Social** - Multiplayer achievements

---

## 🛠️ Technical Architecture

### 📁 Project Structure

```
tamingtrees/
├── src/
│   ├── client/          # Frontend (Three.js + HTML/CSS)
│   │   ├── main.ts      # 3D rendering & game logic
│   │   ├── index.html   # UI structure
│   │   └── index.css    # Styling & responsive design
│   ├── server/          # Backend (Node.js + Express)
│   │   ├── index.ts     # API endpoints & game logic
│   │   └── core/
│   │       └── post.ts  # Reddit post creation
│   └── shared/          # Shared types
│       └── types/
│           └── api.ts    # TypeScript interfaces
├── assets/              # Game assets
├── devvit.json         # Devvit configuration
└── package.json        # Dependencies & scripts
```

### 🔧 Tech Stack

- **Frontend**: Three.js, TypeScript, HTML5, CSS3
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: Redis (in-memory data store)
- **Platform**: Reddit Devvit
- **3D Graphics**: Three.js WebGL renderer

### 🌐 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/init` | POST | Initialize player & game state |
| `/api/plant-tree` | POST | Plant tree at coordinates |
| `/api/water-tree` | POST | Water specific tree |
| `/api/harvest-tree` | POST | Harvest mature tree |
| `/api/buy-seeds` | POST | Purchase tree seeds |
| `/api/buy-land` | POST | Purchase land plot |
| `/api/move-player` | POST | Update player position |
| `/api/nearby-players` | GET | Get players in radius |

---

## 🎨 Game Features

### 🌍 3D World

- **Procedural Terrain** - Rolling hills, valleys, and mountain peaks
- **Dynamic Lighting** - Realistic shadows and ambient lighting
- **Environmental Details** - Scattered rocks and natural features
- **Biome System** - Different environmental types (Forest, Desert, etc.)

### 👤 Player System

- **Avatar Customization** - Unique player representations
- **Progression** - Level up through experience points
- **Resource Management** - Coins, seeds, water, fertilizer
- **Land Ownership** - Grid-based land plot system

### 🗺️ Navigation

- **Real-time Minimap** - Top-down view of the world
- **Player Tracking** - See your position and other players
- **Land Visualization** - Owned vs. available land plots
- **Tree Locations** - Track all planted trees

---

## 📱 Mobile Support

The game is fully responsive and optimized for mobile devices:

- **Touch Controls** - Intuitive touch-based movement
- **Responsive UI** - Adapts to all screen sizes
- **Mobile-First Design** - Optimized for mobile gameplay
- **Performance** - Smooth 60fps on mobile devices

---

## 🚀 Deployment

### Reddit Devvit Deployment

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Deploy to Reddit**
   ```bash
   npm run deploy
   ```

3. **Configure subreddit**
   - Add the app to your subreddit
   - Set up permissions
   - Configure moderation settings

### Environment Variables

```env
REDIS_URL=redis://localhost:6379
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret
REDDIT_USERNAME=your_username
REDDIT_PASSWORD=your_password
```

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### 🐛 Bug Reports
- Use GitHub Issues
- Include steps to reproduce
- Provide system information

### 💡 Feature Requests
- Describe the feature
- Explain the use case
- Consider implementation complexity

### 🔧 Code Contributions
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### 📋 Development Guidelines

- Follow TypeScript best practices
- Use meaningful commit messages
- Test on both mobile and desktop
- Ensure responsive design
- Document new features

---

## 📊 Performance

### 🎯 Optimization Features

- **Efficient Rendering** - Only render visible objects
- **LOD System** - Level-of-detail for distant objects
- **Memory Management** - Proper cleanup of Three.js objects
- **Network Optimization** - Throttled server updates
- **Mobile Optimization** - Reduced polygon count for mobile

### 📈 Benchmarks

- **Desktop**: 60fps @ 1080p
- **Mobile**: 60fps @ 720p
- **Load Time**: < 3 seconds
- **Memory Usage**: < 100MB

---

## 🎮 Game Modes

### 🌱 Single Player
- Explore the world at your own pace
- Build your forest empire
- Complete achievements
- Learn game mechanics

### 👥 Multiplayer
- Share the world with other players
- See other players in real-time
- Compete for land plots
- Social interactions

---

## 🔮 Future Features

### 🚧 Planned Updates

- **🌍 New Biomes** - Desert, Arctic, Tropical
- **🏰 Buildings** - Houses, workshops, markets
- **🐾 Wildlife** - Animals and creatures
- **🌦️ Weather** - Dynamic weather system
- **📱 Mobile App** - Native mobile application
- **🎵 Audio** - Ambient sounds and music
- **🎨 Customization** - More avatar options

### 💡 Ideas Welcome!

Have ideas for new features? We'd love to hear them!

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Reddit Devvit Team** - For the amazing platform
- **Three.js Community** - For the incredible 3D library
- **Contributors** - Everyone who helped make this possible
- **Players** - For feedback and suggestions

---

## 📞 Support

### 🆘 Getting Help

- **GitHub Issues** - Bug reports and feature requests
- **Reddit Community** - r/tamingtrees for discussions
- **Discord** - Real-time chat and support
- **Email** - support@tamingtrees.com

### 📚 Resources

- [Devvit Documentation](https://developers.reddit.com/docs)
- [Three.js Documentation](https://threejs.org/docs)
- [Reddit API Guide](https://www.reddit.com/dev/api)

---

<div align="center">

**🌳 Start your forest adventure today! 🌳**

[![Play Now](https://img.shields.io/badge/Play%20Now-Start%20Growing-90EE90?style=for-the-badge&logo=gamepad)](https://reddit.com/r/tamingtrees)

Made with ❤️ by the Taming Trees Team

</div>