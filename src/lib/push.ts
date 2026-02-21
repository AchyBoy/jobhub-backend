// JobHub/src/lib/push.ts
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.log("Push requires physical device");
    return null;
  }

  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } =
      await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push permission denied");
    return null;
  }

  const tokenData =
    await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });

  return tokenData.data;
}