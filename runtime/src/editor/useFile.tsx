import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

export default function useFile(filepath: string | undefined) {
  const queryClient = useQueryClient();

  const queryKey = ["files", filepath];
  const fileQuery = useSuspenseQuery({
    queryKey,
    queryFn: async () => {
      const response = await fetch(`/api/files/${filepath}`);

      if (!response.ok) {
        throw new Error("Failed to fetch file");
      }

      return response.json();
    },
  });

  const writeMutation = useMutation({
    mutationKey: queryKey,

    mutationFn: async (content: string[]) => {
      if (!filepath) {
        throw new Error("No filepath");
      }

      const file = new File(content, filepath);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/files/${filepath}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to write file");
      }
    },

    onMutate: async (content) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, {
        content,
      });

      return { previous };
    },

    onError: (error, content, context) => {
      if (!context?.previous) return;
      queryClient.setQueryData(queryKey, context.previous);
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    fileQuery,
    writeMutation,
  };
}
