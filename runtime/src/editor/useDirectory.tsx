import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

const directorySchema = z.array(z.string());

export default function useDirectory() {
  return useQuery({
    queryKey: ["files"],
    queryFn: async () => {
      const response = await fetch("/api/files");

      if (!response.ok) {
        throw new Error("Failed to fetch files");
      }

      const json = await response.json();

      const result = directorySchema.safeParse(json);

      if (!result.success) {
        throw new Error("Invalid API response");
      }

      return result.data;
    },
  });
}
