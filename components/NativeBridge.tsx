"use client";

import { useEffect } from "react";
import {
  ensureNotificationPermission,
  registerNotificationTapHandler,
} from "@/lib/native-notifications";

// Mounted once at the app root. On the native app it asks for notification
// permission and wires notification taps to navigate into the right checklist.
// On the web (SuperApp MiniApp) everything here is a no-op.
export function NativeBridge() {
  useEffect(() => {
    void registerNotificationTapHandler();
    void ensureNotificationPermission();
  }, []);

  return null;
}
