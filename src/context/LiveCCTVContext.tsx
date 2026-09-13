import { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  ReactNode 
} from 'react';
import { useAuth } from './AuthContext';[cite: 9, 10]
import * as db from '../lib/supabaseServices';[cite: 9, 10]

interface LiveCCTVContextType {
  activeStreams: any[];
  streamStatus: Record<string, boolean>;
  refreshStreams: () => Promise<void>;
}

const LiveCCTVContext = createContext<LiveCCTVContextType | undefined>(undefined);

export const LiveCCTVProvider = ({ children }: { children: ReactNode }) => {
  const [activeStreams, setActiveStreams] = useState<any[]>([]);
  const [streamStatus, setStreamStatus] = useState<Record<string, boolean>>({});
  const { user } = useAuth();[cite: 9, 10]

  const refreshStreams = async () => {
    try {
      if (!user) return;[cite: 9, 10]
      const streams = await db.getActiveCCTVStreams?.() || [];
      setActiveStreams(streams);
    } catch (error) {
      console.error('Failed to fetch CCTV streams:', error);
    }
  };

  useEffect(() => {
    refreshStreams();
  }, [user]);

  return (
    <LiveCCTVContext.Provider value={{ activeStreams, streamStatus, refreshStreams }}>
      {children}
    </LiveCCTVContext.Provider>
  );
};

export const useLiveCCTV = () => {
  const context = useContext(LiveCCTVContext);
  if (!context) {
    throw new Error('useLiveCCTV must be used within a LiveCCTVProvider');
  }
  return context;
};
