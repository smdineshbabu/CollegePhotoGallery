import api from "./api";

/**
 * Upload image or PDF to backend
 */
export const uploadFile = async (file) => {
  try {
    const formData = new FormData();

    formData.append("file", {
      uri: file.uri,
      name: file.name || "upload.jpg",
      type: file.mimeType || "image/jpeg",
    });

    const response = await api.post("/photos/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data;
  } catch (error) {
    throw error.response?.data || { message: "Upload failed" };
  }
};
