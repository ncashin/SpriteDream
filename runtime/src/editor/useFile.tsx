import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

export default function useFile(filepath: string | undefined) {
  const queryClient = useQueryClient();

  const fileQuery = useSuspenseQuery({
    queryKey: ["files", filepath],
    queryFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay

      const response = await fetch(`/api/files/${filepath}`);

      if (!response.ok) {
        throw new Error("Failed to fetch file");
      }

      return response.json();
    },
  });

  const writeMutation = useMutation({
    mutationKey: ["files", filepath],
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
