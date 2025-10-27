# Contributing to Taming Trees 🌳

Thank you for your interest in contributing to Taming Trees! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Redis server
- Git

### Development Setup
1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Start Redis server
5. Run development server: `npm run dev`

## 🎯 How to Contribute

### 🐛 Bug Reports
When reporting bugs, please include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- System information (OS, browser, device)
- Screenshots if applicable

### 💡 Feature Requests
For new features:
- Describe the feature clearly
- Explain the use case and benefits
- Consider implementation complexity
- Check if it aligns with project goals

### 🔧 Code Contributions

#### Code Style
- Follow TypeScript best practices
- Use meaningful variable and function names
- Add comments for complex logic
- Maintain consistent formatting

#### Commit Messages
Use conventional commit format:
```
feat: add new tree type
fix: resolve movement bug on mobile
docs: update README
style: improve button styling
refactor: optimize terrain generation
```

#### Pull Request Process
1. Create a feature branch from `main`
2. Make your changes
3. Test thoroughly (desktop + mobile)
4. Update documentation if needed
5. Submit pull request with clear description

## 🧪 Testing

### Manual Testing
- Test on multiple browsers (Chrome, Firefox, Safari)
- Test on mobile devices (iOS, Android)
- Test different screen sizes
- Verify all game mechanics work

### Automated Testing
- Unit tests for utility functions
- Integration tests for API endpoints
- Performance tests for 3D rendering

## 📁 Project Structure

```
src/
├── client/          # Frontend code
│   ├── main.ts      # Main game logic
│   ├── index.html   # UI structure
│   └── index.css    # Styling
├── server/          # Backend code
│   ├── index.ts     # API endpoints
│   └── core/        # Core functionality
└── shared/          # Shared types
    └── types/       # TypeScript interfaces
```

## 🎮 Game Development Guidelines

### 3D Graphics
- Use Three.js best practices
- Optimize for performance
- Consider mobile limitations
- Clean up resources properly

### UI/UX
- Mobile-first design
- Responsive layouts
- Accessible controls
- Clear visual feedback

### Backend
- Validate all inputs
- Handle errors gracefully
- Use Redis efficiently
- Implement proper logging

## 🐛 Common Issues

### Performance Issues
- Too many objects in scene
- Memory leaks from Three.js objects
- Inefficient rendering loops
- Large texture sizes

### Mobile Issues
- Touch event handling
- Screen size adaptation
- Performance on low-end devices
- Battery optimization

### Network Issues
- API rate limiting
- Connection timeouts
- Data synchronization
- Offline handling

## 📋 Development Checklist

Before submitting code:
- [ ] Code follows project style guidelines
- [ ] All tests pass
- [ ] Manual testing completed
- [ ] Documentation updated
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Mobile compatibility verified

## 🎯 Areas for Contribution

### High Priority
- Bug fixes
- Performance optimizations
- Mobile improvements
- Documentation updates

### Medium Priority
- New features
- UI/UX improvements
- Code refactoring
- Test coverage

### Low Priority
- Nice-to-have features
- Code style improvements
- Additional documentation
- Examples and tutorials

## 💬 Communication

### Getting Help
- GitHub Issues for bugs and features
- Discord for real-time chat
- Reddit community for discussions

### Code Reviews
- Be constructive and helpful
- Focus on code quality
- Suggest improvements
- Ask questions if unclear

## 📜 Code of Conduct

### Our Standards
- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Help others learn and grow

### Unacceptable Behavior
- Harassment or discrimination
- Spam or off-topic content
- Disruptive behavior
- Violation of Reddit's terms

## 🏆 Recognition

Contributors will be recognized:
- Listed in README.md
- Mentioned in release notes
- Invited to contributor Discord
- Considered for maintainer role

## 📞 Contact

- **Project Lead**: [Your Name]
- **Email**: contributors@tamingtrees.com
- **Discord**: [Discord Server Link]
- **Reddit**: r/tamingtrees

Thank you for contributing to Taming Trees! 🌳
