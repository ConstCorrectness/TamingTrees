import { context, reddit } from '@devvit/web/server';

export const createPost = async () => {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error('subredditName is required');
  }

  return await reddit.submitCustomPost({
    splash: {
      // Splash Screen Configuration
      appDisplayName: 'Taming Trees',
      backgroundUri: 'default-splash.png',
      buttonLabel: 'Start Growing',
      description: 'Grow and manage your magical forest!',
      entryUri: 'index.html',
      heading: 'Welcome to Taming Trees!',
      appIconUri: 'default-icon.png',
    },
    postData: {
      gameState: 'initial',
      score: 0,
    },
    subredditName: subredditName,
    title: '🌳 Taming Trees - Forest Management Game 🌳',
  });
};
