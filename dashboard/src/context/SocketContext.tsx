import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";

// ===================================================================
// App-wide kiçik Context (plan: "Client state ... app-wide üçün kiçik
// Context (socket bağlantısı)"). Yalnız bağlantının ÖZÜNÜ idarə edir —
// domain hadisələrinin (portfolio:update və s.) query cache-ə yazılması
// `hooks/useSocket.ts`-in işidir.
// ===================================================================

interface SocketContextValue {
  socket: Socket;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  // `ref` ilə TƏK dəfə yaradılır (lazy init) — React 18 StrictMode dev-də
  // effektləri iki dəfə çağırır; socket YARADILMASI render zamanı, ƏLAQƏNİN
  // özü isə app-ın bütün ömrü boyu sürməlidir. Əvvəllər `useMemo` + effekt
  // cleanup-ında `socket.disconnect()` istifadə edilirdi — StrictMode-un
  // double-invoke-u bunu dərhal reconnect-ə (yeni sid) məcbur edirdi.
  const socketRef = useRef<Socket | null>(null);
  if (!socketRef.current) {
    socketRef.current = io(import.meta.env.VITE_API_URL ?? "http://localhost:4000");
  }
  const socket = socketRef.current;
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    setConnected(socket.connected); // effekt yenidən qoşulanda cari vəziyyəti sinxronlaşdır (StrictMode)
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket]);

  const value = useMemo(() => ({ socket, connected }), [socket, connected]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocketContext(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocketContext SocketProvider daxilində istifadə olunmalıdır");
  return ctx;
}
