import { useState, useEffect, useRef } from "react";
import { Users, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_AVATAR, getInitials, formatPhoneFromJid } from "@/lib/whatsapp-utils";

interface Participant {
  id: string;
  phone: string;
  jid: string;
  name?: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  photoUrl?: string | null;
}

interface GroupParticipantsPanelProps {
  groupJid: string;
  groupName: string;
  groupPhoto?: string | null;
  participantCount: number;
  apiKey: string;
  onSelectParticipant?: (phone: string, name?: string) => void;
}

const RATE_LIMIT_DELAY_MS = 500;
const BATCH_SIZE = 5;

export const GroupParticipantsPanel = ({
  groupJid,
  groupName,
  groupPhoto,
  participantCount,
  apiKey,
  onSelectParticipant,
}: GroupParticipantsPanelProps) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [photoLoadProgress, setPhotoLoadProgress] = useState({ current: 0, total: 0 });
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFetchRef = useRef<{ key: string; at: number }>({ key: "", at: 0 });

  // Load cached participants from database
  const loadCachedParticipants = async (): Promise<Participant[]> => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_group_participants")
        .select("*")
        .eq("group_jid", groupJid)
        .eq("session_id", apiKey);

      if (error) {
        console.error("[GroupParticipantsPanel] Cache load error:", error);
        return [];
      }

      if (data && data.length > 0) {
        console.log("[GroupParticipantsPanel] Loaded from cache:", data.length);
        return data.map((p) => ({
          id: p.participant_jid,
          jid: p.participant_jid,
          phone: p.phone,
          name: p.name || undefined,
          isAdmin: p.is_admin || false,
          isSuperAdmin: p.is_super_admin || false,
          photoUrl: p.photo_url,
        }));
      }
      return [];
    } catch (err) {
      console.error("[GroupParticipantsPanel] Cache error:", err);
      return [];
    }
  };

  // Save participants to database cache
  const saveToCache = async (participantsList: Participant[]) => {
    if (participantsList.length === 0) return;

    try {
      const records = participantsList.map((p) => ({
        group_jid: groupJid,
        session_id: apiKey,
        participant_jid: p.jid,
        phone: p.phone,
        name: p.name || null,
        photo_url: p.photoUrl || null,
        is_admin: p.isAdmin || false,
        is_super_admin: p.isSuperAdmin || false,
      }));

      const { error } = await supabase
        .from("whatsapp_group_participants")
        .upsert(records, { onConflict: "group_jid,session_id,participant_jid" });

      if (error) {
        console.error("[GroupParticipantsPanel] Cache save error:", error);
      } else {
        console.log("[GroupParticipantsPanel] Saved to cache:", records.length);
        
        // Update participant_count in whatsapp_groups
        await supabase
          .from("whatsapp_groups")
          .update({ participant_count: participantsList.length })
          .eq("group_jid", groupJid)
          .eq("session_id", apiKey);
      }
    } catch (err) {
      console.error("[GroupParticipantsPanel] Cache save error:", err);
    }
  };

  // Update single participant photo in cache
  const updatePhotoInCache = async (participantJid: string, photoUrl: string) => {
    try {
      await supabase
        .from("whatsapp_group_participants")
        .update({ photo_url: photoUrl })
        .eq("group_jid", groupJid)
        .eq("session_id", apiKey)
        .eq("participant_jid", participantJid);
    } catch (err) {
      console.error("[GroupParticipantsPanel] Photo cache update error:", err);
    }
  };

  const fetchParticipants = async () => {
    if (!apiKey || !groupJid) return;

    const fetchKey = `${apiKey}|${groupJid}`;
    const now = Date.now();
    if (lastFetchRef.current.key === fetchKey && now - lastFetchRef.current.at < 3_000) {
      return;
    }
    lastFetchRef.current = { key: fetchKey, at: now };

    setIsLoading(true);
    setError(null);

    // First, try to load from cache for instant display
    const cached = await loadCachedParticipants();
    if (cached.length > 0) {
      setParticipants(cached);
      setIsLoading(false);
      // Still fetch fresh data in background
      fetchFromApiInBackground();
      return;
    }

    // No cache, fetch from API
    await fetchFromApi();
  };

  const fetchFromApiInBackground = async () => {
    try {
      const response = await fetch(
        `https://www.wasenderapi.com/api/groups/${encodeURIComponent(groupJid)}/metadata`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) return;

      const result = await response.json();
      const rawParticipants = result?.data?.participants;

      if (result?.success && Array.isArray(rawParticipants)) {
        const participantsList: Participant[] = rawParticipants.map((p: any) => ({
          id: p.id || p.jid || "",
          jid: p.jid || p.id || "",
          phone: p.pn || p.jid?.replace(/@s\.whatsapp\.net$/, "") || "",
          name: p.name || p.notify || undefined,
          isAdmin: p.isAdmin || p.admin === "admin",
          isSuperAdmin: p.isSuperAdmin || p.admin === "superadmin",
          photoUrl: null,
        }));

        // Merge with existing photos from cache
        setParticipants((prev) => {
          const photoMap = new Map(prev.filter((p) => p.photoUrl).map((p) => [p.jid, p.photoUrl]));
          return participantsList.map((p) => ({
            ...p,
            photoUrl: photoMap.get(p.jid) || null,
          }));
        });

        // Save new participants to cache (without photos yet)
        await saveToCache(participantsList);
      }
    } catch (err) {
      console.error("[GroupParticipantsPanel] Background fetch error:", err);
    }
  };

  const fetchFromApi = async () => {
    try {
      console.log("[GroupParticipantsPanel] Fetching from API", { groupJid });

      const response = await fetch(
        `https://www.wasenderapi.com/api/groups/${encodeURIComponent(groupJid)}/metadata`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 429) {
        let retryAfter = 30;
        try {
          const body = await response.json();
          retryAfter = Number(body?.retry_after) || retryAfter;
        } catch {}
        setError(`Limite da WaSender atingido. Tente novamente em ${retryAfter}s.`);
        return;
      }

      if (response.status === 401 || response.status === 403) {
        setError("Sessão WaSender inválida/expirada. Selecione a conta novamente.");
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const result = await response.json();
      const rawParticipants = result?.data?.participants;

      if (result?.success && Array.isArray(rawParticipants)) {
        const participantsList: Participant[] = rawParticipants.map((p: any) => ({
          id: p.id || p.jid || "",
          jid: p.jid || p.id || "",
          phone: p.pn || p.jid?.replace(/@s\.whatsapp\.net$/, "") || "",
          name: p.name || p.notify || undefined,
          isAdmin: p.isAdmin || p.admin === "admin",
          isSuperAdmin: p.isSuperAdmin || p.admin === "superadmin",
          photoUrl: null,
        }));

        setParticipants(participantsList);
        await saveToCache(participantsList);
      } else {
        setParticipants([]);
        setError("Participantes não disponíveis para este grupo.");
      }
    } catch (err: any) {
      console.error("[GroupParticipantsPanel] Error:", err);
      setError("Erro ao carregar participantes");
    } finally {
      setIsLoading(false);
    }
  };

  const loadPhotos = async (participantsList: Participant[]) => {
    const toFetch = participantsList.filter((p) => p.jid && !p.photoUrl);
    if (toFetch.length === 0) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsLoadingPhotos(true);
    setPhotoLoadProgress({ current: 0, total: toFetch.length });

    let processed = 0;
    let rateLimitHits = 0;

    for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
      if (signal.aborted) break;

      const batch = toFetch.slice(i, i + BATCH_SIZE);

      for (const participant of batch) {
        if (signal.aborted) break;

        try {
          const picResponse = await fetch(
            `https://www.wasenderapi.com/api/contacts/${encodeURIComponent(participant.jid)}/picture`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              signal,
            }
          );

          if (picResponse.status === 429) {
            rateLimitHits++;
            await new Promise((resolve) => setTimeout(resolve, 3000));
            if (rateLimitHits >= 5) break;
            continue;
          }

          rateLimitHits = 0;

          if (picResponse.ok) {
            const picResult = await picResponse.json();
            const imgUrl = picResult?.data?.imgUrl || picResult?.imgUrl || null;

            if (imgUrl) {
              setParticipants((prev) =>
                prev.map((p) => (p.id === participant.id ? { ...p, photoUrl: imgUrl } : p))
              );
              // Save photo to cache
              await updatePhotoInCache(participant.jid, imgUrl);
            }
          }
        } catch (e: any) {
          if (e.name === "AbortError") break;
          console.error("[GroupParticipantsPanel] Error fetching picture:", e);
        }

        processed++;
        setPhotoLoadProgress({ current: processed, total: toFetch.length });
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
      }

      if (!signal.aborted && i + BATCH_SIZE < toFetch.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    setIsLoadingPhotos(false);
    setPhotoLoadProgress({ current: 0, total: 0 });
  };

  const cancelPhotoLoading = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoadingPhotos(false);
    setPhotoLoadProgress({ current: 0, total: 0 });
  };

  useEffect(() => {
    fetchParticipants();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [groupJid, apiKey]);

  // Load photos for participants without photos
  useEffect(() => {
    if (participants.length > 0 && !isLoadingPhotos) {
      const missingPhotos = participants.filter((p) => !p.photoUrl);
      if (missingPhotos.length > 0) {
        loadPhotos(participants);
      }
    }
  }, [participants.length]);

  return (
    <div className="w-[340px] border-l border-border bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-muted/50 dark:bg-muted/30 px-4 py-4">
        <div className="flex items-center gap-3">
          {groupPhoto ? (
            <img
              src={groupPhoto}
              alt={groupName}
              className="w-12 h-12 rounded-full object-cover bg-muted"
              onError={(e) => {
                e.currentTarget.src = DEFAULT_AVATAR;
              }}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-white font-medium">
              {getInitials(groupName)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground truncate">{groupName}</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" />
              {participantCount > 0
                ? `${participantCount} participantes`
                : `${participants.length || "—"} participantes`}
            </p>
          </div>
        </div>
      </div>

      {/* Participants List Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
        <span className="text-sm font-medium text-foreground">Participantes</span>
        {isLoadingPhotos && (
          <button
            onClick={cancelPhotoLoading}
            className="flex items-center gap-1.5 px-2 py-1 text-xs bg-muted rounded-md hover:bg-muted/80 transition-colors"
            title="Clique para cancelar"
          >
            <Loader2 className="w-3 h-3 text-primary animate-spin" />
            <span className="text-muted-foreground">
              {photoLoadProgress.current}/{photoLoadProgress.total}
            </span>
          </button>
        )}
      </div>

      <ScrollArea className="flex-1">
        {isLoading && participants.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-8 px-4">
            <p className="text-sm text-muted-foreground">{error}</p>
            <button onClick={fetchParticipants} className="mt-2 text-xs text-primary hover:underline">
              Tentar novamente
            </button>
          </div>
        ) : participants.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Nenhum participante encontrado</div>
        ) : (
          <div className="divide-y divide-border/30">
            {participants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => onSelectParticipant?.(participant.phone, participant.name)}
              >
                {participant.photoUrl ? (
                  <img
                    src={participant.photoUrl}
                    alt={participant.name || participant.phone}
                    className="w-10 h-10 rounded-full object-cover bg-muted flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.nextElementSibling?.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <div
                  className={cn(
                    "w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground flex-shrink-0",
                    participant.photoUrl && "hidden"
                  )}
                >
                  {participant.name ? getInitials(participant.name) : "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {participant.name || formatPhoneFromJid(participant.phone)}
                    </span>
                    {(participant.isAdmin || participant.isSuperAdmin) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium">
                        {participant.isSuperAdmin ? "Dono" : "Admin"}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground truncate block">{formatPhoneFromJid(participant.phone)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default GroupParticipantsPanel;
