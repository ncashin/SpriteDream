import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

const fileListSchema = z.array(z.string());

export default function useFiles() {
  const { data: files } = useQuery({
    queryKey: ["files"],
    queryFn: async () => {
      const response = await fetch("/api/files");

      if (!response.ok) {
        throw new Error("Failed to fetch files");
      }

      const json = await response.json();

      const result = fileListSchema.safeParse(json);

      if (!result.success) {
        throw new Error("Invalid API response");
      }

      return result.data;
    },
  });

  return files ?? [];
}