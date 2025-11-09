import { useEffect, useRef, useState, useCallback } from "react";
import { baseUrl } from "./baseUrl";
import toast from "react-hot-toast";

export function useConnectionStatus({ pollInterval = 5000, timeout = 3000 } = {}) {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : false);
  const [serverUp, setServerUp] = useState(null);

  const prevOnlineRef = useRef(online);
  const prevServerUpRef = useRef(null);

  const onlineStableTimerRef = useRef(null);
  const serverStableTimerRef = useRef(null);

  const controllerRef = useRef(null);
  const pollIdRef = useRef(null);

  const initializedRef = useRef(false);
  const initTimerRef = useRef(null);

  const clearTimer = (ref) => {
    if (ref.current) {
      clearTimeout(ref.current);
      ref.current = null;
    }
  };

  useEffect(() => {
    initTimerRef.current = setTimeout(() => {
      initializedRef.current = true;
    }, 5000);
    return () => {
      clearTimer(initTimerRef);
    };
  }, []);

  const scheduleOnlineToast = useCallback((nextOnline) => {
    clearTimer(onlineStableTimerRef);
    onlineStableTimerRef.current = setTimeout(() => {
      const prev = prevOnlineRef.current;
      if (!initializedRef.current) return;
      if (prev !== nextOnline) {
        if (nextOnline) toast.success("Back online");
        else toast.error("You're offline");
        prevOnlineRef.current = nextOnline;
      }
    }, 5000);
  }, []);

  const scheduleServerToast = useCallback((nextUp) => {
    clearTimer(serverStableTimerRef);
    serverStableTimerRef.current = setTimeout(() => {
      const prev = prevServerUpRef.current;
      if (!initializedRef.current) return;
      if (prev !== nextUp) {
        if (nextUp) toast.success("Connected to server");
        else toast.error("Lost connection to server");
        prevServerUpRef.current = nextUp;
      }
    }, 5000);
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      scheduleOnlineToast(true);
    };
    const onOffline = () => {
      setOnline(false);
      scheduleOnlineToast(false);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearTimer(onlineStableTimerRef);
    };
  }, [scheduleOnlineToast]);

  const serverBase = baseUrl.replace(/\/api\/?$/i, "");

  const checkServer = useCallback(
    async (signal) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setServerUp(false);
        scheduleServerToast(false);
        return false;
      }
      try {
        const res = await fetch(`${serverBase}/health`, { method: "GET", signal });
        if (res && (res.ok || res.status === 404)) {
          setServerUp(true);
          scheduleServerToast(true);
          return true;
        }
        setServerUp(false);
        scheduleServerToast(false);
        return false;
      } catch {
        setServerUp(false);
        scheduleServerToast(false);
        return false;
      }
    },
    [serverBase, scheduleServerToast]
  );

  const checkNow = useCallback(async () => {
    if (controllerRef.current) controllerRef.current.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const abortIn = setTimeout(() => controller.abort(), timeout);
    try {
      const ok = await checkServer(controller.signal);
      clearTimeout(abortIn);
      controllerRef.current = null;
      return ok;
    } catch {
      clearTimeout(abortIn);
      controllerRef.current = null;
      return false;
    }
  }, [checkServer, timeout]);

  useEffect(() => {
    const startPolling = () => {
      if (pollIdRef.current) return;
      checkNow();
      pollIdRef.current = setInterval(() => {
        checkNow();
      }, pollInterval);
    };
    const stopPolling = () => {
      if (pollIdRef.current) {
        clearInterval(pollIdRef.current);
        pollIdRef.current = null;
      }
    };
    const handleVisibility = () => {
      if (document.hidden) stopPolling();
      else startPolling();
    };

    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      stopPolling();
      if (controllerRef.current) controllerRef.current.abort();
      clearTimer(serverStableTimerRef);
    };
  }, [checkNow, pollInterval]);

  useEffect(() => {
    if (prevOnlineRef.current === undefined) prevOnlineRef.current = online;
    if (prevServerUpRef.current === null && serverUp !== null) {
      prevServerUpRef.current = serverUp;
    }
  }, [online, serverUp]);

  return { online, serverUp, checkNow };
}

export async function pingServer(timeout = 3000) {
  const serverBase = baseUrl.replace(/\/api\/?$/i, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${serverBase}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return !!res && (res.ok || res.status === 404);
  } catch {
    clearTimeout(timer);
    return false;
  }
}
