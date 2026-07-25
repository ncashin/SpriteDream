import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

type UseFileOptions = {
  onFileLoad?: (arg0: { filepath: string; data: any }) => void;
};

export default function useFile(filepath: string | undefined, options?: UseFileOptions) {
  const queryClient = useQueryClient();
  const [loadedFilepath, setLoadedFilepath] = useState<string | undefined>(filepath);

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

  if (filepath && !fileQuery.isPending && !fileQuery.isError && !(loadedFilepath === filepath)) {
    setLoadedFilepath(filepath);
    options?.onFileLoad?.({ filepath, data: fileQuery.data });
  }

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

    onError: (_error, _content, context) => {
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
