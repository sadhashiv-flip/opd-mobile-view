import { fetchPatientBlogs } from "@/api/patientBlogs";
import type { HealthClubBlog } from "@/lib/healthClubBlog";
import { useCallback, useEffect, useState } from "react";

export function useHealthClubBlogs() {
  const [blogs, setBlogs] = useState<readonly HealthClubBlog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchPatientBlogs({ page: 1, limit: 50 });
      setBlogs(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load articles.");
      setBlogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { blogs, loading, error, refresh };
}
