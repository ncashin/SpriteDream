import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export default function useFile(filepath: string | undefined) {
  const queryClient = useQueryClient();

  const fileQuery = useQuery({
    queryKey: ["file", filepath],
    queryFn: async () => {
      const response = await fetch(`/api/files/${filepath}`);

      if (!response.ok) {
        throw new Error("Failed to fetch file");
      }

      return response.json();
    },
    enabled: !!filepath,
  });

  const writeMutation = useMutation({
    mutationKey: ["file", filepath],
    mutationFn: async (data: BlobPart[]) => {
      if (!filepath) return;
      const file = new File(data, filepath);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/files/${filepath}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to write file");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["file", filepath] });
    },
  });

  return {
    fileQuery,
    writeMutation,
  };
}
