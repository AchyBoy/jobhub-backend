import 'dotenv/config';

export default {
  expo: {
    owner: 'achyboy',
    name: 'JobHub',
    slug: 'JobHub',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'jobhub',
    userInterfaceStyle: 'automatic',

ios: {
  supportsTablet: true,
  bundleIdentifier: 'com.jobhubgo.app',
  buildNumber: '5',
  infoPlist: {
    ITSAppUsesNonExemptEncryption: false,
  },
},

    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: 'com.jobhubgo.app',
    },

    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },

    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: { backgroundColor: '#000000' },
        },
      ],
      'expo-web-browser',
    ],

    experiments: {
      typedRoutes: true,
    },

    // 🔑 THIS IS WHAT UNBLOCKS POSTGRES
extra: {
  EXPO_PUBLIC_API_BASE:
    process.env.EXPO_PUBLIC_API_BASE ||
    "https://api.jobhubgo.com",
  eas: {
    projectId: "b3f91b32-f58f-4740-b078-68338aed0767",
  },
},
  },
};